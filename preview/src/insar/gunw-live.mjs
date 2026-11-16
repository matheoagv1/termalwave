// live check against CMR: node preview/src/insar/gunw-live.mjs
import { queryGunw } from "./gunw-coverage.js";

const sites = {
  santiago_del_estero: [-65.5, -30.5, -61.5, -25.5],
  south_america: [-82, -56, -34, 13],
  sahara: [-17, 15, 35, 33],
};
for (const [name, bbox] of Object.entries(sites)) {
  const fc = await queryGunw(bbox);
  const p = fc.features[0]?.properties || {};
  console.log(name, fc.status, fc.count, p.reference_date, p.secondary_date, p.track, p.frame, p.direction, p.maturity, p.size_mb, Boolean(p.browse_url));
}
