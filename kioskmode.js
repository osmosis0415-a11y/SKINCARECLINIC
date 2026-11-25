/* Kiosk lock: keeps clinic staff inside the app on this device.
   Turn on/off: Admin portal → 🔒 Kiosk lock (per device, localStorage 'scc_kiosk').
   What it does in the app (staff logins: Doctor / Reception; Admin is never restricted):
   - Full screen, and a "Tap to continue" cover whenever full screen is left; on laptops the
     Keyboard Lock API captures Esc, Alt+Tab, Windows key, Ctrl+W/T/N while full screen (Chrome/Edge).
   - Back button / back swipe does nothing; links and pop-ups to other websites are blocked;
     browser shortcuts (new tab, address bar, dev tools, save, view source) are blocked;
     no long-press menu or text selection outside typing boxes; no pull-to-refresh.
   - Screen kept awake (optional). Every time the app is left (Home, recent apps) it is written
     to the clinic log with how long, and staff see a notice that this is recorded.
   - Exit: Admin portal, or tap the 🔒 PIN title / clinic logo 5 times quickly → Admin PIN.
   The phone's Home and Recent-apps buttons can only be blocked by the device itself, so the
   setup dialog explains App pinning (Android), Guided Access (iPhone/iPad) and kiosk accounts (Windows).
   API: Kiosk.on(), Kiosk.setup(), Kiosk.enable(bool), Kiosk.exit() */
(function(){
'use strict';
var KEY='scc_kiosk',WKEY='scc_kiosk_wake';
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
function put(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}
function isOn(){return get(KEY)==='1'}
function role(){try{return typeof ROLE!=='undefined'?ROLE:null}catch(e){return null}}
function admin(){return role()==='adm'}
function log(m){try{if(typeof L==='function'){L(m);if(typeof save==='function')save()}}catch(e){}}
function tst(m,t){try{if(typeof toast==='function')toast(m,t||'info')}catch(e){}}
function standalone(){try{return matchMedia('(display-mode: standalone),(display-mode: fullscreen)').matches||navigator.standalone===true}catch(e){return false}}
var fsOK=!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
function fsEl(){return document.fullscreenElement||document.webkitFullscreenElement}
var busyUntil=0; // file pickers, camera, print and share leave full screen for a moment
function busy(ms){busyUntil=Date.now()+(ms||60000)}

/* ---------- styles ---------- */
var css=document.createElement('style');
css.textContent=
'html.kiosk,html.kiosk body{overscroll-behavior:none}'+
'html.kiosk body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}'+
'html.kiosk input,html.kiosk textarea,html.kiosk select,html.kiosk [contenteditable]{-webkit-user-select:text;user-select:text}'+
'#kskCover{position:fixed;inset:0;z-index:2147483000;background:#0f172af2;color:#fff;display:none;align-items:center;justify-content:center;text-align:center;padding:1.5rem;cursor:pointer}'+
'#kskCover.on{display:flex}#kskCover b{display:block;font-size:1.6rem;margin:.6rem 0 .3rem}#kskCover span{opacity:.8;font-size:.95rem}'+
'#kskCover .ks{font-size:3.2rem}'+
'#kskBadge{position:fixed;left:.4rem;bottom:calc(4.6rem + env(safe-area-inset-bottom));z-index:21;background:#0f172a;color:#fff;font-size:.65rem;font-weight:800;padding:.15rem .45rem;border-radius:999px;opacity:.55;pointer-events:none;display:none}'+
'html.kiosk #kskBadge{display:block}'+
'.ksk-g{text-align:left;font-size:.84rem;line-height:1.45}.ksk-g details{background:#f8fafc;border:1px solid #e2e8f0;border-radius:.75rem;padding:.55rem .75rem;margin:.45rem 0}'+
'.ksk-g summary{font-weight:800;cursor:pointer}.ksk-g ol{margin:.4rem 0 .2rem;padding-left:1.2rem}.ksk-g li{margin:.2rem 0}'+
'.ksk-g .sw{display:flex;gap:.5rem;align-items:center;font-weight:700;margin:.35rem 0}.ksk-g .sw input{width:auto;min-height:0}'+
'.ksk-g .st{padding:.5rem .7rem;border-radius:.7rem;font-weight:800;margin:.2rem 0 .5rem}';
document.head.appendChild(css);

/* ---------- cover shown when full screen is lost ---------- */
var cover=document.createElement('div');cover.id='kskCover';cover.setAttribute('role','dialog');cover.setAttribute('aria-label','Tap to continue');
cover.innerHTML='<div><div class="ks">🔒</div><b>Tap to continue</b><span>This device is locked to the clinic app.</span></div>';
var badge=document.createElement('div');badge.id='kskBadge';badge.textContent='🔒 Kiosk';
function mount(){if(!cover.parentNode){document.body.appendChild(cover);document.body.appendChild(badge)}}

function goFull(){
  if(!isOn()||!fsOK||fsEl())return Promise.resolve();
  var d=document.documentElement,p;
  try{p=d.requestFullscreen?d.requestFullscreen({navigationUI:'hide'}):d.webkitRequestFullscreen()}catch(e){p=null}
  return Promise.resolve(p).then(lockKeys).catch(function(){});
}
var kl=false;
function lockKeys(){
  // Chrome/Edge on laptops: while full screen, Esc must be held to leave, and Alt+Tab, Windows key, Ctrl+W/T/N reach the page instead
  try{if(!kl&&navigator.keyboard&&navigator.keyboard.lock&&fsEl()&&!admin()){kl=true;return navigator.keyboard.lock().catch(function(){kl=false})}}catch(e){}
}
function unlockKeys(){kl=false;try{navigator.keyboard&&navigator.keyboard.unlock&&navigator.keyboard.unlock()}catch(e){}}
function syncCover(){
  mount();
  var show=isOn()&&fsOK&&!fsEl()&&!document.hidden&&Date.now()>busyUntil;
  cover.classList.toggle('on',!!show);
}
cover.addEventListener('click',function(){goFull().then(syncCover);cover.classList.remove('on')});
document.addEventListener('fullscreenchange',function(){if(fsEl())lockKeys();else kl=false;setTimeout(syncCover,250)});
document.addEventListener('webkitfullscreenchange',function(){setTimeout(syncCover,250)});

/* ---------- re-enter full screen on the next tap ---------- */
function gesture(e){
  if(!isOn())return;
  if(e.target&&e.target.closest&&e.target.closest('input[type=file],#reader,#qr-reader,.html5-qrcode-element'))busy(60000);
  if(!fsEl()&&Date.now()>busyUntil)goFull();
}
document.addEventListener('pointerdown',gesture,true);
document.addEventListener('keydown',function(e){if(isOn()&&!fsEl()&&Date.now()>busyUntil&&!e.ctrlKey&&!e.metaKey)goFull()},true);
addEventListener('beforeprint',function(){busy(15000)});
addEventListener('afterprint',function(){busyUntil=Date.now()+800;setTimeout(syncCover,900)});

/* ---------- back button / back swipe ---------- */
var trapped=false;
function trap(){if(trapped||!isOn())return;trapped=true;try{history.pushState({ksk:1},'',location.href)}catch(e){}}
addEventListener('popstate',function(){
  if(!isOn())return;
  try{history.pushState({ksk:1},'',location.href)}catch(e){}
  // the Back button closes an open dialog / menu instead of leaving the app
  try{var c=document.querySelector('.sw-pop .sw-no,.swal2-cancel');if(c&&c.offsetParent){c.click();return}}catch(e){}
  try{var ov=document.getElementById('ov');if(ov&&ov.classList.contains('on')){ov.click();return}}catch(e){}
});

/* ---------- keys ---------- */
document.addEventListener('keydown',function(e){
  if(!isOn()||admin())return;
  var k=(e.key||'').toLowerCase(),c=e.ctrlKey||e.metaKey,bad=false;
  if(k==='f11'||k==='f12'||k==='f1'||k==='f3'||k==='f6'||k==='f7')bad=true;
  if(c&&!e.altKey&&['t','n','w','l','o','s','u','j','h','d','g','e','k','+','=','-','0'].indexOf(k)>=0)bad=true;
  if(c&&e.shiftKey&&['i','j','c','n','t','w','delete','b','o','m'].indexOf(k)>=0)bad=true;
  if(e.altKey&&(k==='arrowleft'||k==='arrowright'||k==='home'||k==='d'||k==='f'||k==='e'||k==='f4'))bad=true;
  if(k==='browserback'||k==='browserforward'||k==='browserhome'||k==='browsersearch'||k==='contextmenu')bad=true;
  if(bad){e.preventDefault();e.stopPropagation();}
},true);
// pinch / ctrl+wheel zoom
document.addEventListener('wheel',function(e){if(isOn()&&!admin()&&e.ctrlKey)e.preventDefault()},{passive:false,capture:true});

/* ---------- long-press menu ---------- */
document.addEventListener('contextmenu',function(e){
  if(!isOn()||admin())return;
  if(e.target&&e.target.closest&&e.target.closest('input,textarea,[contenteditable]'))return;
  e.preventDefault();
},true);
document.addEventListener('dragstart',function(e){if(isOn()&&!admin()&&e.target&&e.target.tagName==='A')e.preventDefault()},true);

/* ---------- links and pop-ups to other sites ---------- */
function sameApp(u){
  if(!u||u==='about:blank')return true;
  try{var x=new URL(u,location.href);if(x.protocol==='blob:'||x.protocol==='data:')return true;
    if(x.protocol==='tel:')return true;
    return x.origin===location.origin&&x.pathname.indexOf(location.pathname.replace(/[^/]*$/,''))===0}catch(e){return false}
}
document.addEventListener('click',function(e){
  if(!isOn()||admin())return;
  var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;
  var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'||h.indexOf('javascript:')===0)return;
  if(!sameApp(a.href)){e.preventDefault();e.stopPropagation();tst('🔒 Other websites and apps are locked on this device','warning');log('Kiosk: blocked link to '+String(a.href).slice(0,80))}
},true);
var _open=window.open;
window.open=function(u){
  if(isOn()&&!admin()&&!sameApp(u)){tst('🔒 Other websites and apps are locked on this device','warning');log('Kiosk: blocked pop-up to '+String(u).slice(0,80));return null}
  if(isOn())busy(20000); // print preview window
  return _open.apply(window,arguments);
};
if(navigator.share){var _share=navigator.share.bind(navigator);try{navigator.share=function(d){
  if(isOn()&&!admin()){tst('🔒 Sharing to other apps is Admin only on this device','warning');return Promise.reject(new DOMException('Kiosk lock','NotAllowedError'))}
  busy(60000);return _share(d)}}catch(e){}}

/* ---------- keep screen on ---------- */
var wl=null;
function wake(){
  if(!isOn()||get(WKEY)==='0'||document.hidden||!('wakeLock' in navigator)||wl)return;
  navigator.wakeLock.request('screen').then(function(w){wl=w;w.addEventListener('release',function(){wl=null})}).catch(function(){});
}
function sleep(){try{wl&&wl.release()}catch(e){}wl=null}

/* ---------- leaving the app is recorded ---------- */
var leftAt=0;
document.addEventListener('visibilitychange',function(){
  if(!isOn())return;
  if(document.hidden){if(Date.now()>busyUntil)leftAt=Date.now();return}
  wake();
  if(leftAt){var s=Math.round((Date.now()-leftAt)/1000);leftAt=0;
    var r=role();if(s>=3&&r!=='adm'){log('Kiosk: app was left for '+(s>=120?Math.round(s/60)+' min':s+' s')+(r?' ('+r+' login)':' (locked screen)'));
      tst('🔒 This device is for the clinic app only. Leaving the app is recorded.','warning')}}
  setTimeout(syncCover,300);
});

/* ---------- hidden exit: 5 quick taps on the PIN title or clinic logo ---------- */
var taps=[];
document.addEventListener('click',function(e){
  if(!isOn())return;
  var t=e.target&&e.target.closest&&e.target.closest('#lock h3,header .lg');if(!t)return;
  var n=Date.now();taps=taps.filter(function(x){return n-x<3000});taps.push(n);
  if(taps.length>=5){taps=[];exit()}
},true);

async function askAdmin(title){
  if(typeof G!=='undefined'&&G.blocked&&G.blocked())return false;
  var r=await Swal.fire({title:title,html:'<p class="m" style="font-size:.85rem">Enter the <b>Admin PIN</b>.</p><input id="kskPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" class="swal2-input" placeholder="Admin PIN">',showCancelButton:true,confirmButtonText:'OK',
    didOpen:function(){setTimeout(function(){var i=document.getElementById('kskPin');i&&i.focus()},100)},
    preConfirm:function(){var v=(document.getElementById('kskPin')||{}).value||'';if(!v){Swal.showValidationMessage('Enter the Admin PIN');return false}return v}});
  if(!r||!r.isConfirmed||!r.value)return false;
  var ok=false;try{ok=await chk('pin',String(r.value))}catch(e){}
  if(!ok){try{G.fail('PIN')}catch(e){}log('Kiosk: wrong Admin PIN at kiosk exit');return false}
  try{G.good()}catch(e){}
  return true;
}
async function exit(){
  if(!isOn())return;
  if(!admin()&&!(await askAdmin('Exit kiosk lock?')))return;
  enable(false);tst('Kiosk lock is off on this device','success');
}

/* ---------- on / off ---------- */
function apply(){
  var on=isOn();
  document.documentElement.classList.toggle('kiosk',on);
  if(on){trap();wake();}else{sleep();unlockKeys();}
  syncCover();
}
function enable(on){
  put(KEY,on?'1':null);
  log(on?'Kiosk lock turned ON on this device':'Kiosk lock turned OFF on this device');
  if(on)goFull();else{try{fsEl()&&(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}}
  apply();
}

/* ---------- install prompt (needed for App pinning of the app itself) ---------- */
var bip=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();bip=e});

/* ---------- Admin setup dialog ---------- */
async function setup(){
  if(!admin())return tst('Admin only','error');
  var on=isOn(),inst=standalone();
  var st=on?'<div class="st" style="background:#dcfce7;color:#166534">🔒 Kiosk lock is ON on this device</div>':'<div class="st" style="background:#f1f5f9;color:#334155">Kiosk lock is OFF on this device</div>';
  var html='<div class="ksk-g">'+st+
  '<p style="margin:.2rem 0 .4rem">On this device, Doctor and Reception logins stay inside the app: full screen, no Back, no other websites, no browser menus. Leaving the app is written to the clinic log. Admin login is never restricted.</p>'+
  '<label class="sw"><input type="checkbox" id="kOn" '+(on?'checked':'')+'> Lock this device to the clinic app</label>'+
  '<label class="sw"><input type="checkbox" id="kWk" '+(get(WKEY)!=='0'?'checked':'')+'> Keep the screen on while the app is open</label>'+
  '<p class="m" style="margin:.3rem 0 .5rem;font-size:.78rem">To exit later: Admin portal, or tap the clinic logo (or the 🔒 PIN title) <b>5 times quickly</b> → Admin PIN.</p>'+
  '<p style="margin:.6rem 0 .2rem"><b>Step 2: lock the Home and Recent-apps buttons on the device itself.</b> A website cannot block these, so turn this on once per device:</p>'+
  '<details '+(/android/i.test(navigator.userAgent)?'open':'')+'><summary>📱 Android phone / tablet (App pinning, free)</summary><ol>'+
    '<li>'+(inst?'✅ App is installed.':'Install the app: Chrome ⋮ → <b>Install app</b> (or Add to Home screen)'+(bip?' — or tap <b>Install now</b> below.':'.'))+'</li>'+
    '<li>Settings → <b>Security</b> (or Security &amp; privacy → More security settings) → <b>App pinning</b> / Pin app → <b>On</b>.</li>'+
    '<li>Turn on <b>Ask for PIN before unpinning</b>. Use a phone lock PIN that only you know (not a staff PIN).</li>'+
    '<li>Open the clinic app from its icon → open <b>Recent apps</b> → tap the app\'s icon at the top → <b>Pin</b>.</li>'+
    '<li>To unpin: hold <b>Back + Recent apps</b> (or swipe up and hold) → phone PIN.</li>'+
    '<li>Samsung: also Settings → Apps → choose the clinic app → <b>Notifications off</b>, so the notification shade cannot open other apps.</li></ol></details>'+
  '<details '+(/iphone|ipad|macintosh.*mobile/i.test(navigator.userAgent)?'open':'')+'><summary>🍎 iPhone / iPad (Guided Access, free)</summary><ol>'+
    '<li>Safari → Share → <b>Add to Home Screen</b>, open the app from that icon.</li>'+
    '<li>Settings → Accessibility → <b>Guided Access</b> → On → Passcode Settings → set a passcode only you know.</li>'+
    '<li>In the app, triple-click the side (or Home) button → <b>Start</b>.</li>'+
    '<li>To stop: triple-click → passcode → End.</li></ol></details>'+
  '<details '+(/windows/i.test(navigator.userAgent)?'open':'')+'><summary>💻 Windows laptop / PC</summary><ol>'+
    '<li><b>Windows Pro:</b> Settings → Accounts → Other users → <b>Set up a kiosk</b> → name it "Clinic" → choose <b>Microsoft Edge</b> → "As a public browser" → address: <code>'+location.href.split('#')[0].split('?')[0]+'</code>.</li>'+
    '<li><b>Windows Home:</b> make a <b>standard</b> (not admin) local account for staff. In that account, make a Chrome shortcut with Target ending in<br><code>--kiosk --kiosk-printing '+location.href.split('#')[0].split('?')[0]+'</code><br>and put it in the Startup folder (Win+R → <code>shell:startup</code>). Keep your own Windows password private.</li>'+
    '<li>The app also captures Esc, Alt+Tab and the Windows key while full screen (Chrome / Edge).</li></ol></details>'+
  '</div>';
  var r=await Swal.fire({title:'🔒 Kiosk lock',html:html,showCancelButton:true,confirmButtonText:'Save',
    showDenyButton:!!(bip&&!inst),denyButtonText:'Install now',
    preConfirm:function(){return{on:document.getElementById('kOn').checked,wk:document.getElementById('kWk').checked}}});
  if(r&&r.isDenied&&bip){try{bip.prompt();await bip.userChoice}catch(e){}bip=null;return setup()}
  if(!r||!r.isConfirmed||!r.value)return;
  put(WKEY,r.value.wk?null:'0');
  if(r.value.on!==on){
    if(r.value.on&&!(typeof S!=='undefined'&&S.sec&&(S.sec.doc||S.sec.rcp))){tst('Set a Doctor or Reception PIN first (Admin portal → Logins), so staff never use the Admin PIN.','warning')}
    enable(r.value.on);tst(r.value.on?'🔒 Kiosk lock ON. Now turn on App pinning (step 2).':'Kiosk lock OFF','success');
  }else{sleep();wake();tst('Saved','success')}
}

/* ---------- Admin portal button ---------- */
function addButton(){
  var g=document.querySelector('#set .grid');if(!g||document.getElementById('kskBtn'))return;
  var b=document.createElement('button');b.id='kskBtn';b.type='button';b.className='g';
  b.textContent='🔒 Kiosk lock (keep staff in the app)';b.onclick=setup;g.appendChild(b);
}

function boot(){mount();addButton();apply();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
addEventListener('scc-unlocked',function(){apply()});
// role changes (Admin ↔ staff): release or re-capture keys
setInterval(function(){if(!isOn())return;if(admin())unlockKeys();else if(fsEl())lockKeys();syncCover()},4000);

window.Kiosk={on:isOn,setup:setup,enable:enable,exit:exit,full:goFull};
})();
