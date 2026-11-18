const section = document.getElementById('nearby');

const resort = 'https://xn--80ajjldidqqjvv9e.xn--p1ai/';
const commonsPhoto = 'https://commons.wikimedia.org/wiki/File:Куркиёки,_Заречная_11_(2).jpg';
const places = [
  {
    id: 'hutor', label: 'Хутор Мельница', name: 'Хутор «Мельница»', coordinates: [61.311330, 30.125982],
    description: 'Хутор на берегу бухты Терву. Отсюда удобно знакомиться с Ладожскими шхерами.',
    image: './photos/dusk-flat-wide.webp', smallImage: './atlas/hutor-evening.webp',
    alt: 'Домики хутора на берегу Ладоги в вечернем свете',
    linkLabel: 'Как добраться', link: 'https://yandex.ru/maps/?rtext=~61.311330%2C30.125982',
    credit: 'Фото хутора', photoSource: resort,
  },
  {
    id: 'island', label: 'Койонсаари', name: 'Остров Койонсаари', coordinates: [61.283542, 30.093868],
    description: 'Песчаные пляжи, сосновый лес и скалы над Ладогой. На острове проходит маршрут национального парка.',
    image: './atlas/koyonsaari.webp', alt: 'Песчаный пляж Койонсаари со скалы',
    linkLabel: 'Маршрут нацпарка', link: 'https://parkladoga.ru/totravel/services/Ekskursii/ekskursiya-rayskiy-ostrov-koyonsaari/',
    credit: 'Фото с сайта хутора', photoSource: resort,
  },
  {
    id: 'museum', label: 'Музей «Кирьяж»', name: 'Музей «Кирьяж»', coordinates: [61.29630, 29.88499],
    description: 'Краеведческий музей в Куркиёках. В экспозиции «Кирьялы. 7 рун» рассказывают о средневековой Карелии.',
    image: './atlas/kirjazh.webp', alt: 'Деревянное здание музея в Куркиёках зимой',
    linkLabel: 'Сайт музея', link: 'https://kirjazh.spb.ru/k_centr.htm',
    credit: 'ElenaLitera · CC BY-SA 4.0', photoSource: commonsPhoto,
  },
  {
    id: 'falls', label: 'Долина водопадов', name: 'Долина водопадов', coordinates: [61.4776, 30.0307],
    description: 'Тропа у посёлка Ихала идёт вдоль реки Иййоки к четырём каскадам. Через реку перекинуты деревянные мостики.',
    image: './atlas/falls.webp', alt: 'Каскад на реке Иййоки среди елей',
    linkLabel: 'Точка на карте', link: 'https://www.openstreetmap.org/?mlat=61.4776&mlon=30.0307#map=16/61.4776/30.0307',
    credit: 'Фото с сайта хутора', photoSource: resort,
  },
];

// The static basemap and each marker share these Web Mercator coordinates.
const mercator = (lat) => Math.asinh(Math.tan(lat * Math.PI / 180)) * 180 / Math.PI;
const project = ([lat, lon]) => ({ x: (lon - 28.95) * 10000, y: (mercator(61.66) - mercator(lat)) * 10000 });
const positions = places.map(({ coordinates }) => project(coordinates));
const mapWidth = 25000;
const mapHeight = 12680;

const icons = {
  next: 'M3.5 10h12m-5-5 5 5-5 5',
  previous: 'M16.5 10h-12m5-5-5 5 5 5',
  external: 'M5 15 15 5M7 5h8v8',
  zoomIn: 'M4 10h12m-6-6v12',
  zoomOut: 'M4 10h12',
  reset: 'M3.5 8V3.5H8m4 0h4.5V8m0 4v4.5H12m-4 0H3.5V12',
  mill: 'M10 2v16M2 10h16M10 2l3 3m5 5-3 3m-5 5-3-3m-5-5 3-3',
};

const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;

function mountAtlas() {
  section.setAttribute('aria-labelledby', 'atlas-title');
  section.innerHTML = `
    <div class="atlas">
      <header class="atlas-heading">
        <p>Карелия · Посёлок Терву</p>
        <h2 id="atlas-title">В сердце<br><em>Ладожских шхер</em></h2>
      </header>
      <div class="atlas-map" role="region" aria-label="Карта окрестностей хутора" aria-describedby="atlas-keyboard" tabindex="0">
        <span class="atlas-sr" id="atlas-keyboard">Стрелки перемещают карту, плюс и минус меняют масштаб. Выберите метку или листайте места кнопками в карточке.</span>
        <div class="atlas-ground" aria-hidden="true">
          <img alt="" width="2500" height="1268" decoding="async" draggable="false">
          <span class="atlas-lake-name">Ладожское озеро</span>
        </div>
        <div class="atlas-veil" aria-hidden="true"></div>
        <div class="atlas-pins">
          ${places.map(({ id, label, name }) => `
            <button type="button" class="atlas-pin" data-place="${id}" aria-label="${name.replaceAll('"', '&quot;')}" aria-controls="atlas-card" aria-pressed="false">
              <span class="atlas-pin-symbol" aria-hidden="true">${id === 'hutor' ? icon('mill', 18) : ''}</span>
              <span class="atlas-pin-label" aria-hidden="true">${label}</span>
            </button>`).join('')}
        </div>
        <div class="atlas-compass" aria-hidden="true"><span>С</span><svg width="16" height="21" viewBox="0 0 16 21" fill="none"><path d="M8 1 14 18 8 14 2 18Z" stroke="currentColor"/><path d="M8 1V14L2 18Z" fill="currentColor"/></svg></div>
        <div class="atlas-map-actions" role="group" aria-label="Масштаб карты">
          <button type="button" data-zoom="in" aria-label="Приблизить">${icon('zoomIn')}</button>
          <button type="button" data-zoom="out" aria-label="Отдалить">${icon('zoomOut')}</button>
          <button type="button" data-zoom="reset" aria-label="Показать все места">${icon('reset')}</button>
        </div>
        <div class="atlas-map-info">
          <span class="atlas-distance" aria-hidden="true"></span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>
        </div>
        <p class="atlas-map-note" role="status" hidden>Подложка не загрузилась</p>
      </div>
      <article class="atlas-card" id="atlas-card" aria-labelledby="atlas-place-name">
        <h3 id="atlas-place-name" aria-live="polite" aria-atomic="true"></h3>
        <a class="atlas-place-link" target="_blank" rel="noopener"><span></span>${icon('external', 14)}</a>
        <div class="atlas-card-photo">
          <img alt="" width="680" height="370" decoding="async">
          <p class="atlas-photo-note" hidden>Фото не загрузилось</p>
        </div>
        <p class="atlas-place-description"></p>
        <div class="atlas-card-footer">
          <a class="atlas-photo-credit" target="_blank" rel="noopener"></a>
          <div class="atlas-card-actions" role="group" aria-label="Места поблизости">
            <button type="button" data-step="-1" aria-label="Предыдущее место">${icon('previous')}</button>
            <button type="button" data-step="1" aria-label="Следующее место">${icon('next')}</button>
          </div>
        </div>
      </article>
    </div>`;

  const find = (selector) => section.querySelector(selector);
  const map = find('.atlas-map');
  const heading = find('.atlas-heading');
  const ground = find('.atlas-ground');
  const mapImage = ground.querySelector('img');
  const lakeName = find('.atlas-lake-name');
  const lakeCoordinate = project([61.265, 30.37]);
  lakeName.style.left = `${lakeCoordinate.x / 10}px`;
  lakeName.style.top = `${lakeCoordinate.y / 10}px`;

  const card = find('.atlas-card');
  const picture = card.querySelector('img');
  const photoNote = find('.atlas-photo-note');
  const name = find('#atlas-place-name');
  const description = find('.atlas-place-description');
  const link = find('.atlas-place-link');
  const credit = find('.atlas-photo-credit');
  const scaleBar = find('.atlas-distance');
  const pins = [...section.querySelectorAll('.atlas-pin')];
  const zoomIn = find('[data-zoom="in"]');
  const zoomOut = find('[data-zoom="out"]');
  const mobile = matchMedia('(max-width: 800px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const minPosition = { x: Math.min(...positions.map(({ x }) => x)), y: Math.min(...positions.map(({ y }) => y)) };
  const maxPosition = { x: Math.max(...positions.map(({ x }) => x)), y: Math.max(...positions.map(({ y }) => y)) };
  const middle = { x: (minPosition.x + maxPosition.x) / 2, y: (minPosition.y + maxPosition.y) / 2 };

  let selected = 0;
  let view, camera, target, frame;
  let mode = 'overview';
  let drag;
  let assetObserver;
  let assetsRequested = false;

  const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
  const at = ({ x, y }, scale, screen = view.center) => ({ x: screen.x - x * scale, y: screen.y - y * scale, scale });

  function render() {
    ground.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale * 10})`;
    lakeName.style.setProperty('--atlas-inverse-scale', 1 / (camera.scale * 10));
    const km = 1.875 * camera.scale * 100;
    const step = [10, 5, 2, 1, 0.5].find((distance) => distance * km <= 80) ?? 0.5;
    scaleBar.style.width = `${step * km}px`;
    scaleBar.textContent = `${step.toLocaleString('ru-RU')} км`;

    pins.forEach((pin, index) => {
      const x = positions[index].x * camera.scale + camera.x;
      const y = positions[index].y * camera.scale + camera.y;
      pin.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      pin.hidden = x < 22 || x > view.width - 22 || y < 23 || y > view.height - 23;
      const labelRoom = mobile.matches && pin.dataset.place === 'island' ? 110 : 215;
      const narrowMuseum = view.width <= 450 && pin.dataset.place === 'museum';
      pin.classList.toggle('atlas-pin-left', narrowMuseum ? x >= 146 : x > view.width - labelRoom);
      pin.classList.toggle('atlas-pin-below', narrowMuseum && x < 146);
      if (narrowMuseum) pin.style.setProperty('--atlas-label-offset', `${Math.max(0, 65 - x)}px`);
    });
    zoomIn.setAttribute('aria-disabled', String(camera.scale >= view.max * 0.997));
    zoomOut.setAttribute('aria-disabled', String(camera.scale <= view.min * 1.003));
  }

  function move(next, animate = true) {
    cancelAnimationFrame(frame);
    const scale = next.scale;
    target = {
      scale,
      x: clamp(next.x, view.width - mapWidth * scale, 0),
      y: clamp(next.y, view.height - mapHeight * scale, 0),
    };
    if (!camera || !animate || motion.matches) {
      camera = target;
      render();
      return;
    }

    const start = camera;
    const end = target;
    const started = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 650);
      const ease = 1 - (1 - progress) ** 3;
      camera = {
        x: start.x + (end.x - start.x) * ease,
        y: start.y + (end.y - start.y) * ease,
        scale: start.scale + (end.scale - start.scale) * ease,
      };
      render();
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  function showOverview(animate) {
    mode = 'overview';
    move(at(middle, view.overview), animate);
  }

  function aimAtPlace(animate) {
    mode = 'place';
    move(at(positions[selected], Math.min(view.max, view.overview * (mobile.matches ? 1.65 : 1.6))), animate);
  }

  function measure() {
    const width = map.clientWidth;
    const height = map.clientHeight;
    if (!width || !height) return;
    const compact = mobile.matches;
    const left = compact ? 36 : card.offsetLeft + card.offsetWidth + 62;
    const right = width - (compact ? 67 : 100);
    const top = compact ? 55 : Math.max(278, heading.offsetTop + heading.offsetHeight + 30);
    const bottom = height - (compact ? 109 : 135);
    const min = Math.max(width / mapWidth, height / mapHeight);
    const overview = Math.max(min, Math.min((right - left) / (maxPosition.x - minPosition.x), (bottom - top) / (maxPosition.y - minPosition.y)));
    view = {
      width, height, min, max: overview * 3.15, overview,
      center: { x: left + (right - left) * (compact ? .5 : .40), y: (top + bottom) / 2 },
    };
    if (mode === 'place') aimAtPlace(false);
    else showOverview(false);
  }

  function select(index, animate = true) {
    selected = (index + places.length) % places.length;
    const place = places[selected];
    if (assetsRequested) setPhoto(place);
    else if (animate) requestAssets();
    name.textContent = place.name;
    description.textContent = place.description;
    link.href = place.link;
    link.querySelector('span').textContent = place.linkLabel;
    credit.href = place.photoSource;
    credit.textContent = place.credit;
    pins.forEach((pin, i) => pin.setAttribute('aria-pressed', String(i === selected)));
    if (view && animate) aimAtPlace(true);
  }

  function setPhoto(place) {
    const source = (mobile.matches && place.smallImage) || place.image;
    if (picture.getAttribute('src') === source) return;
    picture.hidden = false;
    photoNote.hidden = true;
    picture.alt = place.alt;
    picture.src = source;
  }

  function requestAssets() {
    if (assetsRequested) return;
    assetsRequested = true;
    assetObserver?.disconnect();
    mapImage.src = './atlas/ladoga.svg';
    setPhoto(places[selected]);
  }

  function zoom(factor, anchor = view.center) {
    requestAssets();
    const scale = clamp(target.scale * factor, view.min, view.max);
    mode = 'manual';
    move(at({ x: (anchor.x - target.x) / target.scale, y: (anchor.y - target.y) / target.scale }, scale, anchor));
  }

  mapImage.addEventListener('error', (event) => {
    event.currentTarget.hidden = true;
    lakeName.hidden = true;
    scaleBar.hidden = true;
    find('.atlas-map-note').hidden = false;
  });
  picture.addEventListener('error', () => {
    picture.hidden = true;
    photoNote.hidden = false;
  });

  pins.forEach((pin, index) => pin.addEventListener('click', () => select(index)));
  section.querySelectorAll('[data-step]').forEach((button) => {
    button.addEventListener('click', () => select(selected + Number(button.dataset.step)));
  });
  zoomIn.addEventListener('click', () => zoom(1.33));
  zoomOut.addEventListener('click', () => zoom(1 / 1.33));
  find('[data-zoom="reset"]').addEventListener('click', () => {
    requestAssets();
    showOverview(true);
  });

  map.addEventListener('keydown', (event) => {
    if (event.target !== map) return;
    const offsets = { ArrowUp: [0, 75], ArrowDown: [0, -75], ArrowLeft: [75, 0], ArrowRight: [-75, 0] };
    if (event.key in offsets) {
      const [dx, dy] = offsets[event.key];
      mode = 'manual';
      move({ ...target, x: target.x + dx, y: target.y + dy });
    } else if (event.key === '+' || event.key === '=') zoom(1.33);
    else if (event.key === '-') zoom(1 / 1.33);
    else if (event.key === 'Home') showOverview(true);
    else return;
    requestAssets();
    event.preventDefault();
  });

  map.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const { left, top } = map.getBoundingClientRect();
    event.preventDefault();
    zoom(Math.exp(-event.deltaY * 0.003), { x: event.clientX - left, y: event.clientY - top });
  }, { passive: false });

  function beginPan(pointerId) {
    requestAssets();
    cancelAnimationFrame(frame);
    drag.origin = camera;
    target = camera;
    map.setPointerCapture(pointerId);
    map.classList.add('atlas-dragging');
  }

  function endPan(event) {
    if (drag?.id !== event.pointerId) return;
    drag = undefined;
    map.classList.remove('atlas-dragging');
  }

  map.addEventListener('pointerdown', (event) => {
    if (!camera || !event.isPrimary || event.button !== 0 || event.target.closest('button, a')) return;
    const touch = event.pointerType === 'touch';
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, touch };
    if (!touch) beginPan(event.pointerId);
  });
  map.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.origin) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        endPan(event);
        return;
      }
      if (Math.abs(dx) < Math.abs(dy) * 1.25) return;
      beginPan(event.pointerId);
    }
    mode = 'manual';
    const { x, y, scale } = drag.origin;
    move({ x: x + dx, y: drag.touch ? y : y + dy, scale }, false);
  });
  map.addEventListener('pointerup', endPan);
  map.addEventListener('pointercancel', endPan);
  map.addEventListener('lostpointercapture', endPan);

  select(0, false);
  measure();
  const resize = new ResizeObserver(measure);
  resize.observe(map);
  resize.observe(heading);
  if (location.hash === '#nearby' || !('IntersectionObserver' in window)) requestAssets();
  else {
    assetObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) requestAssets();
    }, { rootMargin: '450px 0px' });
    assetObserver.observe(section);
  }
}

if (section) mountAtlas();
