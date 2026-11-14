# NASA Space Apps — challenge reference (agents)

Official challenge framing for this hackathon project. Use it to keep scope, vocabulary, and demo narrative aligned with what NASA asked for. Do not paste this document into the UI.

Source title (paraphrased locally as product work): interactive app using **NASA-ISRO NISAR** SAR to track and visualize **surface change**.

## Challenge in one line

Earth’s surface changes constantly (wetlands, wildfires, earthquakes, farming, glaciers, …). Build an **interactive** application that uses **NISAR radar remote sensing** to **track and visualize** one or more types of surface change, potentially at locations around the world.

## Background (what agents must respect)

- Remote sensing = bird’s-eye Earth observation for decisions, not only field surveys.
- Optical/passive sensors use sunlight; **radar/SAR is active** (emits + receives microwaves).
- SAR works **day/night** and through **clouds** — critical in disasters.
- SAR synthesizes a long antenna from a sequence of acquisitions → higher spatial resolution.
- Radar is especially sensitive to **roughness** and **dielectric constant** (water shows strongly: floods, soil moisture, water bodies).
- SAR can also measure **fine surface movement** (cm scale): earthquakes, subsidence, ice motion.
- Polarizations and geometry carry structure / material information — not “just another GPS satellite photo.”

## Objectives (success criteria for our build)

- Interactive application (not only a static PDF).
- Uses **NISAR** (and may add supplemental optical/GIS for context).
- Tracks / visualizes **surface change**. Default study area in config is **Santiago del Estero**; any AOI worldwide is supported by swapping the site TOML (`paths.default_config` / `--config`).
- Makes complex radar observations understandable to a **broad audience**: scientists, resource managers, educators, decision-makers, public.
- Open, usable, actionable insights over time steps (maps, change detection, time series, dashboards — NASA’s examples).

NASA’s suggested workflow:

1. Pick a study area.
2. Download free NISAR (+ optional ancillary data).
3. Present findings in an interactive digital medium; hypothesize physical drivers; discuss polarizations / future NISAR uses where relevant.

## Potential considerations (optional, use when they fit)

- Multiple dates → time series; polarizations / frequencies; ancillary layers (population, vegetation, etc.).
- Human drivers vs natural resources when the AOI warrants it.
- Compelling visualization / storytelling (without AI-slop copy; humanizer ES-AR-SGO).
- Local knowledge of the study area if we have it.
- Interactivity: sliders, web maps, layer toggles, offline-capable views.

## How TermalWave maps to the challenge (internal)

| Challenge ask | Our approach |
|---|---|
| Interactive app | Globe + side controls; layers; animations with purpose |
| NISAR SAR | HDF5 → georeferenced PNG overlays (numpy/h5py/Pillow; no GDAL) |
| Surface change | Config-driven AOI (default: Santiago del Estero; any place via site TOML) |
| Broad audience | Neutral UI; layers-by-job; portable offline run |
| Supplemental context | GIBS (optional online); plain background offline |
| Open / usable | Vendored Python, committed `web/dist`, `check_portable` |

## Vocabulary preferred in user-facing copy

Prefer concrete terms: radar, NISAR, backscatter, capa, cambio, suelo, agua, fecha, área de estudio.  
Avoid challenge-meta phrases in the UI (“cumplimos el challenge”, “Space Apps”, “para el jurado”, etc.) unless the human explicitly asks for a pitch deck, not the product UI.
