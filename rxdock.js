// Docked Rx pad for the doctor's laptop/tablet.
// On a wide screen (1000px+) for Doctor or Admin, the prescription pad stays open
// on the right of the Reception screen and always shows the patient in the cabin.
// - Call Next (here or from another phone) loads the next patient automatically.
// - A half-written prescription is never lost: it is kept as a draft and shown as
//   a chip ("↩ Unsaved: OPD-004 RAVI") so the doctor can go back to it.
// - "Save, print & next patient" prints and moves on in one tap.
// - Hide/show with the button on the pad; the choice is remembered on this device.
(function(){
'use strict';
var PREF='scc_rxdock',MINW=1000,cur={key:null,root:null,snap:'',pin:false,p:null},drafts={},doneFor=null;
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function on(){try{return localStorage.getItem(PREF)!=='0'}catch(e){return true}}
function setOn(v){try{localStorage.setItem(PREF,v?'1':'0')}catch(e){}}
function role(){try{return ROLE}catch(e){return null}}
function want(){
  var r=role(),sec=document.querySelector('section.on');
  return on()&&(r==='doc'||r==='adm')&&innerWidth>=MINW&&!!(window.RxPad&&RxPad.enabled())&&!!sec&&sec.id==='rec'}
function patient(){try{return S.q.find(function(p){return p.id===S.act})||null}catch(e){return null}}
function pick(rx){return JSON.stringify({p:rx.p,cc:rx.cc,dx:rx.dx,allergy:rx.allergy,inv:rx.inv,adv:rx.adv,review:rx.review,m:rx.m})}
function rootAlive(){return cur.root&&cur.root.isConnected}
function dirty(){if(!rootAlive()||!cur.root._get)return false;try{return pick(cur.root._get())!==cur.snap}catch(e){return false}}
function hasDrafts(){return Object.keys(drafts).length>0}

// ---------- layout ----------
var css=document.createElement('style');
css.textContent=
 'html.rxdock main{max-width:none;margin:0;padding-right:calc(var(--dkW) + 1.75rem)}'+
 'html.rxdock{--dkW:min(60vw,62rem)}'+
 'html.rxdock #rec.on{display:block!important}html.rxdock #rec.on>*{grid-column:auto!important;grid-row:auto!important}'+
 'html.rxdock #qac{grid-template-columns:1fr!important;gap:.45rem}html.rxdock .qa{min-height:3.4rem;padding:.6rem .85rem}html.rxdock .qa small{display:none}html.rxdock .qa .ic{width:2.4rem;height:2.4rem}html.rxdock .qa b{font-size:1rem}'+
 '#rxdk{position:fixed;top:var(--dkTop,5.5rem);bottom:var(--dkBot,4.5rem);right:.875rem;width:var(--dkW);display:flex;flex-direction:column;gap:.5rem;z-index:4;text-align:left}'+
 '#rxdk.dkbig{left:0;right:0;top:calc(var(--dkTop) - 12px);bottom:calc(var(--dkBot) - 12px);width:auto;z-index:30;background:#f1f5f9;padding:.75rem max(.875rem,calc((100vw - 64rem)/2))}'+
 '#rxdk .rxp.dock{flex:1;min-height:0;text-align:left}'+
 '#rxdk .dkh{background:#0f172a;color:#fff;border-radius:1.25rem;padding:.6rem 1rem;display:flex;align-items:center;gap:.9rem;flex-wrap:wrap;flex:none}'+
 '#rxdk .dkh .dktk{font-size:1.75rem;font-weight:900;letter-spacing:-.02em;line-height:1}'+
 '#rxdk .dkh .dknm{font-size:1.1rem;font-weight:800;line-height:1.2}#rxdk .dkh .dksub{font-size:.8rem;color:#cbd5e1;font-weight:600}'+
 '#rxdk .dkh .dksp{flex:1}#rxdk .dkh button{background:#1e293b;color:#e2e8f0;border:1px solid #334155;min-height:2.4rem;padding:.4rem .7rem;font-size:.8rem}'+
 '#rxdk .dkd{display:flex;gap:.4rem;flex-wrap:wrap;flex:none}#rxdk .dkd button{background:#fef3c7;color:#92400e;border:1px solid #fcd34d;min-height:2.2rem;padding:.3rem .7rem;font-size:.8rem}'+
 '#rxdk .dke{flex:1;background:#fff;border:2px dashed #cbd5e1;border-radius:1.25rem;padding:2.5rem 1rem;text-align:center;color:#475569;display:flex;flex-direction:column;align-items:center;justify-content:center}'+
 '#rxdk .dke b{display:block;font-size:1.2rem;color:#0f172a;margin-bottom:.3rem}#rxdk .dke button{margin-top:1rem;min-height:3.2rem;font-size:1.05rem;padding:.6rem 1.4rem}'+
 '#rxdkShow{display:none}html.dkoff #rxdkShow{display:block}';
document.head.appendChild(css);

function box(){var b=$('rxdk');if(b)return b;var rec=$('rec');if(!rec)return null;b=document.createElement('div');b.id='rxdk';rec.insertBefore(b,rec.firstChild);return b}
function fit(){var h=document.querySelector('header'),n=$('nav'),r=document.documentElement.style;
  r.setProperty('--dkTop',((h?h.getBoundingClientRect().bottom:80)+12)+'px');r.setProperty('--dkBot',((n?n.getBoundingClientRect().height:70)+12)+'px')}

// ---------- header + drafts ----------
function head(a){
  var b=box(),h=b.querySelector('.dkh');if(!h){h=document.createElement('div');h.className='dkh'}b.insertBefore(h,b.firstChild);
  var d=b.querySelector('.dkd');if(!d){d=document.createElement('div');d.className='dkd'}h.after(d);
  if(a){var bits=[a.age?a.age+' y':'',a.sex||'',a.visitType?a.visitType+' visit':'',a.place||''].filter(Boolean);
    h.innerHTML='<span class="dktk">'+esc(a.tokenNo)+'</span><span><span class="dknm">'+esc(a.name||'Name not entered')+'</span><br><span class="dksub">'+esc(bits.join(' · ')||'In the cabin now')+'</span></span><span class="dksp"></span><button type="button" data-a="full">'+(box().classList.contains('dkbig')?'⤡ Back to side':'⤢ Full screen')+'</button><button type="button" data-a="hide" title="Hide the pad on this screen">Hide pad</button>'}
  else h.innerHTML='<span class="dknm">📝 Prescription pad</span><span class="dksp"></span><button type="button" data-a="hide">Hide pad</button>';
  h.querySelectorAll('button').forEach(function(x){x.onclick=function(){if(x.dataset.a==='hide')RxDock.hide();else full()}});
  var ks=Object.keys(drafts);
  var c=cur.pin?patient():null,back=c&&c.id!==cur.key?'<button type="button" data-back="1" style="background:#dcfce7;color:#166534;border-color:#86efac">→ Back to '+esc(c.tokenNo+' '+(c.name||''))+' (in the cabin)</button>':'';
  d.innerHTML=back+ks.map(function(k){var r=drafts[k];return'<button type="button" data-k="'+esc(k)+'">↩ Unsaved: '+esc((r.p.token||'')+' '+(r.p.name||''))+'</button>'}).join('');
  d.style.display=d.innerHTML?'':'none';
  d.querySelectorAll('button').forEach(function(x){x.onclick=function(){if(x.dataset.back)RxDock.reopen();else openDraft(x.dataset.k)}})}
function full(){ // same pad, bigger: covers the screen until "Back to side"
  var b=box();b.classList.toggle('dkbig');head(cur.p);fit()}
function stash(force){ // keep the open pad as a draft if anything was typed
  if(!rootAlive())return;if(force||dirty())drafts[cur.key]=JSON.parse(JSON.stringify(cur.root._get()));
  cur.root.remove();cur.root=null}

// ---------- open / sync ----------
function openFor(a,draftRx){
  var b=box();stash();var old=b.querySelector('.dke');if(old)old.remove();
  var ex=draftRx||drafts[a.id]||(a.rxId&&typeof RXREC!=='undefined'&&RXREC.find(function(x){return x.id===a.rxId}))||undefined;
  delete drafts[a.id];
  var seed={};try{seed={dx:$('rd')?$('rd').value:'',meds:$('rb')?$('rb').value:''}}catch(e){}
  RxPad.open(A.pt(a),ex?{}:seed,ex,{dock:b});
  cur.root=$('rxpDock');cur.key=a.id;cur.p=a;cur.pin=false;cur.snap=cur.root&&cur.root._get?pick(cur.root._get()):'';doneFor=null;
  head(a);fit()}
function openDraft(k){
  var rx=drafts[k];if(!rx)return;var p=null;try{p=S.q.find(function(x){return x.id===k})}catch(e){}
  if(!p){p={id:k,tokenNo:rx.p.token,name:rx.p.name,age:rx.p.age,sex:rx.p.sex,place:rx.p.place,phone:rx.p.phone}}
  delete drafts[k];openFor(p,rx);cur.pin=true;cur.snap='';head(p)}
function empty(msg){
  var b=box();stash();var e=b.querySelector('.dke');if(!e){e=document.createElement('div');e.className='dke';b.appendChild(e)}
  var w=0;try{w=S.q.filter(function(p){return p.status==='Waiting'}).length}catch(x){}
  e.innerHTML=msg||('<b>No patient in the cabin</b>'+(w?w+' waiting. Call the next one and the pad fills in by itself.':'Nobody is waiting right now.'))+
   (w?'<br><button type="button" class="ok" onclick="A.next()">📢 Call Next</button>':'');
  cur.key=null;cur.p=null;head(null)}
function teardown(){
  document.documentElement.classList.remove('rxdock');
  document.documentElement.classList.toggle('dkoff',!on()&&(role()==='doc'||role()==='adm')&&innerWidth>=MINW);
  if(rootAlive()){stash();}var b=$('rxdk');if(b)b.remove();cur.key=null}
function sync(){
  if(!want()){teardown();return}
  document.documentElement.classList.add('rxdock');document.documentElement.classList.remove('dkoff');fit();
  var a=patient(),b=box();
  if(cur.pin&&rootAlive()){head(cur.p);return}
  cur.pin=false;
  if(!a){if(cur.key!==null||!b.querySelector('.dke'))empty();return}
  if(a.id===cur.key){
    if(!rootAlive()){ // pad closed itself after "Save, print & next" but nobody else is waiting
      if(doneFor!==a.id){doneFor=a.id;empty('<b>✓ Prescription printed for '+esc(a.name||a.tokenNo)+'</b>Call the next patient, or open this one again.'+
        '<br><button type="button" onclick="RxDock.reopen()">📝 Open again</button>');cur.key=a.id}}
    else{cur.p=a;head(a)}
    return}
  if(doneFor===a.id&&!rootAlive())return;
  openFor(a)}

// ---------- hook into the app ----------
function hook(){
  if(typeof render==='function'&&!render._dk){var r=render;render=function(){var o=r.apply(this,arguments);try{sync()}catch(e){console.warn(e)}return o};render._dk=1}
  if(window.A&&A.rx&&!A.rx._dk){var orx=A.rx;A.rx=function(){if(want()&&rootAlive()){var f=cur.root.querySelector('#rxCC')||cur.root.querySelector('#rxDx');if(f){f.focus();f.scrollIntoView({block:'center'})}return}return orx.apply(A,arguments)};A.rx._dk=1}
  var rec=$('rec');if(rec&&!$('rxdkShow')){var s=document.createElement('button');s.id='rxdkShow';s.type='button';s.textContent='📌 Show Rx pad beside the queue';s.style.cssText='width:100%;margin-bottom:.75rem;background:#7c3aed;min-height:3rem';s.onclick=function(){RxDock.show()};rec.insertBefore(s,rec.firstChild)}
  addEventListener('resize',function(){clearTimeout(hook.t);hook.t=setTimeout(function(){sync();fit()},150)});
  sync()}
window.RxDock={sync:sync,dirty:function(){return dirty()||hasDrafts()},active:function(){return want()&&rootAlive()},
  hide:function(){if(dirty()||hasDrafts()){if(!confirm('There is an unsaved prescription. It stays as a draft while the app is open. Hide the pad?'))return}setOn(false);sync()},
  show:function(){setOn(true);sync()},reopen:function(){var a=patient();if(a){doneFor=null;cur.key=null;openFor(a)}}};
if(window.SCC_BOOTED)setTimeout(hook,0);else addEventListener('scc-boot',function(){setTimeout(hook,0)},{once:true});
})();
