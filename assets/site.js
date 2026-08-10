const API_BASE = "https://sea-ai-api.azurewebsites.net/pages/sgp-ai";
const i18n = window.SGPI18n;

function t(value, variables = {}) {
  return i18n?.t(value, variables) ?? String(value ?? "");
}

function currentLocale() {
  return i18n?.getLocale() ?? "en";
}

function formatLocaleNumber(value, options) {
  return i18n?.formatNumber(value, options) ?? Number(value).toLocaleString();
}

function documentCountLabel(count) {
  return `${formatLocaleNumber(count)} ${t(count === 1 ? "document" : "documents")}`;
}

const form = document.getElementById("query-form");
const queryEl = document.getElementById("query");
const submitButton = document.getElementById("submit");
const stopButton = document.getElementById("stop");
const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const answerEl = document.getElementById("answer");
const answerMeta = document.getElementById("answer-meta");
const sourcesEl = document.getElementById("sources");
const sourceCountEl = document.getElementById("source-count");
const suggestionsEl = document.getElementById("suggestions");
const suggestionsTitleEl = document.getElementById("suggestions-title");
const mapEl = document.getElementById("relevance-map");
const mapMetaEl = document.getElementById("map-meta");
const mapCountEl = document.getElementById("map-count");
const mapTopEl = document.getElementById("relevance-top");

let activeController = null;
let backendReady = false;
let queryRunning = false;
let statusRequestId = 0;

const DATASET = Object.freeze({
  value: "innovation_library",
  label: "Innovation Library",
});
const STARTER_QUESTIONS = [
  "What lessons have SGP-supported grants generated on coastal resilience?",
  "Which SGP knowledge products discuss Indigenous Peoples and biodiversity?",
  "What evidence do SGP publications provide on community-based adaptation?",
  "How have women-led grantee initiatives strengthened environmental outcomes and local livelihoods?",
  "What roles have young people played in SGP-supported environmental initiatives?",
  "How has traditional knowledge informed conservation decisions in SGP-supported grants?",
  "What approaches to ecosystem restoration appear across SGP publications?",
  "What community-level lessons have emerged on chemicals and waste management?",
  "How have SGP-supported grants contributed to sustainable land management?",
  "What do SGP publications report about community renewable energy solutions?",
  "What trends are highlighted in SGP annual monitoring reports?",
  "How have SGP country programme strategies adapted global priorities to local contexts?",
  "What guidance exists for National Steering Committees on grant selection and oversight?",
  "Which monitoring indicators have been used to capture community and environmental results?",
  "What lessons have been documented on replicating or scaling successful grantee practices?",
  "How have partnerships and cofinancing supported the results of SGP-funded grants?",
  "What do SGP resources say about community conservation and ICCAs?",
  "How have grantee initiatives linked watershed management with community water security?",
  "What examples show climate adaptation and mitigation benefits being pursued together?",
  "What cross-country lessons emerge from SGP-supported grants working on similar environmental challenges?",
];

function selectStarterQuestions(count = 3) {
  const pool = [...STARTER_QUESTIONS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }
  return pool.slice(0, count);
}

function renderStarterQuestions() {
  suggestionsTitleEl.textContent = t("Starter questions");
  suggestionsEl.replaceChildren();
  for (const question of selectStarterQuestions()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t(question);
    suggestionsEl.appendChild(button);
  }
}

function setStatus(kind, text) {
  statusDot.className = `dot ${kind}`;
  statusLabel.textContent = text;
  backendReady = kind === "good";
  submitButton.disabled = queryRunning || !backendReady;
}

function setRunning(isRunning) {
  queryRunning = isRunning;
  submitButton.disabled = isRunning || !backendReady;
  stopButton.hidden = !isRunning;
}

function readError(response) {
  return response.text().then((text) => {
    try {
      const payload = JSON.parse(text);
      return payload.detail || payload.error || response.statusText;
    } catch (_) {
      return text || response.statusText;
    }
  });
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(extractText).join("");
  if (content && typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    if (content.text && typeof content.text.value === "string") return content.text.value;
    if (content.content) return extractText(content.content);
  }
  return "";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const entityDecoder = document.createElement("textarea");

function decodeHtmlEntities(text) {
  entityDecoder.innerHTML = String(text)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return entityDecoder.value;
}

function renderMarkdown(text) {
  return escapeHtml(decodeHtmlEntities(text)).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function cleanList(value, limit = 6) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[;,]/);
  const clean = [];
  const seen = new Set();
  for (const item of items) {
    const text = String(item || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    clean.push(text);
    if (clean.length >= limit) break;
  }
  return clean;
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return new Intl.NumberFormat(currentLocale(), {
    style: "percent",
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.min(1, number)));
}

function resetRelevanceMap(dataset) {
  if (!mapEl || !mapMetaEl || !mapCountEl || !mapTopEl) return;
  mapMetaEl.textContent = `${t("Scoring")} ${t(dataset.label).toLocaleLowerCase(currentLocale())}...`;
  mapCountEl.textContent = documentCountLabel(0);
  mapTopEl.replaceChildren();
  mapEl.innerHTML = `<p class="empty">${t("Loading document relevance...")}</p>`;
}

function renderRelevanceTop(documents, selectedDocument = null) {
  if (!mapTopEl) return;
  const topDocuments = selectedDocument
    ? [selectedDocument, ...documents.filter((doc) => doc.document_id !== selectedDocument.document_id).slice(0, 4)]
    : documents.slice(0, 5);
  mapTopEl.replaceChildren();
  if (!topDocuments.length) return;
  const heading = document.createElement("div");
  heading.className = "relevance-top-heading";
  heading.textContent = t(selectedDocument ? "Selected document" : "Top matching documents");
  mapTopEl.appendChild(heading);
  for (const doc of topDocuments) {
    const row = document.createElement("article");
    row.className = "relevance-doc";
    const title = document.createElement(doc.url ? "a" : "strong");
    title.textContent = doc.title || t("Untitled document");
    title.setAttribute("data-no-translate", "");
    if (doc.url) {
      title.href = doc.url;
      title.target = "_blank";
      title.rel = "noreferrer noopener";
    }
    row.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.setAttribute("data-no-translate", "");
    const metaParts = [formatPercent(doc.relevance)];
    if (doc.year) metaParts.push(String(doc.year));
    if (doc.source) metaParts.push(String(doc.source).replace(/[_-]+/g, " "));
    if (doc.document_type) metaParts.push(String(doc.document_type).replace(/[_-]+/g, " "));
    meta.textContent = metaParts.join(" · ");
    row.appendChild(meta);
    const tags = [...cleanList(doc.topics, 4), ...cleanList(doc.country_codes, 2), ...cleanList(doc.region_codes, 2)].slice(0, 6);
    if (tags.length) {
      const tagLine = document.createElement("p");
      tagLine.textContent = tags.join(" · ");
      tagLine.setAttribute("data-no-translate", "");
      row.appendChild(tagLine);
    }
    mapTopEl.appendChild(row);
  }
}

function renderRelevanceMap(payload, dataset) {
  if (!mapEl || !mapMetaEl || !mapCountEl || !mapTopEl) return;
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  const sorted = [...documents].sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0));
  mapCountEl.textContent = documentCountLabel(documents.length);
  mapMetaEl.textContent = `${t("Document-level relevance")} · ${t(dataset.label)}`;
  mapEl.replaceChildren();
  if (!documents.length) {
    mapEl.innerHTML = `<p class="empty">${t("No documents are available for this corpus selection.")}</p>`;
    mapTopEl.replaceChildren();
    return;
  }
  for (const doc of sorted) {
    const relevance = Math.max(0, Math.min(1, Number(doc.relevance || 0)));
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "relevance-tile";
    tile.style.setProperty("--score", String(relevance));
    tile.title = `${doc.title || t("Untitled document")} · ${formatPercent(relevance)}`;
    tile.setAttribute("aria-label", tile.title);
    tile.addEventListener("mouseenter", () => renderRelevanceTop(sorted, doc));
    tile.addEventListener("focus", () => renderRelevanceTop(sorted, doc));
    tile.addEventListener("click", () => renderRelevanceTop(sorted, doc));
    mapEl.appendChild(tile);
  }
  renderRelevanceTop(sorted);
}

async function loadRelevanceMap(query, dataset, signal) {
  if (!mapEl || !mapMetaEl || !mapCountEl || !mapTopEl) return;
  resetRelevanceMap(dataset);
  try {
    const endpoint = new URL(`${API_BASE}/relevance-map`);
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("data_source", dataset.value);
    const response = await fetch(endpoint.toString(), { headers: { "Accept": "application/json" }, signal });
    if (!response.ok) throw new Error(await readError(response));
    renderRelevanceMap(await response.json(), dataset);
  } catch (error) {
    if (error.name === "AbortError") return;
    mapMetaEl.textContent = t("Corpus map unavailable");
    mapCountEl.textContent = documentCountLabel(0);
    mapTopEl.replaceChildren();
    mapEl.innerHTML = `<p class="warning">${t("Corpus map could not load. Answers and sources still work.")}</p>`;
  }
}

function uniqueDocuments(documents) {
  const seen = new Set();
  const clean = [];
  for (const item of Array.isArray(documents) ? documents : []) {
    if (!item || typeof item !== "object") continue;
    const title = decodeHtmlEntities(item.title || item.canonical_title || "").trim();
    const url = String(item.url || "").trim();
    const summary = decodeHtmlEntities(item.summary || "").trim();
    const language = decodeHtmlEntities(item.language || "").trim();
    const dataset = decodeHtmlEntities(item.dataset || item.corpus || item.source_id || item.source || "").trim();
    const year = Number.isInteger(item.year) && item.year > 0 ? item.year : null;
    const key = item.document_id || url || `${title}|${year || ""}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clean.push({ title: title || url || t("Untitled document"), url, summary, language, dataset, year });
  }
  return clean;
}

function renderSources(documents) {
  const clean = uniqueDocuments(documents);
  sourceCountEl.textContent = documentCountLabel(clean.length);
  sourcesEl.replaceChildren();
  if (!clean.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("No references returned yet.");
    sourcesEl.appendChild(empty);
    return;
  }
  for (const doc of clean) {
    const card = document.createElement("article");
    card.className = "source-card";
    const title = document.createElement(doc.url ? "a" : "strong");
    title.textContent = doc.title;
    title.setAttribute("data-no-translate", "");
    if (doc.url) {
      title.href = doc.url;
      title.target = "_blank";
      title.rel = "noreferrer noopener";
    }
    card.appendChild(title);
    const metaParts = [];
    if (doc.year) metaParts.push(String(doc.year));
    if (doc.language) metaParts.push(doc.language);
    if (doc.dataset) metaParts.push(doc.dataset.replace(/[_-]+/g, " "));
    if (metaParts.length) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = metaParts.join(" · ");
      meta.setAttribute("data-no-translate", "");
      card.appendChild(meta);
    }
    if (doc.summary) {
      const summary = document.createElement("p");
      summary.textContent = doc.summary;
      summary.setAttribute("data-no-translate", "");
      card.appendChild(summary);
    }
    sourcesEl.appendChild(card);
  }
}

function cleanIdeas(ideas) {
  const seen = new Set();
  const clean = [];
  for (const idea of Array.isArray(ideas) ? ideas : []) {
    const text = decodeHtmlEntities(idea || "").trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    clean.push(text);
    if (clean.length >= 3) break;
  }
  return clean;
}

function renderIdeas(ideas) {
  const clean = cleanIdeas(ideas);
  if (!clean.length) return;
  suggestionsTitleEl.textContent = t("Suggested next questions");
  suggestionsEl.replaceChildren();
  for (const idea of clean) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = idea;
    button.setAttribute("data-no-translate", "");
    suggestionsEl.appendChild(button);
  }
}

async function checkStatus() {
  const requestId = ++statusRequestId;
  statusDot.className = "dot loading";
  statusLabel.textContent = `${t("Checking")} ${t(DATASET.label)}...`;
  backendReady = false;
  submitButton.disabled = true;
  try {
    const endpoint = new URL(`${API_BASE}/status`);
    endpoint.searchParams.set("data_source", DATASET.value);
    const response = await fetch(endpoint.toString(), { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(await readError(response));
    const payload = await response.json();
    if (requestId !== statusRequestId) return;
    if (payload.corpus_ready) {
      setStatus("good", `${t("Ready")} · ${documentCountLabel(payload.document_count)}`);
    } else {
      setStatus("bad", t("Corpus unavailable"));
    }
  } catch (error) {
    if (requestId !== statusRequestId) return;
    setStatus("bad", t("Backend unavailable"));
    answerEl.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = String(error.message || error);
    answerEl.appendChild(message);
  }
}

async function streamAnswer(query, dataset, signal) {
  const endpoint = new URL(`${API_BASE}/model`);
  endpoint.searchParams.set("data_source", dataset.value);
  endpoint.searchParams.set("ui_locale", currentLocale());
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
    body: JSON.stringify([{ role: "human", content: query }]),
    signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error(t("No response stream returned by browser."));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  const started = performance.now();

  function handleLine(line) {
    if (!line.trim()) return;
    const payload = JSON.parse(line);
    const text = extractText(payload.content);
    if (text) {
      answer += text;
      answerEl.innerHTML = renderMarkdown(answer);
    }
    if (Array.isArray(payload.documents)) {
      renderSources(payload.documents);
    }
    if (Array.isArray(payload.ideas)) {
      renderIdeas(payload.ideas);
    }
    answerMeta.textContent = `${Math.round((performance.now() - started) / 100) / 10}s`;
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) handleLine(line);
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
}

async function runQuery(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery || !backendReady) return;
  if (activeController) activeController.abort();
  activeController = new AbortController();
  answerMeta.textContent = `${t("Streaming")} · ${t(DATASET.label)}`;
  answerEl.setAttribute("data-no-translate", "");
  answerEl.textContent = "";
  sourcesEl.innerHTML = `<p class="empty">${t("Waiting for references...")}</p>`;
  sourceCountEl.textContent = documentCountLabel(0);
  suggestionsTitleEl.textContent = t("Generating follow-up questions...");
  suggestionsEl.replaceChildren();
  loadRelevanceMap(cleanQuery, DATASET, activeController.signal);
  setRunning(true);
  try {
    await streamAnswer(cleanQuery, DATASET, activeController.signal);
  } catch (error) {
    if (error.name !== "AbortError") {
      answerEl.innerHTML = "";
      const message = document.createElement("p");
      message.className = "error";
      message.textContent = String(error.message || error);
      answerEl.appendChild(message);
      answerMeta.textContent = t("Error");
    }
  } finally {
    setRunning(false);
    activeController = null;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runQuery(queryEl.value);
});

stopButton.addEventListener("click", () => {
  if (activeController) activeController.abort();
});

suggestionsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !suggestionsEl.contains(button)) return;
  queryEl.value = button.textContent;
  runQuery(button.textContent);
});

renderStarterQuestions();
checkStatus();

window.addEventListener("sgp:localechange", () => {
  renderStarterQuestions();
  if (!queryRunning) checkStatus();
});
