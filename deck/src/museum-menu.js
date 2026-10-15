/**
 * RBB adaptation of Osmo's licensed Footer with Parallax Effect and Underline
 * Link. Source supplied through the user's Osmo account; see
 * build/research/osmo/MUSEUM_MENU_README.md. Original logo/content excluded.
 */
const GROUPS = [
  { title: 'Invitation', ids: ['invitation-cover', 'living-portrait', 'why-we-build', 'partner-invitation'] },
  { title: 'Seminal projects', ids: ['projects-civic', 'projects-work', 'projects-care', 'projects-industry'] },
  { title: 'Collaboration', ids: ['hope-plaza', 'collection', 'office-art', 'collection-artists', 'possibility'] },
];
const LABELS = {
  'invitation-cover': 'How vision takes form', 'living-portrait': 'A living portrait',
  'why-we-build': 'Why we build', 'partner-invitation': 'The invitation',
  'projects-civic': 'Life and community', 'projects-work': 'Work and connection',
  'projects-care': 'Care and discovery', 'projects-industry': 'Making what comes next',
  'hope-plaza': 'A place for hope', collection: 'The Clark Collection',
  'office-art': 'Art in our spaces', 'collection-artists': 'Artists and perspectives',
  possibility: 'Imagine together',
};

function loadStyles() {
  const href = new URL('../museum-menu.css', import.meta.url).href;
  if ([...document.styleSheets].some(sheet => sheet.href === href)) return Promise.resolve();
  let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(item => item.href === href);
  return new Promise(resolve => {
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.museumMenuStyles = '';
      document.head.append(link);
    }
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

/** Callbacks request owner actions so the menu and deck lift can run together. */
export function mountMuseumMenu(host, { scenes = [], onSelect, onClose, getIndex = () => 0 } = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('mountMuseumMenu requires a host element.');
  const gsap = window.gsap;
  if (!gsap) throw new Error('The museum menu requires the existing GSAP runtime.');
  const stylesReady = loadStyles();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const signal = controller.signal;
  const original = { html: host.innerHTML, className: host.className, hidden: host.hidden, inert: host.inert, role: host.getAttribute('role'), label: host.getAttribute('aria-label'), modal: host.getAttribute('aria-modal'), ariaHidden: host.getAttribute('aria-hidden') };
  let phase = 'closed', disposed = false, returnFocus = null, currentIndex = 0;
  let requestGeneration = 0;
  let timeline = null, finishMotion = null, motionPromise = Promise.resolve(true);

  host.classList.add('museum-menu');
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'Clayco exhibition menu');
  host.setAttribute('aria-hidden', 'true');
  host.hidden = true;
  host.inert = true;
  host.innerHTML = `
    <div class="museum-menu__inner" data-footer-parallax-inner>
      <div class="museum-menu__top-row">
        <p class="museum-menu__menu-label">MENU</p>
        <button class="museum-menu__close" type="button" aria-label="Close menu"><span data-museum-underline>Close</span><span class="museum-menu__close-icon" aria-hidden="true">×</span></button>
      </div>
      <nav class="museum-menu__links-row" aria-label="Presentation chapters"></nav>
      <div class="museum-menu__logo-row">
        <p class="museum-menu__eyebrow museum-menu__tagline">How vision takes form</p>
        <svg class="museum-menu__wordmark" viewBox="0 0 1360 180" role="img" aria-label="Clayco" focusable="false"><text x="0" y="164" textLength="1360" lengthAdjust="spacingAndGlyphs">CLAYCO</text></svg>
      </div>
    </div>
    <div class="museum-menu__shade" data-footer-parallax-dark aria-hidden="true"></div>`;

  const inner = host.querySelector('.museum-menu__inner');
  const shade = host.querySelector('.museum-menu__shade');
  const closeButton = host.querySelector('.museum-menu__close');
  const linksRow = host.querySelector('.museum-menu__links-row');
  const buttons = new Map();
  const sceneList = Array.from(scenes);

  for (const group of GROUPS) {
    const column = document.createElement('div');
    column.className = 'museum-menu__col';
    const label = document.createElement('p');
    label.className = 'museum-menu__eyebrow';
    label.textContent = `( ${group.title} )`;
    const links = document.createElement('div');
    links.className = 'museum-menu__links';
    for (const id of group.ids) {
      const index = sceneList.findIndex(scene => (scene.dataset?.compositionId || scene.sceneId) === id);
      if (index < 0) continue;
      const scene = sceneList[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'museum-menu__link';
      button.dataset.menuIndex = String(index);
      button.dataset.menuScene = id;
      const number = document.createElement('span');
      number.className = 'museum-menu__number';
      number.textContent = String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'museum-menu__link-label';
      name.dataset.museumUnderline = '';
      name.textContent = scene.dataset?.menuLabel || scene.menuLabel || LABELS[id] || scene.dataset?.label || scene.label;
      const fullLabel = scene.dataset?.label || scene.label || name.textContent;
      button.setAttribute('aria-label', `Slide ${index + 1}: ${fullLabel}`);
      button.append(number, name);
      button.addEventListener('click', () => onSelect?.(index), { signal });
      links.append(button);
      buttons.set(index, button);
    }
    column.append(label, links);
    linksRow.append(column);
  }

  function requestClose() {
    if (onClose) onClose();
    else close();
  }
  closeButton.addEventListener('click', requestClose, { signal });

  function focusables() {
    return [...host.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(el => !el.hidden && el.getClientRects().length);
  }
  function focusCurrent() {
    (buttons.get(currentIndex) || closeButton).focus({ preventScroll: true });
  }
  document.addEventListener('keydown', event => {
    if (phase === 'closed' || disposed) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      requestClose();
    } else if (event.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const outside = !host.contains(document.activeElement);
      if (outside || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    }
  }, { capture: true, signal });
  document.addEventListener('focusin', event => {
    if ((phase === 'open' || phase === 'opening') && !host.contains(event.target)) focusCurrent();
  }, { signal });

  function setIndex(index) {
    if (!Number.isInteger(Number(index))) return;
    currentIndex = Number(index);
    for (const [i, button] of buttons) {
      if (i === currentIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
  }
  function stopMotion() {
    timeline?.kill();
    timeline = null;
    finishMotion?.(false);
    finishMotion = null;
  }
  function animate(opening) {
    stopMotion();
    motionPromise = new Promise(resolve => {
      finishMotion = resolve;
      timeline = gsap.timeline({ onComplete: () => {
        timeline = null;
        finishMotion = null;
        phase = opening ? 'open' : 'closed';
        host.dataset.menuState = phase;
        if (opening) focusCurrent();
        else {
          host.hidden = true;
          host.inert = true;
          host.setAttribute('aria-hidden', 'true');
          requestAnimationFrame(() => {
            if (!disposed && phase === 'closed' && returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
          });
        }
        resolve(true);
      } });
      const duration = reduced.matches ? 0 : 1.2;
      timeline.to(inner, { yPercent: opening ? 0 : -25, duration, ease: 'power3.inOut' }, 0);
      timeline.to(shade, { opacity: opening ? 0 : .5, duration, ease: 'power3.inOut' }, 0);
    });
    return motionPromise;
  }
  async function open() {
    const generation = ++requestGeneration;
    await stylesReady;
    if (disposed || generation !== requestGeneration) return false;
    if (phase === 'open') return true;
    if (phase === 'opening') return motionPromise;
    if (phase === 'closed') {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      host.scrollTop = 0;
      gsap.set(inner, { yPercent: -25 });
      gsap.set(shade, { opacity: .5 });
    }
    phase = 'opening';
    host.dataset.menuState = phase;
    host.hidden = false;
    host.inert = false;
    host.setAttribute('aria-hidden', 'false');
    setIndex(getIndex());
    focusCurrent();
    return animate(true);
  }
  function close() {
    requestGeneration++;
    if (disposed || phase === 'closed') return Promise.resolve(false);
    if (phase === 'closing') return motionPromise;
    phase = 'closing';
    host.dataset.menuState = phase;
    return animate(false);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stopMotion();
    controller.abort();
    host.innerHTML = original.html;
    host.className = original.className;
    host.hidden = original.hidden;
    host.inert = original.inert;
    delete host.dataset.menuState;
    for (const [key, value] of [['role', original.role], ['aria-label', original.label], ['aria-modal', original.modal], ['aria-hidden', original.ariaHidden]]) {
      if (value === null) host.removeAttribute(key);
      else host.setAttribute(key, value);
    }
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
  }
  setIndex(getIndex());
  return { open, close, setIndex, dispose };
}
