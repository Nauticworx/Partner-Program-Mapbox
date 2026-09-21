/**
 * normalize.js
 * Joins each Network_Coverage_Geography child row to its Klanten parent and
 * produces one flat normalized record per (Klanten, geography row) pair.
 *
 * Canonical account identity = Klanten CRM record ID, unless an explicit
 * duplicate-override table is supplied (not used yet - no overrides approved).
 */

const { ROLE_MAP, UNCLASSIFIED_CATEGORIES } = require("./constants");

/**
 * @param {Array} geographyRows - Network_Coverage_Geography rows:
 *   { id, klantenId, country, canonicalRegion, active, modifiedTime }
 * @param {Object} klantenById - map of Klanten CRM record ID -> parent:
 *   { id, company, categorieKlanten, includeInNetworkCoverage, regionScope }
 * @param {Object} [duplicateOverrides] - optional map of Klanten ID -> canonical
 *   account ID, for explicitly-approved duplicate-account merges. Empty by default.
 * @returns {{records: Array, issues: Array}}
 */
function normalize(geographyRows, klantenById, duplicateOverrides = {}) {
  const records = [];
  const issues = [];

  for (const row of geographyRows) {
    const parent = klantenById[row.klantenId];

    if (!row.klantenId) {
      issues.push({ code: "MISSING_KLANTEN_LOOKUP", row });
      continue;
    }
    if (!parent) {
      issues.push({ code: "MISSING_PARENT_IDENTITY", row, klantenId: row.klantenId });
      continue;
    }

    const canonicalAccountId = duplicateOverrides[parent.id] || parent.id;
    const categorie = parent.categorieKlanten;
    const roleFlags = ROLE_MAP[categorie] || {};
    const isUnclassified = UNCLASSIFIED_CATEGORIES.has(categorie);

    records.push({
      // identity
      canonicalAccountId,
      klantenId: parent.id,
      company: parent.company,
      categorieKlanten: categorie,
      isUnclassified,
      // parent inclusion
      includeInNetworkCoverage: !!parent.includeInNetworkCoverage,
      regionScope: parent.regionScope,
      // child geography
      geographyRowId: row.id,
      country: row.country || null,
      canonicalRegion: row.canonicalRegion || null,
      active: !!row.active,
      modifiedTime: row.modifiedTime || null,
      // role flags (spread so missing flags are simply absent/false)
      isCharterer: !!roleFlags.isCharterer,
      isBroker: !!roleFlags.isBroker,
      isFleetOwner: !!roleFlags.isFleetOwner,
      isDualAccount: !!roleFlags.isDualAccount,
    });
  }

  return { records, issues };
}

module.exports = { normalize };
