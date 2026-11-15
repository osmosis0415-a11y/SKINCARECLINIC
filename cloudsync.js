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
  var m={off:['☁ Off','#e2e8f0','#475569'],wait:['☁ …','#fef3c7','#92400e'],on:['☁ Synced','#dcfce7','#166534'],err:['☁ Error','#fee2e2','#991b1b'],paused:['☁ Paused','#fef3c7','#92400e'],login:['☁ Sign in','#fef3c7','#92400e'],offline:['☁ Offline','#e2e8f0','#475569']}[C.status]||['☁','#e2e8f0','#475569'];
  el.textContent=m[0];el.style.background=m[1];el.style.color=m[2];
}
function set(s){C.status=s;chip()}
function load(src){return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
function libs(){if(window.firebase&&firebase.database&&firebase.auth)return Promise.resolve();return load(BASE+'firebase-app.js').then(function(){return Promise.all([load(BASE+'firebase-auth.js'),load(BASE+'firebase-database.js')])})}
function app(){return firebase.apps.length?firebase.app():firebase.initializeApp(CONF)}
function payload(){return{wipeAt:S.wipeAt||0,q:S.q,ctr:S.ctr,act:S.act||null,auto:!!S.auto,fees:S.fees,day:(typeof today==='function'?today():''),rev:++C.rev,updatedAt:Date.now(),by:DEV}}
function pub(){
  // Public, name-free summary for the patient status page (token numbers only)
  var q=S.q||[],a=q.find(function(p){return p.id===S.act}),tk=function(p){return p.tokenNo};
  var c=q.filter(function(p){return p.status==='Completed'&&p.calledAtTimestamp&&p.completedAtTimestamp}).slice(-10)
         .map(function(p){return (p.completedAtTimestamp-p.calledAtTimestamp)/60000}).filter(function(m){return m>0.3&&m<60});
  return{clinic:S.cfg&&S.cfg.name||'Clinic',day:(typeof today==='function'?today():''),serving:a?a.tokenNo:null,
    waiting:q.filter(function(p){return p.status==='Waiting'}).map(tk),done:q.filter(function(p){return p.status==='Completed'}).map(tk),
    noshow:q.filter(function(p){return p.status==='No-Show'}).map(tk),avgMin:c.length>=3?Math.round(c.reduce(function(x,y){return x+y},0)/c.length*10)/10:7,updatedAt:Date.now()}}
// ---- usage meter: counts what THIS phone sends/receives each month (free plan: 10 GB/month download for the whole project)
var CAP=1.5e9; // this phone pauses sync at 1.5 GB downloaded in a month (15% of the whole free allowance)
function U(){var m=new Date().toISOString().slice(0,7),u;try{u=JSON.parse(localStorage.getItem(PREF+'_use')||'{}')}catch(e){u={}}if(u.m!==m)u={m:m,up:0,down:0,w:0,paused:false};return u}
function saveU(u){try{localStorage.setItem(PREF+'_use',JSON.stringify(u))}catch(e){}}
function count(k,bytes){var u=U();u[k]+=bytes;if(k==='up')u.w++;if(!u.paused&&u.down>=CAP){u.paused=true;saveU(u);stop();set('paused');Swal.fire({icon:'warning',title:'Cloud sync paused',text:'This phone has used a lot of cloud data this month. Sync is paused so the clinic stays inside the free plan. The app keeps working offline on this phone. It resumes automatically next month, or Admin can resume it from the ☁ menu.'});return}saveU(u)}
function fmt(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':b<1073741824?(b/1048576).toFixed(1)+' MB':(b/1073741824).toFixed(2)+' GB'}
// ---- only send when something actually changed, and at most once every 0.8 s
var lastBody='',lastPub='',tmr=null;
function push(){if(!C.ref||C.applying)return;clearTimeout(tmr);tmr=setTimeout(doPush,800)}
function doPush(){if(!C.ref||C.applying)return;
  var p=payload(),body=JSON.stringify([p.q,p.ctr,p.act,p.auto,p.fees,p.day]);
  if(body!==lastBody){lastBody=body;var j=JSON.stringify(p);count('up',j.length);C.ref.set(JSON.parse(j)).catch(function(e){set('err');console.warn('cloud push',e)})}else C.rev--;
  if(C.pub){var b=pub(),k=JSON.stringify([b.clinic,b.day,b.serving,b.waiting,b.done,b.noshow,b.avgMin]);if(k!==lastPub){lastPub=k;var t=JSON.stringify(b);count('up',t.length);C.pub.set(JSON.parse(t)).catch(function(e){console.warn('pub',e)})}}}
function statusUrl(){return new URL('status.html?c='+C.uid,location.href).href}
function poster(){
  var u=statusUrl(),w=window.open('','_blank');if(!w){Swal.fire({icon:'info',title:'Patient status link',html:'<code style="word-break:break-all">'+u+'</code>'});return}
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Token status QR</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:30px}h1{font-size:34px;margin:0}p{font-size:22px;margin:10px 0}#q{display:inline-block;margin:24px 0}code{font-size:12px;word-break:break-all;color:#555}@media print{button{display:none}}</style></head><body>'
   +'<h1>'+(S.cfg&&S.cfg.name||'Clinic')+'</h1><p><b>Know your turn on your phone</b></p><p>మీ వంతు మీ ఫోన్‌లో చూడండి</p><div id="q"></div><p>1. Scan this QR &nbsp; 2. Type your token number (e.g. 12)</p><p>QR స్కాన్ చేసి, మీ టోకెన్ నంబర్ నమోదు చేయండి</p><p><code>'+u+'</code></p><button onclick="print()" style="font-size:20px;padding:12px 24px">Print poster</button>'
   +'<script src="'+new URL('vendor/qrcode.min.js',location.href).href+'"><\/script><script>new QRCode(document.getElementById("q"),{text:'+JSON.stringify(u)+',width:320,height:320});<\/script></body></html>');
  w.document.close();
}
function apply(v){
  if((v.wipeAt||0)>(S.wipeAt||0)&&window.A&&A.wipeLocal){A.wipeLocal(v.wipeAt);origSave();try{Swal.fire({icon:'info',title:'Clinic data was cleared',text:'Admin started fresh on another phone. Old patient records on this phone were removed.',timer:3500,showConfirmButton:false})}catch(e){}setTimeout(function(){location.reload()},3600)}
  lastBody=JSON.stringify([v.q||[],v.ctr||1,v.act||null,!!v.auto,v.fees||S.fees,v.day||'']);C.applying=true;
  try{S.q=v.q||[];S.ctr=v.ctr||1;S.act=v.act||null;S.auto=!!v.auto;if(v.fees)S.fees=v.fees;C.rev=Math.max(C.rev,v.rev||0);
    origSave();typeof render==='function'&&render()}finally{C.applying=false}
}
function listen(uid){
  C.uid=uid;C.ref=firebase.database(app()).ref('scc/'+uid);C.pub=firebase.database(app()).ref('pub/'+uid);
  var first=true;
  C.ref.on('value',function(snap){
    var v=snap.val();set('on');try{count('down',JSON.stringify(v||'').length+120)}catch(e){}if(!C.ref)return;
    if(first){first=false;
      if(!v){push();return}
      // first connect: keep whichever side changed most recently
      if((v.wipeAt||0)>(S.wipeAt||0)||(v.updatedAt||0)>=(S.savedAt||0))apply(v);else if((S.wipeAt||0)>=(v.wipeAt||0))push();return}
    if(!v||v.by===DEV&&v.rev===C.rev)return;
    if(v.by!==DEV)apply(v);
  },function(e){set('err');console.warn(e);if(String(e&&e.code||e).indexOf('PERMISSION_DENIED')>=0)Swal.fire({icon:'error',title:'Cloud access not approved',text:'This login is not on the clinic approved list. Ask the admin to approve it in Firebase.'})});
  firebase.database(app()).ref('.info/connected').on('value',function(s){if(C.ref)set(s.val()?'on':'offline')});
}
function start(){
  var p=pref();if(!p.on||!p.email){set('off');return Promise.resolve()}
  if(U().paused){set('paused');return Promise.resolve()}
  if(!navigator.onLine){set('offline')}
  set('wait');
  return libs().then(function(){app();return new Promise(function(ok){var off=firebase.auth().onAuthStateChanged(function(u){off();ok(u)})})})
   .then(function(u){if(!u||String(u.email).toLowerCase()!==p.email.toLowerCase()){set('login');return}C.email=u.email;
     // per-device logins: /allowed/<login uid> = clinic id (legacy true = own uid)
     return firebase.database(app()).ref('allowed/'+u.uid).once('value').then(function(s){var a=s.val();
       if(typeof a==='string'&&a)listen(a);else if(a===true)listen(u.uid);
       else{set('err');Swal.fire({icon:'error',title:'Cloud access not approved',text:'This login is not approved for a clinic yet. Ask the admin to approve it in Firebase.'})}})})
   .catch(function(e){set(navigator.onLine?'err':'offline');console.warn('cloud start',e)});
}
function stop(){try{C.ref&&C.ref.off()}catch(e){}C.ref=null;C.pub=null}
function usageHtml(){var u=U(),pc=Math.min(100,u.down/CAP*100);
  return '<div style="text-align:left;background:#f1f5f9;border-radius:.8rem;padding:.6rem .8rem;margin-top:.8rem;font-size:.8rem"><b>📊 Cloud data used by this phone ('+u.m+')</b><br>Received: <b>'+fmt(u.down)+'</b> &nbsp; Sent: <b>'+fmt(u.up)+'</b> ('+u.w+' updates)'
   +'<div style="height:8px;background:#e2e8f0;border-radius:4px;margin:.4rem 0"><div style="height:8px;width:'+Math.max(1,pc).toFixed(1)+'%;background:'+(pc>80?'#dc2626':pc>50?'#d97706':'#16a34a')+';border-radius:4px"></div></div>'
   +pc.toFixed(1)+'% of this phone\'s safety limit ('+fmt(CAP)+'). Sync pauses by itself at the limit.<br>Plan: <b>Spark (free)</b>. Google cannot charge this project.</div>'}
async function menu(){
  var p=pref();
  if(U().paused){var q=await Swal.fire({icon:'warning',title:'Cloud sync paused',html:'This phone reached its monthly cloud safety limit, so sync is paused to stay free.'+usageHtml(),showCancelButton:true,confirmButtonText:'Resume anyway (Admin)',cancelButtonText:'Keep paused'});
    if(q.isConfirmed){if(typeof ROLE!=='undefined'&&ROLE!=='adm'){toast('Only Admin can resume','warning');return}var u=U();u.paused=false;u.down=0;saveU(u);await start();toast('Cloud sync resumed')}return}
  if(p.on&&C.status==='on'){
    var r=await Swal.fire({title:'Cloud sync is on',html:'Signed in as <b>'+(C.email||p.email)+'</b>.<br><small>The live queue is shared with your other signed-in devices.</small><br><br><small>Patients can check their turn here (token numbers only, no names):</small><br><code style="font-size:.7rem;word-break:break-all">'+statusUrl()+'</code>'+usageHtml(),showDenyButton:true,showCancelButton:true,confirmButtonText:'📱 Patient status QR poster',denyButtonText:'Sign out',cancelButtonText:'Close'});
    if(r.isConfirmed){poster();return}
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
addEventListener('online',function(){if(pref().on&&!C.ref&&window.SCC_READY!==false)start()});
addEventListener('offline',function(){if(C.ref)set('offline')});
window.CloudSync={menu:menu,start:start,status:function(){return C.status},usage:U};
function go(){if(window.SCC_READY===false){set('off');addEventListener('scc-unlocked',function(){start()},{once:true})}else start()}
chip();if(window.SCC_BOOTED)go();else addEventListener('scc-boot',go,{once:true});
})();
