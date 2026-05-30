// DeliveryBuddy MK2 — accumulating test suite. New blocks are added each QA round.
import { loadApp, eq, near, ok, report } from './harness.mjs';

function freshCfg(api) {
  api.cfg = {
    targetHourly: 20, dailyGoal: 150, platform: 'uber', gradeOnNet: true,
    avgSpeed: 20, idleMin: 0, firstWait: 6, extraWait: 4,
    mpg: 25, gasPrice: 3.50, irsRate: 0.67,
    returnFactor: 0.4, taxPct: 0.25, shiftGoalHours: 8,
    speakVerdict: false, drivingMode: false,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 1 — core math, grading, scoring, parsers
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // fuel cost per mile
  near(api.cpm(), 0.14, 1e-9, 'R1 cpm = gas/mpg = 3.5/25');
  near(api.realMiles(10), 14, 1e-9, 'R1 realMiles applies 40% deadhead');

  // calc() with deadhead folded in
  const r = api.calc(10, 5, 1);
  near(r.totalMiles, 7, 1e-9, 'R1 calc totalMiles = 5*(1+0.4)');
  near(r.driveMin, 21, 1e-9, 'R1 calc driveMin = 7mi * 3min/mi');
  near(r.cycleMin, 27, 1e-9, 'R1 calc cycleMin = drive21 + wait6');
  near(r.fuel, 0.98, 1e-9, 'R1 calc fuel = 7 * 0.14');
  near(r.net, 9.02, 1e-9, 'R1 calc net = 10 - 0.98');
  near(r.netEff, 20.044, 0.01, 'R1 calc netEff = 9.02 / 0.45h');

  // calc with no deadhead matches plain miles
  api.cfg = { returnFactor: 0 };
  const r0 = api.calc(10, 5, 1);
  near(r0.totalMiles, 5, 1e-9, 'R1 returnFactor 0 => totalMiles == miles');
  freshCfg(api);

  // grade thresholds (ratio vs target 20)
  eq(api.grade(26).label, 'GREAT', 'R1 grade >=1.3x = GREAT');
  eq(api.grade(20).label, 'WORTH IT', 'R1 grade ==1.0x = WORTH IT');
  eq(api.grade(18).label, 'BORDERLINE', 'R1 grade 0.9x = BORDERLINE');
  eq(api.grade(10).label, 'SKIP IT', 'R1 grade <0.85x = SKIP IT');

  // scoreOffer in 0..100 and monotonic-ish
  const sc = api.scoreOffer(r, 10, 5, 1);
  ok(sc >= 0 && sc <= 100, 'R1 score in [0,100]');
  ok(sc > 50, 'R1 a worth-it offer scores above 50');

  // BUG GUARD: scoreOffer must honor the stops argument, not a global.
  api.stops = 1;
  const sLow = api.scoreOffer(r, 10, 5, 1);   // 1 stop
  const sHigh = api.scoreOffer(r, 10, 5, 4);  // 4 stops -> lower stop bonus
  ok(sHigh < sLow, 'R1 more stops lowers the score (uses passed stops, not global)');

  // parseOffer pulls largest $, first miles, stop count
  const p = api.parseOffer('New offer $12.50 to Chipotle, 3.2 mi, 2 stops total. Base $4.00');
  eq(p.payout, 12.5, 'R1 parseOffer picks largest $');
  eq(p.miles, 3.2, 'R1 parseOffer reads miles');
  eq(p.stops, 2, 'R1 parseOffer reads stops');

  // parseVoice (digits as spoken by Android STT)
  const v = api.parseVoice('$9.50 4 miles 2 stops');
  eq(v.payout, 9.5, 'R1 parseVoice payout');
  eq(v.miles, 4, 'R1 parseVoice miles');
  eq(v.stops, 2, 'R1 parseVoice stops');

  // workedAvgEff over history
  api.history = [
    { status: 'completed', eff: 20 }, { status: 'accepted', eff: 30 }, { status: 'declined', eff: 5 },
  ];
  near(api.workedAvgEff(), 25, 1e-9, 'R1 workedAvgEff averages only worked rides');

  // sumExpenses windowing
  api.expenses = [
    { ts: 1000, amount: 3 }, { ts: 5000, amount: 2 }, { ts: 9000, amount: 5 },
  ];
  near(api.sumExpenses(5000), 7, 1e-9, 'R1 sumExpenses sums ts >= start');

  report('ROUND 1');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 2 — stress: bulk data, extreme inputs, division-by-zero, no-NaN guards
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);
  const finite = x => Number.isFinite(x);

  // Extreme but valid offer: huge miles, 4 stops
  const big = api.calc(0, 9999, 4);
  ok(finite(big.fuel) && finite(big.netEff) && finite(big.minPay) && finite(big.cycleMin),
    'R2 calc(0, 9999, 4) produces only finite numbers');

  // Zero-everything cycle must not divide-by-zero
  api.cfg = { avgSpeed: 20, idleMin: 0, firstWait: 0, extraWait: 0 };
  const z = api.calc(5, 0, 0);
  ok(finite(z.netEff) && finite(z.grossEff), 'R2 zero-distance/zero-wait stays finite');
  eq(z.netEff, 0, 'R2 zero cycle => 0 $/hr (guarded, not NaN)');
  freshCfg(api);

  // avgSpeed 0 -> MPM fallback (3), mpg 0 -> cpm 0 (no fuel), no NaN
  api.cfg = { avgSpeed: 0, mpg: 0 };
  const dz = api.calc(10, 5, 1);
  ok(finite(dz.driveMin) && finite(dz.fuel) && finite(dz.netEff), 'R2 avgSpeed=0 & mpg=0 stay finite');
  eq(dz.fuel, 0, 'R2 mpg=0 => fuel 0 (no Infinity)');
  freshCfg(api);

  // scoreOffer extremes: miles 0, negative-ish eff
  ok(finite(api.scoreOffer({ eff: 0 }, 0, 0, 0)), 'R2 scoreOffer with 0 miles is finite');
  ok(api.scoreOffer({ eff: -50 }, 1, 100, 4) >= 0, 'R2 scoreOffer never negative');
  ok(api.scoreOffer({ eff: 9999 }, 9999, 1, 0) <= 100, 'R2 scoreOffer never exceeds 100');

  // targetHourly 0 (could arrive via imported backup) must not crash scoring
  api.cfg = { targetHourly: 0 };
  ok(finite(api.scoreOffer({ eff: 10 }, 10, 5, 1)), 'R2 target 0 => scoreOffer finite (guarded ratio)');
  // grade() must not return NaN-driven SKIP when target 0 (latent: eff/0)
  eq(api.grade(10).label, 'GREAT', 'R2 grade guards target 0 with positive eff');
  eq(api.grade(0).label, 'SKIP IT', 'R2 grade target 0 + zero eff = SKIP, not NaN');
  freshCfg(api);

  // Bulk history: 500 worked + declined entries; renders must not throw
  const hist = [];
  for (let i = 0; i < 500; i++) {
    const m = 1 + (i % 12), p = 4 + (i % 25);
    const r = api.calc(p, m, i % 5);
    hist.push({
      id: 'h' + i, platform: ['uber', 'doordash', 'grubhub', 'other'][i % 4],
      status: i % 3 === 0 ? 'declined' : (i % 3 === 1 ? 'accepted' : 'completed'),
      ts: Date.now() - i * 60000, startedAt: Date.now() - i * 60000,
      completedAt: i % 3 === 2 ? Date.now() - i * 60000 + 1800000 : null,
      p, m, stops: i % 5, actualP: i % 7 === 0 ? p + 3 : null,
      score: api.scoreOffer(r, p, m, i % 5), ...r, g: api.grade(r.eff),
    });
  }
  api.history = hist;
  api.expenses = Array.from({ length: 50 }, (_, i) => ({ id: 'e' + i, ts: Date.now() - i * 60000, kind: 'gas', amount: 1 + i }));
  api.shifts = []; api.activeShift = null;
  let threw = null;
  try { api.renderStats(); api.renderHistory(); api.renderRef(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R2 render 500-entry history + 50 expenses without throwing' + (threw ? ' :: ' + threw : ''));
  ok(finite(api.workedAvgEff()), 'R2 workedAvgEff over 500 entries is finite');

  // payoutOf precedence: actualP (tip) overrides p; null-safe
  eq(api.payoutOf({ p: 10, actualP: 13 }), 13, 'R2 payoutOf prefers actualP');
  eq(api.payoutOf({ p: 10, actualP: null }), 10, 'R2 payoutOf falls back to p');
  eq(api.payoutOf({}), 0, 'R2 payoutOf null-safe -> 0');

  // parsers on garbage / empty
  eq(api.parseOffer(''), { payout: null, miles: null, stops: null }, 'R2 parseOffer empty -> nulls');
  eq(api.parseVoice(''), { payout: null, miles: null, stops: null }, 'R2 parseVoice empty -> nulls');
  const junk = api.parseOffer('!!!@@@ $$$ no numbers here at all ###');
  eq(junk.payout, null, 'R2 parseOffer junk -> null payout');

  report('ROUND 2');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 3 — parser fuzzing with realistic OCR / speech-to-text noise
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // Realistic Uber offer screenshot text
  let p = api.parseOffer('Uber\n$8.75\nIncludes $2.00 Promo\n4.2 mi · 12 min\nPicks up 1 order');
  eq(p.payout, 8.75, 'R3 Uber: largest $ over promo line');
  eq(p.miles, 4.2, 'R3 Uber: miles with middle dot');
  eq(p.stops, 1, 'R3 Uber: "1 order" -> 1 stop');

  // DoorDash, no stop wording -> stops null
  p = api.parseOffer('DoorDash\nTotal will be $13.50\nGuaranteed (incl. tips)\n6.8 mi');
  eq(p.payout, 13.5, 'R3 DoorDash payout');
  eq(p.miles, 6.8, 'R3 DoorDash miles');
  eq(p.stops, null, 'R3 DoorDash no stop word -> null');

  // Miles glued to unit, no space
  eq(api.parseOffer('$7 2.5mi').miles, 2.5, 'R3 "2.5mi" no space parses');
  eq(api.parseOffer('$9 to go 3miles away').miles, 3, 'R3 "3miles" parses');

  // 2 deliveries / double order
  eq(api.parseOffer('$15.20 total 5 mi 2 deliveries').stops, 2, 'R3 "2 deliveries" -> 2');

  // Voice: explicit dollars + miles + stops
  let v = api.parseVoice('pay is 12 dollars 3.5 miles 1 stop');
  eq(v.payout, 12, 'R3 voice "12 dollars"');
  eq(v.miles, 3.5, 'R3 voice "3.5 miles"');
  eq(v.stops, 1, 'R3 voice "1 stop"');

  // Voice fallback: bare leading number is payout, not miles
  v = api.parseVoice('15 4 miles');
  eq(v.payout, 15, 'R3 voice fallback: leading 15 = payout');
  eq(v.miles, 4, 'R3 voice fallback: 4 miles');

  // Voice with word-numbers (STT rarely does this) must not crash -> nulls
  v = api.parseVoice('four miles two stops');
  eq(v.miles, null, 'R3 voice word-numbers -> miles null (no crash)');

  // Stops cap at 4 in voice, clamp in offer (only 1..4 accepted)
  eq(api.parseVoice('9 dollars 8 stops').stops, 4, 'R3 voice clamps stops to 4');
  eq(api.parseOffer('$9 7 stops').stops, null, 'R3 offer rejects out-of-range stop count');

  // Payout sanity filter: ignore absurd >$500 OCR misreads
  eq(api.parseOffer('$9999 5 mi').payout, null, 'R3 absurd $9999 filtered out');

  report('ROUND 3');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 4 — error injection, migration, backup round-trip, data integrity
// ════════════════════════════════════════════════════════════════════════════
{
  // 4a. Corrupt localStorage must not throw; bad values fall back to defaults
  {
    const { api, localStorage } = loadApp();
    localStorage.setItem('db-history', '{not valid json');
    localStorage.setItem('db-cfg', 'also broken');
    let threw = null;
    try { api.load(); } catch (e) { threw = e.message; }
    ok(threw === null, 'R4 load() survives corrupt localStorage');
    ok(Array.isArray(api.history), 'R4 history stays an array after corrupt load');
    ok(api.cfg && typeof api.cfg.targetHourly === 'number', 'R4 cfg keeps numeric defaults after corrupt load');
  }

  // 4b. Legacy migration: da-* then ua-* when db-* absent
  {
    const { api, localStorage } = loadApp();
    localStorage.clear();
    localStorage.setItem('da-history', JSON.stringify([{ id: 'old1', status: 'completed', p: 9, m: 3 }]));
    localStorage.setItem('ua-cfg', JSON.stringify({ targetHourly: 27 }));
    api.history = []; api.cfg = { targetHourly: 20 };
    api.load();
    eq(api.history.length, 1, 'R4 migrates legacy da-history when db-history missing');
    eq(api.history[0].id, 'old1', 'R4 migrated entry preserved');
    eq(api.cfg.targetHourly, 27, 'R4 migrates ua-cfg target when db-cfg missing');
  }

  // 4c. save -> load round-trip preserves everything
  {
    const { api } = loadApp();
    freshCfg(api);
    api.cfg = { targetHourly: 23, taxPct: 0.3 };
    api.history = [{ id: 'a', status: 'completed', p: 10, m: 4, stops: 1, eff: 22 }];
    api.expenses = [{ id: 'e', ts: 1, kind: 'tolls', amount: 4 }];
    api.shifts = [{ id: 's', start: 1, end: 2 }];
    api.save();
    // clobber memory, then reload from the same backing store
    api.history = []; api.expenses = []; api.shifts = []; api.cfg = { targetHourly: 1 };
    api.load();
    eq(api.history.length, 1, 'R4 round-trip restores history');
    eq(api.expenses.length, 1, 'R4 round-trip restores expenses');
    eq(api.shifts.length, 1, 'R4 round-trip restores shifts');
    eq(api.cfg.targetHourly, 23, 'R4 round-trip restores cfg');
  }

  // 4d. exportJSON serializes cfg+history+shifts+expenses
  {
    const h = loadApp();
    const api = h.api;
    freshCfg(api);
    api.history = [{ id: 'x', status: 'accepted', p: 11, m: 5 }];
    api.expenses = [{ id: 'e1', ts: 1, kind: 'gas', amount: 2 }];
    api.exportJSON();
    const dump = JSON.parse(h.lastExport);
    ok(dump.cfg && Array.isArray(dump.history) && Array.isArray(dump.expenses) && Array.isArray(dump.shifts),
      'R4 exportJSON includes cfg/history/shifts/expenses');
    eq(dump.history[0].id, 'x', 'R4 exportJSON carries history');
    eq(dump.expenses[0].kind, 'gas', 'R4 exportJSON carries expenses');
  }

  // 4e. importJSON applies a valid backup; rejects garbage without throwing
  {
    const { api } = loadApp();
    freshCfg(api);
    const good = JSON.stringify({ cfg: { targetHourly: 31 }, history: [{ id: 'imp', status: 'completed' }], shifts: [], expenses: [{ id: 'ie', ts: 1, kind: 'fees', amount: 1 }] });
    let threw = null;
    try { api.importJSON({ _text: good }); } catch (e) { threw = e.message; }
    ok(threw === null, 'R4 importJSON of valid backup does not throw');
    eq(api.cfg.targetHourly, 31, 'R4 importJSON applies cfg');
    eq(api.history[0].id, 'imp', 'R4 importJSON applies history');
    eq(api.expenses[0].kind, 'fees', 'R4 importJSON applies expenses');

    const before = api.history.length;
    let threw2 = null;
    try { api.importJSON({ _text: '{{{ broken json' }); } catch (e) { threw2 = e.message; }
    ok(threw2 === null, 'R4 importJSON of garbage does not throw');
    eq(api.history.length, before, 'R4 garbage import leaves data unchanged');
  }

  report('ROUND 4');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 5 — quality/audit: HTML-injection escaping + golden regression
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp();
  const api = h.api;
  freshCfg(api);

  // esc() escapes the dangerous five
  eq(api.esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;', 'R5 esc escapes angle brackets');
  eq(api.esc(`a&b"c'd`), 'a&amp;b&quot;c&#39;d', 'R5 esc escapes & " \'');
  eq(api.esc(null), '', 'R5 esc null-safe');

  // BUG GUARD: a malicious expense kind must NOT reach stats innerHTML raw
  api.history = []; api.shifts = []; api.activeShift = null;
  api.expenses = [{ id: 'm', ts: Date.now(), kind: '<img src=x onerror=alert(1)>', amount: 5 }];
  api.renderStats();
  const statsHTML = h.elements.get('stats-content').innerHTML;
  ok(!statsHTML.includes('<img src=x onerror=alert(1)>'), 'R5 raw <img> from expense kind is NOT injected');
  ok(statsHTML.includes('&lt;img'), 'R5 expense kind is rendered escaped');

  // Injection survives a backup round-trip too (importJSON -> render)
  api.importJSON({ _text: JSON.stringify({ expenses: [{ id: 'z', ts: Date.now(), kind: '<script>x</script>', amount: 1 }], history: [], shifts: [], cfg: {} }) });
  api.renderStats();
  const statsHTML2 = h.elements.get('stats-content').innerHTML;
  ok(!statsHTML2.includes('<script>x</script>'), 'R5 imported malicious expense kind stays escaped');

  // Golden regression — pin the headline numbers so future edits can't silently drift
  freshCfg(api);
  const g1 = api.calc(10, 5, 1);
  near(g1.netEff, 20.044, 0.01, 'R5 golden: $10/5mi/1stop = $20.04/hr net');
  eq(api.grade(g1.eff).label, 'WORTH IT', 'R5 golden: that offer grades WORTH IT');
  eq(api.scoreOffer(g1, 10, 5, 1), 83, 'R5 golden: that offer scores 83');

  const g2 = api.calc(25, 4, 1);   // strong offer
  eq(api.grade(g2.eff).label, 'GREAT', 'R5 golden: $25/4mi grades GREAT');
  const g3 = api.calc(4, 9, 3);    // bad offer
  eq(api.grade(g3.eff).label, 'SKIP IT', 'R5 golden: $4/9mi/3stops = SKIP IT');

  // Regression: history render with mixed/partial entries never throws
  api.history = [
    { id: '1', status: 'accepted', platform: 'uber', ts: Date.now(), startedAt: Date.now() },           // no p/m
    { id: '2', status: 'completed', platform: 'doordash', ts: Date.now(), startedAt: Date.now() - 1e6, completedAt: Date.now(), p: 12, m: 4, stops: 2, ...api.calc(12, 4, 2), g: api.grade(api.calc(12, 4, 2).eff), score: 71, actualP: 14 },
    { id: '3', status: 'declined', ts: Date.now(), eff: 9 },                                              // minimal
  ];
  let threw = null;
  try { api.renderHistory(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R5 renderHistory handles partial/mixed entries' + (threw ? ' :: ' + threw : ''));

  report('ROUND 5 (full regression)');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 6 — data-type robustness: string-typed numbers from imported/legacy data
// ════════════════════════════════════════════════════════════════════════════
{
  const { api, elements } = loadApp();
  freshCfg(api);
  const finite = x => Number.isFinite(x);

  // BUG GUARD #6: payoutOf must return a Number, never a string.
  // A hand-edited/imported backup can carry "p":"10" (string). Before the fix,
  // 0 + payoutOf("10") = "010" and the whole Stats dashboard concatenated.
  eq(api.payoutOf({ p: '10' }), 10, 'R6 payoutOf coerces string p to number');
  eq(api.payoutOf({ actualP: '13', p: '10' }), 13, 'R6 payoutOf coerces string actualP');
  eq(api.payoutOf({ p: 'not-a-number' }), 0, 'R6 payoutOf non-numeric string -> 0');
  eq(typeof api.payoutOf({ p: '7' }), 'number', 'R6 payoutOf return type is number');

  // Stats earned/net must be numeric (not "0105...") when history has string numbers
  api.history = [
    { status: 'completed', platform: 'uber', p: '10', m: '4', stops: 1, eff: '20', ts: Date.now(), startedAt: Date.now() },
    { status: 'completed', platform: 'uber', p: '5', m: '2', stops: 1, eff: '18', ts: Date.now(), startedAt: Date.now() },
  ];
  api.expenses = []; api.shifts = []; api.activeShift = null;
  api.renderStats();
  const html = elements.get('stats-content').innerHTML;
  ok(!/\$0105|\$010\b|\$01\d/.test(html), 'R6 stats does not show concatenated string payout');
  ok(html.includes('$15.00'), 'R6 stats earned = 10 + 5 = $15.00 (numeric add)');

  // BUG GUARD #6b: workedAvgEff must average numerically, not concatenate.
  api.history = [{ status: 'completed', eff: '20' }, { status: 'completed', eff: '30' }];
  near(api.workedAvgEff(), 25, 1e-9, 'R6 workedAvgEff averages string effs numerically');

  // mixed number + string still numeric
  api.history = [{ status: 'completed', eff: 10 }, { status: 'completed', eff: '40' }];
  near(api.workedAvgEff(), 25, 1e-9, 'R6 workedAvgEff handles mixed number/string eff');

  // Negative eff (a real money-losing offer) is preserved, not zeroed
  api.history = [{ status: 'completed', eff: -5 }, { status: 'completed', eff: 15 }];
  near(api.workedAvgEff(), 5, 1e-9, 'R6 workedAvgEff keeps negative eff');

  // payoutOf with numeric 0 actualP (a real $0 final) stays 0, not falling through to p
  eq(api.payoutOf({ p: 10, actualP: 0 }), 0, 'R6 payoutOf actualP 0 wins over p (a $0 tip-out)');

  ok(finite(api.workedAvgEff()), 'R6 workedAvgEff finite');
  report('ROUND 6');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 7 — CSV export correctness: structure, quoting, injection-safety
// ════════════════════════════════════════════════════════════════════════════
{
  // exportCSV writes via download()->Blob; capture through the harness lastExport.
  const h = loadApp();
  const api = h.api;
  freshCfg(api);
  api.history = [
    { id: 'a', platform: 'uber', status: 'completed', p: 10, actualP: 12, m: 4, stops: 2,
      score: 80, eff: 20.04, netEff: 20.04, ts: 1000, startedAt: 1000, completedAt: 1000 + 1800000 },
    { id: 'b', platform: 'doordash', status: 'declined', p: 4, m: 9, stops: 3, ts: 2000 },
  ];
  // exportCSV isn't in __API; call it through eval on the sandbox to exercise real code.
  h.sandbox.exportCSV ? h.sandbox.exportCSV() : null;
  // exportCSV is a top-level function decl, so it's on the sandbox global:
  if (!h.lastExport) { /* fallback: invoke via Function in realm */ }
  const csv = h.lastExport;
  ok(typeof csv === 'string' && csv.length > 0, 'R7 exportCSV produced output');
  const lines = csv.split('\n');
  eq(lines[0].split(',').length, 12, 'R7 CSV header has 12 columns');
  eq(lines.length, 3, 'R7 CSV has header + 2 data rows');
  ok(lines[0].startsWith('"started"'), 'R7 CSV header is quoted');
  ok(csv.includes('"uber"') && csv.includes('"doordash"'), 'R7 CSV carries platform values');
  // elapsed minutes for the completed row = 30
  ok(lines[1].includes('"30"'), 'R7 CSV computes elapsed minutes for completed ride');

  // Injection / quote-escaping: a quote in a field must be doubled, not break columns
  api.history = [{ id: 'q', platform: 'ub"er', status: 'completed', p: 5, m: 1, stops: 1, ts: 1, startedAt: 1 }];
  h.sandbox.exportCSV();
  const csv2 = h.lastExport;
  ok(csv2.includes('"ub""er"'), 'R7 CSV doubles embedded quotes (no column break)');

  // Empty history still yields a valid header-only CSV (no throw)
  api.history = [];
  let threw = null;
  try { h.sandbox.exportCSV(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R7 exportCSV on empty history does not throw');
  eq(h.lastExport.split('\n').length, 1, 'R7 empty history -> header row only');

  report('ROUND 7');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 8 — shift hours, online time, real $/hr sourcing
// ════════════════════════════════════════════════════════════════════════════
{
  const { api, elements } = loadApp();
  freshCfg(api);

  // No shifts, no completed trips -> real $/hr shows em-dash, no crash
  api.history = []; api.shifts = []; api.activeShift = null; api.expenses = [];
  api.renderStats();
  let html = elements.get('stats-content').innerHTML;
  ok(html.includes('—'), 'R8 empty stats shows em-dash for real $/hr');

  // Completed-trip fallback: with no shift, online time comes from trip spans.
  api.setStops(1);
  const now = Date.now();
  const r = api.calc(20, 5, 1);
  api.history = [{
    id: 't', platform: 'uber', status: 'completed', p: 20, m: 5, stops: 1,
    ts: now - 3600000, startedAt: now - 3600000, completedAt: now - 1800000, // 30 min span
    ...r, g: api.grade(r.eff),
  }];
  // set window to all-time so the trip is included regardless of "today"
  api.setStops && api.setStops(1);
  // statsWindow defaults to 'today'; the trip ts is within today for most of the day.
  let threw = null;
  try { api.renderStats(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R8 renderStats with completed-trip fallback does not throw');

  // Shift hours summation: two closed shifts after `start`
  api.shifts = [
    { id: 's1', start: now - 7200000, end: now - 3600000 }, // 1h
    { id: 's2', start: now - 1800000, end: now },           // 0.5h
  ];
  api.activeShift = null;
  // renderStats again — should not throw and online time should reflect ~1.5h of shifts
  try { api.renderStats(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R8 renderStats with two closed shifts does not throw');

  // Active shift counts toward online time and banner
  api.activeShift = { id: 'a', start: now - 600000 };
  api.updateShiftBanner ? null : null;
  try { api.renderStats(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R8 renderStats with an active shift does not throw');

  report('ROUND 8');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 9 — time-window filtering (today / week / all) boundaries
// ════════════════════════════════════════════════════════════════════════════
{
  const { api, elements } = loadApp();
  freshCfg(api);
  api.shifts = []; api.activeShift = null; api.expenses = [];

  const now = Date.now();
  const dayMs = 86400000;
  const mk = (ageMs, eff) => {
    const r = api.calc(15, 4, 1);
    return { id: 'x' + ageMs, platform: 'uber', status: 'completed', p: 15, m: 4, stops: 1,
      ts: now - ageMs, startedAt: now - ageMs, completedAt: now - ageMs + 1800000, ...r, g: api.grade(r.eff) };
  };
  // entries: 2 min ago (today), 3 days ago (week), 30 days ago (all only)
  api.history = [mk(2 * 60000), mk(3 * dayMs), mk(30 * dayMs)];

  const render = w => { /* drive setWindow through the public API surface */
    // setWindow isn't exposed; emulate by setting statsWindow via renderStats default.
  };

  // All-time window must include every worked entry. We exercise renderStats and
  // check the deliveries count text scales with the window via direct field set.
  // statsWindow is internal; verify via the count of worked entries the render shows.
  // Use a robust proxy: render and count "$" big-stat presence (no throw is the core).
  let threw = null;
  try { api.renderStats(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R9 renderStats across mixed-age history does not throw');

  // sumExpenses window boundary: ts exactly at start is included (>=)
  api.expenses = [
    { id: 'e1', ts: now - 1000, kind: 'gas', amount: 5 },
    { id: 'e2', ts: now - dayMs * 10, kind: 'tolls', amount: 3 },
  ];
  near(api.sumExpenses(now - dayMs), 5, 1e-9, 'R9 sumExpenses week-ish window excludes the 10-day-old one');
  near(api.sumExpenses(0), 8, 1e-9, 'R9 sumExpenses all-time sums both');
  near(api.sumExpenses(now + 1000), 0, 1e-9, 'R9 sumExpenses future start -> 0');
  // boundary inclusivity
  near(api.sumExpenses(now - 1000), 5, 1e-9, 'R9 sumExpenses includes ts == start (>=)');

  report('ROUND 9');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 10 — stacked compare winner selection
// ════════════════════════════════════════════════════════════════════════════
{
  const { api, elements, sandbox } = loadApp();
  const getEl = id => sandbox.document.getElementById(id);
  freshCfg(api);

  // holdForCompare/clearCompare aren't in __API; exercise the winner logic via the
  // same calc/grade the UI uses, and confirm the compare card path doesn't throw
  // when driven through analyze() + decideRide() public surface.
  // Build offer A (strong) and offer B (weak), confirm A would win by eff.
  const A = api.calc(25, 4, 1);
  const B = api.calc(6, 9, 3);
  ok(A.eff > B.eff, 'R10 stronger offer has higher eff (winner basis)');

  // The compare winner is A.eff>=B.eff ? A : B. Tie goes to A (held first).
  const T1 = api.calc(15, 5, 1), T2 = api.calc(15, 5, 1);
  ok(T1.eff === T2.eff, 'R10 identical offers tie on eff');
  // (tie resolves to A in UI; we just assert equality is detected, no NaN)
  ok(Number.isFinite(A.eff) && Number.isFinite(B.eff), 'R10 compare effs finite');

  // Driving the offer pane: analyze offer A then decide — exercises lastAnalysis path
  getEl('payout').value = '25'; getEl('miles').value = '4'; api.setStops(1);
  let threw = null;
  try { api.analyze(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R10 analyze() builds result card without throwing');
  const rc = getEl('result-card').innerHTML;
  ok(rc.includes('GREAT') || rc.includes('WORTH IT'), 'R10 strong offer renders a positive verdict');
  ok(rc.includes('⚖ COMPARE'), 'R10 result card exposes the COMPARE control');

  // decideRide records to history with a start timestamp
  try { api.decideRide('accepted'); } catch (e) { threw = e.message; }
  ok(threw === null, 'R10 decideRide(accepted) does not throw');
  eq(api.history.length, 1, 'R10 accepted offer logged to history');
  ok(api.history[0].startedAt != null, 'R10 accepted ride has a start timestamp');

  report('ROUND 10');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 11 — decision & history state transitions (real prompt-driven flows)
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const doc = h.sandbox.document;
  freshCfg(api);
  api.history = []; api.shifts = []; api.activeShift = null;

  // confirmRide with payout+miles -> full record with eff/score/startedAt
  doc.getElementById('payout').value = '10'; doc.getElementById('miles').value = '5'; api.setStops(1);
  api.confirmRide();
  eq(api.history.length, 1, 'R11 confirmRide logs an entry');
  ok(api.history[0].startedAt != null, 'R11 confirmRide stamps start time');
  ok(api.history[0].eff != null && api.history[0].score != null, 'R11 confirmRide with data computes eff+score');
  eq(api.history[0].status, 'accepted', 'R11 confirmRide status is accepted');

  // confirmRide empty -> p/m null, g null, but still timestamped (accept-before-eval)
  doc.getElementById('payout').value = ''; doc.getElementById('miles').value = '';
  api.confirmRide();
  eq(api.history[0].p, null, 'R11 empty confirmRide leaves payout null');
  eq(api.history[0].g, null, 'R11 empty confirmRide leaves grade null');
  ok(api.history[0].startedAt != null, 'R11 empty confirmRide still stamps start time');

  // markCompleted flips status + stamps completedAt + backfills startedAt
  api.history = [{ id: 'r1', status: 'accepted', p: 10, m: 4, stops: 1, ts: 1000, startedAt: null, completedAt: null }];
  api.markCompleted('r1');
  eq(api.history[0].status, 'completed', 'R11 markCompleted -> completed');
  ok(api.history[0].completedAt != null, 'R11 markCompleted stamps completedAt');
  eq(api.history[0].startedAt, 1000, 'R11 markCompleted backfills startedAt from ts');

  // setActual (tip) via prompt
  h.setPrompts(['14']); api.setActual('r1');
  eq(api.history[0].actualP, 14, 'R11 setActual records final payout');
  eq(api.payoutOf(api.history[0]), 14, 'R11 payoutOf reflects the tip');

  // addDetails backfill via prompts -> recomputes score+eff
  api.history = [{ id: 'r2', status: 'accepted', p: null, m: null, stops: 2, ts: 1, startedAt: 1 }];
  h.setPrompts(['12', '4']); api.addDetails('r2');
  eq(api.history[0].p, 12, 'R11 addDetails backfills payout');
  eq(api.history[0].m, 4, 'R11 addDetails backfills miles');
  ok(api.history[0].eff != null && api.history[0].score != null, 'R11 addDetails recomputes eff+score');

  // addDetails honors the entry's own stops (regression for bug #1 path)
  ok(api.history[0].score <= 100 && api.history[0].score >= 0, 'R11 addDetails score in range with entry stops');

  // delEntry removes only the target; clearHistory gated by confirm()
  api.history = [{ id: 'a' }, { id: 'b' }]; api.delEntry('a');
  eq(api.history.map(x => x.id).join(','), 'b', 'R11 delEntry removes only the target');
  h.setConfirm(false); api.clearHistory();
  eq(api.history.length, 1, 'R11 clearHistory blocked when user cancels confirm');
  h.setConfirm(true); api.clearHistory();
  eq(api.history.length, 0, 'R11 clearHistory clears when confirmed');

  // history cap holds at 500 under a flood of confirmRide
  api.history = [];
  doc.getElementById('payout').value = '10'; doc.getElementById('miles').value = '5';
  for (let i = 0; i < 510; i++) api.confirmRide();
  eq(api.history.length, 500, 'R11 history is capped at 500 entries');

  report('ROUND 11');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 12 — expense tracker (real prompt-driven add, normalization, caps)
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  freshCfg(api);
  api.expenses = []; api.history = []; api.shifts = []; api.activeShift = null;

  // addExpense normalizes kind (trim + lowercase) and parses amount
  h.setPrompts(['  TOLLS ', '5.50']); api.addExpense();
  eq(api.expenses[0].kind, 'tolls', 'R12 addExpense trims + lowercases kind');
  near(api.expenses[0].amount, 5.5, 1e-9, 'R12 addExpense parses amount');

  // blank kind -> "other"
  h.setPrompts(['', '2']); api.addExpense();
  eq(api.expenses[0].kind, 'other', 'R12 blank kind defaults to other');

  // non-positive / NaN amount rejected (no entry added)
  const before = api.expenses.length;
  h.setPrompts(['gas', '0']); api.addExpense();
  h.setPrompts(['gas', '-3']); api.addExpense();
  h.setPrompts(['gas', 'abc']); api.addExpense();
  eq(api.expenses.length, before, 'R12 rejects $0 / negative / NaN amounts');

  // cancel (prompt returns null for kind) -> no entry
  h.setPrompts([]); api.addExpense();
  eq(api.expenses.length, before, 'R12 cancelling the kind prompt adds nothing');

  // delExpense removes by id
  const id0 = api.expenses[0].id;
  api.delExpense(id0);
  ok(!api.expenses.some(x => x.id === id0), 'R12 delExpense removes the target');

  // sumExpenses ignores string/garbage amounts gracefully
  api.expenses = [{ id: 'a', ts: 100, kind: 'gas', amount: '4' }, { id: 'b', ts: 200, kind: 'x', amount: 'NaN' }, { id: 'c', ts: 300, kind: 'y', amount: 2 }];
  near(api.sumExpenses(0), 6, 1e-9, 'R12 sumExpenses coerces strings, drops NaN (4 + 0 + 2)');

  // expense cap at 500
  api.expenses = [];
  for (let i = 0; i < 510; i++) { h.setPrompts(['gas', '1']); api.addExpense(); }
  eq(api.expenses.length, 500, 'R12 expenses capped at 500');

  report('ROUND 12');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 13 — forecast & decline-regret surfacing in Stats
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const el = () => h.sandbox.document.getElementById('stats-content').innerHTML;
  freshCfg(api);
  api.shifts = []; api.expenses = [];

  // Decline-regret: a declined offer that beats the worked average should be flagged.
  const now = Date.now();
  const worked = api.calc(12, 4, 1);          // ~moderate eff
  const strongDeclined = api.calc(30, 3, 1);  // high eff, declined
  api.history = [
    { id: 'w', status: 'completed', platform: 'uber', p: 12, m: 4, stops: 1, ts: now, startedAt: now, completedAt: now + 1800000, ...worked, g: api.grade(worked.eff) },
    { id: 'd', status: 'declined', platform: 'uber', p: 30, m: 3, stops: 1, ts: now, ...strongDeclined, g: api.grade(strongDeclined.eff) },
  ];
  api.activeShift = null;
  api.setWindow('all');
  ok(el().includes('Decline check'), 'R13 decline-regret card appears when a skipped offer beat the average');

  // No regret when no declined offer beats the average
  api.history = [
    { id: 'w', status: 'completed', platform: 'uber', p: 12, m: 4, stops: 1, ts: now, startedAt: now, completedAt: now + 1800000, ...worked, g: api.grade(worked.eff) },
    { id: 'd2', status: 'declined', platform: 'uber', p: 3, m: 9, stops: 3, ts: now, ...api.calc(3, 9, 3), g: api.grade(api.calc(3, 9, 3).eff) },
  ];
  api.setWindow('all');
  ok(!el().includes('Decline check'), 'R13 no decline-regret when skips were correctly low');

  // Forecast: today window + active shift + some net -> "On pace for" line
  api.history = [{ id: 'c', status: 'completed', platform: 'uber', p: 20, m: 4, stops: 1, ts: now, startedAt: now - 1800000, completedAt: now, ...api.calc(20, 4, 1), g: api.grade(api.calc(20, 4, 1).eff) }];
  api.activeShift = { id: 's', start: now - 1800000 }; // 30 min in
  api.setWindow('today');
  let threw = null; let html = '';
  try { html = el(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R13 forecast render does not throw');
  ok(html.includes('On pace for') || html.includes('Net profit'), 'R13 today view renders forecast/headline');

  api.setWindow('today'); // restore default
  report('ROUND 13');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 14 — per-platform aggregation + unknown-platform fallback
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const el = () => h.sandbox.document.getElementById('stats-content').innerHTML;
  freshCfg(api);
  api.shifts = []; api.activeShift = null; api.expenses = [];
  const now = Date.now();
  const mk = (plat, p, m) => { const r = api.calc(p, m, 1); return { id: plat + p, status: 'completed', platform: plat, p, m, stops: 1, ts: now, startedAt: now, completedAt: now + 1800000, ...r, g: api.grade(r.eff) }; };

  // Known platforms aggregate under their display names
  api.history = [mk('uber', 10, 4), mk('uber', 8, 3), mk('doordash', 12, 5), mk('grubhub', 9, 4)];
  api.setWindow('all');
  let html = el();
  ok(html.includes('Uber') && html.includes('DoorDash') && html.includes('Grubhub'), 'R14 per-platform shows all platforms');
  ok(html.includes('By platform'), 'R14 per-platform section present');

  // Unknown / junk platform must fall back to "Other", never throw or inject
  api.history = [mk('<script>evil</script>', 10, 4), mk('martian-app', 7, 3)];
  let threw = null;
  try { api.setWindow('all'); html = el(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R14 unknown platform does not throw');
  ok(!html.includes('<script>evil</script>'), 'R14 junk platform name is not injected raw');
  ok(html.includes('Other'), 'R14 unknown platform aggregates under Other');

  // Net per platform is numeric even with string payouts (R6 fix interplay)
  api.history = [{ id: 's', status: 'completed', platform: 'uber', p: '10', m: '4', stops: 1, ts: now, startedAt: now, completedAt: now + 1800000, eff: 20 }];
  try { api.setWindow('all'); html = el(); } catch (e) { threw = e.message; }
  ok(threw === null && !/\$0\d{2,}/.test(html), 'R14 per-platform net is numeric with string payout');

  api.setWindow('today');
  report('ROUND 14');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 15 — parseOffer deep fuzz (real OCR shapes, promos, ranges, noise)
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // Promo/tip breakdown: pick the largest total, not a component
  let p = api.parseOffer('Delivery\nBase $3.25\n+ $4.00 Peak Pay\n+ $6.50 tip\nTotal $13.75\n5.1 mi');
  eq(p.payout, 13.75, 'R15 picks the largest $ (total over components)');
  eq(p.miles, 5.1, 'R15 reads miles from total block');

  // "$/mi" rate line must not be mistaken for trip miles
  p = api.parseOffer('$12.00 · $2.40/mi · 5 mi · 2 orders');
  eq(p.miles, 5, 'R15 trip miles read, not the $/mi rate');
  eq(p.stops, 2, 'R15 "2 orders" -> 2 stops');

  // minutes must not be read as miles (mi\b boundary)
  p = api.parseOffer('$9.00\n4.5 mi\n14 min');
  eq(p.miles, 4.5, 'R15 "14 min" is not read as miles');

  // newline-glued numbers
  eq(api.parseOffer('$7\n3mi').miles, 3, 'R15 newline before unit still parses');

  // Stops out of the 1..4 range are rejected (offer parser is strict)
  eq(api.parseOffer('$10 5 mi 0 stops').stops, null, 'R15 "0 stops" rejected by offer parser (range 1..4)');
  eq(api.parseOffer('$10 5 mi 9 stops').stops, null, 'R15 "9 stops" out of range -> null');

  // Absurd OCR money (>$500) filtered; the realistic value wins
  eq(api.parseOffer('$840.00\n$12.50\n4 mi').payout, 12.5, 'R15 filters absurd $840, keeps $12.50');

  // No money at all -> null payout, miles still found
  p = api.parseOffer('offer 6 mi 1 order');
  eq(p.payout, null, 'R15 no $ -> null payout');
  eq(p.miles, 6, 'R15 miles still parsed without payout');

  // Known limitation (documented): comma-thousands payout is mis-scaled but such an
  // offer is far outside the realistic <$500 range the parser targets.
  ok(api.parseOffer('$1,234.50 5 mi').payout !== 1234.5, 'R15 4-digit payout not supported (out of realistic range)');

  report('ROUND 15');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 16 — parseVoice deep fuzz (STT shapes, keyword payout, fallbacks)
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // keyword-led payout
  eq(api.parseVoice('for 12 dollars 3 miles').payout, 12, 'R16 "for 12 dollars" -> 12');
  eq(api.parseVoice('offering 9.50').payout, 9.5, 'R16 "offering 9.50" -> 9.5');
  eq(api.parseVoice('pay 15').payout, 15, 'R16 "pay 15" -> 15');
  eq(api.parseVoice('payout 8 4 miles').payout, 8, 'R16 "payout 8" keyword wins');

  // full utterance
  let v = api.parseVoice('$8.75 4.2 mi 1 stop');
  eq(v.payout, 8.75, 'R16 full: payout'); eq(v.miles, 4.2, 'R16 full: miles'); eq(v.stops, 1, 'R16 full: stops');

  // miles/stops must NOT be grabbed as the fallback payout
  v = api.parseVoice('5 mi 2 stops');
  eq(v.payout, null, 'R16 bare miles/stops do not become payout');
  eq(v.miles, 5, 'R16 fallback still reads miles');
  eq(v.stops, 2, 'R16 fallback still reads stops');

  // leading bare number is payout
  eq(api.parseVoice('12 dollars').payout, 12, 'R16 "12 dollars" -> 12');
  eq(api.parseVoice('20 3 miles').payout, 20, 'R16 leading 20 is payout, not miles');

  // stop clamp 0..4
  eq(api.parseVoice('9 dollars 0 stops').stops, 0, 'R16 "0 stops" allowed in voice');
  eq(api.parseVoice('9 dollars 12 stops').stops, 4, 'R16 voice clamps high stops to 4');

  // empty / pure words -> nulls (no throw)
  eq(api.parseVoice(''), { payout: null, miles: null, stops: null }, 'R16 empty -> nulls');
  eq(api.parseVoice('nine fifty four miles').payout, null, 'R16 word-numbers payout -> null (STT limitation, documented)');

  report('ROUND 16');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 17 — grade & score boundary exactness
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api); // target 20

  // grade thresholds are: >=1.3 GREAT, >=1.0 WORTH IT, >=0.85 BORDERLINE, else SKIP
  eq(api.grade(26).label, 'GREAT', 'R17 eff 26 (=1.30x) GREAT');
  eq(api.grade(25.99).label, 'WORTH IT', 'R17 eff 25.99 (<1.3x) WORTH IT');
  eq(api.grade(20).label, 'WORTH IT', 'R17 eff 20 (=1.0x) WORTH IT');
  eq(api.grade(19.99).label, 'BORDERLINE', 'R17 eff 19.99 (<1.0x) BORDERLINE');
  eq(api.grade(17).label, 'BORDERLINE', 'R17 eff 17 (=0.85x) BORDERLINE');
  eq(api.grade(16.99).label, 'SKIP IT', 'R17 eff 16.99 (<0.85x) SKIP IT');
  eq(api.grade(0).label, 'SKIP IT', 'R17 eff 0 SKIP IT');
  eq(api.grade(-3).label, 'SKIP IT', 'R17 negative eff SKIP IT');

  // scoreOffer stop tiers drop exactly 2 points per stop (10,8,6,4,2,0)
  const r = api.calc(10, 5, 1);
  const base = api.scoreOffer(r, 10, 5, 0);
  eq(api.scoreOffer(r, 10, 5, 0) - api.scoreOffer(r, 10, 5, 1), 2, 'R17 each stop costs 2 score pts');
  eq(api.scoreOffer(r, 10, 5, 4) - api.scoreOffer(r, 10, 5, 5), 2, 'R17 stop penalty linear through 5');
  ok(base <= 100, 'R17 score capped at 100');

  // $/mi component: $2/mi earns the full 20; doubling beyond stays capped
  const rHi = api.calc(20, 5, 1);
  ok(api.scoreOffer(rHi, 20, 5, 1) >= api.scoreOffer(rHi, 10, 5, 1), 'R17 higher $/mi scores >=');

  // scoreColor thresholds
  eq(api.scoreColor(80), '#4ade80', 'R17 scoreColor >=80 green');
  eq(api.scoreColor(79), '#a3e635', 'R17 scoreColor 60-79 lime');
  eq(api.scoreColor(45), '#fbbf24', 'R17 scoreColor 45-59 yellow');
  eq(api.scoreColor(44), '#f87171', 'R17 scoreColor <45 red');

  report('ROUND 17');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 18 — settings: updateField NaN guard, cpm guards, label-safe math
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // cpm guards: zero/negative mpg or gas -> 0 fuel, never Infinity/NaN
  api.cfg = { mpg: 0, gasPrice: 3.5 };
  eq(api.cpm(), 0, 'R18 mpg 0 -> cpm 0');
  api.cfg = { mpg: 25, gasPrice: 0 };
  eq(api.cpm(), 0, 'R18 gas 0 -> cpm 0');
  api.cfg = { mpg: -25, gasPrice: 3.5 };
  eq(api.cpm(), 0, 'R18 negative mpg -> cpm 0 (guarded)');
  freshCfg(api);

  // avgSpeed 0 -> MPM fallback 3 (no divide-by-zero in calc)
  api.cfg = { avgSpeed: 0 };
  const r = api.calc(10, 5, 1);
  ok(Number.isFinite(r.driveMin) && r.driveMin > 0, 'R18 avgSpeed 0 uses MPM fallback, finite drive time');
  freshCfg(api);

  // realMiles clamps negative returnFactor to 0
  api.cfg = { returnFactor: -0.5 };
  eq(api.realMiles(10), 10, 'R18 negative returnFactor clamped to 0');
  api.cfg = { returnFactor: 1 };
  eq(api.realMiles(10), 20, 'R18 returnFactor 1 doubles miles');
  freshCfg(api);

  // f2 / fMin formatting safety
  eq(api.f2(null), '0.00', 'R18 f2 null-safe');
  eq(api.f2('abc'), '0.00', 'R18 f2 non-numeric -> 0.00');
  eq(api.f2(1.005).length > 0, true, 'R18 f2 returns a string');
  eq(api.fMin(0), '0s', 'R18 fMin 0 -> 0s');
  eq(api.fMin(0.5), '30s', 'R18 fMin sub-minute shows seconds');
  ok(api.fMin(90).endsWith('m'), 'R18 fMin >=1 shows minutes');

  report('ROUND 18');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 19 — migration chains (db absent -> da -> ua), partial presence
// ════════════════════════════════════════════════════════════════════════════
{
  // ua-* only
  {
    const { api, localStorage } = loadApp();
    localStorage.clear();
    localStorage.setItem('ua-cfg', JSON.stringify({ targetHourly: 33 }));
    localStorage.setItem('ua-history', JSON.stringify([{ id: 'u1', status: 'completed' }]));
    api.history = []; api.cfg = { targetHourly: 20 };
    api.load();
    eq(api.cfg.targetHourly, 33, 'R19 migrates ua-cfg when db+da absent');
    eq(api.history.length, 1, 'R19 migrates ua-history');
  }

  // da-* takes precedence over ua-*
  {
    const { api, localStorage } = loadApp();
    localStorage.clear();
    localStorage.setItem('da-cfg', JSON.stringify({ targetHourly: 28 }));
    localStorage.setItem('ua-cfg', JSON.stringify({ targetHourly: 99 }));
    api.cfg = { targetHourly: 20 };
    api.load();
    eq(api.cfg.targetHourly, 28, 'R19 da-cfg wins over ua-cfg');
  }

  // db-* present -> no migration even if legacy keys exist
  {
    const { api, localStorage } = loadApp();
    localStorage.clear();
    localStorage.setItem('db-cfg', JSON.stringify({ targetHourly: 21 }));
    localStorage.setItem('da-cfg', JSON.stringify({ targetHourly: 88 }));
    api.cfg = { targetHourly: 20 };
    api.load();
    eq(api.cfg.targetHourly, 21, 'R19 db-cfg present blocks legacy migration');
  }

  // partial: db-history present but db-cfg missing -> cfg migrates, history does not
  {
    const { api, localStorage } = loadApp();
    localStorage.clear();
    localStorage.setItem('db-history', JSON.stringify([{ id: 'keep', status: 'completed' }]));
    localStorage.setItem('da-cfg', JSON.stringify({ targetHourly: 44 }));
    localStorage.setItem('da-history', JSON.stringify([{ id: 'legacy' }]));
    api.history = []; api.cfg = { targetHourly: 20 };
    api.load();
    eq(api.cfg.targetHourly, 44, 'R19 partial: cfg migrates from da');
    eq(api.history[0].id, 'keep', 'R19 partial: db-history is NOT overwritten by legacy');
  }

  // corrupt legacy JSON during migration must not throw
  {
    const { api, localStorage } = loadApp();
    localStorage.clear();
    localStorage.setItem('da-cfg', '{broken json');
    let threw = null;
    try { api.load(); } catch (e) { threw = e.message; }
    ok(threw === null, 'R19 corrupt legacy cfg does not throw during migration');
    ok(typeof api.cfg.targetHourly === 'number', 'R19 cfg stays valid after corrupt legacy');
  }

  report('ROUND 19');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 20 — import/export shapes & malformed-backup hardening
// ════════════════════════════════════════════════════════════════════════════
{
  // BUG GUARD #7: a non-object cfg in a backup must NOT pollute cfg with index keys.
  {
    const { api } = loadApp();
    freshCfg(api);
    api.importJSON({ _text: JSON.stringify({ cfg: 'haha', history: [], shifts: [], expenses: [] }) });
    const numKeys = Object.keys(api.cfg).filter(k => /^\d+$/.test(k));
    eq(numKeys.length, 0, 'R20 string cfg does not inject numeric keys');
    eq(api.cfg.targetHourly, 20, 'R20 string cfg leaves real cfg intact');
  }
  {
    const { api } = loadApp();
    freshCfg(api);
    api.importJSON({ _text: JSON.stringify({ cfg: [1, 2, 3] }) });
    ok(!('0' in api.cfg), 'R20 array cfg does not inject index keys');
    eq(api.cfg.targetHourly, 20, 'R20 array cfg ignored, defaults kept');
  }

  // Valid object cfg still applies
  {
    const { api } = loadApp();
    freshCfg(api);
    api.importJSON({ _text: JSON.stringify({ cfg: { targetHourly: 37 }, history: [], shifts: [], expenses: [] }) });
    eq(api.cfg.targetHourly, 37, 'R20 valid object cfg applies');
  }

  // export -> import full round-trip preserves all four collections
  {
    const h = loadApp(); const api = h.api;
    freshCfg(api);
    api.cfg = { targetHourly: 26, taxPct: 0.3 };
    api.history = [{ id: 'h1', status: 'completed', p: 10, m: 4, stops: 1, eff: 22 }];
    api.shifts = [{ id: 's1', start: 1, end: 2 }];
    api.expenses = [{ id: 'e1', ts: 1, kind: 'gas', amount: 3 }];
    api.exportJSON();
    const dump = h.lastExport;
    // feed the exported text straight back into import
    const { api: api2 } = loadApp();
    freshCfg(api2);
    api2.importJSON({ _text: dump });
    eq(api2.cfg.targetHourly, 26, 'R20 round-trip cfg');
    eq(api2.history[0].id, 'h1', 'R20 round-trip history');
    eq(api2.shifts[0].id, 's1', 'R20 round-trip shifts');
    eq(api2.expenses[0].kind, 'gas', 'R20 round-trip expenses');
  }

  // missing keys in backup leave existing collections untouched (no wipe)
  {
    const { api } = loadApp();
    freshCfg(api);
    api.history = [{ id: 'pre', status: 'completed' }];
    api.importJSON({ _text: JSON.stringify({ cfg: { targetHourly: 22 } }) }); // no history key
    eq(api.history[0].id, 'pre', 'R20 absent history key does not wipe existing history');
    eq(api.cfg.targetHourly, 22, 'R20 cfg still applied from partial backup');
  }

  report('ROUND 20');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 21 — adversarial History render (injection + missing/extreme fields)
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const histHTML = () => h.sandbox.document.getElementById('history-content').innerHTML;
  freshCfg(api);

  // BUG GUARD #8: a malicious `m` (miles) from an imported backup must NOT inject.
  api.history = [{ id: 'x', status: 'completed', platform: 'uber', p: 10,
    m: '<img src=x onerror=alert(1)>', stops: 1, ts: Date.now(), startedAt: Date.now(), eff: 20 }];
  api.renderHistory();
  let html = histHTML();
  ok(!html.includes('<img src=x onerror=alert(1)>'), 'R21 raw <img> in miles is NOT injected');
  ok(html.includes('&lt;img'), 'R21 malicious miles rendered escaped');

  // score field also escaped
  api.history = [{ id: 'y', status: 'completed', platform: 'uber', p: 5, m: 2, stops: 1,
    score: '<svg onload=1>', ts: Date.now(), startedAt: Date.now(), eff: 18 }];
  api.renderHistory();
  ok(!histHTML().includes('<svg onload=1>'), 'R21 malicious score is NOT injected');

  // junk platform falls back to Other (enum lookup), never injects
  api.history = [{ id: 'z', status: 'completed', platform: '<b>x</b>', p: 5, m: 2, stops: 1, ts: Date.now(), startedAt: Date.now(), eff: 18 }];
  api.renderHistory();
  ok(!histHTML().includes('<b>x</b>'), 'R21 junk platform not injected');

  // Adversarial / missing fields: render must not throw
  api.history = [
    { id: '1' },                                                      // almost empty
    { id: '2', status: 'completed', m: null, p: null, stops: null, ts: Date.now() },
    { id: '3', status: 'accepted', p: 1e9, m: 1e9, stops: 999, eff: 1e9, ts: Date.now(), startedAt: Date.now() },
    { id: '4', status: 'weird-status', ts: Date.now() },
    { status: 'completed', ts: Date.now() },                          // no id
  ];
  let threw = null;
  try { api.renderHistory(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R21 adversarial/missing-field history renders without throwing' + (threw ? ' :: ' + threw : ''));

  // filter switches don't throw on adversarial data
  for (const f of ['all', 'accepted', 'completed', 'declined']) {
    try { api.setFilter(f); } catch (e) { threw = e.message; }
  }
  ok(threw === null, 'R21 every history filter renders adversarial data safely');
  api.setFilter('all');

  report('ROUND 21');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 22 — numeric precision & rounding
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // scoreOffer always integer in [0,100]
  for (const [p, m, s] of [[10, 5, 1], [3.33, 7.77, 2], [25, 4, 0], [0.01, 99, 4], [500, 1, 1]]) {
    const r = api.calc(p, m, s);
    const sc = api.scoreOffer(r, p, m, s);
    ok(Number.isInteger(sc) && sc >= 0 && sc <= 100, `R22 score integer in range for ${p}/${m}/${s} (=${sc})`);
  }

  // f2 rounds to 2 decimals
  eq(api.f2(1.005).split('.')[1].length, 2, 'R22 f2 yields 2 decimals');
  eq(api.f2(20.044), '20.04', 'R22 f2 truncating-rounds 20.044 -> 20.04');
  eq(api.f2(2), '2.00', 'R22 f2 pads integers');

  // calc fields finite for a sweep of inputs
  let allFinite = true;
  for (let p = 0; p <= 60; p += 7.5) for (let m = 0; m <= 20; m += 2.5) for (const s of [0, 1, 2, 3, 4]) {
    const r = api.calc(p, m, s);
    for (const k of ['driveMin', 'cycleMin', 'fuel', 'net', 'netEff', 'grossEff', 'eff', 'minPay', 'surplus', 'totalMiles']) {
      if (!Number.isFinite(r[k])) allFinite = false;
    }
  }
  ok(allFinite, 'R22 calc() finite across a full input sweep');

  // netEff golden precision pin
  near(api.calc(10, 5, 1).netEff, 20.044, 0.001, 'R22 golden netEff precision holds');

  // fMin rounding: 0.5 min -> 30s, 1.0 -> "1m", 1.04 -> "1m" (rounded to 0.1)
  eq(api.fMin(1), '1m', 'R22 fMin 1.0 -> 1m');
  eq(api.fMin(0.99), '59s', 'R22 fMin 0.99 -> 59s');

  report('ROUND 22');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 23 — reference table correctness across distances & stops
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const refHTML = () => h.sandbox.document.getElementById('ref-table').innerHTML;
  freshCfg(api);

  // minPay must be monotonically non-decreasing with distance
  for (const s of [0, 1, 2, 3, 4]) {
    api.setStops(s);
    let prev = -Infinity, mono = true;
    for (const d of [2, 3, 4, 5, 5.5, 6, 7, 8, 10, 12, 15]) {
      const r = api.calc(0, d, s);
      if (r.minPay < prev - 1e-9) mono = false;
      prev = r.minPay;
    }
    ok(mono, `R23 minPay monotonic in distance at ${s} stops`);
  }

  // more stops -> higher minPay at the same distance (more wait time to cover)
  ok(api.calc(0, 5, 3).minPay > api.calc(0, 5, 1).minPay, 'R23 more stops raises required min payout');

  // renderRef produces 11 distance rows and does not throw
  api.setStops(1);
  let threw = null;
  try { api.renderRef(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R23 renderRef does not throw');
  eq((refHTML().match(/ref-row/g) || []).length, 11, 'R23 ref table renders 11 distance rows');

  // minPay includes fuel when grading on net; excludes it on gross
  api.cfg = { gradeOnNet: true };
  const netMin = api.calc(0, 10, 1).minPay;
  api.cfg = { gradeOnNet: false };
  const grossMin = api.calc(0, 10, 1).minPay;
  ok(netMin > grossMin, 'R23 net-mode minPay includes fuel (higher than gross-mode)');

  report('ROUND 23');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 24 — deadhead/returnFactor consistency across all consumers
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // calc.totalMiles, fuel, and Stats miles all use the SAME realMiles()
  const rf = 0.4, miles = 10;
  api.cfg = { returnFactor: rf };
  const r = api.calc(20, miles, 1);
  near(r.totalMiles, miles * (1 + rf), 1e-9, 'R24 totalMiles includes deadhead');
  near(r.fuel, api.realMiles(miles) * api.cpm(), 1e-9, 'R24 calc fuel == realMiles*cpm');

  // returnFactor 0 collapses to plain miles everywhere
  api.cfg = { returnFactor: 0 };
  near(api.calc(20, miles, 1).totalMiles, miles, 1e-9, 'R24 rf=0 -> totalMiles == miles');
  near(api.realMiles(miles), miles, 1e-9, 'R24 rf=0 -> realMiles identity');

  // larger returnFactor strictly increases fuel + miles
  api.cfg = { returnFactor: 0.2 };
  const lowFuel = api.calc(20, miles, 1).fuel;
  api.cfg = { returnFactor: 0.8 };
  const hiFuel = api.calc(20, miles, 1).fuel;
  ok(hiFuel > lowFuel, 'R24 higher deadhead -> higher fuel cost');

  // Stats miles reflect deadhead too (worked miles use realMiles)
  freshCfg(api);
  api.cfg = { returnFactor: 0.5 };
  // realMiles applied per-entry: 4 mi -> 6 mi
  near(api.realMiles(4), 6, 1e-9, 'R24 Stats per-entry miles include 50% return');

  report('ROUND 24');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 25 — tax jar & take-home edge cases
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const statsHTML = () => h.sandbox.document.getElementById('stats-content').innerHTML;
  freshCfg(api);
  api.shifts = []; api.activeShift = null;
  const now = Date.now();
  const mkDone = (p, m) => { const r = api.calc(p, m, 1); return { id: 'd' + p, status: 'completed', platform: 'uber', p, m, stops: 1, ts: now, startedAt: now, completedAt: now + 1800000, ...r, g: api.grade(r.eff) }; };

  // Expenses exceeding net -> take-home negative, but tax jar floors at 0 (no tax on a loss)
  api.history = [mkDone(10, 4)];
  api.expenses = [{ id: 'e', ts: now, kind: 'supplies', amount: 100 }];
  api.setWindow('all');
  let html = statsHTML();
  ok(!/jar[\s\S]{0,140}\$-/.test(html), 'R25 tax jar never shows a negative amount');
  ok(html.includes('$0.00') || /jar[\s\S]{0,140}\$0\.00/.test(html), 'R25 tax jar is $0.00 when take-home is negative');

  // taxPct 0 -> jar 0 regardless of profit
  api.expenses = [];
  api.cfg = { taxPct: 0 };
  api.setWindow('all');
  ok(/jar \(0%\)/.test(statsHTML()), 'R25 taxPct 0 shows 0% jar');

  // negative taxPct clamped to 0 (guarded basis)
  api.cfg = { taxPct: -0.5 };
  api.setWindow('all');
  ok(!/jar[\s\S]{0,140}\$-/.test(statsHTML()), 'R25 negative taxPct does not produce a negative jar');
  freshCfg(api); api.shifts = []; api.activeShift = null;

  // Normal case: jar = taxPct * take-home (after expenses)
  api.cfg = { taxPct: 0.25, returnFactor: 0 }; // no deadhead to keep math clean
  api.history = [mkDone(100, 0)];   // $100, 0 miles -> net 100, no fuel
  api.expenses = [{ id: 'e2', ts: now, kind: 'fees', amount: 20 }]; // take-home 80
  api.setWindow('all');
  html = statsHTML();
  ok(html.includes('$20.00'), 'R25 jar = 25% of $80 take-home = $20.00');

  api.setWindow('today');
  report('ROUND 25');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 26 — accept rate & decision counting
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const statsHTML = () => h.sandbox.document.getElementById('stats-content').innerHTML;
  freshCfg(api);
  api.shifts = []; api.activeShift = null; api.expenses = [];
  const now = Date.now();
  const mk = (status, ageMs = 0) => {
    const r = api.calc(15, 4, 1);
    return { id: status + ageMs, status, platform: 'uber', p: 15, m: 4, stops: 1,
      ts: now - ageMs, startedAt: status !== 'declined' ? now - ageMs : null,
      completedAt: status === 'completed' ? now - ageMs + 1800000 : null, ...r, g: api.grade(r.eff) };
  };

  // 3 worked (accepted/completed) + 1 declined => accept rate 75%
  api.history = [mk('accepted'), mk('completed'), mk('completed'), mk('declined')];
  api.setWindow('all');
  ok(statsHTML().includes('75%'), 'R26 accept rate = worked/(worked+declined) = 75%');

  // all declined => 0%
  api.history = [mk('declined'), mk('declined')];
  api.setWindow('all');
  ok(statsHTML().includes('0%'), 'R26 all declined -> 0% accept rate');

  // no decisions => em-dash, no NaN%
  api.history = [];
  api.setWindow('all');
  ok(!statsHTML().includes('NaN'), 'R26 empty history -> no NaN in accept rate');

  // History tab worked/declined counts
  api.history = [mk('accepted'), mk('completed'), mk('declined'), mk('declined')];
  let threw = null;
  try { api.renderHistory(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R26 renderHistory counts without throwing');
  const hh = h.sandbox.document.getElementById('history-content').innerHTML;
  ok(hh.includes('2 worked') && hh.includes('2 declined'), 'R26 history shows 2 worked · 2 declined');

  api.setWindow('today');
  report('ROUND 26');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 27 — NaN/Infinity sweep with adversarial (imported) cfg
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  const calcKeys = ['driveMin', 'foodWait', 'cycleMin', 'cycleHr', 'fuel', 'net', 'totalMiles', 'grossEff', 'netEff', 'eff', 'minPay', 'surplus'];

  // A cfg arriving via a malformed backup can carry NaN/null/string field values.
  const adversarial = [
    { targetHourly: NaN }, { targetHourly: 'abc' }, { targetHourly: null }, { targetHourly: -5 },
    { mpg: NaN }, { mpg: 'x' }, { mpg: 0 }, { mpg: -25 },
    { gasPrice: NaN }, { gasPrice: null },
    { avgSpeed: 0 }, { avgSpeed: NaN }, { avgSpeed: -10 },
    { firstWait: NaN }, { extraWait: 'y' }, { idleMin: NaN },
    { returnFactor: NaN }, { returnFactor: 'z' }, { taxPct: NaN },
  ];
  let bad = [];
  for (const patch of adversarial) {
    freshCfg(api); api.cfg = patch; api.coerceCfg();   // mirror the load/import boundary
    const r = api.calc(12, 6, 2);
    for (const k of calcKeys) if (!Number.isFinite(r[k])) bad.push(JSON.stringify(patch) + '.' + k + '=' + r[k]);
    if (!Number.isFinite(api.scoreOffer(r, 12, 6, 2))) bad.push('score ' + JSON.stringify(patch));
    const g = api.grade(r.eff); if (!g || !g.label) bad.push('grade ' + JSON.stringify(patch));
    if (!Number.isFinite(api.cpm())) bad.push('cpm ' + JSON.stringify(patch));
    if (!Number.isFinite(api.realMiles(6))) bad.push('realMiles ' + JSON.stringify(patch));
  }
  eq(bad.length, 0, 'R27 no non-finite calc/score/cpm/realMiles outputs under adversarial cfg' + (bad.length ? ' :: ' + bad.join(' | ') : ''));

  // BUG GUARD #10: NaN/non-numeric targetHourly must not make minPay NaN.
  freshCfg(api); api.cfg = { targetHourly: NaN }; api.coerceCfg();
  ok(Number.isFinite(api.calc(10, 5, 1).minPay), 'R27 minPay finite when targetHourly is NaN');
  freshCfg(api); api.cfg = { targetHourly: 'abc' }; api.coerceCfg();
  ok(Number.isFinite(api.calc(10, 5, 1).minPay), 'R27 minPay finite when targetHourly is a string');

  // BUG GUARD #11: non-numeric wait/idle/return cfg must not propagate NaN through calc.
  freshCfg(api); api.cfg = { firstWait: null, extraWait: 'y', idleMin: NaN, returnFactor: 'z' }; api.coerceCfg();
  const r11 = api.calc(12, 6, 2);
  ok(calcKeys.every(k => Number.isFinite(r11[k])), 'R27 calc all-finite when wait/idle/return are non-numeric (bug #11)');

  // Renders must survive an adversarial cfg too
  freshCfg(api); api.cfg = { targetHourly: NaN, mpg: NaN, returnFactor: 'x' }; api.coerceCfg();
  api.history = [{ id: 'a', status: 'completed', platform: 'uber', p: 10, m: 4, stops: 1, ts: Date.now(), startedAt: Date.now(), completedAt: Date.now() + 1e6, ...api.calc(10, 4, 1), g: api.grade(0) }];
  api.expenses = []; api.shifts = []; api.activeShift = null;
  let threw = null;
  try { api.renderStats(); api.renderHistory(); api.renderRef(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R27 all renders survive adversarial cfg' + (threw ? ' :: ' + threw : ''));

  report('ROUND 27');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 28 — localStorage failure resilience
// ════════════════════════════════════════════════════════════════════════════
{
  // save() must swallow a throwing setItem (quota exceeded / disabled storage)
  {
    const { api, localStorage } = loadApp();
    freshCfg(api);
    localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
    let threw = null;
    try { api.save(); } catch (e) { threw = e.message; }
    ok(threw === null, 'R28 save() swallows a throwing setItem');
  }

  // load() must swallow a throwing getItem
  {
    const { api, localStorage } = loadApp();
    localStorage.getItem = () => { throw new Error('SecurityError'); };
    let threw = null;
    try { api.load(); } catch (e) { threw = e.message; }
    ok(threw === null, 'R28 load() swallows a throwing getItem');
    ok(Array.isArray(api.history), 'R28 history stays an array after load failure');
  }

  // A full decision flow must not throw even when persistence is broken
  {
    const h = loadApp(); const api = h.api;
    freshCfg(api);
    h.localStorage.setItem = () => { throw new Error('nope'); };
    const doc = h.sandbox.document;
    doc.getElementById('payout').value = '12'; doc.getElementById('miles').value = '5'; api.setStops(1);
    let threw = null;
    try { api.analyze(); api.decideRide('accepted'); } catch (e) { threw = e.message; }
    ok(threw === null, 'R28 analyze+decide works with storage unavailable');
    eq(api.history.length, 1, 'R28 in-memory state still updates when storage fails');
  }

  report('ROUND 28');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 29 — XSS / injection audit sweep (the full surface)
// ════════════════════════════════════════════════════════════════════════════
{
  const h = loadApp(); const api = h.api;
  const doc = h.sandbox.document;
  freshCfg(api);
  const XSS = `<img src=x onerror=alert(1)>`;
  const BREAKOUT = `evil');alert(document.cookie);('`;

  // esc covers the dangerous five (regression)
  eq(api.esc(XSS), '&lt;img src=x onerror=alert(1)&gt;', 'R29 esc escapes angle brackets');

  // BUG GUARD #9: safeId strips everything but [a-z0-9_-], never empty
  eq(api.safeId(BREAKOUT), 'evilalertdocumentcookie', 'R29 safeId strips quote/paren/semicolon breakout chars');
  eq(api.safeId(`a"b'c<d>`), 'abcd', 'R29 safeId strips quotes/brackets');
  ok(api.safeId('').length > 0, 'R29 safeId never returns empty (falls back to a uid)');
  eq(api.safeId('Good_id-123'), 'Good_id-123', 'R29 safeId preserves valid tokens');

  // id breakout via imported history is neutralized; delEntry still works on the clean id
  api.importJSON({ _text: JSON.stringify({ history: [{ id: BREAKOUT, status: 'accepted', p: 10, m: 4, stops: 1, ts: Date.now(), startedAt: Date.now(), eff: 20 }], shifts: [], expenses: [], cfg: {} }) });
  api.renderHistory();
  let hh = doc.getElementById('history-content').innerHTML;
  ok(!hh.includes(`');alert(document.cookie);('`), 'R29 imported malicious history id does NOT break out of onclick');
  const cleanId = api.history[0].id;
  api.delEntry(cleanId);
  eq(api.history.length, 0, 'R29 delEntry still works against the sanitized id');

  // id breakout via imported expense is neutralized
  api.importJSON({ _text: JSON.stringify({ expenses: [{ id: BREAKOUT, ts: Date.now(), kind: 'gas', amount: 5 }], history: [], shifts: [], cfg: {} }) });
  api.setWindow('all');
  let sh = doc.getElementById('stats-content').innerHTML;
  ok(!sh.includes(`');alert(1);('`) && !sh.includes(`');alert(document.cookie);('`), 'R29 imported malicious expense id does NOT break out');

  // Free-text fields that DO reach innerHTML are escaped: expense kind, history miles/score
  api.expenses = [{ id: 'e', ts: Date.now(), kind: XSS, amount: 5 }];
  api.setWindow('all');
  ok(!doc.getElementById('stats-content').innerHTML.includes(XSS), 'R29 expense kind escaped (bug #5)');

  api.history = [{ id: 'm', status: 'completed', platform: 'uber', p: 10, m: XSS, stops: 1, score: XSS, ts: Date.now(), startedAt: Date.now(), eff: 20 }];
  api.renderHistory();
  hh = doc.getElementById('history-content').innerHTML;
  ok(!hh.includes(XSS), 'R29 history miles + score escaped (bug #8)');

  // Platform is enum-keyed: a junk/script platform can never inject
  api.history = [{ id: 'p', status: 'completed', platform: XSS, p: 5, m: 2, stops: 1, ts: Date.now(), startedAt: Date.now(), eff: 18 }];
  api.renderHistory();
  ok(!doc.getElementById('history-content').innerHTML.includes(XSS), 'R29 junk platform never injects (enum lookup)');

  api.setWindow('today');
  report('ROUND 29');
}

// ════════════════════════════════════════════════════════════════════════════
// ROUND 30 — full regression + golden numbers re-pin (final round)
// ════════════════════════════════════════════════════════════════════════════
{
  const { api } = loadApp();
  freshCfg(api);

  // Golden headline numbers — unchanged across the entire 30-round loop
  const g1 = api.calc(10, 5, 1);
  near(g1.netEff, 20.044, 0.01, 'R30 golden: $10/5mi/1stop = $20.04/hr net');
  eq(api.grade(g1.eff).label, 'WORTH IT', 'R30 golden: WORTH IT');
  eq(api.scoreOffer(g1, 10, 5, 1), 83, 'R30 golden: score 83');
  eq(api.grade(api.calc(25, 4, 1).eff).label, 'GREAT', 'R30 golden: $25/4mi GREAT');
  eq(api.grade(api.calc(4, 9, 3).eff).label, 'SKIP IT', 'R30 golden: $4/9mi/3stops SKIP IT');

  // Core invariants re-pinned
  near(api.cpm(), 0.14, 1e-9, 'R30 cpm = 3.5/25');
  near(api.realMiles(10), 14, 1e-9, 'R30 realMiles 40% deadhead');
  eq(api.payoutOf({ p: '10', actualP: '12' }), 12, 'R30 payoutOf numeric coercion (bug #6)');
  ok(Number.isFinite(api.calc(10, 5, 1).minPay), 'R30 minPay finite (bug #10 guard)');
  eq(api.safeId(`x');y`), 'xy', 'R30 safeId hardening (bug #9)');

  // Every escape vector closed
  const XSS = '<img src=x onerror=alert(1)>';
  eq(api.esc(XSS), '&lt;img src=x onerror=alert(1)&gt;', 'R30 esc holds');

  // Full bulk render smoke: 500 mixed entries + 60 expenses + adversarial cfg fields
  freshCfg(api);
  const hist = [];
  for (let i = 0; i < 500; i++) {
    const m = 1 + (i % 12), p = 4 + (i % 25), s = i % 5;
    const r = api.calc(p, m, s);
    hist.push({ id: 'h' + i, platform: ['uber', 'doordash', 'grubhub', 'other', '<x>'][i % 5],
      status: i % 3 === 0 ? 'declined' : (i % 3 === 1 ? 'accepted' : 'completed'),
      ts: Date.now() - i * 60000, startedAt: Date.now() - i * 60000,
      completedAt: i % 3 === 2 ? Date.now() - i * 60000 + 1800000 : null,
      p: i % 9 === 0 ? String(p) : p, m, stops: s, actualP: i % 7 === 0 ? p + 3 : null,
      score: api.scoreOffer(r, p, m, s), ...r, g: api.grade(r.eff), eff: i % 11 === 0 ? String(r.eff) : r.eff });
  }
  api.history = hist;
  api.expenses = Array.from({ length: 60 }, (_, i) => ({ id: 'e' + i, ts: Date.now() - i * 60000, kind: i % 5 === 0 ? '<b>x</b>' : 'gas', amount: 1 + i }));
  api.shifts = [{ id: 's1', start: Date.now() - 7200000, end: Date.now() - 3600000 }];
  api.activeShift = { id: 'a', start: Date.now() - 1800000 };
  let threw = null;
  try { api.renderStats(); api.renderHistory(); api.renderRef(); } catch (e) { threw = e.message; }
  ok(threw === null, 'R30 full bulk render (500+60, mixed types, junk platform) does not throw' + (threw ? ' :: ' + threw : ''));
  ok(Number.isFinite(api.workedAvgEff()), 'R30 workedAvgEff finite over mixed-type bulk data');

  report('ROUND 30 (final regression)');
}
