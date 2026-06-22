export type GeoFeatureLike = {
  properties?: Record<string, unknown>;
};

export type CountryMatch = {
  iso3: string | null;
  status: "matched" | "alias" | "unmapped";
  canonicalName: string;
};

export const COUNTRY_ALIASES: Record<string, string> = {
  "BOLIVIA": "BOL",
  "BOLIVIA PLURINATIONAL STATE OF": "BOL",
  "CONGO DEMOCRATIC REPUBLIC OF THE": "COD",
  "CONGO THE DEMOCRATIC REPUBLIC OF THE": "COD",
  "DEMOCRATIC REPUBLIC OF CONGO": "COD",
  "DEMOCRATIC REPUBLIC OF THE CONGO": "COD",
  "DR CONGO": "COD",
  "REPUBLIC OF CONGO": "COG",
  "CONGO": "COG",
  "IRAN": "IRN",
  "IRAN ISLAMIC REPUBLIC OF": "IRN",
  "TANZANIA": "TZA",
  "TANZANIA UNITED REPUBLIC OF": "TZA",
  "UNITED REPUBLIC OF TANZANIA": "TZA",
  "VIET NAM": "VNM",
  "VIETNAM": "VNM",
  "TURKIYE": "TUR",
  "TURKEY": "TUR",
  "COTE DIVOIRE": "CIV",
  "IVORY COAST": "CIV",
  "LAO PEOPLES DEMOCRATIC REPUBLIC": "LAO",
  "LAO PDR": "LAO",
  "LAOS": "LAO",
  "MOLDOVA": "MDA",
  "MOLDOVA REPUBLIC OF": "MDA",
  "REPUBLIC OF MOLDOVA": "MDA",
  "SYRIA": "SYR",
  "SYRIAN ARAB REPUBLIC": "SYR",
  "VENEZUELA": "VEN",
  "VENEZUELA BOLIVARIAN REPUBLIC OF": "VEN",
  "PALESTINE": "PSE",
  "PALESTINE STATE OF": "PSE",
  "STATE OF PALESTINE": "PSE",
  "MICRONESIA": "FSM",
  "MICRONESIA FEDERATED STATES OF": "FSM",
  "FEDERATED STATES OF MICRONESIA": "FSM",
  "KOREA DEMOCRATIC PEOPLES REPUBLIC OF": "PRK",
  "DEMOCRATIC PEOPLES REPUBLIC OF KOREA": "PRK",
  "NORTH KOREA": "PRK",
  "KOREA REPUBLIC OF": "KOR",
  "REPUBLIC OF KOREA": "KOR",
  "SOUTH KOREA": "KOR",
  "CABO VERDE": "CPV",
  "CAPE VERDE": "CPV",
  "ESWATINI": "SWZ",
  "SWAZILAND": "SWZ",
  "SAINT KITTS AND NEVIS": "KNA",
  "ST KITTS AND NEVIS": "KNA",
  "SAINT LUCIA": "LCA",
  "ST LUCIA": "LCA",
  "SAINT VINCENT AND THE GRENADINES": "VCT",
  "ST VINCENT AND THE GRENADINES": "VCT",
  "SAO TOME AND PRINCIPE": "STP",
  "SAO TOME PRINCIPE": "STP",
  "RUSSIA": "RUS",
  "RUSSIAN FEDERATION": "RUS",
  "KYRGYZ REPUBLIC": "KGZ",
  "KYRGYZSTAN": "KGZ",
  "BRUNEI": "BRN",
  "BRUNEI DARUSSALAM": "BRN",
  "NORTH MACEDONIA": "MKD",
  "THE FORMER YUGOSLAV REPUBLIC OF MACEDONIA": "MKD",
  "BOSNIA HERZEGOVINA": "BIH",
  "BOSNIA AND HERZEGOVINA": "BIH",
  "GAMBIA": "GMB",
  "THE GAMBIA": "GMB",
  "TIMOR LESTE": "TLS",
  "EAST TIMOR": "TLS",
  "MYANMAR": "MMR",
  "BURMA": "MMR"
};

export function normalizeCountryName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " AND ")
    .replace(/['’`]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCountryLookup(features: GeoFeatureLike[]) {
  const lookup = new Map<string, string>();
  const isoNames = new Map<string, string>();

  for (const feature of features) {
    const props = feature.properties ?? {};
    const iso3 = String(props.iso3 ?? props.ISO_A3 ?? props.ADM0_A3 ?? props.iso_a3 ?? "").trim().toUpperCase();
    if (!iso3 || iso3 === "-99") {
      continue;
    }
    const names = [
      props.name,
      props.ADMIN,
      props.NAME,
      props.NAME_LONG,
      props.SOVEREIGNT,
      props.FORMAL_EN
    ].map(normalizeText).filter(Boolean);
    const displayName = names[0] || iso3;
    isoNames.set(iso3, displayName);
    lookup.set(normalizeCountryName(iso3), iso3);
    for (const name of names) {
      lookup.set(normalizeCountryName(name), iso3);
    }
  }

  for (const [name, iso3] of Object.entries(COUNTRY_ALIASES)) {
    lookup.set(name, iso3);
  }

  return { lookup, isoNames };
}

export function matchCountry(
  value: unknown,
  lookup: Map<string, string>,
  isoNames?: Map<string, string>
): CountryMatch {
  const canonicalName = normalizeText(value);
  const normalized = normalizeCountryName(value);
  if (!normalized) {
    return { iso3: null, status: "unmapped", canonicalName };
  }
  const aliasMatch = COUNTRY_ALIASES[normalized];
  if (aliasMatch) {
    return {
      iso3: aliasMatch,
      status: "alias",
      canonicalName: isoNames?.get(aliasMatch) ?? canonicalName
    };
  }
  const directMatch = lookup.get(normalized);
  if (directMatch) {
    return {
      iso3: directMatch,
      status: "matched",
      canonicalName: isoNames?.get(directMatch) ?? canonicalName
    };
  }
  return { iso3: null, status: "unmapped", canonicalName };
}
