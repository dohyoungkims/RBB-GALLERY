/** Cursor-driven variable type, with fixed glyph positions and no idle animation. */
export function mountVariableTitle(title, { surface, enabled = () => true } = {}) {
  const gsap = window.gsap;
  const BASE = 550, MIN = 100, MAX = 1000, RADIUS = 460;
  let active = false, loaded = false, cells = [], bounds, resizeFrame = 0, disposed = false;
  const original = title.innerHTML;
  const originalLabel = title.getAttribute('aria-label');
  const lines = [...title.children].map(line => line.textContent);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(any-pointer: fine)');
  const canMove = () => loaded && active && enabled() && !reduced.matches && fine.matches && !document.hidden;
  const ease = t => t * t * (3 - 2 * t);

  function settle(immediate = true) {
    for (const cell of cells) {
      if (immediate) { cell.to.tween.pause(); gsap.set(cell.ink, { fontWeight: BASE }); }
      else cell.to(BASE);
    }
  }
  function measure() {
    if (!loaded || disposed) return;
    // Fixed cell widths prevent animation from changing these cached positions.
    const rect = surface.getBoundingClientRect();
    bounds = { left: rect.left, top: rect.top, scale: rect.width / surface.clientWidth };
    const rects = cells.map(cell => cell.el.getBoundingClientRect());
    cells.forEach((cell, i) => {
      const r = rects[i];
      cell.x = (r.left + r.width / 2 - rect.left) / bounds.scale;
      cell.y = (r.top + r.height / 2 - rect.top) / bounds.scale;
    });
  }
  function queueMeasure() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(measure);
  }
  function move(event) {
    if (event.pointerType === 'touch' || !canMove() || !bounds?.scale) return;
    const x = (event.clientX - bounds.left) / bounds.scale;
    const y = (event.clientY - bounds.top) / bounds.scale;
    for (const cell of cells) {
      const distance = Math.hypot(x - cell.x, y - cell.y);
      const proximity = Math.max(0, Math.min(1, 1 - (distance - 48) / (RADIUS - 48)));
      cell.to(MIN + (MAX - MIN) * ease(proximity));
    }
  }
  function leave() { if (canMove()) settle(false); }
  function visibility() { if (document.hidden) settle(); }
  function preference() { settle(); }

  const ready = (async () => {
    const faces = await document.fonts.load('1000 224px "RBB Variable"', lines.join(' '));
    if (disposed || !faces.length) return false;
    const size = parseFloat(getComputedStyle(title).fontSize);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fontKerning = 'none';
    const fragment = document.createDocumentFragment();
    for (const text of lines) {
      const line = document.createElement('span');
      line.className = 'weight-line'; line.setAttribute('aria-hidden', 'true');
      for (const [index, char] of [...text].entries()) {
        const el = document.createElement('span'), ink = document.createElement('span');
        el.className = 'weight-cell'; ink.className = 'weight-glyph';
        ink.textContent = char === ' ' ? '\u00a0' : char;
        ink.style.fontWeight = String(BASE);
        let width = 0;
        for (const weight of [MIN, BASE, MAX]) {
          ctx.font = `${weight} ${size}px "RBB Variable"`;
          width = Math.max(width, ctx.measureText(char).width);
        }
        el.style.width = `${width.toFixed(3)}px`;
        if (index) el.style.marginLeft = `${-size * .035}px`;
        el.append(ink); line.append(el);
        if (char !== ' ') cells.push({ el, ink, to: gsap.quickTo(ink, 'fontWeight', { duration: .65, ease: 'power3.out' }) });
      }
      fragment.append(line);
    }
    title.replaceChildren(fragment);
    title.setAttribute('aria-label', lines.join(' '));
    title.classList.add('variable-title');
    loaded = true; title.dataset.variableType = 'ready';
    measure(); return true;
  })().catch(error => { console.warn('Variable headline unavailable; original type retained.', error); return false; });

  surface.addEventListener('pointermove', move, { passive: true });
  surface.addEventListener('pointerleave', leave, { passive: true });
  addEventListener('resize', queueMeasure);
  document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', preference); fine.addEventListener('change', preference);
  return {
    ready,
    setActive(value) { active = !!value; if (!active || !enabled()) settle(); else queueMeasure(); },
    reset() { settle(); },
    get stats() { return { loaded, active: canMove(), glyphs: cells.length, min: MIN, max: MAX, rest: BASE }; },
    dispose() {
      disposed = true; cancelAnimationFrame(resizeFrame);
      for (const cell of cells) cell.to.tween.kill();
      surface.removeEventListener('pointermove', move); surface.removeEventListener('pointerleave', leave);
      removeEventListener('resize', queueMeasure); document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', preference); fine.removeEventListener('change', preference);
      title.innerHTML = original; title.classList.remove('variable-title'); delete title.dataset.variableType;
      if (originalLabel === null) title.removeAttribute('aria-label'); else title.setAttribute('aria-label', originalLabel);
    }
  };
}
