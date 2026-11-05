(async()=>{
 const status=document.getElementById('gate-status'),form=document.getElementById('gate-form');
 const tell=s=>status.textContent=s;
 const retryOnHash=()=>location.reload();window.addEventListener('hashchange',retryOnHash);
 form.onsubmit=e=>{e.preventDefault();const key=document.getElementById('gate-key').value.trim();window.removeEventListener('hashchange',retryOnHash);location.hash='key='+encodeURIComponent(key);location.reload()};
 try{
  if(!('serviceWorker'in navigator)||!crypto.subtle)throw Error('请使用Safari或支持安全网页的现代浏览器打开HTTPS链接。');
  await navigator.serviceWorker.register('./gate-sw.js',{scope:'./'});const reg=await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  async function unlock(key){
   tell('正在打开加密题库…');
   const channel=new MessageChannel(),result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('题库加载超时，请检查网络后重试')),90000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};reg.active.postMessage({type:'UNLOCK',key},[channel.port2]);});
   if(!result.ok)throw Error(result.error||'访问钥匙不正确，请使用专用链接。');
   const meta=await fetch('./vault-index.json').then(r=>r.json());
   await Promise.all(meta.core.map(name=>fetch('./'+name).then(r=>{if(!r.ok)throw Error('文字题库加载失败，请重试')})));
   const response=await fetch('./app-index.html');if(!response.ok)throw Error('应用加载失败');
   const html=await response.text();window.removeEventListener('hashchange',retryOnHash);document.open();document.write(html);document.close();
  }
  const key=new URLSearchParams(location.hash.slice(1)).get('key');
  if(key){await unlock(key);return;}
  try{await unlock();return;}catch{tell('请从你的专用链接打开，或输入访问钥匙。');form.hidden=false;}
 }catch(e){tell(e.message);form.hidden=false;}
})();

