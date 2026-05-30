// Dependency-free PDF generator for the DeliveryBuddy MK2 Install & Usage Guide.
// Uses Courier (monospace) so text wrapping is exact and never overflows.
// Run:  node tools/make-guide.mjs   ->  writes DeliveryBuddy-MK2-Guide.pdf
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'DeliveryBuddy-MK2-Guide.pdf');

// ── page geometry (US Letter) ────────────────────────────────────────────────
const PW = 612, PH = 792, ML = 54, MR = 54, MT = 60, MB = 54;
const USABLE = PW - ML - MR;
const CW10 = 6;                 // Courier char width at 10pt = 0.6 em
const wrapAt = size => Math.floor(USABLE / (size * 0.6));

const GREEN = [0.29, 0.87, 0.50];
const DARK  = [0.10, 0.10, 0.12];
const GREY  = [0.45, 0.45, 0.50];
const RULE  = [0.80, 0.82, 0.85];

// ── content model ────────────────────────────────────────────────────────────
// block helpers push {text, font, size, color, indent, gap, rule, page}
const B = [];
const title = t => B.push({ t, font: 'F2', size: 20, color: GREEN, gap: 4 });
const sub   = t => B.push({ t, font: 'F1', size: 10, color: GREY, gap: 14, wrap: true });
const h1    = t => B.push({ t, font: 'F2', size: 14, color: GREEN, gap: 4, keep: true, padTop: 10 });
const h2    = t => B.push({ t, font: 'F2', size: 11, color: DARK, gap: 3, keep: true, padTop: 6 });
const p     = t => B.push({ t, font: 'F1', size: 10, color: DARK, gap: 5, wrap: true });
const li    = t => B.push({ t, font: 'F1', size: 10, color: DARK, gap: 3, wrap: true, indent: 16, bullet: '* ' });
const code  = t => B.push({ t, font: 'F1', size: 9.5, color: [0.15,0.30,0.55], gap: 4, indent: 16, mono: true });
const gap   = (h=6) => B.push({ spacer: h });
const rule  = () => B.push({ rule: true, gap: 8 });
const pagebreak = () => B.push({ pagebreak: true });

// ════════════════════════════════════════════════════════════════════════════
// CONTENT
// ════════════════════════════════════════════════════════════════════════════
title('DeliveryBuddy MK2');
sub('Install & Usage Guide  -  food / product delivery profit analyzer  (Uber - DoorDash - Grubhub)');
rule();

h1('1. What it is');
p('DeliveryBuddy MK2 is a single-file, installable web app (PWA) that tells you whether a');
p('delivery offer is worth taking. You enter the payout, miles, and number of stops; it');
p('grades the offer against your target $/hr after fuel and deadhead (empty miles back).');
p('Everything runs on your phone. There is no account, no server, and no data leaves the');
p('device - all history is stored locally in the browser.');
gap();
p('It is a profit ANALYZER only. It does not auto-accept offers or automate the delivery');
p('apps in any way.');

h1('2. What you need');
li('An Android phone (built and tested on a Pixel 9) with Chrome, or any modern browser.');
li('The app folder "deliverybuddymk2" containing: index.html, manifest.webmanifest, sw.js, and icon.svg.');
li('A way to serve the folder over https or localhost (see Section 3). Opening the file directly with file:// will show the app but WILL NOT install or accept screenshots.');

h1('3. Install on your phone');
h2('Why hosting is required');
p('Install + Share-to-app (screenshot OCR) only work over https or localhost. Pick ONE of');
p('the hosting options below, then do "Add to Home screen".');

h2('Option A - GitHub Pages (free, permanent link)');
li('Create a new GitHub repository and upload the four app files to the root.');
li('In the repo: Settings > Pages > Build from branch > main > / (root) > Save.');
li('Wait ~1 minute; open the https://<you>.github.io/<repo>/ link on your phone.');

h2('Option B - Netlify / Cloudflare Pages (drag-and-drop)');
li('Go to app.netlify.com (or Cloudflare Pages) and sign in.');
li('Drag the "deliverybuddymk2" folder onto the deploy area.');
li('Open the generated https link on your phone.');

h2('Option C - Local server (same Wi-Fi, no internet host)');
p('From the folder on a computer, run one of:');
code('python -m http.server 8732');
code('npx serve .');
p('Then on the phone (same Wi-Fi) open http://<computer-ip>:8732/. Note: a plain LAN IP');
p('over http counts as "not secure", so install may be blocked - use localhost on the');
p('device itself, or prefer Option A/B for the real phone install.');

h2('Add to Home screen / Install');
li('Open the hosted link in Chrome on the phone.');
li('Tap the menu (three dots) > "Install app" or "Add to Home screen".');
li('Launch it from the new icon - it now runs full-screen like a native app and works offline (the service worker caches it).');

pagebreak();

h1('4. First-time setup (More tab)');
p('Open the "More" tab and set these once so the math fits your car and goals:');
li('Target $/hr - the bar every offer must clear (default $20).');
li('Daily goal $ - drives the progress bar on Stats (default $150).');
li('Grade on NET - on = grade after fuel cost (recommended); off = grade on gross.');
li('MPG and Gas price - your fuel economy and local pump price (default 25 mpg / $3.50).');
li('Return factor - share of miles you drive back empty (default 0.40 = 40%).');
li('Avg speed, First-stop wait, Extra-stop wait, Idle min - the drive/wait model.');
li('Tax set-aside % - what to park for taxes (default 25%).');
li('IRS rate - mileage deduction estimate shown in Stats (default $0.67/mi).');
gap();
p('Optional comfort toggles: "Speak the verdict" (reads the result aloud) and "Driving');
p('mode" (bigger buttons and text for hands-light use).');

h1('5. The five tabs');
li('Offer  - enter an offer and Analyze it; this is the home screen.');
li('Stats  - net profit, daily-goal bar, real $/hr, accept rate, taxes, expenses, forecast.');
li('History- every analyzed/accepted offer; mark done, add tips, backfill miles, delete.');
li('Min $  - reference table: the minimum payout to clear your target at each distance.');
li('More   - all settings, plus backup / restore / CSV export.');

h1('6. Daily workflow');
h2('Standard (you have a moment to read the offer)');
li('On the Offer tab, type the payout and miles, set the number of stops.');
li('Tap Analyze. You get a verdict (GREAT / WORTH IT / BORDERLINE / SKIP IT), an acceptance score 0-100, the net $, and the real $/hr after fuel + deadhead.');
li('Tap "Accept & Start" if you take it, or "Decline" to log the pass.');

h2('When you must accept FIRST (no time to read)');
li('Tap "Confirm Ride Now" - it logs the start time instantly, even with empty fields.');
li('Later, open History and backfill payout / miles, then "Mark done" to stamp the end time and compute your real $/hr and actual $/mi. "Tip" sets the final payout.');

h2('Compare two stacked offers');
li('Analyze offer A, tap the COMPARE button to hold it, then analyze offer B - the app shows which one wins.');

h1('7. Fast input options');
li('Screenshot OCR - share a screenshot of the offer to DeliveryBuddy (Android share sheet). It reads the largest $ as payout, the first "x mi", and the stop count, then auto-analyzes. (On-device, lazy-loaded; needs the installed app.)');
li('Voice entry - tap the mic and say e.g. "9 dollars 50, 4 miles, 2 stops".');
li('Paste - copy offer text, tap Paste, and it parses the same way.');

pagebreak();

h1('8. Shifts, stats, taxes & expenses');
li('Start shift / End shift (Stats tab) tracks your real online hours so $/hr is honest.');
li('Stats window toggles Today / 7-day / All.');
li('Tax jar shows what to set aside (your % of take-home, never on a loss).');
li('Expense tracker - add gas, tolls, supplies; they reduce take-home and the tax basis.');
li('Earnings forecast projects today\'s pace to your shift-goal hours.');
li('Decline-regret flags declined offers that would have beaten your average.');
li('Weather-aware target - optional one-tap check (free, no key) suggests +10% target in rough conditions; it fails gracefully if you decline location.');

h1('9. Backup, restore & export');
li('Export JSON (More tab) saves a full backup: settings, history, shifts, expenses.');
li('Import JSON restores a backup. Malformed files are rejected safely.');
li('Export CSV gives a spreadsheet of your history (one row per offer, with the score).');
p('Tip: export a JSON backup before clearing history or switching phones.');

h1('10. Privacy & data');
li('100% on-device. No account, no analytics, no server calls (except the optional weather check and the one-time OCR engine download).');
li('Data lives in your browser storage under "db-*" keys. Clearing browser data or uninstalling removes it - keep a JSON backup.');

h1('11. Troubleshooting');
h2('No "Install" option appears');
li('You are likely on file:// or plain http. Use https (Option A/B) and open in Chrome.');
h2('Sharing a screenshot does nothing');
li('Share Target only works after the app is installed from an https origin.');
h2('Numbers look wrong after importing an old backup');
li('The app sanitizes imported data on load, but check the More tab values (MPG, gas, target) match your setup - a bad import is coerced to safe defaults, not your prefs.');
h2('OCR misreads an offer');
li('Screenshots vary by app; just correct the payout/miles fields and re-Analyze.');

rule();
sub('Single-file PWA - no backend - all data on your device.  Drive safe and pick the good offers.');

// ════════════════════════════════════════════════════════════════════════════
// LAYOUT ENGINE  ->  list of pages, each a list of draw ops
// ════════════════════════════════════════════════════════════════════════════
function wrapText(text, size, indentChars) {
  const max = wrapAt(size) - indentChars;
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur.length) { cur = w; continue; }
    if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur.length || !lines.length) lines.push(cur);
  return lines;
}

const pages = [];
let ops = [];
let y = PH - MT;
function newPage() { if (ops.length) pages.push(ops); ops = []; y = PH - MT; }
function space(h) { y -= h; if (y < MB) newPage(); }

for (const blk of B) {
  if (blk.pagebreak) { newPage(); continue; }
  if (blk.spacer) { space(blk.spacer); continue; }
  if (blk.rule) {
    if (y - 10 < MB) newPage();
    ops.push({ type: 'rule', x1: ML, x2: PW - MR, y: y - 4, color: RULE });
    space((blk.gap || 8) + 4);
    continue;
  }
  if (blk.padTop) space(blk.padTop);
  const size = blk.size;
  const lineH = size * 1.45;
  const indentChars = blk.indent ? Math.round(blk.indent / (size * 0.6)) : 0;
  const indentPx = blk.indent || 0;
  const prefix = blk.bullet || '';
  const lines = blk.wrap
    ? wrapText((prefix ? '' : '') + blk.t, size, indentChars + (prefix ? prefix.length : 0))
    : [blk.t];
  // keep headings with at least one following line on the same page
  if (blk.keep && (y - lineH * 2) < MB) newPage();
  lines.forEach((ln, i) => {
    if (y - lineH < MB) newPage();
    const text = (prefix && i === 0) ? prefix + ln : (prefix ? '  '.repeat(0) + ' '.repeat(prefix.length) + ln : ln);
    ops.push({ type: 'text', x: ML + indentPx, y: y - size, text, font: blk.font, size, color: blk.color });
    y -= lineH;
  });
  space(blk.gap || 4);
}
newPage();

// ════════════════════════════════════════════════════════════════════════════
// PDF SERIALIZER
// ════════════════════════════════════════════════════════════════════════════
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const fmt = n => (Math.round(n * 100) / 100).toString();

function contentStream(page) {
  let s = '';
  for (const op of page) {
    if (op.type === 'rule') {
      const [r, g, b] = op.color;
      s += `${fmt(r)} ${fmt(g)} ${fmt(b)} RG 0.7 w ${fmt(op.x1)} ${fmt(op.y)} m ${fmt(op.x2)} ${fmt(op.y)} l S\n`;
    } else if (op.type === 'text') {
      const [r, g, b] = op.color;
      s += `BT /${op.font} ${fmt(op.size)} Tf ${fmt(r)} ${fmt(g)} ${fmt(b)} rg `;
      s += `${fmt(op.x)} ${fmt(op.y)} Td (${esc(op.text)}) Tj ET\n`;
    }
  }
  return s;
}

// object table
const objs = [];
const add = body => { objs.push(body); return objs.length; }; // returns 1-based id

const fontReg  = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>');
const fontObl  = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Oblique >>');
const resId = add(`<< /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R /F3 ${fontObl} 0 R >> >>`);

// reserve pages-parent id
const pagesId = objs.length + 1; add('PLACEHOLDER');

const pageIds = [];
for (const pg of pages) {
  const cs = contentStream(pg);
  const csId = add(`<< /Length ${Buffer.byteLength(cs, 'latin1')} >>\nstream\n${cs}endstream`);
  const pid = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${resId} 0 R /Contents ${csId} 0 R >>`);
  pageIds.push(pid);
}
objs[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] >>`;
const catId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

// assemble
let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
const offsets = [];
objs.forEach((body, i) => {
  offsets[i] = Buffer.byteLength(pdf, 'latin1');
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xrefPos = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
offsets.forEach(off => { pdf += String(off).padStart(10, '0') + ' 00000 n \n'; });
pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

fs.writeFileSync(OUT, Buffer.from(pdf, 'latin1'));
console.log(`Wrote ${OUT}  (${pages.length} pages, ${objs.length} objects)`);
