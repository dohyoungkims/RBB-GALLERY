import * as THREE from '../vendor/three/build/three.module.js';

// Lightweight source-grounded 3D study. Metres from the original Rhino export.
// These cutaways simplify boundaries, furnishings, model identities and lighting.
const BOUNDS={experience:[15.24,-11.8364,22.2758,1.651],prefunction:[-10.414,-1.524,-6.985,9.271],timeline:[-25.908,11.557,-1.778,15.875]};
const SCREEN=[[21.4144,-9.8553],[21.5134,-9.444],[21.5911,-9.0281],[21.6474,-8.6088],[21.682,-8.1871],[21.695,-7.7642],[21.6861,-7.3412],[21.6556,-6.9192],[21.6034,-6.4994],[21.5297,-6.0828],[21.4347,-5.6705],[21.3186,-5.2636],[21.1818,-4.8633],[21.0246,-4.4705]];
const SHELF=[[21.7949,-3.7851],[21.5769,-3.3413],[21.3354,-2.9097],[21.0711,-2.4916],[20.7849,-2.0883],[20.4775,-1.7009],[20.1498,-1.3305],[19.8028,-.9782],[19.4374,-.645],[19.0547,-.3317],[18.6557,-.0395],[18.2417,.2311],[17.8139,.4791],[17.3733,.7038],[16.9214,.9046]];
const clamp=THREE.MathUtils.clamp;

class Batch {
  constructor(materials){this.materials=materials;this.parts=new Map();this.boxGeometry=new THREE.BoxGeometry(1,1,1);this.matrix=new THREE.Matrix4();this.q=new THREE.Quaternion();this.s=new THREE.Vector3();this.p=new THREE.Vector3();}
  item(key){if(!this.parts.has(key))this.parts.set(key,{p:[],n:[],uv:[],idx:[]});return this.parts.get(key)}
  geometry(key,g,matrix){const out=this.item(key),pos=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,base=out.p.length/3,normalM=new THREE.Matrix3().getNormalMatrix(matrix),v=new THREE.Vector3();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(matrix);out.p.push(v.x,v.y,v.z);v.fromBufferAttribute(n,i).applyNormalMatrix(normalM);out.n.push(v.x,v.y,v.z);out.uv.push(uv?.getX(i)||0,uv?.getY(i)||0)}const ix=g.index?.array;if(ix)for(const i of ix)out.idx.push(i+base);else for(let i=0;i<pos.count;i++)out.idx.push(base+i)}
  box(key,x,y,z,w,h,d,ry=0){this.p.set(x,y,z);this.s.set(w,h,d);this.q.setFromAxisAngle(new THREE.Vector3(0,1,0),ry);this.matrix.compose(this.p,this.q,this.s);this.geometry(key,this.boxGeometry,this.matrix)}
  face(key,a,b,c,d,uvs=[0,0,1,0,1,1,0,1]){const out=this.item(key),base=out.p.length/3,normal=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c),new THREE.Vector3(...a))).normalize();for(const p of[a,b,c,d]){out.p.push(...p);out.n.push(normal.x,normal.y,normal.z)}out.uv.push(...uvs);out.idx.push(base,base+1,base+2,base,base+2,base+3)}
  line(key,a,b,r=.015){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),dir=B.clone().sub(A),mid=A.clone().add(B).multiplyScalar(.5),g=new THREE.CylinderGeometry(r,r,dir.length(),5,1);const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());this.geometry(key,g,new THREE.Matrix4().compose(mid,q,new THREE.Vector3(1,1,1)));g.dispose()}
  band(key,path,height,width=.42,thickness=.045){for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],innerA=[a[0]-width,a[1]-.08],innerB=[b[0]-width,b[1]-.08];this.face(key,[...at(a,height)],[...at(b,height)],[...at(innerB,height)],[...at(innerA,height)]);this.face(key,at(innerA,height),at(innerB,height),at(innerB,height-thickness),at(innerA,height-thickness));this.face(key,at(a,height-thickness),at(b,height-thickness),at(b,height),at(a,height));}}
  finish(){const group=new THREE.Group();for(const[key,data]of this.parts){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setIndex(data.idx);g.computeBoundingSphere();const mesh=new THREE.Mesh(g,this.materials[key]);mesh.name='spatial-'+key;mesh.castShadow=!['screen','glow','glass','ground','seam'].includes(key);mesh.receiveShadow=!['screen','glow','glass'].includes(key);if(key==='glass')mesh.renderOrder=2;group.add(mesh)}this.boxGeometry.dispose();return group}
}
function at(p,h){return[p[0],h,p[1]]}
function seeded(n){return Math.abs(Math.sin(n*12.9898+78.233)*43758.5453)%1}

function build(option,materials){
  const b=new Batch(materials),glass=option==='glass';
  const floor=(bounds,wood=false)=>{const[x0,z0,x1,z1]=bounds;b.box(wood?'oakFloor':'ground',(x0+x1)/2,-.09,(z0+z1)/2,x1-x0,.18,z1-z0);if(wood){for(let x=x0+.17;x<x1;x+=.18)b.box('seam',x,.004,(z0+z1)/2,.006,.004,z1-z0)}else{for(let x=x0+1.2;x<x1;x+=1.2)b.box('seam',x,.004,(z0+z1)/2,.006,.004,z1-z0);for(let z=z0+1.2;z<z1;z+=1.2)b.box('seam',(x0+x1)/2,.004,z,x1-x0,.004,.006)}};
  const mini=(x,z,y,w,d,h,index=0)=>{const key=index%6===1?'red':'model';b.box(key,x,y+h/2,z,w,h,d);if(index%4===0)b.box(key,x-w*.16,y+h*1.35,z+d*.08,w*.45,h*.7,d*.55);if(index%5===2)for(let j=0;j<3;j++)b.box('model',x-w*.35+j*w*.35,y+h*.67,z,w*.13,h*1.35,d*.86)};
  const field=(x,z,w,d,y,rows,cols,size=.34)=>{for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const n=row*cols+col,xx=x+(col+.5)*w/cols,zz=z+(row+.5)*d/rows;mini(xx,zz,y,size*(.65+seeded(n)*.65),size*(.65+seeded(n+17)*.7),.08+seeded(n+42)*.28,n)}};
  const vertical=(key,path,lo,hi)=>{const total=path.length-1;for(let i=0;i<total;i++){const a=path[i],c=path[i+1];b.face(key,at(a,lo),at(c,lo),at(c,hi),at(a,hi),[i/total,0,(i+1)/total,0,(i+1)/total,1,i/total,1])}};
  const table=(x0,z0,w,d,y)=>{b.box('model',x0+w/2,y,z0+d/2,w,.06,d);for(const x of[x0+.06,x0+w-.06])for(const z of[z0+.1,z0+d-.1])b.box('metal',x,y/2,z,.045,y,.045);b.box('metal',x0+w/2,y-.06,z0+.08,w,.035,.035);b.box('metal',x0+w/2,y-.06,z0+d-.08,w,.035,.035)};
  if(option==='table'||glass){
    floor(BOUNDS.experience);b.box('wall',22.3,1.69,-7.92,.17,3.38,7.83);
    // Curved panorama and shelfback are distinct source elements (89914 / 92086).
    vertical('wall',SCREEN,.08,3.24);vertical('screen',SCREEN.map(([x,z])=>[x-.018,z]),.2,3.08);
    for(let i=0;i<SCREEN.length-1;i++){b.line('red',at(SCREEN[i],3.16),at(SCREEN[i+1],3.16),.022);b.line('glow',[SCREEN[i][0]-.03,.12,SCREEN[i][1]],[SCREEN[i+1][0]-.03,.12,SCREEN[i+1][1]],.018)}
    vertical('oak',SHELF,.08,2.78);
    for(const y of[.91,1.42,1.9,2.37]){b.band('oak',SHELF,y,.44,.06);for(let i=0;i<SHELF.length-1;i++)b.line('glow',[SHELF[i][0]-.43,y-.012,SHELF[i][1]-.08],[SHELF[i+1][0]-.43,y-.012,SHELF[i+1][1]-.08],.009);for(let j=1;j<SHELF.length-1;j+=3)mini(SHELF[j][0]-.2,SHELF[j][1]-.07,y+.025,.17,.19,.22+(j%3)*.13,j)}
    // Source portrait panel between the curved screen and shelf.
    b.face('screen',[20.445,.1,-4.79],[20.0,.1,-3.894],[20.0,3.2,-3.894],[20.445,3.2,-4.79]);
    if(glass){
      field(16.6,-11.1,4.1,10.0,.015,12,5,.42);
      b.box('glass',18.699,.51,-6.135,4.5278,.045,10.578);
      for(let z=-11.42;z<=-.84;z+=1.175)b.box('metal',18.699,.52,z,4.5278,.024,.016);
      for(let x=16.435;x<=20.97;x+=1.132)b.box('metal',x,.52,-6.135,.016,.024,10.578);
      for(const x of[16.435,20.963])b.box('glow',x,.54,-6.135,.012,.012,10.578);
    }else{table(17.2837,-10.2246,1.6256,5.7498,.7543);field(17.35,-10.1,1.46,5.45,.79,13,4,.27)}
    // Red arcs are a restrained ceiling trace, kept sparse to retain the cutaway.
    for(const [cx,cz,rx,rz]of[[18.2,-7.4,2.6,3.1],[18.5,-4.0,2.3,3.0]]){
      let prev=null;for(let i=0;i<=36;i++){const a=-.4+i/36*Math.PI*1.45,p=[cx+Math.cos(a)*rx,3.32,cz+Math.sin(a)*rz];if(prev)b.line('red',prev,p,.025);prev=p;}
    }
  }else{
    const pre=option==='shelf'||option==='combined',wall=option==='wall'||option==='combined';
    if(pre){
      floor(BOUNDS.prefunction,true);b.box('wall',-6.95,1.55,3.87,.14,3.1,10.8);
      // Simplified relief cells follow the proposed long display wall, not a new surface survey.
      b.box('oak',-7.08,1.35,3.9,.12,2.7,10.4);
      for(let row=0;row<15;row++)for(let col=0;col<48;col++){const z=-1.22+col*.215,y=.12+row*.18;b.box('oakRelief',-7.16-seeded(row*48+col)*.05,y,z,.08,.12,.14)}
      for(const y of[.78,1.36,1.94,2.5]){b.box('oak',-7.4,y,3.8,.55,.05,9.55);b.box('glow',-7.68,y-.018,3.8,.01,.01,9.55);for(let i=0;i<12;i++)mini(-7.4,-.55+i*.77,y+.025,.24,.25,.18+(i%3)*.12,i)}
      table(-9.95,-1.14,1.33,10.23,.89);field(-9.87,-1.06,1.16,10.0,.925,23,3,.24);
      // Floating white ceiling baffles communicate the existing cloud rhythm.
      for(let z=-.8;z<8.9;z+=2.35)b.box('ceiling',-8.7,3.42,z,2.8,.055,.63);
    }
    if(wall){
      floor(BOUNDS.timeline);b.box('wall',-13.84,1.6,15.9,24.13,3.2,.16);
      b.box('oak',-16.68,.78,15.64,18.0,1.5,.18);
      b.face('screen',[-25.6207,1.8766,15.51],[-7.7741,1.8766,15.51],[-7.7741,2.7433,15.51],[-25.6207,2.7433,15.51]);
      b.box('red',-16.697,2.78,15.49,17.98,.06,.045);b.box('red',-16.697,1.842,15.49,17.98,.06,.045);
      for(let row=0;row<6;row++)for(let col=0;col<58;col++){const n=row*58+col;b.box(n%9===1?'red':'model',-25.4+col*.3,.3+row*.225,15.42,.16,.13,.08+seeded(n)*.1)}
      b.box('oak',-16.7,.22,15.15,17.9,.08,.8);b.box('glow',-16.7,.25,14.75,17.9,.013,.015);
      for(let i=0;i<11;i++)mini(-24.65+i*1.53,15.08,.26,.3+.15*(i%3),.35,.2+.22*(i%4),i);
      table(-18.5,12.15,3.3,1.1,.64);field(-18.3,12.28,2.9,.83,.68,2,7,.23);
      // The central structural column is visible in PPT image32. Its location and
      // section are illustrative: a distinct Rhino column could not be resolved.
      // Retain a clear route on both sides and the existing open canopy height.
      b.box('wall',-13.9,1.725,13.15,.4,3.45,.4);
      // Timber canopy is shown as an open edge trace to keep the exhibits visible.
      for(let x=-25.5;x<-2;x+=1.45)b.box('oak',x,3.45,15.5,.055,.09,.7);
    }
    if(option==='combined')for(let z=9.5;z<11.6;z+=.35)b.box('red',-8.1,.01,z,.07,.012,.1);
  }
  return b.finish();
}

export function mountSpatial(host){
  if(!(host instanceof Element))throw new TypeError('mountSpatial requires a DOM host');
  const state={option:'table',lighting:'day',view:'axon',azimuth:null,active:false,motion:true,reveal:true};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  renderer.domElement.className='spatial-canvas';renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;cursor:grab';renderer.domElement.setAttribute('aria-label','Interactive simplified 3D model of the RBB gallery');host.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=null;
  const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,180);camera.up.set(0,1,0);
  const hemi=new THREE.HemisphereLight('#f9f9f4','#b9ae94',2);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff0d4',2.8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.2,far:65});scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight('#d9ecf2',.9);scene.add(fill);
  const warm=new THREE.PointLight('#ffc980',0,40,1.5);scene.add(warm);
  const redLight=new THREE.PointLight('#ed5240',0,30,1.5);scene.add(redLight);
  let texture=null,destroyed=false,inViewport=true,group=null,raf=0,lastFrame=0,clock=0,frames=0,lastStatsTime=0,fps=0,fpsCount=0,nightMix=0,reveal=1,sampleTime=null;
  let geometryBounds=new THREE.Box3(),center=new THREE.Vector3(),radius=12,baseSize=10,aspect=1;
  let theta=-2.37,phi=.95,desiredTheta=-2.37,desiredPhi=.95,zoom=1,desiredZoom=1,manualTheta=0,manualPhi=0,pointer=null,manualUntil=0;
  const mats={
    ground:new THREE.MeshStandardMaterial({color:'#d4d0c5',roughness:.77}),
    wall:new THREE.MeshStandardMaterial({color:'#f4f0e5',roughness:.8,side:THREE.DoubleSide}),
    oak:new THREE.MeshStandardMaterial({color:'#cba772',roughness:.72,side:THREE.DoubleSide}),
    oakFloor:new THREE.MeshStandardMaterial({color:'#c8ab82',roughness:.67}),
    oakRelief:new THREE.MeshStandardMaterial({color:'#dfc194',roughness:.72}),
    model:new THREE.MeshStandardMaterial({color:'#fffaf0',roughness:.52}),
    metal:new THREE.MeshStandardMaterial({color:'#727a78',roughness:.42,metalness:.5}),
    red:new THREE.MeshStandardMaterial({color:'#bb3028',roughness:.46,emissive:'#d7332a',emissiveIntensity:.07}),
    glass:new THREE.MeshPhysicalMaterial({color:'#c5dfdd',roughness:.12,metalness:.02,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}),
    seam:new THREE.MeshBasicMaterial({color:'#aaa69b'}),
    glow:new THREE.MeshBasicMaterial({color:'#ffda90',toneMapped:false}),
    screen:new THREE.MeshBasicMaterial({color:'#fff9e8',side:THREE.DoubleSide,toneMapped:false}),
    ceiling:new THREE.MeshStandardMaterial({color:'#e7e5df',roughness:.85,transparent:true,opacity:.25,depthWrite:false})
  };
  function disposeGroup(){if(group){scene.remove(group);group.traverse(o=>o.geometry?.dispose());group=null}}
  function rebuild(){disposeGroup();group=build(state.option,mats);scene.add(group);geometryBounds.setFromObject(group);geometryBounds.getCenter(center);center.y=.9;const size=geometryBounds.getSize(new THREE.Vector3());radius=Math.max(size.x,size.z)*1.9;sun.position.copy(center).add(new THREE.Vector3(-7,16,-8));sun.target.position.copy(center);fill.position.copy(center).add(new THREE.Vector3(8,10,4));warm.position.copy(center).add(new THREE.Vector3(1,3.2,-1));redLight.position.copy(center).add(new THREE.Vector3(2,2.1,1));manualTheta=0;manualPhi=0;desiredTheta=Number.isFinite(state.azimuth)?state.azimuth:((state.option==='wall'||state.option==='combined')?-1.9:-2.37);reveal=state.active&&state.motion&&state.reveal&&!reduced.matches?.06:1;renderer.shadowMap.needsUpdate=true;fit();}
  function fit(){const oldP=camera.position.clone(),oldT=camera.quaternion.clone();const aim=center.clone();const fitPhi=state.view==='plan'?.001:.95;camera.position.set(aim.x+Math.sin(desiredTheta)*Math.sin(fitPhi)*radius,aim.y+Math.cos(fitPhi)*radius,aim.z+Math.cos(desiredTheta)*Math.sin(fitPhi)*radius);camera.lookAt(aim);camera.updateMatrixWorld();const inv=camera.matrixWorldInverse;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const x of[geometryBounds.min.x,geometryBounds.max.x])for(const y of[0,geometryBounds.max.y])for(const z of[geometryBounds.min.z,geometryBounds.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(inv);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}baseSize=Math.max((maxY-minY)*.62,(maxX-minX)/aspect*.62,3);camera.position.copy(oldP);camera.quaternion.copy(oldT);camera.left=-baseSize*aspect;camera.right=baseSize*aspect;camera.top=baseSize;camera.bottom=-baseSize;camera.updateProjectionMatrix();}
  function resize(draw=true){if(destroyed)return;const r=host.getBoundingClientRect();if(r.width<2||r.height<2)return;aspect=r.width/r.height;renderer.setSize(Math.round(r.width),Math.round(r.height),false);if(group)fit();if(draw)drawOnce();}
  function light(dt,instant=false){const target=state.lighting==='night'?1:0;nightMix=instant?target:THREE.MathUtils.damp(nightMix,target,4,dt);hemi.intensity=THREE.MathUtils.lerp(2,.36,nightMix);sun.intensity=THREE.MathUtils.lerp(2.8,.12,nightMix);fill.intensity=THREE.MathUtils.lerp(.9,.3,nightMix);warm.intensity=nightMix*26;redLight.intensity=nightMix*12;mats.red.emissiveIntensity=.07+nightMix*.65;renderer.toneMappingExposure=THREE.MathUtils.lerp(1.22,1.04,nightMix);}
  function position(dt,instant=false,atTime=null){const still=!state.motion||reduced.matches;desiredPhi=state.view==='plan'?.001:clamp(.95+manualPhi,.35,1.35);const orbit=state.view==='axon'&&(atTime!==null||(!still&&performance.now()>manualUntil))?Math.sin((atTime??clock)*.13)*.055:0;const targetTheta=desiredTheta+manualTheta+orbit;phi=instant?desiredPhi:THREE.MathUtils.damp(phi,desiredPhi,4,dt);theta=instant?targetTheta:THREE.MathUtils.damp(theta,targetTheta,4,dt);zoom=instant?desiredZoom:THREE.MathUtils.damp(zoom,desiredZoom,5,dt);camera.zoom=zoom;camera.updateProjectionMatrix();camera.position.set(center.x+Math.sin(theta)*Math.sin(phi)*radius,center.y+Math.cos(phi)*radius,center.z+Math.cos(theta)*Math.sin(phi)*radius);camera.lookAt(center);if(group){const previousReveal=reveal;reveal=instant?1:THREE.MathUtils.damp(reveal,1,4,dt);if(reveal>.999)reveal=1;group.scale.y=reveal;if(Math.abs(previousReveal-reveal)>.00001)renderer.shadowMap.needsUpdate=true;}}
  function render(dt=.033,instant=false){if(!state.active||!inViewport||document.hidden||destroyed)return;light(dt,instant);position(dt,instant||sampleTime!==null,sampleTime);renderer.render(scene,camera);frames++;fpsCount++;const now=performance.now();if(now-lastStatsTime>=1000){fps=fpsCount*1000/(now-lastStatsTime);lastStatsTime=now;fpsCount=0}}
  function drawOnce(){if(state.active&&inViewport&&!document.hidden){render(.033,!state.motion||reduced.matches);if(state.motion&&!reduced.matches)start();}}
  function loop(time){raf=0;if(!state.active||!inViewport||!state.motion||reduced.matches||document.hidden||destroyed)return;if(time-lastFrame>=1000/30-.5){const dt=lastFrame?Math.min((time-lastFrame)/1000,.08):.033;lastFrame=time;clock+=dt;render(dt)}raf=requestAnimationFrame(loop)}
  function start(){if(!raf&&sampleTime===null&&state.active&&inViewport&&state.motion&&!reduced.matches&&!document.hidden&&!destroyed){lastFrame=0;lastStatsTime=performance.now();fpsCount=0;raf=requestAnimationFrame(loop)}}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;lastFrame=0}
  function update(next={}){if(destroyed)return;sampleTime=null;const old={...state};Object.assign(state,next);if(!['table','glass','shelf','wall','combined'].includes(state.option))state.option='table';state.lighting=state.lighting==='night'?'night':'day';state.view=state.view==='plan'?'plan':'axon';state.azimuth=Number.isFinite(state.azimuth)?state.azimuth:null;state.active=!!state.active;state.motion=state.motion!==false;state.reveal=state.reveal!==false;renderer.domElement.dataset.option=state.option;renderer.domElement.dataset.view=state.view;renderer.domElement.dataset.lighting=state.lighting;if(old.option!==state.option)rebuild();if(old.view!==state.view||old.azimuth!==state.azimuth){manualTheta=0;manualPhi=0;desiredZoom=1;desiredTheta=Number.isFinite(state.azimuth)?state.azimuth:((state.option==='wall'||state.option==='combined')?-1.9:-2.37);fit()}if(!state.active||!state.motion||reduced.matches)stop();if(state.active){resize();if(!old.active){reveal=state.motion&&state.reveal&&!reduced.matches?.06:1;desiredZoom=1;position(.033,!state.motion||reduced.matches)}drawOnce();}}
  const visibility=()=>{if(document.hidden)stop();else drawOnce()};document.addEventListener('visibilitychange',visibility);
  const reducedChange=()=>{stop();drawOnce()};reduced.addEventListener('change',reducedChange);
  const resizeObserver=new ResizeObserver(()=>resize());resizeObserver.observe(host);
  const intersectionObserver=new IntersectionObserver(entries=>{const visible=entries.some(entry=>entry.isIntersecting);if(inViewport===visible)return;inViewport=visible;if(visible)drawOnce();else stop()});intersectionObserver.observe(host);
  const down=e=>{if(!state.active)return;pointer={x:e.clientX,y:e.clientY};manualUntil=performance.now()+4500;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing'};
  const move=e=>{if(!pointer||state.view==='plan')return;manualTheta-=(e.clientX-pointer.x)*.005;manualPhi=clamp(manualPhi+(e.clientY-pointer.y)*.004,-.6,.35);pointer={x:e.clientX,y:e.clientY};manualUntil=performance.now()+4500;render(.05,!state.motion||reduced.matches)};
  const up=()=>{pointer=null;renderer.domElement.style.cursor='grab';manualUntil=performance.now()+4500};
  const wheel=e=>{if(!state.active)return;e.preventDefault();desiredZoom=clamp(desiredZoom*Math.exp(-e.deltaY*.00065),.75,1.7);render(.05,!state.motion||reduced.matches)};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  function rehost(nextHost){
    if(destroyed)return;
    if(!(nextHost instanceof Element))throw new TypeError('rehost requires a DOM host');
    resizeObserver.disconnect();intersectionObserver.disconnect();host=nextHost;host.append(renderer.domElement);
    const r=host.getBoundingClientRect();inViewport=r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;
    resizeObserver.observe(host);intersectionObserver.observe(host);if(!inViewport)stop();resize();
  }
  // Warm a complete frame without changing activation or starting playback.
  function prepare(){if(destroyed)return;resize(false);light(0,true);position(0,true,sampleTime);renderer.shadowMap.needsUpdate=true;renderer.compile(scene,camera);renderer.render(scene,camera);frames++;}
  function snapshot(){if(destroyed)return null;renderer.render(scene,camera);frames++;return renderer.domElement.toDataURL('image/png');}
  // Explicit time sampling freezes playback until the next update call.
  function seek(seconds){if(destroyed)return;sampleTime=Number.isFinite(Number(seconds))?Math.max(0,Number(seconds)):0;clock=sampleTime;manualTheta=0;manualPhi=0;manualUntil=0;stop();resize(false);light(0,true);position(0,true,sampleTime);renderer.render(scene,camera);frames++;}
  rebuild();resize();
  texture=new THREE.TextureLoader().load(new URL('../assets/images/timeline-la-full.webp',import.meta.url).href,()=>drawOnce());texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;mats.screen.map=texture;mats.screen.needsUpdate=true;
  return {update,rehost,prepare,seek,snapshot,dispose(){if(destroyed)return;destroyed=true;stop();resizeObserver.disconnect();intersectionObserver.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',reducedChange);disposeGroup();Object.values(mats).forEach(m=>m.dispose());texture?.dispose();renderer.dispose();renderer.domElement.remove()},get stats(){return{...state,sampleTime,revealProgress:reveal,inViewport,activeLoop:!!raf,frames,fps:Math.round(fps*10)/10,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),canvasCount:host.querySelectorAll('canvas').length,camera:camera.position.toArray(),reducedMotion:reduced.matches}},get canvas(){return renderer.domElement}};
}
