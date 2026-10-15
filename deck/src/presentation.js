import { mountArtField } from './art-field.js';
import { mountArcTransition } from './arc-transition.js';
import { mountMuseumMenu } from './museum-menu.js';
import { addQueuedReveal, createQueuedReveal } from './queued-reveal.js';
import { mountVariableTitle } from './variable-title.js';
import { createSeminalProjects } from './seminal-projects.js';

const $ = selector => document.querySelector(selector);
const scenes = [...document.querySelectorAll('.scene')];
const stage = $('#stage');
const gsap = window.gsap;
const arcs = mountArcTransition(stage);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const state = { index: 0, transitioning: false, motion: !reduced.matches, autoplay: false, mode: 'live' };
const sheet = $('#presentation-sheet') || document.createElement('div');
if (!sheet.isConnected) { sheet.id = 'presentation-sheet'; stage.before(sheet); }
for (const element of [stage, $('#deck-chrome'), $('#slide-navigation')]) if (element && element.parentElement !== sheet) sheet.append(element);
const nav = $('#slide-navigation');
const timelines = window.__timelines ||= {};
const focus = { value: 0 };
let art, artworks = [], museumMenu, officeAccordion, officeAccordionPromise;
let queue = null, navigationTarget = 0, autoTimer, transition, menuBusy = false;
let menuWanted = false, menuGeneration = 0, menuPromise = Promise.resolve(true), menuSheetTween;
const isCollection = scene => scene?.dataset.compositionId === 'collection';
const isOverlay = () => !$('#overview').hidden || !!document.querySelector('dialog[open]');
const moving = () => state.motion && !reduced.matches && !document.hidden && !isOverlay();
const variableTitle = mountVariableTitle($('.cover-title'), {
 surface: stage,
 enabled: () => isCollection(scenes[state.index]) && !state.transitioning && moving() && state.mode === 'live'
});
const seminalProjects = createSeminalProjects({ onOpen: pauseForOverlay, onClose: refreshMotion });

function resize() {
 const root = document.documentElement, width = root.clientWidth, height = root.clientHeight;
 const scale = Math.min(width / 1920, height / 1080);
 root.style.setProperty('--scale', scale);
 root.style.setProperty('--stage-width', `${width / scale}px`);
 root.style.setProperty('--stage-height', `${height / scale}px`);
 root.style.setProperty('--content-left', `${(width / scale - 1920) / 2}px`);
 root.style.setProperty('--content-top', `${(height / scale - 1080) / 2}px`);
 root.style.setProperty('--bleed-scale', Math.max(width / 1920, height / 1080) / scale);
}
addEventListener('resize', resize); resize();

// Paused, seekable scene timelines support the existing HyperFrames wrapper.
for (const scene of scenes) {
 const timeline = gsap.timeline({ paused: true });
 timeline.fromTo(scene.querySelector('.scene-inner'), { y: 42, opacity: 0 }, { y: 0, opacity: 1, duration: 1.15, ease: 'power3.out' }, 0);
 timeline.to({}, { duration: Math.max(0, Number(scene.dataset.duration) - 1.15) });
 timelines[scene.dataset.compositionId] = timeline;
 scene.inert = true;
 scene.setAttribute('aria-hidden', 'true');
}
function setText(selector, value) { const element = $(selector); if (element) element.textContent = value; }
function updateChrome() {
 const current = scenes[state.index];
 const count = `${String(state.index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
 setText('#slide-label', current.dataset.label);
 setText('#counter', count);
 setText('#nav-count', count);
 for (const selector of ['#prev', '#nav-prev']) { const button = $(selector); if (button) button.disabled = state.index === 0; }
 for (const selector of ['#next', '#nav-next']) { const button = $(selector); if (button) button.disabled = state.index === scenes.length - 1; }
 if ($('#progress')) $('#progress').style.width = `${(state.index + 1) / scenes.length * 100}%`;
 setText('#autoplay-button', state.autoplay ? 'Pause' : 'Play');
 $('#autoplay-button')?.setAttribute('aria-label', state.autoplay ? 'Pause presentation' : 'Play presentation');
 setText('#motion-button', state.motion ? 'Motion on' : 'Motion off');
 $('#motion-button')?.setAttribute('aria-label', state.motion ? 'Pause motion' : 'Resume motion');
 $('#motion-button')?.setAttribute('aria-pressed', String(state.motion));
 setText('#status', `Slide ${state.index + 1}. ${current.dataset.label}`);
 if (nav) {
  nav.dataset.theme = current.matches('.source-statement,.invitation-cover,.seminal-projects,.office-art') ? 'dark' : 'light';
  nav.hidden = menuWanted || menuBusy;
  nav.inert = menuWanted || menuBusy;
 }
 museumMenu?.setIndex(state.index);
}
async function prepareScene(scene) {
 if (scene.dataset.compositionId === 'office-art') {
  if (!officeAccordionPromise) officeAccordionPromise = import('./wavy-accordion.js').then(async ({ mountWavyAccordion }) => {
   const root = scene.querySelector('[data-wavy-accordion-init]');
   officeAccordion = mountWavyAccordion(root, { onSelect: index => openOfficePhoto(root, index) });
   await officeAccordion.ready;
   return officeAccordion;
  });
  await officeAccordionPromise;
 }
 if (scene.matches('.source-art-pair,.hope-plaza,.seminal-projects,.invitation-cover')) {
  // Incoming slides are still hidden; start lazy image requests explicitly
  // before waiting for decode so preparation cannot wait on visibility.
  await Promise.allSettled([...scene.querySelectorAll('img')].map(image => { image.loading = 'eager'; return image.decode(); }));
 }
}
function stopAmbient(scene) {
 if (scene?.dataset.compositionId === 'office-art') officeAccordion?.setActive(false);
 if (isCollection(scene)) { variableTitle.setActive(false); art?.setActive(false); }
 seminalProjects.pause();
}
function startAmbient(scene) {
 if (scene.dataset.compositionId === 'office-art') {
  officeAccordion?.setMotion(moving() && state.mode === 'live');
  officeAccordion?.setActive(true);
 }
 const collection = isCollection(scene);
 variableTitle.setActive(collection && moving() && state.mode === 'live');
 if ($('#art-field')) { $('#art-field').inert = !collection; $('#art-field').style.opacity = collection ? '1' : '0'; }
 art?.setMotion(moving() && state.mode === 'live');
 art?.setActive(collection && moving() && state.mode === 'live');
 seminalProjects.activate(scene, { motion: moving() && state.mode === 'live' });
}
function refreshMotion() {
 const scene = scenes[state.index];
 stopAmbient(scene); startAmbient(scene); updateChrome(); scheduleAuto();
}
function scheduleAuto() {
 clearTimeout(autoTimer);
 if (state.autoplay && !document.hidden && !isOverlay() && !state.transitioning) {
  autoTimer = setTimeout(() => {
   if (state.index < scenes.length - 1) go(state.index + 1);
   else { state.autoplay = false; updateChrome(); }
  }, Number(scenes[state.index].dataset.duration) * 1000);
 }
}
function stepBy(delta) { return go((queue ?? (state.transitioning ? navigationTarget : state.index)) + delta); }
async function go(index, { instant = false, seek = false } = {}) {
 if (typeof index === 'string' && !/^\d+$/.test(index)) {
  index = scenes.findIndex(scene => scene.dataset.compositionId === index);
  if (index < 0) return;
 }
 index = Math.max(0, Math.min(scenes.length - 1, Number(index)));
 if (!Number.isFinite(index)) return;
 if (state.transitioning) { queue = index; return; }
 if (index === state.index && scenes[index].classList.contains('active')) return;
 navigationTarget = index;
 state.transitioning = true;
 clearTimeout(autoTimer);
 const from = scenes[state.index], to = scenes[index], direction = index >= state.index ? 1 : -1;
 stopAmbient(from);
 gsap.set(to, { opacity: 0 });
 await prepareScene(to);
 const hasFrom = from.classList.contains('active');
 state.index = index; updateChrome();
 const arc = !instant && !reduced.matches && hasFrom ? arcs.begin(to, { direction, curve: 12 }) : null;
 to.classList.add('active'); to.inert = false; to.setAttribute('aria-hidden', 'false');
 from.inert = true; from.style.pointerEvents = 'none';
 to.style.zIndex = '3'; from.style.zIndex = '2';
 timelines[to.dataset.compositionId].progress(1).pause();
 gsap.set(to.querySelector('.scene-inner'), { clearProps: 'transform,opacity' });
 if (isCollection(to)) { art?.setActive(moving()); focus.value = 1; art?.setFocus(1); $('#art-field').style.opacity = '1'; }
 const duration = instant || reduced.matches || !hasFrom ? 0 : 1.3;
 await new Promise(resolve => {
  transition = gsap.timeline({ onComplete: resolve });
  if (duration) addQueuedReveal(transition, to, { at: .18, reducedMotion: reduced.matches, instant: state.mode === 'seek' });
  else createQueuedReveal(to, { instant: true });
  if (arc) {
   gsap.set(to, { opacity: 1 });
   const arcClock = { progress: 0 };
   transition.to(arcClock, { progress: 1, duration, ease: 'power2.inOut', onUpdate: () => arc.draw(arcClock.progress) }, 0);
  } else transition.to(to, { opacity: 1, duration: duration * .82, ease: 'power2.inOut' }, 0);
  transition.fromTo(to.querySelector('.scene-inner'), { y: duration ? direction * 38 : 0, scale: duration ? .965 : 1 }, { y: 0, scale: 1, duration, ease: 'power3.out' }, 0);
  if (hasFrom && from !== to) {
   if (!arc) transition.to(from, { opacity: 0, duration: duration * .9, ease: 'power2.inOut' }, 0);
   transition.to(from.querySelector('.scene-inner'), { y: -direction * 26, scale: 1.025, duration, ease: 'power2.inOut' }, 0);
  }
  if (isCollection(from) || isCollection(to)) {
   transition.to(focus, { value: isCollection(to) ? 0 : 1, duration, ease: 'power3.inOut', onUpdate: () => art?.setFocus(focus.value) }, 0);
  }
  const controls = to.querySelectorAll('.scene-cta');
  if (controls.length) transition.fromTo(controls, { opacity: duration ? 0 : 1, y: duration ? 14 : 0 }, { opacity: 1, y: 0, duration: duration * .5, ease: 'power2.out', stagger: .04 }, duration * .5);
  if (!duration) transition.progress(1);
 });
 arc?.dispose();
 for (const scene of scenes) {
  const active = scene === to;
  scene.classList.toggle('active', active); scene.inert = !active; scene.setAttribute('aria-hidden', String(!active));
  if (!active) {
   gsap.set(scene, { clearProps: 'opacity,zIndex,pointerEvents' });
   gsap.set(scene.querySelector('.scene-inner'), { clearProps: 'transform,opacity' });
  }
 }
 gsap.set(to, { clearProps: 'opacity,zIndex,pointerEvents' }); to.inert = false;
 state.transitioning = false; startAmbient(to);
 if (!seek) { history.replaceState(null, '', `#${to.dataset.compositionId}`); scheduleAuto(); }
 if (queue !== null) { const target = queue; queue = null; if (target !== state.index) go(target); }
}
function pauseForOverlay() { stopAmbient(scenes[state.index]); clearTimeout(autoTimer); }
function setOverviewOpen(wanted) {
 if (wanted === menuWanted && (menuBusy || $('#overview').hidden === !wanted)) return menuPromise;
 menuWanted = wanted; menuBusy = true; const generation = ++menuGeneration;
 if (nav) { nav.hidden = true; nav.inert = true; }
 if (wanted) { pauseForOverlay(); sheet.inert = true; }
 const menuMotion = wanted ? museumMenu.open() : museumMenu.close();
 menuSheetTween?.kill();
 const sheetMotion = new Promise(resolve => {
  menuSheetTween = gsap.to(sheet, { yPercent: wanted ? -100 : 0, duration: reduced.matches ? 0 : 1.2, ease: 'power3.inOut', onComplete: () => resolve(true), onInterrupt: () => resolve(false) });
 });
 menuPromise = Promise.all([menuMotion, sheetMotion]).then(() => {
  if (generation !== menuGeneration) return false;
  menuBusy = false;
  if (!wanted) { sheet.inert = false; refreshMotion(); stage.focus({ preventScroll: true }); }
  return true;
 });
 return menuPromise;
}
function closeOverview() { return setOverviewOpen(false); }
function openOverview() { if (state.transitioning && !menuBusy) return Promise.resolve(false); return setOverviewOpen(true); }
function toggleOverview() { if (!menuWanted && state.transitioning && !menuBusy) return Promise.resolve(false); return setOverviewOpen(!menuWanted); }
function openArt(item) {
 $('#art-image').src = item.preview_src || item.src; $('#art-image').alt = item.alt;
 $('#art-caption').textContent = [item.artist, item.title, item.year, `Catalogue p. ${item.page}`].filter(Boolean).join(' / ');
 pauseForOverlay(); $('#art-dialog').showModal();
}
function openOfficePhoto(root, index) {
 const button = root.querySelectorAll('[data-office-photo]')[index], image = button?.querySelector('img');
 if (!image) return;
 $('#art-image').src = image.currentSrc || image.src; $('#art-image').alt = image.alt;
 $('#art-caption').textContent = [button.dataset.photoTitle, button.dataset.photoCredit].filter(Boolean).join(' / ');
 pauseForOverlay(); $('#art-dialog').showModal();
}
function fullscreen() {
 if (document.fullscreenElement) document.exitFullscreen?.();
 else document.documentElement.requestFullscreen?.().catch(() => {});
}
museumMenu = mountMuseumMenu($('#overview'), { scenes, getIndex: () => state.index, onSelect: async index => { await closeOverview(); await go(index); }, onClose: closeOverview });
document.addEventListener('click', event => {
 const button = event.target.closest('button'); if (!button) return;
 if (button.hasAttribute('data-next')) stepBy(1);
 if (button.hasAttribute('data-go')) go(button.dataset.go);
 if (button.hasAttribute('data-open-collection') && $('#collection-dialog')) { pauseForOverlay(); $('#collection-dialog').showModal(); }
 if (button.classList.contains('close-dialog')) button.closest('dialog')?.close();
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', refreshMotion);
for (const selector of ['#next', '#nav-next']) if ($(selector)) $(selector).onclick = () => stepBy(1);
for (const selector of ['#prev', '#nav-prev']) if ($(selector)) $(selector).onclick = () => stepBy(-1);
for (const selector of ['#overview-button', '#nav-menu']) if ($(selector)) $(selector).onclick = openOverview;
if ($('#autoplay-button')) $('#autoplay-button').onclick = () => { state.autoplay = !state.autoplay; updateChrome(); scheduleAuto(); };
if ($('#motion-button')) $('#motion-button').onclick = () => { state.motion = !state.motion; refreshMotion(); };
if ($('#fullscreen-button')) $('#fullscreen-button').onclick = fullscreen;
addEventListener('keydown', event => {
 if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
 if (!$('#overview').hidden || menuBusy) {
  if (event.key === 'Escape') { event.preventDefault(); closeOverview(); }
  else if (event.key.toLowerCase() === 'g') { event.preventDefault(); if (!event.repeat) toggleOverview(); }
  return;
 }
 if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
 if (event.key === 'ArrowRight' || event.key === 'PageDown' || (event.code === 'Space' && !event.target.closest('button,a'))) { event.preventDefault(); stepBy(1); }
 if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); stepBy(-1); }
 if (event.key === 'Home') { event.preventDefault(); go(0); }
 if (event.key === 'End') { event.preventDefault(); go(scenes.length - 1); }
 if (event.key.toLowerCase() === 'f') { event.preventDefault(); if (!event.repeat) fullscreen(); }
 if (event.key.toLowerCase() === 'g') { event.preventDefault(); if (!event.repeat) toggleOverview(); }
 if (event.key.toLowerCase() === 'm' && !event.repeat) { state.motion = !state.motion; refreshMotion(); }
});
let touch;
stage.addEventListener('touchstart', event => {
 if (event.target.closest('canvas,button,a,[data-wavy-accordion-init]')) return;
 touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
stage.addEventListener('touchend', event => {
 if (!touch) return;
 const dx = event.changedTouches[0].clientX - touch.x, dy = event.changedTouches[0].clientY - touch.y;
 touch = null;
 if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) stepBy(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener('visibilitychange', refreshMotion);
reduced.addEventListener('change', () => { state.motion = !reduced.matches; refreshMotion(); });
addEventListener('fullscreenchange', () => { setText('#fullscreen-button', document.fullscreenElement ? 'Exit full screen' : 'Full screen'); resize(); });
let quietTimer;
addEventListener('pointermove', () => {
 document.body.classList.remove('chrome-quiet'); clearTimeout(quietTimer);
 if (document.fullscreenElement) quietTimer = setTimeout(() => document.body.classList.add('chrome-quiet'), 3500);
}, { passive: true });

async function seekTime(time) {
 state.mode = 'seek'; state.autoplay = false; clearTimeout(autoTimer);
 const index = Math.max(0, scenes.findLastIndex(scene => Number(scene.dataset.start) <= time));
 await go(index, { instant: true, seek: true }); stopAmbient(scenes[index]); art?.setMotion(false);
 const local = Math.max(0, time - Number(scenes[index].dataset.start));
 timelines[scenes[index].dataset.compositionId].seek(local).pause();
 if (isCollection(scenes[index])) { art?.seek(local); art?.setFocus(0); }
 if (scenes[index].dataset.compositionId === 'office-art') officeAccordion?.seek(local);
 updateChrome();
}
addEventListener('hf-seek', event => { const promise = seekTime(Number(event.detail?.time) || 0); event.detail?.waitUntil?.(promise); });
const ready = (async () => {
 try {
  const response = await fetch('assets/art/manifest.json');
  if (!response.ok) throw new Error('The artwork catalogue could not be loaded.');
  artworks = await response.json();
  art = mountArtField($('#art-field'), artworks, { onSelect: openArt });
  $('#art-field').removeAttribute('aria-hidden');
 } catch (error) { console.warn(error); }
 const hash = decodeURIComponent(location.hash.slice(1));
 const initial = scenes.findIndex(scene => scene.dataset.compositionId === hash);
 await go(initial < 0 ? 0 : initial, { instant: true });
 return true;
})();
window.rbbDeck = {
 go, next: () => stepBy(1), prev: () => stepBy(-1), seek: seekTime, ready,
 get state() { return JSON.parse(JSON.stringify(state)); },
 get catalogueCount() { return artworks.length; },
 openMenu: openOverview, closeMenu: closeOverview,
 resumeLive() { state.mode = 'live'; refreshMotion(); }
};
