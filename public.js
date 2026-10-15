const BUILD="4685c8060f90a0103440";
const root=new URL('./',location.href),frame=document.querySelector('iframe'),status=document.querySelector('[role="status"]');
let mounted=false;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function publicController(){
  const controller=navigator.serviceWorker?.controller;
  if(!controller)return true;
  return new Promise(resolve=>{
    const channel=new MessageChannel();let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();resolve(value);};
    const timer=setTimeout(()=>finish(false),180);
    channel.port1.onmessage=event=>finish(event.data?.public===true);
    try{controller.postMessage({type:'RBB_PUBLIC_PING'},[channel.port2]);}catch{finish(false);}
  });
}
async function retireEncryptedRouting(){
  if(!('serviceWorker' in navigator))return true;
  const scope=root.href,registrations=(await navigator.serviceWorker.getRegistrations()).filter(reg=>reg.scope===scope);
  const hadController=!!navigator.serviceWorker.controller;
  if(!registrations.length&&!hadController)return true;
  status.textContent='Opening the updated presentation…';
  // update() re-fetches the established /sw.js URL, replacing the encrypted
  // handler before requesting any /deck/ resources.
  await Promise.all(registrations.map(reg=>reg.update().catch(()=>{})));
  const deadline=performance.now()+3500;
  while(performance.now()<deadline){if(await publicController())break;await pause(80);}
  const safe=await publicController();
  await Promise.all(registrations.map(reg=>reg.unregister().catch(()=>false)));
  if(safe)return true;
  // Unregistering cannot detach an old controller from an already-open page.
  // A single navigation gives the document an uncontrolled clean start.
  const key='rbb-public-migration-'+BUILD;
  let alreadyReloaded=false;
  try{alreadyReloaded=sessionStorage.getItem(key)==='1';sessionStorage.setItem(key,'1');}catch{}
  const url=new URL(location.href);
  if(alreadyReloaded||url.searchParams.get('rbb-public')===BUILD)throw Error('Please close this presentation tab and reopen the public link to finish the update.');
  url.searchParams.set('rbb-public',BUILD);location.replace(url.href);return false;
}
function mount(){
  if(mounted)return;mounted=true;
  const target=new URL('deck/index.html',root);target.searchParams.set('v',BUILD);target.hash=location.hash;
  frame.addEventListener('load',()=>{status.hidden=true;frame.focus();},{once:true});
  frame.src=target.href;
}
window.addEventListener('hashchange',()=>{
  if(!mounted)return;
  const target=new URL('deck/index.html',root);target.searchParams.set('v',BUILD);target.hash=location.hash;
  frame.src=target.href;
});
retireEncryptedRouting().then(ready=>{if(ready)mount();}).catch(error=>{
  console.error('RBB public migration:',error);status.textContent=error.message||'Unable to open the presentation. Please reload this page.';
  const retry=document.createElement('button');retry.textContent='Reload presentation';retry.addEventListener('click',()=>location.reload());status.append(document.createElement('br'),retry);
});
