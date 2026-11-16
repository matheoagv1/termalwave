# TermalWave: project page fields

Paste these into the Space Apps project page. English. Check each field's length limit on the form; the challenge page states none.

## Project name

TermalWave

## Challenge

Dancing with the SARs (NASA Space Apps Challenge 2026)

## High-level summary (about 110 words)

TermalWave is a 3D globe in the browser that shows NISAR L-band radar next to fires, clouds, wind, optical imagery and satellite orbits. It answers one question: where did the ground change, and what was happening around it? NISAR radar is the core layer and cannot be turned off. A timeline moves between dates, and a curtain compares two of them. For any place on Earth the app asks NASA CMR which NISAR GCOV passes cover it. Every layer and every date carries a label: measured, derived or example, so nobody reads a sample as a measurement. The study area is Santiago del Estero, Argentina, where the team lives. The app works in English and Spanish.

## Link to the project

- App: https://termalwave.space
- Code: https://github.com/matheoagv1/termalwave (must be public or shared with judges before submitting; see CHECKLIST.md)

## How it addresses the challenge

| Objective from the challenge page | What TermalWave does |
|---|---|
| Interactive application | Globe with layer panel, timeline, two-date curtain, place search, keyboard shortcuts. |
| Uses NISAR radar data | NISAR L2 GCOV (collections `NISAR_L2_GCOV_V1`, `NISAR_L2_GCOV_PROVISIONAL_V1`, `NISAR_L2_GCOV_BETA_V1`) found through NASA CMR. `termalwave/process/nisar_raster.py` reads GCOV and GUNW HDF5, crops to the area and paints fixed dB scales. |
| Track and visualize surface change | Backscatter change is later date minus earlier date in dB on the same grid. The timeline and curtain show it over time. |
| Locations around the world | Place search works worldwide. Outside the demo area the app shows the NISAR pass list, fires, clouds and wind. The radar image is only processed for the demo area today. |
| Broad audience | Setup flow with five first views, plain-language layer detail (what it shows, what to decide, what no-data means, caveats, unit, source, date), English and Spanish. |
| Actionable insights | Each layer says what a person can decide with it. Fires and weather sit on the same globe and date as the radar. |
| Hypothesize physical drivers | The radar layer detail names drivers: flooding, clearing, new construction, and warns that moisture and roughness also change brightness. A fuller narrative belongs in the demo video. |

Potential considerations:

- Polarizations: HH and HV have their own fixed scales. The NISAR pass list shows the polarization of each granule (for example HH+HV for dual-pol granules).
- Time series: yearly ticks on the timeline, plus acquisition dates.
- Ancillary data: NASA FIRMS fires, NOAA nowCOAST clouds, Open-Meteo wind, Sentinel-2 optical.
- Human drivers: fire and land-clearing places (Iberá, Rondônia) are offered in setup.
- Personal context: the default area is the team's home province.
- Interactive summary: the curtain is an image slider between two dates; the whole app is a web map.

## How it works

1. A Python pipeline (`termalwave/`, Python 3.11, vendored numpy, h5py, Pillow) reads NISAR HDF5 granules, crops them to the area of interest using the georeference in the file, converts gamma0 to dB, and writes PNG overlays and `dataset.json`. Every layer and frame in `dataset.json` carries an honesty label.
2. A Cloudflare Worker (`preview/`) proxies NASA CMR for NISAR coverage, FIRMS, nowCOAST, CelesTrak and JPL Horizons, and caches answers.
3. The web app (`web/`, React 18, TypeScript, MapLibre GL) draws the globe, the layers in three tiers (raw data, processed data, predictions), the timeline and the About dialog with sources and references.

## Data used

NASA resources from the challenge Resources tab:

- NASA Earthdata Search and NASA CMR: NISAR L2 GCOV granule search. https://search.earthdata.nasa.gov/search
- ASF Data Search Vertex and ASF DAAC: NISAR distribution. https://search.asf.alaska.edu/
- NISAR Data User Guide: GCOV and GUNW product structure. https://nisar-docs.asf.alaska.edu/
- Intro to Synthetic Aperture Radar: polarization and scattering. https://www.earthdata.nasa.gov/learn/earth-observation-data-basics/sar

Other NASA data:

- NASA FIRMS active fires (VIIRS S-NPP, MODIS). https://firms.modaps.eosdis.nasa.gov/
- NASA GIBS imagery basemaps (MODIS Terra, VIIRS S-NPP corrected reflectance, Blue Marble). https://gibs.earthdata.nasa.gov/
- NASA JPL Horizons (Sun and Moon positions). https://ssd.jpl.nasa.gov/horizons/

Space agency partner data: none used. CSA RADARSAT data was not used.

Full list with licences: REFERENCES.md.

## Honesty note

In the build at the time of writing, the yearly radar, soil, pollution and fire tiles in `dataset.json` are labelled `example`. The app shows that label on each layer and date. The NISAR pass list is live from NASA CMR and labelled measured. If the team regenerates the dataset from the downloaded GCOV granules before submitting, update this paragraph.

## Tools

React 18, TypeScript, Vite, MapLibre GL JS, satellite.js, gl-matrix, lucide-react, Python 3.11 with numpy, h5py and Pillow, Cloudflare Workers.

## Use of AI tools (required disclosure)

We used AI coding assistants during the hackathon: Claude Code (Anthropic), Cursor agents and Grok (xAI). They helped write and refactor code, tests and documentation. People on the team chose NISAR as the core, chose the study area and data sources, designed the product and reviewed the copy in both languages. AI image generation was used for early brand concept studies (not shipped) and for the wizard character, which carries a visible "AI" mark (`brand/monigote/monigote-si.png`). No data value shown in the app was produced by an AI tool. No AI-generated asset uses NASA logos or marks. The About dialog in the app repeats this disclosure.

## Team

Team name: Termal Wave. Members: fill in from the Team Members tab (names and roles).
