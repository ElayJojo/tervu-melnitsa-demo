const hero = document.querySelector('.hero');
const fallback = hero.querySelector('#hero-image');
const planes = [...hero.querySelectorAll('[data-plane]')];
const edge = hero.querySelector('.hero-edge');
const compass = hero.querySelector('.compass-needle');
const bearing = hero.querySelector('.hero-bearing');
const narrow = matchMedia('(max-width: 620px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let gsapLoad;

export function loadGsap() {
  if (window.gsap) return Promise.resolve(window.gsap);
  gsapLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/gsap.min.js';
    script.onload = () => resolve(window.gsap);
    script.onerror = () => {
      gsapLoad = null;
      script.remove();
      reject(new Error('GSAP could not be loaded'));
    };
    document.head.append(script);
  });
  return gsapLoad;
}

async function decodeLayer(plane, size) {
  const image = new Image();
  image.alt = '';
  image.decoding = 'async';
  image.src = `./photos/poster-${plane.dataset.plane}-${size}.webp`;
  await image.decode();
  return image;
}

function initMotion(gsap) {
  const [back, mid, front] = planes;
  const motionLayers = [
    { targets: back, travel: 47, pointerDepth: 3 },
    { targets: [mid, edge], travel: 35, pointerDepth: 9 },
    { targets: front, travel: 22, pointerDepth: 19 },
  ];
  const animatedLayers = motionLayers.map(({ targets, travel, pointerDepth }) => ({
    travel,
    pointerDepth,
    x: gsap.quickTo(targets, 'x', { duration: .6, ease: 'power3.out' }),
    y: gsap.quickTo(targets, 'y', { duration: .5, ease: 'power3.out' }),
  }));
  const rotateCompass = gsap.quickTo(compass, 'rotation', { duration: .6, ease: 'power3.out' });
  const rotateBearing = gsap.quickTo(bearing, 'rotation', { duration: .6, ease: 'power3.out' });
  let visible = true;
  let loaded = false;
  let pending = 0;
  let scrollOrigin = 0;
  let sceneHeight = 0;
  let pointer = 0;
  let request = 0;
  let currentSize = '';

  function measure() {
    const bounds = hero.getBoundingClientRect();
    scrollOrigin = window.scrollY + bounds.top;
    sceneHeight = bounds.height;
  }

  function update() {
    pending = 0;
    if (!visible || !loaded || reduced.matches) return;
    const progress = gsap.utils.clamp(0, 1, (window.scrollY - scrollOrigin) / sceneHeight);
    const range = narrow.matches ? .72 : 1;
    for (const layer of animatedLayers) {
      layer.x(pointer * layer.pointerDepth);
      layer.y(progress * layer.travel * range);
    }
    rotateCompass(18 + pointer * 24 - progress * 40);
    rotateBearing(pointer * 12 - progress * 64);
  }

  function schedule() {
    if (visible && loaded && !reduced.matches && !pending) {
      pending = requestAnimationFrame(update);
    }
  }

  async function swapLayers() {
    if (reduced.matches) return;
    const id = ++request;
    const size = narrow.matches ? 'phone' : 'wide';
    if (currentSize === size) {
      hero.classList.add('hero-ready');
      resize();
      return;
    }
    try {
      const images = await Promise.all(planes.map((plane) => decodeLayer(plane, size)));
      if (id !== request || reduced.matches) return;
      for (const [index, plane] of planes.entries()) plane.replaceChildren(images[index]);
      if (size === 'wide') edge.replaceChildren(images[1].cloneNode());
      else edge.replaceChildren();
      loaded = true;
      currentSize = size;
      hero.classList.add('hero-ready');
      resize();
    } catch {
      if (!loaded) hero.classList.remove('hero-ready');
    }
  }

  function resize() {
    measure();
    if (reduced.matches) {
      hero.classList.remove('hero-ready');
      for (const layer of animatedLayers) {
        layer.x.tween.pause();
        layer.y.tween.pause();
      }
      rotateCompass.tween.pause();
      rotateBearing.tween.pause();
      gsap.set([...planes, edge], { clearProps: 'transform' });
      gsap.set([compass, bearing], { clearProps: 'transform' });
      return;
    }
    schedule();
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
  }).observe(hero);

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  narrow.addEventListener('change', swapLayers);
  reduced.addEventListener('change', () => {
    if (reduced.matches) resize();
    else swapLayers();
  });

  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || reduced.matches) return;
    pointer = event.clientX / hero.clientWidth * 2 - 1;
    schedule();
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    pointer = 0;
    schedule();
  });

  swapLayers();
}

async function prepareHero() {
  try {
    await fallback.decode();
    let starting = false;
    const start = () => {
      if (starting || reduced.matches) return;
      starting = true;
      reduced.removeEventListener('change', start);
      loadGsap().then(initMotion).catch(() => {});
    };
    const whenVisible = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      whenVisible.disconnect();
      reduced.addEventListener('change', start);
      requestAnimationFrame(() => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(start, { timeout: 900 });
        } else {
          setTimeout(start, 90);
        }
      });
    });
    whenVisible.observe(hero);
  } catch {
    // The visible poster remains available if its animated replacement fails.
  }
}

prepareHero();

const bedroomObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting || entry.intersectionRatio < .45) continue;
    bedroomObserver.unobserve(entry.target);
    if (reduced.matches) continue;
    loadGsap().then((gsap) => {
      const { top, bottom } = entry.target.getBoundingClientRect();
      if (reduced.matches || bottom < 0 || top > innerHeight) return;
      const reverse = entry.target.closest('[data-home="family"]') && innerWidth > 780;
      const tween = gsap.fromTo(entry.target, {
        x: reverse ? -29 : 29, y: 31, rotation: reverse ? -5.5 : 5.5,
      }, {
        x: 0, y: 0, rotation: 0, duration: .65, ease: 'power3.out', clearProps: 'transform',
      });
      const finishIfReduced = () => {
        if (reduced.matches) tween.progress(1);
      };
      reduced.addEventListener('change', finishIfReduced);
      tween.eventCallback('onComplete', () => reduced.removeEventListener('change', finishIfReduced));
    }).catch(() => {});
  }
}, { threshold: .45 });
for (const photo of document.querySelectorAll('.home-bedroom')) bedroomObserver.observe(photo);
