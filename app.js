'use strict';
const $ = id => document.getElementById(id);
const C = window.PlacesCore;
const config = window.PLACES_CONFIG || {};
let owner = config.owner || '', repo = config.repo || '';
// GitHub Pages can identify its own repository without an edit to config.js.
if ((!owner || owner === 'YOUR_GITHUB_LOGIN') && location.hostname.endsWith('.github.io')) {
  owner = location.hostname.slice(0, -10);
  repo = location.pathname.split('/').filter(Boolean)[0] || owner + '.github.io';
}
const configured = /^[a-zA-Z0-9-]+$/.test(owner) && owner !== 'YOUR_GITHUB_LOGIN' && /^[a-zA-Z0-9_.-]+$/.test(repo);
const repoURL = configured ? `https://github.com/${owner}/${repo}` : '';
$('brand').textContent = config.title || 'BLOCKPLACES';
let allPlaces = [], favourites = [], onlyFavourites = false, page = 1, loading = false, currentPlace = null;
try { const v = JSON.parse(localStorage.getItem('blockplaces-favourites') || '[]'); if (Array.isArray(v)) favourites = v.filter(Number.isInteger); } catch (_) {}
function openDialog(id) { if (!$(id).open) $(id).showModal(); }
function status(text, error = false) { $('status').textContent = text; $('status').style.color = error ? '#bc3346' : ''; }
function node(tag, className, text) { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; }
function toggleFavourite(id) {
  favourites = favourites.includes(id) ? favourites.filter(x => x !== id) : [...favourites, id];
  try { localStorage.setItem('blockplaces-favourites', JSON.stringify(favourites)); } catch (_) {}
  render();
}
function setTab(fav) {
  onlyFavourites = fav;
  $('allNav').classList.toggle('active', !fav); $('favNav').classList.toggle('active', fav);
  $('homeSide').classList.toggle('active', !fav); $('favSide').classList.toggle('active', fav);
  $('catalogTitle').firstChild.textContent = fav ? 'Избранные плейсы ' : 'Все плейсы ';
  render();
}
function startPlay(p) {
  currentPlace = p;
  const uri = C.makeURI(p);
  $('playName').textContent = p.name;
  $('serverDetails').textContent = `${p.host}:${p.port} · Клиент ${p.client}`;
  $('retryPlay').href = uri;
  $('copyAddress').textContent = 'Скопировать IP:порт';
  openDialog('playDialog');
  // Invoked synchronously by a real click; browsers may request user permission.
  window.location.href = uri;
}
function card(p) {
  const article = node('article', 'card'), cover = node('div', 'cover');
  let hash = 0; for (const c of p.name) hash = (hash + c.charCodeAt(0) * 13) % 360;
  cover.style.background = `linear-gradient(135deg,hsl(${hash} 60% 68%),hsl(${(hash+40)%360} 55% 40%))`;
  cover.append(node('div', 'cover-art', '▦'));
  if (p.image) { const img = node('img'); img.alt = p.name; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.src = p.image; img.addEventListener('error', () => img.remove()); cover.append(img); }
  cover.append(node('span', 'version-tag', p.client));
  const saved = favourites.includes(p.id), star = node('button', 'star' + (saved ? ' saved' : ''), saved ? '★' : '☆');
  star.type = 'button'; star.setAttribute('aria-label', saved ? 'Убрать из избранного' : 'Добавить в избранное'); star.setAttribute('aria-pressed', String(saved));
  star.onclick = () => toggleFavourite(p.id); cover.append(star);
  const body = node('div', 'card-body'), title = node('h3', '', p.name); title.title = p.name;
  body.append(title, node('p', 'author', 'Автор: @' + p.author), node('p', 'description', p.description || 'Классический мир ждёт своих игроков.'));
  const bottom = node('div', 'card-bottom'), play = node('button', 'play', '▶ Play');
  play.onclick = () => startPlay(p);
  const info = node('a', 'details-link', 'Детали ↗'); info.href = repoURL + '/issues/' + p.id; info.target = '_blank'; info.rel = 'noopener noreferrer';
  bottom.append(play, info); body.append(bottom); article.append(cover, body); return article;
}
function render() {
  const q = $('search').value.trim().toLocaleLowerCase(), version = $('versionFilter').value;
  const places = allPlaces.filter(p => (!onlyFavourites || favourites.includes(p.id)) && (!version || p.client === version) && `${p.name} ${p.author} ${p.client}`.toLocaleLowerCase().includes(q));
  $('grid').replaceChildren(...places.map(card)); $('count').textContent = String(places.length); $('empty').hidden = places.length !== 0 || loading;
  $('emptyText').textContent = onlyFavourites ? 'Нажми на звёздочку у плейса, чтобы сохранить его здесь.' : q || version ? 'По этому запросу ничего не найдено. Попробуй изменить фильтр.' : 'Опубликуй первый плейс и пригласи друзей.';
  $('publishEmpty').hidden = onlyFavourites || Boolean(q || version);
}
async function load(reset = true) {
  if (loading) return;
  if (!configured) { status('Настрой сайт: впиши owner и repo в config.js. На обычном GitHub Pages они определятся автоматически.', true); render(); return; }
  loading = true; $('refresh').disabled = true; $('more').disabled = true; $('empty').hidden = true;
  status('Загружаем плейсы сообщества…');
  const targetPage = reset ? 1 : page + 1;
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&sort=created&direction=desc&per_page=100&page=${targetPage}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error('GitHub временно ограничил запросы. Подожди и обнови каталог позже.');
      if (response.status === 404 || response.status === 410) throw new Error('Проверь owner/repo в config.js: репозиторий должен быть публичным, с включёнными Issues.');
      throw new Error('GitHub вернул ошибку ' + response.status + '. Попробуй позже.');
    }
    const issues = await response.json(); if (!Array.isArray(issues)) throw new Error('Не удалось прочитать каталог.');
    const parsed = issues.map(C.parseIssue).filter(Boolean);
    allPlaces = reset ? parsed : [...new Map([...allPlaces, ...parsed].map(p => [p.id, p])).values()];
    page = targetPage; $('more').hidden = issues.length < 100;
    // Keep custom client versions discoverable too.
    const selected = $('versionFilter').value, known = new Set([...$('versionFilter').options].map(o => o.value));
    for (const p of allPlaces) if (!known.has(p.client)) { const o = node('option', '', p.client); o.value = p.client; $('versionFilter').append(o); known.add(p.client); }
    $('versionFilter').value = selected;
    status('Общий каталог · Доступность игровых серверов не проверяется.');
  } catch (e) { status(e.name === 'TimeoutError' ? 'GitHub не ответил вовремя. Нажми «Обновить» ещё раз.' : e.message || 'Не удалось загрузить каталог.', true); }
  finally { loading = false; $('refresh').disabled = false; $('more').disabled = false; render(); }
}
for (const id of ['publishTop', 'publishEmpty']) $(id).onclick = () => { $('formError').textContent = ''; openDialog('publishDialog'); };
for (const id of ['helpSide', 'helpFooter']) $(id).onclick = () => openDialog('helpDialog');
$('playHelp').onclick = () => { $('playDialog').close(); openDialog('helpDialog'); };
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => b.closest('dialog').close();
$('allNav').onclick = $('homeSide').onclick = () => setTab(false);
$('favNav').onclick = $('favSide').onclick = () => setTab(true);
$('search').oninput = $('versionFilter').onchange = render;
$('refresh').onclick = () => load(); $('more').onclick = () => load(false);
$('explore').onclick = () => $('catalog').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
$('copyAddress').onclick = async () => {
  if (!currentPlace) return;
  try { await navigator.clipboard.writeText(`${currentPlace.host}:${currentPlace.port}`); $('copyAddress').textContent = 'Скопировано ✓'; }
  catch (_) { $('copyAddress').textContent = 'Скопируй адрес из строки выше'; }
};
$('placeForm').onsubmit = e => {
  e.preventDefault(); $('formError').textContent = '';
  try {
    if (!configured) throw new Error('Сначала укажи свой GitHub логин и репозиторий в config.js или открой сайт на GitHub Pages.');
    const p = C.validate(Object.fromEntries(new FormData(e.target)));
    const url = repoURL + '/issues/new?' + new URLSearchParams({ title: '[Place] ' + p.name, body: C.issueBody(p) });
    if (url.length > 7800) throw new Error('Для GitHub получилась слишком длинная заявка. Сократи описание или ссылки.');
    // Same-tab navigation works without pop-up permissions; Back returns to this page.
    window.location.href = url;
  } catch (err) { $('formError').textContent = err.message; }
};
load();
