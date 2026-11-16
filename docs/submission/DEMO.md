# Demo: 30-second video and 7-slide outline

The rules allow a video of 30 seconds or less, or up to 7 slides. Speech in Spanish is fine with English subtitles. Record at 1440x900 on https://termalwave.space in a fresh private window so the setup flow appears. Rehearse once: the globe needs a few seconds to load tiles.

If the radar tiles are still labelled EXAMPLE when you record, say so in the voice-over ("sample picture of the radar layer") and keep the EXAMPLE badge in frame. Do not call them measurements.

## Video script (30 s)

| Time | On screen | What to click | Voice-over / subtitle |
|---|---|---|---|
| 0:00-0:04 | Setup screen, "See where the ground changed" | Nothing, let it show | "NISAR radar sees the ground through cloud and smoke. TermalWave puts it on a globe." |
| 0:04-0:08 | First-view cards | Click SURFACE CHANGE, then Demo area | "Pick what you want to see and where. We start at home, Santiago del Estero." |
| 0:08-0:13 | Globe flies to the area, radar drawn | Open the Layers panel | "Radar is the core layer. It stays on. Every layer says if it is measured, derived or an example." |
| 0:13-0:17 | NISAR radar row open | Click the radar row to open its detail | "What it shows, what you can decide with it, units, formula, source." |
| 0:17-0:22 | Timeline and compare curtain | Press C, drag the curtain | "Compare two dates. The difference in decibels shows where the surface changed." |
| 0:22-0:26 | NISAR passes row | Open the NISAR passes row | "For any place, the app asks NASA which NISAR passes cover it, with date and polarization." |
| 0:26-0:30 | Fires layer on, then About | Turn on FIRMS hotspots, press ? | "Fires and weather add context. Open data, open code. TermalWave." |

Subtitles: burn in English text if the voice-over is in Spanish.

## 7-slide outline (alternative)

1. **TermalWave.** One line: NISAR radar on a globe, to see where the ground changed. Screenshot of the globe. Team name.
2. **The problem.** Surface change (floods, clearing, fire scars) is hard to see in raw SAR files. Optical images fail under cloud and smoke.
3. **NISAR is the core.** L-band GCOV backscatter in dB, HH and HV on fixed scales. Change = dB later minus dB earlier. Coverage from NASA CMR per place. Screenshot of the radar layer detail.
4. **How to read it.** Three tiers: raw data, processed data, predictions. Labels: measured, derived, example. Screenshot of the layer panel.
5. **Context on the same globe.** NASA FIRMS fires, clouds, wind, Sentinel-2 optical, satellite orbits. Screenshot with fires on.
6. **Home case: Santiago del Estero.** Why the team chose it, what the radar should show there (clearing for farming, flooding, fire). State plainly which tiles are examples.
7. **Data, code, AI use.** NASA resources used, repo link, the AI disclosure from PROJECT.md, next steps (process every GCOV pass, prediction layers with confidence scores).
