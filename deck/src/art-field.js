/** A bounded, seekable artwork field. No WebGL, image crops, or per-frame layout reads. */
const WIDTH = 1920;
const HEIGHT = 1080;
const COUNT = 24;
const PERIOD = 2940;
const LEFT = -510;
const PERSPECTIVE = 1450;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const mod = (n, m) => ((n % m) + m) % m;
const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function random(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(items) {
  const result = [...items], rand = random(0x52424226);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function mountArtField(host, artworks, { onSelect } = {}) {
  if (!host?.append) throw new TypeError('mountArtField requires a host element.');
  const items = shuffle((Array.isArray(artworks) ? artworks : []).filter(a => a?.card_src || a?.src));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, motion = true, disposed = false, time = 0, focus = 0, frame = 0, stamp = 0;
  const root = document.createElement('div');
  root.className = 'rbb-art-field';
  root.dataset.count = String(items.length);
  root.setAttribute('aria-label', 'A moving field of artworks from The Clark Collection');
  const style = document.createElement('style');
  style.textContent = `
    .rbb-art-field{position:absolute;inset:0;overflow:hidden;pointer-events:none;isolation:isolate;contain:layout paint style}
    .rbb-art-field__camera{position:absolute;inset:0;perspective:${PERSPECTIVE}px;perspective-origin:50% 50%;transform-style:preserve-3d;transform-origin:50% 50%}
    .rbb-art-field__card{position:absolute;left:0;top:0;margin:0;padding:0;border:0;border-radius:0;outline-offset:7px;background:transparent;box-shadow:none;transform-origin:50% 50%;backface-visibility:hidden;will-change:transform,opacity;pointer-events:none;cursor:default;contain:layout style}
    .rbb-art-field__card[data-interactive="true"]{pointer-events:auto;cursor:pointer}
    .rbb-art-field__card:focus-visible{outline:2px solid #a71920}
    .rbb-art-field__card img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;user-select:none;-webkit-user-drag:none;pointer-events:none}
    @media(prefers-reduced-motion:reduce){.rbb-art-field__card{will-change:auto}}
  `;
  const camera = document.createElement('div');
  camera.className = 'rbb-art-field__camera';
  root.append(style, camera);
  host.append(root);
  const rand = random(0xA471E1D);
  const cards = Array.from({ length: items.length ? COUNT : 0 }, (_, index) => {
    const plane = Math.floor(index / 8), row = Math.floor((index % 8) / 4), column = index % 4;
    const el = document.createElement(onSelect ? 'button' : 'div');
    el.className = 'rbb-art-field__card';
    if (onSelect) { el.type = 'button'; el.dataset.interactive = 'true'; }
    const img = new Image();
    img.decoding = 'async'; img.draggable = false;
    // Visibility is calculated before assigning src; no full-catalogue preload.
    img.loading = 'eager';
    img.onerror = () => { img.style.opacity = '0'; el.dataset.loadError = 'true'; };
    img.onload = () => { img.style.opacity = '1'; delete el.dataset.loadError; };
    el.append(img); camera.append(el);
    const card = {
      index, plane, row, el, img, item: null, itemIndex: -1,
      x: LEFT + column * (PERIOD / 4) + plane * 220 + 130 + rand() * 200,
      y: [225, 790][row] + (rand() - .5) * 125,
      width: [190, 250, 330][plane] * (.9 + rand() * .22),
      maxHeight: [245, 300, 355][plane],
      z: [-210, -80, 35][plane] + (rand() - .5) * 25,
      tilt: (rand() - .5) * [3.5, 2.4, 1.6][plane],
      phase: rand() * Math.PI * 2,
      speed: [12, 18, 25][plane],
      opacity: [.84, .96, 1][plane],
    };
    if (onSelect) el.addEventListener('click', () => { if (card.item) onSelect(card.item); });
    return card;
  });

  function render() {
    if (disposed) return;
    const t = reduced.matches ? 0 : time;
    camera.style.transform = `scale(${(1 - focus * .18).toFixed(5)})`;
    root.style.opacity = (1 - focus * .7).toFixed(5);
    let visibleCount = 0;
    for (const card of cards) {
      const distance = t * card.speed + focus * (340 + card.plane * 110);
      const rawX = card.x - distance;
      const cycle = Math.floor((rawX - LEFT) / PERIOD);
      const x = LEFT + mod(rawX - LEFT, PERIOD);
      const y = card.y + Math.sin(t * .085 + card.phase) * (9 + card.plane * 4);
      const z = card.z + Math.sin(t * .045 + card.phase) * 7;
      const projected = PERSPECTIVE / (PERSPECTIVE - z);
      const screenX = WIDTH / 2 + (x - WIDTH / 2) * projected;
      const screenY = HEIGHT / 2 + (y - HEIGHT / 2) * projected;
      const itemIndex = mod(card.index - cycle * COUNT, items.length);
      const item = items[itemIndex];
      const dimensions = item.card_dimensions || item.dimensions || { width: 1, height: 1 };
      const ratio = Math.max(.08, Number(dimensions.width) / Number(dimensions.height) || 1);
      const width = Math.min(card.width, card.maxHeight * ratio), height = width / ratio;
      const visible = screenX + width * projected / 2 > -100 && screenX - width * projected / 2 < WIDTH + 100
        && screenY + height * projected / 2 > -100 && screenY - height * projected / 2 < HEIGHT + 100;
      card.el.style.visibility = visible ? 'visible' : 'hidden';
      card.el.tabIndex = visible && onSelect ? 0 : -1;
      if (visible) visibleCount++;
      card.el.dataset.artworkId = item.id || String(itemIndex);
      card.el.dataset.sourcePage = String(item.page ?? '');
      if (visible && card.itemIndex !== itemIndex) {
        card.item = item; card.itemIndex = itemIndex;
        card.img.alt = item.alt || `${item.title || 'Artwork'}${item.artist ? ` by ${item.artist}` : ''}`;
        card.img.width = dimensions.width || 384; card.img.height = dimensions.height || 384;
        card.img.style.opacity = '1';
        card.img.src = item.card_src || item.src;
        card.el.setAttribute('aria-label', card.img.alt);
        card.el.style.width = `${width.toFixed(2)}px`;
        card.el.style.height = `${height.toFixed(2)}px`;
      }
      // A quiet central aperture keeps the large opening statement readable.
      const aperture = .14 + .86 * Math.max(smooth(405, 675, Math.abs(screenX - 960)), smooth(205, 390, Math.abs(screenY - 525)));
      const boundary = smooth(-100, 70, screenX + width * projected / 2) * (1 - smooth(1850, 2020, screenX - width * projected / 2));
      card.el.style.opacity = (card.opacity * aperture * boundary).toFixed(4);
      card.el.style.transform = `translate3d(${(x - width / 2).toFixed(3)}px,${(y - height / 2).toFixed(3)}px,${z.toFixed(3)}px) rotateZ(${(card.tilt + Math.sin(t * .045 + card.phase) * .5).toFixed(3)}deg) rotateY(${(Math.sin(t * .035 + card.phase) * 3).toFixed(3)}deg)`;
    }
    root.dataset.visible = String(visibleCount);
    root.dataset.time = time.toFixed(3);
  }
  const shouldRun = () => !disposed && active && motion && !reduced.matches && !document.hidden;
  function tick(now) {
    frame = 0;
    if (!shouldRun()) { stamp = 0; return; }
    if (!stamp) stamp = now;
    if (now - stamp >= 1000 / 30 - .25) {
      time += Math.min((now - stamp) / 1000, .12); stamp = now; render();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; stamp = 0;
    if (shouldRun()) frame = requestAnimationFrame(tick);
  }
  function visibilityChanged() { sync(); }
  function preferenceChanged() { render(); sync(); }
  document.addEventListener('visibilitychange', visibilityChanged);
  reduced.addEventListener('change', preferenceChanged);
  render();
  return {
    setActive(value) { active = Boolean(value); sync(); },
    setMotion(value) { motion = Boolean(value); sync(); },
    seek(seconds) { time = Math.max(0, Number(seconds) || 0); stamp = 0; render(); },
    setFocus(amount) { focus = clamp(Number(amount) || 0, 0, 1); render(); },
    dispose() {
      if (disposed) return;
      disposed = true; if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibilityChanged);
      reduced.removeEventListener('change', preferenceChanged);
      for (const card of cards) { card.img.onload = null; card.img.onerror = null; }
      root.remove();
    },
  };
}
