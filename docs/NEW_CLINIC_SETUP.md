# Setting up the app for a new clinic (own free cloud)

Each clinic gets its **own free Firebase project**. Its data, logins and free-plan limits are separate from every other clinic. All clinics use the same app link: https://osmosis0415-a11y.github.io/SKINCARECLINIC/

Time needed: about 20 minutes. Cost: nothing (Firebase **Spark** plan, no card).

Use the **clinic's own Google account** if possible, so the clinic owns its data. One Google account can only create a limited number of projects.

---

## Part 1: Create the clinic's cloud (Firebase console, on a computer)

1. Go to **https://console.firebase.google.com** → **Create a project**.
   - Name it, for example `sunrise-clinic`.
   - Google Analytics: **off**.
   - Wait, then tap **Continue**.
   - Leave the plan on **Spark (free)**. **Never** click "Upgrade to Blaze".
2. **Clinic login:**
   1. Go to Build → **Authentication** → Get started → **Email/Password** → Enable → Save.
   2. Open the **Users** tab → **Add user**.
   3. Enter the clinic's cloud email and a strong password. Write both on the key sheet.
   4. Copy the **User UID** shown in the list. You need it in step 4.
3. **Database:**
   1. Go to Build → **Realtime Database** → Create database.
   2. Location: **Singapore (asia-southeast1)**.
   3. Choose **Start in locked mode**.
4. **Security rules:**
   1. In the **Rules** tab, delete everything and paste the contents of `firebase-database-rules.json` (in the backup kit, or `docs/` in the code).
   2. Tap **Publish**.
5. **Approve the login:**
   1. In the **Data** tab, tap **+** next to the database name.
   2. Name: `allowed`. Tap **+** again inside it.
   3. Name: the **User UID** from step 2. Value: `true`. Tap **Add**.
   - For extra logins for the same clinic: add each new user's UID under `allowed` with the **first UID as the value (in quotes)** instead of `true`.
6. **Web connection details:**
   1. Go to Project settings (⚙) → General → Your apps → **</> Web**.
   2. Name it, for example `clinic app`. Do **not** tick Hosting. Tap **Register app**.
   3. Copy the whole `const firebaseConfig = { … }` block. It's not secret, but keep a copy.
7. **Lock the key to the app's website:**
   1. Go to https://console.cloud.google.com → choose the project → APIs & Services → **Credentials**.
   2. Open **Browser key (auto created by Firebase)** → Application restrictions → **Websites**.
   3. Add `https://osmosis0415-a11y.github.io/*` → **Save**.

## Part 2: First phone of the clinic (the Admin's phone)

1. Open the app link. On first setup, set the **Admin PIN** and **finance password**, and write down the **recovery code**.
2. **🏥 Your clinic:**
   - Fill in clinic name, doctor's full name, qualification, **Registration No.**, **State Medical Council**, address, phone, hours and fees.
   - These print on every token slip and prescription.
3. Set the Doctor and Reception PINs.
4. Menu → **🛡 Admin portal** → **☁ Clinic cloud / add a phone**:
   1. Paste the `firebaseConfig` block from Part 1 step 6 → **Connect this phone** → Switch.
   2. Tap the **☁** badge at the top → sign in with the clinic cloud email and password from Part 1 step 2.
   3. The badge turns **☁ Synced**. The clinic's logins are now saved in its own cloud.
5. Check: in the Firebase console → Realtime Database → Data, a `scc` entry appears.

## Part 3: Every other phone of the clinic

1. On the Admin phone: Admin portal → **☁ Clinic cloud / add a phone**. A QR code appears.
2. On the new phone: scan the QR with the **camera** and open the link. The app opens already connected to this clinic's cloud.
3. On the first screen tap **🔗 Join my clinic**.
4. Sign in with the clinic cloud email and password, then enter a clinic PIN.
5. In Admin portal → Logins, choose **This phone is for**: Doctor only / Reception only / Anyone.

The queue, logins, saved prescription sets, medicine list, clinic details and the last 45 days of prescriptions now sync between this clinic's phones only.

## Part 4: Patient status page and backups

- Tap the **☁ Synced** badge at the top → **Patient status QR poster**. The link already points to this clinic's cloud. Print it and put it at reception.
- On the clinic PC: Admin portal → 💾 **Hard-disk records** → choose a folder.
- Keep the key sheet locked away, and follow the routine in `README_BACKUP.md`.

## Checks before the first OPD day

- [ ] Opening `https://<database-url>/scc.json` in a browser says **Permission denied**, so the rules work.
- [ ] Firebase console → Usage and billing shows **Spark / No cost**.
- [ ] A test prescription prints with the right doctor, Reg. No. and council (Admin portal → 🖨 Printer setup → 🧪 Test prescription).
- [ ] Register → call → prescription → complete works on the actual phones and printer.

## Limits per clinic (free plan, each clinic separately)

| Limit | Comfortable for |
|---|---|
| 100 live connections | Staff phones plus about 90 patients viewing the status page at the same moment |
| 1 GB stored | About 200 patients/day for a year (audit log 1 year, prescriptions 45 days in the cloud) |
| 10 GB downloaded a month | Far more than needed (about 10 MB a month per phone) |
