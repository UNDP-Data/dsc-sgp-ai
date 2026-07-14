const API_BASE = "https://sea-ai-api.azurewebsites.net/pages/sgp-ai";

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
const datasetHelpEl = document.getElementById("dataset-help");
const mapEl = document.getElementById("relevance-map");
const mapMetaEl = document.getElementById("map-meta");
const mapCountEl = document.getElementById("map-count");
const mapTopEl = document.getElementById("relevance-top");
const datasetInputs = Array.from(document.querySelectorAll('input[name="dataset"]'));

let activeController = null;
let backendReady = false;
let queryRunning = false;
let statusRequestId = 0;

const DATASET_OPTIONS = {
  all: {
    label: "All datasets",
    help: "Searches both the Innovation Library and project database.",
  },
  innovation_library: {
    label: "Innovation Library",
    help: "Searches SGP publications, reports, and knowledge products from the Innovation Library.",
  },
  project_database: {
    label: "Project Database",
    help: "Searches prepared project database records and extracted project documents.",
    inlineDisclaimer:
      "Project Database mode currently includes only projects processed for Turkey and coral reefs.",
  },
};

function getSelectedDataset() {
  const selected = datasetInputs.find((input) => input.checked);
  const value = selected && DATASET_OPTIONS[selected.value] ? selected.value : "all";
  return { value, ...DATASET_OPTIONS[value] };
}

function updateDatasetHelp() {
  const dataset = getSelectedDataset();
  if (!datasetHelpEl) return;
  datasetHelpEl.textContent = "";
  datasetHelpEl.append(document.createTextNode(dataset.help));
  if (dataset.inlineDisclaimer) {
    const disclaimer = document.createElement("span");
    disclaimer.className = "dataset-inline-disclaimer";
    disclaimer.textContent = ` ${dataset.inlineDisclaimer}`;
    datasetHelpEl.append(disclaimer);
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
  return `${Math.round(Math.max(0, Math.min(1, number)) * 100)}%`;
}

function resetRelevanceMap(dataset) {
  if (!mapEl || !mapMetaEl || !mapCountEl || !mapTopEl) return;
  mapMetaEl.textContent = `Scoring ${dataset.label.toLowerCase()}...`;
  mapCountEl.textContent = "0 documents";
  mapTopEl.replaceChildren();
  mapEl.innerHTML = '<p class="empty">Loading document relevance...</p>';
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
  heading.textContent = selectedDocument ? "Selected document" : "Top matching documents";
  mapTopEl.appendChild(heading);
  for (const doc of topDocuments) {
    const row = document.createElement("article");
    row.className = "relevance-doc";
    const title = document.createElement(doc.url ? "a" : "strong");
    title.textContent = doc.title || "Untitled document";
    if (doc.url) {
      title.href = doc.url;
      title.target = "_blank";
      title.rel = "noreferrer noopener";
    }
    row.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "meta";
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
      row.appendChild(tagLine);
    }
    mapTopEl.appendChild(row);
  }
}

function renderRelevanceMap(payload, dataset) {
  if (!mapEl || !mapMetaEl || !mapCountEl || !mapTopEl) return;
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  const sorted = [...documents].sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0));
  mapCountEl.textContent = `${documents.length.toLocaleString()} document${documents.length === 1 ? "" : "s"}`;
  mapMetaEl.textContent = `Document-level relevance · ${dataset.label}`;
  mapEl.replaceChildren();
  if (!documents.length) {
    mapEl.innerHTML = '<p class="empty">No documents are available for this corpus selection.</p>';
    mapTopEl.replaceChildren();
    return;
  }
  for (const doc of sorted) {
    const relevance = Math.max(0, Math.min(1, Number(doc.relevance || 0)));
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "relevance-tile";
    tile.style.setProperty("--score", String(relevance));
    tile.title = `${doc.title || "Untitled document"} · ${formatPercent(relevance)}`;
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
    mapMetaEl.textContent = "Corpus map unavailable";
    mapCountEl.textContent = "0 documents";
    mapTopEl.replaceChildren();
    mapEl.innerHTML = '<p class="warning">Corpus map could not load. Answers and sources still work.</p>';
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
    clean.push({ title: title || url || "Untitled document", url, summary, language, dataset, year });
  }
  return clean;
}

function renderSources(documents) {
  const clean = uniqueDocuments(documents);
  sourceCountEl.textContent = `${clean.length} document${clean.length === 1 ? "" : "s"}`;
  sourcesEl.replaceChildren();
  if (!clean.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No references returned yet.";
    sourcesEl.appendChild(empty);
    return;
  }
  for (const doc of clean) {
    const card = document.createElement("article");
    card.className = "source-card";
    const title = document.createElement(doc.url ? "a" : "strong");
    title.textContent = doc.title;
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
      card.appendChild(meta);
    }
    if (doc.summary) {
      const summary = document.createElement("p");
      summary.textContent = doc.summary;
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
  suggestionsTitleEl.textContent = "Suggested next questions";
  suggestionsEl.replaceChildren();
  for (const idea of clean) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = idea;
    suggestionsEl.appendChild(button);
  }
}

async function checkStatus() {
  const requestId = ++statusRequestId;
  const dataset = getSelectedDataset();
  statusDot.className = "dot loading";
  statusLabel.textContent = `Checking ${dataset.label.toLowerCase()}...`;
  backendReady = false;
  submitButton.disabled = true;
  try {
    const endpoint = new URL(`${API_BASE}/status`);
    endpoint.searchParams.set("data_source", dataset.value);
    const response = await fetch(endpoint.toString(), { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error(await readError(response));
    const payload = await response.json();
    if (requestId !== statusRequestId || getSelectedDataset().value !== dataset.value) return;
    if (payload.corpus_ready) {
      setStatus("good", `Ready · ${payload.document_count.toLocaleString()} documents`);
    } else {
      setStatus("bad", "Corpus unavailable");
    }
  } catch (error) {
    if (requestId !== statusRequestId) return;
    setStatus("bad", "Backend unavailable");
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
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
    body: JSON.stringify([{ role: "human", content: query }]),
    signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error("No response stream returned by browser.");

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
  const dataset = getSelectedDataset();
  if (activeController) activeController.abort();
  activeController = new AbortController();
  answerMeta.textContent = `Streaming · ${dataset.label}`;
  answerEl.textContent = "";
  sourcesEl.innerHTML = '<p class="empty">Waiting for references...</p>';
  sourceCountEl.textContent = "0 documents";
  suggestionsTitleEl.textContent = "Generating follow-up questions...";
  suggestionsEl.replaceChildren();
  loadRelevanceMap(cleanQuery, dataset, activeController.signal);
  setRunning(true);
  try {
    await streamAnswer(cleanQuery, dataset, activeController.signal);
  } catch (error) {
    if (error.name !== "AbortError") {
      answerEl.innerHTML = "";
      const message = document.createElement("p");
      message.className = "error";
      message.textContent = String(error.message || error);
      answerEl.appendChild(message);
      answerMeta.textContent = "Error";
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

datasetInputs.forEach((input) => {
  input.addEventListener("change", () => {
    updateDatasetHelp();
    checkStatus();
  });
});

updateDatasetHelp();
checkStatus();
