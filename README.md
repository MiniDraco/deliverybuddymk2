# DeliveryBuddy MK2

A fast, private, offline-first **delivery offer grader** for gig drivers (Uber Eats / DoorDash / Grubhub — food **and** product). Punch in a payout, miles, and stops and it tells you in a glance whether the offer clears your hourly target after fuel, deadhead, and taxes. Built as a single-file Progressive Web App (PWA) that runs great on a **Pixel 9**.

> **Live app (PWA):** open `https://minidraco.github.io/deliverybuddymk2/` on your phone.
>
> **Native Android app (APK):** there's now a full native build with two features a web app physically can't do — **notification auto-capture** and **offline screenshot OCR**. See *Install the native Android app* below.

---

## Install the native Android app (APK)

The native app is real Kotlin/Jetpack-Compose — not a web wrapper — and adds:

- **📥 Notification auto-capture** — reads your *own* Uber / DoorDash / Grubhub offer notifications (read-only, on-device) and grades them automatically. No auto-accept, no automation that touches the platforms.
- **📷 Offline OCR** — scan or share an offer screenshot and it reads the payout/miles with ML Kit, fully offline (no internet, no Tesseract CDN).

### 1. Download the APK

Grab **`app-debug.apk`** from the latest **[Release](../../releases/latest)**. (Older builds are also attached to each green run on the **[Actions](../../actions)** tab as the `deliverybuddy-debug-apk` artifact.)

Download it directly on the phone, or copy it over via USB.

### 2. Allow install from your browser / files app

Android blocks sideloaded APKs by default:

1. Tap the downloaded `app-debug.apk`.
2. When prompted, **Settings → "Allow from this source"** (this is per-app: enable it for Chrome or your Files app), then back out and tap the APK again.
3. Tap **Install** → **Open**.

> It's signed with a debug key (fine for personal sideloading). Android may show a Play Protect "unrecognized app" notice — choose **Install anyway**.

### 3. Turn on notification auto-capture (optional but it's the headline feature)

1. Open the app → **Offer** tab (or **More** tab) → **Enable notification access**.
2. In the system list, toggle **DeliveryBuddy offer capture** on and confirm.
3. Back in the app — when an Uber/DoorDash/Grubhub offer notification arrives, a **"Load & grade"** banner appears on the Offer tab.

### 4. Scan a screenshot

- In-app: **Offer → 📷 Scan screenshot**, pick the image.
- Or from anywhere: screenshot the offer → **Share → DeliveryBuddy**.

> All data stays on the device (no account, no server). Use **More → Copy backup** before wiping or switching phones.

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
