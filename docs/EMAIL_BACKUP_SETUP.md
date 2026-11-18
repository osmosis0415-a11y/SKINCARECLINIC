# 📧 Daily email backup: setup (free, about 10 minutes)

Every clinic phone emails its **encrypted** backup once a day, after closing time.
It arrives in your Gmail as a `.zip`, and a copy is kept in Google Drive for 90 days.
The file opens only with the finance password or the recovery code.

Tip: use a separate Gmail account just for clinic backups, with 2-step verification on.

## A. Make the receiver (on a computer is easiest)
1. Sign in to the Gmail account that should receive the backups.
2. Open **https://script.google.com** → **New project**.
3. Delete everything in the editor. Paste all of `docs/apps-script/Code.gs`.
4. On the line `const SECRET = 'PUT-YOUR-SECRET-HERE';` replace the text with your own
   long secret key (at least 16 letters/numbers). Keep it private.
5. Click 💾 **Save**. Rename the project to *Clinic Backup*.
6. In the function list choose **testSetup** → ▶ **Run** → **Review permissions** →
   choose your account → **Advanced** → **Go to Clinic Backup (unsafe)** → **Allow**.
   (Google shows "unsafe" for every personal script. It is your own code.)
   You should get an email "Clinic backup: setup OK".
7. **Deploy** → **New deployment** → ⚙ type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy** → copy the **Web app URL** (ends with `/exec`).

"Anyone" only means the phones can reach it without logging in. Nothing is sent
or saved unless the request carries your secret key.

## B. Connect the app (once, as Admin, on any phone)
Settings → **Security & backup** → **📧 Email backup** → **Set up automatic**
- Paste the Web app URL and the same secret key
- Choose the time (default 9 PM)
- **Save & test**: a test backup email should arrive within a minute.

The setting reaches the other phones through the app's sync. Each phone then sends
once a day, after the chosen time, whenever the app is open (or the next time it is opened).

## One-tap email (no setup needed)
**📧 Email now** (Settings, or the reception backup banner) opens the share sheet with
today's backup file attached. Choose **Gmail** → Send.

## Restore from an email
Download the `.zip` → unzip → app **Settings → ⬆ Restore** → pick the `.json` file.

## If you change the script later
Deploy → **Manage deployments** → ✏ Edit → Version: **New version** → Deploy.
(The URL stays the same.)
