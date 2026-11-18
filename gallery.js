import { houses } from './shared.js';
import './motion.js';

const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const dialog = document.querySelector('.photo-dialog');
const title = dialog.querySelector('#gallery-title');
const stage = dialog.querySelector('.photo-stage');
const dialogImage = stage.querySelector('img');
const caption = dialog.querySelector('[data-photo-name]');
const count = dialog.querySelector('[data-photo-count]');
const closeButton = dialog.querySelector('[data-close]');

let active;
let swipeStart;
let closeTouch;
let backdropPressed = false;

function showPhoto(index) {
  const { photos } = active;
  active.index = (index + photos.length) % photos.length;
  const photo = photos[active.index];

  dialogImage.alt = photo.alt;
  dialogImage.src = photo.src;
  caption.textContent = photo.caption;
  count.textContent = `${active.index + 1} из ${photos.length}`;
}

function step(delta) {
  if (active) showPhoto(active.index + delta);
}

function isModified(event) {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

for (const card of document.querySelectorAll('.home-card[data-home]')) {
  const house = card.dataset.home;
  const links = [...card.querySelectorAll('.home-photo-link')];
  const photos = links.map((link) => ({
    alt: link.querySelector('img').alt,
    src: link.href,
    caption: link.parentElement.querySelector('figcaption').textContent,
  }));

  links.forEach((link, index) => {
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-label', `${photos[index].alt}. Открыть фото крупнее`);
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || isModified(event) || dialog.open) return;
      event.preventDefault();

      active = { photos, index, opener: link };
      title.textContent = houses[house].name;
      showPhoto(index);
      dialog.showModal();
    });
  });

  for (const price of card.querySelectorAll('[data-rate]')) {
    price.textContent = rubles.format(houses[house][price.dataset.rate]);
  }

  for (const link of card.querySelectorAll('[data-select], [data-home-price]')) {
    link.addEventListener('click', (event) => {
      if (isModified(event)) return;
      document.dispatchEvent(new CustomEvent('select-house', { detail: house }));
    });
  }
}

function restoreFocus() {
  if (dialog.open || !active) return;
  const { opener } = active;
  active = undefined;
  swipeStart = undefined;
  closeTouch = undefined;
  backdropPressed = false;
  opener.focus({ preventScroll: true });
}

function closeGallery() {
  if (!dialog.open) return;
  dialog.close();
  restoreFocus();
}

closeButton.addEventListener('click', closeGallery);

// A browser can suppress the synthesized click on a quick tap after a swipe.
closeButton.addEventListener('touchstart', (event) => {
  closeTouch = event.touches.length === 1 ? event.changedTouches[0] : undefined;
}, { passive: true });
closeButton.addEventListener('touchcancel', () => { closeTouch = undefined; });
closeButton.addEventListener('touchend', (event) => {
  const start = closeTouch;
  const touch = event.changedTouches[0];
  closeTouch = undefined;

  if (!start || event.touches.length || start.identifier !== touch.identifier) return;
  const { clientX, clientY } = touch;
  if (Math.hypot(clientX - start.clientX, clientY - start.clientY) > 12 ||
      !closeButton.contains(document.elementFromPoint(clientX, clientY))) return;

  event.preventDefault();
  closeGallery();
}, { passive: false });

dialog.querySelector('[data-previous]').addEventListener('click', () => step(-1));
dialog.querySelector('[data-next]').addEventListener('click', () => step(1));
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeGallery();
});
dialog.addEventListener('close', restoreFocus);

dialog.addEventListener('keydown', (event) => {
  if (isModified(event) || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
  event.preventDefault();
  step(event.key === 'ArrowRight' ? 1 : -1);
});

stage.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0 || event.pointerType === 'mouse') return;
  swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
});

stage.addEventListener('pointercancel', (event) => {
  if (swipeStart?.id === event.pointerId) swipeStart = undefined;
});

stage.addEventListener('pointerup', (event) => {
  if (swipeStart?.id !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = undefined;
  if (Math.abs(dx) >= 35 && Math.abs(dx) >= Math.abs(dy) * 1.35) step(dx < 0 ? 1 : -1);
});

function isBackdrop(event) {
  if (event.target !== dialog) return false;
  const { left, right, top, bottom } = dialog.getBoundingClientRect();
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

dialog.addEventListener('pointerdown', (event) => {
  if (event.isPrimary) backdropPressed = isBackdrop(event);
});
dialog.addEventListener('click', (event) => {
  if (backdropPressed && isBackdrop(event)) closeGallery();
  backdropPressed = false;
});
