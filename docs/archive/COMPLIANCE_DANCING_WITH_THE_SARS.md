# Compliance report — Dancing with the SARs (NASA Space Apps 2026)

**Audience:** team / agents only. Do not paste scoring language into UI, tooltips, or user-facing copy.  
**Sources (retrieved 2026-11-14):**  
- Challenge: https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/  
- FAQs: https://www.spaceappschallenge.org/resources/participant-faqs/  
- Judging / awards guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/  
- SI/AI disclosure norms also summarized in nasa/spaceapps discussions  

**Product under review:** TermalWave (`matheoagv1/termalwave`)  
**Core policy:** NISAR SAR + surface-change timeline always on (`config/layers.toml`, `docs/GLOBE_LAYERS_PRESETS.md`).

Legend: **YES** = covered · **PARTIAL** = started / gaps · **GAP** = required for submission / awards not done · **UNKNOWN** = needs human confirm.

---

## 1. Challenge statement (must address)

| Requirement (from Objectives) | Status | Evidence / gap |
|---|---|---|
| Interactive application | **YES** | MapLibre globe UI, timeline, curtain, layers, preview Worker |
| Uses **NISAR** radar remote sensing | **YES** | Earthdata CMR → `earthdata_nisar_gcov`; overlays from HDF5/GCOV path; tagline NISAR |
| Track **and** visualize surface change | **PARTIAL** | Multi-year timeline + compare curtain; still AOI PNG quadrant, not full-globe drape (T038/T039) |
| One or more types of surface change | **PARTIAL** | Radar backscatter change primary; soil/contamination as inference; fires via FIRMS (ancillary) |
| Locations **around the world** | **PARTIAL** | Site TOML swappable (no city hardcode in TS); default Santiago; globe basemap global but phenomenon footprint local |
| Intuitive tools / innovative viz (change maps, time series, dashboards) | **YES** | Globe + timeline + curtain + Fuentes/provenance |
| Open / accessible for broad audience | **PARTIAL** | ES-AR-SGO copy, intro; often “Datos de ejemplo”; repo still **private** |
| Actionable insights for scientists / managers / public | **PARTIAL** | Provenance panel; rubros text; presets not wired; inferences need clearer labels |
| Hypothesize physical drivers in narrative | **PARTIAL** | Context copy by trade; needs explicit “qué puede estar pasando” tied to SAR physics in demo/submission |

Official workflow in brief: pick study area → download NISAR (+ optional ancillary) → present interactively. We match that pipeline (AOI config → Earthdata/ASF-style access → web app).

---

## 2. Potential considerations (optional — “may but are not required”)

| # | Consideration | Status | Notes |
|---|---|---|---|
| 1 | Polarizations / other frequencies; multi-date; ancillary (population, vegetation…) | **PARTIAL** | Multi-date **yes**. Polarization UI **no**. Ancillary: FIRMS, Open-Meteo, Sentinel-2 PC, GIBS/CARTO **yes** |
| 2 | Human drivers on natural resources | **PARTIAL** | Rubros + fire/soil layers; presets enabling sets still open (T040) |
| 3 | Compelling storytelling in any digital medium | **YES** for app; **GAP** for 30s demo / 7 slides |
| 4 | Personal / hometown context | **YES** | Santiago del Estero / Termas default |
| 5 | Interactive summary (sliders, web maps) | **YES** | Curtain + web map globe |

---

## 3. NASA / partner resources (challenge Resources tab)

For **Global Awards** eligibility: use **at least one NASA data source listed in the challenge Resources**.

| Resource family | Used? | How |
|---|---|---|
| NASA Earthdata Search / CMR | **YES** | NISAR L2 GCOV granules |
| ASF Vertex / NISAR user guide | **PARTIAL** | Compatible stack; document in References even if CMR is primary path |
| Intro RS / Intro SAR / ARSET | **N/A product** | Cite in References / learning |
| NISAR StoryMaps / white papers | **N/A product** | Cite for narrative |
| UAVSAR postcards | **NO** | Optional inspiration |
| Partner SAR (RCM, RADARSAT-1, tutorials) | **NO** | Optional multi-frequency (consideration 1) |

**Always-on core vs Resources:** Challenge core = NISAR SAR. GIBS/FIRMS are NASA but secondary overlays; they must not replace radar.

---

## 4. Hackathon general rules (eligibility & conduct)

| Rule | Status | Action |
|---|---|---|
| Respond to an official 2026 challenge | **YES** | Dancing with the SARs |
| All members registered, same Local/Universal Event, on Team Members tab; Local ≥1, Universal ≥2, max 6 | **UNKNOWN** | Confirm roster before submit |
| No building before hackathon weekend (resources Nov 13; work from Nov 14) | **UNKNOWN** | Team must be able to affirm start rules for Local Event |
| Submit via Project page by **Sun Nov 15 23:59 local** (Universal = Team Owner local time) | **GAP** | Submission not filed |
| Required Project fields + English on page / linked materials | **GAP** | Draft English summary ready before submit |
| Demo: **≤30 s video** (other language OK **with English subtitles**) **or** **≤7 slides** | **GAP** | Produce |
| Checkboxes: Terms, Privacy, original work, all external resources listed in **References** | **GAP** | References list below |
| NASA China bilateral policy (Global Judging) | **UNKNOWN** | Team affirm per Terms |
| ≥1 NASA challenge Resource for Global Awards | **YES** (data) | Earthdata NISAR — keep explicit in submission text |

Judging dimensions (1–5; for awareness, not UI): Impact, Creativity, Validity, Relevance (strong NASA data integration), Presentation. Relevance wants NISAR as **core**, not decoration — aligns with our always-on radar policy.

---

## 5. Super Intelligence (SI) / AI norms (2026 language)

Official FAQs use **Super Intelligence (SI)** for tools formerly called AI (LLMs, codegen, image/video gens, etc.).

| Rule | Status | Action |
|---|---|---|
| SI tools **allowed** to accelerate work | **OK** | Cursor / agents used in development |
| Submission **must describe** how SI was used | **GAP** | Paste SI disclosure (draft §7) into Project page |
| SI images/videos: visible **“AI-generated” / SI-generated watermark** | **UNKNOWN** | Audit monigote/sprites/any gens; watermark if SI-made |
| SI audio: disclose in text + metadata | **N/A / UNKNOWN** | SFX — confirm human/licensed |
| SI code/data: acknowledge in descriptive text + metadata | **GAP** | Disclosure + References |
| SI content must **not** use/contain/modify **NASA branding** (logos, flags, mission marks) | **UNKNOWN** | Audit `brand/` and generated media |
| Unaltered NASA photos / real NISAR products: OK with attribution | **OK** | GIBS credit strings; Earthdata provenance |

---

## 6. Product gaps that block “fully meets” the spirit of the brief

1. **Global surface-change feel:** basemap wraps Earth; SAR still one AOI rectangle (GEV-style full drape open — T038/T039).  
2. **Rubros as presets:** still text-only; must enable optional layers without turning off NISAR (T040 + `core=true`).  
3. **Three layer categories** (data / prediction / inference) not yet in UI contract emission.  
4. **Submission pack:** demo, English project fields, References, SI disclosure, shareable code link.  
5. **Polarizations** not exposed (optional consideration).  
6. **Private GitHub** — for submission judges need a reachable project link (public repo, release zip, or explicit access).

---

## 7. Draft SI disclosure (paste into Project submission)

> We used Super Intelligence (SI) tools during development: Cursor IDE agents (code assistance, refactors, tests, docs), and conversational coding assistants for scaffolding and review. Humans designed the product architecture, chose NISAR/Earthdata as the core data path, curated the Santiago del Estero case, and reviewed all user-facing Spanish (ES-AR-SGO) copy. SI did not invent scientific certainty; inferred layers are labeled as such. Any SI-generated raster/illustration assets (if present in the final build) carry a visible AI/SI-generated mark and do not modify NASA logos or marks. Real NASA/ISRO NISAR products, GIBS imagery, and FIRMS detections are observational data with attribution, not SI fabrications.

---

## 8. Draft References checklist (Project “References” field)

- NASA Earthdata / CMR — NISAR L2 GCOV  
- NASA GIBS — basemap imagery (attribution in-app)  
- NASA FIRMS — thermal hotspots (when enabled)  
- ASF NISAR Data User Guide (methodology context)  
- MapLibre GL — globe rendering  
- Open-Meteo — weather / elevation (CC BY)  
- OpenStreetMap / Photon / Nominatim / CARTO — geocode & street basemaps (ODbL / CARTO terms)  
- Cesium ion — optional terrain token (if used in final)  
- Microsoft Planetary Computer — Sentinel-2 (ancillary)  
- Reference code studied: God’s Eye View (bilawalsidhu/gods-eye-view), SgoLinea (local transit map patterns)  
- Vendored Python wheels / local frontend deps (no required CDN)

Add every other third-party asset you ship (fonts, sprites, music).

---

## 9. Pre-submit checklist (owners)

- [ ] Team Members tab complete; same event; ≤6  
- [ ] English Project summary + Detailed description (NISAR core explicit)  
- [ ] Demo ≤30s or ≤7 slides  
- [ ] References filled  
- [ ] SI disclosure filled  
- [ ] Code / preview link reachable  
- [ ] Radar always visible in demo; optional layers clearly optional  
- [ ] Watermark any SI images; no NASA logo in SI art  
- [ ] Agree Terms / original-work checkboxes  

---

## 10. Overall verdict

| Lens | Verdict |
|---|---|
| Challenge **base intent** (interactive NISAR surface-change app) | **Mostly met** — real NISAR path + interactive viz; strengthen worldwide framing + always-on SAR demo |
| Challenge **optional considerations** | **Partially met** — storytelling/local/interactive strong; polarizations & preset-driven human-driver story weaker |
| Hackathon **submission / Global Judging eligibility** | **Not ready** until demo + form + References + SI text + reachable project |
| **SI norms** | **Process OK**; **disclosure/watermark audit outstanding** |
| **Core SAR always-on** | **Policy YES** in config/docs; enforce in UI (T039) |

