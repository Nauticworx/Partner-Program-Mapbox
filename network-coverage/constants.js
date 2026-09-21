/**
 * constants.js
 * Canonical Nauticworx Network Coverage taxonomy and role mapping.
 * Approved per Batch 2A-2G. Do not add/remove regions or change role
 * mappings here without a new approved batch.
 */

// The 16 approved canonical regions, in the display order used by the
// live Mapbox POC's demo data (data/network-coverage.json).
const CANONICAL_REGIONS = [
  "North America",
  "South America",
  "Northern Europe",
  "Southern Europe",
  "Southeastern Europe",
  "North Africa",
  "West Africa",
  "Central Africa",
  "East Africa",
  "Southern Africa",
  "Middle East",
  "West Asia",
  "South Asia",
  "East Asia",
  "Southeast Asia",
  "Australia/Oceania",
];

const CANONICAL_REGION_SET = new Set(CANONICAL_REGIONS);

// Region -> { id, coordinates } lookup. This is EXTERNAL CARTOGRAPHIC DATA,
// copied verbatim from the current live data/network-coverage.json (the
// approved region coordinate reference). It must never be derived from CRM
// data, and must stay in sync with the live file if that file's coordinates
// are ever revised by whoever owns the map design.
const REGION_GEO = {
  "North America":        { id: "north-america",        coordinates: [-98.0, 45.0] },
  "South America":        { id: "south-america",         coordinates: [-58.0, -15.0] },
  "Northern Europe":      { id: "northern-europe",       coordinates: [8.0, 57.0] },
  "Southern Europe":      { id: "southern-europe",       coordinates: [12.0, 40.5] },
  "Southeastern Europe":  { id: "southeastern-europe",   coordinates: [24.0, 43.5] },
  "North Africa":         { id: "north-africa",          coordinates: [12.0, 27.0] },
  "West Africa":          { id: "west-africa",           coordinates: [-4.0, 9.0] },
  "Central Africa":       { id: "central-africa",        coordinates: [20.0, 0.0] },
  "East Africa":          { id: "east-africa",            coordinates: [37.0, 0.0] },
  "Southern Africa":      { id: "southern-africa",       coordinates: [24.0, -28.0] },
  "Middle East":          { id: "middle-east",            coordinates: [50.0, 24.0] },
  "West Asia":            { id: "west-asia",              coordinates: [40.0, 39.0] },
  "South Asia":           { id: "south-asia",             coordinates: [78.0, 22.0] },
  "East Asia":            { id: "east-asia",              coordinates: [115.0, 33.0] },
  "Southeast Asia":       { id: "southeast-asia",         coordinates: [108.0, 5.0] },
  "Australia/Oceania":    { id: "australia-oceania",      coordinates: [134.0, -25.0] },
};

// Country coordinate lookup is intentionally NOT populated here beyond what
// the live demo file already showed as examples. This pilot generates zero
// country-level rows (Country is blank on all 48 pilot geography rows), so
// no country coordinates are needed yet. When real country-level rows are
// approved in a future batch, this table must be extended with an approved
// cartographic source per country actually in use - never invented, never
// derived from CRM Country text.
const COUNTRY_GEO = {};

// Categorie_Klanten -> Network Coverage role flags.
// "Ship Owner" -> isFleetOwner is an APPROVED SYNONYM (Batch 2F), not an
// inference - Nauticworx confirmed Ship Owner accounts should aggregate as
// Fleet Owners.
const ROLE_MAP = {
  "Charterer": { isCharterer: true },
  "Broker": { isBroker: true },
  "Fleet Owner": { isFleetOwner: true },
  "Ship Owner": { isFleetOwner: true }, // approved synonym, Batch 2F
  "Dual Account": { isCharterer: true, isFleetOwner: true, isDualAccount: true },
  "Dual account (Fleet Owner/Charterer)": { isCharterer: true, isFleetOwner: true, isDualAccount: true },
  // Advertiser / unclassified -> no role flags (deliberately absent)
};

const UNCLASSIFIED_CATEGORIES = new Set(["Advertiser", "Adverteerder", null, undefined, ""]);

module.exports = {
  CANONICAL_REGIONS,
  CANONICAL_REGION_SET,
  REGION_GEO,
  COUNTRY_GEO,
  ROLE_MAP,
  UNCLASSIFIED_CATEGORIES,
};
