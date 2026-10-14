'use strict';

/* ============================================================
   Утилиты
============================================================ */
function $(sel, root){ return (root||document).querySelector(sel); }
function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}
function nowTime(){
  return new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function formatNumber(n){
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return n.toLocaleString('ru-RU');
}
function setStatus(node, text, kind){
  node.replaceChildren();
  node.dataset.kind = kind || '';
  if (text) node.append(document.createTextNode(text));
}
function showError(node, onRetry){
  setStatus(node, 'Что-то сломалось', 'error');
  const btn = el('button','btn btn--ghost','Повторить');
  btn.type = 'button';
  btn.addEventListener('click', onRetry);
  node.append(btn);
}
function toDate(v){
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function uid(){ return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); }

const GLOBAL_STATUS = $('#global-status');

/* ============================================================
   1. GITHUB
============================================================ */
const GH_ENDPOINT = 'https://api.github.com/search/repositories';
const ghForm   = $('#gh-form');
const ghInput  = $('#gh-query');
const ghTag    = $('#gh-tag');
const ghList   = $('#gh-list');
const ghStatus = $('#gh-status');
const ghFoot   = $('#gh-foot');

async function ghLoad(){
  const q = ghInput.value.trim();
  const tag = ghTag.value;
  ghList.replaceChildren();
  setStatus(ghStatus,'Тянем данные…','loading');

  try{
    const query = [tag, q, 'language:csharp'].filter(Boolean).join(' ');
    const url = GH_ENDPOINT+'?q='+encodeURIComponent(query)+'&sort=stars&order=desc&per_page=10';
    const res = await fetch(url,{headers:{Accept:'application/vnd.github+json'}});
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const items = data && Array.isArray(data.items) ? data.items : [];
    if (!items.length){ setStatus(ghStatus,'Ничего не нашлось','empty'); }
    else { setStatus(ghStatus,'',''); ghRender(items); }
    ghFoot.textContent = 'GitHub Search API · обновлено '+nowTime();
    GLOBAL_STATUS.textContent = 'данные обновлены';
  } catch(err){
    showError(ghStatus, ghLoad);
    GLOBAL_STATUS.textContent = 'ошибка';
  }
}

function ghRender(items){
  const frag = document.createDocumentFragment();
  items.forEach(function(repo){
    if (!repo || typeof repo !== 'object') return;
    const card = el('a','repo');
    card.href = typeof repo.html_url === 'string' ? repo.html_url : '#';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.append(el('span','repo__name', repo.full_name || '—'));
    const owner = repo.owner && repo.owner.login ? repo.owner.login : '—';
    card.append(el('span','repo__owner', 'by '+owner));
    card.append(el('p','repo__desc', repo.description || 'Без описания'));
    const meta = el('span','repo__meta');
    meta.append(el('span','repo__stat','★ '+(repo.stargazers_count||0)));
    meta.append(el('span','repo__stat','⑂ '+(repo.forks_count||0)));
    if (repo.language) meta.append(el('span','repo__lang', repo.language));
    card.append(meta);
    frag.append(card);
  });
  ghList.replaceChildren(frag);
}

ghForm.addEventListener('submit', function(e){ e.preventDefault(); ghLoad(); });
$('#gh-refresh').addEventListener('click', ghLoad);

/* ============================================================
   2. HACKER NEWS
============================================================ */
const HN_TOP  = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = 'https://hacker-news.firebaseio.com/v0/item/';
const hnList   = $('#hn-list');
const hnStatus = $('#hn-status');
const hnFoot   = $('#hn-foot');
const hnRefresh = $('#hn-refresh');

async function hnFetchItem(id){
  try{
    const res = await fetch(HN_ITEM+id+'.json');
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    return data && typeof data === 'object' ? data : null;
  } catch(err){ return null; }
}

async function hnLoad(){
  hnRefresh.disabled = true;
  hnList.replaceChildren();
  setStatus(hnStatus,'Тянем данные…','loading');

  try{
    const res = await fetch(HN_TOP);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const ids = await res.json();
    if (!Array.isArray(ids)) throw new Error('Bad payload');
    const top = ids.slice(0,20);
    const items = (await Promise.all(top.map(hnFetchItem))).filter(Boolean);
    if (!items.length){ setStatus(hnStatus,'Ничего не нашлось','empty'); }
    else { setStatus(hnStatus,'',''); hnRender(items); }
    hnFoot.textContent = 'Hacker News API · обновлено '+nowTime();
  } catch(err){
    showError(hnStatus, hnLoad);
  } finally {
    hnRefresh.disabled = false;
  }
}

function hnRender(items){
  const frag = document.createDocumentFragment();
  items.forEach(function(item){
    const link = el('a','news');
    link.href = (typeof item.url === 'string' && item.url)
      ? item.url
      : 'https://news.ycombinator.com/item?id='+item.id;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(el('span','news__title', item.title || 'Без заголовка'));
    const meta = el('span','news__meta');
    meta.append(el('span','news__score', String(item.score||0)+' pts'));
    meta.append(el('span', null, item.by || '—'));
    const d = toDate(item.time ? item.time*1000 : null);
    meta.append(el('span', null, d ? d.toLocaleDateString('ru-RU') : '—'));
    link.append(meta);
    frag.append(link);
  });
  hnList.replaceChildren(frag);
}

hnRefresh.addEventListener('click', hnLoad);

/* ============================================================
   3. UNITY RELEASES
============================================================ */
const UNITY_ENDPOINT = 'https://services.api.unity.com/unity/editor/release/v1/releases?limit=5&order=RELEASE_DATE_DESC';
const unityList   = $('#unity-list');
const unityStatus = $('#unity-status');
const unityFoot   = $('#unity-foot');
const unityRefresh = $('#unity-refresh');

async function unityLoad(){
  unityRefresh.disabled = true;
  unityList.replaceChildren();
  setStatus(unityStatus,'Тянем данные…','loading');

  try{
    const res = await fetch(UNITY_ENDPOINT);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data
               : (data && Array.isArray(data.results) ? data.results : []);
    if (!list.length){ setStatus(unityStatus,'Ничего не нашлось','empty'); }
    else { setStatus(unityStatus,'',''); unityRender(list); }
    unityFoot.textContent = 'Unity Release API · обновлено '+nowTime();
  } catch(err){
    showError(unityStatus, unityLoad);
  } finally {
    unityRefresh.disabled = false;
  }
}

function unityRender(list){
  const frag = document.createDocumentFragment();
  list.forEach(function(rel){
    if (!rel || typeof rel !== 'object') return;
    const notes = rel.releaseNotes && rel.releaseNotes.url
      ? rel.releaseNotes.url
      : 'https://unity.com/releases/editor/archive';
    const row = el('a','release');
    row.href = notes;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
    row.append(el('span','release__version', rel.version || '—'));
    const d = toDate(rel.releaseDate);
    row.append(el('span','release__date',
      d ? d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}) : '—'));
    frag.append(row);
  });
  unityList.replaceChildren(frag);
}

unityRefresh.addEventListener('click', unityLoad);

/* ============================================================
   4. STEAM (через Cloudflare Worker прокси)
============================================================ */
const PROXY_BASE = 'https://steam-proxy.makar912.workers.dev';
const STEAM_KEY = 'steam';
const STEAM_TOP_URL = 'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/';

const steamForm    = $('#steam-form');
const steamInput   = $('#steam-input');
const steamList    = $('#steam-list');
const steamStatus  = $('#steam-status');
const steamFoot    = $('#steam-foot');
const steamRefresh = $('#steam-refresh');

let steamGames = steamLoadLS();

function steamLoadLS(){
  try{
    const raw = localStorage.getItem(STEAM_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function(g){
      return g && typeof g === 'object' && typeof g.appid === 'number';
    });
  } catch(err){ return []; }
}
function steamSave(){
  try{ localStorage.setItem(STEAM_KEY, JSON.stringify(steamGames)); }catch(err){}
}

async function steamSearch(term){
  const target = 'https://store.steampowered.com/api/storesearch/'
    + '?term='+encodeURIComponent(term)+'&l=ru&cc=RU';
  const res = await fetch(PROXY_BASE+'/?url='+encodeURIComponent(target));
  if (!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  return data && Array.isArray(data.items) ? data.items : [];
}

async function steamPlayers(appid){
  const target = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/'
    + '?appid='+appid;
  const res = await fetch(PROXY_BASE+'/?url='+encodeURIComponent(target));
  if (!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  const count = data && data.response ? data.response.player_count : null;
  if (typeof count !== 'number') throw new Error('no player_count');
  return count;
}

async function steamTop10(){
  const res = await fetch(PROXY_BASE+'/?url='+encodeURIComponent(STEAM_TOP_URL));
  if (!res.ok) throw new Error('HTTP '+res.status);
  const data = await res.json();
  const ranks = data && data.response && Array.isArray(data.response.ranks)
    ? data.response.ranks : [];
  return ranks.slice(0,10);
}

async function steamLoadTopIntoList(){
  setStatus(steamStatus,'Загружаем топ-10 игр…','loading');
  try{
    const ranks = await steamTop10();
    if (!ranks.length){
      setStatus(steamStatus,'Не удалось получить топ игр','empty');
      return;
    }

    const items = await Promise.all(ranks.map(async function(r){
      const appid = r.appid;
      let name = 'App '+appid;
      try{
        const target = 'https://store.steampowered.com/api/appdetails?appids='+appid+'&l=ru&filters=basic';
        const res = await fetch(PROXY_BASE+'/?url='+encodeURIComponent(target));
        if (res.ok){
          const data = await res.json();
          const d = data && data[appid] && data[appid].data;
          if (d && d.name) name = d.name;
        }
      } catch(err){}
      return {
        appid: appid,
        name: name,
        player_count: typeof r.concurrent_in_game === 'number' ? r.concurrent_in_game : 0,
        lastCheck: new Date().toISOString()
      };
    }));

    steamGames = items;
    steamSave();
    steamRender();
    setStatus(steamStatus,'','');
    steamFootUpdate();
    steamRefreshAll();
  } catch(err){
    console.error(err);
    showError(steamStatus, steamLoadTopIntoList);
  }
}

function steamFootUpdate(){
  steamFoot.textContent = 'Steam Web API (Charts, Store Search, GetNumberOfCurrentPlayers) · обновлено '+nowTime();
}

function steamRender(){
  steamList.replaceChildren();

  if (!steamGames.length){
    steamList.append(el('p','steam-empty',
      'Добавь первую игру — увидишь, как она выглядит на фоне остальных'));
    return;
  }

  let max = 1;
  steamGames.forEach(function(g){
    if (typeof g.player_count === 'number' && g.player_count > max) max = g.player_count;
  });

  const frag = document.createDocumentFragment();

  steamGames.forEach(function(game){
    const row = el('div','steam-row');

    const name = el('span','steam-row__name', game.name || ('App '+game.appid));
    name.title = game.name || '';
    row.append(name);

    const bar = el('div','steam-row__bar');
    const fill = el('div','steam-row__fill');

    const fresh = typeof game.player_count === 'number' && game.player_count >= 0;
    const countEl = el('span','steam-row__count');

    if (fresh){
      const pct = max > 0 ? (game.player_count / max) * 100 : 0;
      fill.style.width = pct.toFixed(2)+'%';
      countEl.textContent = formatNumber(game.player_count);
    } else {
      fill.classList.add('stale');
      countEl.classList.add('stale');
      countEl.textContent = 'устарело';
    }
    bar.append(fill);
    row.append(bar);
    row.append(countEl);

    const del = el('button','steam-row__del','×');
    del.type = 'button';
    del.setAttribute('aria-label','Удалить '+(game.name||game.appid));
    del.addEventListener('click', function(){ steamRemove(game.appid); });
    row.append(del);

    frag.append(row);
  });

  steamList.replaceChildren(frag);
}

function steamRemove(appid){
  steamGames = steamGames.filter(function(g){ return g.appid !== appid; });
  steamSave();
  steamRender();
}

async function steamAdd(term){
  const query = String(term||'').trim();
  if (!query) return;

  setStatus(steamStatus,'Ищем игру…','loading');

  let items;
  try{ items = await steamSearch(query); }
  catch(err){ showError(steamStatus, function(){ steamAdd(query); }); return; }

  if (!items.length){
    setStatus(steamStatus,'Steam не знает такой игры','empty');
    return;
  }

  const first = items[0];
  const appid = typeof first.id === 'number' ? first.id : Number(first.id);
  if (!Number.isFinite(appid)){
    setStatus(steamStatus,'Steam не знает такой игры','empty');
    return;
  }

  if (steamGames.some(function(g){ return g.appid === appid; })){
    setStatus(steamStatus,'Уже в списке','empty');
    return;
  }

  setStatus(steamStatus,'Тянем данные…','loading');

  let count = null;
  try{ count = await steamPlayers(appid); }catch(err){ count = null; }

  steamGames.push({
    appid: appid,
    name: first.name || ('App '+appid),
    player_count: count,
    lastCheck: count === null ? null : new Date().toISOString()
  });

  steamSave();
  setStatus(steamStatus,'','');
  steamRender();
  steamFootUpdate();
}

async function steamRefreshAll(){
  if (!steamGames.length) return;

  steamRefresh.disabled = true;
  setStatus(steamStatus,'Тянем данные…','loading');

  const snapshot = steamGames.slice();
  const results = await Promise.all(snapshot.map(async function(game){
    try{ return { appid: game.appid, count: await steamPlayers(game.appid) }; }
    catch(err){ return { appid: game.appid, count: null }; }
  }));

  const stamp = new Date().toISOString();
  results.forEach(function(r){
    const game = steamGames.find(function(g){ return g.appid === r.appid; });
    if (!game) return;
    if (typeof r.count === 'number'){
      game.player_count = r.count;
      game.lastCheck = stamp;
    } else {
      game.player_count = null;
    }
  });

  steamSave();
  steamRender();
  setStatus(steamStatus,'','');
  steamFootUpdate();
  steamRefresh.disabled = false;
}

steamForm.addEventListener('submit', function(e){
  e.preventDefault();
  const v = steamInput.value;
  steamInput.value = '';
  steamAdd(v);
});
steamRefresh.addEventListener('click', steamRefreshAll);

/* ============================================================
   5. KANBAN
============================================================ */
const KB_KEY = 'kanban';
const KB_COLS = ['todo','doing','done'];
let kanban = kbLoadLS();

function kbLoadLS(){
  const empty = { todo:[], doing:[], done:[] };
  try{
    const raw = localStorage.getItem(KB_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty;
    KB_COLS.forEach(function(col){
      const src = Array.isArray(parsed[col]) ? parsed[col] : [];
      empty[col] = src.map(function(t){
        if (typeof t === 'string') return { id: uid(), text: t };
        if (t && typeof t === 'object' && typeof t.text === 'string'){
          return { id: typeof t.id === 'string' ? t.id : uid(), text: t.text };
        }
        return null;
      }).filter(Boolean);
    });
    return empty;
  } catch(err){ return empty; }
}
function kbSave(){
  try{ localStorage.setItem(KB_KEY, JSON.stringify(kanban)); }catch(err){}
}

function kbRender(){
  KB_COLS.forEach(function(col){
    const list = document.querySelector('[data-list="'+col+'"]');
    const counter = document.querySelector('[data-count="'+col+'"]');
    if (!list) return;
    list.replaceChildren();

    if (!kanban[col].length){
      list.append(el('li','kanban__empty','Пусто'));
    } else {
      kanban[col].forEach(function(task){
        const li = el('li','task');
        li.draggable = true;
        li.dataset.id = task.id;
        li.dataset.col = col;
        li.append(el('span','task__text', task.text));

        const actions = el('div','task__actions');
        const back = el('button','btn btn--icon','←');
        back.type='button';
        back.setAttribute('aria-label','Переместить назад: '+task.text);
        back.disabled = col === KB_COLS[0];
        back.addEventListener('click', function(){ kbMove(task.id, col, -1); });

        const fwd = el('button','btn btn--icon','→');
        fwd.type='button';
        fwd.setAttribute('aria-label','Переместить вперёд: '+task.text);
        fwd.disabled = col === KB_COLS[KB_COLS.length-1];
        fwd.addEventListener('click', function(){ kbMove(task.id, col, 1); });

        const del = el('button','btn btn--icon','×');
        del.type='button';
        del.setAttribute('aria-label','Удалить: '+task.text);
        del.addEventListener('click', function(){ kbRemove(task.id, col); });

        actions.append(back, fwd, del);
        li.append(actions);

        li.addEventListener('dragstart', function(e){
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
          li.classList.add('dragging');
        });
        li.addEventListener('dragend', function(){ li.classList.remove('dragging'); });

        list.append(li);
      });
    }

    if (counter) counter.textContent = kanban[col].length;
  });
}

function kbMove(id, from, dir){
  const i = KB_COLS.indexOf(from);
  const to = KB_COLS[i+dir];
  if (!to) return;
  const idx = kanban[from].findIndex(function(t){ return t.id === id; });
  if (idx === -1) return;
  const moved = kanban[from].splice(idx,1)[0];
  kanban[to].push(moved);
  kbSave(); kbRender();
}
function kbRemove(id, col){
  kanban[col] = kanban[col].filter(function(t){ return t.id !== id; });
  kbSave(); kbRender();
}
function kbAdd(col, text){
  const v = String(text||'').trim();
  if (!v) return;
  kanban[col].push({ id: uid(), text: v });
  kbSave(); kbRender();
}

document.querySelectorAll('[data-add]').forEach(function(btn){
  btn.addEventListener('click', function(){
    const col = btn.getAttribute('data-add');
    if (KB_COLS.indexOf(col) === -1) return;
    const answer = window.prompt('Текст задачи:');
    if (answer === null) return;
    kbAdd(col, answer);
  });
});

document.querySelectorAll('.kanban__col').forEach(function(colEl){
  colEl.addEventListener('dragover', function(e){
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    colEl.classList.add('is-over');
  });
  colEl.addEventListener('dragleave', function(e){
    if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('is-over');
  });
  colEl.addEventListener('drop', function(e){
    e.preventDefault();
    colEl.classList.remove('is-over');
    const id = e.dataTransfer.getData('text/plain');
    const targetCol = colEl.dataset.col;
    for (const col of KB_COLS){
      const idx = kanban[col].findIndex(function(t){ return t.id === id; });
      if (idx !== -1){
        const [task] = kanban[col].splice(idx,1);
        kanban[targetCol].push(task);
        kbSave(); kbRender();
        return;
      }
    }
  });
});

/* ============================================================
   6. ПЕРЕТАСКИВАНИЕ ВИДЖЕТОВ
============================================================ */
const LS_ORDER = 'widget-order';
const GRID = $('#widgets-grid');

function saveOrder(){
  const ids = Array.from(GRID.querySelectorAll('.widget')).map(function(w){ return w.id; });
  try{ localStorage.setItem(LS_ORDER, JSON.stringify(ids)); }catch(err){}
}
function restoreOrder(){
  try{
    const raw = localStorage.getItem(LS_ORDER);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return;
    ids.forEach(function(id){
      const w = document.getElementById(id);
      if (w && w.parentElement === GRID) GRID.appendChild(w);
    });
  } catch(err){}
}

let dragSrcId = null;
GRID.querySelectorAll('.widget').forEach(function(widget){
  const head = widget.querySelector('.widget__head');
  if (!head) return;
  head.addEventListener('dragstart', function(e){
    dragSrcId = widget.id;
    widget.classList.add('widget--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widget.id);
  });
  head.addEventListener('dragend', function(){
    widget.classList.remove('widget--dragging');
    GRID.querySelectorAll('.widget').forEach(function(w){
      w.classList.remove('widget--drop-target');
    });
    dragSrcId = null;
    saveOrder();
  });
  widget.addEventListener('dragover', function(e){
    if (!dragSrcId || dragSrcId === widget.id) return;
    e.preventDefault();
    widget.classList.add('widget--drop-target');
  });
  widget.addEventListener('dragleave', function(e){
    if (!widget.contains(e.relatedTarget)) widget.classList.remove('widget--drop-target');
  });
  widget.addEventListener('drop', function(e){
    if (!dragSrcId || dragSrcId === widget.id) return;
    e.preventDefault();
    widget.classList.remove('widget--drop-target');
    const src = document.getElementById(dragSrcId);
    if (!src || src.parentElement !== GRID) return;
    const rect = widget.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width/2;
    if (after) widget.after(src);
    else widget.before(src);
    saveOrder();
  });
});

/* ============================================================
   СТАРТ
============================================================ */
restoreOrder();
kbRender();
steamRender();
steamFootUpdate();
ghLoad();
hnLoad();
unityLoad();

if (!steamGames.length){
  steamLoadTopIntoList();
} else {
  steamFootUpdate();
}