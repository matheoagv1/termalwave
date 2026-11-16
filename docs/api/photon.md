# photon

Geocoding via Photon (Komoot) on OpenStreetMap data.

## Endpoints

- Search: `GET https://photon.komoot.io/api/?q=..&limit=5`
- Reverse: `GET https://photon.komoot.io/reverse?lat=..&lon=..`

GeoJSON features; coordinates are `[lon, lat]`.

## Sample (search "Termas de Rio Hondo")

See `tests/fixtures/providers/photon_search/sample.json`.

## Limits

Fair use only. App-wide rate limit from `config/apis.toml` (default 1/s). Results cached on disk.

## License / attribution

- ODbL (OpenStreetMap)
- © OpenStreetMap contributors (via Photon/Komoot)

## Docs

https://github.com/komoot/photon
