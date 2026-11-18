// 📧 Daily backup by email - Skin Care Clinic
// 1) One-tap: "Email backup" opens Gmail (or any app) with today's backup file attached.
// 2) Automatic: once a day, after closing time, each phone sends its backup to the clinic's
//    own Google Apps Script, which emails it to the clinic Gmail and keeps a copy in Google Drive.
// The file is the same ENCRYPTED backup as "⬇ Backup": it opens only with the finance password
// or the recovery code, so the email itself does not expose patient details.
(function () {
  'use strict';
  var LK = 'scc_mail_last';        // last day this phone sent the automatic email (YYYY-MM-DD)
  var busy = false;

  function cfg() { var m = (S.cfg && S.cfg.mail) || {}; return { url: m.url || '', key: m.key || '', hour: m.hour == null ? 21 : +m.hour, on: !!m.on }; }
  function devName() { try { return localStorage.getItem('scc_device_name') || 'device'; } catch (e) { return 'device'; } }
  function ready() { return window.SCC_READY && HIST.A && HIST.R; }
  function fname() { return 'SkinCareClinic_' + today() + '_' + devName().replace(/\W+/g, '_') + '.json'; }
  function last() { try { return localStorage.getItem(LK) || ''; } catch (e) { return ''; } }
  function setLast(d) { try { localStorage.setItem(LK, d); } catch (e) {} }
  function summary() {
    var t = today(), seen = S.q.length + S.arch.filter(function (p) { return p.scanDate === t; }).length;
    var rx = RXREC.filter(function (x) { return x.date === t || (x.ts && dk(new Date(x.ts)) === t); }).length;
    return { patients: seen, rx: rx };
  }

  // ---------- 1. One-tap share (Gmail / WhatsApp-free: user picks the mail app)
  async function share() {
    if (!ready()) return toast('Loading past records… try again in a few seconds', 'info');
    var txt = await A.backupText(A.backupData()), nm = fname(), sm = summary();
    var subj = (S.cfg.name || 'Clinic') + ' backup ' + today() + ' (' + devName() + ')';
    var body = 'Daily backup from ' + devName() + '.\nPatients today: ' + sm.patients + ', prescriptions: ' + sm.rx +
      '.\nThe attached file is encrypted. Open it in the clinic app with ⬆ Restore (finance password or recovery code).';
    var file = new File([txt], nm, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: subj, text: body });
        L('Backup shared by email (' + nm + ')'); commit(); return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // Fallback (computers / old phones): download the file and open a mail draft to attach it
    A.dl(nm, txt, 'application/json');
    location.href = 'mailto:' + encodeURIComponent(S.cfg.mail && S.cfg.mail.to || '') + '?subject=' + encodeURIComponent(subj) +
      '&body=' + encodeURIComponent(body + '\n\n(Attach the file ' + nm + ' from Downloads.)');
    toast('File saved to Downloads, attach it to the email', 'info');
  }

  // ---------- 2. Automatic daily email through Google Apps Script
  function dueDay() { // the latest day whose closing time has passed
    var n = new Date(), c = cfg();
    if (n.getHours() >= c.hour) return today();
    var y = new Date(n); y.setDate(y.getDate() - 1); return dk(y);
  }
  async function send(manual) {
    var c = cfg();
    if (!c.url || !c.key) { if (manual) toast('Set up automatic email first (Admin → Settings)', 'warning'); return false; }
    if (busy) return false;
    if (!ready()) { if (manual) toast('Loading past records… try again in a few seconds', 'info'); return false; }
    if (!navigator.onLine) { if (manual) toast('No internet. It will send when back online', 'warning'); return false; }
    busy = true;
    try {
      var day = manual ? today() : dueDay(), sm = summary();
      var payload = JSON.stringify({ key: c.key, clinic: S.cfg.name || 'Clinic', device: devName(), day: day,
        file: fname(), patients: sm.patients, rx: sm.rx, data: await A.backupText(A.backupData()) });
      var ok = false;
      try { // text/plain keeps it a "simple" request (no CORS pre-check), which Apps Script accepts
        var r = await fetch(c.url, { method: 'POST', body: payload, redirect: 'follow' });
        var j = await r.json(); ok = j && j.ok; if (!ok && manual) toast('Email failed: ' + (j && j.error || 'unknown'), 'error');
      } catch (e) { // response unreadable on some browsers: send blind
        await fetch(c.url, { method: 'POST', body: payload, mode: 'no-cors' }); ok = true;
      }
      if (ok) { setLast(day); L('Daily backup emailed (' + day + ')'); commit(); if (manual) toast('Backup emailed ✅'); }
      return ok;
    } catch (e) { if (manual) toast('Could not send. Check internet', 'error'); return false; }
    finally { busy = false; ui(); }
  }
  function tick() { var c = cfg(); if (c.on && c.url && c.key && last() < dueDay()) send(false); }

  // ---------- Settings (Admin)
  async function setup() {
    if (ROLE !== 'adm') return toast('Only Admin', 'warning');
    var c = cfg(), m = S.cfg.mail || {};
    var r = await Swal.fire({
      title: '📧 Daily email backup',
      html: '<p style="text-align:left;font-size:.82rem;margin:0 0 .4rem">Paste the <b>Web app URL</b> and the <b>secret key</b> from your Google Apps Script (see the setup steps in the repo: docs/EMAIL_BACKUP_SETUP.md).</p>' +
        '<input id="mu" class="swal2-input" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '">' +
        '<input id="mk" class="swal2-input" placeholder="Secret key" value="' + esc(c.key) + '">' +
        '<label style="display:block;margin-top:.6rem">Send every day after <select id="mh">' +
        [17, 18, 19, 20, 21, 22, 23].map(function (h) { return '<option value="' + h + '"' + (h === c.hour ? ' selected' : '') + '>' + (h - 12) + ' PM</option>'; }).join('') + '</select></label>' +
        '<input id="mt" class="swal2-input" placeholder="Email for the one-tap button (optional)" value="' + esc(m.to || '') + '">',
      showCancelButton: true, showDenyButton: !!c.url, denyButtonText: 'Turn off', confirmButtonText: 'Save & test',
      preConfirm: function () {
        var u = $('mu').value.trim(), k = $('mk').value.trim();
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) return Swal.showValidationMessage('Paste the Apps Script Web app URL');
        if (k.length < 12) return Swal.showValidationMessage('Secret key is too short');
        return { url: u, key: k, hour: +$('mh').value, to: $('mt').value.trim(), on: true };
      }
    });
    if (r.isDenied) { S.cfg.mail = Object.assign({}, m, { on: false }); L('Daily email backup turned off'); commit(); ui(); return; }
    if (!r.isConfirmed) return;
    S.cfg.mail = r.value; L('Daily email backup set up'); commit(); ui();
    toast('Sending a test email…', 'info'); send(true);
  }

  function ui() {
    var el = $('mbk'); if (!el) return; var c = cfg(), l = last();
    el.innerHTML = '<b>📧 Email backup</b><p class="m" style="margin:.3rem 0 .4rem;font-size:.8rem">' +
      (c.on && c.url ? '✅ Automatic: every phone emails its encrypted backup once a day after ' + (c.hour - 12) + ' PM' + (l ? '. This phone last sent: ' + fd(l) : '. Not sent yet from this phone') + '.'
        : 'Get the day\'s encrypted backup in your Gmail every night, automatically. Or tap <b>Email now</b> to send it yourself.') + '</p>' +
      '<div class="grid"><button class="ok" onclick="MAILBK.share()">📧 Email now</button>' +
      (c.on && c.url ? '<button class="g" onclick="MAILBK.send(true)">Send automatic now</button>' : '') +
      (ROLE === 'adm' ? '<button class="g" onclick="MAILBK.setup()">' + (c.url ? 'Change' : 'Set up automatic') + '</button>' : '') + '</div>';
  }

  window.MAILBK = { share: share, send: send, setup: setup, ui: ui };

  function boot() {
    // settings card slot (Admin)
    var dsk = document.getElementById('dsk');
    if (dsk && !document.getElementById('mbk')) {
      var d = document.createElement('div'); d.id = 'mbk'; d.style.cssText = 'margin-top:.75rem;padding-top:.6rem;border-top:1px solid #e2e8f0';
      dsk.parentNode.insertBefore(d, dsk.nextSibling);
    }
    // reception "back up" banner gets an email button too
    var bkb = document.getElementById('bkb');
    if (bkb && !document.getElementById('bkm')) {
      var b = document.createElement('button'); b.id = 'bkm'; b.textContent = '📧 Email'; b.onclick = share; b.style.marginLeft = '.35rem';
      bkb.appendChild(b);
    }
    ui();
    if (typeof render === 'function' && !render.__mail) { var _r = render; render = function () { var x = _r.apply(this, arguments); try { ui(); } catch (e) {} return x; }; render.__mail = 1; }
    setTimeout(tick, 15000);
    setInterval(tick, 5 * 60 * 1000);
    addEventListener('online', function () { setTimeout(tick, 5000); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(tick, 3000); });
  }
  boot();  // sending itself waits until the data is unlocked (ready())
  addEventListener('scc-unlocked', function () { ui(); setTimeout(tick, 5000); });
})();
