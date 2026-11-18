import { houses } from './shared.js';
import { media } from './media.js';
import { loadGsap } from './motion.js';

const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const dialog = document.querySelector('.photo-dialog');
const title = dialog.querySelector('#gallery-title');
const stage = dialog.querySelector('.photo-stage');
const image = stage.querySelector('img');
const caption = dialog.querySelector('figcaption');
const thumbs = dialog.querySelector('.photo-thumbs');
const closeButton = dialog.querySelector('[data-close]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const roomNames = {
  guest: ['Спальня с двумя кроватями', 'Спальня со сдвинутыми кроватями', 'Двухъярусная кровать', 'Гостиная', 'Кухня', 'Душевая'],
  family: ['Спальня на втором ярусе', 'Диван у окна', 'Кухня и лестница', 'Гостиная со вторым светом', 'Душевая'],
};

let photos = [];
let photoIndex = 0;
let opener;
let transitionId = 0;
let floatingPhoto;
let backdropPressed = false;

function cancelPhotoMotion() {
  transitionId += 1;
  if (floatingPhoto) {
    window.gsap.killTweensOf(floatingPhoto);
    floatingPhoto.remove();
    floatingPhoto = null;
  }
  window.gsap?.killTweensOf(image);
  image.style.removeProperty('visibility');
  image.style.removeProperty('opacity');
  image.style.removeProperty('transform');
}

async function expandPhoto(source, cropPosition, id) {
  if (reduced.matches || !source.width || !source.height) return;
  try {
    const [gsap] = await Promise.all([loadGsap(), image.decode()]);
    if (!dialog.open || transitionId !== id || reduced.matches) return;
    const box = image.getBoundingClientRect();
    const fit = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
    const width = image.naturalWidth * fit;
    const height = image.naturalHeight * fit;
    const left = box.left + (box.width - width) / 2;
    const top = box.top + (box.height - height) / 2;
    const scale = Math.max(source.width / width, source.height / height);
    const cropX = 1 - source.width / (width * scale);
    const cropY = 1 - source.height / (height * scale);
    const [positionX, positionY] = cropPosition;
    const sourceLeft = source.left - width * scale * cropX * positionX;
    const sourceTop = source.top - height * scale * cropY * positionY;

    const ghost = new Image();
    ghost.className = 'photo-in-flight';
    ghost.alt = '';
    ghost.src = image.currentSrc;
    Object.assign(ghost.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` });
    floatingPhoto = ghost;
    dialog.append(ghost);
    image.style.visibility = 'hidden';
    gsap.fromTo(ghost, {
      x: sourceLeft + width * scale / 2 - (left + width / 2),
      y: sourceTop + height * scale / 2 - (top + height / 2),
      scale,
      clipPath: `inset(${cropY * positionY * 100}% ${cropX * (1 - positionX) * 100}% ${cropY * (1 - positionY) * 100}% ${cropX * positionX * 100}%)`,
    }, {
      x: 0, y: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0%)',
      duration: .42, ease: 'power3.out',
      onComplete: cancelPhotoMotion,
    });
  } catch {
    // The dialog retains its regular image if the enhancement cannot load.
  }
}

function showPhoto(index, animate = true) {
  cancelPhotoMotion();
  const id = transitionId;
  const previousIndex = photoIndex;
  photoIndex = (index + photos.length) % photos.length;
  const photo = photos[photoIndex];
  image.alt = photo.alt;
  image.src = photo.src;
  if (animate && previousIndex !== photoIndex && window.gsap && !reduced.matches) {
    image.decode().then(() => {
      if (!dialog.open || id !== transitionId || reduced.matches) return;
      window.gsap.fromTo(image, { opacity: .6, x: index > previousIndex ? 9 : -9 }, {
        opacity: 1, x: 0, duration: .3, ease: 'power2.out', clearProps: 'opacity,transform',
      });
    }).catch(() => {});
  }
  caption.textContent = `${photoIndex + 1} из ${photos.length} · ${photo.alt}`;

  for (const [position, button] of Array.from(thumbs.children).entries()) {
    if (position === photoIndex) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  }

  const activeThumb = thumbs.children[photoIndex];
  const thumbBounds = activeThumb.getBoundingClientRect();
  const stripBounds = thumbs.getBoundingClientRect();
  if (thumbBounds.left < stripBounds.left || thumbBounds.right > stripBounds.right) {
    thumbs.scrollLeft += thumbBounds.left - stripBounds.left - 4;
  }
}

function createThumb(photo, index) {
  const button = document.createElement('button');
  const preview = document.createElement('img');
  button.type = 'button';
  button.className = 'photo-thumb';
  button.setAttribute('aria-label', `Фото ${index + 1}. ${photo.alt}`);
  preview.alt = '';
  preview.loading = 'lazy';
  preview.src = photo.small || photo.src;
  button.append(preview);
  button.addEventListener('click', () => showPhoto(index));
  return button;
}

function openGallery(house, button, firstIndex = 0) {
  if (dialog.open) return;
  const source = button.getBoundingClientRect();
  const cropPosition = getComputedStyle(button.querySelector('img')).objectPosition.split(' ').map((value) => parseFloat(value) / 100);
  photos = media[house];
  opener = button;
  title.textContent = houses[house].name;
  thumbs.replaceChildren(...photos.map(createThumb));
  dialog.showModal();
  thumbs.scrollLeft = 0;
  showPhoto(firstIndex, false);
  closeButton.focus({ preventScroll: true });
  expandPhoto(source, cropPosition, transitionId);
}

function bindArrows(element, step) {
  element.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  });
}

function bindSwipe(element, step, tap) {
  let start;
  let handled = false;
  element.addEventListener('pointerdown', (event) => {
    handled = false;
    start = undefined;
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  element.addEventListener('pointercancel', () => { start = undefined; });
  element.addEventListener('pointerup', (event) => {
    if (start?.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = undefined;
    if (Math.abs(dx) >= 42 && Math.abs(dx) >= Math.abs(dy) * 1.35) {
      handled = true;
      step(dx < 0 ? 1 : -1);
    } else if (tap && Math.hypot(dx, dy) < 8) {
      handled = true;
      // Let the browser finish the touch's click before moving focus into the dialog.
      setTimeout(tap, 0);
    }
  });
  element.addEventListener('click', (event) => {
    if (!handled || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
}

function setupInterior(card, house) {
  const bedroom = card.querySelector('.home-bedroom');
  const film = card.querySelector('.home-film');
  const name = film.querySelector('[data-film-name]');
  const count = film.querySelector('[data-film-count]');
  const interiors = media[house].slice(1);
  let activeImage = bedroom.querySelector('img');
  let active = 0;
  let target = 0;
  let motion;
  let request = 0;

  async function step(delta) {
    const index = (target + delta + interiors.length) % interiors.length;
    target = index;
    const id = ++request;
    if (index === active) return;

    const photo = interiors[index];
    const preview = new Image();
    preview.alt = '';
    preview.draggable = false;
    preview.decoding = 'async';
    if (photo.small) preview.srcset = `${photo.small} 1x, ${photo.src} 2x`;
    preview.src = photo.src;
    try {
      await preview.decode();
    } catch {
      if (id === request) target = active;
      return;
    }
    if (id !== request) return;

    motion?.finish();
    const previous = activeImage;
    activeImage = preview;
    active = index;
    name.textContent = roomNames[house][index];
    count.textContent = `${index + 1} из ${interiors.length}`;
    bedroom.setAttribute('aria-label', `${photo.alt}. Увеличить фото`);
    if (reduced.matches) {
      previous.replaceWith(preview);
    } else {
      previous.after(preview);
      motion = preview.animate({ opacity: [0, 1] }, { duration: 240, easing: 'ease-out' });
      motion.finished.then(() => previous.remove());
    }
  }

  reduced.addEventListener('change', () => { if (reduced.matches) motion?.finish(); });
  function openInterior() {
    motion?.finish();
    openGallery(house, bedroom, active + 1);
  }
  bedroom.addEventListener('click', openInterior);
  film.querySelector('[data-film-previous]').addEventListener('click', () => step(-1));
  film.querySelector('[data-film-next]').addEventListener('click', () => step(1));
  film.querySelector('.home-film-controls').hidden = false;
  bindArrows(bedroom, step);
  bindArrows(film, step);
  bindSwipe(bedroom, step, openInterior);
}

for (const card of document.querySelectorAll('[data-home]')) {
  const house = card.dataset.home;
  const galleryButton = card.querySelector('.home-gallery');
  galleryButton.addEventListener('click', () => openGallery(house, galleryButton));
  setupInterior(card, house);

  for (const price of card.querySelectorAll('[data-rate]')) {
    price.textContent = rubles.format(houses[house][price.dataset.rate]);
  }

  card.querySelector('[data-select]').addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    document.dispatchEvent(new CustomEvent('select-house', { detail: house }));
  });
}

closeButton.addEventListener('click', () => dialog.close());
dialog.querySelector('[data-previous]').addEventListener('click', () => showPhoto(photoIndex - 1));
dialog.querySelector('[data-next]').addEventListener('click', () => showPhoto(photoIndex + 1));

bindArrows(dialog, (delta) => showPhoto(photoIndex + delta));
bindSwipe(stage, (delta) => showPhoto(photoIndex + delta));

function isBackdrop(event) {
  if (event.target !== dialog) return false;
  const bounds = dialog.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
}

dialog.addEventListener('pointerdown', (event) => { backdropPressed = isBackdrop(event); });
dialog.addEventListener('click', (event) => {
  if (backdropPressed && isBackdrop(event)) dialog.close();
  backdropPressed = false;
});

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  backdropPressed = false;
  cancelPhotoMotion();
  opener?.focus({ preventScroll: true });
});

reduced.addEventListener('change', () => {
  if (reduced.matches) cancelPhotoMotion();
});
