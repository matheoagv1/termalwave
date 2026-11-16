# open_meteo_elevation

Elevation via Open-Meteo (Copernicus GLO-90 DEM).

## Endpoint

`GET https://api.open-meteo.com/v1/elevation?latitude=..&longitude=..`

Batch: up to 100 points, comma-separated latitudes/longitudes.

## Sample response

```json
{ "elevation": [267.0] }
```

Fixture point: Termas de Río Hondo (-27.4959, -64.8641) → ~267 m.

## Limits (free, non-commercial)

- 600 requests / minute
- 5000 / hour
- 10000 / day

## License / attribution

- License: Open-Meteo / Copernicus DEM CC BY 4.0
- Attribution: Elevation data by Open-Meteo.com (CC BY 4.0), Copernicus DEM

## Docs

https://open-meteo.com/en/docs/elevation-api
