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
const image = dialog.querySelector('.photo-stage img');
const caption = dialog.querySelector('figcaption');
const thumbs = dialog.querySelector('.photo-thumbs');
const closeButton = dialog.querySelector('[data-close]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

let photos = [];
let photoIndex = 0;
let opener;
let transitionId = 0;
let floatingPhoto;

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

async function expandPhoto(source, id) {
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
    const cropX = (1 - source.width / (width * scale)) * 50;
    const cropY = (1 - source.height / (height * scale)) * 50;

    const ghost = new Image();
    ghost.className = 'photo-in-flight';
    ghost.alt = '';
    ghost.src = image.currentSrc;
    Object.assign(ghost.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` });
    floatingPhoto = ghost;
    dialog.append(ghost);
    image.style.visibility = 'hidden';
    gsap.fromTo(ghost, {
      x: source.left + source.width / 2 - (left + width / 2),
      y: source.top + source.height / 2 - (top + height / 2),
      scale,
      clipPath: `inset(${cropY}% ${cropX}%)`,
    }, {
      x: 0, y: 0, scale: 1, clipPath: 'inset(0% 0%)',
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
  const source = button.querySelector('img').getBoundingClientRect();
  photos = media[house];
  opener = button;
  title.textContent = houses[house].name;
  thumbs.replaceChildren(...photos.map(createThumb));
  dialog.showModal();
  thumbs.scrollLeft = 0;
  showPhoto(firstIndex, false);
  closeButton.focus({ preventScroll: true });
  expandPhoto(source, transitionId);
}

for (const card of document.querySelectorAll('[data-home]')) {
  const house = card.dataset.home;
  const galleryButton = card.querySelector('.home-gallery');
  const cover = media[house][0];
  const coverImage = galleryButton.querySelector('img');
  coverImage.src = cover.src;
  if (cover.small) {
    const originalWidth = house === 'guest' ? 1680 : 1152;
    coverImage.srcset = `${cover.small} 840w, ${cover.src} ${originalWidth}w`;
    coverImage.sizes = '(max-width: 700px) calc(100vw - 36px), (max-width: 1376px) 45vw, 616px';
  }
  galleryButton.querySelector('.gallery-label span').textContent = `Все фото (${media[house].length})`;
  galleryButton.addEventListener('click', () => openGallery(house, galleryButton));
  const bedroomButton = card.querySelector('.home-bedroom');
  const bedroom = media[house][1];
  bedroomButton.querySelector('img').src = bedroom.small || bedroom.src;
  bedroomButton.setAttribute('aria-label', `Внутри дома. ${bedroom.alt}`);
  bedroomButton.addEventListener('click', () => openGallery(house, bedroomButton, 1));

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

dialog.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showPhoto(photoIndex - 1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    showPhoto(photoIndex + 1);
  }
});

dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) {
    dialog.close();
  }
});

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  cancelPhotoMotion();
  opener?.focus({ preventScroll: true });
});

reduced.addEventListener('change', () => {
  if (reduced.matches) cancelPhotoMotion();
});
