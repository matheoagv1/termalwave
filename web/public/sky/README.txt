Sky assets for the space scene (web/src/scene/space/sky.ts)
Rebuild: python3.11 scripts/build_sky_assets.py
All positions are ICRF/J2000 degrees.

bright_stars.json
  Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991),
  CDS catalogue V/50, https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz
  License: public domain (CDS asks for acknowledgement).
  9096 stars, flat array [raDeg, decDeg, vmag, bv, ...]. Packed by
  God's Eye View (MIT), copied unchanged.

milkyway_{px,nx,py,ny,pz,nz}.webp
  ESO/S. Brunier, eso0932a, https://www.eso.org/public/images/eso0932a/
  License: CC BY 4.0. Credit: ESO/S. Brunier.
  Changes (by God's Eye View): resampled, stars removed, Jupiter painted
  over, blurred, reprojected to ICRF cube faces (WebGL layout, +X to the
  March equinox, +Z to the north celestial pole, no flipY), WebP.

constellations.json
  d3-celestial (c) 2015 Olaf Frohn, https://github.com/ofrohn/d3-celestial
  data/constellations.lines.json and data/constellations.json
  License: BSD-3-Clause, see LICENSE.d3-celestial.txt.
  Changes: right ascension moved to 0..360, rounded to 0.001 deg,
  repacked as {lines: {id: [[ra, dec, ...], ...]}, labels: [[id, es, la,
  ra, dec, rank], ...]}; Spanish names from the "es" field with local
  forms for the zodiac, Quilla and Octante.
