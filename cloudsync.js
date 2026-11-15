// Cloud sync for Skin Care Clinic (optional, free Firebase Spark plan).
// Syncs only the live queue between devices: queue, token counter, current patient,
// auto-call and fees. PINs, passwords, lock state and the archive stay on each phone.
// Security: you must sign in with an approved clinic login. Database rules allow each
// login to read/write only scc/<its own uid>, and only if listed under /allowed.
(function(){
'use strict';
var CONF={apiKey:"AIzaSyBQ5qIkEjQdDP3JazszlSJRMuw_adKuM6o",authDomain:"clinic-kiosk-a23db.firebaseapp.com",databaseURL:"https://clinic-kiosk-a23db-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"clinic-kiosk-a23db",storageBucket:"clinic-kiosk-a23db.firebasestorage.app",messagingSenderId:"457246964853",appId:"1:457246964853:web:46ec9c2ae702108e884c3c"};
var V='8.10.1',BASE='https://www.gstatic.com/firebasejs/'+V+'/',PREF='SkinCareClinic_cloud';
var DEV=(function(){try{var d=localStorage.getItem(PREF+'_dev');if(!d){d=Math.random().toString(36).slice(2,10);localStorage.setItem(PREF+'_dev',d)}return d}catch(e){return Math.random().toString(36).slice(2,10)}})();
var C={ref:null,on:false,applying:false,rev:0,status:'off',email:''};
function pref(){try{return JSON.parse(localStorage.getItem(PREF)||'{}')}catch(e){return{}}}
function setPref(p){try{localStorage.setItem(PREF,JSON.stringify(p))}catch(e){}}
function chip(){
  var el=document.getElementById('cloudChip');
  if(!el){var h=document.querySelector('header .hd');if(!h)return;el=document.createElement('button');el.id='cloudChip';el.type='button';
    el.style.cssText='border:0;border-radius:99px;padding:.3rem .6rem;font-weight:800;font-size:.75rem;margin-right:.4rem;cursor:pointer;white-space:nowrap';
    el.onclick=menu;h.insertBefore(el,h.lastElementChild)}
  var m={off:['☁ Off','#e2e8f0','#475569'],wait:['☁ …','#fef3c7','#92400e'],on:['☁ Synced','#dcfce7','#166534'],err:['☁ Error','#fee2e2','#991b1b'],login:['☁ Sign in','#fef3c7','#92400e'],offline:['☁ Offline','#e2e8f0','#475569']}[C.status]||['☁','#e2e8f0','#475569'];
  el.textContent=m[0];el.style.background=m[1];el.style.color=m[2];
}
function set(s){C.status=s;chip()}
function load(src){return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
function libs(){if(window.firebase&&firebase.database&&firebase.auth)return Promise.resolve();return load(BASE+'firebase-app.js').then(function(){return Promise.all([load(BASE+'firebase-auth.js'),load(BASE+'firebase-database.js')])})}
function app(){return firebase.apps.length?firebase.app():firebase.initializeApp(CONF)}
function payload(){return{q:S.q,ctr:S.ctr,act:S.act||null,auto:!!S.auto,fees:S.fees,day:(typeof today==='function'?today():''),rev:++C.rev,updatedAt:Date.now(),by:DEV}}
function push(){if(!C.ref||C.applying)return;C.ref.set(JSON.parse(JSON.stringify(payload()))).catch(function(e){set('err');console.warn('cloud push',e)})}
function apply(v){
  C.applying=true;
  try{S.q=v.q||[];S.ctr=v.ctr||1;S.act=v.act||null;S.auto=!!v.auto;if(v.fees)S.fees=v.fees;C.rev=Math.max(C.rev,v.rev||0);
    origSave();typeof render==='function'&&render()}finally{C.applying=false}
}
function listen(uid){
  C.ref=firebase.database(app()).ref('scc/'+uid);
  var first=true;
  C.ref.on('value',function(snap){
    var v=snap.val();set('on');
    if(first){first=false;
      if(!v){push();return}
      // first connect: keep whichever side changed most recently
      if((v.updatedAt||0)>=(S.savedAt||0))apply(v);else push();return}
    if(!v||v.by===DEV&&v.rev===C.rev)return;
    if(v.by!==DEV)apply(v);
  },function(e){set('err');console.warn(e);if(String(e&&e.code||e).indexOf('PERMISSION_DENIED')>=0)Swal.fire({icon:'error',title:'Cloud access not approved',text:'This login is not on the clinic approved list. Ask the admin to approve it in Firebase.'})});
  firebase.database(app()).ref('.info/connected').on('value',function(s){if(C.ref)set(s.val()?'on':'offline')});
}
function start(){
  var p=pref();if(!p.on||!p.email){set('off');return Promise.resolve()}
  if(!navigator.onLine){set('offline')}
  set('wait');
  return libs().then(function(){app();return new Promise(function(ok){var off=firebase.auth().onAuthStateChanged(function(u){off();ok(u)})})})
   .then(function(u){if(!u||String(u.email).toLowerCase()!==p.email.toLowerCase()){set('login');return}C.email=u.email;listen(u.uid)})
   .catch(function(e){set(navigator.onLine?'err':'offline');console.warn('cloud start',e)});
}
function stop(){try{C.ref&&C.ref.off()}catch(e){}C.ref=null}
async function menu(){
  var p=pref();
  if(p.on&&C.status==='on'){
    var r=await Swal.fire({title:'Cloud sync is on',html:'Signed in as <b>'+(C.email||p.email)+'</b>.<br><small>The live queue is shared with your other signed-in devices.</small>',showDenyButton:true,confirmButtonText:'OK',denyButtonText:'Sign out'});
    if(r.isDenied){stop();try{await firebase.auth().signOut()}catch(e){}setPref({on:false,email:p.email});set('off');toast('Cloud sync turned off')}
    return}
  var f=await Swal.fire({title:'Cloud sync',html:'<p style="font-size:.85rem;text-align:left">Share the live queue between reception, doctor and other phones. Needs internet. Use the clinic cloud login (not your PIN).</p><input id="ce" class="swal2-input" type="email" placeholder="Clinic login email" value="'+(p.email||'')+'"><input id="cp" class="swal2-input" type="password" placeholder="Cloud password" autocomplete="current-password">',
    showCancelButton:true,confirmButtonText:'Sign in & sync',preConfirm:function(){var e=document.getElementById('ce').value.trim(),w=document.getElementById('cp').value;if(!e||!w){Swal.showValidationMessage('Enter email and password');return false}return{e:e,w:w}}});
  if(!f.isConfirmed)return;
  set('wait');
  try{await libs();app();await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);await firebase.auth().signInWithEmailAndPassword(f.value.e,f.value.w);
    setPref({on:true,email:f.value.e});stop();await start();toast('Cloud sync on')}
  catch(e){set('err');Swal.fire({icon:'error',title:'Sign-in failed',text:(e&&e.code)||String(e)})}
}
// hook the app's save(): every local change is pushed to the cloud
var origSave=window.save;
window.save=function(){origSave.apply(this,arguments);push()};
addEventListener('online',function(){if(pref().on&&!C.ref)start()});
addEventListener('offline',function(){if(C.ref)set('offline')});
window.CloudSync={menu:menu,start:start,status:function(){return C.status}};
chip();start();
})();
