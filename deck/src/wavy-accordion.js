/**
 * Osmo Wavy Accordion, adapted from the licensed Vault resource for the RBB deck.
 * Original shader and spring equations retained. The presentation owns visibility
 * and overlays through setActive(); paused slides schedule no animation frames.
 */
const OPEN_SIZE = 6;
const CYCLE_MS = 3200;
const ENTRY_SWEEP_MS = 650;
const SPRING_STIFFNESS = 160;
const SPRING_DAMPING = 20;
const BEND = 1.6;
const BEND_STIFFNESS = 300;
const BEND_DAMPING = 40;

  const vertexShader = `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const fragmentShader = `
    precision highp float;

    uniform sampler2D uMaps[8];
    uniform vec2 uSizes[8];
    uniform float uEdges[9];
    uniform float uBows[9];
    uniform float uOpen[8];
    uniform int uCount;
    uniform vec2 uResolution;
    uniform float uDpr, uVertical, uOpenLength, uGap, uRadius, uDrag, uDragReach, uDim;

    vec3 sampleMap(int i, vec2 uv, vec2 gx, vec2 gy) {
      uv = clamp(uv, 0.0, 1.0);
      if (i == 0) return textureGrad(uMaps[0], uv, gx, gy).rgb;
      if (i == 1) return textureGrad(uMaps[1], uv, gx, gy).rgb;
      if (i == 2) return textureGrad(uMaps[2], uv, gx, gy).rgb;
      if (i == 3) return textureGrad(uMaps[3], uv, gx, gy).rgb;
      if (i == 4) return textureGrad(uMaps[4], uv, gx, gy).rgb;
      if (i == 5) return textureGrad(uMaps[5], uv, gx, gy).rgb;
      if (i == 6) return textureGrad(uMaps[6], uv, gx, gy).rgb;
      return textureGrad(uMaps[7], uv, gx, gy).rgb;
    }

    float edgeAt(int k, float bulge) {
      return uEdges[k] + uBows[k] * bulge;
    }

    float inset(int k) {
      if (k <= 0 || k >= uCount) return 0.0;
      return uGap > 0.0 ? 0.5 * uGap : -1.0;
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, uResolution.y * uDpr - gl_FragCoord.y) / uDpr;
      bool vertical = uVertical > 0.5;
      float along = vertical ? p.y : p.x;
      float across = vertical ? p.x : p.y;
      float crossSize = vertical ? uResolution.x : uResolution.y;
      float bulge = sin(clamp(across / crossSize, 0.0, 1.0) * 3.14159265);

      int i = 0;
      for (int k = 1; k < 8; k++) {
        if (k >= uCount) break;
        if (along >= edgeAt(k, bulge)) i = k;
      }
      float start = edgeAt(i, bulge);
      float end = edgeAt(i + 1, bulge);

      float pull = uBows[i] * exp(-abs(along - start) / uDragReach) + uBows[i + 1] * exp(-abs(along - end) / uDragReach);
      vec2 offset = vec2(along - pull * bulge * uDrag - 0.5 * (start + end), across - 0.5 * crossSize);
      vec2 box = vec2(uOpenLength, crossSize);
      if (vertical) {
        offset = offset.yx;
        box = box.yx;
      }
      vec2 size = uSizes[i];
      vec2 perPixel = 1.0 / (size * max(box.x / size.x, box.y / size.y));
      vec2 uv = offset * perPixel + 0.5;
      uv.y = 1.0 - uv.y;
      vec3 color = sampleMap(i, uv, vec2(perPixel.x / uDpr, 0.0), vec2(0.0, perPixel.y / uDpr));
      color *= 1.0 - uDim * (1.0 - clamp(uOpen[i], 0.0, 1.0));

      float cardStart = start + inset(i);
      float cardEnd = end - inset(i + 1);
      vec2 halfSize = vec2(max(0.5 * (cardEnd - cardStart), 0.0), 0.5 * crossSize);
      float radius = min(uRadius, halfSize.x);
      vec2 corner = abs(vec2(along - 0.5 * (cardStart + cardEnd), across - 0.5 * crossSize)) - halfSize + radius;
      float shapeDistance = length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) - radius;
      float alpha = clamp(0.5 - shapeDistance * uDpr, 0.0, 1.0);

      gl_FragColor = vec4(color * alpha, alpha);
    }
  `;


/** Mount the supplied Osmo markup. Photo expansion is delegated to onSelect. */
export function mountWavyAccordion(root, { onSelect = () => {} } = {}) {
  const canvas = root.querySelector('[data-wavy-accordion-canvas]');
  const list = root.querySelector('[data-wavy-accordion-list]');
  const items = [...root.querySelectorAll('[data-wavy-accordion-item]')];
  const images = items.map(item => item.querySelector('[data-wavy-accordion-image]'));
  const count = items.length;
  if (!canvas || !list || count < 1 || count > 8 || images.some(image => !image)) {
    throw new Error('Wavy Accordion needs a canvas, a list, and 1–8 image items.');
  }

  const events = new AbortController();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const weights = items.map((_, index) => index === 0 ? OPEN_SIZE : 1);
  const velocities = items.map(() => 0);
  const edges = new Float32Array(count + 1);
  const edgeVelocities = new Float32Array(count + 1);
  const bows = new Float32Array(count + 1);
  const bowVelocities = new Float32Array(count + 1);
  const textures = [];
  const textureScales = [];
  let THREE, renderer, scene, camera, geometry, material, uniforms;
  let active = 0, width = 1, height = 1, gap = 10;
  let sceneActive = false, motionEnabled = true, intersecting = true;
  let disposed = false, loaded = false, gpuFailed = false, resetVelocity = true;
  let frameId = 0, cycleId = 0, lastFrame = 0, needsRender = true;
  let userInteracting = false, touchActivation = null;
  const running = () => sceneActive && intersecting && !document.hidden && !disposed;
  const animated = () => motionEnabled && !reduceMotion.matches;

  root.setAttribute('data-wavy-accordion-status', 'loading');
  function stopFrame() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  function stopCycle() {
    clearTimeout(cycleId);
    cycleId = 0;
  }
  function scheduleCycle(delay = CYCLE_MS) {
    stopCycle();
    if (!running() || !animated() || userInteracting || count < 2) return;
    cycleId = setTimeout(() => {
      cycleId = 0;
      activate((active + 1) % count);
      scheduleCycle();
    }, delay);
  }
  function updateItemStates() {
    items.forEach((item, index) => {
      item.setAttribute('data-wavy-accordion-item-status', index === active ? 'active' : 'inactive');
      item.querySelector('button, a')?.setAttribute('aria-pressed', String(index === active));
    });
  }
  function writeWeights() {
    items.forEach((item, index) => { item.style.flexGrow = weights[index]; });
  }
  function snapWeights() {
    weights.forEach((_, index) => {
      weights[index] = index === active ? OPEN_SIZE : 1;
      velocities[index] = 0;
    });
    edgeVelocities.fill(0);
    bows.fill(0);
    bowVelocities.fill(0);
    resetVelocity = true;
    writeWeights();
  }
  function activate(index, snap = false) {
    active = Math.max(0, Math.min(count - 1, index));
    updateItemStates();
    if (snap || !animated()) snapWeights();
    needsRender = true;
    wake();
  }
  function wake() {
    if (!running() || frameId) return;
    lastFrame = performance.now();
    frameId = requestAnimationFrame(frame);
  }
  function synchronize() {
    root.classList.toggle('wavy-accordion--still', !animated());
    if (!running()) { stopFrame(); stopCycle(); return; }
    if (!animated()) snapWeights();
    needsRender = true;
    wake();
    scheduleCycle();
  }
  function fallback() {
    gpuFailed = true;
    root.setAttribute('data-wavy-accordion-status', 'fallback');
    renderer?.dispose();
    renderer = null;
    textures.forEach(texture => texture?.dispose());
    textures.length = 0;
    geometry?.dispose();
    material?.dispose();
  }
  function openLength() {
    return (OPEN_SIZE / (OPEN_SIZE + count - 1)) * Math.max(width - gap * (count - 1), 1);
  }
  function fitImage(index) {
    if (!THREE || !uniforms || gpuFailed || !loaded) return;
    const image = images[index];
    const textureDetail = 1.25;
    const scale = Math.min(Math.max(openLength() / image.naturalWidth, height / image.naturalHeight) * uniforms.uDpr.value * textureDetail, 1);
    if (textureScales[index] && scale <= textureScales[index] * textureDetail) return;
    textureScales[index] = scale;
    let source = image;
    if (scale < 1) {
      source = document.createElement('canvas');
      source.width = Math.max(Math.round(image.naturalWidth * scale), 1);
      source.height = Math.max(Math.round(image.naturalHeight * scale), 1);
      source.getContext('2d').drawImage(image, 0, 0, source.width, source.height);
    }
    const texture = new THREE.Texture(source);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    textures[index]?.dispose();
    textures[index] = texture;
    uniforms.uMaps.value[index] = texture;
    uniforms.uSizes.value[index].set(image.naturalWidth, image.naturalHeight);
    needsRender = true;
  }
  function resize() {
    width = Math.max(root.clientWidth, 1);
    height = Math.max(root.clientHeight, 1);
    gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    if (renderer) {
      // The deck can be scaled below its 1920px design canvas: avoid oversampling it.
      const displayScale = root.getBoundingClientRect().width / width || 1;
      const dpr = Math.max(0.5, Math.min((window.devicePixelRatio || 1) * displayScale, 1.5));
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
      uniforms.uDpr.value = dpr;
      uniforms.uGap.value = gap;
      uniforms.uRadius.value = 0;
      images.forEach((_, index) => fitImage(index));
      // All sampler slots must bind a texture, including unused slots.
      for (let index = count; index < 8; index++) uniforms.uMaps.value[index] = textures[count - 1] || null;
    }
    resetVelocity = true;
    needsRender = true;
    wake();
  }

  function frame(now, capture = false) {
    frameId = 0;
    if (disposed || (!capture && !running())) return;
    const dt = Math.min((now - lastFrame) / 1000, 1 / 30) || 1 / 60;
    lastFrame = now;
    const snap = capture || !animated();
    let total = 0, motion = 0;
    weights.forEach((weight, index) => {
      const target = index === active ? OPEN_SIZE : 1;
      velocities[index] = snap ? 0 : velocities[index] + (SPRING_STIFFNESS * (target - weight) - SPRING_DAMPING * velocities[index]) * dt;
      weights[index] = snap ? target : Math.max(weight + velocities[index] * dt, 0.05);
      total += weights[index];
      motion += Math.abs(velocities[index]);
    });
    const available = Math.max(width - gap * (count - 1), 1);
    let position = 0;
    for (let index = 0; index <= count; index++) {
      const edge = index === 0 ? 0 : index === count ? position - gap : position - gap / 2;
      const inner = index > 0 && index < count;
      const speed = resetVelocity || !inner ? 0 : (edge - edges[index]) / dt / 60;
      edgeVelocities[index] = resetVelocity ? 0 : edgeVelocities[index] + (speed - edgeVelocities[index]) * 0.35;
      edges[index] = edge;
      const bowTarget = inner && !snap ? -edgeVelocities[index] * BEND : 0;
      bowVelocities[index] = snap ? 0 : bowVelocities[index] + (BEND_STIFFNESS * (bowTarget - bows[index]) - BEND_DAMPING * bowVelocities[index]) * dt;
      bows[index] = snap ? 0 : bows[index] + bowVelocities[index] * dt;
      motion += Math.abs(bows[index]) + Math.abs(bowVelocities[index]);
      if (index < count) position += (weights[index] / total) * available + gap;
    }
    resetVelocity = false;
    if (motion < 0.002 && !needsRender) return;
    needsRender = false;
    writeWeights();
    if (renderer && loaded) {
      uniforms.uEdges.value.set(edges);
      uniforms.uBows.value.set(bows);
      uniforms.uOpenLength.value = openLength();
      weights.forEach((weight, index) => { uniforms.uOpen.value[index] = (weight - 1) / (OPEN_SIZE - 1); });
      try {
        renderer.render(scene, camera);
        if (!gpuFailed) root.setAttribute('data-wavy-accordion-status', 'ready');
      } catch { fallback(); }
    }
    // Springs sleep once settled. The next cycle uses a timeout, not a busy RAF.
    if (!capture && running() && motion >= 0.002 && animated()) frameId = requestAnimationFrame(frame);
  }

  items.forEach((item, index) => {
    item.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') { userInteracting = true; stopCycle(); activate(index); }
    }, { signal: events.signal });
    item.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        touchActivation = { index, wasActive: active === index };
      } else touchActivation = null;
    }, { signal: events.signal });
    item.addEventListener('focusin', () => {
      userInteracting = true;
      stopCycle();
      activate(index);
    }, { signal: events.signal });
    item.addEventListener('click', event => {
      const touch = touchActivation;
      touchActivation = null;
      event.preventDefault();
      // A first click often follows pointerenter before the spring has opened
      // the image. Let that wave finish instead of immediately covering it
      // with the full-photo dialog. A settled, open photo remains clickable.
      const isOpen = Math.abs(weights[index] - OPEN_SIZE) < 0.02 &&
        bows.every(bow => Math.abs(bow) < 1);
      if ((touch?.index === index && !touch.wasActive) || active !== index || !isOpen) {
        activate(index);
        return;
      }
      onSelect(index);
    }, { signal: events.signal });
  });
  root.addEventListener('pointerleave', () => {
    userInteracting = false;
    scheduleCycle();
  }, { signal: events.signal });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) { userInteracting = false; scheduleCycle(); }
  }, { signal: events.signal });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    fallback();
  }, { signal: events.signal });
  document.addEventListener('visibilitychange', synchronize, { signal: events.signal });
  window.addEventListener('resize', resize, { signal: events.signal });
  reduceMotion.addEventListener('change', synchronize, { signal: events.signal });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    synchronize();
  });
  intersectionObserver.observe(root);
  activate(0, true);
  resize();

  const ready = (async () => {
    try {
      THREE = await import('../vendor/three/build/three.module.js');
      if (disposed) return { mode: 'disposed', count };
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
      renderer.debug.onShaderError = () => { fallback(); };
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      uniforms = {
        uMaps: { value: Array(8).fill(null) },
        uSizes: { value: Array.from({ length: 8 }, () => new THREE.Vector2(1, 1)) },
        uEdges: { value: new Float32Array(9) }, uBows: { value: new Float32Array(9) },
        uOpen: { value: new Float32Array(8) }, uCount: { value: count },
        uResolution: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
        uVertical: { value: 0 }, uOpenLength: { value: 1 }, uGap: { value: 10 },
        uRadius: { value: 0 }, uDrag: { value: 0.6 }, uDragReach: { value: 90 }, uDim: { value: 0.15 }
      };
      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
      scene.add(new THREE.Mesh(geometry, material));
      // prepareScene awaits readiness before showing the slide; lazy images would
      // otherwise wait for that visibility and could deadlock the transition.
      images.forEach(image => { image.loading = 'eager'; });
      await Promise.all(images.map(image => image.decode()));
      if (disposed) return { mode: 'disposed', count };
      loaded = true;
      resize();
      wake();
      return { mode: gpuFailed ? 'fallback' : 'webgl', count };
    } catch (error) {
      if (!disposed) fallback();
      return { mode: disposed ? 'disposed' : 'fallback', count, reason: String(error?.message || error) };
    }
  })();

  return {
    ready,
    setActive(value) {
      const next = Boolean(value);
      if (sceneActive === next) return;
      sceneActive = next;
      synchronize();
      // Demonstrate the licensed wave soon after entry; subsequent images
      // retain a quiet viewing interval, and hover/focus always takes priority.
      if (next) scheduleCycle(ENTRY_SWEEP_MS);
    },
    setMotion(value) {
      motionEnabled = Boolean(value);
      synchronize();
    },
    seek(seconds) {
      if (disposed) return;
      stopFrame();
      stopCycle();
      active = Math.floor(Math.max(0, Number(seconds) || 0) / (CYCLE_MS / 1000)) % count;
      updateItemStates();
      snapWeights();
      needsRender = true;
      // Captures seek after deactivating ambient motion. Draw the requested
      // state now without waking the live RAF or automatic cycling.
      frame(performance.now(), true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopFrame();
      stopCycle();
      events.abort();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      textures.forEach(texture => texture?.dispose());
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      root.setAttribute('data-wavy-accordion-status', 'fallback');
    }
  };
}
