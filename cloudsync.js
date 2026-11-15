// Cloud sync for Skin Care Clinic (optional, free Firebase Spark plan).
// Syncs only the live queue between devices: queue, token counter, current patient,
// auto-call and fees. PINs, passwords, lock state and the archive stay on each phone.
// Security: you must sign in with an approved clinic login. Database rules allow each
// login to read/write only scc/<its own uid>, and only if listed under /allowed.
(function(){
'use strict';
var DEF_CONF={apiKey:"AIzaSyBQ5qIkEjQdDP3JazszlSJRMuw_adKuM6o",authDomain:"clinic-kiosk-a23db.firebaseapp.com",databaseURL:"https://clinic-kiosk-a23db-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"clinic-kiosk-a23db",storageBucket:"clinic-kiosk-a23db.firebasestorage.app",messagingSenderId:"457246964853",appId:"1:457246964853:web:46ec9c2ae702108e884c3c"};
// Each clinic can use its own free Firebase project. The connection is stored per phone ('scc_cloud_conf');
// without it the phone uses the Skin Care Clinic project above.
function confOk(c){return c&&c.apiKey&&/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebasedatabase\.app|firebaseio\.com)$/.test(String(c.databaseURL||'').replace(/\/$/,''))}
var CONF=(function(){try{var c=JSON.parse(localStorage.getItem('scc_cloud_conf')||'null');if(confOk(c))return c}catch(e){}return DEF_CONF})();
function b64u(t){return btoa(unescape(encodeURIComponent(t))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function ub64u(t){t=t.replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';return decodeURIComponent(escape(atob(t)))}
function codeOf(c){return b64u(JSON.stringify({a:c.apiKey,d:c.authDomain,u:String(c.databaseURL).replace(/\/$/,''),p:c.projectId,i:c.appId,m:c.messagingSenderId||'',s:c.storageBucket||''}))}
function parseConf(txt){txt=String(txt||'').trim();if(!txt)throw new Error('Empty');var m=txt.match(/[?&]cloud=([A-Za-z0-9_-]+)/);if(m)txt=m[1];
  var c=null;if(/^[A-Za-z0-9_-]{40,}$/.test(txt)){var o=JSON.parse(ub64u(txt));c={apiKey:o.a,authDomain:o.d,databaseURL:o.u,projectId:o.p,appId:o.i,messagingSenderId:o.m,storageBucket:o.s}}
  else{var g=function(k){var r=txt.match(new RegExp(k+'["\']?\\s*:\\s*["\']([^"\']+)["\']'));return r?r[1]:''};c={apiKey:g('apiKey'),authDomain:g('authDomain'),databaseURL:g('databaseURL'),projectId:g('projectId'),appId:g('appId'),messagingSenderId:g('messagingSenderId'),storageBucket:g('storageBucket')}}
  c.databaseURL=String(c.databaseURL||'').replace(/\/$/,'');if(!confOk(c))throw new Error('This is not a valid clinic cloud code or Firebase config (it needs apiKey and databaseURL).');return c}
function isDefault(){return CONF.projectId===DEF_CONF.projectId&&CONF.databaseURL===DEF_CONF.databaseURL}
function setConf(c){try{if(c)localStorage.setItem('scc_cloud_conf',JSON.stringify(c));else localStorage.removeItem('scc_cloud_conf');localStorage.setItem(PREF,JSON.stringify({on:false,email:''}))}catch(e){}
  try{if(window.firebase&&firebase.apps&&firebase.apps.length){location.reload();return true}}catch(e){}CONF=c||DEF_CONF;return false}
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
// The queue is stored as one child per patient (scc/<clinic>/q/<id>) so each tap sends and receives only the
// patient that changed, not the whole day's list.
function canon(v){if(Array.isArray(v))return '['+v.map(canon).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().filter(function(k){return v[k]!==undefined}).map(function(k){return JSON.stringify(k)+':'+canon(v[k])}).join(',')+'}';return JSON.stringify(v===undefined?null:v)}
function qKey(p){return String(p.id).replace(/[.#$\[\]\/]/g,'_')}
var lastQ={},lastScal='',qFull=true;
function scal(){return{wipeAt:S.wipeAt||0,ctr:S.ctr,act:S.act||null,auto:!!S.auto,fees:S.fees,day:(typeof today==='function'?today():'')}}
function payload(){var x=scal();x.rev=++C.rev;x.updatedAt=Date.now();x.by=DEV;return x}
function qDiff(){var upd={},cur={},n=0;(S.q||[]).forEach(function(p,i){var k=qKey(p),o=JSON.parse(JSON.stringify(p));o.o=i;var j=canon(o);cur[k]=j;if(lastQ[k]!==j){upd['q/'+k]=o;n++}});Object.keys(lastQ).forEach(function(k){if(!cur[k]){upd['q/'+k]=null;n++}});return{upd:upd,cur:cur,n:n}}
function qIn(q){var arr=Array.isArray(q)?q:Object.keys(q||{}).map(function(k){return q[k]}).sort(function(a,b){return(a.o||0)-(b.o||0)});var m={},bytes=0;
  if(!Array.isArray(q))Object.keys(q||{}).forEach(function(k){var j=canon(q[k]);if(lastQ[k]!==j)bytes+=j.length;m[k]=j});
  return{arr:arr.map(function(p){var c=Object.assign({},p);delete c.o;return c}),map:m,legacy:Array.isArray(q)||!q,bytes:bytes}}
function pub(){
  // Public, name-free summary for the patient status page (token numbers only)
  var q=S.q||[],a=q.find(function(p){return p.id===S.act}),tk=function(p){var n=parseInt(String(p.tokenNo).replace(/\D/g,''),10);return isNaN(n)?p.tokenNo:n};
  var c=q.filter(function(p){return p.status==='Completed'&&p.calledAtTimestamp&&p.completedAtTimestamp}).slice(-10)
         .map(function(p){return (p.completedAtTimestamp-p.calledAtTimestamp)/60000}).filter(function(m){return m>0.3&&m<60});
  return{clinic:S.cfg&&S.cfg.name||'Clinic',day:(typeof today==='function'?today():''),serving:a?tk(a):null,
    waiting:q.filter(function(p){return p.status==='Waiting'}).map(tk),done:q.filter(function(p){return p.status==='Completed'}).map(tk),
    noshow:q.filter(function(p){return p.status==='No-Show'}).map(tk),avgMin:c.length>=3?Math.round(c.reduce(function(x,y){return x+y},0)/c.length*10)/10:7,updatedAt:Date.now()}}
// ---- usage meter: counts what THIS phone sends/receives each month (free plan: 10 GB/month download for the whole project)
var CAP=1.5e9; // this phone pauses sync at 1.5 GB downloaded in a month (15% of the whole free allowance)
function U(){var m=new Date().toISOString().slice(0,7),u;try{u=JSON.parse(localStorage.getItem(PREF+'_use')||'{}')}catch(e){u={}}if(u.m!==m)u={m:m,up:0,down:0,w:0,paused:false};return u}
function saveU(u){try{localStorage.setItem(PREF+'_use',JSON.stringify(u))}catch(e){}}
function count(k,bytes){var u=U();u[k]+=bytes;if(k==='up')u.w++;if(!u.paused&&u.down>=CAP){u.paused=true;saveU(u);stop();set('paused');Swal.fire({icon:'warning',title:'Cloud sync paused',text:'This phone has used a lot of cloud data this month. Sync is paused so the clinic stays inside the free plan. The app keeps working offline on this phone. It resumes automatically next month, or Admin can resume it from the ☁ menu.'});return}saveU(u)}
function fmt(b){return b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':b<1073741824?(b/1048576).toFixed(1)+' MB':(b/1073741824).toFixed(2)+' GB'}
// ---- only send when something actually changed, and at most once every 0.8 s
var lastPub='',tmr=null;
function push(){if(!C.ref||C.applying)return;clearTimeout(tmr);tmr=setTimeout(doPush,800)}
// ---- shared clinic logins: PIN/password hashes + wrapped data key live at scc/<clinic>/keys (signed-in clinic logins only)
var lastKeySig=null,keyState='unknown'; // unknown | empty | ok | foreign (cloud has another phone's logins: never overwrite automatically)
function keySig(){return JSON.stringify([S.sec||null,S.vault&&S.vault.w||null,S.vault&&S.vault.kid||null])}
function pushKeys(){if(!C.ref||!S.vault||!S.sec||!CR.key)return;keyState='ok';setTimeout(rxStart,0);if(!S.vault.kid){S.vault.kid=Math.random().toString(36).slice(2,12)}if(!S.keysAt)S.keysAt=Date.now();
  var k={kid:S.vault.kid,at:S.keysAt,sec:S.sec,w:S.vault.w,by:DEV},pl=payload();pl.keys=k;lastKeySig=keySig();origSave();lastScal='';
  // sent together with the queue fields so the database rules (which require day/rev/updatedAt) accept it
  var j=JSON.stringify(pl);count('up',j.length);C.ref.update(JSON.parse(j)).catch(function(e){console.warn('keys',e);keyState='empty';lastKeySig=null})}
function keysIn(k){
  if(!k){keyState='empty';if(S.vault&&CR.key)pushKeys();return}
  if(S.vault&&S.vault.kid&&k.kid===S.vault.kid){keyState='ok';setTimeout(rxStart,0);
    if((k.at||0)>(S.keysAt||0)){S.sec=k.sec;S.vault.w=k.w;S.keysAt=k.at;lastKeySig=keySig();origSave();typeof render==='function'&&render();if(k.by!==DEV)toast('Clinic logins updated')}
    else if((k.at||0)<(S.keysAt||0))pushKeys();else lastKeySig=keySig();
    return}
  keyState='foreign';
  // only ask once this phone has its own logins and someone is logged in (a brand-new phone uses 'Join my clinic' instead)
  if(S.sec&&typeof ROLE!=='undefined'&&ROLE&&window.A&&A.adoptKeys)A.adoptKeys(k);
}
// ---- prescriptions: each one stored end-to-end encrypted at rxs/<clinic>/r/<id> (only clinic phones hold the key);
// the last 45 days are kept in the cloud, everything stays on the phones and the hard-disk backups.
var RXWIN=45*864e5,rxOn=false,rxQ=null;
function rxRef(){return C.uid?firebase.database(app()).ref('rxs/'+C.uid):null}
function rxPut(rec){var r=rxRef();if(!r||keyState!=='ok'||!CR.key||!rec||!rec.id)return;
  CR.enc(JSON.stringify(rec)).then(function(e){var o={ts:rec.ts||Date.now(),i:e.i,c:e.c};count('up',JSON.stringify(o).length);return r.child('r/'+rec.id).set(o)}).catch(function(e){console.warn('rx put',e)})}
function metaPut(){var r=rxRef();if(!r||keyState!=='ok')return;var m={at:S.rxMetaAt||Date.now(),sets:S.rxSets||{},cfg:S.rxCfg||null,formulary:S.formulary||[],formOnly:!!S.formOnly,clinic:(function(){var c=S.cfg||{},o={};['name','doc','addr','phone','teHeader','timings','waitText','lateText'].forEach(function(k){if(c[k]!==undefined)o[k]=c[k]});return o})()};var j=JSON.stringify(m);count('up',j.length);r.child('meta').set(JSON.parse(j)).catch(function(e){console.warn('meta',e)})}
// ---- clinic devices (for 'lost phone') and the encrypted audit log, both under rxs/<clinic>
function devName(){try{return localStorage.getItem('scc_device_name')||''}catch(e){return''}}
function devBeat(){var r=rxRef();if(!r||keyState!=='ok')return;var u=navigator.userAgent,os=/Android/.test(u)?'Android':/iPhone|iPad/.test(u)?'iPhone/iPad':/Windows/.test(u)?'Windows PC':/Mac/.test(u)?'Mac':'Device';
  r.child('dev/'+DEV).update({name:devName()||(os+' '+DEV.slice(0,4)),os:os,seen:Date.now(),mode:(function(){try{return localStorage.getItem('scc_device_role')||'any'}catch(e){return'any'}})()}).catch(function(){})}
var LOGQ=[];
function logKey(t){return String(t).padStart(13,'0')+'_'+DEV.slice(0,4)+Math.random().toString(36).slice(2,5)}
function logPut(e){LOGQ.push(e);logFlush()}
function logFlush(){var r=rxRef();if(!r||keyState!=='ok'||!CR.key||!LOGQ.length)return;var q=LOGQ.splice(0);
  q.forEach(function(e){CR.enc(JSON.stringify(e)).then(function(x){count('up',120);return r.child('log/'+logKey(e.t)).set({i:x.i,c:x.c})}).catch(function(){LOGQ.push(e)})})}
async function logFetch(days){var r=rxRef();if(!r||!CR.key)throw new Error('Cloud sync is off on this phone.');var s=await r.child('log').orderByKey().startAt(String(Date.now()-days*864e5).padStart(13,'0')).once('value');
  var v=s.val()||{},out=[];count('down',JSON.stringify(v).length);for(var k of Object.keys(v)){try{out.push(JSON.parse(await CR.dec(v[k])))}catch(e){}}return out.sort(function(a,b){return b.t-a.t})}
async function devices(){var r=rxRef();if(!r)throw new Error('Cloud sync is off on this phone.');var v=(await r.child('dev').once('value')).val()||{};return Object.keys(v).map(function(k){return Object.assign({id:k,me:k===DEV},v[k])}).sort(function(a,b){return(b.seen||0)-(a.seen||0)})}
function revoke(id,on){var r=rxRef();return r.child('dev/'+id).update(on?{revoked:true,revokedAt:Date.now()}:{revoked:null,revokedAt:null})}
function devRemove(id){return rxRef().child('dev/'+id).remove()}
function rxStart(){if(rxOn||keyState!=='ok'||!CR.key)return;var r=rxRef();if(!r)return;rxOn=true;var t0=Date.now()-RXWIN;
  devBeat();logFlush();
  r.child('dev/'+DEV+'/revoked').on('value',function(x){if(x.val()===true&&window.A&&A.selfWipe)A.selfWipe()});
  r.child('meta').on('value',function(s){var m=s.val();count('down',JSON.stringify(m||'').length);if(!m){if(S.rxSets||S.rxCfg||S.formulary)metaPut();return}if(window.A&&A.metaIn)A.metaIn(m)});
  var q=rxQ=r.child('r').orderByChild('ts').startAt(t0);
  q.once('value').then(function(s){var have={},v=s.val()||{};Object.keys(v).forEach(function(k){have[k]=v[k].ts||0});count('down',JSON.stringify(v).length);
    (typeof RXREC!=='undefined'?RXREC:[]).forEach(function(x){if((x.ts||0)>=t0&&(!have[x.id]||have[x.id]<x.ts))rxPut(x)});
    var on=function(c){var o=c.val();if(o&&window.A&&A.rxIn)A.rxIn(c.key,o)};q.on('child_added',on);q.on('child_changed',on);
    if(typeof ROLE!=='undefined'&&ROLE==='adm'){r.child('r').orderByChild('ts').endAt(Date.now()-60*864e5).once('value').then(function(o){o.forEach(function(c){c.ref.remove()})}).catch(function(){});
      r.child('log').orderByKey().endAt(String(Date.now()-400*864e5).padStart(13,'0')).once('value').then(function(o){o.forEach(function(c){c.ref.remove()})}).catch(function(){})}})
   .catch(function(e){rxOn=false;console.warn('rx sync',e)})}
function doPush(){if(!C.ref||C.applying)return;
  if((keyState==='ok'||keyState==='empty')&&S.vault&&CR.key&&keySig()!==lastKeySig){S.keysAt=Date.now();pushKeys()}
  var d=qDiff(),sc=canon(scal());
  if(d.n||sc!==lastScal||qFull){var p=payload();if(qFull){var all={};(S.q||[]).forEach(function(x,i){var o=JSON.parse(JSON.stringify(x));o.o=i;all[qKey(x)]=o});p.q=all}else Object.assign(p,d.upd);
    lastScal=sc;lastQ=d.cur;qFull=false;var j=JSON.stringify(p);count('up',j.length);C.ref.update(JSON.parse(j)).catch(function(e){set('err');lastScal='';qFull=true;console.warn('cloud push',e)})}
  if(C.pub){var b=pub(),k=JSON.stringify([b.clinic,b.day,b.serving,b.waiting,b.done,b.noshow,b.avgMin]);if(k!==lastPub){lastPub=k;var t=JSON.stringify(b);count('up',t.length);C.pub.set(JSON.parse(t)).catch(function(e){console.warn('pub',e)})}}}
function statusUrl(tok,cd){return new URL('status.html?c='+C.uid+(isDefault()?'':'&d='+encodeURIComponent(CONF.databaseURL.replace(/^https:\/\//,'')))+(tok?'&t='+encodeURIComponent(tok):'')+(cd?'&cd='+cd:''),location.href).href}
function poster(){
  var u=statusUrl(),w=window.open('','_blank');if(!w){Swal.fire({icon:'info',title:'Patient status link',html:'<code style="word-break:break-all">'+u+'</code>'});return}
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Token status QR</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:30px}h1{font-size:34px;margin:0}p{font-size:22px;margin:10px 0}#q{display:inline-block;margin:24px 0}code{font-size:12px;word-break:break-all;color:#555}@media print{button{display:none}}</style></head><body>'
   +'<h1>'+(S.cfg&&S.cfg.name||'Clinic')+'</h1><p><b>Know your turn on your phone</b></p><p>మీ వంతు మీ ఫోన్‌లో చూడండి</p><div id="q"></div><p>1. Scan this QR &nbsp; 2. Type your token number (e.g. 12)</p><p>QR స్కాన్ చేసి, మీ టోకెన్ నంబర్ నమోదు చేయండి</p><p><code>'+u+'</code></p><button onclick="print()" style="font-size:20px;padding:12px 24px">Print poster</button>'
   +'<script src="'+new URL('vendor/qrcode.min.js',location.href).href+'"><\/script><script>new QRCode(document.getElementById("q"),{text:'+JSON.stringify(u)+',width:320,height:320});<\/script></body></html>');
  w.document.close();
}
function apply(v){
  if((v.wipeAt||0)>(S.wipeAt||0)&&window.A&&A.wipeLocal){A.wipeLocal(v.wipeAt);origSave();try{Swal.fire({icon:'info',title:'Clinic data was cleared',text:'Admin started fresh on another phone. Old patient records on this phone were removed.',timer:3500,showConfirmButton:false})}catch(e){}setTimeout(function(){location.reload()},3600)}
  var qi=qIn(v.q);lastQ=qi.map;qFull=qi.legacy;lastScal=canon({wipeAt:v.wipeAt||0,ctr:v.ctr||1,act:v.act||null,auto:!!v.auto,fees:v.fees||S.fees,day:v.day||''});C.applying=true;
  try{S.q=qi.arr;S.ctr=v.ctr||1;S.act=v.act||null;S.auto=!!v.auto;if(v.fees)S.fees=v.fees;C.rev=Math.max(C.rev,v.rev||0);
    origSave();typeof render==='function'&&render()}finally{C.applying=false}
}
function listen(uid){
  C.uid=uid;C.ref=firebase.database(app()).ref('scc/'+uid);C.pub=firebase.database(app()).ref('pub/'+uid);
  var first=true;
  C.ref.on('value',function(snap){
    var v=snap.val();set('on');try{count('down',(v?qIn(v.q).bytes:0)+200)}catch(e){}if(!C.ref)return;
    try{keysIn(v&&v.keys)}catch(e){console.warn('keys in',e)}
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
function stop(){try{C.ref&&C.ref.off()}catch(e){}try{var r=rxRef();r&&r.child('dev/'+DEV+'/revoked').off();r&&r.child('meta').off();r&&r.child('r').off();rxQ&&rxQ.off()}catch(e){}rxQ=null;rxOn=false;C.ref=null;C.pub=null}
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
async function join(email,pw){await libs();app();await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);var u=(await firebase.auth().signInWithEmailAndPassword(email,pw)).user;
  var a=(await firebase.database(app()).ref('allowed/'+u.uid).once('value')).val(),cid=typeof a==='string'&&a?a:a===true?u.uid:null;
  if(!cid)throw new Error('This cloud login is not approved for a clinic yet.');
  var k=(await firebase.database(app()).ref('scc/'+cid+'/keys').once('value')).val();setPref({on:true,email:email});
  // connect properly once the clinic PIN has opened the data on this phone
  stop();keyState='unknown';lastKeySig=null;addEventListener('scc-unlocked',function(){start()},{once:true});return k}
setInterval(devBeat,10*60000);
window.CloudSync={conf:function(){return CONF},isDefault:isDefault,code:function(){return codeOf(CONF)},parseConf:parseConf,setConf:setConf,logPut:logPut,logFetch:logFetch,devices:devices,revoke:revoke,devRemove:devRemove,devBeat:devBeat,me:function(){return DEV},rxPut:rxPut,metaPut:metaPut,join:join,pushKeys:pushKeys,keysAdopted:function(){keyState='ok';lastKeySig=keySig();setTimeout(rxStart,0)},menu:menu,start:start,trackUrl:function(tok,cd){return C.uid?statusUrl(tok,cd):''},status:function(){return C.status},usage:U};
(function(){var m=location.search.match(/[?&]cloud=([A-Za-z0-9_-]+)/);if(!m)return;var c;try{c=parseConf(m[1])}catch(e){return}
  history.replaceState(null,'',location.pathname);if(c.databaseURL===CONF.databaseURL)return;
  var fresh=!(window.S&&S.sec)||typeof S==='undefined';try{fresh=!S.sec}catch(e){}
  if(fresh||confirm('Connect this phone to the cloud of clinic project "'+c.projectId+'"?\nThis phone will use that clinic\'s logins and queue.')){if(!setConf(c))location.reload()}})();
function go(){if(window.SCC_READY===false){set('off');addEventListener('scc-unlocked',function(){start()},{once:true})}else start()}
chip();if(window.SCC_BOOTED)go();else addEventListener('scc-boot',go,{once:true});
})();
