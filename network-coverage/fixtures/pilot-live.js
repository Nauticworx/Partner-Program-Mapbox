/**
 * fixtures/pilot-live.js
 * The REAL 3-client Worldwide pilot, as read from live CRM on 2026-09-21
 * (Batch 2F/2G). This is a live validation fixture, not synthetic data -
 * keep it in sync with CRM if these specific records ever change, or add a
 * fresh snapshot fixture alongside it rather than editing this in place.
 */

const klantenById = {
  "729517000004370090": {
    id: "729517000004370090",
    company: "Walter Oil & Gas",
    categorieKlanten: "Charterer",
    includeInNetworkCoverage: true,
    regionScope: "Worldwide",
  },
  "729517000009424053": {
    id: "729517000009424053",
    company: "Crowley Maritime",
    categorieKlanten: "Fleet Owner",
    includeInNetworkCoverage: true,
    regionScope: "Worldwide",
  },
  "729517000005037008": {
    id: "729517000005037008",
    company: "Van Wijngaarden Marine Services BV",
    categorieKlanten: "Ship Owner",
    includeInNetworkCoverage: true,
    regionScope: "Worldwide",
  },
};

const CANONICAL_REGIONS = require("../constants").CANONICAL_REGIONS;

const geographyRows = [];
let seq = 1;
for (const klantenId of Object.keys(klantenById)) {
  for (const region of CANONICAL_REGIONS) {
    geographyRows.push({
      id: `live-row-${seq++}`,
      klantenId,
      country: null,
      canonicalRegion: region,
      active: true,
      modifiedTime: "2026-09-21T15:25:38+02:00",
    });
  }
}

module.exports = { klantenById, geographyRows };
