# References

Every external data source, library, font and AI tool TermalWave uses. Paste the short form into the project page "References" field. Endpoints come from `config/apis.toml`, libraries from `web/package.json` and `config/runtime.json`, artwork from `brand/CREDITS.md`.

## NASA data and services

| Resource | Used for | Link | Terms |
|---|---|---|---|
| NISAR L2 GCOV (`NISAR_L2_GCOV_V1`, `_PROVISIONAL_V1`, `_BETA_V1`) | Radar backscatter, core layer | https://nisar-docs.asf.alaska.edu/ | NASA open data |
| NISAR L2 GUNW | Interferogram input to `nisar_raster.py` (line-of-sight motion) | https://nisar-docs.asf.alaska.edu/ | NASA open data |
| NASA CMR granule search | NISAR coverage per area | https://cmr.earthdata.nasa.gov/search/granules.json | NASA open data |
| NASA Earthdata Search | Data discovery | https://search.earthdata.nasa.gov/search | NASA open data |
| ASF Data Search Vertex / ASF DAAC | NISAR distribution | https://search.asf.alaska.edu/ | NASA open data |
| NASA FIRMS (VIIRS S-NPP SP and NRT, MODIS SP) | Active fire detections | https://firms.modaps.eosdis.nasa.gov/ | NASA FIRMS, MAP_KEY required |
| NASA GIBS (MODIS Terra and VIIRS S-NPP corrected reflectance, Blue Marble) | Imagery basemaps | https://gibs.earthdata.nasa.gov/ | NASA open data |
| NASA JPL Horizons | Sun and Moon positions | https://ssd.jpl.nasa.gov/api/horizons.api | NASA open data |

Learning material from the challenge Resources tab: Intro to Remote Sensing (https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/remote-sensing), Intro to SAR (https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar), NISAR StoryMaps (https://nisar.jpl.nasa.gov/applications/arcgis-storymaps/), NISAR Applications White Papers (https://nisar.jpl.nasa.gov/applications/societal-benefit/).

## Other data and services

| Resource | Used for | Link | Terms |
|---|---|---|---|
| NOAA nowCOAST, NESDIS global IR mosaic | Clouds | https://nowcoast.noaa.gov/ | US public domain |
| CelesTrak GP elements | Satellite orbits | https://celestrak.org/ | CelesTrak terms |
| Open-Meteo forecast, archive, elevation, geocoding | Wind, weather, elevation, place search | https://open-meteo.com/ | CC BY 4.0 |
| Microsoft Planetary Computer, Sentinel-2 L2A | Optical imagery | https://planetarycomputer.microsoft.com/ | Copernicus Sentinel data terms |
| EOX Sentinel-2 cloudless 2025 | Basemap | https://cloudless.eox.at/ | CC BY 4.0, contains modified Copernicus Sentinel data 2025 |
| CARTO basemaps (Voyager, Dark Matter) | Basemap | https://carto.com/basemaps/ | CARTO terms, OpenStreetMap data |
| OpenFreeMap (Liberty) | Basemap | https://openfreemap.org/ | OpenStreetMap data (ODbL) |
| Photon (komoot) | Place search | https://photon.komoot.io/ | OpenStreetMap data (ODbL) |
| Nominatim | Place search | https://nominatim.openstreetmap.org/ | OSMF usage policy, ODbL |
| OpenTopoData SRTM 30 m | Elevation fallback | https://www.opentopodata.org/ | SRTM public domain |
| Natural Earth Admin 0 | Country shapes in the brand globe | https://www.naturalearthdata.com/ | Public domain |

Configured but optional (only used when a key is set): Meteomatics, AISStream, OpenSky Network, TomTom Traffic, Google Places, Cesium ion terrain.

Space agency partner data: none.

## Software

| Library | Version | Licence |
|---|---|---|
| React, React DOM | 18.3 | MIT |
| MapLibre GL JS | 5.x | BSD-3-Clause |
| satellite.js | 6.x | MIT |
| gl-matrix | 3.4 | MIT |
| lucide-react | 1.x | ISC |
| TypeScript | 5.8 | Apache-2.0 |
| Vite | 6.x | MIT |
| numpy | 2.2.6 | BSD-3-Clause |
| h5py | 3.14.0 | BSD-3-Clause |
| Pillow | 12.2.0 | MIT-CMU (HPND) |
| Cloudflare Workers (Wrangler) | n/a | Cloudflare terms |

## Fonts and artwork

- Press Start 2P, SIL Open Font License 1.1 (`brand/fonts/OFL.txt`).
- IBM Plex Sans and IBM Plex Mono, SIL Open Font License 1.1 (`web/src/fonts/OFL-IBMPlex.txt`).
- TermalWave icon and wordmarks: original pixel art by the team (`brand/CREDITS.md`).
- Wizard character: AI-generated, marked "AI" (`brand/monigote/monigote-si.png`).

## AI tools

- Claude Code (Anthropic): code, refactors, tests, documentation.
- Cursor agents: code assistance and project hooks.
- Grok (xAI): agent work on the server and code.
- An image generation model: brand concept studies (not shipped) and the wizard picture (shipped with an "AI" mark). The team should name the exact model in the form.

## Short form for the project page

NISAR L2 GCOV and GUNW via NASA Earthdata CMR and ASF DAAC; NISAR Data User Guide; NASA FIRMS; NASA GIBS; NASA JPL Horizons; NOAA nowCOAST; CelesTrak; Open-Meteo (CC BY 4.0); Microsoft Planetary Computer Sentinel-2; EOX Sentinel-2 cloudless; CARTO; OpenFreeMap; OpenStreetMap via Photon and Nominatim (ODbL); OpenTopoData SRTM; Natural Earth; React; MapLibre GL JS; satellite.js; gl-matrix; lucide-react; Vite; TypeScript; numpy; h5py; Pillow; Cloudflare Workers; Press Start 2P and IBM Plex (OFL 1.1); AI tools: Claude Code, Cursor, Grok, an image generator for the marked wizard.
