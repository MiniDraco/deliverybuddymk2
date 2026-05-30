// Test harness for DeliveryBuddy MK2.
// Loads the REAL production <script> from index.html into a sandboxed VM with a
// minimal DOM/localStorage stub, then exposes the app's internal functions via
// an injected __API epilogue. This means unit tests run against shipping code,
// not a copy.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(__dirname, '..', 'index.html');

function extractScript() {
  const html = fs.readFileSync(HTML, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script> block found in index.html');
  return m[1];
}

// A fake DOM element that swallows everything and remembers a few props.
function makeEl(id) {
  const cls = new Set();
  const style = new Proxy({}, { get: (t, k) => (k in t ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; } });
  return {
    id, value: '', textContent: '', innerHTML: '', href: '', download: '', files: [], style,
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
      toggle: (c, f) => { const has = cls.has(c); const on = f === undefined ? !has : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      _set: cls,
    },
    appendChild() {}, removeChild() {}, remove() {}, click() {}, addEventListener() {},
    setAttribute() {}, getAttribute() { return null; }, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
  };
}

export function loadApp() {
  let code = extractScript();
  // Expose internals without modifying the source file.
  code += `
;globalThis.__API = {
  calc, grade, scoreOffer, scoreColor, parseOffer, parseVoice, workedAvgEff, sumExpenses,
  cpm: () => cpm(), realMiles: x => realMiles(x), f2: x => f2(x), fMin: x => fMin(x),
  payoutOf: r => payoutOf(r),
  esc: s => esc(s),
  safeId: s => safeId(s), normalizeIds: () => normalizeIds(), coerceCfg: () => coerceCfg(),
  setStops: n => setStops(n),
  get stops() { return stops; }, set stops(v) { stops = v; },
  get cfg() { return cfg; }, set cfg(v) { Object.assign(cfg, v); },
  get history() { return history; }, set history(v) { history = v; },
  get expenses() { return expenses; }, set expenses(v) { expenses = v; },
  get shifts() { return shifts; }, set shifts(v) { shifts = v; },
  get activeShift() { return activeShift; }, set activeShift(v) { activeShift = v; },
  renderStats: () => renderStats(), renderHistory: () => renderHistory(), renderRef: () => renderRef(),
  analyze: () => analyze(), confirmRide: () => confirmRide(), decideRide: s => decideRide(s),
  save: () => save(), load: () => load(),
  exportJSON: () => exportJSON(), importJSON: f => importJSON(f), exportCSV: () => exportCSV(),
  // decision / history workflow
  markCompleted: id => markCompleted(id), addDetails: id => addDetails(id),
  setActual: id => setActual(id), delEntry: id => delEntry(id), clearHistory: () => clearHistory(),
  setFilter: f => setFilter(f),
  // compare
  holdForCompare: () => holdForCompare(), clearCompare: () => clearCompare(),
  // platform / shifts / windows
  setPlatform: p => setPlatform(p), startShift: () => startShift(), endShift: () => endShift(),
  shiftHours: s => shiftHours(s), updateShiftBanner: () => updateShiftBanner(),
  todayStart: () => todayStart(), winStart: w => winStart(w), setWindow: w => setWindow(w),
  // expenses
  addExpense: () => addExpense(), delExpense: id => delExpense(id),
  get lastExport() { return globalThis.__lastBlobText; },
};
`;

  const elements = new Map();
  const getEl = id => { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); };
  const captured = { blobText: null };  // records the last Blob payload (export output)

  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: i => [...store.keys()][i],
  };

  const documentStub = {
    getElementById: getEl,
    createElement: () => makeEl('_new'),
    head: makeEl('head'),
    body: makeEl('body'),
    addEventListener() {},
  };

  const windowStub = { addEventListener() {} };

  // Queued prompt() answers + a settable confirm() result, so prompt-driven flows
  // (addExpense, addDetails, setActual, clearHistory) can run for real in tests.
  let promptQueue = [];
  let confirmReturn = true;

  const sandbox = {
    window: windowStub,
    document: documentStub,
    localStorage,
    prompt: () => (promptQueue.length ? promptQueue.shift() : null),
    confirm: () => confirmReturn,
    alert: () => {},
    navigator: { serviceWorker: { register: () => Promise.resolve() }, geolocation: null, clipboard: null },
    location: { protocol: 'http:', search: '', pathname: '/', href: 'http://localhost/' },
    history: { replaceState() {} },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    console, URLSearchParams, Date, Math, JSON,
    parseFloat, parseInt, isNaN, Number, String, Object, Array, Promise,
    Blob: class Blob { constructor(parts) { captured.blobText = (parts || []).join(''); this.parts = parts; } },
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
    FileReader: class FileReader { readAsText(file) { this.result = file && file._text != null ? file._text : ''; if (this.onload) this.onload(); } },
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'deliverybuddy-app.js' });
  return {
    api: sandbox.__API, localStorage, store, elements, sandbox,
    setPrompts: arr => { promptQueue = (arr || []).slice(); },
    setConfirm: v => { confirmReturn = v !== false; },
    get lastExport() { return captured.blobText; },
  };
}

// ── tiny assert/test runner ───────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; } else { fail++; failures.push(`✗ ${msg}\n    expected ${e}\n    got      ${a}`); }
}
export function near(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) <= tol) { pass++; } else { fail++; failures.push(`✗ ${msg}\n    expected ≈${expected} (±${tol})\n    got      ${actual}`); }
}
export function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; failures.push(`✗ ${msg}`); }
}
export function report(label) {
  console.log(`\n${label}: ${pass} passed, ${fail} failed`);
  if (failures.length) { console.log(failures.join('\n')); }
  return { pass, fail };
}
export function resetCounters() { pass = 0; fail = 0; failures.length = 0; }
