const smooth = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;

// Keep native history restoration and focus scrolling immediate when JS owns anchor animation.
root.style.scrollBehavior = 'auto';

let frame = 0;
let motion;
let writtenY;
let entryCount = 0;
const entryFocus = new Map();

function maxY() {
  return Math.max(0, document.scrollingElement.scrollHeight - root.clientHeight);
}

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  motion = undefined;
}

function writeScroll(top) {
  window.scrollTo({ top, behavior: 'instant' });
  writtenY = window.scrollY;
}

function tick(time) {
  frame = 0;
  if (!motion) return;
  if (Math.abs(window.scrollY - writtenY) > 2) {
    stop();
    return;
  }

  if (motion.type === 'anchor') {
    const progress = Math.max(0, Math.min(1, (time - motion.start) / motion.duration));
    const eased = progress * progress * progress * (progress * (6 * progress - 15) + 10);
    const end = progress === 1 ? positionOf(motion.target) : motion.to;
    writeScroll(motion.from + (end - motion.from) * eased);
    if (progress === 1) {
      const focus = motion.focus;
      stop();
      finishAnchor(focus);
    }
  } else {
    const elapsed = Math.max(0, Math.min(40, time - motion.time));
    motion.time = time;
    motion.to = Math.min(motion.to, maxY());
    motion.y += (motion.to - motion.y) * (1 - Math.exp(-elapsed / 80));
    const done = Math.abs(motion.to - motion.y) < .55;
    writeScroll(done ? motion.to : motion.y);
    if (done) stop();
  }

  if (motion) frame = requestAnimationFrame(tick);
}

function letBrowserScroll(event) {
  if (event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey ||
      event.altKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) ||
      (window.visualViewport?.scale ?? 1) !== 1 || document.querySelector('dialog[open]')) return true;

  for (const node of event.composedPath()) {
    if (node === root || node === document.body) break;
    if (!(node instanceof Element)) continue;
    if (node.matches('input, select, textarea, [contenteditable], [data-native-scroll], [role="application"], canvas')) return true;
    if (node.scrollHeight <= node.clientHeight + 1) continue;
    if (/^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)) return true;
  }

  return false;
}

function onWheel(event) {
  if (letBrowserScroll(event)) {
    if (motion) stop();
    return;
  }

  const current = window.scrollY;
  const mode = event.deltaMode;
  const delta = event.deltaY * (mode === 1 ? 36 : mode === 2 ? root.clientHeight : 1);
  const continuing = motion?.type === 'wheel' && Math.abs(current - writtenY) <= 2 &&
    Math.sign(motion.to - current) === Math.sign(delta);
  const to = Math.max(0, Math.min(maxY(), (continuing ? motion.to : current) + delta));

  if (to === current && !continuing) {
    stop();
    return;
  }

  event.preventDefault();
  if (continuing) {
    motion.to = to;
  } else {
    stop();
    writtenY = current;
    motion = { type: 'wheel', to, y: current, time: performance.now() };
    frame = requestAnimationFrame(tick);
  }
}

function positionOf(target) {
  if (target === document.body || target === root) return 0;
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  const top = Math.floor(window.scrollY + target.getBoundingClientRect().top - margin);
  return Math.max(0, Math.min(maxY(), top));
}

function focusTarget(target) {
  if (target === document.body || target === root) return;
  if (!target.matches(':is([tabindex], a[href], button, input, select, textarea, summary)')) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
  target.focus({ preventScroll: true });
}

function pushFragment(link) {
  const state = history.state;
  const newKey = () => `${performance.timeOrigin}:${++entryCount}`;
  const entry = state?.fragmentEntry ?? newKey();
  if (!state?.fragmentEntry) history.replaceState({ ...state, fragmentEntry: entry }, '');
  history.pushState({ ...state, fragmentEntry: newKey() }, '', link.hash);
  entryFocus.set(entry, link);
}

function finishAnchor(focus) {
  const entry = history.state?.fragmentEntry;
  if (entry) entryFocus.set(entry, focus);
  focusTarget(focus);
}

export function fragmentLink(event) {
  if (event.defaultPrevented || event.button !== 0 ||
      event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;

  const link = event.target.closest?.('a[href^="#"]:not([download])');
  if (!link || !link.hash || (link.target && link.target !== '_self')) return;
  return link;
}

export function navigateToFragment(event, link, focus) {
  let target;
  try {
    target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  } catch {
    return;
  }
  if (!target) return;

  try {
    if (location.hash !== link.hash) pushFragment(link);
  } catch {
    return;
  }
  event.preventDefault();
  stop();

  const from = window.scrollY;
  const to = positionOf(target);
  focus ??= target;
  if (reducedMotion.matches || Math.abs(to - from) < 1) {
    writeScroll(to);
    finishAnchor(focus);
    return;
  }

  writtenY = from;
  motion = {
    type: 'anchor', from, to, target, focus,
    start: performance.now(),
    duration: Math.min(990, 280 + Math.sqrt(Math.abs(to - from)) * 9),
  };
  frame = requestAnimationFrame(tick);
}

window.addEventListener('click', (event) => {
  const link = fragmentLink(event);
  if (link && !link.matches('.skip-link')) navigateToFragment(event, link);
});

const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
window.addEventListener('keydown', (event) => {
  if (scrollKeys.has(event.key) || event.key === 'Tab') stop();
});
window.addEventListener('pointerdown', stop, { capture: true, passive: true });
window.addEventListener('wheel', () => {
  if (motion?.type !== 'wheel') stop();
}, { capture: true, passive: true });
window.addEventListener('popstate', (event) => {
  stop();
  const focus = entryFocus.get(event.state?.fragmentEntry);
  if (!focus?.isConnected) return;

  // Let the browser restore the entry's scroll position before moving focus.
  frame = requestAnimationFrame(() => {
    frame = 0;
    const { top, bottom } = focus.getBoundingClientRect();
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportHeight = window.visualViewport?.height ?? root.clientHeight;
    if (bottom > viewportTop && top < viewportTop + viewportHeight) focusTarget(focus);
  });
});
window.addEventListener('hashchange', () => {
  if (motion) stop();
});
window.addEventListener('pagehide', stop);
reducedMotion.addEventListener('change', stop);

function syncWheel() {
  if (smooth.matches) {
    window.addEventListener('wheel', onWheel, { passive: false });
  } else {
    window.removeEventListener('wheel', onWheel);
    if (motion?.type === 'wheel') stop();
  }
}

smooth.addEventListener('change', syncWheel);
syncWheel();
