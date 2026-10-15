/**
 * Osmo Layered Image Slider, adapted for a bounded presentation chapter.
 * Source: https://www.osmo.supply/resource/layered-image-slider
 * Exact downloaded implementation: build/seminal-research/osmo/layered-preview-source.js.
 * Retains wrapped progress, background crossfade, title spacing, mask travel and
 * the source's one-second cubic curve. Scoped controls and the project index
 * replace Observer/autoplay so the presenter keeps control of the narrative.
 */
const pad = value => String(value).padStart(2, '0');

// Evaluate Osmo's M0,0 C0.625,0.05 0,1 1,1 without requiring CustomEase.
function osmoEase(progress) {
  if (progress <= 0 || progress >= 1) return progress;
  const cubic = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0, high = 1, t = progress;
  for (let step = 0; step < 20; step++) {
    if (cubic(t, .625, 0) < progress) low = t;
    else high = t;
    t = (low + high) / 2;
  }
  return cubic(t, .05, 1);
}

export function mountProjectGallery(scene, { getProject, ready, onInspect } = {}) {
  const originals = [...scene.querySelectorAll('[data-interactive-collage-init] button[data-project-id]')];
  const ids = [...new Set(originals.map(button => button.dataset.projectId))];
  if (!ids.length) return { activate() {}, pause() {}, destroy() {}, getIds: () => [] };
  const fallback = new Map(originals.map(button => {
    const caption = button.querySelector('.seminal-projects__caption');
    const label = caption?.cloneNode(true);
    label?.querySelector('small')?.remove();
    return [button.dataset.projectId, {
      id: button.dataset.projectId,
      title: label?.textContent.trim() || button.getAttribute('aria-label') || 'Clayco project',
      image: button.querySelector('img')?.getAttribute('src') || '',
      location: caption?.querySelector('small')?.textContent.trim() || '',
    }];
  }));
  const record = id => getProject?.(id) || fallback.get(id);
  const controller = new AbortController(), { signal } = controller;
  const gsap = window.gsap;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = false, moving = true, destroyed = false, tween = null;
  let activeIndex = -1, current = 0, titleStep = 960, maskStep = 280;
  let pointerStart = null, suppressClick = false;
  const state = { progress: 0 };
  const wrap = distance => distance - ids.length * Math.round(distance / ids.length);
  const rows = [...scene.querySelectorAll('[data-interactive-collage-init]')];
  const rowStates = rows.map(row => ({ row, hidden: row.hidden, inert: row.inert }));
  rows.forEach(row => { row.hidden = true; row.inert = true; });
  scene.classList.add('seminal-projects--layered');

  const root = document.createElement('div');
  root.className = 'project-gallery';
  root.dataset.layeredSliderInit = '';
  root.dataset.layeredSliderAutoplay = '0';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Explore projects in this chapter');
  root.innerHTML = `
    <div class="project-gallery__backgrounds" aria-hidden="true"></div>
    <div class="project-gallery__shade" aria-hidden="true"></div>
    <div class="project-gallery__canvas">
      <div class="project-gallery__titles"></div>
      <p class="project-gallery__metadata"></p>
      <div class="project-gallery__ribbon" aria-label="Project photographs">
        <div class="project-gallery__mask" data-layered-slider-mask></div>
      </div>
      <div class="project-gallery__navigation">
        <button type="button" data-layered-slider-prev aria-label="Previous project"><span aria-hidden="true">←</span></button>
        <p><span data-layered-slider-current>01</span><span class="project-gallery__divider"> / </span><span data-layered-slider-total>${pad(ids.length)}</span></p>
        <button type="button" data-layered-slider-next aria-label="Next project"><span aria-hidden="true">→</span></button>
      </div>
      <button type="button" class="project-gallery__inspect">View project <span aria-hidden="true">↗</span></button>
      <div class="project-gallery__index" aria-label="All projects in this chapter"></div>
      <p class="project-gallery__announcement" aria-live="polite" aria-atomic="true"></p>
    </div>`;
  scene.prepend(root);
  const canvas = root.querySelector('.project-gallery__canvas');
  const backgroundList = root.querySelector('.project-gallery__backgrounds');
  const titleList = root.querySelector('.project-gallery__titles');
  const maskFrame = root.querySelector('[data-layered-slider-mask]');
  const indexList = root.querySelector('.project-gallery__index');
  const metadata = root.querySelector('.project-gallery__metadata');
  const inspect = root.querySelector('.project-gallery__inspect');
  const currentEl = root.querySelector('[data-layered-slider-current]');
  const announcement = root.querySelector('.project-gallery__announcement');
  const backgrounds = [], titles = [], maskItems = [], indexButtons = [];
  indexList.style.setProperty('--project-columns', ids.length > 8 ? 5 : ids.length > 6 ? 4 : 3);

  ids.forEach((id, index) => {
    const background = document.createElement('img');
    background.dataset.layeredSliderBg = '';
    background.alt = '';
    background.decoding = 'async';
    background.draggable = false;
    backgroundList.append(background);
    backgrounds.push(background);
    const title = document.createElement('button');
    title.type = 'button';
    title.dataset.layeredSliderTitle = '';
    title.dataset.projectId = id;
    title.className = 'project-gallery__title';
    titleList.append(title);
    titles.push(title);
    const mask = document.createElement('button');
    mask.type = 'button';
    mask.dataset.layeredSliderMaskItem = '';
    mask.className = 'project-gallery__thumbnail';
    const thumb = document.createElement('img');
    thumb.alt = '';
    thumb.decoding = 'async';
    thumb.draggable = false;
    mask.append(thumb);
    maskFrame.append(mask);
    maskItems.push(mask);
    const indexButton = document.createElement('button');
    indexButton.type = 'button';
    indexButton.className = 'project-gallery__index-item';
    indexButton.innerHTML = `<span class="project-gallery__index-number">${pad(index + 1)}</span><span class="project-gallery__index-name"></span>`;
    indexList.append(indexButton);
    indexButtons.push(indexButton);
    title.addEventListener('click', event => {
      event.stopPropagation();
      if (!enabled || suppressClick) return;
      if (index === activeIndex) onInspect?.(title);
      else goToIndex(index);
    }, { signal });
    mask.addEventListener('click', event => { event.stopPropagation(); if (enabled) goToIndex(index); }, { signal });
    indexButton.addEventListener('click', event => { event.stopPropagation(); if (enabled) goToIndex(index); }, { signal });
  });

  const setPosition = (element, x, opacity, centered = false) => {
    if (gsap) gsap.set(element, { x, ...(centered ? { xPercent: -50 } : {}), ...(opacity === undefined ? {} : { opacity }) });
    else { element.style.transform = `${centered ? 'translateX(-50%) ' : ''}translateX(${x}px)`; if (opacity !== undefined) element.style.opacity = opacity; }
  };
  function showCurrent(index) {
    const focusedTitle = titles.includes(document.activeElement);
    const focusedThumbnail = maskItems.includes(document.activeElement);
    const project = record(ids[index]);
    metadata.textContent = [project.location, project.imageType].filter(Boolean).join(' / ');
    inspect.dataset.projectId = ids[index];
    inspect.setAttribute('aria-label', `View details: ${project.title}`);
    currentEl.textContent = pad(index + 1);
    announcement.textContent = `${index + 1} of ${ids.length}. ${project.title}. ${project.location || ''}`;
    [backgrounds, titles, maskItems, indexButtons].forEach(list => list.forEach((element, i) => element.toggleAttribute('data-active', i === index)));
    indexButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (enabled && focusedTitle) titles[index].focus({ preventScroll: true });
    else if (enabled && focusedThumbnail) maskItems[index].focus({ preventScroll: true });
  }
  function render(progress) {
    const centeredIndex = ((Math.round(progress) % ids.length) + ids.length) % ids.length;
    for (let i = 0; i < ids.length; i++) {
      const offset = wrap(i - progress);
      const opacity = Math.max(0, Math.min(1, 1 - Math.abs(offset)));
      // Source backgroundZoom is zero: architecture remains still during the crossfade.
      backgrounds[i].style.opacity = opacity;
      backgrounds[i].style.zIndex = Math.round(opacity * 100);
      setPosition(titles[i], offset * titleStep, i === centeredIndex ? 1 : .4, true);
      setPosition(maskItems[i], offset * maskStep);
      // Only the current title and adjacent thumbnails enter the tab order.
      titles[i].tabIndex = i === centeredIndex ? 0 : -1;
      maskItems[i].tabIndex = Math.abs(wrap(i - centeredIndex)) <= 1 ? 0 : -1;
      titles[i].setAttribute('aria-hidden', String(Math.abs(offset) > 1.5));
    }
    if (centeredIndex !== activeIndex) { activeIndex = centeredIndex; showCurrent(centeredIndex); }
  }
  function measure() {
    if (destroyed) return;
    const widestTitle = Math.max(...titles.map(title => title.offsetWidth));
    titleStep = Math.max(canvas.clientWidth * .5, widestTitle + 40);
    maskStep = maskFrame.clientWidth;
    render(state.progress);
  }
  function hydrate() {
    if (destroyed) return;
    ids.forEach((id, index) => {
      const project = record(id), name = project.shortTitle || project.title;
      backgrounds[index].src = project.image;
      maskItems[index].querySelector('img').src = project.image;
      maskItems[index].setAttribute('aria-label', `Show ${name}`);
      titles[index].textContent = name;
      titles[index].setAttribute('aria-label', `View details: ${project.title}`);
      indexButtons[index].querySelector('.project-gallery__index-name').textContent = name;
      indexButtons[index].setAttribute('aria-label', `Show ${project.title}`);
    });
    if (activeIndex >= 0) showCurrent(activeIndex);
    measure();
  }
  function goTo(delta) {
    if (!enabled || destroyed || !delta) return;
    current += delta;
    tween?.kill();
    if (!gsap || !moving || reduced.matches) {
      state.progress = current;
      render(current);
      return;
    }
    tween = gsap.to(state, { progress: current, duration: 1, ease: osmoEase, onUpdate: () => render(state.progress) });
  }
  function goToIndex(index) { goTo(wrap(index - current)); }
  root.querySelector('[data-layered-slider-prev]').addEventListener('click', event => { event.stopPropagation(); goTo(-1); }, { signal });
  root.querySelector('[data-layered-slider-next]').addEventListener('click', event => { event.stopPropagation(); goTo(1); }, { signal });
  inspect.addEventListener('click', event => { event.stopPropagation(); if (enabled) onInspect?.(inspect); }, { signal });
  root.addEventListener('keydown', event => {
    if (!enabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Home') goToIndex(0);
    else if (event.key === 'End') goToIndex(ids.length - 1);
    else goTo(event.key === 'ArrowRight' ? 1 : -1);
  }, { signal });
  // The deck has its own touch navigation. Keep a gallery swipe inside this chapter.
  root.addEventListener('touchstart', event => event.stopPropagation(), { signal, passive: true });
  root.addEventListener('touchend', event => event.stopPropagation(), { signal, passive: true });
  root.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { signal, capture: true });
  root.addEventListener('pointerdown', event => {
    if (!enabled || event.button !== 0 || event.target.closest('.project-gallery__index,.project-gallery__navigation,.project-gallery__inspect')) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { signal });
  root.addEventListener('pointerup', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      suppressClick = true;
      goTo(dx < 0 ? 1 : -1);
      setTimeout(() => { suppressClick = false; }, 0);
    }
  }, { signal });
  root.addEventListener('pointercancel', () => { pointerStart = null; }, { signal });
  window.addEventListener('resize', measure, { signal });
  document.fonts?.ready.then(() => { if (!destroyed) measure(); });
  Promise.resolve(ready).then(hydrate);
  hydrate();

  return {
    getIds: () => [...ids],
    activate({ motion = true } = {}) {
      enabled = true;
      moving = Boolean(motion);
      root.classList.toggle('project-gallery--still', !moving || reduced.matches);
      if (!moving || reduced.matches) { tween?.kill(); state.progress = current; }
      measure();
    },
    pause() {
      enabled = false;
      pointerStart = null;
      tween?.kill();
      state.progress = current;
      render(current);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      tween?.kill();
      rowStates.forEach(({ row, hidden, inert }) => { row.hidden = hidden; row.inert = inert; });
      root.remove();
      scene.classList.remove('seminal-projects--layered');
    },
  };
}
