/**
 * Supporting-text reveal adapted from Osmo, Queued Scroll Reveal.
 * Licensed source: build/research/osmo/queued-js.txt (accessed 2026-10-14).
 * https://www.osmo.supply/resource/queued-scroll-reveal
 * The slide timeline replaces ScrollTrigger and delayed-call queue scheduling.
 */
const SELECTOR = [
  '.statement-tail', '.closing-note', '#spotlight-credit',
  '.voices-copy > p:not(.eyebrow)', '.model-copy', '.model-note',
  '.film-note', '.history-credit', '[data-queued-reveal]'
].join(',');
const MAX_ITEMS = 3;
const START = .1, STAGGER = .075, DURATION = .8, TRAVEL = '.65em';
const reducedByDefault = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function targetsFor(scene) {
  if (!scene?.querySelectorAll) throw new TypeError('Queued reveal requires a scene element.');
  if (scene.classList.contains('cover')) return [];
  return [...scene.querySelectorAll(SELECTOR)]
    .filter(el => !el.closest('h1,h2,h3,h4,h5,h6,button,a,canvas,video'))
    .filter(el => el.textContent.trim() && !el.hidden)
    .slice(0, MAX_ITEMS);
}

/**
 * Return a paused GSAP timeline without changing initial visibility.
 * instant/reducedMotion explicitly settle supporting text for static exports.
 */
export function createQueuedReveal(scene, {
  gsap = globalThis.gsap,
  reducedMotion = reducedByDefault(),
  instant = false
} = {}) {
  if (!gsap?.timeline) throw new TypeError('Queued reveal requires GSAP.');
  const targets = targetsFor(scene);
  const timeline = gsap.timeline({ paused: true });
  timeline.data = { kind: 'rbb-queued-reveal', count: targets.length, instant: !!(instant || reducedMotion) };
  if (!targets.length) return timeline;
  if (instant || reducedMotion) {
    gsap.set(targets, { clearProps: 'opacity,visibility,transform' });
    return timeline;
  }
  // This set is deferred until the parent reaches the child; construction stays visible.
  timeline.set(targets, { autoAlpha: 0, y: TRAVEL, immediateRender: false }, 0);
  targets.forEach((target, index) => {
    const at = START + index * STAGGER;
    const opacity = Number.parseFloat(getComputedStyle(target).opacity);
    timeline.fromTo(target, { autoAlpha: 0 }, {
      autoAlpha: Number.isFinite(opacity) ? opacity : 1,
      duration: DURATION, ease: 'power1.out', immediateRender: false
    }, at);
    timeline.fromTo(target, { y: TRAVEL }, {
      y: 0, duration: DURATION, ease: 'expo.out', immediateRender: false
    }, at);
    timeline.set(target, { clearProps: 'opacity,visibility,transform' }, at + DURATION);
  });
  return timeline;
}

/** Add the child before unpausing it, so the parent owns all playback/seeking. */
export function addQueuedReveal(parent, scene, { at = .18, ...options } = {}) {
  if (!parent?.add) throw new TypeError('Queued reveal requires a parent timeline.');
  const timeline = createQueuedReveal(scene, options);
  parent.add(timeline, at);
  timeline.paused(false);
  return timeline;
}
