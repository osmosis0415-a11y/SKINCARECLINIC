/* Offline dialog helper: a small, dependency-free stand-in for the parts of
   SweetAlert2 this clinic app uses (fire, mixin, showValidationMessage). */
(function(){
  var css=document.createElement('style');
  css.textContent=
  '.sw-ov{position:fixed;inset:0;background:#0f172a8c;z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem}'+
  '.sw-pop{background:#fff;color:#0f172a;border-radius:1.25rem;width:30rem;max-width:92vw;max-height:90vh;overflow:auto;padding:1.5rem 1.25rem 1.25rem;text-align:center;box-shadow:0 20px 40px -10px #0006;font-family:inherit}'+
  '.sw-ic{font-size:2.6rem;line-height:1;margin-bottom:.5rem}'+
  '.sw-t{font-size:1.25rem;font-weight:800;margin:0 0 .5rem}'+
  '.sw-tx{color:#475569;margin:0 0 .5rem;font-size:.95rem}'+
  '.sw-h{text-align:left;margin:.25rem 0}'+
  '.swal2-input,.swal2-select{display:block;width:100%;margin:.5rem 0;padding:.7rem;border:1px solid #cbd5e1;border-radius:.9rem;font:inherit;font-size:1rem;background:#f8fafc;box-sizing:border-box}'+
  '.sw-val{display:none;background:#fef2f2;color:#b91c1c;border-radius:.6rem;padding:.5rem;margin:.5rem 0;font-size:.875rem;font-weight:600}'+
  '.sw-btns{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;margin-top:1rem}'+
  '.sw-btns button{border:0;border-radius:.9rem;padding:.75rem 1.2rem;font:inherit;font-weight:700;color:#fff;cursor:pointer;min-height:2.75rem;flex:1 1 auto}'+
  '.sw-ok{background:#0284c7}.sw-no{background:#dc2626}.sw-cn{background:#e2e8f0;color:#0f172a!important}'+
  '.sw-toasts{position:fixed;top:calc(.75rem + env(safe-area-inset-top));right:.75rem;left:.75rem;z-index:1100;display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;pointer-events:none}'+
  '.sw-toast{background:#fff;border:1px solid #e2e8f0;border-radius:.9rem;padding:.6rem .9rem;box-shadow:0 10px 20px -8px #0004;font-weight:700;font-size:.9rem;max-width:22rem;display:flex;gap:.5rem;align-items:center;pointer-events:auto}';
  (document.head||document.documentElement).appendChild(css);

  var ICON={success:['✓','#059669'],error:['✕','#dc2626'],warning:['!','#d97706'],info:['i','#0284c7'],question:['?','#64748b']};
  function iconHTML(k,small){var i=ICON[k];if(!i)return'';var s=small?'1.4rem':'3.2rem';
    return '<div class="sw-ic" style="margin:'+(small?'0':'0 auto .5rem')+';width:'+s+';height:'+s+';border-radius:50%;border:'+(small?2:3)+'px solid '+i[1]+';color:'+i[1]+';display:grid;place-items:center;font-weight:800;font-size:'+(small?'.85rem':'1.7rem')+';flex:none">'+i[0]+'</div>';}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

  var current=null,pendingMsg=null;

  function toast(o){
    var box=document.querySelector('.sw-toasts');
    if(!box){box=document.createElement('div');box.className='sw-toasts';document.body.appendChild(box)}
    var t=document.createElement('div');t.className='sw-toast';
    t.innerHTML=iconHTML(o.icon,true)+'<span>'+esc(o.title||o.text||'')+'</span>';
    box.appendChild(t);
    if(o.didOpen)try{o.didOpen(t)}catch(e){}
    return new Promise(function(res){setTimeout(function(){t.remove();res({isConfirmed:false,isDismissed:true,dismiss:'timer'})},o.timer||2000)});
  }

  function fire(o){
    if(typeof o==='string')o={title:arguments[0],text:arguments[1],icon:arguments[2]};
    o=o||{};
    if(o.toast)return toast(o);
    if(current)current.close({isConfirmed:false,isDenied:false,isDismissed:true,dismiss:'close'});
    return new Promise(function(resolve){
      var ov=document.createElement('div');ov.className='sw-ov';
      var pop=document.createElement('div');pop.className='sw-pop swal2-popup';pop.setAttribute('role','dialog');
      var h=iconHTML(o.icon);
      if(o.title)h+='<h2 class="sw-t">'+esc(o.title)+'</h2>';
      if(o.text)h+='<p class="sw-tx">'+esc(o.text)+'</p>';
      if(o.html)h+='<div class="sw-h">'+o.html+'</div>';
      if(o.input)h+='<input class="swal2-input sw-in" type="'+(o.input==='password'?'password':o.input==='number'?'number':'text')+'" placeholder="'+esc(o.inputPlaceholder||'')+'" value="'+esc(o.inputValue||'')+'">';
      h+='<div class="sw-val"></div><div class="sw-btns">';
      if(o.showConfirmButton!==false)h+='<button class="sw-ok" style="'+(o.confirmButtonColor?'background:'+o.confirmButtonColor:'')+'">'+esc(o.confirmButtonText||'OK')+'</button>';
      if(o.showDenyButton)h+='<button class="sw-no">'+esc(o.denyButtonText||'No')+'</button>';
      if(o.showCancelButton)h+='<button class="sw-cn">'+esc(o.cancelButtonText||'Cancel')+'</button>';
      h+='</div>';
      pop.innerHTML=h;ov.appendChild(pop);document.body.appendChild(ov);
      var val=pop.querySelector('.sw-val'),inp=pop.querySelector('.sw-in'),done=false;
      function close(r){if(done)return;done=true;ov.remove();document.removeEventListener('keydown',key,true);if(current&&current.pop===pop)current=null;resolve(r)}
      function showMsg(m){val.textContent=m;val.style.display='block'}
      async function confirm(){
        var v=inp?inp.value:true;
        if(o.preConfirm){
          current.msg=null;
          var r;try{r=await o.preConfirm(v)}catch(e){showMsg(e&&e.message||String(e));return}
          if(current&&current.msg){showMsg(current.msg);return}
          if(r===false)return;
          if(r!==undefined)v=r;
        }
        close({isConfirmed:true,isDenied:false,isDismissed:false,value:v});
      }
      function dismiss(why){close({isConfirmed:false,isDenied:false,isDismissed:true,dismiss:why})}
      function key(e){
        if(!current||current.pop!==pop)return;
        if(e.key==='Escape'&&o.allowEscapeKey!==false){e.preventDefault();dismiss('esc')}
        else if(e.key==='Enter'&&e.target&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'){e.preventDefault();confirm()}
      }
      document.addEventListener('keydown',key,true);
      ov.addEventListener('click',function(e){if(e.target===ov&&o.allowOutsideClick!==false)dismiss('backdrop')});
      var b;
      if(b=pop.querySelector('.sw-ok'))b.onclick=confirm;
      if(b=pop.querySelector('.sw-no'))b.onclick=function(){close({isConfirmed:false,isDenied:true,isDismissed:false,value:false})};
      if(b=pop.querySelector('.sw-cn'))b.onclick=function(){dismiss('cancel')};
      current={pop:pop,close:close,msg:null};
      if(o.didOpen)try{o.didOpen(pop)}catch(e){}
      setTimeout(function(){var f=inp||pop.querySelector('input,select,textarea')||pop.querySelector('.sw-ok');f&&f.focus()},50);
    });
  }

  function make(defaults){
    return{
      fire:function(o){if(typeof o!=='object'||o===null)return fire.apply(null,arguments);return fire(Object.assign({},defaults,o))},
      mixin:function(m){return make(Object.assign({},defaults,m))},
      showValidationMessage:function(m){if(current)current.msg=m},
      close:function(){if(current)current.close({isConfirmed:false,isDismissed:true,dismiss:'close'})}
    };
  }
  window.Swal=make({});
})();
