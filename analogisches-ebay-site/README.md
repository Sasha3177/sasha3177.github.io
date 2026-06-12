# analogisches eBay

Готовый статический сайт с зелёным оформлением.

## Что уже сделано

- Стартовая страница с фоном и названием **analogisches eBay**.
- Две кнопки:
  - **Ich suche** — ведёт вниз на раздел сайта `Ich suche`.
  - **Ich biete an** — открывает Google Form в новой вкладке.
- Раздел **Ich suche** с поиском, кнопкой перезагрузки и заготовкой для импорта Google Sheets.
- Код разделён на `index.html`, `styles.css`, `app.js`.
- В код добавлены комментарии, как подключить Google Sheets.
- Добавлены базовые меры безопасности для статического сайта.

## Как подключить Google Sheets

Самый простой вариант:

1. Открой Google Sheets.
2. Нажми **Datei → Freigeben → Im Web veröffentlichen**.
3. Выбери нужный лист.
4. Формат выбери **CSV**.
5. Скопируй опубликованную CSV-ссылку.
6. Открой файл `app.js`.
7. Найди строку:

```js
const GOOGLE_SHEETS_CSV_URL = '';
```

8. Вставь ссылку внутрь кавычек:

```js
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/DEINE_ID/pub?gid=0&single=true&output=csv';
```

## Рекомендуемые колонки в Google Sheets

Первая строка таблицы должна быть заголовками. Лучше использовать такие колонки:

- Titel
- Beschreibung
- Kategorie
- Ort
- Kontakt

Также сайт понимает похожие названия: `title`, `description`, `category`, `location`, `contact`.

## Безопасность

Уже добавлено:

- Content Security Policy в `index.html`.
- Запрет на встраивание сайта в чужие iframe через `frame-ancestors 'none'`.
- `rel="noopener noreferrer"` для внешней Google-Form-ссылки.
- `referrer` policy.
- Данные из Google Sheets выводятся через `textContent`, не через `innerHTML`, чтобы снизить риск XSS.
- Fetch выполняется без cookies: `credentials: 'omit'`.
- Разрешены только Google-Sheets-хосты для подключения таблицы.

Важно: если таблица публичная, не добавляй туда личные или чувствительные данные. Если таблица должна быть закрытой, нужен backend или Google Apps Script proxy.

## Как открыть сайт локально

Просто открой `index.html` в браузере.

Для нормальной проверки импорта Google Sheets лучше запускать через локальный сервер, например:

```bash
python3 -m http.server 8000
```

Потом открыть:

```text
http://localhost:8000
```

## Как загрузить на хостинг

Загрузи все файлы из папки на любой статический хостинг:

- GitHub Pages
- Netlify
- Vercel
- обычный веб-хостинг с папкой `public_html`
