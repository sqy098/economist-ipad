const VERSION='economist-gate-v141-2',PUBLIC=['./','index.html','gate-entry.js','gate-entry.js?v=1.4.1-r2','manifest.webmanifest','apple-touch-icon.png','icon-192.png','icon-512.png','vault-index.json'];
const base=self.registration.scope;let metaPromise,keyPromise;
const meta=()=>metaPromise||=(async()=>{const cache=await caches.open(VERSION);let r=await cache.match(new URL('vault-index.json',base));if(!r){r=await fetch(new URL('vault-index.json',base));if(!r.ok)throw Error('无法加载题库目录');await cache.put(new URL('vault-index.json',base),r.clone());}return r.json()})();
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('economist-gate-'+new URL(base).pathname,1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function keyRead(){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('keys').objectStore('keys').get('view');r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)})}
async function keySave(key){const db=await database();await new Promise((resolve,reject)=>{const t=db.transaction('keys','readwrite');t.objectStore('keys').put(key,'view');t.oncomplete=resolve;t.onerror=()=>reject(t.error)});db.close();keyPromise=Promise.resolve(key)}
const currentKey=()=>keyPromise||=keyRead();
async function cipher(name){const m=await meta(),item=m.files[name];if(!item)throw Error('资料未收录');const url=new URL('vault/'+item.file,base),cache=await caches.open(VERSION);let r=await cache.match(url);if(!r){r=await fetch(url);if(!r.ok)throw Error('资料下载失败');await cache.put(url,r.clone());}return r.arrayBuffer()}
async function plain(name,key){const data=new Uint8Array(await cipher(name));return crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:new TextEncoder().encode(name)},key,data.slice(12))}
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(PUBLIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{
 if(e.data?.type==='UNLOCK')e.waitUntil((async()=>{try{let key;if(e.data.key){const s=e.data.key.replace(/-/g,'+').replace(/_/g,'/');const raw=Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));if(raw.length!==32)throw Error('访问钥匙格式不正确');key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);}else key=await currentKey();if(!key)throw Error('尚未配置访问钥匙');await plain('app-index.html',key);await keySave(key);e.ports[0]?.postMessage({ok:true});}catch{e.ports[0]?.postMessage({ok:false,error:'访问钥匙不正确，或网络暂不可用。请使用专用链接重试。'});}})());
 if(e.data?.type==='CHECK_CORE')e.waitUntil((async()=>{const m=await meta(),c=await caches.open(VERSION);if(await currentKey()&&(await Promise.all(m.core.map(name=>c.match(new URL('vault/'+m.files[name].file,base))))).every(Boolean))e.ports[0]?.postMessage({type:'CORE_READY'});})());
 if(e.data?.type==='CACHE_ALL')e.waitUntil((async()=>{try{const m=await meta(),files=e.data.files.filter(p=>m.files[p]&&/^(pages|img)\//.test(p));let index=0,completed=0;async function work(){while(index<files.length){await cipher(files[index++]);completed++;if(completed%20===0||completed===files.length)e.source?.postMessage({type:'CACHE_PROGRESS',completed,total:files.length});}}await Promise.all(Array.from({length:4},work));e.source?.postMessage({type:'CACHE_DONE',total:files.length});}catch(err){e.source?.postMessage({type:'CACHE_ERROR',message:err.message});}})());
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url),root=new URL(base);if(u.origin!==root.origin||!u.pathname.startsWith(root.pathname)||e.request.method!=='GET')return;
 const name=decodeURIComponent(u.pathname.slice(root.pathname.length));if(name.startsWith('vault/'))return;
 e.respondWith((async()=>{
  if(e.request.mode==='navigate'){try{const r=await fetch(new URL('index.html',base));if(r.ok){const c=await caches.open(VERSION);await c.put(new URL('index.html',base),r.clone());return r;}}catch{}return (await caches.open(VERSION)).match(new URL('index.html',base));}
  const m=await meta();if(m.files[name]){const key=await currentKey();if(!key)return new Response('访问钥匙未配置',{status:401});try{return new Response(await plain(name,key),{headers:{'Content-Type':m.files[name].type,'Cache-Control':'no-store'}})}catch{return new Response('无法解密资料，请用专用链接重新打开',{status:401})}}
  const cache=await caches.open(VERSION),hit=await cache.match(e.request);return hit||fetch(e.request);
 })());
});

