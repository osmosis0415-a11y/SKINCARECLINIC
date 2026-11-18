// Safe refresh: brings in the latest data and app updates WITHOUT reloading the
// page, so an open prescription, dialog, search or screen is never lost.
// - ⟳ button in the header (all devices; most useful on the doctor's laptop)
// - F5 / Ctrl+R / Cmd+R on a keyboard do the same safe refresh
//   (Ctrl+Shift+R still does a full browser reload)
// - A new app version is installed only when nothing is half-done; the app then
//   reopens on the same screen with the same search and scroll position.
// - Closing or reloading the tab with an unsaved prescription asks first.
(function(){
'use strict';
var KEY='scc_restore',busyWait=null,lastSoft=0;
function $(id){return document.getElementById(id)}
function vis(e){return !!(e&&e.offsetParent)}
function rxOpen(){return vis($('rxpRoot'))||vis($('rxpQuick'))||vis($('rxpSetRoot'))||!!(window.RxDock&&RxDock.dirty())}
function rxDirty(){
  if(window.RxDock&&RxDock.dirty())return true;
  var r=$('rxpRoot');if(!vis(r))return false;
  var ids=['rxCC','rxDx','rxAd','rxIn','rxAl'];
  for(var i=0;i<ids.length;i++){var e=r.querySelector('#'+ids[i]);if(e&&String(e.value||'').trim())return true}
  return false}
function dialogOpen(){var d=document.querySelectorAll('.sw-pop');for(var i=0;i<d.length;i++)if(vis(d[i]))return true;return false}
function busy(){return rxOpen()||dialogOpen()}
function say(t,i){try{toast(t,i||'success')}catch(e){}}

// --- pull fresh data without a reload ---
function cloudKick(){
  try{if(window.firebase&&firebase.apps&&firebase.apps.length){var db=firebase.database(firebase.app());db.goOffline();setTimeout(function(){db.goOnline()},400);return true}}catch(e){}
  return false}
function waitingWorker(){
  if(!('serviceWorker'in navigator))return Promise.resolve(null);
  return navigator.serviceWorker.getRegistration().then(function(rg){
    if(!rg)return null;
    return rg.update().catch(function(){}).then(function(){
      if(rg.waiting)return rg.waiting;
      if(!rg.installing)return null;
      return new Promise(function(ok){var w=rg.installing,t=setTimeout(function(){ok(rg.waiting||null)},8000);
        w.addEventListener('statechange',function(){if(w.state==='installed'){clearTimeout(t);ok(w)}})})})}).catch(function(){return null})}

function soft(){
  if(Date.now()-lastSoft<1500)return;lastSoft=Date.now();
  var b=$('srb');if(b){b.classList.add('spin');setTimeout(function(){b.classList.remove('spin')},900)}
  try{if(typeof commit==='function')commit()}catch(e){}
  try{A.dayRoll()}catch(e){}
  try{render()}catch(e){}
  var cloud=cloudKick();
  if(!navigator.onLine){say('Refreshed on this device. No internet, so new data from other phones will come when it is back.','info');return}
  waitingWorker().then(function(w){
    if(w)return applyUpdate();
    say('Refreshed'+(cloud?' · latest queue loaded':'')+' · '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}))})}

// --- install an app update only at a safe moment, then come back to the same place ---
function remember(){
  try{var s=document.querySelector('section.on');
    sessionStorage.setItem(KEY,JSON.stringify({t:Date.now(),tab:s?s.id:'rec',q:($('srch')||{}).value||'',y:scrollY}))}catch(e){}}
function applyUpdate(){
  if(busy()){
    say(rxOpen()?'New app version ready. It will install after you finish this prescription.':'New app version ready. It will install when this window is closed.','info');
    if(!busyWait)busyWait=setInterval(function(){if(!busy()){clearInterval(busyWait);busyWait=null;applyUpdate()}},5000);
    return}
  remember();
  navigator.serviceWorker.getRegistration().then(function(rg){
    var w=rg&&rg.waiting;var go=function(){location.reload()};
    if(!w)return go();
    navigator.serviceWorker.addEventListener('controllerchange',go,{once:true});
    try{w.postMessage('skip')}catch(e){go()}setTimeout(go,3000)}).catch(function(){location.reload()})}

function restore(){
  var r;try{r=JSON.parse(sessionStorage.getItem(KEY)||'null');sessionStorage.removeItem(KEY)}catch(e){}
  if(!r||Date.now()-r.t>120000)return;
  setTimeout(function(){
    try{if(r.tab&&r.tab!=='rec'&&r.tab!=='set'&&r.tab!=='fin'&&typeof ROLE!=='undefined'&&ROLE)A.go(r.tab)}catch(e){}
    try{if(r.q&&$('srch')){$('srch').value=r.q;render()}}catch(e){}
    try{scrollTo(0,r.y||0)}catch(e){}
    say('App updated · you are back where you were')},600)}

// --- keyboard: F5 / Ctrl+R / Cmd+R become the safe refresh ---
addEventListener('keydown',function(e){
  var k=e.key,r=(k==='r'||k==='R')&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey;
  if((k==='F5'&&!e.ctrlKey&&!e.shiftKey)||r){e.preventDefault();e.stopPropagation();soft()}},true);

// --- browser reload button / closing the tab with an unsaved prescription ---
addEventListener('beforeunload',function(e){if(rxDirty()&&!sessionStorage.getItem(KEY)){e.preventDefault();e.returnValue='';return ''}});

// --- header button ---
function addButton(){
  if($('srb'))return;var m=document.querySelector('header .hd button[onclick="A.menu(1)"]');if(!m)return;
  var b=document.createElement('button');b.id='srb';b.className='ib';b.type='button';
  b.title='Refresh (F5) · keeps your work';b.setAttribute('aria-label','Refresh: get latest queue and updates, keeps your work');
  b.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
  b.onclick=soft;m.parentNode.insertBefore(b,m)}
var st=document.createElement('style');
st.textContent='#srb svg{transition:transform .8s}#srb.spin svg{transform:rotate(360deg)}';
document.head.appendChild(st);

window.SafeRefresh={soft:soft,applyUpdate:applyUpdate,busy:busy,rxDirty:rxDirty};
function boot(){addButton();restore()}
if(window.SCC_BOOTED)boot();else addEventListener('scc-boot',boot,{once:true});
if(document.readyState!=='loading')addButton();else document.addEventListener('DOMContentLoaded',addButton);
})();
