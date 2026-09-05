const load = fetch('data.json', {cache: 'no-cache'}).then(r => r.json());
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const m2 = v => v > 0 ? v.toLocaleString('ru-RU', {maximumFractionDigits: 2}) + ' м²' : '—';
/** Довоз со склада Тверь в Москву — один день. */
const TVER_ETA = 'Доставка в Москву — 1 день';
const TVER_ETA_LOW = 'доставка в Москву — 1 день';   // для середины предложения
const cover = t => t.photos.length
  ? `<img src="img/${t.art}/${t.photos[0]}_t.jpg" alt="${esc(t.name)}" loading="lazy">`
  : 'фото скоро';

async function renderCatalog() {
  const { tiles } = await load;
  const [q, fmt, srf, grid, count] = ['q','fmt','srf','grid','count'].map(id => document.getElementById(id));

  const formats = [...new Set(tiles.map(t => t.format))].sort();
  fmt.innerHTML = ['Все форматы', ...formats].map((v, i) =>
    `<button class="chip" role="button" aria-pressed="${i === 0}" data-v="${i ? v : ''}">${v}</button>`).join('');
  [...new Set(tiles.map(t => t.surface))].sort().forEach(v => srf.add(new Option(v, v)));

  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const f = fmt.querySelector('[aria-pressed=true]').dataset.v;
    const list = tiles.filter(t =>
      (!f || t.format === f) &&
      (!srf.value || t.surface === srf.value) &&
      (!s || (t.name + ' ' + t.art).toLowerCase().includes(s)));
    grid.innerHTML = list.map(t => `
      <a class="card" href="tile.html?a=${t.art}">
        <div class="ph">${cover(t)}</div>
        <div class="b">
          <h3>${esc(t.name)}</h3>
          <div class="meta"><span class="tag">${t.format}</span><span class="tag">${esc(t.surface)}</span>
            ${t.is_new ? '<span class="tag new">Новинка</span>' : ''}</div>
          <div class="stock">
            <span>Москва <b class="${t.stock.msk > 0 ? 'ok' : 'off'}">${m2(t.stock.msk)}</b></span>
            <span>Тверь <b class="${t.stock.tver > 0 ? 'ok' : 'off'}">${m2(t.stock.tver)}</b></span>
            ${t.stock.tver > 0 ? `<span class="eta">Тверь · доставка в Москву — 1 день</span>` : ''}
          </div>
        </div>
      </a>`).join('') || '<p class="meta">Ничего не найдено.</p>';
    count.textContent = `${list.length} из ${tiles.length}`;
  };

  fmt.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    fmt.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    draw();
  });
  [q, srf].forEach(el => el.addEventListener('input', draw));
  draw();

  const withPhoto = tiles.filter(t => t.photos.length).length;
  document.getElementById('s-models').textContent = tiles.length;
  document.getElementById('s-photo').textContent = withPhoto;
  document.getElementById('stat').textContent = `${tiles.length} моделей · ${withPhoto} с фотографиями`;
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
  if (!t) { box.innerHTML = '<p class="back">Плитка не найдена. <a href="index.html">В каталог</a></p>'; return; }
  document.title = `${t.name} — Алмалы-Керамик`;

  const gallery = t.photos.length ? `
    <div class="main-ph" id="big-wrap"><img id="big" src="img/${t.art}/${t.photos[0]}.jpg" alt="${esc(t.name)}"></div>
    <div class="thumbs">${t.photos.map((p, i) => `
      <img src="img/${t.art}/${p}_t.jpg" alt="Фото ${i + 1}" aria-current="${i === 0}" data-i="${i}">`).join('')}</div>`
    : '<div class="main-ph"><div class="ph" style="aspect-ratio:4/3">Фотографии этой модели пока не загружены</div></div>';

  box.innerHTML = `
    <a class="back" href="index.html">← Все модели</a>
    <div class="tile">
      <div>${gallery}</div>
      <div class="side">
        <h1>${esc(t.name)}${t.is_new ? ' <span class="tag new">Новинка</span>' : ''}</h1>

        <p class="h2">Характеристики</p>
        <table class="spec">
          <tr><th>Формат</th><td>${t.format} см</td></tr>
          <tr><th>Поверхность</th><td>${esc(t.surface)}</td></tr>
          <tr><th>Упаковка</th><td>${esc(t.packing)}</td></tr>
          <tr><th>Паллета</th><td>${esc(t.pallet)}</td></tr>
        </table>

        <p class="h2">Остатки</p>
        <table class="spec">
          <tr><th>Склад Москва</th><td>${m2(t.stock.msk)}</td></tr>
          <tr><th>Резерв Москва</th><td>${m2(t.stock.msk_res)}</td></tr>
          <tr><th>Склад Тверь</th><td>${m2(t.stock.tver)}</td></tr>
          <tr><th>Резерв Тверь</th><td>${m2(t.stock.tver_res)}</td></tr>
          <tr><th>Свободно всего</th><td><b>${m2(t.stock.msk + t.stock.tver - t.stock.msk_res - t.stock.tver_res)}</b></td></tr>
        </table>
        ${t.stock.tver > 0 ? `<p class="eta-note">Со склада Тверь: ${TVER_ETA_LOW}.</p>` : ''}

        <div class="qrbox">
          <img src="qr/${t.art}.png" alt="QR-код модели ${esc(t.name)}">
          <div>
            <p>QR ведёт на эту страницу. Печатайте и ставьте рядом с образцом.</p>
            <a class="dl" href="qr/${t.art}.png" download>Скачать QR</a>
            <a class="dl" href="admin.html?a=${t.art}">Изменить фото</a>
          </div>
        </div>
      </div>
    </div>`;

  const thumbs = box.querySelector('.thumbs');
  let current = 0;
  thumbs?.addEventListener('click', e => {
    const th = e.target.closest('img[data-i]'); if (!th) return;
    current = +th.dataset.i;
    document.getElementById('big').src = `img/${t.art}/${t.photos[current]}.jpg`;
    thumbs.querySelectorAll('img').forEach(i => i.setAttribute('aria-current', i === th));
  });
  box.querySelector('#big-wrap')?.addEventListener('click', () => lightbox(t.photos, t.art, current));
}
