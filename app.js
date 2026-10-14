'use strict';

/* ============================================================
   Панель инди-разработчика игр — app.js
   Никаких зависимостей. Все данные — только через textContent.
   ============================================================ */

/* ------------------------------------------------------------
   Утилиты
   ------------------------------------------------------------ */

function $(selector, root) {
  return (root || document).querySelector(selector);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function nowTime() {
  return new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function setStatus(node, text, kind) {
  node.replaceChildren();
  if (kind) {
    node.dataset.kind = kind;
  } else {
    delete node.dataset.kind;
  }
  if (text) node.append(document.createTextNode(text));
}

function showError(node, onRetry) {
  setStatus(node, 'Что-то сломалось', 'error');
  const btn = el('button', 'btn btn--ghost', 'Повторить');
  btn.type = 'button';
  btn.addEventListener('click', onRetry);
  node.append(btn);
}

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/* ============================================================
   1. ТРЕНДЫ GITHUB
   ============================================================ */

const GH_ENDPOINT = 'https://api.github.com/search/repositories';

const ghForm   = $('#gh-form');
const ghInput  = $('#gh-query');
const ghTag    = $('#gh-tag');
const ghList   = $('#gh-list');
const ghStatus = $('#gh-status');
const ghFoot   = $('#gh-foot');

let ghLastArgs = { query: '', tag: 'unity' };

async function ghLoad() {
  const query = ghInput.value.trim();
  const tag = ghTag.value;
  ghLastArgs = { query: query, tag: tag };

  setStatus(ghStatus, 'Тянем данные…', 'loading');
  ghList.replaceChildren();

  try {
    const q = [tag, query, 'language:csharp'].filter(Boolean).join(' ');
    const url = GH_ENDPOINT
      + '?q=' + encodeURIComponent(q)
      + '&sort=stars&order=desc&per_page=10';

    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    const items = data && Array.isArray(data.items) ? data.items : [];

    if (items.length === 0) {
      setStatus(ghStatus, 'Ничего не нашлось', 'empty');
    } else {
      setStatus(ghStatus, '', '');
      ghRender(items);
    }

    ghFoot.textContent = 'GitHub Search API · обновлено ' + nowTime();
  } catch (err) {
    showError(ghStatus, ghLoad);
  }
}

function ghRender(items) {
  const frag = document.createDocumentFragment();

  items.forEach(function (repo) {
    if (!repo || typeof repo !== 'object') return;

    const card = el('a', 'repo');
    card.href = typeof repo.html_url === 'string' ? repo.html_url : '#';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    card.append(el('span', 'repo__name', repo.full_name || '—'));

    const ownerName = repo.owner && repo.owner.login ? repo.owner.login : '—';
    card.append(el('span', 'repo__owner', ownerName));

    card.append(el('p', 'repo__desc', repo.description || 'Без описания'));

    const meta = el('span', 'repo__meta');
    meta.append(el('span', 'repo__stat', '★ ' + (repo.stargazers_count || 0)));
    meta.append(el('span', 'repo__stat', '⑂ ' + (repo.forks_count || 0)));
    if (repo.language) meta.append(el('span', 'repo__lang', repo.language));
    card.append(meta);

    frag.append(card);
  });

  ghList.replaceChildren(frag);
}

ghForm.addEventListener('submit', function (event) {
  event.preventDefault();
  ghLoad();
});

/* ============================================================
   2. НОВОСТИ (HACKER NEWS)
   ============================================================ */

const HN_TOP  = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = 'https://hacker-news.firebaseio.com/v0/item/';

const hnList    = $('#hn-list');
const hnStatus  = $('#hn-status');
const hnFoot    = $('#hn-foot');
const hnRefresh = $('#hn-refresh');

async function hnFetchItem(id) {
  try {
    const res = await fetch(HN_ITEM + id + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return data && typeof data === 'object' ? data : null;
  } catch (err) {
    return null; // одна новость не роняет весь виджет
  }
}

async function hnLoad() {
  hnRefresh.disabled = true;
  setStatus(hnStatus, 'Тянем данные…', 'loading');
  hnList.replaceChildren();

  try {
    const res = await fetch(HN_TOP);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const ids = await res.json();
    if (!Array.isArray(ids)) throw new Error('Bad payload');

    const top = ids.slice(0, 10);
    const items = (await Promise.all(top.map(hnFetchItem))).filter(Boolean);

    if (items.length === 0) {
      setStatus(hnStatus, 'Ничего не нашлось', 'empty');
    } else {
      setStatus(hnStatus, '', '');
      hnRender(items);
    }

    hnFoot.textContent = 'Hacker News API · обновлено ' + nowTime();
  } catch (err) {
    showError(hnStatus, hnLoad);
  } finally {
    hnRefresh.disabled = false;
  }
}

function hnRender(items) {
  const frag = document.createDocumentFragment();

  items.forEach(function (item) {
    const link = el('a', 'news');
    link.href = (typeof item.url === 'string' && item.url)
      ? item.url
      : 'https://news.ycombinator.com/item?id=' + item.id;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    link.append(el('span', 'news__title', item.title || 'Без заголовка'));

    const meta = el('span', 'news__meta');
    meta.append(el('span', 'news__score', String(item.score || 0)));
    meta.append(el('span', 'news__by', item.by || '—'));

    const d = toDate(item.time ? item.time * 1000 : null);
    meta.append(el('span', 'news__time', d ? d.toLocaleDateString('ru-RU') : '—'));

    link.append(meta);
    frag.append(link);
  });

  hnList.replaceChildren(frag);
}

hnRefresh.addEventListener('click', hnLoad);

/* ============================================================
   3. РЕЛИЗЫ UNITY
   ============================================================ */

const UNITY_ENDPOINT =
  'https://services.api.unity.com/unity/editor/release/v1/releases' +
  '?limit=5&order=RELEASE_DATE_DESC';

const unityList    = $('#unity-list');
const unityStatus  = $('#unity-status');
const unityFoot    = $('#unity-foot');
const unityRefresh = $('#unity-refresh');

async function unityLoad() {
  unityRefresh.disabled = true;
  setStatus(unityStatus, 'Тянем данные…', 'loading');
  unityList.replaceChildren();

  try {
    const res = await fetch(UNITY_ENDPOINT);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    const list = Array.isArray(data)
      ? data
      : (data && Array.isArray(data.results) ? data.results : []);

    if (list.length === 0) {
      setStatus(unityStatus, 'Ничего не нашлось', 'empty');
    } else {
      setStatus(unityStatus, '', '');
      unityRender(list);
    }

    unityFoot.textContent = 'Unity Release API · обновлено ' + nowTime();
  } catch (err) {
    showError(unityStatus, unityLoad);
  } finally {
    unityRefresh.disabled = false;
  }
}

function unityRender(list) {
  const frag = document.createDocumentFragment();

  list.forEach(function (release) {
    if (!release || typeof release !== 'object') return;

    const notes = release.releaseNotes && release.releaseNotes.url
      ? release.releaseNotes.url
      : 'https://unity.com/releases/editor/archive';

    const row = el('a', 'release');
    row.href = notes;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';

    row.append(el('span', 'release__version', release.version || '—'));

    const d = toDate(release.releaseDate);
    row.append(el('span', 'release__date', d ? d.toLocaleDateString('ru-RU') : '—'));

    frag.append(row);
  });

  unityList.replaceChildren(frag);
}

unityRefresh.addEventListener('click', unityLoad);

/* ============================================================
   4. ОНЛАЙН В STEAM
   ============================================================ */

const STEAM_KEY   = 'EE3D27AD262CB691DCCBA70AD7EAAA22';
const STEAM_STORE = 'https://store.steampowered.com/api/storesearch/';
const STEAM_COUNT = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/';
const STEAM_SPY   = 'https://steamspy.com/api.php';

const steamForm    = $('#steam-form');
const steamInput   = $('#steam-input');
const steamList    = $('#steam-list');
const steamStatus  = $('#steam-status');
const steamFoot    = $('#steam-foot');
const steamRefresh = $('#steam-refresh');

let steamGames = steamLoad();

function steamLoad() {
  try {
    const raw = localStorage.getItem(STEAM_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function (g) {
      return g && typeof g === 'object' && typeof g.appid === 'number';
    });
  } catch (err) {
    return [];
  }
}

function steamSave() {
  try {
    localStorage.setItem(STEAM_KEY, JSON.stringify(steamGames));
  } catch (err) {
    /* приватный режим — просто не сохраняем */
  }
}

async function steamSearch(term) {
  const targetUrl = 'https://store.steampowered.com/api/storesearch/'
    + '?term=' + encodeURIComponent(term) + '&l=ru&cc=RU';

  // AllOrigins в режиме raw — возвращает тело ответа без обёртки
 const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);

  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error('HTTP ' + res.status);

  const data = await res.json();
  return data && Array.isArray(data.items) ? data.items : [];
}


async function steamPlayers(appid) {
  try {
    const res = await fetch(STEAM_COUNT + '?appid=' + appid);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    const count = data && data.response ? data.response.player_count : null;
    if (typeof count === 'number') return count;

    throw new Error('no player_count');
  } catch (primaryError) {
    // Фолбэк: SteamSpy отдаёт ccu (текущий онлайн)
    const res = await fetch(STEAM_SPY + '?request=appdetails&appid=' + appid);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();
    const ccu = Number(data && data.ccu);
    if (Number.isFinite(ccu)) return ccu;

    throw primaryError;
  }
}

function steamFootUpdate() {
  steamFoot.textContent =
    'Steam Web API (Store Search, GetNumberOfCurrentPlayers) · обновлено ' + nowTime();
}

function steamRender() {
  steamList.replaceChildren();

  if (steamGames.length === 0) {
    steamList.append(el('p', 'steam-empty',
      'Добавь первую игру — увидишь, как она выглядит на фоне остальных'));
    return;
  }

  let max = 1;
  steamGames.forEach(function (g) {
    if (typeof g.player_count === 'number' && g.player_count > max) {
      max = g.player_count;
    }
  });

  const frag = document.createDocumentFragment();

  steamGames.forEach(function (game) {
    const row = el('div', 'steam-row');

    const name = el('span', 'steam-row__name', game.name || ('App ' + game.appid));
    name.title = game.name || '';
    row.append(name);

    const mid = el('div', 'steam-row__mid');
    const bar = el('div', 'steam-row__bar');
    const fill = el('div', 'steam-row__fill');

    const fresh = typeof game.player_count === 'number' && game.player_count >= 0;

    if (fresh) {
      const pct = max > 0 ? (game.player_count / max) * 100 : 0;
      fill.style.width = pct.toFixed(2) + '%';
    } else {
      fill.classList.add('stale');
      fill.style.width = '0%';
      mid.append(bar);
      bar.append(fill);
      mid.append(el('span', 'steam-row__stale', 'устарело'));
      row.append(mid);

      const del = el('button', 'steam-row__del', '×');
      del.type = 'button';
      del.setAttribute('aria-label', 'Удалить ' + (game.name || game.appid));
      del.addEventListener('click', function () { steamRemove(game.appid); });
      row.append(del);

      frag.append(row);
      return;
    }

    bar.append(fill);
    mid.append(bar);
    row.append(mid);

    const del = el('button', 'steam-row__del', '×');
    del.type = 'button';
    del.setAttribute('aria-label', 'Удалить ' + (game.name || game.appid));
    del.addEventListener('click', function () { steamRemove(game.appid); });
    row.append(del);

    frag.append(row);
  });

  steamList.replaceChildren(frag);
}

function steamRemove(appid) {
  steamGames = steamGames.filter(function (g) { return g.appid !== appid; });
  steamSave();
  steamRender();
}

async function steamAdd(term) {
  const query = String(term || '').trim();
  if (!query) return;

  setStatus(steamStatus, 'Ищем игру…', 'loading');

  let items;
  try {
    items = await steamSearch(query);
  } catch (err) {
    showError(steamStatus, function () { steamAdd(query); });
    return;
  }

  if (items.length === 0) {
    setStatus(steamStatus, 'Steam не знает такой игры', 'empty');
    return;
  }

  const first = items[0];
  const appid = typeof first.id === 'number' ? first.id : Number(first.id);
  if (!Number.isFinite(appid)) {
    setStatus(steamStatus, 'Steam не знает такой игры', 'empty');
    return;
  }

  const exists = steamGames.some(function (g) { return g.appid === appid; });
  if (exists) {
    setStatus(steamStatus, 'Уже в списке', 'empty');
    return;
  }

  setStatus(steamStatus, 'Тянем данные…', 'loading');

  let count = null;
  try {
    count = await steamPlayers(appid);
  } catch (err) {
    count = null;
  }

  steamGames.push({
    appid: appid,
    name: first.name || ('App ' + appid),
    player_count: count,
    lastCheck: count === null ? null : new Date().toISOString()
  });

  steamSave();
  setStatus(steamStatus, '', '');
  steamRender();
  steamFootUpdate();
}

async function steamRefreshAll() {
  if (steamGames.length === 0) return;

  steamRefresh.disabled = true;
  setStatus(steamStatus, 'Тянем данные…', 'loading');

  const snapshot = steamGames.slice();

  const results = await Promise.all(snapshot.map(async function (game) {
    try {
      const count = await steamPlayers(game.appid);
      return { appid: game.appid, count: count };
    } catch (err) {
      return { appid: game.appid, count: null };
    }
  }));

  const stamp = new Date().toISOString();

  results.forEach(function (r) {
    const game = steamGames.find(function (g) { return g.appid === r.appid; });
    if (!game) return;

    if (typeof r.count === 'number') {
      game.player_count = r.count;
      game.lastCheck = stamp;
    } else {
      game.player_count = null; // остаётся в списке, но помечается «устарело»
    }
  });

  steamSave();
  steamRender();
  setStatus(steamStatus, '', '');
  steamFootUpdate();
  steamRefresh.disabled = false;
}

steamForm.addEventListener('submit', function (event) {
  event.preventDefault();
  const value = steamInput.value;
  steamInput.value = '';
  steamAdd(value);
});

steamRefresh.addEventListener('click', steamRefreshAll);

/* ============================================================
   5. KANBAN
   ============================================================ */

const KB_KEY = 'kanban';
const KB_COLS = ['todo', 'doing', 'done'];

let kanban = kbLoad();

function kbLoad() {
  const empty = { todo: [], doing: [], done: [] };

  try {
    const raw = localStorage.getItem(KB_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty;

    KB_COLS.forEach(function (col) {
      const src = Array.isArray(parsed[col]) ? parsed[col] : [];
      empty[col] = src
        .map(function (task) {
          if (typeof task === 'string') return { id: uid(), text: task };
          if (task && typeof task === 'object' && typeof task.text === 'string') {
            return { id: typeof task.id === 'string' ? task.id : uid(), text: task.text };
          }
          return null;
        })
        .filter(Boolean);
    });

    return empty;
  } catch (err) {
    return empty;
  }
}

function kbSave() {
  try {
    localStorage.setItem(KB_KEY, JSON.stringify(kanban));
  } catch (err) {
    /* ignore */
  }
}

function kbRender() {
  KB_COLS.forEach(function (col) {
    const listNode = document.querySelector('[data-list="' + col + '"]');
    if (!listNode) return;

    listNode.replaceChildren();

    if (kanban[col].length === 0) {
      const li = el('li', 'kanban__empty', 'Пусто');
      listNode.append(li);
      return;
    }

    kanban[col].forEach(function (task) {
      const li = el('li', 'task');

      li.append(el('span', 'task__text', task.text));

      const actions = el('div', 'task__actions');

      const back = el('button', 'btn btn--icon', '←');
      back.type = 'button';
      back.setAttribute('aria-label', 'Переместить назад: ' + task.text);
      back.disabled = col === KB_COLS[0];
      back.addEventListener('click', function () { kbMove(task.id, col, -1); });

      const forward = el('button', 'btn btn--icon', '→');
      forward.type = 'button';
      forward.setAttribute('aria-label', 'Переместить вперёд: ' + task.text);
      forward.disabled = col === KB_COLS[KB_COLS.length - 1];
      forward.addEventListener('click', function () { kbMove(task.id, col, 1); });

      const remove = el('button', 'btn btn--icon', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Удалить задачу: ' + task.text);
      remove.addEventListener('click', function () { kbRemove(task.id, col); });

      actions.append(back, forward, remove);
      li.append(actions);
      listNode.append(li);
    });
  });
}

function kbMove(id, from, direction) {
  const index = KB_COLS.indexOf(from);
  const to = KB_COLS[index + direction];
  if (!to) return;

  const fromList = kanban[from];
  const taskIndex = fromList.findIndex(function (t) { return t.id === id; });
  if (taskIndex === -1) return;

  const moved = fromList.splice(taskIndex, 1)[0];
  kanban[to].push(moved);
  kbSave();
  kbRender();
}

function kbRemove(id, col) {
  kanban[col] = kanban[col].filter(function (t) { return t.id !== id; });
  kbSave();
  kbRender();
}

function kbAdd(col, text) {
  const value = String(text || '').trim();
  if (!value) return;
  kanban[col].push({ id: uid(), text: value });
  kbSave();
  kbRender();
}

document.querySelectorAll('[data-add]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    const col = btn.getAttribute('data-add');
    if (KB_COLS.indexOf(col) === -1) return;

    const answer = window.prompt('Текст задачи:');
    if (answer === null) return;
    kbAdd(col, answer);
  });
});

/* ============================================================
   Инициализация
   ============================================================ */

ghLoad();
hnLoad();
unityLoad();
steamRender();
steamFootUpdate();
kbRender();