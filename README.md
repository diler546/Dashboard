# Панель инди-разработчика игр

Одностраничный дашборд для инди-разработчика на Unity: тренды GitHub,
новости технологий, релизы Unity, онлайн в Steam и Kanban задач проекта.

## Состав виджетов

| № | Виджет | Источник данных | Управление |
|---|--------|-----------------|------------|
| 01 | Тренды GitHub | GitHub Search API | поиск + тег + кнопка «Найти» |
| 02 | Новости технологий | Hacker News API | кнопка «Обновить», 20 новостей |
| 03 | Релизы Unity | Unity Release API | кнопка «Проверить» |
| 04 | Онлайн в Steam | Steam Web API (через прокси) | поиск игры + кнопка «Обновить» |
| 05 | Задачи проекта | localStorage | добавление, перемещение, drag&drop |

## Структура проекта
project/
├── index.html — разметка
├── style.css — стили
├── app.js — вся логика
└── README.md — этот файл

## API

### 1. GitHub Search API
- **Endpoint:** `https://api.github.com/search/repositories`
- **Параметры:** `?q={tag}+{query}+language:csharp&sort=stars&order=desc&per_page=10`
- **Поля:** `items[].full_name`, `items[].description`, `items[].stargazers_count`,
  `items[].forks_count`, `items[].language`, `items[].owner.login`, `items[].html_url`
- **Лимиты:** 10 запросов/мин без токена.
- **Документация:** https://docs.github.com/en/rest/search

### 2. Hacker News API
- **Endpoint:** `https://hacker-news.firebaseio.com/v0/topstories.json`
- **Плюс:** `https://hacker-news.firebaseio.com/v0/item/{id}.json` для каждого ID.
- **Поля:** `title`, `url`, `score`, `by`, `time`, `id`
- **Берём первые 20 новостей.**
- **Документация:** https://github.com/HackerNews/API

### 3. Unity Release API
- **Endpoint:** `https://services.api.unity.com/unity/editor/release/v1/releases`
- **Параметры:** `?limit=5&order=RELEASE_DATE_DESC`
- **Поля:** `results[].version`, `results[].releaseDate`, `results[].releaseNotes.url`
- **Документация:** https://services.api.unity.com/unity/editor/release/v1/releases

### 4. Steam Web API (через Cloudflare Worker прокси)
- **Прокси:** `https://steam-proxy.makar912.workers.dev`
- **Причина прокси:** Steam API не отдаёт CORS-заголовки для браузера.
  Worker добавляет `Access-Control-Allow-Origin: *` и проксирует запрос.
- **Топ-10 игр:** `ISteamChartsService/GetMostPlayedGames/v1/`
- **Поиск игры:** `store.steampowered.com/api/storesearch/?term={query}&l=ru&cc=RU`
- **Онлайн:** `ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid={appid}`
- **Название игры:** `store.steampowered.com/api/appdetails?appids={appid}&l=ru`

Код воркера (разворачивается отдельно):

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url', { status: 400 });

    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const body = await res.text();

    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};