'use strict';

/*
  analogisches eBay — Google Sheets Import
  =======================================

  So verbindest du später Google Sheets:

  VARIANTE A — am einfachsten, ohne API-Key:
  1. Öffne deine Google-Tabelle.
  2. Datei → Freigeben → Im Web veröffentlichen.
  3. Wähle das richtige Tabellenblatt und Format: CSV.
  4. Kopiere den CSV-Link.
  5. Füge den Link unten bei GOOGLE_SHEETS_CSV_URL ein.

  Beispiel:
  const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/DEINE_ID/pub?gid=0&single=true&output=csv';

  VARIANTE B — normale Google-Sheets-URL:
  Du kannst auch eine normale Tabellen-URL eintragen, aber die Tabelle muss öffentlich lesbar sein.
  Diese Datei versucht dann, daraus automatisch eine CSV-URL zu bauen.

  Empfohlene Spaltennamen in der ersten Tabellenzeile:
  - Titel / title / Name
  - Beschreibung / description / Details
  - Kategorie / category
  - Ort / location
  - Kontakt / contact

  Sicherheit:
  - Keine sensiblen Daten in einer öffentlich lesbaren Tabelle speichern.
  - Diese statische Website kann keine geheimen API-Keys sicher verstecken.
  - Für private Tabellen brauchst du später ein kleines Backend oder Google Apps Script als Proxy.
*/

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJM8ECsqtRuDGVP6aO0GqRFmiXWm8KeOGLzLzLgga8tgl6U--ujQdgtMSM0GT14VNeHBiWFrjjztSA/pub?output=csv'; // Später hier den Google-Sheets-CSV-Link eintragen.

const OFFER_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScCXSDOuNkuCPmOblJn53H68pp9r3Hfbiu7pRIdzL0jLun5Rg/viewform?usp=dialog';

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

  protectExternalOfferLinks();

  elements.searchInput?.addEventListener('input', (event) => {
    state.filter = event.target.value.trim().toLowerCase();
    renderOffers();
  });

  elements.reloadButton?.addEventListener('click', () => {
    loadOffersFromGoogleSheets();
  });

  loadOffersFromGoogleSheets();
}

function protectExternalOfferLinks() {
  document.querySelectorAll(`a[href="${OFFER_FORM_URL}"]`).forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}

async function loadOffersFromGoogleSheets() {
  const csvUrl = buildCsvUrl(GOOGLE_SHEETS_CSV_URL);

  if (!csvUrl) {
    state.offers = [];
    setStatus('Google Sheets ist noch nicht verbunden. Trage später den CSV-Link in app.js ein.');
    renderOffers();
    return;
  }

  try {
    setStatus('Einträge werden geladen ...');

    const response = await fetch(csvUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'text/csv,text/plain,*/*',
      },
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
    setStatus('Die Einträge konnten nicht geladen werden. Prüfe bitte, ob die Tabelle öffentlich als CSV veröffentlicht wurde.');
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
    console.warn('Ungültige Google-Sheets-URL.');
    return '';
  }

  const allowedHosts = new Set(['docs.google.com', 'spreadsheets.google.com']);
  if (!allowedHosts.has(url.hostname)) {
    console.warn('Aus Sicherheitsgründen sind nur Google-Sheets-Links erlaubt.');
    return '';
  }

  if (url.searchParams.get('output') === 'csv') {
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
    elements.grid.append(createPlaceholderCard());
    return;
  }

  if (visibleOffers.length === 0) {
    const emptyCard = document.createElement('article');
    emptyCard.className = 'offer-card placeholder-card';
    const title = document.createElement('h3');
    title.textContent = 'Keine passenden Einträge';
    const text = document.createElement('p');
    text.textContent = 'Ändere den Suchbegriff oder lade die Liste neu.';
    emptyCard.append(title, text);
    elements.grid.append(emptyCard);
    return;
  }

  visibleOffers.forEach((offer) => {
    elements.grid.append(createOfferCard(offer));
  });
}

function createPlaceholderCard() {
  const card = document.createElement('article');
  card.className = 'offer-card placeholder-card';

  const title = document.createElement('h3');
  title.textContent = 'Google Sheets noch nicht verbunden';

  const text = document.createElement('p');
  text.textContent = 'Trage später den veröffentlichten CSV-Link in app.js bei GOOGLE_SHEETS_CSV_URL ein. Danach werden die Tabellenzeilen automatisch hier angezeigt.';

  card.append(title, text);
  return card;
}

function createOfferCard(offer) {
  const titleValue = pickValue(offer, ['titel', 'title', 'name', 'angebot', 'gegenstand']) || 'Ohne Titel';
  const descriptionValue = pickValue(offer, ['beschreibung', 'description', 'details', 'info', 'notiz']) || 'Keine Beschreibung vorhanden.';
  const categoryValue = pickValue(offer, ['kategorie', 'category', 'rubrik']);
  const locationValue = pickValue(offer, ['ort', 'location', 'stadt']);
  const contactValue = pickValue(offer, ['kontakt', 'contact', 'email', 'telefon']);

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
