/* RxPad: optional printed-prescription module (Indian format), shared by Skin Care Clinic and Clinic Kiosk.
   Follows IMC (Professional Conduct, Etiquette & Ethics) Regulations 2002, clause 1.5 (as amended 2016):
   generic names, legible, in CAPITALS; doctor's name, qualification, registration number, signature, date;
   diagnosis/provisional diagnosis before medicines; typed & printed. Also prints "not on old prescription" notes.
   Everything is stored on this device only (localStorage). Printing uses a private iframe, so the host app's
   print styles are never affected. Public API: RxPad.init(opts), RxPad.open(patient, seed), RxPad.settings(). */
(function(){
'use strict';
var RxPad, P='rxpad', CFG, REC, opts={};
var DEF={enabled:true,clinicEn:'',clinicTe:'',addrEn:'',addrTe:'',phone:'',noAppt:'No appointment by phone',hours:'',holiday:'SUNDAY HOLIDAY',
  docEn:'',docTe:'',qual:'',fellow:'',spec:'',council:'',regNo:'',paper:'A5',header:'full',topMM:70,bottomMM:40,
  telugu:true,showQR:true,patientNote:'Not to buy medicines on old prescription.',pharmNote:'Not to supply medicines on old prescription.',
  teNote:'పై మందులు డాక్టర్ గారికి చూపించిన తరువాత వాడవలెను',footerAd:'',myDrugs:[]};
var FORMS=['TAB','CAP','SYP','SUSP','DROPS','CREAM','OINT','GEL','LOTION','SOLN','SOAP','SHAMPOO','POWDER','SERUM','INJ','KIT','OTHER'];
var DOSES=['1-0-0','0-1-0','0-0-1','1-0-1','1-1-1','1-1-1-1','½-0-½','0-0-½','Apply once daily','Apply twice daily','Apply at night','Apply thrice daily','Twice weekly','Once weekly','SOS (if needed)','As directed'];
var TIMES=['After food','Before food','At bedtime','Empty stomach','With food','Leave 10 min & wash','—'];
var TE_D={'1-0-0':'ఉదయం 1','0-1-0':'మధ్యాహ్నం 1','0-0-1':'రాత్రి 1','1-0-1':'ఉదయం 1, రాత్రి 1','1-1-1':'రోజుకు 3 సార్లు','1-1-1-1':'రోజుకు 4 సార్లు','½-0-½':'ఉదయం ½, రాత్రి ½','0-0-½':'రాత్రి ½',
  'Apply once daily':'రోజుకు ఒకసారి రాయాలి','Apply twice daily':'రోజుకు రెండుసార్లు రాయాలి','Apply at night':'రాత్రి పూట రాయాలి','Apply thrice daily':'రోజుకు 3 సార్లు రాయాలి','Twice weekly':'వారానికి రెండుసార్లు','Once weekly':'వారానికి ఒకసారి','SOS (if needed)':'అవసరమైనప్పుడు మాత్రమే','As directed':'డాక్టర్ చెప్పినట్లు'};
var TE_T={'After food':'భోజనం తర్వాత','Before food':'భోజనానికి ముందు','At bedtime':'పడుకునే ముందు','Empty stomach':'ఖాళీ కడుపుతో','With food':'భోజనంతో పాటు','Leave 10 min & wash':'10 ని. ఉంచి కడగాలి','—':''};
/* Starting templates only: the doctor must review and edit every prescription. */
var TPL={
 'Acne vulgaris':{dx:'ACNE VULGARIS',m:[['GEL','CLINDAMYCIN 1%','','Apply at night','—','8 weeks'],['GEL','ADAPALENE 0.1%','','Apply at night','—','8 weeks'],['SOAP','BENZOYL PEROXIDE 2.5% (FACE WASH)','','Apply twice daily','Leave 10 min & wash','8 weeks'],['LOTION','SUNSCREEN SPF 30+','','Apply twice daily','—','8 weeks']],adv:'Do not squeeze pimples. Apply adapalene on alternate nights for the first 2 weeks.'},
 'Tinea corporis / cruris':{dx:'TINEA CORPORIS',m:[['TAB','TERBINAFINE','250 MG','1-0-0','After food','2 weeks'],['CREAM','LULICONAZOLE 1%','','Apply twice daily','—','4 weeks'],['TAB','LEVOCETIRIZINE','5 MG','0-0-1','At bedtime','2 weeks'],['POWDER','CLOTRIMAZOLE 1% DUSTING','','Apply once daily','—','4 weeks']],adv:'Keep area dry. Wash clothes separately in hot water. Do not use steroid creams.'},
 'Scabies':{dx:'SCABIES',m:[['CREAM','PERMETHRIN 5%','','Apply at night','—','2 doses, 1 week apart'],['TAB','LEVOCETIRIZINE','5 MG','0-0-1','At bedtime','10 days']],adv:'Apply from neck to toes, wash after 8-12 hours. Treat all family members together. Wash bedsheets and clothes in hot water.'},
 'Urticaria':{dx:'ACUTE URTICARIA',m:[['TAB','LEVOCETIRIZINE','5 MG','1-0-1','After food','2 weeks'],['LOTION','CALAMINE','','SOS (if needed)','—','2 weeks']],adv:'Avoid known triggers. Report immediately if lip or throat swelling or breathing difficulty.'},
 'Melasma':{dx:'MELASMA',m:[['CREAM','AZELAIC ACID 20%','','Apply at night','—','8 weeks'],['LOTION','SUNSCREEN SPF 50 PA+++','','Apply thrice daily','—','8 weeks']],adv:'Strict sun protection. Do not use over-the-counter steroid or fairness creams.'},
 'Seborrhoeic dermatitis':{dx:'SEBORRHOEIC DERMATITIS',m:[['SHAMPOO','KETOCONAZOLE 2%','','Twice weekly','Leave 10 min & wash','4 weeks'],['CREAM','KETOCONAZOLE 2%','','Apply twice daily','—','2 weeks']],adv:''},
 'Pityriasis versicolor':{dx:'PITYRIASIS VERSICOLOR',m:[['SHAMPOO','KETOCONAZOLE 2%','','Once weekly','Leave 10 min & wash','4 weeks'],['TAB','FLUCONAZOLE','150 MG','Once weekly','After food','2 weeks']],adv:'Patches may take weeks to regain colour after cure.'},
 'Xerosis / eczema care':{dx:'XEROSIS',m:[['CREAM','EMOLLIENT (LIQUID PARAFFIN + WHITE SOFT PARAFFIN)','','Apply twice daily','—','4 weeks'],['TAB','LEVOCETIRIZINE','5 MG','0-0-1','At bedtime','2 weeks']],adv:'Use mild soap. Apply moisturiser within 3 minutes of bath.'}
};
function ld(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pad2(n){return String(n).padStart(2,'0')}
function dk(d){d=d||new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function dshow(k){if(!k)return'';var a=k.split('-');return a[2]+'-'+a[1]+'-'+a[0]}
function addDays(k,n){var a=k.split('-').map(Number),d=new Date(a[0],a[1]-1,a[2]+n);return dk(d)}
function up(s){return String(s||'').toUpperCase()}
function uid(){return Math.random().toString(36).slice(2,6).toUpperCase()+Date.now().toString(36).slice(-4).toUpperCase()}
function teDur(u){var m=String(u||'').match(/(\d+)\s*(day|week|month)/i);if(!m)return'';return m[1]+' '+({day:'రోజులు',week:'వారాలు',month:'నెలలు'})[m[2].toLowerCase()]}
function css(){if(document.getElementById('rxp-css'))return;var s=document.createElement('style');s.id='rxp-css';s.textContent=
'.rxp{position:fixed;inset:0;z-index:9999;background:#f1f5f9;overflow:auto;font:15px/1.4 system-ui,"Noto Sans Telugu",sans-serif;color:#0f172a}'+
'.rxp *{box-sizing:border-box}.rxp .w{max-width:900px;margin:0 auto;padding:12px 12px 90px}.rxp h2{margin:4px 0 10px;font-size:20px}'+
'.rxp .cd{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-bottom:10px}.rxp label{display:block;font-size:12px;font-weight:700;color:#64748b;margin:6px 0 3px}'+
'.rxp input,.rxp select,.rxp textarea{width:100%;font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;background:#fff;min-height:42px}.rxp textarea{min-height:60px}'+
'.rxp .g{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.rxp .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'+
'.rxp button{font:inherit;font-weight:700;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 12px;cursor:pointer;min-height:42px}.rxp button.p{background:#0369a1;border-color:#0369a1;color:#fff}.rxp button.d{color:#b91c1c}'+
'.rxp .m{border:1px solid #e2e8f0;border-radius:12px;padding:8px;margin-bottom:8px;display:grid;grid-template-columns:90px 1fr 100px;gap:6px}.rxp .m .full{grid-column:1/-1}'+
'.rxp .m .gn{text-transform:uppercase;font-weight:800}.rxp .warn{background:#fef3c7;color:#92400e;border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:8px}'+
'.rxp .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #e2e8f0;padding:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;z-index:2}'+
'.rxp .muted{color:#64748b;font-size:12px}.rxp .chip{display:inline-block;background:#e0f2fe;color:#075985;border-radius:99px;padding:3px 9px;font-size:12px;font-weight:700;margin:2px;cursor:pointer;border:0}'+
'@media(max-width:560px){.rxp .m{grid-template-columns:1fr 1fr}.rxp .m .gn{grid-column:1/-1}}';document.head.appendChild(s)}
function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstElementChild}

RxPad={
 init:function(o){opts=o||{};P=opts.prefix||'rxpad';CFG=Object.assign({},DEF,opts.defaults||{},ld(P+'_cfg',{}));REC=opts.recStore?(opts.recStore.get()||[]):ld(P+'_rec',[]);return CFG},
 records:function(){return REC.slice()},
 setRecords:function(a){REC=Array.isArray(a)?a:[]},
 cfg:function(){return CFG},
 enabled:function(){return !!(CFG&&CFG.enabled)},
 history:function(name,phone){name=up(name).trim();phone=String(phone||'').replace(/\D/g,'').slice(-10);
   return REC.filter(function(r){return (phone&&r.p.phone&&r.p.phone===phone)||(name&&up(r.p.name).trim()===name)}).sort(function(a,b){return b.ts-a.ts})},
 open:function(patient,seed){css();if(!CFG)RxPad.init({});patient=patient||{};seed=seed||{};
  var rx={id:uid(),ts:Date.now(),date:dk(),p:{name:up(patient.name||''),age:patient.age||'',sex:patient.sex||'',place:patient.place||'',phone:String(patient.phone||'').replace(/\D/g,'').slice(-10),wt:'',token:patient.token||''},
    cc:'',dx:up(seed.dx||''),allergy:'',inv:'',adv:seed.adv||'',review:'',m:[]};
  if(seed.meds)String(seed.meds).split('\n').filter(Boolean).forEach(function(l){rx.m.push({f:'',g:up(l),s:'',d:'',t:'—',u:''})});
  var root=el('<div class="rxp" id="rxpRoot"></div>');document.body.appendChild(root);
  var hist=RxPad.history(rx.p.name,rx.p.phone);
  function medRow(m,i){return '<div class="m" data-i="'+i+'"><select data-k="f">'+FORMS.map(function(f){return'<option'+(m.f===f?' selected':'')+'>'+f+'</option>'}).join('')+'</select>'+
    '<input class="gn" data-k="g" list="rxpDrugs" placeholder="GENERIC NAME" value="'+esc(m.g)+'"><input data-k="s" placeholder="Strength" value="'+esc(m.s)+'">'+
    '<select data-k="d"><option value="">Dose / frequency</option>'+DOSES.map(function(x){return'<option'+(m.d===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select>'+
    '<select data-k="t">'+TIMES.map(function(x){return'<option'+(m.t===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select>'+
    '<input data-k="u" placeholder="Duration e.g. 14 days" value="'+esc(m.u)+'"><input class="full" data-k="n" placeholder="Note (optional)" value="'+esc(m.n||'')+'">'+
    '<button class="d full" data-del="'+i+'">✕ Remove medicine</button></div>'}
  function draw(){
   var drugs={};Object.keys(TPL).forEach(function(k){TPL[k].m.forEach(function(x){drugs[x[1]]=1})});(CFG.myDrugs||[]).forEach(function(x){drugs[up(x)]=1});REC.slice(-200).forEach(function(r){r.m.forEach(function(x){drugs[x.g]=1})});
   root.innerHTML='<div class="w"><div class="row" style="justify-content:space-between"><h2>📝 Prescription</h2><button id="rxpX">✕ Close</button></div>'+
   (!CFG.regNo||!CFG.docEn?'<div class="warn">⚠ Add the doctor\'s name, qualification and <b>Registration No.</b> in Rx settings. They are required on every prescription.</div>':'')+
   '<div class="cd"><div class="g"><div><label>Patient name</label><input id="rxN" value="'+esc(rx.p.name)+'" style="text-transform:uppercase"></div><div><label>Age</label><input id="rxA" inputmode="numeric" value="'+esc(rx.p.age)+'"></div>'+
   '<div><label>Sex</label><select id="rxS"><option></option>'+['M','F','Other'].map(function(s){return'<option'+(rx.p.sex===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
   '<div><label>Place</label><input id="rxPl" value="'+esc(rx.p.place)+'"></div><div><label>Mobile (optional)</label><input id="rxPh" inputmode="tel" value="'+esc(rx.p.phone)+'"></div><div><label>Weight kg (children)</label><input id="rxW" inputmode="decimal" value="'+esc(rx.p.wt)+'"></div>'+
   '<div><label>Date</label><input id="rxD" type="date" value="'+rx.date+'"></div></div>'+
   (hist.length?'<p class="muted" style="margin:8px 0 0">Previous visits: '+hist.slice(0,3).map(function(h){return dshow(h.date)+' ('+esc(h.dx||'—')+')'}).join(', ')+' <button id="rxpRep" style="min-height:32px;padding:4px 10px">↻ Repeat last Rx</button></p>':'')+'</div>'+
   '<div class="cd"><label>Chief complaints / findings</label><textarea id="rxCC">'+esc(rx.cc)+'</textarea>'+
   '<label>Diagnosis / provisional diagnosis *</label><input id="rxDx" style="text-transform:uppercase;font-weight:700" value="'+esc(rx.dx)+'">'+
   '<label>Known drug allergies</label><input id="rxAl" placeholder="NIL / e.g. SULFA" value="'+esc(rx.allergy)+'">'+
   '<label>Quick template (edit before printing)</label><div>'+Object.keys(TPL).map(function(k){return'<button class="chip" data-tpl="'+esc(k)+'">'+esc(k)+'</button>'}).join('')+'</div></div>'+
   '<div class="cd"><div class="row" style="justify-content:space-between"><b>℞ Medicines (generic names, CAPITALS)</b><button id="rxpAdd">＋ Add medicine</button></div><div id="rxM" style="margin-top:8px">'+(rx.m.length?rx.m.map(medRow).join(''):'<p class="muted">No medicines yet. Use a template or ＋ Add medicine.</p>')+'</div>'+
   '<datalist id="rxpDrugs">'+Object.keys(drugs).sort().map(function(d){return'<option value="'+esc(d)+'">'}).join('')+'</datalist></div>'+
   '<div class="cd"><label>Investigations advised</label><input id="rxIn" value="'+esc(rx.inv)+'"><label>Advice / instructions</label><textarea id="rxAd">'+esc(rx.adv)+'</textarea>'+
   '<label>Review after</label><div class="row"><select id="rxRv" style="flex:1"><option value="">—</option>'+[[7,'1 week'],[14,'2 weeks'],[21,'3 weeks'],[30,'1 month'],[45,'6 weeks'],[60,'2 months'],[90,'3 months'],[180,'6 months']].map(function(x){return'<option value="'+x[0]+'"'+(String(rx.review)===String(x[0])?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select><span class="muted" id="rxRvD"></span></div></div>'+
   '<p class="muted">Stored only on this device. Templates are starting points; the doctor must verify every medicine, dose and duration.</p></div>'+
   '<div class="bar"><button id="rxpSet">⚙ Rx settings</button><button id="rxpSave">💾 Save</button><button class="p" id="rxpPrint">🖨 Print Rx</button></div>';
   bind()}
  function read(){var g=function(id){var e=root.querySelector('#'+id);return e?e.value:''};
   rx.p.name=up(g('rxN')).trim();rx.p.age=g('rxA');rx.p.sex=g('rxS');rx.p.place=g('rxPl');rx.p.phone=g('rxPh').replace(/\D/g,'').slice(-10);rx.p.wt=g('rxW');rx.date=g('rxD')||dk();
   rx.cc=g('rxCC');rx.dx=up(g('rxDx')).trim();rx.allergy=up(g('rxAl'));rx.inv=g('rxIn');rx.adv=g('rxAd');rx.review=g('rxRv');
   root.querySelectorAll('#rxM .m').forEach(function(r){var m=rx.m[+r.dataset.i];r.querySelectorAll('[data-k]').forEach(function(f){m[f.dataset.k]=f.dataset.k==='g'?up(f.value).trim():f.value})})}
  function bind(){
   root.querySelector('#rxpX').onclick=function(){root.remove()};
   root.querySelector('#rxpAdd').onclick=function(){read();rx.m.push({f:'TAB',g:'',s:'',d:'',t:'After food',u:''});draw()};
   root.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){read();rx.m.splice(+b.dataset.del,1);draw()}});
   root.querySelectorAll('[data-tpl]').forEach(function(b){b.onclick=function(){read();var t=TPL[b.dataset.tpl];if(!rx.dx)rx.dx=t.dx;t.m.forEach(function(x){rx.m.push({f:x[0],g:x[1],s:x[2],d:x[3],t:x[4],u:x[5]})});if(t.adv)rx.adv=(rx.adv?rx.adv+'\n':'')+t.adv;draw()}});
   var rep=root.querySelector('#rxpRep');if(rep)rep.onclick=function(){read();var h=hist[0];rx.dx=rx.dx||h.dx;rx.m=JSON.parse(JSON.stringify(h.m));rx.adv=rx.adv||h.adv;draw()};
   root.querySelectorAll('.gn').forEach(function(i){i.oninput=function(){var p=i.selectionStart;i.value=up(i.value);try{i.setSelectionRange(p,p)}catch(e){}}});
   var rv=root.querySelector('#rxRv'),rvd=root.querySelector('#rxRvD');var sh=function(){rvd.textContent=rv.value?'on '+dshow(addDays(root.querySelector('#rxD').value||dk(),+rv.value)):''};rv.onchange=sh;sh();
   root.querySelector('#rxpSet').onclick=function(){read();RxPad.settings(function(){draw()})};
   root.querySelector('#rxpSave').onclick=function(){read();save();flash('Saved')};
   root.querySelector('#rxpPrint').onclick=function(){read();
     var probs=[];if(!rx.p.name)probs.push('patient name');if(!rx.dx)probs.push('diagnosis (prescribing without a diagnosis/provisional diagnosis is professional misconduct)');
     if(!CFG.regNo||!CFG.docEn)probs.push("doctor's name / registration number (Rx settings)");if(rx.m.some(function(m){return!m.g}))probs.push('a medicine with no name');
     if(probs.length&&!window.confirm('Missing: '+probs.join('; ')+'.\n\nPrint anyway?'))return;
     save();print(rx)}}
  function save(){var i=REC.findIndex(function(r){return r.id===rx.id});var c=JSON.parse(JSON.stringify(rx));c.ts=Date.now();if(i>=0)REC[i]=c;else REC.push(c);var cap=opts.recStore?3000:800;if(REC.length>cap)REC=REC.slice(-cap);if(opts.recStore)opts.recStore.set(REC);else sv(P+'_rec',REC);opts.onSave&&opts.onSave(c)}
  function flash(t){var b=root.querySelector('#rxpSave');var o=b.textContent;b.textContent='✓ '+t;setTimeout(function(){b.textContent=o},1200)}
  draw();return rx},
 settings:function(done){css();var s=Object.assign({},CFG);var root=el('<div class="rxp" id="rxpSetRoot"></div>');document.body.appendChild(root);
  var F=[['docEn',"Doctor's name (English) *",'DR. D. SRINIVAS'],['qual','Qualification *','M.D. (DERM) OSM.'],['fellow','Fellowship / extra','IADVL FELLOWSHIP IN HIV/AIDS'],['spec','Speciality','SKIN SPECIALIST'],
   ['council','Medical Council','Telangana State Medical Council'],['regNo','Registration No. *','37094'],['docTe',"Doctor's name & speciality (Telugu)",'డా. డి. శ్రీనివాస్ — చర్మవ్యాధుల నిపుణులు'],
   ['clinicEn','Clinic name (English)','SKIN CARE CLINIC'],['clinicTe','Clinic name (Telugu)','స్కిన్ కేర్ క్లినిక్'],['addrEn','Address (English)',''],['addrTe','Address (Telugu)',''],['phone','Phone',''],['noAppt','Note beside phone','No appointment by phone'],
   ['hours','Consulting hours (one per line)','10-00 a.m. to 2-30 p.m.\n05-00 p.m. to 8-30 p.m.'],['holiday','Holiday','SUNDAY HOLIDAY'],['patientNote','Instruction to patient',''],['pharmNote','Instruction to pharmacist',''],['teNote','Telugu note',''],['footerAd','Footer line (e.g. nearby pharmacy, optional)','']];
  root.innerHTML='<div class="w"><div class="row" style="justify-content:space-between"><h2>⚙ Rx settings</h2><button id="rxsX">✕ Close</button></div>'+
   '<div class="cd"><label style="display:flex;gap:8px;align-items:center;font-size:15px;color:#0f172a"><input type="checkbox" id="rxsEn" style="width:auto;min-height:0"'+(s.enabled?' checked':'')+'> Use this prescription pad</label>'+
   '<div class="g"><div><label>Paper</label><select id="rxsPaper"><option'+(s.paper==='A5'?' selected':'')+'>A5</option><option'+(s.paper==='A4'?' selected':'')+'>A4</option></select></div>'+
   '<div><label>Header</label><select id="rxsHead"><option value="full"'+(s.header==='full'?' selected':'')+'>Print full header (plain paper)</option><option value="blank"'+(s.header==='blank'?' selected':'')+'>Body only (my pre-printed pad)</option></select></div>'+
   '<div><label>Pre-printed pad: top space (mm)</label><input id="rxsTop" type="number" value="'+s.topMM+'"></div><div><label>Pre-printed pad: bottom space (mm)</label><input id="rxsBot" type="number" value="'+s.bottomMM+'"></div></div>'+
   '<label style="display:flex;gap:8px;align-items:center;font-size:14px;color:#0f172a"><input type="checkbox" id="rxsTe" style="width:auto;min-height:0"'+(s.telugu?' checked':'')+'> Print Telugu dosage line under each medicine</label>'+
   '<label style="display:flex;gap:8px;align-items:center;font-size:14px;color:#0f172a"><input type="checkbox" id="rxsQR" style="width:auto;min-height:0"'+(s.showQR?' checked':'')+'> Print verification QR (doctor, reg. no., patient, date, Rx no.)</label></div>'+
   '<div class="cd">'+F.map(function(f){var v=s[f[0]]||'';return'<label>'+f[1]+'</label>'+(f[0]==='hours'||f[0]==='addrEn'||f[0]==='addrTe'?'<textarea data-f="'+f[0]+'" placeholder="'+esc(f[2])+'">'+esc(v)+'</textarea>':'<input data-f="'+f[0]+'" placeholder="'+esc(f[2])+'" value="'+esc(v)+'">')}).join('')+'</div>'+
   '<div class="cd"><label>My common medicines (one per line, generic names)</label><textarea id="rxsMy" rows="5" placeholder="CETIRIZINE 10 MG">'+esc((s.myDrugs||[]).join('\n'))+'</textarea></div></div>'+
   '<div class="bar"><button class="p" id="rxsSave">Save settings</button><button id="rxsTest">🖨 Test print</button></div>';
  function rd(){root.querySelectorAll('[data-f]').forEach(function(i){s[i.dataset.f]=i.value});s.enabled=root.querySelector('#rxsEn').checked;s.paper=root.querySelector('#rxsPaper').value;s.header=root.querySelector('#rxsHead').value;
   s.topMM=+root.querySelector('#rxsTop').value||70;s.bottomMM=+root.querySelector('#rxsBot').value||40;s.telugu=root.querySelector('#rxsTe').checked;s.showQR=root.querySelector('#rxsQR').checked;
   s.myDrugs=root.querySelector('#rxsMy').value.split('\n').map(up).map(function(x){return x.trim()}).filter(Boolean);['docEn','qual','regNo','clinicEn'].forEach(function(k){s[k]=up(s[k]).trim()})}
  root.querySelector('#rxsX').onclick=function(){root.remove()};
  root.querySelector('#rxsSave').onclick=function(){rd();CFG=s;sv(P+'_cfg',CFG);root.remove();opts.onSettings&&opts.onSettings(CFG);done&&done()};
  root.querySelector('#rxsTest').onclick=function(){rd();var old=CFG;CFG=s;print({id:'TEST',date:dk(),p:{name:'TEST PATIENT',age:'30',sex:'F',place:'NIZAMABAD',phone:'',wt:''},cc:'',dx:'TINEA CORPORIS',allergy:'NIL',inv:'',adv:'Keep area dry.',review:'14',
    m:[{f:'TAB',g:'TERBINAFINE',s:'250 MG',d:'1-0-0',t:'After food',u:'14 days'},{f:'CREAM',g:'LULICONAZOLE 1%',s:'',d:'Apply twice daily',t:'—',u:'4 weeks'}]});CFG=old}},
 print:function(rx){print(rx)}
};
function qrData(text){return new Promise(function(ok){
  function make(){try{var d=document.createElement('div');d.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(d);
    new window.QRCode(d,{text:text,width:220,height:220,correctLevel:window.QRCode.CorrectLevel?window.QRCode.CorrectLevel.M:0});
    setTimeout(function(){var c=d.querySelector('canvas'),i=d.querySelector('img');var u=c?c.toDataURL('image/png'):(i?i.src:'');d.remove();ok(u)},60)}catch(e){ok('')}}
  if(window.QRCode)return make();var s=document.createElement('script');s.src=opts.qrLib||'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';s.onload=make;s.onerror=function(){ok('')};document.head.appendChild(s)})}
function lines(t){return String(t||'').split('\n').map(esc).join('<br>')}
function print(rx){
  var c=CFG,rv=rx.review?addDays(rx.date,+rx.review):'',full=c.header!=='blank';
  var qrText=[c.clinicEn,'Dr '+c.docEn+' '+c.qual,'Reg '+c.regNo+' '+c.council,'Pt '+rx.p.name+' '+(rx.p.age||'')+'/'+(rx.p.sex||''),'Date '+dshow(rx.date),'Rx#'+rx.id,rx.m.length+' item(s)'].join(' | ');
  (c.showQR?qrData(qrText):Promise.resolve('')).then(function(qr){
  var meds=rx.m.filter(function(m){return m.g}).map(function(m,i){var te=c.telugu?[TE_D[m.d]||'',TE_T[m.t]||'',teDur(m.u)].filter(Boolean).join(' — '):'';
    return'<li><div class="ml"><b>'+esc(m.f?m.f+'. ':'')+esc(m.g)+(m.s?' '+esc(up(m.s)):'')+'</b></div><div class="dl">'+esc(m.d||'')+(m.t&&m.t!=='—'?' · '+esc(m.t):'')+(m.u?' · × '+esc(m.u):'')+(m.n?' · '+esc(m.n):'')+'</div>'+(te?'<div class="te">'+esc(te)+'</div>':'')+'</li>'}).join('');
  var hours=String(c.hours||'').split('\n').filter(Boolean).map(esc).join('<br>');
  var head=full?'<div class="band"><div class="cn">'+esc(c.clinicEn)+'</div><div class="ad">'+esc(String(c.addrEn||'').replace(/\n/g,', '))+(c.phone?' · Cell: '+esc(c.phone):'')+'</div></div>'+
   (c.clinicTe?'<div class="ten"><span class="tc">'+esc(c.clinicTe)+'</span>'+(c.noAppt?'<span class="na">'+esc(c.noAppt)+'</span>':'')+'</div>':'')+(c.addrTe?'<div class="tea">'+esc(String(c.addrTe).replace(/\n/g,', '))+(c.phone?' · ఫోన్: '+esc(c.phone):'')+'</div>':'')+
   '<div class="boxes"><div class="bx">'+(c.docTe?lines(c.docTe)+'<br>':'')+(c.regNo?'రి.నెం. '+esc(c.regNo):'')+'</div>'+(hours?'<div class="bx hr"><b>CONSULTING HOURS</b><br>'+hours+(c.holiday?'<br><b class="red">'+esc(c.holiday)+'</b>':'')+'</div>':'')+
   '<div class="bx dr"><b class="red">'+esc(c.docEn)+'</b><br>'+esc(c.qual)+(c.fellow?'<br><small>'+esc(c.fellow)+'</small>':'')+(c.spec?'<br><b class="red">'+esc(c.spec)+'</b>':'')+'<br>Reg. No. '+esc(c.regNo)+'</div></div>':'';
  var html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rx '+esc(rx.p.name)+'</title><style>'+
   '@page{size:'+c.paper+';margin:'+(full?'7mm':c.topMM+'mm 9mm '+c.bottomMM+'mm 9mm')+'}*{box-sizing:border-box}body{margin:0;font:'+(c.paper==='A4'?'13px':'11.5px')+'/1.35 Arial,"Noto Sans Telugu",sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
   '.band{background:#1d4ed8;color:#fff;text-align:center;padding:4px 6px;border-radius:3px}.cn{font-size:1.9em;font-weight:900;letter-spacing:.08em}.ad{font-size:.85em}'+
   '.ten{display:flex;justify-content:space-between;align-items:center;margin-top:3px}.tc{font-size:1.6em;font-weight:900;color:#c2410c;flex:1;text-align:center}.na{color:#b91c1c;font-weight:700;font-size:.85em}.tea{text-align:center;font-size:.85em}'+
   '.boxes{display:flex;gap:6px;margin-top:5px}.bx{flex:1;border:1.5px solid #1d4ed8;border-radius:8px;padding:4px;text-align:center;font-size:.85em}.red{color:#b91c1c}'+
   '.pt{display:flex;flex-wrap:wrap;gap:4px 16px;border-top:2px solid #1d4ed8;border-bottom:1px solid #1d4ed8;padding:5px 0;margin-top:6px;font-size:1.05em}.pt b{text-transform:uppercase}'+
   '.rx{font-size:2.2em;font-weight:900;font-family:serif;margin:4px 0 0}.sec{margin:4px 0}.lb{font-weight:700}ol{margin:4px 0 0 1.4em;padding:0}li{margin:0 0 7px}.ml{font-size:1.15em;letter-spacing:.02em}.dl{margin-left:2px}.te{font-size:.95em;color:#333}'+
   '.ft{margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end;gap:10px}.sg{text-align:right;font-size:.95em}.sg .ln{border-top:1px solid #000;margin-top:34px;padding-top:2px}'+
   '.notes{border-top:1px solid #1d4ed8;margin-top:8px;padding-top:4px;font-style:italic;font-size:.95em}.ad2{background:#b91c1c;color:#fff;text-align:center;font-weight:900;margin-top:4px;padding:2px}.qr img{width:24mm;height:24mm}.small{font-size:.8em;color:#444}'+
   '</style></head><body>'+head+
   '<div class="pt"><span>Name: <b>'+esc(rx.p.name)+'</b></span><span>Age: <b>'+esc(rx.p.age)+'</b></span><span>Sex: <b>'+esc(rx.p.sex)+'</b></span>'+(rx.p.wt?'<span>Wt: <b>'+esc(rx.p.wt)+' kg</b></span>':'')+'<span>Place: <b>'+esc(rx.p.place)+'</b></span><span style="margin-left:auto">Date: <b>'+dshow(rx.date)+'</b></span></div>'+
   (rx.cc?'<div class="sec"><span class="lb">C/O: </span>'+lines(rx.cc)+'</div>':'')+'<div class="sec"><span class="lb">Diagnosis: </span><b>'+esc(rx.dx||'—')+'</b>'+(rx.allergy?' &nbsp; <span class="lb">Allergy: </span>'+esc(rx.allergy):'')+'</div>'+
   '<div class="rx">℞</div><ol>'+(meds||'<li>—</li>')+'</ol>'+(rx.inv?'<div class="sec"><span class="lb">Investigations: </span>'+esc(rx.inv)+'</div>':'')+(rx.adv?'<div class="sec"><span class="lb">Advice: </span>'+lines(rx.adv)+'</div>':'')+
   '<div class="ft"><div><div class="sec" style="font-size:1.1em"><span class="lb">Review after: </span>'+(rv?'<b>'+dshow(rv)+'</b>':'________')+'</div>'+(qr?'<div class="qr"><img src="'+qr+'"><div class="small">Rx No. '+esc(rx.id)+'</div></div>':'<div class="small">Rx No. '+esc(rx.id)+'</div>')+'</div>'+
   '<div class="sg"><div class="ln"><b>'+esc(c.docEn)+'</b><br>'+esc(c.qual)+'<br>Reg. No. '+esc(c.regNo)+(c.council?'<br><span class="small">'+esc(c.council)+'</span>':'')+'</div></div></div>'+
   (full?'<div class="notes">Instruction to Patient: '+esc(c.patientNote)+'<br>Instruction to Pharmacist: '+esc(c.pharmNote)+(c.teNote?'<br><span style="font-style:normal">'+esc(c.teNote)+'</span>':'')+'</div>'+(c.footerAd?'<div class="ad2">'+esc(c.footerAd)+'</div>':''):'')+
   '</body></html>';
  var f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);
  var d=f.contentWindow.document;d.open();d.write(html);d.close();
  setTimeout(function(){try{f.contentWindow.focus();f.contentWindow.print()}catch(e){alert('Printing is not available on this device.')}setTimeout(function(){f.remove()},60000)},400)})}
window.RxPad=RxPad;
})();
