/**
 * Osmo Collage Focus Card on Hover, adapted for the RBB presentation.
 * Licensed source: build/seminal-research/osmo/collage-preview-source.js.
 * Retains Osmo's geometry, scales, neighbor falloff and 0.8-second move curve.
 * Lifecycle, keyboard focus and the project viewer are presentation additions.
 */
const SELECTORS = {
  root: '[data-interactive-collage-init]',
  list: '[data-interactive-collage-list]',
  item: '[data-interactive-collage-item]',
  inner: '[data-interactive-collage-item-inner]',
  button: 'button[data-project-id]',
};

// The exact CSS/CustomEase cubic curve from Osmo, without another runtime plugin.
function moveEase(progress) {
  if (progress <= 0 || progress >= 1) return progress;
  const bezier = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0, high = 1, t = progress;
  for (let i = 0; i < 16; i++) {
    if (bezier(t, .3, 0) < progress) low = t;
    else high = t;
    t = (low + high) / 2;
  }
  return bezier(t, .075, 1);
}

export function createSeminalProjects({ onOpen, onClose } = {}) {
  const gsap = window.gsap;
  const controller = new AbortController();
  const { signal } = controller;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const bindings = new Map();
  let activeScene = null, motion = true, destroyed = false;
  let projectMap = new Map(), loadError = false, returnFocus = null;
  let dialogIds = [], dialogIndex = 0, viewGeneration = 0, currentProject = null;

  const ready = fetch('assets/projects/projects.json', { signal })
    .then(response => { if (!response.ok) throw new Error(`Project manifest: ${response.status}`); return response.json(); })
    .then(data => { projectMap = new Map((Array.isArray(data) ? data : data.projects || []).map(project => [project.id, project])); })
    .catch(error => { if (error.name !== 'AbortError') { loadError = true; console.warn('Seminal project details unavailable.', error); } });

  const dialog = document.createElement('dialog');
  dialog.className = 'seminal-project-dialog';
  dialog.setAttribute('aria-labelledby', 'seminal-project-title');
  dialog.innerHTML = `
    <div class="seminal-project-dialog__bar">
      <p>SEMINAL PROJECTS</p>
      <button type="button" class="seminal-project-dialog__close" aria-label="Close project details">Close <span aria-hidden="true">×</span></button>
    </div>
    <div class="seminal-project-dialog__body">
      <figure class="seminal-project-dialog__figure"><img alt=""><figcaption></figcaption></figure>
      <div class="seminal-project-dialog__copy">
        <p class="seminal-project-dialog__location"></p>
        <h2 id="seminal-project-title"></h2>
        <p class="seminal-project-dialog__meaning"></p>
        <p class="seminal-project-dialog__scope"></p>
        <a class="seminal-project-dialog__source" target="_blank" rel="noopener noreferrer">View project on Clayco <span aria-hidden="true">↗</span></a>
        <div class="seminal-project-dialog__members" aria-label="Projects in this group" hidden></div>
      </div>
    </div>
    <div class="seminal-project-dialog__navigation">
      <button type="button" data-project-direction="-1" aria-label="Previous project">← Previous</button>
      <p class="seminal-project-dialog__count" aria-live="polite"></p>
      <button type="button" data-project-direction="1" aria-label="Next project">Next →</button>
    </div>`;
  document.body.append(dialog);
  const closeButton = dialog.querySelector('.seminal-project-dialog__close');
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const title = dialog.querySelector('h2');
  const location = dialog.querySelector('.seminal-project-dialog__location');
  const meaning = dialog.querySelector('.seminal-project-dialog__meaning');
  const scope = dialog.querySelector('.seminal-project-dialog__scope');
  const source = dialog.querySelector('.seminal-project-dialog__source');
  const members = dialog.querySelector('.seminal-project-dialog__members');
  const count = dialog.querySelector('.seminal-project-dialog__count');

  function setSource(url) {
    // Project links are evidence, and all expected sources are the public Clayco site.
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !/(^|\.)claycorp\.com$/.test(parsed.hostname)) throw new Error('Unsupported source');
      source.href = parsed.href;
      source.hidden = false;
    } catch { source.removeAttribute('href'); source.hidden = true; }
  }
  function showImage(record) {
    // A member without photography may use the overview image, but its caption
    // must continue to identify the project actually pictured.
    const pictured = record.image ? record : currentProject;
    image.src = pictured?.image || '';
    image.alt = pictured?.title || 'Clayco project';
    caption.textContent = [pictured?.title, pictured?.imageType].filter(Boolean).join(' / ');
    setSource(record.url || currentProject?.url);
  }
  function showDetails(record) {
    title.textContent = record.title || '';
    location.textContent = record.location || '';
    location.hidden = !record.location;
    meaning.textContent = record.significance || '';
    meaning.hidden = !record.significance;
    scope.textContent = record.scope || '';
    scope.hidden = !record.scope;
    showImage(record);
  }
  function fallbackProject(id) {
    const button = [...document.querySelectorAll(SELECTORS.button)].find(item => item.dataset.projectId === id);
    return { id, title: button?.getAttribute('aria-label') || button?.textContent.trim() || 'Project', image: button?.querySelector('img')?.getAttribute('src'), scope: loadError ? 'Project details are unavailable. Please try opening the presentation again.' : '' };
  }
  async function renderProject(index) {
    const generation = ++viewGeneration;
    dialogIndex = Math.max(0, Math.min(dialogIds.length - 1, index));
    const id = dialogIds[dialogIndex];
    currentProject = projectMap.get(id) || fallbackProject(id);
    members.replaceChildren();
    members.hidden = true;
    showDetails(currentProject);
    count.textContent = `${String(dialogIndex + 1).padStart(2, '0')} / ${String(dialogIds.length).padStart(2, '0')}`;
    dialog.querySelector('[data-project-direction="-1"]').disabled = dialogIndex === 0;
    dialog.querySelector('[data-project-direction="1"]').disabled = dialogIndex === dialogIds.length - 1;
    await ready;
    if (destroyed || !dialog.open || generation !== viewGeneration) return;
    currentProject = projectMap.get(id) || fallbackProject(id);
    showDetails(currentProject);
    const grouped = currentProject.members || [];
    members.hidden = grouped.length === 0;
    if (grouped.length) {
      const overview = document.createElement('button');
      overview.type = 'button';
      overview.textContent = 'Overview';
      overview.setAttribute('aria-pressed', 'true');
      overview.addEventListener('click', () => {
        for (const sibling of members.children) sibling.setAttribute('aria-pressed', String(sibling === overview));
        showDetails(currentProject);
      }, { signal });
      members.append(overview);
    }
    grouped.forEach(member => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = member.title;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        for (const sibling of members.children) sibling.setAttribute('aria-pressed', String(sibling === button));
        showDetails(member);
      }, { signal });
      members.append(button);
    });
    dialog.querySelector('.seminal-project-dialog__copy').scrollTop = 0;
  }
  function openProject(button) {
    if (destroyed || !activeScene || !activeScene.contains(button)) return;
    returnFocus = button;
    dialogIds = [...activeScene.querySelectorAll(SELECTORS.button)].map(item => item.dataset.projectId);
    const index = dialogIds.indexOf(button.dataset.projectId);
    for (const binding of bindings.values()) binding.reset(true);
    // Open first, so the deck's overlay check sees the modal in onOpen.
    if (!dialog.open) dialog.showModal();
    onOpen?.();
    renderProject(index);
    closeButton.focus({ preventScroll: true });
  }
  closeButton.addEventListener('click', () => dialog.close(), { signal });
  dialog.addEventListener('close', () => {
    viewGeneration++;
    if (destroyed) return;
    onClose?.();
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]') && returnFocus.closest('.scene.active')) returnFocus.focus({ preventScroll: true });
  }, { signal });
  dialog.addEventListener('click', event => {
    const direction = event.target.closest('[data-project-direction]');
    if (direction) renderProject(dialogIndex + Number(direction.dataset.projectDirection));
  }, { signal });
  dialog.addEventListener('keydown', event => {
    if (!dialog.open || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    renderProject(dialogIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }, { signal });

  function bindRow(root, scene) {
    const list = root.querySelector(SELECTORS.list);
    const items = [...root.querySelectorAll(SELECTORS.item)];
    if (!list || !items.length) return;
    let activeItem = null;
    const inner = item => item.querySelector(SELECTORS.inner);
    const animated = items.map(inner).filter(Boolean);
    const enabled = () => activeScene === scene && !dialog.open && !destroyed;
    const animate = (item, xPercent, yPercent, scale, immediate = false) => {
      const target = inner(item);
      if (!target) return;
      const still = immediate || !motion || reduced.matches;
      if (gsap && still) { gsap.killTweensOf(target); gsap.set(target, { xPercent, yPercent, scale }); }
      else if (gsap) gsap.to(target, { xPercent, yPercent, scale, duration: .8, ease: moveEase, overwrite: true });
      else target.style.transform = `translate(${xPercent}%, ${yPercent}%) scale(${scale})`;
    };
    const reset = (immediate = false) => {
      activeItem = null;
      for (const item of items) {
        item.removeAttribute('data-interactive-collage-focus');
        animate(item, 0, 0, 1, immediate);
      }
    };
    const focusItem = active => {
      if (!enabled() || activeItem === active) return;
      activeItem = active;
      for (const item of items) item.toggleAttribute('data-interactive-collage-focus', item === active);
      // Motion-off keeps the same static composition; a focus outline carries emphasis.
      if (!motion || reduced.matches) return;
      const activeScale = 1.075, inactiveScale = .9;
      const listRect = list.getBoundingClientRect();
      if (!listRect.width || !listRect.height) return;
      const listCenterY = listRect.top + listRect.height / 2;
      const gap = listRect.width * .03;
      const ordered = [...items].sort((a, b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return ar.left + ar.width / 2 - br.left - br.width / 2;
      });
      const activeIndex = ordered.indexOf(active), activeRect = active.getBoundingClientRect();
      const activeCenterX = activeRect.left + activeRect.width / 2;
      const activeLeft = activeCenterX - activeRect.width * activeScale / 2;
      const activeRight = activeCenterX + activeRect.width * activeScale / 2;
      let leftMove = 0, rightMove = 0;
      const left = ordered[activeIndex - 1], right = ordered[activeIndex + 1];
      if (left) { const rect = left.getBoundingClientRect(); leftMove = Math.min(0, activeLeft - gap - (rect.left + rect.width / 2 + rect.width * inactiveScale / 2)); }
      if (right) { const rect = right.getBoundingClientRect(); rightMove = Math.max(0, activeRight + gap - (rect.left + rect.width / 2 - rect.width * inactiveScale / 2)); }
      ordered.forEach((item, index) => {
        if (item === active) { animate(item, 0, 0, activeScale); return; }
        const rect = item.getBoundingClientRect();
        if (!rect.width) return;
        const difference = index - activeIndex, distance = Math.abs(difference);
        let strength = 1 / (1 + Math.pow(distance - 1, 1.2) * .45);
        if (distance === 2) strength *= 1.35;
        const centerProgress = (listCenterY - rect.top - rect.height / 2) / (listRect.height / 2);
        const moveX = (difference < 0 ? leftMove : rightMove) * strength;
        animate(item, moveX / rect.width * 100, 25 * centerProgress * strength, inactiveScale - (1 - strength) * .12);
      });
    };
    root.addEventListener('pointermove', event => {
      if (!enabled() || !finePointer.matches || event.pointerType === 'touch') return;
      let hovered = null;
      if (activeItem) {
        const rect = inner(activeItem).getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) hovered = activeItem;
      }
      if (!hovered) hovered = document.elementFromPoint(event.clientX, event.clientY)?.closest(SELECTORS.item);
      if (hovered && root.contains(hovered)) focusItem(hovered);
      else reset();
    }, { signal });
    root.addEventListener('pointerleave', () => { if (!root.contains(document.activeElement)) reset(); }, { signal });
    root.addEventListener('focusin', event => { const item = event.target.closest(SELECTORS.item); if (item) focusItem(item); }, { signal });
    root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) reset(); }, { signal });
    root.addEventListener('click', event => {
      const button = event.target.closest(SELECTORS.button);
      if (button && root.contains(button)) { event.stopPropagation(); openProject(button); }
    }, { signal });
    const binding = { reset, destroy() { gsap?.killTweensOf(animated); reset(true); } };
    bindings.set(root, binding);
    return binding;
  }
  function pause() {
    activeScene = null;
    for (const binding of bindings.values()) binding.reset(true);
  }
  function activate(scene, { motion: animate = true } = {}) {
    if (destroyed) return;
    if (!scene?.matches('.seminal-projects')) { pause(); return; }
    if (activeScene !== scene) for (const binding of bindings.values()) binding.reset(true);
    activeScene = scene;
    motion = Boolean(animate);
    scene.classList.toggle('seminal-projects--still', !motion || reduced.matches);
    for (const root of scene.querySelectorAll(SELECTORS.root)) if (!bindings.has(root)) bindRow(root, scene);
    if (!motion || reduced.matches) for (const binding of bindings.values()) binding.reset(true);
  }
  reduced.addEventListener('change', () => { if (activeScene) activate(activeScene, { motion }); }, { signal });
  return {
    activate, pause,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      viewGeneration++;
      controller.abort();
      for (const binding of bindings.values()) binding.destroy();
      bindings.clear();
      if (dialog.open) dialog.close();
      dialog.remove();
      projectMap.clear();
    },
  };
}
