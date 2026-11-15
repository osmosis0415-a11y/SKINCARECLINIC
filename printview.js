/* PrintView: on-screen print preview + reliable printing on phones, tablets and PCs.
   Phones often ignore printing from hidden iframes, so the document is shown in a visible
   preview and printed from the main page (hidden behind a print-only stylesheet).
   PrintView.open(html,{title,onPaper}) takes a full HTML document (its <style> and @page are used).
   PrintView.node(html,{title,paper,print}) previews app content and calls print() for the app's own flow. */
(function(){
'use strict';
var PAPER={A4:[210,297],A5:[148,210],'80mm':[80,200]},cur=null;
var CSS='#pvOv{position:fixed;inset:0;z-index:10050;background:#475569;display:flex;flex-direction:column;font-family:system-ui,sans-serif}'+
 '#pvOv .pvbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px;background:#0f172a;color:#fff}#pvOv .pvbar b{flex:1;font-size:15px;min-width:120px}'+
 '#pvOv button{font:700 15px system-ui,sans-serif;border:0;border-radius:10px;padding:10px 14px;min-height:44px;cursor:pointer}#pvOv .pp{background:#16a34a;color:#fff;font-size:17px;padding:10px 20px}#pvOv .pc{background:#e2e8f0;color:#0f172a}'+
 '#pvOv .pz{background:#1e293b;color:#fff;border:1px solid #64748b}#pvOv .pz.on{background:#0284c7;border-color:#0284c7}'+
 '#pvOv .pvs{flex:1;overflow:auto;padding:14px 8px;-webkit-overflow-scrolling:touch}#pvOv .pvpage{background:#fff;margin:0 auto 14px;box-shadow:0 6px 22px #0007;box-sizing:border-box;overflow:hidden}'+
 '#pvOv details{color:#e2e8f0;font-size:13px;padding:6px 12px 10px;background:#0f172a}#pvOv summary{cursor:pointer;font-weight:700}#pvOv details p{margin:6px 0}'+
 '#pvHost{display:none}@media print{body>*:not(#pvHost){display:none!important}#pvHost{display:block!important}}';
function css(){if(!document.getElementById('pvCss')){var s=document.createElement('style');s.id='pvCss';s.textContent=CSS;document.head.appendChild(s)}}
function parse(html){var d=new DOMParser().parseFromString(html,'text/html'),st=[].map.call(d.querySelectorAll('style'),function(s){return s.textContent}).join('\n');
  var pg=(st.match(/@page\s*\{[^}]*\}/)||[''])[0],rest=st.replace(/@page\s*\{[^}]*\}/g,'').replace(/(^|[}\s,;])(html\s*,\s*body|html|body)(?=\s*[{,.:#\[>~+\s])/g,'$1.pvb');
  var size=(pg.match(/size\s*:\s*([^;}]+)/)||[])[1]||'A4',mg=(pg.match(/margin\s*:\s*([^;}]+)/)||[])[1]||'10mm';
  return{css:rest,page:pg,body:d.body.innerHTML,size:size.trim(),margin:mg.trim(),title:(d.title||'')}}
function mm(v){return parseFloat(v)||0}
function shadowInto(el,css,body){var r=el.shadowRoot||el.attachShadow({mode:'open'});r.innerHTML='<style>'+css+'</style><div class="pvb">'+body+'</div>';return r}
function host(){var h=document.getElementById('pvHost');if(!h){h=document.createElement('div');h.id='pvHost';document.body.appendChild(h)}return h}
function close(){var o=document.getElementById('pvOv');if(o)o.remove();var h=document.getElementById('pvHost');if(h){h.remove()}var p=document.getElementById('pvPage');if(p)p.remove();cur=null}
function help(){return '<details><summary>Printing from a phone or WiFi printer?</summary>'+
 '<p><b>Android:</b> phone and printer on the same WiFi. First time only: Settings → Connected devices → Printing → turn on <b>Default Print Service</b> (or install <b>Mopria Print Service</b> or your printer\'s app: HP Smart, Epson iPrint, Canon PRINT, Brother iPrint). Then tap Print here and pick the printer at the top of the print screen.</p>'+
 '<p><b>iPhone/iPad:</b> AirPrint printers on the same WiFi appear automatically.</p><p><b>Every printer:</b> choose the paper size (A4/A5), Scale 100%, Headers and footers off. To keep a copy, choose <b>Save as PDF</b> instead of a printer.</p></details>'}
function render(o){css();var ov=document.getElementById('pvOv');if(!ov){ov=document.createElement('div');ov.id='pvOv';document.body.appendChild(ov)}
  var p=PAPER[o.paper]||PAPER.A4,sw=o.onPaper?['A5','A4'].map(function(z){return'<button class="pz'+(z===o.paper?' on':'')+'" data-z="'+z+'">'+z+'</button>'}).join(''):'<span style="font-size:13px;opacity:.8">'+(o.paper||'')+'</span>';
  ov.innerHTML='<div class="pvbar"><b>👁 '+(o.title||'Print preview')+'</b>'+sw+'<button class="pc" data-x>✕ Close</button><button class="pp" data-p>🖨 Print</button></div><div class="pvs"><div class="pvpage"></div></div>'+help();
  var page=ov.querySelector('.pvpage'),W=p[0]*3.7795,H=p[1]*3.7795;page.style.width=W+'px';page.style.minHeight=H+'px';
  if(o.margins)page.style.padding=o.margins;
  if(o.node){page.innerHTML=o.node}else shadowInto(page,o.css,o.body);
  var fit=function(){var a=ov.querySelector('.pvs').clientWidth-16,z=Math.min(1,a/W);page.style.zoom=z};fit();window.addEventListener('resize',fit);
  ov.querySelector('[data-x]').onclick=close;ov.querySelector('[data-p]').onclick=function(){o.print()};
  [].forEach.call(ov.querySelectorAll('[data-z]'),function(b){b.onclick=function(){o.onPaper(b.dataset.z)}})}
function printDoc(d){var h=host();shadowInto(h,d.css,d.body);var st=document.getElementById('pvPage');if(!st){st=document.createElement('style');st.id='pvPage';document.head.appendChild(st)}
  st.textContent='@media print{'+(d.page||'@page{size:A4;margin:10mm}')+'html,body{margin:0!important;padding:0!important;background:#fff!important}}';
  var ov=document.getElementById('pvOv');setTimeout(function(){try{window.print()}catch(e){alert('Printing is not available in this browser. Open the app in Chrome or Safari.')}},60)}
var PrintView={
 open:function(html,o){o=o||{};var d=parse(html),paper=/A5/i.test(d.size)?'A5':/80mm/.test(d.size)?'80mm':'A4';
   cur={d:d};render({title:o.title||d.title,paper:paper,css:d.css,body:d.body,margins:d.margin.split(/\s+/).map(function(x){return x}).join(' '),onPaper:o.onPaper,print:function(){printDoc(d);o.onPrint&&o.onPrint()}})},
 node:function(html,o){o=o||{};render({title:o.title,paper:o.paper||'A4',node:html,margins:o.margins||'8mm',print:function(){o.print&&o.print()}})},
 close:close,isOpen:function(){return !!document.getElementById('pvOv')}};
window.PrintView=PrintView;
})();
