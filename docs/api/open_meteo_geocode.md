# open_meteo_geocode

Open-Meteo geocoding API (search only; no reverse).

## Endpoint

`GET https://geocoding-api.open-meteo.com/v1/search?name=..&count=5&language=es`

## Sample response

See `tests/fixtures/providers/open_meteo_geocode/sample.json` for query `Termas de Rio Hondo`.

## Limits

Shared Open-Meteo free tier (e.g. 600/min). Cache on disk.

## License / attribution

- Open-Meteo CC BY 4.0
- Geocoding by Open-Meteo.com (CC BY 4.0)

## Docs

https://open-meteo.com/en/docs/geocoding-api
