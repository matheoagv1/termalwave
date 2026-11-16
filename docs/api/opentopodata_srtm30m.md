# opentopodata_srtm30m

Elevation via OpenTopoData SRTM 30 m.

## Endpoint

`GET https://api.opentopodata.org/v1/srtm30m?locations=lat,lon|lat,lon`

Max 100 points per request.

## Sample response

```json
{
  "results": [
    {
      "dataset": "srtm30m",
      "elevation": 271.0,
      "location": { "lat": -27.4959, "lng": -64.8641 }
    }
  ],
  "status": "OK"
}
```

## Limits

- 1 request / second
- 1000 / day (public instance)

## License / attribution

- License: SRTM NASA/USGS via OpenTopoData
- Attribution: Elevation from SRTM (NASA/USGS) via OpenTopoData

## Docs

https://www.opentopodata.org/
