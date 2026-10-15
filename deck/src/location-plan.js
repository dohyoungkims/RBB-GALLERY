/**
 * Orientation diagram traced from the supplied brief's slide 15 plan.
 * Relationships and numbering follow that source. Routes and walls are simplified;
 * this is not a surveyed floor plan or a prescribed circulation path.
 * Evidence: build/location-plan/SOURCE_EVIDENCE.md
 */
const NS = 'http://www.w3.org/2000/svg';
const DURATION = 3.1;
const ZONES = [
  { id:'experience', number:'01', name:'Experience room', detail:'At the left of arrival', shape:'M124 293H298L251 555H56Z', x:183, y:430 },
  { id:'prefunction', number:'02', name:'Pre-function', detail:'Across the shared lobby', shape:'M878 220H947L970 392H877Z', x:920, y:307 },
  { id:'timeline', number:'03', name:'Timeline gallery', detail:'Continuing beyond the passage', shape:'M750 139H878V101H1268L1287 175H750Z', x:1074, y:140 }
];
const clamp = (v,a,b) => Math.max(a,Math.min(b,Number(v)||0));
let mountCount=0;

export function mountLocationPlan(host,{onSelect,gsap=globalThis.gsap}={}) {
  if (!(host instanceof Element)) throw new TypeError('mountLocationPlan requires a DOM host.');
  const id=`rbb-location-${++mountCount}`, reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const state={active:false,motion:true,started:false,disposed:false,selected:null};
  host.classList.add('location-plan');
  host.innerHTML=`
    <svg class="lp-drawing" xmlns="${NS}" viewBox="0 55 1400 700" role="group" aria-labelledby="${id}-title ${id}-description">
      <title id="${id}-title">Three connected spaces on the first floor of RBB</title>
      <desc id="${id}-description">The entrance opens to a shared lobby. The Experience room is to the left. The pre-function passage is across the lobby to the right; the timeline gallery continues beyond it. A schematic trace of the supplied plan, not a measured walking route.</desc>
      <g class="lp-context" aria-hidden="true">
        <path class="lp-floor" d="M280 650H980V395L970 175H1287L1268 101H878V139H750V174H835V402H545V176H325L298 293H124L56 555H251Z"/>
        <path class="lp-context-line" d="M280 650H835M979 650H1020M280 557L270 594L280 650M304 295L325 177H545V402H300M547 175V132H750M750 174V402H835M978 187L1001 368H1380M982 394L985 552H1360M1042 650H1375M878 101L875 86H1255"/>
        <path class="lp-context-line" d="M330 183H533V280H305M313 297H533V350H302M363 298V350M422 298V350M479 298V350"/>
        <path class="lp-stair" d="M624 242H734V362H615M624 254H734M624 266H734M624 278H734M624 290H734M624 302H734M624 314H734M624 326H734M624 338H734M624 350H734"/>
        <path class="lp-context-line" d="M751 180H833V397H751M755 218H833M755 258H833M755 299H833M755 340H833M755 380H833M650 445H711V492H650ZM651 515H712V565H651Z"/>
        <path class="lp-context-line" d="M1018 205H1075V254H1018ZM1040 294H1195V336H1040ZM997 366H1381M1096 367V502M1247 367V502M985 506H1360"/>
        <path class="lp-entry" d="M840 650V710H980V650M852 650V696H968V650"/>
        <path class="lp-context-line" d="M295 650V680H830M985 650V680H1035"/>
        <path class="lp-source-detail" d="M91 536C104 413 173 336 283 319M104 538C118 424 183 354 279 337M162 541L183 431H233L210 541ZM896 239L904 371H937L922 239ZM997 151H1137C1156 151 1156 169 1137 169H997"/>
      </g>
      <g class="lp-connections" aria-hidden="true">
        <path class="lp-route lp-arrival" d="M910 698V627Q910 610 888 610H540Q510 610 510 580V497"/>
        <path class="lp-route lp-branch-left" d="M510 497H281"/>
        <path class="lp-route lp-branch-right" d="M510 497Q510 425 580 425H866Q920 425 920 391"/>
        <path class="lp-route lp-continuation" d="M922 219V195Q922 157 961 157H988"/>
        <circle class="lp-junction" cx="510" cy="497" r="5"/>
      </g>
      <g class="lp-zones">${ZONES.map(z=>`<g class="lp-zone" data-location="${z.id}" aria-hidden="true"><path class="lp-zone-area" d="${z.shape}"/><g class="lp-marker"><circle cx="${z.x}" cy="${z.y}" r="27"/><text x="${z.x}" y="${z.y+1}" dominant-baseline="middle" text-anchor="middle">${z.number}</text></g></g>`).join('')}</g>
      <g class="lp-map-labels" aria-hidden="true">
        <text x="501" y="547" text-anchor="middle">Shared arrival</text>
        <path d="M1044 711H994"/><text class="lp-entrance-label" x="1060" y="719">Entrance</text>
      </g>
    </svg>
    <div class="lp-legend" aria-label="Explore the three RBB spaces">${ZONES.map(z=>`<button type="button" class="lp-location" data-location="${z.id}" tabindex="-1"><span class="lp-legend-number">${z.number}</span><span class="lp-legend-copy"><span class="lp-legend-name">${z.name}</span><span class="lp-legend-detail">${z.detail}</span></span><span class="lp-legend-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>
    <p class="lp-source-note">Schematic orientation · traced from the exhibition brief, plan diagram 15. Connections are indicative.</p>`;
  const routes=[...host.querySelectorAll('.lp-route')],zones=[...host.querySelectorAll('.lp-zone')],markers=[...host.querySelectorAll('.lp-marker')],legend=[...host.querySelectorAll('.lp-location')];
  const timeline=gsap?.timeline({paused:true})||null;
  if(timeline){
    const routeTimes=[.1,.6,.9,1.65];
    routes.forEach((route,i)=>{const length=route.getTotalLength();timeline.set(route,{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},0);timeline.fromTo(route,{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{strokeDashoffset:0,duration:i===0?.8:.65,ease:'power1.inOut',immediateRender:false},routeTimes[i]);});
    timeline.set(zones,{opacity:.3},0);timeline.set(markers,{opacity:.25},0);
    zones.forEach((zone,i)=>timeline.fromTo(zone,{opacity:.3},{opacity:1,duration:.65,ease:'power1.out',immediateRender:false},.55+i*.55));
    markers.forEach((marker,i)=>timeline.fromTo(marker,{opacity:.25},{opacity:1,duration:.6,ease:'power1.out',immediateRender:false},.55+i*.55));
    timeline.to({}, {duration:DURATION},0);
    timeline.progress(1).pause();
  }
  function settle(){timeline?.progress(1).pause();}
  function canPlay(){return state.active&&state.motion&&!reduced.matches&&!document.hidden&&!state.disposed;}
  function setActive(active,{motion=state.motion,restart=false}={}){
    if(state.disposed)return;
    state.active=!!active;state.motion=motion!==false;
    host.dataset.active=String(state.active);
    legend.forEach(button=>button.tabIndex=state.active&&typeof onSelect==='function'?0:-1);
    if(!state.active){timeline?.pause();return;}
    if(reduced.matches){settle();return;}
    if(!state.started||restart){state.started=true;timeline?.time(0).pause();if(!state.motion)settle();}
    if(canPlay())timeline?.play();else timeline?.pause();
  }
  function setMotion(enabled){state.motion=enabled!==false;if(canPlay())timeline?.play();else timeline?.pause();}
  function seek(seconds){if(state.disposed)return;state.started=true;timeline?.pause().time(clamp(seconds,0,DURATION),false);}
  function progress(value){seek(clamp(value,0,1)*DURATION);}
  function select(id){if(!state.active||state.disposed)return;state.selected=id;host.querySelectorAll('[data-location]').forEach(el=>el.classList.toggle('is-selected',el.dataset.location===id));if(typeof onSelect==='function')onSelect(id);}
  const click=event=>{const el=event.target.closest('[data-location]');if(el&&host.contains(el))select(el.dataset.location);};
  const highlight=event=>{const button=event.target.closest('.lp-location');if(!button)return;host.querySelectorAll('.lp-zone').forEach(el=>el.classList.toggle('is-emphasized',el.dataset.location===button.dataset.location));};
  const clearHighlight=()=>host.querySelectorAll('.lp-zone').forEach(el=>el.classList.remove('is-emphasized'));
  const visibility=()=>{if(canPlay())timeline?.play();else timeline?.pause();};
  const reducedChange=()=>{if(reduced.matches)settle();else visibility();};
  host.addEventListener('click',click);host.addEventListener('pointerover',highlight);host.addEventListener('focusin',highlight);host.addEventListener('pointerleave',clearHighlight);host.addEventListener('focusout',clearHighlight);
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',reducedChange);
  if(typeof onSelect!=='function')host.classList.add('lp-static');
  return {setActive,setMotion,seek,progress,duration:DURATION,get timeline(){return timeline},get stats(){return{...state,progress:timeline?.progress()??1,time:timeline?.time()??DURATION,playing:!!timeline&&!timeline.paused()&&timeline.progress()<1,reducedMotion:reduced.matches,zones:zones.length,routes:routes.length}},dispose(){if(state.disposed)return;state.disposed=true;timeline?.kill();host.removeEventListener('click',click);host.removeEventListener('pointerover',highlight);host.removeEventListener('focusin',highlight);host.removeEventListener('pointerleave',clearHighlight);host.removeEventListener('focusout',clearHighlight);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',reducedChange);host.replaceChildren();host.classList.remove('location-plan','lp-static');delete host.dataset.active;}};
}
