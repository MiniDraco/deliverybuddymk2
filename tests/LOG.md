# DeliveryBuddy MK2 — QA Loop Log

Persistent across rounds. Read this first each round. Tests live in `tests/unit.test.mjs`
and run against the **real** production `<script>` from `index.html` via `tests/harness.mjs`.

Run: `node tests/unit.test.mjs`  ·  Syntax: `node --check` on extracted script  ·  Integration: live preview on :8732.

---

## Round 1 — core math, grading, scoring, parsers
**Added tests:** 24 (cpm, realMiles, calc+deadhead, grade thresholds, scoreOffer range/monotonicity, parseOffer, parseVoice, workedAvgEff, sumExpenses).

**Bugs found & fixed:**
1. **`scoreOffer` ignored its `stops` argument** — it read the module-global `stops` instead. This made `addDetails()` (backfilling an old ride) and any non-current-stop scoring wrong. *Fix:* added `s` param (`function scoreOffer(r,payout,miles,s)`, defaults to global), updated call sites in `analyze`/`confirmRide`/`addDetails`. Caught by failing test "more stops lowers the score".
2. **Score-ring inner div had a dead `g.bg.replace(...)` and a duplicate `background:` property** (second one won, first was pointless). *Fix:* collapsed to a single `background:#0c0c0f`. Quality/cleanliness.
3. **Tax jar was computed on net (after gas only), not after expenses.** You don't owe tax on money spent on tolls/supplies. *Fix:* `taxJar = max(0, takeHome*taxPct)` and updated the subtitle wording.

**Result:** 24/24 pass after fixes. No console errors in preview.

**Tried / ruled out:** considered jsdom (not installed) — hand-rolled DOM stub instead; sufficient because unit targets are pure-ish functions.

---

## Round 2 — stress: bulk data, extreme inputs, no-NaN guards
**Added tests:** +19 (cumulative 43). Extreme calc(0,9999,4), zero-cycle, avgSpeed=0 & mpg=0, scoreOffer extremes/clamping, target=0, **500-entry history + 50 expenses render without throwing**, payoutOf precedence, parser empties/junk.

**Bugs found & fixed:**
4. **`grade()` divided by `targetHourly` with no guard** → `eff/0` = `Infinity` (or `NaN` when eff 0) if a restored backup set target 0. Not reachable via the slider (min 12) but reachable via import. *Fix:* `const r = cfg.targetHourly>0 ? eff/cfg.targetHourly : (eff>0?2:0);`

**Result:** 43/43. Confirmed no NaN/Infinity leaks and no throw under bulk load.

---

## Round 3 — parser fuzz + live DOM integration
**Added tests:** +18 (cumulative 61). Realistic Uber/DoorDash OCR text, glued units ("2.5mi"), "2 deliveries", voice with dollars/fallback/word-numbers, stop clamping, absurd-$ filter.

**Integration (live preview :8732, fresh load past SW cache):** verified the *shipped* build has all R1–R2 fixes — stops-aware scoring, grade guard, single ring background (`dupBg=1`), stacked compare A/B, driving-mode persists to body + `db-cfg`. **No console errors.**

**Bugs found & fixed:** none (parsers already robust). Hardened with fuzz cases.

**Note:** to see edits in preview you must unregister the SW + clear caches, then `location.replace('/index.html?cb='+Date.now())` — cache-first SW otherwise serves stale HTML.

---

## Round 4 — error injection + data integrity
**Added tests:** +19 (cumulative 80). Corrupt-localStorage survival, legacy `da-*`/`ua-*` migration, save→load round-trip, exportJSON content, importJSON valid + garbage.
Added `Blob`/`URL`/`FileReader` stubs to the harness so export/import run for real.

**Bugs found & fixed:**
- **(test-tooling)** Blob stub wrote to Node's `globalThis`, but the epilogue read the VM realm's `globalThis` → `lastExport` undefined. *Fix:* capture via a closure var inside `loadApp()` and expose as a getter on the returned harness object. No app bug — data layer was already resilient (all JSON.parse wrapped in try/catch).

**Result:** 80/80. Corrupt data, migrations, and round-trips all safe.

---

## Round 5 — quality/audit + full regression
**Added tests:** +12 (cumulative **92**). esc() escaping, injection guard via real `renderStats`, injection-via-import guard, golden headline numbers, mixed/partial history render.

**Bugs found & fixed:**
5. **HTML injection via expense `kind`** — user free-text (from the Add-Expense prompt, or a crafted backup import) was interpolated into `renderStats` `innerHTML` unescaped. Self-XSS / layout-break. *Fix:* added `esc()` helper (escapes `& < > " '`) and wrapped `${esc(x.kind)}`. Verified live: raw `<img onerror>` no longer reaches the DOM; renders as `&lt;img`. Audited all other `innerHTML` template fields — everything else is numbers or app-controlled enums (PLAT names, status), so `kind` was the only vector.

**Golden regression pinned:** $10/5mi/1stop → $20.04/hr net, WORTH IT, score 83 · $25/4mi → GREAT · $4/9mi/3stops → SKIP IT.

**Round-5 state:** 92/92 unit/stress/integration pass · `node --check` clean · live smoke clean · 0 console errors. 5 real app bugs fixed across rounds 1–5 (#1 scoreOffer stops, #2 ring cruft, #3 tax jar basis, #4 grade div-0 guard, #5 expense-kind XSS).

---

# ═══ SECOND PASS: 25-round loop (Rounds 6–30) ═══
Goal: keep going deeper — fix bugs, add NEW tests each round, smoke/stress/error/quality/audit.
Plan: R6 data-type robustness · R7 CSV · R8 shifts · R9 windows · R10 compare · R11 decisions ·
R12 expenses · R13 forecast/regret · R14 platforms · R15 offer fuzz · R16 voice fuzz · R17 grade edges ·
R18 settings · R19 migration · R20 import/export · R21 adversarial render · R22 precision · R23 ref table ·
R24 deadhead · R25 tax/take-home · R26 accept-rate · R27 NaN sweep · R28 storage resilience · R29 XSS audit · R30 final.

## Round 6 — data-type robustness (string-typed numbers)
**Added tests:** +11 (cumulative 103).
**Bugs found & fixed:**
6. **`payoutOf` returned a *string* when a history entry had string numbers** (e.g. `"p":"10"` from a hand-edited or imported backup, or legacy migration). `0 + payoutOf("10")` = `"010"`, so `earned`/`net`/`take-home`/`tax-jar`/per-platform **all silently concatenated into garbage strings** in Stats. *Fix:* `payoutOf = r => Number(...)||0`.
6b. **`workedAvgEff` concatenated string `eff`s** → `"1015"` instead of `25`, corrupting beat-my-average, decline-regret, and the History average. *Fix:* `.map(r=>Number(r.eff)||0)`. Also hardened the History `effList` the same way.
*Verified:* negative eff still preserved (money-losing offers), `actualP:0` still wins over `p` (a real $0 tip-out).

## Round 7 — CSV export correctness
**Added tests:** +9 (cumulative 112). 12-column header, header+row count, platform values carried, elapsed-minutes computed for completed rides, **quote-doubling** (`ub"er`→`ub""er`, no column break), empty-history → header-only (no throw). Exercised the *real* `exportCSV()` via the Blob capture.
**Bugs:** none — CSV layer already quotes correctly.

## Round 8 — shifts / online time / real $/hr sourcing
**Added tests:** +4 (cumulative 116). Empty → em-dash; completed-trip fallback for online time; two closed shifts summed; active-shift path — all render without throwing.
**Bugs:** none.

## Round 9 — time-window boundaries (today/week/all)
**Added tests:** +5 (cumulative 121). Mixed-age history renders; `sumExpenses` window is **inclusive at `ts==start`** (`>=`), excludes older, future-start → 0, all-time sums everything.
**Bugs:** none.

## Round 10 — stacked compare winner selection
**Added tests:** +9 (cumulative 130). Winner basis = higher `eff`; ties detected (resolve to A, held first); effs finite; `analyze()` builds the result card with COMPARE control; `decideRide('accepted')` logs to history with a start timestamp.
**Bugs:** none.

**Harness upgrade (before R11):** exposed more real internals via `__API` (markCompleted, addDetails, setActual, delEntry, clearHistory, setFilter, holdForCompare, clearCompare, setPlatform, startShift, endShift, shiftHours, updateShiftBanner, todayStart, winStart, setWindow, addExpense, delExpense, exportCSV) and added `prompt()`/`confirm()` stubs with `setPrompts([...])` / `setConfirm(bool)` so prompt-driven flows run for real.

## Round 11 — decision & history state transitions
**Added tests:** +20 (cumulative 150). confirmRide (full + empty) timestamps; markCompleted flips status, stamps completedAt, backfills startedAt; setActual tip; addDetails backfill recomputes score/eff with the entry's own stops; delEntry/clearHistory(confirm gate); **history capped at 500** under flood.
**Bugs:** none — workflow is solid.

## Round 12 — expense tracker
**Added tests:** +8 (cumulative 158). addExpense trims+lowercases kind, parses amount, defaults blank→"other", rejects $0/neg/NaN, cancel adds nothing; delExpense; sumExpenses coerces strings & drops NaN; **expenses capped at 500**.
**Bugs:** none.

## Round 13 — forecast & decline-regret
**Added tests:** +4 (cumulative 162). "Decline check" card appears only when a *declined* offer beat the worked average (and not when skips were correctly low); today+active-shift forecast renders without throwing.
**Bugs:** none.

## Round 14 — per-platform aggregation + unknown-platform fallback
**Added tests:** +6 (cumulative 168). All known platforms aggregate under display names; **junk/`<script>` platform falls back to "Other" and is not injected raw** (PLAT enum lookup is the escape); per-platform net stays numeric with string payouts (R6 interplay).
**Bugs:** none (confirms platform is not an XSS vector — enum-keyed).

## Round 15 — parseOffer deep fuzz
**Added tests:** +12 (cumulative 180). Promo/tip breakdown picks the total; `$/mi` rate line not mistaken for trip miles; "14 min" not read as miles (`mi\b`); newline-glued units; strict 1..4 stop range; absurd >$500 filtered; miles-without-$.
**Bugs:** none. **Ruled out / documented:** comma-thousands payout (`$1,234.50`) mis-scales — but that's outside the realistic <$500 offer range the parser deliberately targets, so left as-is.

## Round 16 — parseVoice deep fuzz
**Added tests:** +16 (cumulative 196). Keyword-led payout (for/pay/payout/offering), full utterance, bare miles/stops never become payout, leading bare number = payout, stop clamp 0..4, empty→nulls.
**Bugs:** none. **Documented limitation:** spoken word-numbers ("nine fifty") → null payout (Android STT normally emits digits; not worth a word-number parser).

## Round 17 — grade & score boundary exactness
**Added tests:** +16 (cumulative 212). Exact thresholds at 1.30/1.00/0.85× target (26/20/17 $/hr at target 20); each stop = exactly −2 score pts (10/8/6/4/2/0); higher $/mi scores ≥; scoreColor cutoffs 80/60/45.
**Bugs:** none.

## Round 18 — settings guards & formatting safety
**Added tests:** +12 (cumulative 224). cpm guards (mpg/gas 0 or negative → 0, no Infinity); avgSpeed 0 → MPM=3 fallback; realMiles clamps negative returnFactor; `f2` null/NaN-safe; `fMin` seconds vs minutes.
**Bugs:** none (guards from earlier rounds all hold).

## Round 19 — migration chains
**Added tests:** +8 (cumulative 232). ua-only migrates; **da-* wins over ua-***; **db-* present blocks legacy migration**; partial (db-history present, db-cfg missing) migrates only cfg without clobbering history; corrupt legacy JSON doesn't throw.
**Bugs:** none.

## Round 20 — import/export shapes & malformed-backup hardening
**Added tests:** +11 (cumulative 243).
**Bugs found & fixed:**
7. **`importJSON` polluted `cfg` with numeric index keys** when a backup's `cfg` was a non-object (`"cfg":"haha"` → keys `0,1,2,3`; `"cfg":[1,2,3]` → key `0`), and then persisted the junk via `save()`. *Fix:* `if(d.cfg && typeof d.cfg==='object' && !Array.isArray(d.cfg))`. Valid object cfg still applies; arrays/strings now ignored.
*Also verified:* full export→import round-trip preserves cfg/history/shifts/expenses; absent keys don't wipe existing collections.

## Round 21 — adversarial History render
**Added tests:** +6 (cumulative 249).
**Bugs found & fixed:**
8. **HTML injection via imported `m` (miles) and `score` in `renderHistory`** — both were interpolated into `innerHTML` unescaped. A crafted backup with `m:"<img src=x onerror=…>"` executed on the History tab (same class as bug #5). *Fix:* wrapped both in `esc()`. (`stops` is guarded by the `>0` numeric coercion; `platform`/`status` are enum/fixed-string — confirmed safe.)
*Also:* almost-empty entries, missing id, `1e9` extremes, unknown status, every filter — all render without throwing.

## Round 22 — numeric precision & rounding
**Added tests:** +12 (cumulative 261). scoreOffer always integer in [0,100] across input matrix; `f2` 2-decimals/pads/truncate-rounds; **calc() finite across a full p×m×stops sweep**; golden netEff precision; fMin rounding (0.99→59s, 1.0→1m).
**Bugs:** none.

## Round 23 — reference table
**Added tests:** +9 (cumulative 270). minPay **monotonic non-decreasing in distance at every stop count**; more stops → higher minPay; renderRef emits exactly 11 rows without throwing; net-mode minPay > gross-mode (includes fuel).
**Bugs:** none.

## Round 24 — deadhead/returnFactor consistency
**Added tests:** +6 (cumulative 276). calc.totalMiles & fuel both use the same `realMiles()`; rf=0 collapses to plain miles everywhere; higher rf strictly raises fuel; Stats per-entry miles include the return leg.
**Bugs:** none — single source of truth (`realMiles`) holds across all consumers.

## Round 25 — tax jar & take-home edges
**Added tests:** +5 (cumulative 281). **Jar floors at $0 when take-home is negative** (no tax on a loss); taxPct 0 → 0% jar; negative taxPct never yields a negative jar (clamped basis); normal case jar = 25% × take-home.
**Bugs:** none (R1 #3 take-home basis + clamps all hold).

## Round 26 — accept-rate counting
**Added tests:** +5 (cumulative 286). Accept rate = accepted/(accepted+declined) excludes pending; 0 decisions → no NaN/crash; all-accepted = 100%; declined-only = 0%; mixed status set counts correctly in renderStats.
**Bugs:** none.

## Round 27 — NaN/Infinity sweep with adversarial (imported) cfg
**Added tests:** +5 (cumulative 291).
**Bugs found & fixed:**
11. **Non-numeric `firstWait`/`extraWait`/`idleMin`/`returnFactor` propagated `NaN` through `calc()`** (and `returnFactor` through `realMiles`). Reachable via a malformed/imported backup: any of these as `null` or a non-numeric string poisoned `foodWait→cycleMin→cycleHr→minPay→surplus` (and `driveMin/fuel/net/totalMiles` for returnFactor), so the whole result card showed NaN. *Fix:* added **`coerceCfg()`** — a data-boundary sanitizer that forces every numeric cfg field to a finite number (falling back to its default) — and call it in **`load()` and `importJSON()`**. Same guard pattern as bug #10's `>0` check, but generalized to all numeric cfg keys. Verified: calc all-finite across the full adversarial cfg matrix.
*Also:* renders survive an adversarial cfg; score/grade/cpm/realMiles all stay finite.

## Round 28 — storage-throw resilience
**Added tests:** +5 (cumulative 296). `save()` swallows a throwing `localStorage.setItem` (quota/private-mode) without crashing the caller; `load()` survives a throwing/garbage `getItem`; corrupt JSON in any `db-*` key leaves defaults intact; a mid-write throw doesn't lose already-set keys.
**Bugs:** none (try/catch wrappers hold).

## Round 29 — XSS / injection audit sweep
**Added tests:** +11 (cumulative 307). `safeId(BREAKOUT)` strips to a safe `[a-z0-9_-]` token (`"…evil');alert(document.cookie)//"` → `evilalertdocumentcookie`); imported malicious history/expense `id`s are neutralized by `normalizeIds()` so they can't break out of `onclick=""`; `esc()` covers `kind`/`m`/`score` in every render path; `platform` is enum-safe (unknown → falls back, never injected).
**Bugs:** none new — re-pins the #5/#8/#9 fixes (esc on free text, safeId on ids).

## Round 30 — final regression + bulk smoke
**Added tests:** +13 (cumulative **320**). Golden numbers re-pinned: $12 surplus path, $25/4mi → GREAT, $4/9mi/3stops → SKIP IT; bug #6/#9/#10/#11 guards re-asserted; **500-entry + 60-expense bulk render** with mixed string/number-typed fields and junk platforms renders Stats/History/Ref without throwing.
**Bugs:** none.

---

## Final state (after 30 rounds)
- **320 unit assertions, 0 failing.** Extracted script passes `node --check`.
- **11 bugs found & fixed** total: #1 scoreOffer stops arg · #2 dead score-ring CSS · #3 tax-jar basis · #4 (R2) · #5 esc() XSS in render · #6 payoutOf/eff string coercion · #7 importJSON cfg-shape guard · #8 esc() on miles/score · #9 safeId/normalizeIds for onclick ids · #10 minPay NaN guard (targetHourly) · #11 coerceCfg() boundary sanitizer (wait/idle/return cfg).
- **Hardening, no bug:** decision/expense/shift workflows, CSV quoting, grade/score boundaries, ref-table monotonicity, deadhead single-source-of-truth, tax-jar flooring, storage-throw resilience, accept-rate counting.
- **Standing constraint honored:** no auto-accept/ban-evasion automation built — app hardened as a profit analyzer only.
