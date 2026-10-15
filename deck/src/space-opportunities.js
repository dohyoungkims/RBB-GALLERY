import { mountLocationPlan } from './location-plan.js';

// The RBB concepts are a conversation about possibilities, not a venue decision.
// Geometry is built by the existing small procedural study; no Rhino or video
// payload is loaded. One WebGL renderer is shared between all three spaces.
const REFERENCES = {
 table: { src: new URL('../assets/images/option-table.webp', import.meta.url).href, title: 'Experience room / model table', credit: 'Original concept rendering · Exhibition Brief, slide 17' },
 glass: { src: new URL('../assets/images/option-glass.webp', import.meta.url).href, title: 'Experience room / glass floor', credit: 'Original concept rendering · Exhibition Brief, slide 19' },
 shelf: { src: new URL('../assets/images/option-shelf-table.webp', import.meta.url).href, title: 'Pre-function / shelves and model table', credit: 'Original concept rendering · Exhibition Brief, slide 21' },
 wall: { src: new URL('../assets/images/option-wall.webp', import.meta.url).href, title: 'Timeline corridor / models and digital wall', credit: 'Original concept rendering · Exhibition Brief, slide 23' },
 combined: { src: new URL('../assets/images/option-combined.webp', import.meta.url).href, title: 'Pre-function and timeline / relationship study', credit: 'Original concept plan · Exhibition Brief, slide 24' },
 plan: { src: new URL('../assets/images/source-plan.webp', import.meta.url).href, title: 'Three potential RBB spaces', credit: 'Original plan diagram · Exhibition Brief, slide 15' },
 existing: { src: new URL('../assets/images/experience-existing.webp', import.meta.url).href, title: 'The existing experience room', credit: 'Existing-space photograph supplied with the brief' }
};
const SCENE_IDS = { experience: 'opportunity-experience', prefunction: 'opportunity-prefunction', timeline: 'opportunity-timeline' };
const DEFAULTS = { experience: 'table', prefunction: 'shelf', timeline: 'wall' };
const AZIMUTHS = { table: -2.37, glass: -2.37, shelf: -2.37, wall: -2.8, combined: -2.55 };

export function createSpaceOpportunities({ onNavigate, onOpen, onClose } = {}) {
 const scenes = [...document.querySelectorAll('[data-space-opportunity]')];
 const overview = document.querySelector('[data-space-overview]');
 const states = new Map(scenes.map(scene => [scene, { option: DEFAULTS[scene.dataset.spaceOpportunity], view: 'axon', lighting: 'day' }]));
 let activeScene = null, modelScene = null, model = null, modelPromise = null, plan = null;
 let motion = true, disposed = false, dialog = null, dialogOpener = null, mapTransition = null;

 function isSpace(scene) { return states.has(scene); }
 function ensurePlan() {
  if (!plan && overview) {
   plan = mountLocationPlan(overview.querySelector('[data-space-plan]'), { onSelect: zone => onNavigate?.(SCENE_IDS[zone]) });
  }
  return plan;
 }
 function modelState(scene) { const state = states.get(scene); return { ...state, azimuth: AZIMUTHS[state.option] }; }
 function ensureKeymaps() {
  ensurePlan();
  const source = overview?.querySelector('[data-space-plan] svg');
  if (!source) return;
  for (const scene of scenes) {
   const host = scene.querySelector('[data-space-keymap]');
   if (!host || host.querySelector('svg')) continue;
   const svg = source.cloneNode(true), prefix = `${scene.dataset.compositionId}-keymap`;
   svg.querySelector('title').id = `${prefix}-title`;
   svg.querySelector('desc').id = `${prefix}-description`;
   svg.setAttribute('aria-labelledby', `${prefix}-title ${prefix}-description`);
   svg.querySelectorAll('.lp-zone').forEach(zone => zone.classList.toggle('is-current', zone.dataset.location === scene.dataset.spaceOpportunity));
   // The thumbnail shows the complete same map without an entry animation.
   svg.querySelectorAll('[style]').forEach(node => node.removeAttribute('style'));
   host.prepend(svg);
  }
 }
 function mapFor(scene) {
  return scene?.querySelector('[data-space-plan] svg, [data-space-keymap] svg');
 }
 function mapBounds(svg) {
  const stage = document.querySelector('#stage'), inner = svg.closest('.scene-inner');
  const savedTransform = inner?.style.transform;
  // Incoming scene text may still carry its paused entrance transform.
  if (inner) inner.style.transform = 'none';
  const rect = svg.getBoundingClientRect(), stageRect = stage.getBoundingClientRect();
  if (inner) inner.style.transform = savedTransform;
  const scale = stageRect.width / stage.clientWidth;
  return { x: (rect.left - stageRect.left) / scale, y: (rect.top - stageRect.top) / scale, width: rect.width / scale, height: rect.height / scale };
 }
 function beginTransition(from, to, { duration = 1.3, motion: enabled = true } = {}) {
  mapTransition?.dispose();
  ensureKeymaps();
  const source = mapFor(from), target = mapFor(to), gsap = globalThis.gsap;
  if (!source || !target || source === target || !gsap || !enabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const start = mapBounds(source), end = mapBounds(target);
  if (!start.width || !end.width) return null;
  const stage = document.querySelector('#stage'), overlay = document.createElement('div');
  overlay.className = 'space-map-morph location-plan'; overlay.setAttribute('aria-hidden', 'true');
  const svg = source.cloneNode(true);
  svg.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  svg.removeAttribute('aria-labelledby'); svg.setAttribute('aria-hidden', 'true');
  svg.querySelectorAll('.is-current,.is-emphasized,.is-selected').forEach(node => node.classList.remove('is-current', 'is-emphasized', 'is-selected'));
  // Copy rendered style before removing the original map from the transition.
  [...svg.querySelectorAll('.lp-zone')].forEach((zone, index) => { zone.style.opacity = getComputedStyle(source.querySelectorAll('.lp-zone')[index]).opacity; });
  overlay.append(svg); stage.append(overlay);
  const savedSource = source.style.visibility, savedTarget = target.style.visibility;
  source.style.visibility = 'hidden'; target.style.visibility = 'hidden';
  const dark = to.classList.contains('space-opportunity--night');
  overlay.classList.toggle('space-map-morph--night', dark);
  gsap.set(overlay, start);
  const timeline = gsap.timeline({ paused: true });
  timeline.to(overlay, { ...end, duration, ease: 'power3.inOut' }, 0);
  const focus = to.dataset.spaceOpportunity;
  svg.querySelectorAll('.lp-zone').forEach(zone => {
   timeline.to(zone, { opacity: !focus || zone.dataset.location === focus ? 1 : .22, duration: duration * .72, ease: 'power2.inOut' }, duration * .15);
  });
  for (const selector of ['.lp-zone-area', '.lp-route', '.lp-map-labels']) {
   const sourceNodes = source.querySelectorAll(selector), targetNodes = target.querySelectorAll(selector);
   svg.querySelectorAll(selector).forEach((node, index) => {
    const initial = getComputedStyle(sourceNodes[index]), final = getComputedStyle(targetNodes[index]);
    const properties = selector === '.lp-zone-area' ? ['fillOpacity', 'strokeWidth'] : ['opacity'];
    for (const property of properties) node.style[property] = initial[property];
    timeline.to(node, { ...Object.fromEntries(properties.map(property => [property, final[property]])), duration: duration * .8, ease: 'power2.inOut' }, duration * .1);
   });
  }
  let finished = false;
  const finish = () => {
   if (finished) return;
   finished = true; timeline.kill(); overlay.remove();
   source.style.visibility = savedSource; target.style.visibility = savedTarget;
   if (mapTransition?.timeline === timeline) mapTransition = null;
  };
  mapTransition = { timeline, finish, dispose: finish };
  return mapTransition;
 }
 function sync(scene) {
  const state = states.get(scene);
  if (!state) return;
  scene.classList.toggle('space-opportunity--night', state.lighting === 'night');
  for (const [attribute, key] of [['spaceOption','option'], ['spaceView','view'], ['spaceLight','lighting']]) {
   scene.querySelectorAll(`[data-${attribute.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}]`).forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset[attribute] === state[key]));
   });
  }
  const reference = REFERENCES[state.option];
  for (const image of scene.querySelectorAll('[data-space-reference-image], [data-space-fallback]')) {
   if (image.src !== reference.src) image.src = reference.src;
   image.alt = reference.title;
  }
  const caption = scene.querySelector('[data-space-reference-caption]');
  if (caption) caption.textContent = reference.credit;
  scene.querySelector('[data-space-model]')?.setAttribute('aria-label', `${reference.title}. Illustrative spatial study; drag to explore.`);
 }
 function freezePrevious(nextScene) {
  if (!modelScene || modelScene === nextScene || !model) return;
  // Preserve the outgoing spatial frame while the same canvas is rehosted.
  // This prevents a blank model during the arc transition between spaces.
  try {
   const image = modelScene.querySelector('[data-space-snapshot]');
   const src = model.snapshot();
   if (image && src) { image.src = src; image.hidden = false; }
  } catch { /* The supplied concept image remains a usable fallback. */ }
 }
 function loadModel(host) {
  if (!modelPromise) {
   modelPromise = import('./spatial.js').then(({ mountSpatial }) => {
    if (disposed) return null;
    model = mountSpatial(host);
    model.update({ active: false, motion: false, reveal: false });
    model.canvas.setAttribute('aria-label', 'Interactive conceptual RBB space study. Drag to rotate; scroll to zoom.');
    return model;
   }).catch(error => {
    console.warn('RBB spatial study could not start; original concept images remain available.', error);
    return null;
   });
  }
  return modelPromise;
 }
 async function prepare(scene) {
  if (disposed) return;
  if (scene === overview) { ensurePlan(); return; }
  if (!isSpace(scene)) return;
  ensureKeymaps();
  sync(scene);
  await Promise.allSettled([...scene.querySelectorAll('[data-space-reference-image]')].map(image => { image.loading = 'eager'; return image.decode(); }));
  const host = scene.querySelector('[data-space-model]');
  const instance = await loadModel(host);
  if (disposed) return;
  if (!instance) {
   scene.classList.add('space-opportunity--fallback');
   const status = scene.querySelector('[data-space-status]');
   if (status) status.textContent = 'Original concept rendering · spatial view unavailable in this browser';
   return;
  }
  freezePrevious(scene);
  instance.update({ active: false, motion: false });
  if (modelScene !== scene) instance.rehost(host);
  modelScene = scene;
  instance.update({ ...modelState(scene), active: false, motion: false, reveal: false });
  instance.prepare();
  scene.classList.add('space-opportunity--ready');
  scene.querySelector('[data-space-snapshot]').hidden = true;
 }
 function activate(scene, { motion: enabled = true } = {}) {
  if (disposed) return;
  motion = enabled !== false;
  activeScene = scene;
  plan?.setActive(scene === overview, { motion });
  if (scene === overview) ensurePlan()?.setActive(true, { motion });
  if (!isSpace(scene)) { model?.update({ active: false }); return; }
  sync(scene);
  if (model && modelScene === scene) {
   scene.querySelector('[data-space-snapshot]').hidden = true;
   model.update({ ...modelState(scene), active: true, motion, reveal: false });
  } else {
   void prepare(scene).then(() => {
    if (!disposed && activeScene === scene && modelScene === scene) model?.update({ ...modelState(scene), active: true, motion, reveal: false });
   });
  }
 }
 function pause() {
  activeScene = null;
  plan?.setActive(false);
  model?.update({ active: false });
 }
 function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'space-reference-dialog';
  dialog.setAttribute('aria-label', 'Original RBB concept reference');
  dialog.innerHTML = '<button type="button" class="space-reference-dialog__close" aria-label="Close source reference">Close ×</button><figure><img alt=""><figcaption></figcaption></figure><p>Potential opportunity only. Exhibition design and location remain open.</p>';
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { onClose?.(); dialogOpener?.focus({ preventScroll: true }); });
  document.body.append(dialog);
  return dialog;
 }
 function openReference(key, opener) {
  const reference = REFERENCES[key];
  if (!reference) return;
  const modal = ensureDialog(), image = modal.querySelector('img');
  image.src = reference.src; image.alt = reference.title;
  modal.querySelector('figcaption').textContent = `${reference.title} — ${reference.credit}`;
  dialogOpener = opener;
  modal.showModal();
  pause(); onOpen?.();
 }
 function click(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const scene = button.closest('[data-space-opportunity], [data-space-overview]');
  if (!scene || (scene !== overview && !isSpace(scene))) return;
  if (button.hasAttribute('data-space-overview-link')) { onNavigate?.('opportunities-plan'); return; }
  if (button.hasAttribute('data-space-reference')) {
   openReference(button.dataset.spaceReference || states.get(scene)?.option || 'plan', button);
   return;
  }
  if (!isSpace(scene)) return;
  const state = states.get(scene);
  if (button.dataset.spaceOption) state.option = button.dataset.spaceOption;
  else if (button.dataset.spaceView) state.view = button.dataset.spaceView;
  else if (button.dataset.spaceLight) state.lighting = button.dataset.spaceLight;
  else return;
  sync(scene);
  if (modelScene === scene) model?.update({ ...modelState(scene), active: activeScene === scene, motion, reveal: false });
  scene.dispatchEvent(new CustomEvent('space-opportunity-change', { bubbles: true, detail: { ...state } }));
 }
 function seek(scene, seconds = 0) {
  if (scene === overview) ensurePlan()?.seek(seconds);
  if (isSpace(scene) && modelScene === scene) model?.seek(seconds);
 }
 for (const scene of scenes) sync(scene);
 document.addEventListener('click', click);
 return {
  prepare, activate, pause, seek, beginTransition,
  get stats() { return { active: activeScene?.dataset.compositionId || null, modelScene: modelScene?.dataset.compositionId || null, spatial: model?.stats || null, plan: plan?.stats || null, videoCount: 0 }; },
  dispose() { if (disposed) return; disposed = true; mapTransition?.dispose(); pause(); plan?.dispose(); model?.dispose(); document.removeEventListener('click', click); dialog?.remove(); }
 };
}
