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
| `sw.js` | Offline cache. **Bump `C` on every release.** Add any new file to `FILES`. |
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
- **clinic-v49 (19 Nov 2026):** referrer policy no-referrer → strict-origin, so the Firebase key website lock keeps working (sends only the site name, never the full link).
- **clinic-v48 (19 Nov 2026):** launch hardening: noindex, CSP, no-referrer, privacy notice, 404, a11y labels, global error log (`scc_errlog` + audit log), removed fake default phone; uptime workflow; this file. Backup → restore tested end to end.
- **clinic-v47 (19 Nov 2026):** UX pass 1: contrast, tap sizes, compact phone header, cancel-token confirm, hide backup banner for the day.
- **clinic-v46 (18 Nov 2026):** daily email backup (one-tap share + Apps Script).
