const hero = document.querySelector('.hero');
const flat = hero.querySelector('#hero-image');
const phoneSource = hero.querySelector('source');
const back = hero.querySelector('[data-plane="back"]');
const front = hero.querySelector('[data-plane="front"]');
const phone = matchMedia('(max-width: 700px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const layersBySize = new Map();
const fallbackSizes = new Set();

let gsapLoad;
let visible = false;
let request = 0;
let activeDepth;

export function loadGsap() {
  if (!gsapLoad) {
    gsapLoad = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './vendor/gsap.min.js';
      script.onload = () => {
        window.gsap.config({ autoSleep: 30 });
        resolve(window.gsap);
      };
      script.onerror = reject;
      document.head.append(script);
    }).catch((error) => {
      gsapLoad = undefined;
      throw error;
    });
  }
  return gsapLoad;
}

function currentSize() {
  return phone.matches ? 'phone' : 'wide';
}

function useFallback() {
  const size = currentSize();
  if (fallbackSizes.has(size)) return;
  fallbackSizes.add(size);
  if (size === 'phone') phoneSource.srcset = './photos/tervu-bay-sm.webp';
  else flat.src = './photos/tervu-bay-lg.webp';
}

function loadLayer(plane, size) {
  const image = new Image();
  image.alt = '';
  image.decoding = 'async';
  image.fetchPriority = 'low';
  image.src = `./photos/dusk-${plane}-${size}.webp`;
  return image.decode().then(() => image);
}

function loadLayers(size) {
  if (!layersBySize.has(size)) {
    layersBySize.set(size, Promise.all([loadLayer('back', size), loadLayer('front', size)]).catch((error) => {
      layersBySize.delete(size);
      throw error;
    }));
  }
  return layersBySize.get(size);
}

function enableDepth(gsap, [backImage, frontImage]) {
  back.replaceChildren(backImage);
  front.replaceChildren(frontImage);

  // Both planes use the flat photo's crop. Zoom from the bottom edge
  // to cover the rear plane's downward travel without a visible edge.
  const position = { progress: 0 };
  const move = gsap.quickTo(position, 'progress', {
    duration: .38,
    ease: 'power2.out',
    onUpdate: draw,
  });
  let frame = 0;
  let height = 1;
  let top = 0;
  let lastProgress;
  let showingDepth = false;

  function draw() {
    const { progress } = position;
    const rearTravel = Math.min(66, height * .073);
    const scale = 1 + (rearTravel + 2) / height * progress;
    const offset = rearTravel * progress;
    back.style.transform = `translate3d(0, ${offset}px, 0) scale(${scale})`;
    front.style.transform = `translate3d(0, ${offset * .16}px, 0) scale(${scale})`;
    if (showingDepth !== (progress > .004)) {
      showingDepth = progress > .004;
      hero.classList.toggle('hero-in-motion', showingDepth);
    }
  }

  function update() {
    frame = 0;
    const progress = Math.min(1, Math.max(0, (window.scrollY - top) / (height * .66)));
    if (progress === lastProgress) return;
    lastProgress = progress;
    move(progress);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function measure() {
    const bounds = hero.getBoundingClientRect();
    height = Math.max(1, bounds.height);
    top = bounds.top + window.scrollY;
    lastProgress = undefined;
    schedule();
  }

  const resize = new ResizeObserver(measure);
  resize.observe(hero);
  window.addEventListener('scroll', schedule, { passive: true });
  hero.classList.add('hero-ready');
  measure();

  return () => {
    hero.classList.remove('hero-ready', 'hero-in-motion');
    window.removeEventListener('scroll', schedule);
    resize.disconnect();
    cancelAnimationFrame(frame);
    move.tween.kill();
    back.style.removeProperty('transform');
    front.style.removeProperty('transform');
    back.replaceChildren();
    front.replaceChildren();
  };
}

function afterPaintAndIdle(callback) {
  requestAnimationFrame(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 1200 });
    else setTimeout(callback, 140);
  });
}

function syncDepth() {
  const size = currentSize();
  const id = ++request;
  if (activeDepth && (reduced.matches || activeDepth.size !== size)) {
    activeDepth.dispose();
    activeDepth = undefined;
  }
  if (activeDepth || reduced.matches || !visible || fallbackSizes.has(size)) return;
  if (!flat.complete || !flat.naturalWidth || !flat.currentSrc.endsWith(`dusk-flat-${size}.webp`)) return;

  const canActivate = () => id === request && visible && !reduced.matches;
  afterPaintAndIdle(async () => {
    if (!canActivate()) return;
    try {
      await flat.decode();
      if (!canActivate()) return;
      const images = await loadLayers(size);
      if (!canActivate()) return;
      if (images.some((image) => image.naturalWidth !== flat.naturalWidth || image.naturalHeight !== flat.naturalHeight)) return;
      const gsap = await loadGsap();
      if (canActivate()) activeDepth = { size, dispose: enableDepth(gsap, images) };
    } catch {
      // A complete flat photo stays visible if the depth layers are unavailable.
    }
  });
}

flat.addEventListener('error', useFallback);
flat.addEventListener('load', syncDepth);
if (flat.complete && !flat.naturalWidth) useFallback();
phone.addEventListener('change', syncDepth);
reduced.addEventListener('change', syncDepth);
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  syncDepth();
}).observe(hero);
