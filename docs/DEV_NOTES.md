# DEV_NOTES: Skin Care Clinic app

Read this first in every coding session instead of the whole 200 KB `index.html`.

Live: https://osmosis0415-a11y.github.io/SKINCARECLINIC/ (GitHub Pages, `master` branch)
Rule: one feature per session; every release bumps the cache name in `sw.js` and adds a line to the changelog below.

## File map
| File | What it does |
|---|---|
| `index.html` | The whole staff app: PIN lock, reception queue, walk-in/QR tokens, doctor cabin, finance, settings, backup/restore, records. Global objects: `S` (state), `A` (actions), `CR` (encryption), `G` (PIN lockout), `DISK` (hard-disk folder backup), `L()` (audit log). |
| `cloudsync.js` | Firebase Realtime Database sync between clinic phones (Firebase JS SDK 8.10.1 loaded from gstatic). Default project `clinic-kiosk-a23db`. |
| `rxpad.js` | Prescription pad, Rx templates, Rx print/PDF. |
| `printview.js` | Print preview window used by tokens, Rx and reports. |
| `mailbackup.js` | One-tap email backup + Apps Script automatic daily email (`docs/apps-script/Code.gs`). |
| `status.html` | Public patient token-status page. Shows token numbers only, never names. Reads `pub/<clinic>`. |
| `privacy.html` | Bilingual privacy notice (DPDP Act 2023), printable for the reception wall. |
| `404.html` | Page-not-found for GitHub Pages. |
| `rxdock.js` | Docked Rx pad (laptop/tablet ≥1000 px, Doctor/Admin, Reception screen): pad pinned on the right, always shows the patient in the cabin (`S.act`); Call Next loads the next patient; typed-but-unsaved Rx kept as in-memory drafts (chips); Full screen / Hide pad (localStorage `scc_rxdock`). Wraps `render()` and `A.rx()`. Uses `RxPad.open(p,seed,existing,{dock:el})`. API `RxDock.sync/dirty/hide/show/reopen`. |
| `peddose.js` | Child dose helper for the Rx pad (hooks `RxPad.onDraw`). Shows when age < 18 y or weight < 40 kg: pick a derm drug → dose by mg/kg, weight band or age → mL / tablets in Indian strengths (plus matching items from the clinic medicine list) → ＋ Add to Rx (note carries mL + Telugu). Adds a 👶 dose line / ⚠ age warning under every matching medicine row, topical age limits, fingertip-unit table. Data table `DB`, `TOP`, `FTU` at the top of the file; API `PedDose.calc/find/ageMonths`. |
| `saferefresh.js` | Safe refresh: ⟳ header button, F5/Ctrl+R/Cmd+R intercepted → saves, re-renders, reconnects Firebase, checks for an app update. Updates install only when no Rx pad/dialog is open, then reopen the same screen (sessionStorage `scc_restore`). Warns before closing the tab with an unsaved Rx. Ctrl+Shift+R = full reload. API `SafeRefresh.soft()`, `.applyUpdate()`. |
| `kioskmode.js` | Kiosk lock per device (Admin portal → 🔒 Kiosk lock, localStorage `scc_kiosk`). For Doctor/Reception logins (Admin never restricted): full screen + "Tap to continue" cover, Keyboard Lock API on laptops (Esc/Alt+Tab/Win key), Back trapped (closes dialogs instead), external links / window.open / navigator.share blocked, browser shortcuts and long-press menu blocked, wake lock (`scc_kiosk_wake`), leaving the app logged to the clinic log. Exit: Admin portal or 5 quick taps on the clinic logo / PIN title → Admin PIN (`chk('pin')`, counts toward lockout). Setup dialog explains Android App pinning, iOS Guided Access, Windows kiosk account. API `Kiosk.on/setup/enable/exit/full`. |
| `sw.js` | Offline cache. **Bump `C` on every release.** Add any new file to `FILES`. Accepts the message `'skip'` (skipWaiting). |
| `vendor/` | Local copies of html5-qrcode, jsPDF, qrcodejs, icons, dialogs (Swal-like, classes `sw-pop`, `sw-ok`, `sw-no`), font. |
| `docs/firebase-database-rules.json` | Database security rules. Paste into Firebase → Realtime Database → Rules. |
| `docs/NEW_CLINIC_SETUP.md`, `docs/EMAIL_BACKUP_SETUP.md` | Setup guides. |
| `.github/workflows/uptime.yml` | Free downtime alert every 30 min; opens a `downtime` issue (GitHub emails the owner). |

## Security model
- Patient data on each phone is encrypted (AES-GCM; key wrapped with PBKDF2 250k from PIN / finance password / recovery code).
- 5 wrong PINs → timed lockout that grows.
- Backups are encrypted; they open with the finance password or recovery code.
- Firebase rules: only approved UIDs under `allowed` can read/write their clinic; `pub` is public read (token numbers only).
- `index.html` has a Content-Security-Policy meta tag. If you add a new outside service, add its domain there, or it will be blocked.
- All pages are `noindex` (kept out of Google).

## Test before every push
Headless Chrome at 360 px: first-time setup → walk-in → token slip → backup → restore on a fresh profile. No console errors, no CSP violations.

## Changelog
- **clinic-v56 (26 Nov 2026):** kiosk lock (kioskmode.js): keeps staff inside the app on a device; Admin portal button; device pinning guide.
- **clinic-v55 (19 Nov 2026):** child dose helper (peddose.js): 40 oral derm drugs (antihistamines, antibiotics, antifungals, antivirals, ivermectin, steroids/immune drugs, propranolol, zinc, analgesics) with weight-based doses and Indian strengths; topical age limits; rxpad.js gained the `RxPad.onDraw` hook.
- **clinic-v51 (19 Nov 2026):** docked Rx pad for the doctor's laptop (rxdock.js); rxpad.js gained a dock mode; auto-lock and safe refresh wait while a prescription is unsaved.
- **clinic-v50 (19 Nov 2026):** safe refresh (saferefresh.js): refresh on the laptop without losing an open prescription, search or screen; app updates wait until the Rx is finished; update banner uses it too.
- **clinic-v49 (19 Nov 2026):** referrer policy no-referrer → strict-origin, so the Firebase key website lock keeps working (sends only the site name, never the full link).
- **clinic-v48 (19 Nov 2026):** launch hardening: noindex, CSP, no-referrer, privacy notice, 404, a11y labels, global error log (`scc_errlog` + audit log), removed fake default phone; uptime workflow; this file. Backup → restore tested end to end.
- **clinic-v47 (19 Nov 2026):** UX pass 1: contrast, tap sizes, compact phone header, cancel-token confirm, hide backup banner for the day.
- **clinic-v46 (18 Nov 2026):** daily email backup (one-tap share + Apps Script).

## Adding a device by QR (Nov 2026)
New devices join only by scanning the one-time QR from Admin → 📲 Add a new device (QR).
- The Admin phone (cloud sync on) checks the cloud password, then writes `pair/<random id>` = {c, i, exp}:
  the cloud email + password, AES-GCM encrypted with a random 256-bit key. Valid 5 minutes.
- The key is only in the QR, after `#` (never sent to a server). Without the QR the database entry is unreadable.
- The new device reads `pair/<id>` (public read of that one id only; the list is not readable), decrypts,
  signs in, fetches the clinic logins, and deletes the entry, so a QR works once. The Admin phone shows "✅ Device joined".
- The cloud password is kept on the Admin phone encrypted with the clinic data key (`S.cpw`) so the QR appears at once next time.
- Needs the `pair` rule in docs/firebase-database-rules.json published in Firebase → Realtime Database → Rules.

## Start fresh and prescriptions (Nov 2026)
- Bug: after 🧹 Start fresh, today's prescriptions came back because the cloud copies (rxs/<clinic>/r) were downloaded again.
- Now: prescriptions with ts <= S.wipeAt are ignored everywhere (local load, cloud download, live updates) via rxLive()
  and the rxIn/rxStart filters. Records restored from a backup on purpose are marked rs:1 and kept.
- Start fresh overwrites each cloud copy up to the wipe with {ts, del:true} (the rules refuse deleting records newer than
  45 days). The Admin phone also does this on connect for any earlier wipe.
- The Start fresh dialog now counts prescriptions correctly and says the cloud security log is kept.
