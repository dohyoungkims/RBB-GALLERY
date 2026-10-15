// RBB public release df1254975414e788d918: permanently retire encrypted routing.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('message',event=>{
  if(event.data?.type==='RBB_PUBLIC_PING')event.ports?.[0]?.postMessage({public:true,version:1});
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  const root=new URL(self.registration.scope);
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await self.registration.unregister();
  // A top-level legacy deck bookmark can have received the old worker's 401.
  // Move it through the public entry; do not nest wrappers inside old frames.
  await Promise.all(clients.map(async client=>{
    const url=new URL(client.url);
    if(client.frameType!=='nested'&&url.origin===root.origin&&url.pathname.startsWith(root.pathname+'deck/')){
      const target=new URL(root);target.hash=url.hash;await client.navigate(target.href).catch(()=>{});
    }
  }));
})()));
// Intentionally no fetch listener, encryption, cache, or persistent storage.
