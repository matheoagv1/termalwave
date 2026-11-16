# Submission checklist: Dancing with the SARs

Checked against the code on 2026-11-15 at 22:10 Argentina time (UTC-3). Challenge text re-read from the live challenge page the same evening. Rules from the Space Apps FAQs and judging guide as summarized in `docs/archive/COMPLIANCE_DANCING_WITH_THE_SARS.md`.

Deadline: Sunday Nov 15, 23:59 local time (Argentina). At the time of this check there were about 1 h 50 min left.

Status: YES, PARTIAL, NO. "Who" says who must act.

## 1. Challenge objectives

| Requirement | Status | Evidence | Who / next step |
|---|---|---|---|
| Interactive application | YES | `web/src/ui/Hud.tsx`, `web/src/ui/layers/`, `web/src/ui/Timeline.tsx`, live at https://termalwave.space | |
| Uses NISAR radar data | PARTIAL | CMR coverage of NISAR GCOV is live (`preview/src/nisar-coverage.js`, labelled measured). GCOV reader exists (`termalwave/process/nisar_raster.py`, `scripts/nisar_gcov_fetch.py`). Two GCOV and one GUNW granule are downloaded in the main checkout (`/srv/sites/nasaspaceappchallenge/data/raw/`). But every radar frame in `web/public/dataset.json` and on the live site is `honesty: example`. | Lead or data owner: run the GCOV pipeline on the downloaded granules and export a dataset with measured 2026 frames, if time allows before freeze. Otherwise say "example" in the demo. |
| Track and visualize surface change | PARTIAL | Timeline plus compare curtain (`C`), change formula `dB_t2 - dB_t1` in `web/src/ui/layers/layer-copy.ts`. Real change raster depends on the row above. | Same as above |
| One or more types of surface change | PARTIAL | Backscatter change as the core; fires from FIRMS as context; soil and pollution are example layers | |
| Locations around the world | PARTIAL | Worldwide place search, NISAR pass list, fires, clouds, wind anywhere. Radar image only for the demo area (setup says so: `web/src/ui/setup/copy.ts` `examplesNote`). | |
| Intuitive tools, change maps, time series, dashboards | YES | Setup flow `web/src/ui/IntroOverlay.tsx`, layer detail `web/src/ui/layers/LayerDetail.tsx`, timeline, curtain | |
| Accessible to a broad audience | YES | English default, Spanish switch; keyboard shortcuts (`?`); plain-language what/decide/no-data/caveats per layer | |
| Actionable insights | PARTIAL | `decision_*` text per layer; no exported report | |
| Open-source solution | NO | Repo https://github.com/matheoagv1/termalwave returns 404 to the public | Repo owner (matheoagv1): make public or add a licence file and share access with judges |
| Hypothesize physical drivers | PARTIAL | Radar caveats name moisture and roughness; decision text names flooding, clearing, construction | Team: say the drivers in the video or slide 6 |

## 2. Potential considerations (optional)

| Consideration | Status | Evidence |
|---|---|---|
| Polarizations | PARTIAL | HH and HV fixed scales (`termalwave/process/nisar_raster.py` `HV_DB`, `HH_DB`); pass list shows polarization per granule (`web/src/app/view.ts` `passLine`). No HH/HV switch in the UI. |
| Other frequencies / partner SAR (CSA RCM, RADARSAT-1) | NO | Not used |
| Time series | YES | Yearly ticks and acquisitions on the timeline |
| Ancillary data | YES | FIRMS, nowCOAST clouds, Open-Meteo wind, Sentinel-2, orbits |
| Human drivers | PARTIAL | Iberá and Rondônia places in setup; no human-driver layer |
| Storytelling | PARTIAL | Setup flow; video not recorded yet |
| Personal / hometown context | YES | Santiago del Estero default area |
| Interactive summary (sliders, web maps) | YES | Compare curtain, web globe |

## 3. NASA resources

| Requirement | Status | Evidence |
|---|---|---|
| At least one NASA resource from the challenge list (Global Awards) | YES | NASA Earthdata CMR / NISAR GCOV in `config/apis.toml` `[radar]`; named in About and `REFERENCES.md` |
| NISAR stays the core, other data is context | YES | `config/layers.toml` radar `core = true`; UI lock in `web/src/ui/layers/layer-model.ts` (`lockedCore`); setup says "NISAR radar stays on in every view" |
| Attribution in the app | YES | About dialog: data sources (`web/src/ui/hud/copy.ts`) and references with links (`web/src/ui/about/`) |

## 4. Hackathon rules and minimums

| Requirement | Status | Evidence | Who |
|---|---|---|---|
| Responds to an official 2026 challenge | YES | Dancing with the SARs | |
| All members registered on the same event, on the Team Members tab, team size within limits | UNKNOWN | Not visible from code | Team owner |
| Work started during the hackathon | UNKNOWN | Team must affirm | Team owner |
| Project page submitted before Nov 15, 23:59 local | NO | Form not filed | Team owner |
| Project fields in English | PARTIAL | Draft in `docs/submission/PROJECT.md` | Team owner: paste and fill team names |
| Demo: video 30 s or less, or 7 slides or fewer | NO | Script in `docs/submission/DEMO.md` | Someone with a screen recorder |
| English subtitles if the video is not in English | NO | | Video maker |
| References field lists every external resource | PARTIAL | `docs/submission/REFERENCES.md` short form | Team owner: paste; name the image model used |
| Link to project / code reachable by judges | PARTIAL | App 200 at https://termalwave.space; repo 404 | Repo owner |
| Terms, privacy, original-work checkboxes | NO | Form only | Team owner |
| NASA bilateral China policy affirmation | UNKNOWN | Form only | Team owner |

## 5. AI usage norms

| Requirement | Status | Evidence | Who |
|---|---|---|---|
| Describe how AI was used | YES in app, NO in form | About dialog "Use of AI tools" (`web/src/ui/about/copy.ts`); text for the form in `PROJECT.md` | Team owner: paste |
| AI images carry a visible AI mark | PARTIAL | `brand/monigote/monigote-si.png` has the mark and `web/src/ui/MonigoteBuddy.tsx` loads it. The committed `web/dist/brand/` lacks `monigote-si.png`, so a build from that folder falls back to the unmarked picture. The live site serves the marked file. | Lead: make sure the next build copies `monigote-si.png` (`web/scripts/sync-brand.mjs` already lists it) |
| AI content does not use NASA logos or marks | YES | `brand/CREDITS.md` | |
| Video made with AI tools gets a mark | n/a | Only if the demo video uses AI generation | Video maker |

## 6. Honesty (team rule, also judged as validity)

| Rule | Status | Evidence |
|---|---|---|
| Example data never shown as measured | YES after this pass | Layer and frame badges from `dataset.json`. The setup card SURFACE CHANGE used to show MEASURED while the radar frames were examples; it now reads the radar layer honesty (`web/src/ui/IntroOverlay.tsx` `radarExample`). |
| Prediction tier honest when empty | YES | `web/src/ui/layers/layer-copy.ts` `emptyTier.prediction` |

## Top manual steps before 23:59

1. File the project page with `PROJECT.md` text, `REFERENCES.md` short form, AI disclosure, checkboxes (team owner).
2. Make the GitHub repo public or give judges access (repo owner).
3. Record the 30-second video from `DEMO.md`, English subtitles, upload and link it (any team member).
4. If there is time before freeze: regenerate the dataset from the downloaded NISAR GCOV granules so the radar layer is measured (lead / data owner).
