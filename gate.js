const $=s=>document.querySelector(s);
const entry=$('#entry'),form=$('#unlock-form'),input=$('#password'),button=$('#unlock'),message=$('#message'),stage=$('#presentation'),lockButton=$('#lock');
const base=new URL('./',location.href);
let manifest,key,registration,ready;
const from64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
function status(text,error=false){message.textContent=text;message.classList.toggle('error',error);}
function worker(){return navigator.serviceWorker.controller||registration?.active;}
function callWorker(data,timeout=12000){return new Promise((resolve,reject)=>{const sw=worker();if(!sw)return reject(new Error('Presentation service unavailable.'));const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('Presentation service timed out.'));},timeout);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();e.data?.ok?resolve(e.data):reject(new Error(e.data?.error||'Unable to unlock.'));};sw.postMessage(data,[channel.port2]);});}
async function initialize(){
 if(!isSecureContext||!('serviceWorker'in navigator)||!crypto.subtle)throw new Error('Open this presentation in a current browser over HTTPS.');
 manifest=await fetch(new URL('manifest.json',base),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Presentation package unavailable.');return r.json();});
 if(manifest.version!==1||manifest.kdf?.iterations!==600000)throw new Error('Unsupported presentation package.');
 registration=await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});
 await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(new Error('Reload this page to activate the presentation.'));},6000);function changed(){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();}navigator.serviceWorker.addEventListener('controllerchange',changed);});
}
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='RBB_KEY_REQUEST'&&event.source===worker()&&key&&manifest){const response={type:'RBB_RESTORE_KEY',key,manifest};if(event.ports[0])event.ports[0].postMessage(response);else event.source?.postMessage(response);}});
ready=initialize().catch(error=>{status(error.message,true);throw error;});ready.catch(()=>{});
form.addEventListener('submit',async event=>{
 event.preventDefault();button.disabled=true;status('Opening the presentation…');
 try{
  await ready;
  const password=input.value;input.value='';
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const candidate=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations:manifest.kdf.iterations,salt:from64(manifest.kdf.salt)},material,{name:'AES-GCM',length:256},false,['decrypt']);
  await callWorker({type:'RBB_UNLOCK',key:candidate,manifest});
  key=candidate;
  const iframe=document.createElement('iframe');iframe.title='RBB gallery presentation';iframe.allow='autoplay; fullscreen';iframe.allowFullscreen=true;
  const loaded=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Presentation loading timed out. Please try again.')),15000);iframe.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});});
  iframe.src=new URL('deck/index.html',base).href;stage.style.opacity='0';stage.hidden=false;stage.replaceChildren(iframe);
  await loaded;
  if(!iframe.contentWindow?.rbbDeck)throw new Error('Presentation could not be initialized. Please try again.');
  await iframe.contentWindow.rbbDeck.ready;
  await iframe.contentDocument.fonts.ready;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  stage.style.opacity='1';entry.classList.add('is-leaving');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,600));
  entry.hidden=true;entry.classList.remove('is-leaving');lockButton.hidden=false;status('');iframe.contentWindow.focus();
 }catch(error){key=null;stage.replaceChildren();stage.hidden=true;entry.hidden=false;entry.classList.remove('is-leaving');callWorker({type:'RBB_LOCK'}).catch(()=>{});status(error.message==='Incorrect password.'?'That password did not open the presentation. Please try again.':error.message,true);input.focus();}
 finally{button.disabled=false;}
});
async function lock(){key=null;stage.replaceChildren();stage.hidden=true;entry.hidden=false;lockButton.hidden=true;status('');input.value='';input.focus();try{await callWorker({type:'RBB_LOCK'});}catch{}}
lockButton.addEventListener('click',lock);
// A fresh document has no stored password or derived key. Only this parent page
// can re-supply its in-memory CryptoKey if the browser restarts the worker.
