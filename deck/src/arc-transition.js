/**
 * Arc geometry adapted from Osmo, Arc Scroll Transition.
 * Licensed resource copied from the user's signed-in Vault on 2026-10-14.
 * https://www.osmo.supply/resource/arc-scroll-transition
 * Original drawArc math is preserved; slide progress replaces ScrollTrigger.
 */
export function mountArcTransition(host){
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;width:0;height:0;pointer-events:none';
 const defs=document.createElementNS(ns,'defs');svg.append(defs);host.append(svg);
 let serial=0,current;
 function begin(element,{direction=1,curve=12}={}){
  current?.dispose();
  const id=`rbb-arc-${++serial}`,clip=document.createElementNS(ns,'clipPath'),path=document.createElementNS(ns,'path');
  clip.id=id;clip.setAttribute('clipPathUnits','objectBoundingBox');clip.append(path);defs.append(clip);
  const aspect=host.clientWidth/host.clientHeight,depth=curve/100*aspect;
  element.style.clipPath=`url(#${id})`;
  const draw=progress=>{
   const fill=Math.max(0,Math.min(1,progress)),bend=depth*Math.sin(fill*Math.PI);
   if(direction>=0){const edge=1-fill,control=edge-bend*2;path.setAttribute('d',`M0 1 L0 ${edge} Q.5 ${control} 1 ${edge} L1 1 Z`);}
   else{const edge=fill,control=edge+bend*2;path.setAttribute('d',`M0 0 L0 ${edge} Q.5 ${control} 1 ${edge} L1 0 Z`);}
  };
  draw(0);
  current={draw,dispose(){element.style.removeProperty('clip-path');clip.remove();if(current===this)current=null;}};
  return current;
 }
 return{begin,dispose(){current?.dispose();svg.remove();}};
}
