import { expect, test } from "@playwright/test";

test("dashboard loads and supports core interactions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Portfolio intelligence atlas" })).toBeVisible();
  await expect(page.getByLabel("Key performance indicators").getByText("Grants", { exact: true })).toBeVisible();
  await expect(page.locator(".map-svg")).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Visualization views" }).getByRole("button", { name: /Partners/ })).toBeVisible();
  await expect(page.locator(".atlas-context-card--workspace .sgp-view-tabs")).toHaveCount(1);
  await expect(page.locator(".sgp-analysis-tray")).toHaveCount(0);
  await expect(page.locator(".sgp-nl-search > .sgp-filter-popover--ai")).toHaveCount(0);
  await expect(page.locator(".sgp-nl-search .sgp-ai-active-filters")).toHaveCount(0);
  await expect(page.locator(".atlas-filter-console__assistant > .sgp-ai-active-filters")).toHaveCount(1);
  await expect(page.getByLabel("Grant year range")).toBeVisible();
  await expect(page.locator(".atlas-filter-band .sgp-filter-popover--advanced")).toHaveCount(1);
  await expect(page.locator(".sgp-toolbar-inline .sgp-filter-popover")).toHaveCount(0);
  await expect(page.getByLabel("Region filter").getByRole("button", { name: /^SIDS\b/ })).toHaveCount(0);
  await expect(page.getByLabel("Focal area filters").getByRole("button", { name: "All focal areas", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Focal area filters").getByRole("button", { name: "Missing", exact: true })).toHaveCount(0);
  await page.locator(".sgp-filter-popover--advanced > summary").click();
  await expect(page.locator(".sgp-filter-popover--advanced").getByText("Groups", { exact: true })).toBeVisible();
  await expect(page.locator(".sgp-filter-popover--advanced").getByText("SIDS", { exact: true })).toBeVisible();
  await page.locator(".sgp-filter-popover--advanced > summary").click();

  await page.getByLabel("Region filter").getByRole("button", { name: /^Africa\b/ }).click();
  await expect(page.getByLabel("Active filters").getByRole("button", { name: "Region: RBA" })).toBeVisible();
  await page.waitForTimeout(900);
  await page.locator('.map-svg path.country[data-iso3="COD"]').click();
  await expect(page.getByLabel("Active filters").getByRole("button", { name: "Country: COD" })).toBeVisible();
  await expect(page.locator(".map-legend-card--choropleth").getByText("Grant distribution")).toBeVisible();
  await page.getByLabel("Active filters").getByRole("button", { name: "Country: COD" }).click();
  await expect(page.getByLabel("Active filters").getByRole("button", { name: "Country: COD" })).toHaveCount(0);
  await page.getByLabel("Focal area filters").getByRole("button", { name: "Biodiversity", exact: true }).click();
  await expect(page.getByLabel("Active filters").getByRole("button", { name: "Focal area: Biodiversity" })).toBeVisible();
  await page.getByLabel("Focal area filters").getByRole("button", { name: "Biodiversity", exact: true }).click();
  await expect(page.getByLabel("Active filters").getByRole("button", { name: "Focal area: Biodiversity" })).toHaveCount(0);

  await page.getByLabel("Natural-language filter query").fill("active biodiversity projects in RBA after 2020");
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(page.getByText("Query plan")).toBeVisible();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByLabel("Active filters").getByRole("button", { name: "Region: RBA" })).toBeVisible();
  await expect(page.getByLabel("Active filters").getByRole("button", { name: "Years: 2021-2026" })).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("dialog", { name: "Export dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filtered projects CSV" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export dashboard" })).toHaveCount(0);

  await page.getByRole("button", { name: /Themes/ }).click();
  await expect(page.getByRole("img", { name: "Focal area donut chart" })).toBeVisible();
  await expect(page.getByLabel("Theme legend").getByRole("button", { name: /Missing/ })).toHaveCount(0);

  await page.getByRole("button", { name: /Records/ }).click();
  await expect(page.getByRole("heading", { name: "Filtered project records" })).toBeVisible();
  await page.locator(".project-row").first().click();
  await expect(page.getByLabel("Project detail drawer")).toBeVisible();
});
