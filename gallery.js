import { houses } from './shared.js';
import { media } from './media.js';
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
const dialogControls = dialog.querySelector('.photo-dialog-controls');

const captions = {
  guest: ['Фасад', 'Спальня с двумя кроватями', 'Спальня со сдвинутыми кроватями', 'Двухъярусная кровать', 'Гостиная', 'Кухня', 'Душевая'],
  family: ['Фасад', 'Спальня на втором ярусе', 'Диван у окна', 'Кухня и лестница', 'Комната отдыха', 'Душевая'],
};

let activeGallery;
let backdropPressed = false;

function bindArrows(element, step) {
  element.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
  });
}

function bindSwipe(element, step) {
  let start;
  let swiped = false;

  element.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    swiped = false;
    start = event.pointerType === 'mouse' ? undefined : event;
  });

  element.addEventListener('pointercancel', () => { start = undefined; });
  element.addEventListener('pointerup', (event) => {
    if (start?.pointerId !== event.pointerId) return;
    const dx = event.clientX - start.clientX;
    const dy = event.clientY - start.clientY;
    start = undefined;
    if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    swiped = true;
    step(dx < 0 ? 1 : -1);
  });

  element.addEventListener('click', (event) => {
    if (swiped && event.detail) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    swiped = false;
  }, { capture: true });
}

function setupGallery(card) {
  const house = card.dataset.home;
  const photos = media[house];
  const button = card.querySelector('.home-gallery');
  const preview = button.querySelector('img');
  const bar = card.querySelector('.home-viewer-bar');
  const controls = bar.querySelector('.home-photo-controls');
  const name = controls.querySelector('[data-photo-name]');
  const count = controls.querySelector('[data-photo-count]');
  const jump = controls.querySelector('[data-photo-jump]');
  const facade = { src: preview.getAttribute('src'), srcset: preview.srcset, sizes: preview.sizes };
  let index = 0;
  let previewIndex = 0;

  function renderPreview() {
    if (previewIndex === index) return;
    const photo = photos[index];
    const variant = index === 0 ? facade : {
      src: photo.src,
      srcset: photo.small ? `${photo.small} 1x, ${photo.src} 1.5x` : '',
      sizes: '',
    };
    previewIndex = index;
    preview.sizes = variant.sizes;
    preview.srcset = variant.srcset;
    preview.src = variant.src;
    preview.alt = photo.alt;
    button.dataset.interior = String(index > 0);
    button.setAttribute('aria-label', `${photo.alt}. Открыть фото крупнее`);
  }

  function renderDialogImage() {
    const photo = photos[index];
    dialogImage.alt = photo.alt;
    dialogImage.src = photo.src;
  }

  function show(nextIndex) {
    index = (nextIndex + photos.length) % photos.length;
    name.textContent = captions[house][index] ?? photos[index].alt;
    count.textContent = `${index + 1} из ${photos.length}`;
    jump.textContent = index === 0 ? 'Смотреть внутри' : 'К фасаду';
    if (dialog.open && activeGallery === gallery) renderDialogImage();
    else renderPreview();
  }

  const gallery = {
    step: (delta) => show(index + delta),
    restore() {
      bar.append(controls);
      renderPreview();
      button.focus({ preventScroll: true });
    },
  };

  button.addEventListener('click', () => {
    if (dialog.open) return;
    activeGallery = gallery;
    title.textContent = houses[house].name;
    renderDialogImage();
    dialogControls.append(controls);
    dialog.showModal();
  });

  controls.querySelector('[data-previous]').addEventListener('click', () => gallery.step(-1));
  controls.querySelector('[data-next]').addEventListener('click', () => gallery.step(1));
  jump.addEventListener('click', () => show(index === 0 ? 1 : 0));

  bindArrows(button, gallery.step);
  bindArrows(bar, gallery.step);
  bindSwipe(button, gallery.step);
  controls.hidden = false;
  button.disabled = false;

  for (const price of card.querySelectorAll('[data-rate]')) {
    price.textContent = rubles.format(houses[house][price.dataset.rate]);
  }

  card.querySelector('[data-select]').addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    document.dispatchEvent(new CustomEvent('select-house', { detail: house }));
  });
}

for (const card of document.querySelectorAll('.home-card[data-home]')) setupGallery(card);

function restoreGallery() {
  if (dialog.open) return;
  backdropPressed = false;
  activeGallery?.restore();
  activeGallery = undefined;
}

function closeGallery() {
  dialog.close();
  restoreGallery();
}

dialog.querySelector('[data-close]').addEventListener('click', closeGallery);
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeGallery();
});
dialog.addEventListener('close', restoreGallery);
bindArrows(dialog, (delta) => activeGallery?.step(delta));
bindSwipe(stage, (delta) => activeGallery?.step(delta));

function isBackdrop(event) {
  if (event.target !== dialog) return false;
  const { left, right, top, bottom } = dialog.getBoundingClientRect();
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
}

dialog.addEventListener('pointerdown', (event) => { backdropPressed = isBackdrop(event); });
dialog.addEventListener('click', (event) => {
  if (backdropPressed && isBackdrop(event)) closeGallery();
  backdropPressed = false;
});
