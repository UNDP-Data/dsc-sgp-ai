import { describe, expect, it } from "vitest";
import catalog from "../../../assets/i18n-catalog.json";
import { localeCodes, resolveInitialLocale, translateCatalog } from "./i18n";

describe("technical demo internationalization", () => {
  it("resolves explicit, saved, and browser locales in precedence order", () => {
    expect(resolveInitialLocale("?lang=ar", "/dashboard/", "fr", "es-ES")).toBe("ar");
    expect(resolveInitialLocale("", "/pt/dashboard/", "fr", "es-ES")).toBe("pt");
    expect(resolveInitialLocale("", "/dashboard/", "zh", "es-ES")).toBe("zh");
    expect(resolveInitialLocale("", "/dashboard/", null, "ru-RU")).toBe("ru");
    expect(resolveInitialLocale("", "/dashboard/", null, "de-DE")).toBe("en");
  });

  it("translates exact and compound interface labels", () => {
    expect(translateCatalog("Query plan", "fr")).toBe("Plan de requête");
    expect(translateCatalog("Ready · 12 documents", "es")).toContain("Listo");
    expect(translateCatalog("Ready · 12 documents", "es")).toContain("documentos");
  });

  it("preserves unsupported content and interpolates variables", () => {
    expect(translateCatalog("A source title outside the catalog", "zh"))
      .toBe("A source title outside the catalog");
    expect(translateCatalog("Items: {count}", "ar", { count: 14 })).toBe("Items: 14");
  });

  it("keeps every generated message complete across supported locales", () => {
    for (const translations of Object.values(catalog.messages)) {
      for (const locale of localeCodes) {
        expect(translations[locale as keyof typeof translations]).toBeTruthy();
      }
    }
  });
});
