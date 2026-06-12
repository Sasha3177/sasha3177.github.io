'use strict';

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJM8ECsqtRuDGVP6aO0GqRFmiXWm8KeOGLzLzLgga8tgl6U--ujQdgtMSM0GT14VNeHBiWFrjjztSA/pub?output=csv';

const state = {
  offers: [],
  filter: '',
};

const elements = {
  year: document.querySelector('#currentYear'),
  status: document.querySelector('#statusMessage'),
  grid: document.querySelector('#offersGrid'),
  searchInput: document.querySelector('#searchInput'),
  reloadButton: document.querySelector('#reloadButton'),
};

init();

function init() {
  if (elements.year) {
    elements.year.textContent = String(new Date().getFullYear());
  }

  elements.searchInput?.addEventListener('input', (event) => {
    state.filter = event.target.value.trim().toLowerCase();
    renderOffers();
  });

  elements.reloadButton?.addEventListener('click', () => {
    loadOffersFromGoogleSheets();
  });

  loadOffersFromGoogleSheets();
}

async function loadOffersFromGoogleSheets() {
  const csvUrl = buildCsvUrl(GOOGLE_SHEETS_CSV_URL);

  if (!csvUrl) {
    state.offers = [];
    setStatus('Google Sheets ist noch nicht verbunden. Trage den CSV-Link in app.js ein.');
    renderOffers();
    return;
  }

  try {
    setStatus('Einträge werden geladen ...');

    const response = await fetch(csvUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);
    state.offers = rowsToObjects(rows);

    setStatus(`${state.offers.length} Eintrag/Einträge geladen.`);
    renderOffers();
  } catch (error) {
    console.error('Google-Sheets-Import fehlgeschlagen:', error);
    state.offers = [];
    setStatus('Die Einträge konnten nicht geladen werden. Prüfe bitte, ob die Tabelle wirklich öffentlich als CSV veröffentlicht wurde.');
    renderOffers();
  }
}

function buildCsvUrl(inputUrl) {
  const trimmed = String(inputUrl || '').trim();

  if (!trimmed) {
    return '';
  }

  let url;

  try {
    url = new URL(trimmed);
  } catch {
    console.warn('Ungültige CSV-URL.');
    return '';
  }

  if (url.protocol !== 'https:') {
    console.warn('Bitte nur HTTPS-Links verwenden.');
    return '';
  }

  if (url.searchParams.get('output') === 'csv' || url.pathname.includes('/pub')) {
    return url.toString();
  }

  const sheetIdMatch = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetIdMatch) {
    return url.toString();
  }

  const sheetId = sheetIdMatch[1];
  const gid = url.hash.match(/gid=(\d+)/)?.[1] || url.searchParams.get('gid') || '0';

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => normalizeHeader(header));

  return rows.slice(1).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header || `field_${index}`] = row[index] || '';
    });
    return item;
  }).filter((item) => Object.values(item).some(Boolean));
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function renderOffers() {
  if (!elements.grid) {
    return;
  }

  clearNode(elements.grid);

  const visibleOffers = state.offers.filter((offer) => {
    if (!state.filter) {
      return true;
    }
    return Object.values(offer).join(' ').toLowerCase().includes(state.filter);
  });

  if (!GOOGLE_SHEETS_CSV_URL.trim()) {
    elements.grid.append(createInfoCard('Google Sheets noch nicht verbunden', 'Trage den veröffentlichten CSV-Link in app.js bei GOOGLE_SHEETS_CSV_URL ein.'));
    return;
  }

  if (visibleOffers.length === 0) {
    elements.grid.append(createInfoCard('Keine passenden Einträge', 'Ändere den Suchbegriff oder lade die Liste neu.'));
    return;
  }

  visibleOffers.forEach((offer) => {
    elements.grid.append(createOfferCard(offer));
  });
}

function createInfoCard(titleText, bodyText) {
  const card = document.createElement('article');
  card.className = 'offer-card placeholder-card';

  const title = document.createElement('h3');
  title.textContent = titleText;

  const text = document.createElement('p');
  text.textContent = bodyText;

  card.append(title, text);
  return card;
}

function createOfferCard(offer) {
  const titleValue = pickValue(offer, ['titel', 'title', 'name', 'angebot', 'gegenstand']) || 'Ohne Titel';
  const descriptionValue = pickValue(offer, ['beschreibung', 'description', 'details', 'info', 'notiz']) || 'Keine Beschreibung vorhanden.';
  const categoryValue = pickValue(offer, ['kategorie', 'category', 'rubrik']);
  const locationValue = pickValue(offer, ['ort', 'location', 'stadt']);
  const contactValue = pickValue(offer, ['kontakt', 'contact', 'email', 'telefon']);
  const nameValue = pickValue(offer, ['benutzername', 'name', 'user']);
  const wishValue = pickValue(offer, ['wuensche', 'wunsche', 'wish']);

  const card = document.createElement('article');
  card.className = 'offer-card';

  const title = document.createElement('h3');
  title.textContent = titleValue;

  const description = document.createElement('p');
  description.textContent = descriptionValue;

  card.append(title, description);

  if (categoryValue) {
    const category = document.createElement('span');
    category.className = 'offer-meta';
    category.textContent = categoryValue;
    card.append(category);
  }

  if (locationValue) {
    const location = document.createElement('p');
    location.textContent = `Ort: ${locationValue}`;
    card.append(location);
  }

  if (contactValue) {
    const contact = document.createElement('p');
    contact.textContent = `Kontakt: ${contactValue}`;
    card.append(contact);
  }

  if (nameValue) {
    const name = document.createElement('p');
    location.textContent = `Benutzername: ${nameValue}`;
    card.append(name);
  }

  if (wishValue) {
    const wish = document.createElement('p');
    contact.textContent = `Tauschwünsche / Preis: ${wishValue}`;
    card.append(wish);
  }
  
  return card;
}

function pickValue(object, keys) {
  for (const key of keys) {
    if (object[key]) {
      return object[key];
    }
  }
  return '';
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function setStatus(message) {
  if (elements.status) {
    elements.status.textContent = message;
  }
}
