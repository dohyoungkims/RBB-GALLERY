/** Shared reveal choreography. The same quiet rise and mask accompanies the
 * Osmo arc transition throughout the invitation, projects, art and space studies.
 * A single parent timeline owns every reveal; nothing continues off-slide.
 */
export const SCENE_MOTION = Object.freeze({ duration: 1.45, ease: 'power3.inOut' });

function elements(scene) {
  const heading = scene.querySelector('h1,h2,.source-invitation-copy');
  const labels = [...scene.querySelectorAll('.eyebrow,.invitation-cover__years')];
  const visuals = [...scene.querySelectorAll('.invitation-cover__architecture,.source-art-pair figure,.hope-gallery__viewport,.project-gallery__titles,.space-opportunity__reference,.space-opportunity__model,[data-scene-visual]')];
  const copy = [...scene.querySelectorAll('.source-statement__body > p,.invitation-cover__subtitle,.collaboration-invitation__lead,.collaboration-invitation__questions > p,.hope-gallery__story > p,.space-overview__copy > p,.space-opportunity__copy,.model-copy,.model-note,.statement-tail,.cover-caption,.closing-note,.voices-copy > p:not(.eyebrow),.source-caption,[data-queued-reveal]')]
    .filter((element, index, all) => element !== heading && all.indexOf(element) === index && !element.closest('[hidden]'));
  const controls = [...scene.querySelectorAll('.invitation-cover__begin,.scene-cta,.begin,.project-gallery__metadata,.project-gallery__ribbon,.project-gallery__navigation,.project-gallery__inspect,.project-gallery__index,.hope-gallery__tabs,.space-opportunity__options,.space-opportunity__controls')];
  return { heading, labels, visuals, copy, controls };
}

export function settleSceneReveal(scene) {
  const { heading, labels, visuals, copy, controls } = elements(scene);
  globalThis.gsap.set([heading, ...labels, ...visuals, ...copy, ...controls].filter(Boolean), {
    clearProps: 'opacity,visibility,transform,clipPath'
  });
}

export function addSceneReveal(parent, scene, { instant = false, direction = 1 } = {}) {
  if (instant) { settleSceneReveal(scene); return; }
  const gsap = globalThis.gsap;
  const { heading, labels, visuals, copy, controls } = elements(scene);
  const timeline = gsap.timeline({ defaults: { ease: 'power3.out', duration: .85 } });
  timeline.addLabel('label', .3).addLabel('image', .32).addLabel('title', .42).addLabel('copy', .56);
  // No per-character scatter or independent springs: one shared direction and beat.
  if (labels.length) timeline.fromTo(labels, { autoAlpha: 0, y: 12 * direction }, { autoAlpha: 1, y: 0, duration: .6 }, 'label');
  if (visuals.length) timeline.fromTo(visuals, { clipPath: 'inset(0% 0% 100% 0%)', y: 28 * direction }, {
    clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1, stagger: .06
  }, 'image');
  if (heading) timeline.fromTo(heading, { autoAlpha: 0, y: 35 * direction, clipPath: 'inset(0% 0% 100% 0%)' }, {
    autoAlpha: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: .95
  }, 'title');
  if (copy.length) timeline.fromTo(copy, { autoAlpha: 0, y: 18 * direction }, { autoAlpha: 1, y: 0, stagger: { amount: .16 }, duration: .72 }, 'copy');
  if (controls.length) timeline.fromTo(controls, { autoAlpha: 0, y: 10 * direction }, { autoAlpha: 1, y: 0, duration: .5 }, .85);
  timeline.call(() => settleSceneReveal(scene));
  parent.add(timeline, 0);
}
