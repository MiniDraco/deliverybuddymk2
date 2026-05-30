# DeliveryBuddy MK2

A fast, private, offline-first **delivery offer grader** for gig drivers (Uber Eats / DoorDash / Grubhub — food **and** product). Punch in a payout, miles, and stops and it tells you in a glance whether the offer clears your hourly target after fuel, deadhead, and taxes. Built as a single-file Progressive Web App (PWA) that runs great on a **Pixel 9**.

> **Live app:** once published, open `https://<your-username>.github.io/deliverybuddymk2/` on your phone.

---

## Install it on your phone (Pixel / Android)

1. Open the link above in **Chrome** on the phone.
2. Chrome menu (⋮) → **Install app** (or **Add to Home screen**).
3. Launch it from the home-screen icon. It now runs full-screen, works offline, and **Share → DeliveryBuddy** can scan an offer screenshot straight from the share sheet.

There's also an **❔ How to install & full help** button inside the app (the **More** tab) that repeats these steps on the device itself.

---

## Publish your own copy (one command, Windows)

The repo ships a turnkey publisher that puts the app on free **GitHub Pages**:

1. Double-click **`Deploy.cmd`** (or right-click `deploy.ps1` → Run with PowerShell).
2. It installs Git + GitHub CLI if missing, signs you in (one browser pop-up), creates the repo, pushes, and turns on Pages.
3. It prints your permanent `https://…github.io/…` link **and a QR code** — scan it with the Pixel camera, then Install.

> GitHub Pages on a free account needs a **public** repo. This app stores everything on *your* phone and contains no secrets, so public is fine. With GitHub Pro you can go private: `./deploy.ps1 -Visibility private`.

---

## What the tabs do

| Tab | Purpose |
| --- | --- |
| **Offer** | Grade an offer (payout, miles, stops) → keep/skip verdict, with paste, voice, and one-tap "Confirm Ride Now" that timestamps the accept. |
| **Stats** | Start a shift and watch real $/hr, projected daily goal, taxes set-aside, and fuel/expense burn. |
| **History** | Every logged offer; fill in the final payout later and it recomputes net $/hr. |
| **Min $** | Your break-even reference — the minimum payout per mile that's worth taking. |
| **More** | Settings (targets, MPG, gas price, tax %), backup/restore JSON, and in-app help. |

---

## Privacy

100% on-device. All data lives in the browser's `localStorage` — **no account, no server, no tracking**. Use **Backup JSON** in the More tab before clearing data or switching phones.

---

## Developing & testing

- The whole app is **`index.html`** — open it directly in a browser, no build step.
- Tests live in `tests/` and run the *real* production script via Node:
  ```
  node tests/unit.test.mjs
  ```
  320 assertions across 30 QA rounds; see `tests/LOG.md` for the full history.
- `tools/make-guide.mjs` regenerates `DeliveryBuddy-MK2-Guide.pdf` (dependency-free PDF writer).

## Files

| File | Role |
| --- | --- |
| `index.html` | The entire app (UI + logic + PWA wiring). |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | PWA install + offline + share-target plumbing. |
| `deploy.ps1`, `Deploy.cmd` | One-command GitHub Pages publisher. |
| `tests/` | Node test harness, unit tests, and the QA log. |
| `tools/make-guide.mjs` | Generates the printable PDF guide. |
| `DeliveryBuddy-MK2-Guide.pdf` | 6-page install/usage guide. |
