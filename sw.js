// Offline cache for Skin Care Clinic. Everything the app needs is stored on
// the phone at install; later visits load from the cache and refresh it
// quietly in the background when there is a connection.
const C='clinic-v41';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
 './vendor/icons.js','./vendor/dialogs.js','./vendor/qrcode.min.js','./vendor/html5-qrcode.min.js',
 './vendor/jspdf.umd.min.js','./vendor/PlusJakartaSans.woff2','./cloudsync.js','./status.html','./rxpad.js','./printview.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(u=>new Request(u,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.open(C).then(async c=>{
    const hit=await c.match(r,{ignoreSearch:true})||(r.mode==='navigate'?await c.match('./index.html'):null);
    const net=fetch(r.url,{cache:'no-cache'}).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    return (await net)||new Response('Offline',{status:503});
  }));
});
