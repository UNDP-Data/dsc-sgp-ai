import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import catalogJson from "../../../assets/i18n-catalog.json";

export const localeCodes = ["en", "pt", "fr", "es", "ru", "zh", "ar"] as const;
export type LocaleCode = (typeof localeCodes)[number];

type Language = {
  code: LocaleCode;
  short: string;
  label: string;
  nativeLabel: string;
  dir: "ltr" | "rtl";
};

type Catalog = {
  locales: Language[];
  messages: Record<string, Partial<Record<LocaleCode, string>>>;
};

type I18nContextValue = {
  locale: LocaleCode;
  language: Language;
  languages: Language[];
  setLocale: (locale: LocaleCode) => void;
  t: (source: string, variables?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const catalog = catalogJson as Catalog;
const storageKey = "sgp-klp-locale";
const fallbackLocale: LocaleCode = "en";
const I18nContext = createContext<I18nContextValue | null>(null);

const originalText = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const renderedAttributes = new WeakMap<Element, Record<string, string>>();
const fragmentRowsByLocale = new Map<LocaleCode, ReadonlyArray<readonly [string, string]>>();

function isLocale(value: string | null | undefined): value is LocaleCode {
  return localeCodes.includes(value as LocaleCode);
}

function readStoredLocale() {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: LocaleCode) {
  try {
    window.localStorage.setItem(storageKey, locale);
  } catch {
    // Embedded previews can disable storage; the in-memory locale remains valid.
  }
}

export function resolveInitialLocale(
  search = typeof window === "undefined" ? "" : window.location.search,
  pathname = typeof window === "undefined" ? "" : window.location.pathname,
  saved = typeof window === "undefined" ? null : readStoredLocale(),
  browserLanguage = typeof navigator === "undefined" ? "" : navigator.language
): LocaleCode {
  const queryLocale = new URLSearchParams(search).get("lang")?.toLowerCase();
  if (isLocale(queryLocale)) return queryLocale;
  const routeLocale = pathname
    .split("/")
    .filter(Boolean)
    .find((segment) => isLocale(segment.toLowerCase()));
  if (isLocale(routeLocale?.toLowerCase())) return routeLocale.toLowerCase() as LocaleCode;
  if (isLocale(saved?.toLowerCase())) return saved.toLowerCase() as LocaleCode;
  const browserLocale = browserLanguage.toLowerCase();
  return localeCodes.find((code) => browserLocale.startsWith(code)) ?? fallbackLocale;
}

function replaceVariables(value: string, variables: Record<string, string | number> = {}) {
  let output = value;
  for (const [key, replacement] of Object.entries(variables)) {
    output = output.split(`{${key}}`).join(String(replacement));
  }
  return output;
}

function preserveWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function boundaryPattern(value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "gu");
}

function fragmentRows(locale: LocaleCode) {
  const cached = fragmentRowsByLocale.get(locale);
  if (cached) return cached;
  const rows = Object.entries(catalog.messages)
    .filter(([english, translations]) => (
      english.length >= 4 &&
      english.length <= 96 &&
      translations[locale] &&
      /[A-Za-z]/.test(english)
    ))
    .sort(([left], [right]) => right.length - left.length)
    .map(([english, translations]) => [english, translations[locale] as string] as const);
  fragmentRowsByLocale.set(locale, rows);
  return rows;
}

export function translateCatalog(
  source: string,
  locale: LocaleCode,
  variables: Record<string, string | number> = {}
): string {
  const canonical = String(source ?? "");
  if (!canonical || locale === fallbackLocale) return replaceVariables(canonical, variables);
  const clean = canonical.trim().replace(/\s+/g, " ");
  const exact = catalog.messages[clean]?.[locale];
  if (exact) return preserveWhitespace(canonical, replaceVariables(exact, variables));

  if (clean.includes(" · ")) {
    const parts = clean.split(" · ");
    const translatedParts: string[] = parts.map((part: string) => translateCatalog(part, locale));
    if (translatedParts.some((part, index) => part !== parts[index])) {
      return preserveWhitespace(canonical, translatedParts.join(" · "));
    }
  }

  let output = clean;
  for (const [english, translated] of fragmentRows(locale)) {
    if (!output.includes(english)) continue;
    output = output.replace(boundaryPattern(english), translated);
  }
  return preserveWhitespace(canonical, replaceVariables(output, variables));
}

function shouldSkip(element: Element) {
  return element.matches("script,style,code,pre,[data-no-translate]") ||
    Boolean(element.closest("[data-no-translate]"));
}

function localizeTextNode(node: Text, locale: LocaleCode) {
  const previousRendered = renderedText.get(node);
  if (!originalText.has(node) || (previousRendered != null && node.data !== previousRendered)) {
    originalText.set(node, node.data);
  }
  const translated = translateCatalog(originalText.get(node) ?? node.data, locale);
  if (node.data !== translated) node.data = translated;
  renderedText.set(node, translated);
}

function localizeAttribute(element: Element, name: string, locale: LocaleCode) {
  const current = element.getAttribute(name);
  if (!current) return;
  const originals = originalAttributes.get(element) ?? {};
  const rendered = renderedAttributes.get(element) ?? {};
  if (!originals[name] || (rendered[name] != null && current !== rendered[name])) originals[name] = current;
  const translated = translateCatalog(originals[name], locale);
  if (current !== translated) element.setAttribute(name, translated);
  rendered[name] = translated;
  originalAttributes.set(element, originals);
  renderedAttributes.set(element, rendered);
}

function localizeElement(element: Element, locale: LocaleCode) {
  if (shouldSkip(element)) return;
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) localizeTextNode(child as Text, locale);
  }
  for (const name of ["aria-label", "placeholder", "title", "data-tooltip"]) {
    localizeAttribute(element, name, locale);
  }
}

function localizeDocument(locale: LocaleCode) {
  for (const element of document.body.querySelectorAll("*")) localizeElement(element, locale);
  const root = document.documentElement;
  if (!root.dataset.i18nTitleSource) root.dataset.i18nTitleSource = document.title;
  document.title = translateCatalog(root.dataset.i18nTitleSource, locale);
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="description"]')) {
    if (!meta.dataset.i18nContentSource) meta.dataset.i18nContentSource = meta.content;
    meta.content = translateCatalog(meta.dataset.i18nContentSource, locale);
  }
}

function preserveLocaleInLinks(locale: LocaleCode) {
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>("a[href]:not([data-no-locale])")) {
    const raw = anchor.getAttribute("href");
    if (!raw || /^(#|mailto:|tel:|javascript:)/.test(raw)) continue;
    let target: URL;
    try {
      target = new URL(raw, window.location.href);
    } catch {
      continue;
    }
    if (target.origin !== window.location.origin) continue;
    target.searchParams.set("lang", locale);
    if (anchor.href !== target.href) anchor.href = target.href;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(resolveInitialLocale);
  const language = catalog.locales.find((item) => item.code === locale) ?? catalog.locales[0];
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = language.dir;
  }

  const setLocale = useCallback((nextLocale: LocaleCode) => {
    if (!isLocale(nextLocale)) return;
    setLocaleState(nextLocale);
    writeStoredLocale(nextLocale);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const t = useCallback(
    (source: string, variables: Record<string, string | number> = {}) =>
      translateCatalog(source, locale, variables),
    [locale]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = language.dir;
    document.body.classList.toggle("is-rtl", language.dir === "rtl");
    localizeDocument(locale);
    preserveLocaleInLinks(locale);

    let animationFrame: number | null = null;
    const observer = new MutationObserver(() => {
      if (animationFrame != null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        localizeDocument(locale);
        preserveLocaleInLinks(locale);
      });
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "placeholder", "title", "data-tooltip", "href"]
    });
    window.dispatchEvent(new CustomEvent("sgp:localechange", { detail: { locale, language } }));
    return () => {
      observer.disconnect();
      if (animationFrame != null) window.cancelAnimationFrame(animationFrame);
    };
  }, [language, locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    language,
    languages: catalog.locales,
    setLocale,
    t,
    formatNumber
  }), [formatNumber, language, locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export function LanguageSelect({ className = "" }: { className?: string }) {
  const { language, languages, locale, setLocale, t } = useI18n();
  return (
    <label className={`dashboard-language-control ${className}`.trim()} data-no-translate>
      <span className="sr-only">{t("Select language")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as LocaleCode)}
        aria-label={t("Select language")}
        title={`${t("Select language")}: ${language.nativeLabel}`}
        dir="ltr"
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code} lang={item.code} dir="ltr">
            {item.short} · {item.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
