const scene = document.querySelector('#hill');
const frame = scene.querySelector('.hill-frame');
const images = [...frame.querySelectorAll('[data-hill-frame]')];
const controls = scene.querySelector('.hill-controls');
const buttons = [...controls.querySelectorAll('button')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const phases = [
  { frames: ['day', 'afternoon'], stop: 'day' },
  { frames: ['gold', 'evening'], stop: 'evening' },
  { frames: ['blue', 'night'], stop: 'night' },
];

let loaded = [];
let stops;
let current = 0;
let destination = 0;
let animationFrame = 0;
let gesture = null;
let selectedPhase = -1;
let pendingPhase = null;

function render(position) {
  current = position;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  loaded.forEach(({ image }, index) => {
    const opacity = index === lower ? 1 : index === upper ? position - lower : 0;
    image.style.opacity = opacity;
  });

  const phase = loaded[Math.round(position)].phase;
  if (phase === selectedPhase) return;
  selectedPhase = phase;
  buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === phase)));
}

function settle(stop) {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  destination = stop;
  const start = current;
  const distance = stop - start;
  if (reducedMotion.matches || Math.abs(distance) < .01) {
    render(stop);
    return;
  }

  const duration = Math.min(840, 240 + 122 * Math.abs(distance));
  const started = performance.now();
  function animate(now) {
    const time = Math.max(0, Math.min(1, (now - started) / duration));
    const eased = time * time * (3 - 2 * time);
    render(start + distance * eased);
    animationFrame = time < 1 ? requestAnimationFrame(animate) : 0;
  }
  animationFrame = requestAnimationFrame(animate);
}

function selectPhase(index) {
  if (stops) {
    if (stops[index] >= 0) settle(stops[index]);
    return;
  }
  if (pendingPhase !== null) buttons[pendingPhase].removeAttribute('data-hill-pending');
  pendingPhase = index === 0 ? null : index;
  if (pendingPhase !== null) buttons[pendingPhase].setAttribute('data-hill-pending', '');
  controls.setAttribute('aria-busy', String(pendingPhase !== null));
}

buttons.forEach((button, index) => button.addEventListener('click', () => selectPhase(index)));

controls.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const available = buttons.filter(button => !button.disabled);
  const index = available.indexOf(event.target);
  if (index === -1) return;
  let target;
  switch (event.key) {
    case 'ArrowLeft': target = available[index - 1]; break;
    case 'ArrowRight': target = available[index + 1]; break;
    case 'Home': target = available[0]; break;
    case 'End': target = available.at(-1); break;
    default: return;
  }
  event.preventDefault();
  if (!target) return;
  target.focus({ preventScroll: true });
  target.click();
});

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && animationFrame) settle(destination);
});

frame.addEventListener('pointerdown', event => {
  if (loaded.length < 2 || gesture || !event.isPrimary || event.button !== 0 || controls.contains(event.target)) return;
  gesture = { pointer: event.pointerId, x: event.clientX, y: event.clientY, start: null };
});

function endGesture(commit) {
  const { pointer, start } = gesture;
  gesture = null;
  if (start === null) return;
  frame.classList.remove('hill-dragging');
  if (frame.hasPointerCapture(pointer)) frame.releasePointerCapture(pointer);
  settle(commit ? Math.round(current) : Math.round(start));
}

window.addEventListener('pointerdown', event => {
  if (gesture && event.pointerType === 'touch' && !event.isPrimary) endGesture(false);
}, { capture: true, passive: true });

window.addEventListener('pointermove', event => {
  if (gesture?.pointer !== event.pointerId) return;
  if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
    endGesture(false);
    return;
  }
  const dx = event.clientX - gesture.x;
  if (gesture.start === null) {
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(event.clientY - gesture.y);
    if (Math.max(horizontal, vertical) < 9) return;
    if (vertical >= horizontal) {
      gesture = null;
      return;
    }
    if (horizontal < vertical * 1.2) return;

    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    gesture.start = current;
    gesture.width = frame.clientWidth * .8;
    frame.setPointerCapture(event.pointerId);
    frame.classList.add('hill-dragging');
  }

  const limit = loaded.length - 1;
  const position = Math.max(0, Math.min(limit, gesture.start - dx / gesture.width * limit));
  render(reducedMotion.matches ? Math.round(position) : position);
}, { passive: true });

window.addEventListener('pointerup', event => {
  if (gesture?.pointer === event.pointerId) endGesture(true);
});

function cancelGesture(event) {
  if (gesture?.pointer === event.pointerId) endGesture(false);
}

window.addEventListener('pointercancel', cancelGesture);
frame.addEventListener('lostpointercapture', cancelGesture);

async function loadScene() {
  const day = images[0];
  const mobile = day.previousElementSibling;
  day.loading = 'eager';
  controls.hidden = false;
  const results = await Promise.allSettled(images.map(image => {
    const name = image.dataset.hillFrame;
    if (image !== day) {
      const source = mobile.cloneNode();
      source.srcset = mobile.srcset.replace('hill-day-', 'hill-' + name + '-');
      image.before(source);
      image.sizes = day.sizes;
      image.srcset = day.srcset.replaceAll('hill-day-', 'hill-' + name + '-');
      image.setAttribute('src', day.getAttribute('src').replace('hill-day-', 'hill-' + name + '-'));
    }
    return image.decode();
  }));

  loaded = images.flatMap((image, index) => {
    if (results[index].status === 'rejected') {
      image.hidden = true;
      return [];
    }
    const name = image.dataset.hillFrame;
    return [{ image, name, phase: phases.findIndex(phase => phase.frames.includes(name)) }];
  });

  if (loaded.length) {
    if (loaded[0].image !== day) loaded[0].image.alt = day.alt;
    render(0);
  }
  controls.removeAttribute('aria-busy');
  if (pendingPhase !== null) buttons[pendingPhase].removeAttribute('data-hill-pending');
  controls.hidden = loaded.length < 2;
  if (controls.hidden) return;

  stops = phases.map(({ stop }, index) => {
    const planned = loaded.findIndex(({ name }) => name === stop);
    const available = planned >= 0 ? planned : loaded.findIndex(({ phase }) => phase === index);
    buttons[index].disabled = available < 0;
    return available;
  });
  scene.classList.add('hill-ready');
  if (pendingPhase !== null) selectPhase(pendingPhase);
  pendingPhase = null;
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    loadScene();
  }, { rootMargin: '420px 0px' });
  observer.observe(frame);
} else {
  loadScene();
}
