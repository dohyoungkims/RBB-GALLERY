/** A quiet photographic study of the original Ellen S. Clark Hope Plaza. */
export function createHopeGallery({ interval = 7000 } = {}) {
  const gsap = window.gsap;
  const root = document.querySelector('[data-hope-gallery]');
  if (!root) return { prepare: async () => {}, activate() {}, pause() {}, destroy() {} };

  const scene = root.closest('.scene');
  const frames = [...root.querySelectorAll('[data-hope-frame]')];
  const tabs = [...root.querySelectorAll('[data-hope-select]')];
  const caption = scene.querySelector('[data-hope-caption]');
  const count = scene.querySelector('[data-hope-count]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let current = 0, active = false, motion = true, hovered = false, focused = false;
  let timer = null, tween = null, destroyed = false, prepared;

  function settle() {
    tween?.kill();
    tween = null;
    frames.forEach((frame, index) => {
      const selected = index === current;
      gsap.set(frame, { opacity: selected ? 1 : 0, zIndex: selected ? 2 : 0 });
      frame.setAttribute('aria-hidden', String(!selected));
    });
  }
  function updateLabels() {
    tabs.forEach((tab, index) => {
      const selected = index === current;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    if (caption) caption.textContent = frames[current].dataset.caption;
    if (count) count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}`;
  }
  function schedule() {
    clearTimeout(timer);
    if (active && motion && !reduced.matches && !hovered && !focused && !document.hidden && !destroyed) {
      timer = setTimeout(() => select(current + 1), interval);
    }
  }
  function select(index, { animate = true } = {}) {
    const next = ((index % frames.length) + frames.length) % frames.length;
    if (destroyed || next === current) return;
    clearTimeout(timer);
    settle();
    const outgoing = frames[current];
    current = next;
    const incoming = frames[current];
    updateLabels();
    if (!animate || !active || !motion || reduced.matches) {
      settle();
      schedule();
      return;
    }
    incoming.setAttribute('aria-hidden', 'false');
    outgoing.setAttribute('aria-hidden', 'true');
    gsap.set(outgoing, { opacity: 1, zIndex: 1 });
    gsap.set(incoming, { opacity: 0, zIndex: 2 });
    tween = gsap.timeline({ onComplete: () => { settle(); schedule(); } });
    tween.to(incoming, { opacity: 1, duration: 1.05, ease: 'power1.inOut' }, 0);
    tween.to(outgoing, { opacity: 0, duration: 1.05, ease: 'power1.inOut' }, 0);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index), { signal });
    tab.addEventListener('keydown', event => {
      const actions = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: frames.length - 1 };
      if (!(event.key in actions)) return;
      event.preventDefault();
      event.stopPropagation();
      const next = (actions[event.key] + frames.length) % frames.length;
      select(next);
      tabs[next].focus();
    }, { signal });
  });
  root.addEventListener('pointerenter', () => { hovered = true; clearTimeout(timer); }, { signal });
  root.addEventListener('pointerleave', () => { hovered = false; schedule(); }, { signal });
  root.addEventListener('focusin', () => { focused = true; clearTimeout(timer); }, { signal });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) { focused = false; schedule(); }
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); settle(); }
    else schedule();
  }, { signal });
  reduced.addEventListener('change', () => { settle(); schedule(); }, { signal });
  settle();
  updateLabels();

  return {
    prepare(incoming = scene) {
      if (incoming !== scene) return Promise.resolve();
      prepared ||= Promise.allSettled([...root.querySelectorAll('img')].map(image => {
        image.loading = 'eager';
        return image.decode();
      }));
      return prepared;
    },
    activate(incoming, options = {}) {
      active = incoming === scene;
      motion = options.motion !== false;
      settle();
      schedule();
    },
    pause() { active = false; clearTimeout(timer); settle(); },
    destroy() { destroyed = true; active = false; clearTimeout(timer); settle(); controller.abort(); },
    select,
    get index() { return current; }
  };
}
