import { houses } from './shared.js';
import { fragmentLink, navigateToFragment } from './scroll.js';

const planner = document.querySelector('#planner');
const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
});
const calendarDate = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});
const plural = new Intl.PluralRules('ru-RU');
const dayLength = 86400000;
const rates = [
  { key: 'weekday', label: 'Пн–чт', days: [1, 2, 3, 4] },
  { key: 'weekend', label: 'Пт–вс', days: [5, 6, 0] },
];

planner.setAttribute('aria-labelledby', 'planner-title');
planner.innerHTML = `
  <form class="site-shell trip" aria-labelledby="planner-title" novalidate>
    <div class="trip-fields">
      <h2 id="planner-title">Спланируйте поездку</h2>
      <div class="trip-date-group">
        <div class="trip-dates">
          <div class="trip-date-field">
            <label for="trip-arrival">Заезд</label>
            <input id="trip-arrival" type="date" aria-describedby="trip-date-error">
          </div>
          <div class="trip-date-field">
            <label for="trip-departure">Выезд</label>
            <input id="trip-departure" type="date" aria-describedby="trip-date-error">
            <button class="trip-weekend" type="button" id="trip-weekend"
              aria-label="На выходные, выбрать ближайшую пятницу и воскресенье">На выходные</button>
          </div>
        </div>
        <p class="trip-error" id="trip-date-error" hidden></p>
      </div>

      <fieldset class="trip-houses">
        <legend>Где остановитесь</legend>
        <div class="trip-house-options">
          ${Object.entries(houses).map(([key, house], index) => `
            <label class="trip-house">
              <input type="radio" name="trip-house" value="${key}" ${index === 0 ? 'checked' : ''}>
              <span><strong>${house.name}</strong><small>До ${house.max} гостей</small></span>
            </label>
          `).join('')}
        </div>
      </fieldset>

      <div class="trip-party">
        <div>
          <label for="trip-guests">Гости</label>
          <p class="trip-hint" id="trip-guest-hint"></p>
        </div>
        <div class="trip-stepper">
          <button type="button" id="trip-fewer" aria-label="Уменьшить число гостей">−</button>
          <input id="trip-guests" type="number" min="1" step="1" value="2" inputmode="numeric"
            aria-describedby="trip-guest-hint trip-guest-error">
          <button type="button" id="trip-more" aria-label="Увеличить число гостей">+</button>
        </div>
        <p class="trip-error" id="trip-guest-error" hidden></p>
        <button class="trip-correct" type="button" id="trip-correct" hidden></button>
      </div>

      <div class="trip-sauna" role="group" aria-labelledby="trip-sauna-title">
        <span class="trip-sr-only" id="trip-sauna-title">Баня у Ладоги</span>
        <label class="trip-check">
          <input id="trip-sauna" type="checkbox" aria-labelledby="trip-sauna-option" aria-describedby="trip-sauna-hint">
          <span>
            <span id="trip-sauna-option">Уточнить про баню</span>
            <span class="trip-hint" id="trip-sauna-hint">Время и цену уточним</span>
          </span>
        </label>
        <div id="trip-sauna-date-field" hidden>
          <label for="trip-sauna-date">День визита
            <input id="trip-sauna-date" type="date" aria-describedby="trip-sauna-error">
          </label>
        </div>
        <p class="trip-error" id="trip-sauna-error" hidden></p>
      </div>
    </div>

    <section class="trip-result" aria-label="Расчёт поездки">
      <div class="trip-quote">
        <div>
          <p class="trip-total-label">За проживание</p>
          <p class="trip-total" id="trip-total"></p>
        </div>
        <div class="trip-result-meta">
          <p class="trip-hint" id="trip-estimate-hint" hidden></p>
          <p id="trip-result-guests"></p>
        </div>
      </div>
      <p class="trip-hint" id="trip-extra" hidden></p>
      <p class="trip-hint">Наличие и цену подтвердит администратор.</p>

      <div class="trip-result-footer">
        <button class="trip-copy" id="trip-copy" type="button" aria-describedby="trip-copy-privacy" disabled>Скопировать запрос
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
            <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2"/>
          </svg>
        </button>
        <p class="trip-status" id="trip-copy-status" role="status"></p>
        <p class="trip-hint trip-demo" id="trip-copy-privacy">Запрос останется у вас</p>
      </div>

      <div class="trip-disclosures">
        <details class="trip-tariffs" id="trip-tariffs">
          <summary>Тарифы и условия</summary>
          <h3 id="trip-result-house"></h3>
          <p class="trip-hint" id="trip-result-dates"></p>
          <ul id="trip-rates" aria-label="Применённые тарифы" hidden></ul>
          <p class="trip-hint" id="trip-holiday" hidden></p>
          <p class="trip-hint" id="trip-sauna-summary" hidden></p>
        </details>
        <details class="trip-manual" id="trip-manual" hidden>
          <summary aria-label="Текст запроса для ручного копирования">Текст запроса</summary>
          <textarea id="trip-request" aria-label="Текст запроса" readonly rows="7"></textarea>
          <button class="trip-link" type="button" id="trip-select-request">Выделить текст</button>
        </details>
      </div>
      <p class="trip-sr-only" id="trip-live" role="status"></p>
    </section>
  </form>
`;

const get = (id) => document.getElementById(`trip-${id}`);
const arrival = get('arrival');
const departure = get('departure');
const guests = get('guests');
const fewer = get('fewer');
const more = get('more');
const correct = get('correct');
const sauna = get('sauna');
const saunaDate = get('sauna-date');
const totalField = get('total');
const copy = get('copy');
const tariffs = get('tariffs');
const rateList = get('rates');
const manual = get('manual');
const request = get('request');
const copyStatus = get('copy-status');
const houseInputs = Array.from(planner.querySelectorAll('input[name="trip-house"]'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let previousSaunaStart;
let previousSaunaEnd;

function localToday() {
  const now = new Date();
  return [String(now.getFullYear()).padStart(4, '0'), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
}

function selectWeekend() {
  const today = readDay(localToday());
  const weekday = new Date(today * dayLength).getUTCDay();
  const friday = today + (5 - weekday + 7) % 7;
  arrival.value = dayValue(friday);
  departure.value = dayValue(friday + 2);
  render();
}

// Date controls expose civil dates. UTC day numbers keep nights independent of local DST.
function readDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || match[1] === '0000') return NaN;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
    ? date.valueOf() / dayLength
    : NaN;
}

function dayValue(day) {
  return new Date(day * dayLength).toISOString().slice(0, 10);
}

function prettyDate(day) {
  return calendarDate.format(day * dayLength);
}

function prettyRange(start, end) {
  if (!calendarDate.formatRange) return `${prettyDate(start)} — ${prettyDate(end)}`;
  return calendarDate.formatRange(start * dayLength, end * dayLength).replace(/\s+г\./gu, '');
}

function amount(count, words) {
  const word = words[plural.select(count)] ?? words.many;
  return `${count} ${word}`;
}

const nightsLabel = (count) => amount(count, { one: 'ночь', few: 'ночи', many: 'ночей' });
const guestsLabel = (count) => amount(count, { one: 'гость', few: 'гостя', many: 'гостей' });
const placesLabel = (count) => amount(count, { one: 'место', few: 'места', many: 'мест' });
const money = (value) => currency.format(value);

function activeHouse() {
  return houses[houseInputs.find((input) => input.checked).value];
}

function dateRange() {
  const today = localToday();
  const todayDay = readDay(today);
  const start = readDay(arrival.value);
  const end = readDay(departure.value);
  arrival.min = today;
  departure.min = Number.isFinite(start) && start >= todayDay && start < readDay('9999-12-31')
    ? dayValue(start + 1)
    : today;

  let error = '';
  let invalid;
  if (arrival.validity.badInput || (arrival.value && !Number.isFinite(start))) {
    error = 'Укажите корректную дату заезда.';
    invalid = arrival;
  } else if (departure.validity.badInput || (departure.value && !Number.isFinite(end))) {
    error = 'Укажите корректную дату выезда.';
    invalid = departure;
  } else if (start < todayDay) {
    error = 'Выберите заезд сегодня или позже.';
    invalid = arrival;
  } else if (end <= start || end < todayDay) {
    error = 'Выезд должен быть позже заезда.';
    invalid = departure;
  }
  arrival.setAttribute('aria-invalid', String(invalid === arrival));
  departure.setAttribute('aria-invalid', String(invalid === departure));
  showNote('date-error', error);
  return { start, end, valid: Number.isFinite(start) && Number.isFinite(end) && !error };
}

function showNote(id, value) {
  const note = get(id);
  note.textContent = value;
  note.hidden = !value;
}

function updateSauna(range) {
  get('sauna-date-field').hidden = !sauna.checked;
  const dateAvailable = sauna.checked && range.valid;
  saunaDate.disabled = !dateAvailable;
  let error = '';
  if (dateAvailable) {
    saunaDate.min = dayValue(range.start);
    saunaDate.max = dayValue(range.end);
    const selectedDay = readDay(saunaDate.value);
    const rangeChanged = range.start !== previousSaunaStart || range.end !== previousSaunaEnd;
    if (rangeChanged && (!Number.isFinite(selectedDay) || selectedDay < range.start || selectedDay > range.end)) {
      saunaDate.value = saunaDate.min;
    }
    const day = readDay(saunaDate.value);
    if (!Number.isFinite(day) || day < range.start || day > range.end) {
      error = 'Выберите день между заездом и выездом.';
    }
    previousSaunaStart = range.start;
    previousSaunaEnd = range.end;
  } else if (sauna.checked) {
    error = 'Сначала укажите даты поездки.';
  }
  saunaDate.setAttribute('aria-invalid', String(dateAvailable && !!error));
  showNote('sauna-error', error);
  return dateAvailable && !error ? prettyDate(readDay(saunaDate.value)) : '';
}

function calculate(house, start, end) {
  const nights = end - start;
  const wholeWeeks = Math.floor(nights / 7);
  const firstWeekday = new Date(start * dayLength).getUTCDay();
  const remainingWeekdays = Array.from({ length: nights % 7 }, (_, offset) => (firstWeekday + offset) % 7);
  return rates.map(({ key, label, days }) => {
    const count = wholeWeeks * days.length + remainingWeekdays.filter((day) => days.includes(day)).length;
    const subtotal = count * house[key];
    return { count, subtotal, text: `${label} · ${nightsLabel(count)} × ${money(house[key])} = ${money(subtotal)}` };
  }).filter(({ count }) => count > 0);
}

function updateTicketText(id, text, animated) {
  const field = get(id);
  if (field.textContent === text) return;
  const hadText = Boolean(field.textContent);
  field.textContent = text;
  if (animated && hadText && !reduceMotion.matches) {
    field.getAnimations().forEach((animation) => animation.cancel());
    field.animate([{ opacity: 0.45, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 370, easing: 'cubic-bezier(.2,.75,.25,1)' });
  }
}

function render() {
  const house = activeHouse();
  const count = guests.valueAsNumber;
  const validCount = Number.isInteger(count) && count >= 1;
  const tooMany = validCount && count > house.max;
  const enoughSpace = validCount && !tooMany;
  const range = dateRange();
  const saunaDay = updateSauna(range);
  const guestError = tooMany
    ? `Здесь помещается до ${house.max} гостей. Уменьшите число гостей или выберите другой дом.`
    : validCount ? '' : 'Введите целое число гостей от 1.';
  guests.max = house.max;
  guests.setAttribute('aria-invalid', String(!enoughSpace));
  fewer.disabled = !validCount || count <= 1;
  more.disabled = validCount && count >= house.max;
  correct.hidden = !tooMany;
  correct.textContent = `Указать ${house.max}`;
  get('guest-hint').textContent = `В тарифе до ${house.base} · всего до ${house.max}`;
  showNote('guest-error', guestError);

  const lines = range.valid && enoughSpace ? calculate(house, range.start, range.end) : [];
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const departureText = range.valid ? prettyDate(range.end) : '';
  const arrivalText = range.valid ? prettyDate(range.start) : '';
  const nightText = range.valid ? nightsLabel(range.end - range.start) : '';
  const extraText = enoughSpace && count > house.base
    ? `Доплату за дополнительные места (${placesLabel(count - house.base)}) уточнит администратор.` : '';
  const holidayText = house.holiday
    ? `В праздники — ${money(house.holiday)} за ночь. Даты действия уточнит администратор.`
    : '';
  const saunaText = saunaDay ? `Баня · ${saunaDay.replace(/\s+г\.$/u, '')}. Стоимость и время нужно уточнить.` : '';

  get('result-house').textContent = house.name;
  get('result-dates').textContent = range.valid
    ? prettyRange(range.start, range.end)
    : 'Выберите даты заезда и выезда';
  showNote('estimate-hint', range.valid ? '' : 'Выберите даты для расчёта');
  get('result-guests').textContent = [nightText, validCount ? guestsLabel(count) : 'Укажите число гостей']
    .filter(Boolean).join(' · ');
  tariffs.hidden = !lines.length && !holidayText;
  if (tariffs.hidden) tariffs.open = false;
  rateList.hidden = !lines.length;
  rateList.replaceChildren(...lines.map(({ text }) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  totalField.toggleAttribute('data-long-total', total >= 1_000_000_000);
  updateTicketText('total', total ? money(total) : '—', Boolean(total));
  showNote('extra', extraText ? `Доплата за ${placesLabel(count - house.base)} уточняется.` : '');
  showNote('sauna-summary', saunaText);
  showNote('holiday', holidayText);
  updateTicketText('live', [
    house.name, range.valid ? nightText : get('date-error').textContent,
    guestError, total ? `Предварительная стоимость ${money(total)}.` : '',
    sauna.checked ? saunaText || get('sauna-error').textContent : '',
  ].filter(Boolean).join(' '));

  const canRequest = Boolean(lines.length && (!sauna.checked || saunaDay));
  copy.disabled = !canRequest;
  manual.hidden = !canRequest;
  if (!canRequest) manual.open = false;
  const requestText = canRequest ? [
    'Здравствуйте! Подскажите, пожалуйста, можно ли остановиться у вас на эти даты?',
    `${house.name}, ${guestsLabel(count)}`,
    `Заезд ${arrivalText}, выезд ${departureText} · ${nightText}.`,
    'Предварительный расчёт за проживание',
    ...lines.map(({ text }) => text),
    `Итого ${money(total)}.`,
    extraText,
    house.holiday ? 'Подходит ли к этим датам обычный тариф?' : '',
    saunaDay ? `Также подскажите, пожалуйста, есть ли свободное время в бане ${saunaDay} и сколько она стоит.` : '',
    'Пожалуйста, подтвердите наличие мест и итоговую стоимость.',
  ].filter((line) => line !== '').join('\n') : '';
  if (request.value !== requestText) {
    request.value = requestText;
    copyStatus.textContent = '';
  }
}

function changeGuests(count) {
  guests.value = count;
  render();
}

planner.addEventListener('input', (event) => {
  if (event.target !== request) render();
});
planner.querySelector('form').addEventListener('submit', (event) => event.preventDefault());
document.addEventListener('click', (event) => {
  const link = fragmentLink(event);
  if (link?.hash !== '#planner') return;

  const house = houseInputs.find(({ value }) => value === link.dataset.select);
  const wantsSauna = link.matches(
    '[data-request-sauna], #sauna .sauna-detail a, #sauna-visit a, #sauna-visit',
  );
  if (!house && !wantsSauna) return;

  if (house) house.checked = true;
  if (wantsSauna) sauna.checked = true;
  render();
  navigateToFragment(event, link, wantsSauna && !saunaDate.disabled ? saunaDate : arrival);
});
get('weekend').addEventListener('click', selectWeekend);
fewer.addEventListener('click', () => {
  const atMinimum = guests.valueAsNumber === 2;
  if (atMinimum) guests.focus();
  changeGuests(guests.valueAsNumber - 1);
});
more.addEventListener('click', () => {
  const value = guests.valueAsNumber;
  if (value + 1 === activeHouse().max) guests.focus();
  changeGuests(Number.isInteger(value) && value >= 1 ? value + 1 : 1);
});
correct.addEventListener('click', () => {
  guests.focus();
  changeGuests(activeHouse().max);
});

function selectRequest() {
  manual.open = true;
  request.focus();
  request.select();
  copyStatus.textContent = 'Текст выделен. Скопируйте его вручную.';
}

get('select-request').addEventListener('click', selectRequest);
copy.addEventListener('click', async () => {
  const currentText = request.value;
  if (!currentText) return;
  try {
    await navigator.clipboard.writeText(currentText);
    if (request.value === currentText) copyStatus.textContent = 'Запрос скопирован.';
  } catch {
    if (request.value !== currentText) return;
    selectRequest();
  }
});

window.addEventListener('focus', render);
render();
