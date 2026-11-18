/**
 * Skin Care Clinic - daily email backup receiver (Google Apps Script, free)
 * -----------------------------------------------------------------------
 * The clinic phones send their ENCRYPTED backup here once a day.
 * This script emails it to you as a .zip and keeps a copy in Google Drive.
 * Setup steps: docs/EMAIL_BACKUP_SETUP.md
 */

// 1) Put your own secret key here (any long random text). Enter the SAME key in the app.
//    Never share it or commit it to GitHub.
const SECRET = 'PUT-YOUR-SECRET-HERE';

// 2) Where to send the email. Leave '' to send to the Google account that owns this script.
const SEND_TO = '';

const DRIVE_FOLDER = 'Skin Care Clinic Backups';
const KEEP_DAYS = 90;                 // Drive copies older than this go to Trash
const MAX_ATTACH = 20 * 1024 * 1024;  // bigger than this: email has a Drive link instead

function doPost(e) {
  try {
    if (!SECRET || SECRET.indexOf('PUT-') === 0) return out({ ok: false, error: 'Secret key not set in the script' });
    const d = JSON.parse(e.postData.contents);
    if (d.key !== SECRET) return out({ ok: false, error: 'Wrong secret key' });
    if (!d.data) return out({ ok: false, error: 'No backup data' });

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const name = String(d.file || 'backup.json').replace(/[^\w.\-]/g, '_');
      const zip = Utilities.zip([Utilities.newBlob(d.data, 'application/json', name)], name.replace(/\.json$/, '') + '.zip');
      const folder = getFolder();
      const saved = folder.createFile(zip);
      const to = SEND_TO || Session.getEffectiveUser().getEmail();
      const big = zip.getBytes().length > MAX_ATTACH;
      const body =
        'Daily backup from ' + d.device + ' (' + d.clinic + ')\n' +
        'Day: ' + d.day + '\n' +
        'Patients today: ' + (d.patients || 0) + '   Prescriptions today: ' + (d.rx || 0) + '\n\n' +
        (big ? 'The file is large, so it is kept in Google Drive: ' + saved.getUrl() + '\n\n'
             : 'A copy is also kept in Google Drive, folder "' + DRIVE_FOLDER + '".\n\n') +
        'To restore: unzip, then in the clinic app go to Settings > Restore and choose the .json file.\n' +
        'The backup is encrypted. It opens with the finance password or the recovery code.';
      const msg = { to: to, subject: d.clinic + ' backup ' + d.day + ' (' + d.device + ')', body: body };
      if (!big) msg.attachments = [zip];
      MailApp.sendEmail(msg);
      prune(folder);
    } finally {
      lock.releaseLock();
    }
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return out({ ok: true, msg: 'Clinic backup receiver is running' });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function getFolder() {
  const it = DriveApp.getFoldersByName(DRIVE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER);
}

function prune(folder) {
  const cutoff = Date.now() - KEEP_DAYS * 864e5, files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
}

// Run this ONCE from the editor (▶ Run) to give the script permission for Gmail and Drive.
function testSetup() {
  getFolder();
  MailApp.sendEmail(SEND_TO || Session.getEffectiveUser().getEmail(),
    'Clinic backup: setup OK', 'Your Skin Care Clinic email backup receiver is working.');
}
