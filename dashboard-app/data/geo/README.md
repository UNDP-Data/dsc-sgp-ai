# GeoJSON files for choropleths

Place country or administrative boundary GeoJSON files here.

Recommended filename:

- `world-countries.geojson`

Recommended feature properties:

- `ADMIN`
- `NAME`
- `NAME_LONG`
- `ISO_A3`
- `ISO_A2`
- `SOVEREIGNT`
- `REGION_UN`
- `SUBREGION`

The dashboard should support flexible property mapping because country GeoJSON schemas vary.

No GeoJSON file was included in the uploaded source materials available to this package. Codex should use files added to this directory if present. If none are present, Codex should implement a documented fallback using a reliable public world-country geometry source or package and generate a local GeoJSON artifact for the app.
