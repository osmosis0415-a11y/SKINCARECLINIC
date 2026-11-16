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
// ---- Three-way merge (no lost patients). 'base' is the last state this phone knows is in the cloud. A change
// made on this phone is anything that differs from base; a change from another phone is anything in the
// cloud that differs from base. Both are kept, field by field, so two phones working at the same moment never
// erase each other's patients. base is saved (encrypted, with the queue) so this also works after the app was
// closed offline and reopened.
var base={q:{},s:null},legacyQ=false,pend=0,ghosts=[],dirt={},pushNo=0;
var SCAL=['wipeAt','ctr','act','auto','fees','day'];
function scal(){return{wipeAt:S.wipeAt||0,ctr:S.ctr||1,act:S.act||null,auto:!!S.auto,fees:S.fees,day:(typeof today==='function'?today():'')}}
function rscal(v){return{wipeAt:v.wipeAt||0,ctr:v.ctr||1,act:v.act||null,auto:!!v.auto,fees:v.fees||S.fees,day:v.day||''}}
function payload(){return{rev:++C.rev,updatedAt:firebase.database.ServerValue.TIMESTAMP,by:DEV,day:(typeof today==='function'?today():'')}}
function clone(o){return JSON.parse(JSON.stringify(o))}
function locMap(){var m={};(S.q||[]).forEach(function(p,i){var o=clone(p);o.o=i;m[qKey(p)]=o});return m}
function remMap(q){var m={};ghosts=[];if(Array.isArray(q))q.forEach(function(p,i){if(p&&p.id!=null){var o=window.cleanP?cleanP(p):clone(p);if(!o)return;if(o.o==null)o.o=i;m[qKey(p)]=o}});
  else Object.keys(q||{}).forEach(function(k){if(!q[k])return;if(q[k].id==null){ghosts.push(k);return}var c=window.cleanP?cleanP(q[k]):clone(q[k]);if(c)m[k]=c}); // a half record (an edit that reached the cloud after the patient was removed) is cleaned up
  return m}
function loadBase(){var b=S.qb;base=b&&b.cid===C.uid?{q:b.q||{},s:b.s||null}:{q:{},s:null};dirt=b&&b.cid===C.uid&&b.d||{}}
// base (last cloud state seen) is always stored; 'dirt' lists this phone's changes the cloud has not confirmed yet, so after
// closing the app offline they are resent instead of being taken as deleted, and old values are never mistaken for new ones
function keepBase(){S.qb={cid:C.uid,q:base.q,s:base.s,d:dirt}}
function same(a,b){return canon(a)===canon(b)}
function merge1(b,l,r,d){ // one patient: base, local, remote (undefined = absent), d = unconfirmed change on this phone
  if(d){if(!l)return null;if(!r)return l}
  if(b&&!l)return null;            // deleted on this phone (cancel / close day / undo): deletion wins
  if(b&&!r)return null;            // deleted on another phone: deletion wins
  if(!l)return r||null;            // new from another phone
  if(!r)return l;                  // new on this phone, not sent yet
  var bb=b||{},out=Object.assign({},r),ks={};Object.keys(l).concat(Object.keys(bb)).forEach(function(k){ks[k]=1});
  Object.keys(ks).forEach(function(k){if(!same(l[k],bb[k])){if(l[k]===undefined)delete out[k];else out[k]=l[k]}});
  return out}
function mergeS(b,l,r){var out={},bb=b||{};SCAL.forEach(function(k){out[k]=dirt['s/'+k]?l[k]:!b?r[k]:(!same(l[k],bb[k])?l[k]:r[k])});
  // counter: a reset (close day) on one side wins; if both phones moved it, the higher number wins so none repeats
  if(!b||(!same(l.ctr,bb.ctr)&&!same(r.ctr,bb.ctr)))out.ctr=Math.max(+l.ctr||1,+r.ctr||1);
  out.wipeAt=Math.max(l.wipeAt||0,r.wipeAt||0);return out}
function dupWarn(){var seen={},d=[];(S.q||[]).forEach(function(p){if(p.status==='Cancelled')return;var k=p.tokenNo+'|'+p.scanDate;if(seen[k])d.push(p.tokenNo);seen[k]=1});
  d=d.filter(function(t){return !dupWarn.shown[t]});if(!d.length)return;d.forEach(function(t){dupWarn.shown[t]=1});
  try{Swal.fire({icon:'warning',title:'Same token on two phones',text:d.join(', ')+' was registered on two phones at the same moment. Both patients are kept in the queue (marked DUPLICATE). Please give one of them a new card.'})}catch(e){}}
dupWarn.shown={};
function bytesIn(q){var n=0,m=remMap(q);Object.keys(m).forEach(function(k){if(!same(m[k],base.q[k]))n+=canon(m[k]).length});return n}
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
  var k={kid:S.vault.kid,at:S.keysAt,sec:S.sec,w:S.vault.w,by:DEV},pl=payload();pl.keys=k;lastKeySig=keySig();origSave();
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
  var au=null;try{au=firebase.auth().currentUser}catch(e){}
  r.child('dev/'+DEV).update({name:devName()||(os+' '+DEV.slice(0,4)),os:os,seen:Date.now(),uid:au&&au.uid||null,mode:(function(){try{return localStorage.getItem('scc_device_role')||'any'}catch(e){return'any'}})()}).catch(function(){})}
var LOGQ=[];
function logKey(t){return String(t).padStart(13,'0')+'_'+DEV.slice(0,4)+Math.random().toString(36).slice(2,5)}
function logPut(e){LOGQ.push(e);logFlush()}
function logFlush(){var r=rxRef();if(!r||keyState!=='ok'||!CR.key||!LOGQ.length)return;var q=LOGQ.splice(0);
  q.forEach(function(e){CR.enc(JSON.stringify(e)).then(function(x){count('up',120);return r.child('log/'+logKey(e.t)).set({i:x.i,c:x.c,ts:e.t||Date.now()})}).catch(function(){LOGQ.push(e)})})}
async function logFetch(days){var r=rxRef();if(!r||!CR.key)throw new Error('Cloud sync is off on this phone.');var s=await r.child('log').orderByKey().startAt(String(Date.now()-days*864e5).padStart(13,'0')).once('value');
  var v=s.val()||{},out=[];count('down',JSON.stringify(v).length);for(var k of Object.keys(v)){try{out.push(JSON.parse(await CR.dec(v[k])))}catch(e){}}return out.sort(function(a,b){return b.t-a.t})}
async function devices(){var r=rxRef();if(!r)throw new Error('Cloud sync is off on this phone.');var v=(await r.child('dev').once('value')).val()||{};return Object.keys(v).map(function(k){return Object.assign({id:k,me:k===DEV},v[k])}).sort(function(a,b){return(b.seen||0)-(a.seen||0)})}
// Lost phone: the database itself refuses its cloud login (rxs/<clinic>/blocked/<login>), if that login is not used by any
// other phone; the app on it erases its data when it sees the block. Returns 'blocked' or 'shared' (phones share one login).
async function revoke(id,on){var r=rxRef(),d=(await r.child('dev/'+id).once('value')).val()||{};
  if(!on){if(d.blockedUid)await r.child('blocked/'+d.blockedUid).remove();await r.child('dev/'+id).update({revoked:null,revokedAt:null,blockedUid:null});return'undone'}
  var me=null;try{me=firebase.auth().currentUser.uid}catch(e){}
  var all=(await r.child('dev').once('value')).val()||{},uid=d.uid,shared=!uid||uid===me||Object.keys(all).some(function(k){return k!==id&&all[k]&&all[k].uid===uid&&!all[k].revoked});
  await r.child('dev/'+id).update({revoked:true,revokedAt:Date.now(),blockedUid:shared?null:uid});
  if(!shared){await r.child('blocked/'+uid).set(true);return'blocked'}return'shared'}
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
  var lm=locMap(),ls=scal(),upd={},n=0;
  if(legacyQ){upd.q=lm;n=1}else{
    // a new patient is sent whole; for an existing one only the fields that changed, so two phones editing
    // different details of the same patient never overwrite each other
    Object.keys(lm).forEach(function(k){var l=lm[k],b=base.q[k];if(!b){upd['q/'+k]=l;n++;return}if(same(l,b))return;
      var fs={};Object.keys(l).concat(Object.keys(b)).forEach(function(f){fs[f]=1});
      Object.keys(fs).forEach(function(f){if(!same(l[f],b[f])){upd['q/'+k+'/'+f]=l[f]===undefined?null:l[f];n++}})});
    Object.keys(base.q).forEach(function(k){if(!lm[k]){upd['q/'+k]=null;n++}});
    ghosts.forEach(function(k){if(!lm[k]){upd['q/'+k]=null;n++}});ghosts=[]}
  // only scalars this phone changed are sent, so a stale value never overwrites another phone's newer one
  SCAL.forEach(function(k){if(k!=='day'&&(!base.s||!same(ls[k],base.s[k]))){upd[k]=ls[k];n++}});
  if(n){var p=payload();Object.assign(p,upd);var prev=base,no=Date.now()*1000+(++pushNo%1000),mine=[];base={q:lm,s:ls};legacyQ=false;pend++;
    Object.keys(upd).forEach(function(k){var x=k==='q'?Object.keys(lm).map(function(q){return'q/'+q}):[k.indexOf('q/')===0?'q/'+k.split('/')[1]:'s/'+k];x.forEach(function(d){dirt[d]=no;mine.push(d)})});
    keepBase();origSave();
    var j=JSON.stringify(p);count('up',j.length);
    C.ref.update(p).then(function(){pend--;mine.forEach(function(d){if(dirt[d]===no)delete dirt[d]});keepBase();origSave()})
     .catch(function(e){pend--;base=prev;set('err');console.warn('cloud push',e)})}
  if(C.pub){var b=pub(),k=JSON.stringify([b.clinic,b.day,b.serving,b.waiting,b.done,b.noshow,b.avgMin]);if(k!==lastPub){lastPub=k;var t=JSON.stringify(b);count('up',t.length);C.pub.set(JSON.parse(t)).catch(function(e){console.warn('pub',e)})}}}
function statusUrl(tok,cd){return new URL('status.html?c='+C.uid+(isDefault()?'':'&d='+encodeURIComponent(CONF.databaseURL.replace(/^https:\/\//,'')))+(tok?'&t='+encodeURIComponent(tok):'')+(cd?'&cd='+cd:''),location.href).href}
function poster(){
  var u=statusUrl(),w=window.open('','_blank');if(!w){Swal.fire({icon:'info',title:'Patient status link',html:'<code style="word-break:break-all">'+u+'</code>'});return}
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Token status QR</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:30px}h1{font-size:34px;margin:0}p{font-size:22px;margin:10px 0}#q{display:inline-block;margin:24px 0}code{font-size:12px;word-break:break-all;color:#555}@media print{button{display:none}}</style></head><body>'
   +'<h1>'+String(S.cfg&&S.cfg.name||'Clinic').replace(/[&<>"']/g,'')+'</h1><p><b>Know your turn on your phone</b></p><p>మీ వంతు మీ ఫోన్‌లో చూడండి</p><div id="q"></div><p>1. Scan this QR &nbsp; 2. Type your token number (e.g. 12)</p><p>QR స్కాన్ చేసి, మీ టోకెన్ నంబర్ నమోదు చేయండి</p><p><code>'+u+'</code></p><button onclick="print()" style="font-size:20px;padding:12px 24px">Print poster</button>'
   +'<script src="'+new URL('vendor/qrcode.min.js',location.href).href+'"><\/script><script>new QRCode(document.getElementById("q"),{text:'+JSON.stringify(u)+',width:320,height:320});<\/script></body></html>');
  w.document.close();
}
function apply(v){
  if((v.wipeAt||0)>(S.wipeAt||0)&&window.A&&A.wipeLocal){A.wipeLocal(v.wipeAt);base={q:{},s:null};keepBase();origSave();try{Swal.fire({icon:'info',title:'Clinic data was cleared',text:'Admin started fresh on another phone. Old patient records on this phone were removed.',timer:3500,showConfirmButton:false})}catch(e){}setTimeout(function(){location.reload()},3600)}
  var rm=remMap(v.q),lm=locMap(),b=base.q,ks={},out=[];
  [rm,lm,b].forEach(function(m){Object.keys(m).forEach(function(k){ks[k]=1})});
  var myWipe=(S.wipeAt||0)>(v.wipeAt||0); // this phone started fresh while offline: drop the older cloud queue
  // first sync after this update (no saved base yet): the cloud is the reference; a patient only on this phone is kept
  // if it was added after the cloud last changed (e.g. registered offline), so old, already-closed patients don't come back
  var noBase=!base.s&&!!v.updatedAt;
  Object.keys(ks).forEach(function(k){if(myWipe&&!lm[k]&&rm[k])return;if(noBase&&lm[k]&&!rm[k]&&!dirt['q/'+k]&&(lm[k].timestamp||0)<=v.updatedAt)return;
    var m=merge1(b[k],lm[k],rm[k],dirt['q/'+k]);if(m)out.push(m)});
  out.sort(function(x,y){return((x.o||0)-(y.o||0))||((x.timestamp||0)-(y.timestamp||0))});
  try{var td=typeof today==='function'?today():'',keep={};out.forEach(function(p){keep[qKey(p)]=1});
    var gone=Object.keys(lm).filter(function(k){return !keep[k]&&b[k]&&((out.length===0&&(+v.ctr||1)===1)||(lm[k].scanDate&&lm[k].scanDate<td))}).map(function(k){var c=Object.assign({},lm[k]);delete c.o;return c});
    if(gone.length&&window.A&&A.archiveGone)A.archiveGone(gone)}catch(e){}
  var rs=rscal(v),sc=mergeS(base.s,scal(),rs);
  // an unconfirmed change that the cloud already shows is confirmed (also clears marks left from before the app was reopened)
  var om={};out.forEach(function(p){om[qKey(p)]=p});
  if(!pend)Object.keys(dirt).forEach(function(d){var k=d.slice(2); // only when nothing is in flight: the local view of the cloud includes unsent writes
   if(d[0]==='q'?same(om[k],rm[k]):same(sc[k],rs[k]))delete dirt[d]});
  // the cloud's queue becomes the new base; anything kept only from this phone is pushed right after
  base={q:rm,s:rs};legacyQ=Array.isArray(v.q);
  C.applying=true;
  try{S.q=out.map(function(p){var c=Object.assign({},p);delete c.o;return c});S.ctr=sc.ctr;S.act=sc.act;S.auto=!!sc.auto;if(sc.fees)S.fees=sc.fees;
    if(S.act&&!S.q.some(function(p){return p.id===S.act}))S.act=null;
    C.rev=Math.max(C.rev,v.rev||0);keepBase();origSave();typeof render==='function'&&render()}finally{C.applying=false}
  dupWarn();push();
}
function watchBlock(cid){try{var u=firebase.auth().currentUser;if(!u)return;firebase.database(app()).ref('rxs/'+cid+'/blocked/'+u.uid).on('value',function(x){if(x.val()===true){stop();if(window.A&&A.selfWipe)A.selfWipe()}},function(){})}catch(e){}}
function listen(uid){watchBlock(uid);
  C.uid=uid;loadBase();C.ref=firebase.database(app()).ref('scc/'+uid);C.pub=firebase.database(app()).ref('pub/'+uid);
  var first=true;
  C.ref.on('value',function(snap){
    var v=snap.val();set('on');try{count('down',(v?bytesIn(v.q):0)+200)}catch(e){}if(!C.ref)return;
    try{keysIn(v&&v.keys)}catch(e){console.warn('keys in',e)}
    if(first){first=false;
      if(!v){base={q:{},s:null};push();return}
      // first connect (also after working offline): merge both sides, nothing is overwritten
      apply(v);return}
    if(!v)return;
    apply(v); // merging is safe for this phone's own echo too, and never skips another phone's change
  },function(e){set('err');console.warn(e);if(String(e&&e.code||e).indexOf('PERMISSION_DENIED')>=0)Swal.fire({icon:'error',title:'Cloud access not approved',text:'This login is not on the clinic approved list. Ask the admin to approve it in Firebase.'})});
  firebase.database(app()).ref('.info/connected').on('value',function(s){if(C.ref)set(s.val()?'on':'offline')});
  firebase.database(app()).ref('.info/serverTimeOffset').on('value',function(s){C.skew=+s.val()||0});
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
// Walk-in numbers are handed out by the cloud (one number per tap, even if two phones tap together).
// Offline or slow: falls back to this phone's own counter after 2.5 s.
function reserve(n){if(!C.ref||C.status!=='on')return Promise.resolve(n);var got=null;
  var t=C.ref.child('ctr').transaction(function(c){c=Math.max(+c||1,n);got=c;return c+1},null,false).then(function(r){return r.committed?got:n}).catch(function(){return n});
  return Promise.race([t,new Promise(function(ok){setTimeout(function(){ok(n)},2500)})])}
window.CloudSync={reserve:reserve,skew:function(){return C.ref?C.skew||0:0},conf:function(){return CONF},isDefault:isDefault,code:function(){return codeOf(CONF)},parseConf:parseConf,setConf:setConf,logPut:logPut,logFetch:logFetch,devices:devices,revoke:revoke,devRemove:devRemove,devBeat:devBeat,me:function(){return DEV},rxPut:rxPut,metaPut:metaPut,join:join,pushKeys:pushKeys,keysAdopted:function(){keyState='ok';lastKeySig=keySig();setTimeout(rxStart,0)},menu:menu,start:start,trackUrl:function(tok,cd){return C.uid?statusUrl(tok,cd):''},status:function(){return C.status},usage:U};
(function(){var m=location.search.match(/[?&]cloud=([A-Za-z0-9_-]+)/);if(!m)return;var c;try{c=parseConf(m[1])}catch(e){return}
  history.replaceState(null,'',location.pathname);if(c.databaseURL===CONF.databaseURL)return;
  var fresh=!(window.S&&S.sec)||typeof S==='undefined';try{fresh=!S.sec}catch(e){}
  if(fresh||confirm('Connect this phone to the cloud of clinic project "'+c.projectId+'"?\nThis phone will use that clinic\'s logins and queue.')){if(!setConf(c))location.reload()}})();
function go(){if(window.SCC_READY===false){set('off');addEventListener('scc-unlocked',function(){start()},{once:true})}else start()}
chip();if(window.SCC_BOOTED)go();else addEventListener('scc-boot',go,{once:true});
})();
