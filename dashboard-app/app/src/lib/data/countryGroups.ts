export type CountryGroupOption = {
  key: string;
  label: string;
  group: "Groups" | "Economy" | "HDI" | "SIDS regions" | "UN groups";
  className: string;
  sourceField: string;
  sourceValue: string;
  iso3: readonly string[];
};

export const COUNTRY_GROUP_OPTIONS = [
  {
    key: "group-sids",
    label: "SIDS",
    group: "Groups",
    className: "atlas-region-tab--country-group",
    sourceField: "SIDS",
    sourceValue: "SIDS",
    iso3: ["BHR", "BLZ", "BRB", "COM", "CPV", "CUB", "DOM", "FJI", "GNB", "GUY", "HTI", "KIR", "MDV", "MUS", "NRU", "PNG", "SLB", "STP", "SUR", "TKL", "TLS", "TON", "TTO", "TUV", "VUT", "WSM"]
  },
  {
    key: "group-ldc",
    label: "LDCs",
    group: "Groups",
    className: "atlas-region-tab--country-group",
    sourceField: "LDC",
    sourceValue: "LDC",
    iso3: ["AFG", "AGO", "BDI", "BEN", "BFA", "BGD", "BTN", "CAF", "COD", "COM", "DJI", "ERI", "GIN", "GMB", "GNB", "HTI", "KHM", "KIR", "LAO", "LBR", "LSO", "MDG", "MLI", "MMR", "MOZ", "MRT", "MWI", "NER", "NPL", "RWA", "SDN", "SEN", "SLB", "SLE", "SOM", "SSD", "STP", "TCD", "TGO", "TLS", "TUV", "TZA", "UGA", "YEM", "ZMB"]
  },
  {
    key: "group-lldc",
    label: "LLDCs",
    group: "Groups",
    className: "atlas-region-tab--country-group",
    sourceField: "LLDC",
    sourceValue: "LLDC",
    iso3: ["AFG", "ARM", "AZE", "BDI", "BFA", "BOL", "BTN", "BWA", "CAF", "ETH", "KAZ", "LAO", "LSO", "MDA", "MKD", "MLI", "MNG", "MWI", "NER", "NPL", "PRY", "RWA", "SSD", "SWZ", "TCD", "TJK", "TKM", "UGA", "UZB", "ZMB", "ZWE"]
  },
  {
    key: "group-sahel",
    label: "Sahel",
    group: "Groups",
    className: "atlas-region-tab--country-group",
    sourceField: "Sahel",
    sourceValue: "Sahel",
    iso3: ["BFA", "CMR", "GIN", "GMB", "MLI", "MRT", "NER", "NGA", "SEN", "TCD"]
  },
  {
    key: "group-crisis",
    label: "Crisis",
    group: "Groups",
    className: "atlas-region-tab--country-group",
    sourceField: "Crisis",
    sourceValue: "Crisis",
    iso3: ["AFG", "BFA", "CAF", "COD", "HTI", "IRQ", "LBN", "LBY", "MLI", "MMR", "NER", "PSE", "SDN", "SOM", "SSD", "SYR", "TCD", "UKR", "YEM"]
  },
  {
    key: "income-low",
    label: "Low income",
    group: "Economy",
    className: "atlas-region-tab--economy",
    sourceField: "Economy",
    sourceValue: "Low income",
    iso3: ["BDI", "BFA", "CAF", "COD", "ERI", "ETH", "GIN", "GMB", "GNB", "LBR", "MDG", "MLI", "MOZ", "MWI", "NER", "RWA", "SDN", "SLE", "SOM", "SSD", "SYR", "TCD", "TGO", "UGA", "VEN", "ZMB"]
  },
  {
    key: "income-lower-middle",
    label: "Lower-mid",
    group: "Economy",
    className: "atlas-region-tab--economy",
    sourceField: "Economy",
    sourceValue: "Lower middle income",
    iso3: ["AGO", "BEN", "BGD", "BOL", "BTN", "CIV", "CMR", "COG", "COM", "CPV", "DJI", "DZA", "EGY", "GHA", "HND", "HTI", "IDN", "IND", "IRN", "KEN", "KGZ", "KHM", "KIR", "LAO", "LBN", "LKA", "LSO", "MAR", "MMR", "MNG", "MRT", "NGA", "NPL", "PAK", "PHL", "PNG", "PSE", "SEN", "SLB", "SLV", "STP", "SWZ", "TJK", "TLS", "TUN", "TZA", "UKR", "UZB", "VNM", "VUT", "WSM", "YEM", "ZWE"]
  },
  {
    key: "income-upper-middle",
    label: "Upper-mid",
    group: "Economy",
    className: "atlas-region-tab--economy",
    sourceField: "Economy",
    sourceValue: "Upper middle income",
    iso3: ["AFG", "ALB", "ARG", "ARM", "AZE", "BIH", "BLR", "BLZ", "BRA", "BWA", "CHN", "COL", "CRI", "CUB", "DOM", "ECU", "FJI", "GAB", "GEO", "GNQ", "GTM", "GUY", "IRQ", "JAM", "JOR", "KAZ", "LBY", "MDA", "MDV", "MEX", "MKD", "MNE", "MUS", "MYS", "NAM", "NRU", "PER", "PRY", "SRB", "SUR", "THA", "TKM", "TUR", "TUV", "XKX", "ZAF"]
  },
  {
    key: "income-high",
    label: "High income",
    group: "Economy",
    className: "atlas-region-tab--economy",
    sourceField: "Economy",
    sourceValue: "High income",
    iso3: ["BHR", "BRB", "CHL", "CYP", "KOR", "KWT", "PAN", "SAU", "TTO", "URY"]
  },
  {
    key: "hdi-low",
    label: "Low HDI",
    group: "HDI",
    className: "atlas-region-tab--hdi",
    sourceField: "HDI",
    sourceValue: "Low",
    iso3: ["AFG", "BDI", "BEN", "BFA", "CAF", "COD", "DJI", "ERI", "ETH", "GIN", "GMB", "GNB", "HTI", "LBR", "LSO", "MDG", "MLI", "MOZ", "MWI", "NER", "NGA", "PAK", "RWA", "SDN", "SEN", "SLE", "SSD", "TCD", "TGO", "TZA", "UGA", "YEM"]
  },
  {
    key: "hdi-medium",
    label: "Medium HDI",
    group: "HDI",
    className: "atlas-region-tab--hdi",
    sourceField: "HDI",
    sourceValue: "Medium",
    iso3: ["AGO", "BGD", "BLZ", "BOL", "BTN", "BWA", "CIV", "CMR", "COG", "COM", "CPV", "GHA", "GNQ", "GTM", "HND", "IND", "IRQ", "KEN", "KGZ", "KHM", "KIR", "LAO", "MAR", "MMR", "MRT", "NAM", "NPL", "NRU", "PHL", "PNG", "SLB", "SLV", "STP", "SWZ", "SYR", "TJK", "TLS", "TUV", "VEN", "VUT", "ZMB", "ZWE"]
  },
  {
    key: "hdi-high",
    label: "High HDI",
    group: "HDI",
    className: "atlas-region-tab--hdi",
    sourceField: "HDI",
    sourceValue: "High",
    iso3: ["ALB", "ARM", "AZE", "BIH", "BRA", "BRB", "CHN", "COL", "CUB", "DOM", "DZA", "ECU", "EGY", "FJI", "GAB", "GUY", "IDN", "IRN", "JAM", "JOR", "LBN", "LBY", "LKA", "MDA", "MDV", "MEX", "MKD", "MNG", "PER", "PRY", "PSE", "SUR", "TKM", "TUN", "UKR", "UZB", "VNM", "WSM", "ZAF"]
  },
  {
    key: "hdi-very-high",
    label: "Very high HDI",
    group: "HDI",
    className: "atlas-region-tab--hdi",
    sourceField: "HDI",
    sourceValue: "Very High",
    iso3: ["ARG", "BHR", "BLR", "CHL", "CRI", "CYP", "GEO", "KAZ", "KWT", "MNE", "MUS", "MYS", "PAN", "SAU", "SRB", "THA", "TTO", "TUR", "URY"]
  },
  {
    key: "sids-caribbean",
    label: "Carib SIDS",
    group: "SIDS regions",
    className: "atlas-region-tab--sids-region",
    sourceField: "sids-region",
    sourceValue: "Caribbean",
    iso3: ["ABW", "AIA", "ATG", "BHS", "BLZ", "BMU", "BRB", "CRI", "CUB", "CUW", "CYM", "DMA", "DOM", "GLP", "GRD", "GUY", "HTI", "JAM", "KNA", "LCA", "MSR", "MTQ", "PRI", "SUR", "SXM", "TCA", "TTO", "VCT", "VGB"]
  },
  {
    key: "sids-pacific",
    label: "Pacific SIDS",
    group: "SIDS regions",
    className: "atlas-region-tab--sids-region",
    sourceField: "sids-region",
    sourceValue: "Pacific",
    iso3: ["ASM", "COK", "FJI", "FSM", "GUM", "KIR", "MHL", "MNP", "NCL", "NIU", "NRU", "PLW", "PNG", "PYF", "SLB", "TKL", "TLS", "TON", "TUV", "VUT", "WSM"]
  },
  {
    key: "sids-ais",
    label: "AIS SIDS",
    group: "SIDS regions",
    className: "atlas-region-tab--sids-region",
    sourceField: "sids-region",
    sourceValue: "AIS",
    iso3: ["BHR", "COM", "CPV", "GNB", "MDV", "MUS", "SGP", "STP", "SYC"]
  },
  {
    key: "un-african-group",
    label: "UN Africa",
    group: "UN groups",
    className: "atlas-region-tab--un-group",
    sourceField: "un-region",
    sourceValue: "African Group",
    iso3: ["AGO", "ATF", "BDI", "BEN", "BFA", "BWA", "CAF", "CIV", "CMR", "COD", "COG", "COM", "CPV", "DJI", "DZA", "EGY", "ERI", "ESH", "ETH", "GAB", "GHA", "GIN", "GMB", "GNB", "GNQ", "IOT", "KEN", "LBR", "LBY", "LSO", "MAR", "MDG", "MLI", "MOZ", "MRT", "MUS", "MWI", "MYT", "NAM", "NER", "NGA", "REU", "RWA", "SDN", "SEN", "SLE", "SOM", "SSD", "STP", "SWZ", "SYC", "TCD", "TGO", "TUN", "TZA", "UGA", "ZAF", "ZMB", "ZWE"]
  },
  {
    key: "un-asia-pacific-group",
    label: "UN Asia-Pacific",
    group: "UN groups",
    className: "atlas-region-tab--un-group",
    sourceField: "un-region",
    sourceValue: "Asia-Pacific Group",
    iso3: ["AFG", "ARE", "ASM", "BGD", "BHR", "BRN", "BTN", "CCK", "CHN", "COK", "CXR", "CYP", "FJI", "FSM", "GUM", "HKG", "HMD", "IDN", "IND", "IRN", "IRQ", "JOR", "JPN", "KAZ", "KGZ", "KHM", "KIR", "KOR", "KWT", "LAO", "LBN", "LKA", "MAC", "MDV", "MHL", "MMR", "MNG", "MNP", "MYS", "NCL", "NFK", "NIU", "NPL", "NRU", "OMN", "PAK", "PCN", "PHL", "PLW", "PNG", "PRK", "PYF", "QAT", "SAU", "SGP", "SLB", "SYR", "THA", "TJK", "TKL", "TKM", "TLS", "TON", "TUR", "TUV", "UMI", "UZB", "VNM", "VUT", "WLF", "WSM", "YEM"]
  },
  {
    key: "un-grulac",
    label: "GRULAC",
    group: "UN groups",
    className: "atlas-region-tab--un-group",
    sourceField: "un-region",
    sourceValue: "GRULAC",
    iso3: ["ABW", "AIA", "ARG", "ATG", "BES", "BHS", "BLM", "BLZ", "BMU", "BOL", "BRA", "BRB", "BVT", "CHL", "COL", "CRI", "CUB", "CUW", "CYM", "DMA", "DOM", "ECU", "FLK", "GLP", "GRD", "GTM", "GUF", "GUY", "HND", "HTI", "JAM", "KNA", "LCA", "MAF", "MEX", "MSR", "MTQ", "NIC", "PAN", "PER", "PRI", "PRY", "SGS", "SLV", "SUR", "SXM", "TCA", "TTO", "URY", "VCT", "VEN", "VGB", "VIR"]
  },
  {
    key: "un-eastern-european-group",
    label: "UN Eastern Europe",
    group: "UN groups",
    className: "atlas-region-tab--un-group",
    sourceField: "un-region",
    sourceValue: "Eastern European Group",
    iso3: ["ALB", "ARM", "AZE", "BGR", "BIH", "BLR", "CZE", "EST", "GEO", "HRV", "HUN", "LTU", "LVA", "MDA", "MKD", "MNE", "POL", "ROU", "RUS", "SRB", "SVK", "SVN", "UKR", "XKX"]
  },
  {
    key: "un-weog",
    label: "WEOG",
    group: "UN groups",
    className: "atlas-region-tab--un-group",
    sourceField: "un-region",
    sourceValue: "WEOG",
    iso3: ["ALA", "AND", "AUS", "AUT", "BEL", "CAN", "CHE", "DEU", "DNK", "ESP", "FIN", "FRA", "FRO", "GBR", "GGY", "GIB", "GRC", "GRL", "IMN", "IRL", "ISL", "ISR", "ITA", "JEY", "LIE", "LUX", "MCO", "MLT", "NLD", "NOR", "NZL", "PRT", "PSE", "SJM", "SMR", "SWE", "USA", "VAT"]
  }
] as const satisfies readonly CountryGroupOption[];

export const COUNTRY_GROUP_LABELS: Map<string, string> = new Map(COUNTRY_GROUP_OPTIONS.map((option) => [option.key, option.label]));
const COUNTRY_GROUP_ISO3: Map<string, Set<string>> = new Map(COUNTRY_GROUP_OPTIONS.map((option) => [option.key, new Set<string>(option.iso3)]));

export function isCountryGroupKey(key: string) {
  return COUNTRY_GROUP_ISO3.has(key);
}

export function countryGroupContains(key: string, iso3: string | null | undefined) {
  return Boolean(iso3 && COUNTRY_GROUP_ISO3.get(key)?.has(iso3));
}

export function matchesRegionOrCountryGroup(selectedRegions: Set<string>, regionId: string, countryIso3: string | null | undefined) {
  if (selectedRegions.size === 0) return true;
  for (const selected of selectedRegions) {
    if (selected === regionId || countryGroupContains(selected, countryIso3)) {
      return true;
    }
  }
  return false;
}
