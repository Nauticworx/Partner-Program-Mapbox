/**
 * dataQuality.js
 * Runs data-quality checks over normalized records (from normalize.js) and
 * surfaces issues. NOTHING here is fatal to the pipeline - blank Country is
 * explicitly non-fatal (region-only presence is a valid, expected case).
 */

const { CANONICAL_REGION_SET } = require("./constants");

/**
 * @param {Array} records - normalized records from normalize()
 * @param {Array} priorIssues - issues already found during normalize() (missing
 *   parent identity / missing Klanten lookup)
 * @returns {Array} full list of data-quality issues, each { code, ...details }
 */
function runDataQualityChecks(records, priorIssues = []) {
  const issues = [...priorIssues];

  // duplicate Klanten + Country + Canonical Region detection
  const seen = new Map();

  for (const r of records) {
    if (!r.canonicalRegion) {
      issues.push({ code: "BLANK_CANONICAL_REGION", geographyRowId: r.geographyRowId, klantenId: r.klantenId });
    } else if (!CANONICAL_REGION_SET.has(r.canonicalRegion)) {
      issues.push({ code: "INVALID_CANONICAL_REGION", value: r.canonicalRegion, geographyRowId: r.geographyRowId, klantenId: r.klantenId });
    }

    if (!r.active) {
      issues.push({ code: "INACTIVE_GEOGRAPHY_ROW", geographyRowId: r.geographyRowId, klantenId: r.klantenId });
    }

    if (!r.includeInNetworkCoverage) {
      issues.push({ code: "PARENT_EXCLUDED_FROM_NETWORK_COVERAGE", klantenId: r.klantenId, company: r.company });
    }

    if (!r.country) {
      // Explicitly non-fatal - informational only. Region-only presence is valid.
      issues.push({ code: "BLANK_COUNTRY", severity: "info", geographyRowId: r.geographyRowId, klantenId: r.klantenId });
    }

    if (r.isUnclassified) {
      issues.push({ code: "UNCLASSIFIED_CLIENT", klantenId: r.klantenId, company: r.company, value: r.categorieKlanten });
    } else if (r.categorieKlanten == null || r.categorieKlanten === "") {
      issues.push({ code: "INVALID_CATEGORY_VALUE", klantenId: r.klantenId, company: r.company });
    }

    const dupKey = `${r.klantenId}|${r.country || ""}|${r.canonicalRegion || ""}`;
    if (seen.has(dupKey)) {
      issues.push({
        code: "DUPLICATE_KLANTEN_COUNTRY_REGION",
        klantenId: r.klantenId,
        country: r.country,
        canonicalRegion: r.canonicalRegion,
        geographyRowIds: [seen.get(dupKey), r.geographyRowId],
      });
    } else {
      seen.set(dupKey, r.geographyRowId);
    }
  }

  return issues;
}

module.exports = { runDataQualityChecks };
