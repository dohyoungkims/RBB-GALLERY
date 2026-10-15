/** Keep live ambience running only when hosted by HyperFrames' slideshow UI.
 * Native viewing keeps its own clock; deterministic check/render remains paused.
 */
let slideshowHost = null;
try {
  if (window.parent !== window) {
    slideshowHost = window.parent.document.querySelector('hyperframes-slideshow');
  }
} catch {
  // Cross-origin embedding cannot provide the verified same-origin presenter API.
}

if (slideshowHost) {
  let seekGeneration = 0;
  const bridge = window.__rbbHyperframesBridge = {
    mode: 'present',
    resumedSeeks: 0,
    syncedSlides: 0,
    controllerAvailable: false,
    lastTime: null,
    lastError: null,
  };

  let boundController = null;
  let unbindController = null;
  let controllerRetry = null;
  let positionGeneration = 0;
  const sceneIds = [...document.querySelectorAll('.scene')].map(scene => scene.dataset.compositionId);

  async function syncPosition() {
    const generation = ++positionGeneration;
    const index = sceneIds.indexOf(boundController?.currentSlide?.sceneId);
    if (index < 0) return;
    try {
      await window.rbbDeck?.ready;
      if (generation !== positionGeneration) return;
      await window.rbbDeck?.go(index);
      if (generation !== positionGeneration) return;
      window.rbbDeck?.resumeLive();
      bridge.syncedSlides++;
    } catch (error) {
      bridge.lastError = String(error);
      console.warn('[RBB] Presenter position could not synchronize:', error);
    }
  }

  function bindController() {
    const controller = slideshowHost.controller;
    if (!controller || controller === boundController) return;
    unbindController?.();
    boundController = controller;
    clearInterval(controllerRetry);
    controllerRetry = null;
    bridge.controllerAvailable = true;
    unbindController = controller.onChange(syncPosition);
    syncPosition();
  }

  // Direct-timeline players do not emit hf-seek. Follow the slideshow controller
  // as well, and rebind if the component recreates it after scene discovery.
  const hostObserver = new MutationObserver(bindController);
  hostObserver.observe(slideshowHost, { childList: true, subtree: true });
  if (slideshowHost.shadowRoot) {
    hostObserver.observe(slideshowHost.shadowRoot, { childList: true, subtree: true });
  }
  bindController();
  if (!boundController) controllerRetry = setInterval(bindController, 100);

  // Native controls stay usable inside the official presenter. Updating its
  // counter also keeps the audience channel on the same slide.
  const nativeObserver = new MutationObserver(() => {
    const index = window.rbbDeck?.state.index;
    if (!Number.isInteger(index) || !boundController) return;
    if (boundController.currentSlide?.sceneId !== sceneIds[index]) {
      boundController.goToSlide(index);
    }
  });
  nativeObserver.observe(document.querySelector('#counter'), { childList: true, characterData: true, subtree: true });

  addEventListener('pagehide', () => {
    hostObserver.disconnect();
    nativeObserver.disconnect();
    clearInterval(controllerRetry);
    unbindController?.();
  }, { once: true });

  addEventListener('hf-seek', event => {
    const generation = ++seekGeneration;
    bridge.lastTime = Number(event.detail?.time) || 0;
    // Let all seek listeners register their work first. Do not register this
    // continuation with waitUntil: it waits for that same queue to settle.
    queueMicrotask(async () => {
      try {
        await window.rbbDeck?.ready;
        await window.__hfWaitForSeekCompletion?.();
        if (generation !== seekGeneration || !slideshowHost.isConnected) return;
        window.rbbDeck?.resumeLive();
        bridge.resumedSeeks++;
      } catch (error) {
        bridge.lastError = String(error);
        console.warn('[RBB] Presenter ambience could not resume:', error);
      }
    });
  });
}
