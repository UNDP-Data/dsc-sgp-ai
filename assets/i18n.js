(() => {
  "use strict";

  const STORAGE_KEY = "sgp-klp-locale";
  const FALLBACK_LOCALE = "en";
  const LOCALE_CODES = ["en", "pt", "fr", "es", "ru", "zh", "ar"];
  const scriptUrl = document.currentScript?.src || new URL("assets/i18n.js", window.location.href).href;
  const catalogUrl = new URL("i18n-catalog.json", scriptUrl);
  const originalText = new WeakMap();
  const renderedText = new WeakMap();
  const originalAttributes = new WeakMap();
  const renderedAttributes = new WeakMap();
  let catalog = null;
  let locale = readInitialLocale();
  let observer = null;
  let localizationScheduled = false;
  let fragmentRows = [];

  function safeStorageGet() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function safeStorageSet(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {
      // Storage may be blocked in embedded previews; locale still works in memory.
    }
  }

  function readInitialLocale() {
    const queryLocale = new URLSearchParams(window.location.search).get("lang")?.toLowerCase();
    if (LOCALE_CODES.includes(queryLocale)) return queryLocale;
    const routeLocale = window.location.pathname
      .split("/")
      .filter(Boolean)
      .find((segment) => LOCALE_CODES.includes(segment.toLowerCase()));
    if (routeLocale) return routeLocale.toLowerCase();
    const saved = safeStorageGet();
    if (LOCALE_CODES.includes(saved)) return saved;
    const browserLocale = String(navigator.language || "").toLowerCase();
    return LOCALE_CODES.find((code) => browserLocale.startsWith(code)) || FALLBACK_LOCALE;
  }

  function languageFor(code = locale) {
    return catalog?.locales?.find((item) => item.code === code) || {
      code,
      short: code.toUpperCase(),
      label: code,
      nativeLabel: code,
      dir: code === "ar" ? "rtl" : "ltr"
    };
  }

  function replaceVariables(value, variables) {
    let output = String(value);
    for (const [key, replacement] of Object.entries(variables || {})) {
      output = output.replaceAll(`{${key}}`, String(replacement));
    }
    return output;
  }

  function preserveWhitespace(source, translated) {
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    return `${leading}${translated}${trailing}`;
  }

  function boundaryPattern(value) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu");
  }

  function translate(source, variables = {}) {
    const canonical = String(source ?? "");
    if (!canonical || locale === FALLBACK_LOCALE || !catalog) return replaceVariables(canonical, variables);
    const clean = canonical.trim().replace(/\s+/g, " ");
    const exact = catalog.messages?.[clean]?.[locale];
    if (exact) return preserveWhitespace(canonical, replaceVariables(exact, variables));

    if (clean.includes(" · ")) {
      const translatedParts = clean.split(" · ").map((part) => translate(part));
      if (translatedParts.some((part, index) => part !== clean.split(" · ")[index])) {
        return preserveWhitespace(canonical, translatedParts.join(" · "));
      }
    }

    let output = clean;
    for (const [english, translated] of fragmentRows) {
      if (!output.includes(english)) continue;
      output = output.replace(boundaryPattern(english), translated);
    }
    return preserveWhitespace(canonical, replaceVariables(output, variables));
  }

  function formatNumber(value, options) {
    return new Intl.NumberFormat(locale, options).format(value);
  }

  function rebuildFragmentRows() {
    fragmentRows = Object.entries(catalog?.messages || {})
      .filter(([english, translations]) => (
        english.length >= 4 &&
        english.length <= 96 &&
        translations?.[locale] &&
        /[A-Za-z]/.test(english)
      ))
      .sort(([left], [right]) => right.length - left.length)
      .map(([english, translations]) => [english, translations[locale]]);
  }

  function shouldSkip(element) {
    return element.matches("script,style,code,pre,[data-no-translate]") || Boolean(element.closest("[data-no-translate]"));
  }

  function localizeTextNode(node) {
    const previousRendered = renderedText.get(node);
    if (!originalText.has(node) || (previousRendered != null && node.data !== previousRendered)) {
      originalText.set(node, node.data);
    }
    const source = originalText.get(node);
    const translated = translate(source);
    if (node.data !== translated) node.data = translated;
    renderedText.set(node, translated);
  }

  function localizeAttribute(element, name) {
    const current = element.getAttribute(name);
    if (!current) return;
    const originals = originalAttributes.get(element) || {};
    const rendered = renderedAttributes.get(element) || {};
    if (!originals[name] || (rendered[name] != null && current !== rendered[name])) originals[name] = current;
    const translated = translate(originals[name]);
    if (current !== translated) element.setAttribute(name, translated);
    rendered[name] = translated;
    originalAttributes.set(element, originals);
    renderedAttributes.set(element, rendered);
  }

  function localizeElement(element) {
    if (shouldSkip(element)) return;
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) localizeTextNode(child);
    }
    for (const name of ["aria-label", "placeholder", "title", "data-tooltip"]) {
      localizeAttribute(element, name);
    }
    if (element.matches("[data-i18n-value]") && "value" in element) {
      if (!element.dataset.i18nValueBound) {
        element.addEventListener("input", () => {
          element.dataset.i18nValueUserEdited = "true";
        });
        element.dataset.i18nValueBound = "true";
      }
      if (!element.dataset.i18nSourceValue) element.dataset.i18nSourceValue = element.value;
      if (element.dataset.i18nValueUserEdited !== "true") {
        element.value = translate(element.dataset.i18nSourceValue);
      }
    }
  }

  function localizeTree(root = document.body) {
    if (!root || !catalog) return;
    const elements = root instanceof Element
      ? [root, ...root.querySelectorAll("*")]
      : [...document.body.querySelectorAll("*")];
    for (const element of elements) localizeElement(element);
    document.documentElement.lang = locale;
    document.documentElement.dir = languageFor().dir;
    document.body?.classList.toggle("is-rtl", languageFor().dir === "rtl");
    if (!document.documentElement.dataset.i18nTitleSource) {
      document.documentElement.dataset.i18nTitleSource = document.title;
    }
    document.title = translate(document.documentElement.dataset.i18nTitleSource);
    for (const meta of document.querySelectorAll('meta[name="description"]')) {
      if (!meta.dataset.i18nContentSource) meta.dataset.i18nContentSource = meta.content;
      meta.content = translate(meta.dataset.i18nContentSource);
    }
    syncLanguageSelectors();
    preserveLocaleInLinks();
  }

  function scheduleLocalization() {
    if (localizationScheduled) return;
    localizationScheduled = true;
    window.requestAnimationFrame(() => {
      localizationScheduled = false;
      localizeTree(document.body);
    });
  }

  function syncLanguageSelectors() {
    if (!catalog) return;
    for (const select of document.querySelectorAll("[data-language-select]")) {
      if (!select.dataset.i18nReady) {
        select.replaceChildren();
        for (const item of catalog.locales) {
          const option = document.createElement("option");
          option.value = item.code;
          option.textContent = `${item.short} · ${item.nativeLabel}`;
          option.lang = item.code;
          option.dir = "ltr";
          select.appendChild(option);
        }
        select.addEventListener("change", () => setLocale(select.value));
        select.dataset.i18nReady = "true";
      }
      select.value = locale;
      select.dir = "ltr";
      select.setAttribute("aria-label", translate("Select language"));
    }
  }

  function preserveLocaleInLinks() {
    for (const anchor of document.querySelectorAll("a[href]:not([data-no-locale])")) {
      const raw = anchor.getAttribute("href");
      if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
      let target;
      try {
        target = new URL(raw, window.location.href);
      } catch (_) {
        continue;
      }
      if (target.origin !== window.location.origin) continue;
      target.searchParams.set("lang", locale);
      if (anchor.href !== target.href) anchor.href = target.href;
    }
  }

  function setLocale(nextLocale, { updateUrl = true } = {}) {
    const next = String(nextLocale || "").toLowerCase();
    if (!LOCALE_CODES.includes(next)) return;
    locale = next;
    safeStorageSet(next);
    rebuildFragmentRows();
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", next);
      window.history.replaceState(window.history.state, "", url);
    }
    localizeTree(document.body);
    window.dispatchEvent(new CustomEvent("sgp:localechange", {
      detail: { locale, language: languageFor() }
    }));
  }

  function installObserver() {
    observer?.disconnect();
    observer = new MutationObserver(scheduleLocalization);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "placeholder", "title", "data-tooltip", "href"]
    });
  }

  const ready = fetch(catalogUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load ${catalogUrl}`);
      return response.json();
    })
    .then((payload) => {
      catalog = payload;
      rebuildFragmentRows();
      localizeTree(document.body);
      installObserver();
      window.dispatchEvent(new CustomEvent("sgp:i18nready", {
        detail: { locale, language: languageFor() }
      }));
      return api;
    })
    .catch((error) => {
      console.error("SGP internationalization failed to initialize.", error);
      return api;
    });

  const api = {
    ready,
    getLocale: () => locale,
    getLanguage: () => languageFor(),
    getLanguages: () => catalog?.locales || [],
    setLocale,
    t: translate,
    formatNumber,
    localize: localizeTree
  };

  window.SGPI18n = api;
})();
