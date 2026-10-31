const load = fetch('data.json', {cache: 'no-cache'}).then(r => r.json());
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = (v, d = 2) => v.toLocaleString('ru-RU', {maximumFractionDigits: d});
/* Число и единица не разрываются переносом строки (иначе «72» остаётся в конце строки, а «м²» — на следующей). */
const NB = '\u00A0';
const m2 = v => v > 0 ? nf(v) + NB + 'м²' : '—';
const m2r = v => v > 0 ? nf(v, 0) + NB + 'м²' : '—';     // на карточках — без копеек
/** Куски, которые переносятся только целиком: «Москва 153 м²» / «Тверь 562 м²». */
const parts = list => list.filter(Boolean).map(x => `<span class="nw">${x}</span>`).join('<span class="sep-dot"> · </span>');
const WA = 'https://wa.me/79253907888';
/** Довоз со склада Тверь в Москву — один день. */
const TVER_ETA_LOW = 'довоз в Москву — 1\u00A0день';

/* Обложка карточки — интерьерный кадр. По схеме владельца интерьер пятый (ванная);
   у моделей, где кадры стоят иначе, номер задан вручную (1 = первый кадр).
   ponytail: ручной список, при новых фото проверять; когда надоест — поле «обложка» в редакторе. */
const COVER = {VHP612098: 8, VHP612391: 6, VHP612390: 6, VHP612392: 7, VHP612826: 8, VHP612800: 8, VHP612039: 4,
  VHP612887: 8, VHP612042: 5, VHP600806: 7, VHP600157: 1, VHP600003: 1, VHP600865: 5, VHF600818: 5, VHF600188: 5,
  VHP600813: 6, VHP600826: 7, VHF600822: 8, VHF600007: 8, VHF600080: 8, VHF600229: 7, VHF600227: 7, VHP600853: 6};
const coverIdx = t => {
  const n = COVER[t.art] ? COVER[t.art] - 1 : (t.photos.length >= 6 ? 4 : 0);
  return Math.min(n, t.photos.length - 1);
};
/** На карточке — сама плитка (первый кадр), при наведении проявляется интерьер. */
const cover = t => {
  if (!t.photos.length) return 'фото скоро';
  const i = coverIdx(t);
  return `<img src="img/${t.art}/${t.photos[0]}_t.jpg" alt="${esc(t.name)}" loading="lazy">` +
    (i > 0 ? `<img class="alt" src="img/${t.art}/${t.photos[i]}_t.jpg" alt="" aria-hidden="true" loading="lazy">` : '');
};

/** «1 уп-2шт-1,44м2-28,8 кг» → {pcs: 2, sqm: 1.44, kg: 28.8}; чего нет — 0. */
function pack(s) {
  const n = re => +((String(s || '').replace(/,/g, '.').match(re) || [])[1] || 0);
  return {pcs: n(/(\d+)\s*шт/i), sqm: n(/([\d.]+)\s*м2/i), kg: n(/([\d.]+)\s*кг/i), packs: n(/(\d+)\s*уп/i)};
}
const packText = t => {
  const p = pack(t.packing);
  return p.sqm ? parts([p.pcs && `${p.pcs}${NB}плит${p.pcs < 5 ? 'ки' : 'ок'}`, `${nf(p.sqm)}${NB}м²`, p.kg && `${nf(p.kg, 1)}${NB}кг`])
    : esc(t.packing);
};
const palletText = t => {
  const p = pack(t.pallet);
  return p.sqm ? parts([p.packs && `${p.packs}${NB}упаковок`, `${nf(p.sqm)}${NB}м²`, p.kg && `${nf(p.kg, 0)}${NB}кг`])
    : esc(t.pallet);
};
const stockLine = t => t.stock.msk > 0 || t.stock.tver > 0
  ? `<span class="dot"></span><span class="lines">${parts([`Москва ${m2r(t.stock.msk)}`, `Тверь ${m2r(t.stock.tver)}`])}</span>`
  : '<span class="dot off"></span><span>Под заказ</span>';

const card = t => `
  <a class="card" href="tile.html?a=${t.art}">
    <div class="ph">${cover(t)}<span class="fmt">${t.format}</span>${t.is_new ? '<span class="new">Новинка</span>' : ''}</div>
    <div class="nm"><h3>${esc(t.name)}</h3><span class="srf">${esc(t.surface)}</span></div>
    <div class="stock">${stockLine(t)}</div>
  </a>`;

const models = n => {
  const k = n % 10, h = n % 100;
  return `${n} ${k === 1 && h !== 11 ? 'модель' : k >= 2 && k <= 4 && (h < 12 || h > 14) ? 'модели' : 'моделей'}`;
};

async function renderCatalog() {
  const { tiles } = await load;
  const [q, fmt, srf, grid, count] = ['q','fmt','srf','grid','count'].map(id => document.getElementById(id));

  const want = new URLSearchParams(location.search).get('f') || '';
  const formats = [...new Set(tiles.map(t => t.format))].sort((a, b) => parseInt(a.split('×')[1]) - parseInt(b.split('×')[1]));
  fmt.innerHTML = ['', ...formats].map(v =>
    `<button type="button" class="chip" aria-pressed="${v === want || (!v && !formats.includes(want))}" data-v="${v}">${v || 'Все форматы'}</button>`).join('');
  srf.innerHTML = [...new Set(tiles.map(t => t.surface))].sort().map(v =>
    `<button type="button" class="chip srf" aria-pressed="false" data-v="${esc(v)}">${esc(v)}</button>`).join('');

  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const f = fmt.querySelector('[aria-pressed=true]').dataset.v;
    const sf = srf.querySelector('[aria-pressed=true]')?.dataset.v || '';
    const list = tiles.filter(t => (!f || t.format === f) && (!sf || t.surface === sf) &&
      (!s || (t.name + ' ' + t.art).toLowerCase().includes(s)));
    grid.innerHTML = list.map(card).join('') || '<p class="empty">Ничего не найдено — попробуйте другой формат или поверхность.</p>';
    count.textContent = list.length === tiles.length ? models(tiles.length) : `${list.length} из ${tiles.length}`;
  };

  fmt.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    fmt.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    draw();
  });
  srf.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';            // повторный клик снимает фильтр
    srf.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', on && c === b));
    draw();
  });
  q.addEventListener('input', draw);
  draw();

  const withPhoto = tiles.filter(t => t.photos.length).length;
  document.getElementById('s-models').textContent = tiles.length;
  document.getElementById('stat').textContent = `${models(tiles.length)} · ${withPhoto} с фотографиями`;
}

/** Полноэкранный просмотр фото со стрелками и Esc. */
function lightbox(photos, art, start) {
  let i = start;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img alt=""><button class="x" aria-label="Закрыть">✕</button>
    ${photos.length > 1 ? '<button class="prev" aria-label="Предыдущее">‹</button><button class="next" aria-label="Следующее">›</button>' : ''}`;
  const show = () => box.querySelector('img').src = `img/${art}/${photos[i]}.jpg`;
  const close = () => { box.remove(); document.removeEventListener('keydown', keys); };
  const step = d => { i = (i + d + photos.length) % photos.length; show(); };
  const keys = e => ({Escape: close, ArrowLeft: () => step(-1), ArrowRight: () => step(1)})[e.key]?.();
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return close();
    if (b.className === 'x') close(); else step(b.className === 'next' ? 1 : -1);
  });
  document.addEventListener('keydown', keys);
  show();
  document.body.append(box);
}

async function renderTile() {
  const { tiles } = await load;
  const art = new URLSearchParams(location.search).get('a');
  const t = tiles.find(x => x.art === art);
  const box = document.getElementById('tile');
  if (!t) {
    box.innerHTML = `<div class="wrap missing"><p>Эта модель сейчас не в каталоге.</p>
      <p><a class="btn solid" href="index.html#catalog">Весь каталог</a></p></div>`;
    return;
  }
  document.title = `${t.name} — керамогранит ${t.format} | Алмалы-Керамик`;

  const p = pack(t.packing);
  const packs = v => p.sqm ? Math.floor(v / p.sqm + 1e-9) : 0;
  const freeMsk = Math.max(0, t.stock.msk - t.stock.msk_res), freeTver = Math.max(0, t.stock.tver - t.stock.tver_res);
  const wa = `${WA}?text=${encodeURIComponent(`Здравствуйте! Интересует керамогранит ${t.name} ${t.format}.`)}`;
  const start = 0;                                      // галерея открывается с самой плитки

  const gallery = t.photos.length ? `
    <button type="button" class="main-ph" id="big-wrap" aria-label="Открыть фото на весь экран">
      <img id="big" src="img/${t.art}/${t.photos[start]}.jpg" alt="${esc(t.name)}"></button>
    <div class="thumbs">${t.photos.map((ph, i) => `
      <button type="button" data-i="${i}" aria-pressed="${i === start}" aria-label="Фото ${i + 1}">
        <img src="img/${t.art}/${ph}_t.jpg" alt="" loading="lazy"></button>`).join('')}</div>
    <p class="cap" id="cap">Фото ${start + 1} из ${t.photos.length}</p>`
    : '<div class="main-ph"><div class="ph">Фотографии этой модели скоро появятся</div></div>';

  const similar = tiles.filter(x => x.art !== t.art && x.photos.length && x.format === t.format)
    .sort((a, b) => (b.surface === t.surface) - (a.surface === t.surface)).slice(0, 3);

  box.innerHTML = `
    <div class="wrap">
      <nav class="crumbs" aria-label="Путь"><a href="index.html#catalog">Каталог</a><span aria-hidden="true">/</span>
        <a href="index.html?f=${encodeURIComponent(t.format)}#catalog">${t.format}</a><span aria-hidden="true">/</span><span>${esc(t.name)}</span></nav>
      <div class="tile">
        <div class="gal">${gallery}</div>
        <div class="side">
          <div style="display:flex;flex-direction:column;gap:12px">
            <p class="eyebrow">Керамогранит · ${t.format}</p>
            <h1>${esc(t.name)}${t.is_new ? '<span class="tag-new">Новинка</span>' : ''}</h1>
          </div>

          <div class="wh">
            <div class="main"><small>Склад Москва</small><b class="num">${m2(t.stock.msk)}</b>
              <span>${freeMsk > 0 ? `<span class="nw">${packs(freeMsk)}${NB}уп. свободно</span>${t.stock.msk_res > 0 ? `<span class="nw">резерв ${m2(t.stock.msk_res)}</span>` : ''}` : 'сейчас нет'}</span></div>
            <div><small>Склад Тверь</small><b class="num">${m2(t.stock.tver)}</b>
              <span>${freeTver > 0 ? `<span class="nw">${TVER_ETA_LOW}</span>` : 'сейчас нет'}${t.stock.tver_res > 0 ? `<span class="nw">резерв ${m2(t.stock.tver_res)}</span>` : ''}</span></div>
          </div>

          <dl class="spec">
            <dt>Формат</dt><dd>${t.format} см</dd>
            <dt>Поверхность</dt><dd>${esc(t.surface)}</dd>
            <dt>В упаковке</dt><dd>${packText(t)}</dd>
            <dt>Паллета</dt><dd>${palletText(t)}</dd>
          </dl>

          ${p.sqm ? `<div class="calc">
            <label for="need" class="eyebrow">Сколько нужно, м²</label>
            <div class="row"><input id="need" inputmode="decimal" value="${nf(p.sqm * 10)}">
              <span id="calc" role="status"></span></div>
            <p>Отгружаем целыми упаковками, округляем вверх.</p></div>` : ''}

          <div class="ctas">
            <a class="btn solid" href="tel:+74993907888">Позвонить в шоу-рум</a>
            <a class="btn" href="${wa}" target="_blank" rel="noopener">Написать в WhatsApp</a>
          </div>
          <p class="where"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
            <span>Образец можно посмотреть в шоу-руме: Москва, ул. Монтажная, 3, этаж 4, офис 41. С 10:00 до 18:00.</span></p>

          <div class="qrbox">
            <img src="qr/${t.art}.png" alt="QR-код модели ${esc(t.name)}" width="112" height="112">
            <div><b>QR-код этой модели</b>
              <p>Тот же код, что напечатан на образце в шоу-руме, — ведёт на эту страницу.</p>
              <span class="links"><a href="qr/${t.art}.png" download>Скачать QR</a><a href="print.html">Все коды на печать</a><a href="admin.html?a=${t.art}">Изменить фото</a></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${similar.length ? `<section class="similar"><div class="wrap"><h2>Похожие модели</h2>
      <div class="grid">${similar.map(card).join('')}</div></div></section>` : ''}`;

  const need = box.querySelector('#need'), calc = box.querySelector('#calc');
  const recalc = () => {
    const v = +need.value.replace(',', '.').replace(/[^\d.]/g, '');
    const n = v > 0 ? Math.ceil(v / p.sqm - 1e-9) : 0;
    calc.innerHTML = n ? '= ' + parts([`<b>${n}${NB}уп.</b>`, `${nf(n * p.sqm)}${NB}м²`, p.kg && `${nf(n * p.kg, 0)}${NB}кг`]) : 'Введите площадь';
  };
  need?.addEventListener('input', recalc);
  if (need) recalc();

  const thumbs = box.querySelector('.thumbs');
  let current = start;
  thumbs?.addEventListener('click', e => {
    const th = e.target.closest('button[data-i]'); if (!th) return;
    current = +th.dataset.i;
    document.getElementById('big').src = `img/${t.art}/${t.photos[current]}.jpg`;
    document.getElementById('cap').textContent = `Фото ${current + 1} из ${t.photos.length}`;
    thumbs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === th));
  });
  box.querySelector('#big-wrap')?.addEventListener('click', () => lightbox(t.photos, t.art, current));
}
