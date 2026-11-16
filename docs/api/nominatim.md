# nominatim

OpenStreetMap Nominatim geocoder.

## Endpoints

- Search: `GET https://nominatim.openstreetmap.org/search?q=..&format=jsonv2`
- Reverse: `GET https://nominatim.openstreetmap.org/reverse?lat=..&lon=..&format=jsonv2`

## Requirements

- Identifying `User-Agent` from config (e.g. `TermalWave/0.1 (+https://termalwave.space)`)
- Max 1 request / second app-wide
- Cache results; no client-side autocomplete

## Sample

See `tests/fixtures/providers/nominatim_search/sample.json` and `nominatim_reverse/sample.json` (Termas de Río Hondo).

## License / attribution

- ODbL (OpenStreetMap)
- © OpenStreetMap contributors (Nominatim) — https://www.openstreetmap.org/copyright

## Docs

https://nominatim.org/release-docs/latest/api/Overview/
