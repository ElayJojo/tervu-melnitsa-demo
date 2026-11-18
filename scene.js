const scene = document.querySelector('.sauna-scene');
const frame = scene.querySelector('.sauna-frame');
const day = scene.querySelector('.sauna-day');
const evening = scene.querySelector('.sauna-evening');
const slider = scene.querySelector('input[type="range"]');
const endpoints = scene.querySelectorAll('[data-sauna-light]');
const reset = scene.querySelector('.sauna-reset');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// Keep the range native for keyboard and assistive technology. A separate
// pointer surface lets the browser scroll or zoom before the thumb moves.
const track = document.createElement('div');
track.className = 'sauna-track';
slider.before(track);
track.append(slider);

let active = false;
let ready = false;
let manual = false;
let animationFrame = 0;
let applied = -1;

function setLight(progress) {
  if (progress === applied) return;
  applied = progress;
  const value = Math.round(progress * 100);
  frame.style.setProperty('--twilight', progress);
  slider.value = value;
  slider.setAttribute('aria-valuetext', value === 0 ? 'День' : value === 100 ? 'Сумерки' : `${value}% перехода к сумеркам`);
  for (const endpoint of endpoints) {
    endpoint.setAttribute('aria-pressed', String(value === Number(endpoint.dataset.saunaLight)));
  }
}

function followScroll() {
  animationFrame = 0;
  if (!ready || !active || manual || reduced.matches) return;
  const { top, height } = frame.getBoundingClientRect();
  const viewport = window.innerHeight;
  const start = viewport * .36;
  const end = Math.max(-viewport * .15, -height * .38);
  const progress = Math.max(0, Math.min(1, (start - top) / (start - end)));
  setLight(progress * progress * (3 - 2 * progress));
}

function schedule() {
  if (ready && active && !manual && !reduced.matches && !animationFrame) {
    animationFrame = requestAnimationFrame(followScroll);
  }
}

function lockManual() {
  manual = true;
  reset.hidden = reduced.matches;
}

function chooseLight(value) {
  lockManual();
  setLight(value / 100);
}

const gestureThreshold = 8;
let gesture = null;

function stopGesture() {
  const { surface, pointerId } = gesture;
  gesture = null;
  if (surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
}

function cancelGesture(event) {
  if (gesture?.pointerId === event.pointerId) stopGesture();
}

// The second finger may land outside the control during a pinch.
window.addEventListener('pointerdown', (event) => {
  if (gesture && event.pointerType === 'touch' && !event.isPrimary) stopGesture();
}, { capture: true, passive: true });

function startGesture(event) {
  if (!ready || gesture || !event.isPrimary || event.button !== 0) return;
  const surface = event.currentTarget;
  const onSlider = surface === track;
  if (!onSlider && event.target.closest('a, button, input, label, select, textarea, [contenteditable]')) return;

  if (event.pointerType === 'mouse') event.preventDefault();
  if (!onSlider && event.target.hasPointerCapture(event.pointerId)) {
    event.target.releasePointerCapture(event.pointerId);
  }
  const { left, width } = surface.getBoundingClientRect();
  const thumbRadius = onSlider
    ? parseFloat(getComputedStyle(slider).getPropertyValue('--sauna-thumb-size')) / 2 : 0;
  gesture = {
    surface,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    light: applied * 100,
    left: left + thumbRadius,
    width: width - 2 * thumbRadius,
    dragging: false,
  };
}

function placeThumb(clientX) {
  const value = Math.round((clientX - gesture.left) / gesture.width * 100);
  chooseLight(Math.max(0, Math.min(100, value)));
}

frame.addEventListener('pointerdown', startGesture);
track.addEventListener('pointerdown', startGesture);

window.addEventListener('pointermove', (event) => {
  if (gesture?.pointerId !== event.pointerId) return;
  if (!(event.buttons & 1)) {
    stopGesture();
    return;
  }

  const dx = event.clientX - gesture.x;
  if (!gesture.dragging) {
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(event.clientY - gesture.y);
    if (Math.max(horizontal, vertical) <= gestureThreshold) return;
    if (horizontal <= vertical) {
      stopGesture();
      return;
    }
    if (horizontal < vertical * 1.25) return;
    gesture.surface.setPointerCapture(event.pointerId);
    gesture.dragging = true;
    if (gesture.surface === track) slider.focus({ preventScroll: true });
  }

  if (gesture.surface === track) {
    placeThumb(event.clientX);
  } else {
    const value = gesture.light + dx / gesture.width * 100;
    chooseLight(Math.max(0, Math.min(100, value)));
  }
}, { passive: true });

window.addEventListener('pointerup', (event) => {
  if (gesture?.pointerId !== event.pointerId) return;
  if (gesture.surface === track) {
    const distance = Math.max(Math.abs(event.clientX - gesture.x), Math.abs(event.clientY - gesture.y));
    if (gesture.dragging || (distance <= gestureThreshold && document.elementFromPoint(event.clientX, event.clientY) === track)) {
      slider.focus({ preventScroll: true });
      placeThumb(event.clientX);
    }
  }
  stopGesture();
});
window.addEventListener('pointercancel', cancelGesture);
frame.addEventListener('lostpointercapture', cancelGesture);
track.addEventListener('lostpointercapture', cancelGesture);
frame.addEventListener('dragstart', (event) => {
  if (gesture?.surface === frame) event.preventDefault();
});

const sliderKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
slider.addEventListener('keydown', (event) => {
  if (!event.altKey && !event.ctrlKey && !event.metaKey && sliderKeys.has(event.key)) lockManual();
});
slider.addEventListener('input', () => chooseLight(slider.valueAsNumber));
for (const endpoint of endpoints) {
  endpoint.addEventListener('click', () => chooseLight(Number(endpoint.dataset.saunaLight)));
}

reset.addEventListener('click', () => {
  slider.focus({ preventScroll: true });
  manual = false;
  reset.hidden = true;
  schedule();
});

reduced.addEventListener('change', () => {
  reset.hidden = !manual || reduced.matches;
  if (reduced.matches && !manual) setLight(0);
  else schedule();
});

function loadImage(image) {
  image.srcset = image.dataset.srcset;
  image.src = image.dataset.src;
  return image.decode();
}

async function loadScene() {
  const [dayResult, eveningResult] = await Promise.allSettled([loadImage(day), loadImage(evening)]);
  if (dayResult.status === 'rejected') {
    day.hidden = true;
    if (eveningResult.status === 'fulfilled') frame.style.setProperty('--twilight', 1);
  }
  if (eveningResult.status === 'rejected') evening.hidden = true;
  if (dayResult.status === 'rejected' || eveningResult.status === 'rejected') return;

  ready = true;
  setLight(0);
  slider.disabled = false;
  scene.classList.add('sauna-ready');
  schedule();
}

if ('IntersectionObserver' in window) {
  const preload = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    preload.disconnect();
    loadScene();
  }, { rootMargin: '420px 0px' });

  const view = new IntersectionObserver(([entry]) => {
    active = entry.isIntersecting;
    schedule();
  });
  preload.observe(frame);
  view.observe(frame);
} else {
  active = true;
  loadScene();
}

window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule, { passive: true });
