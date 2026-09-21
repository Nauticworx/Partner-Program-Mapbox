/**
 * aggregate.js
 * Region and country aggregation over normalized records.
 *
 * Rules (approved Batch 2F/2G):
 * - Only rows where parent.includeInNetworkCoverage=true AND child.active=true count.
 * - Region aggregation: COUNT DISTINCT canonicalAccountId per region (blank
 *   Country rows ARE included here - region-only presence is valid).
 * - Country aggregation: COUNT DISTINCT canonicalAccountId per country (blank
 *   Country rows are EXCLUDED here).
 * - Role counts are COUNT DISTINCT canonicalAccountId where the role flag is
 *   true - never summed into uniqueAccounts. uniqueAccounts is always its own
 *   independent distinct-account count, because Dual Accounts overlap roles.
 * - Blank/invalid Canonical Region rows are excluded from all public totals
 *   (they were already surfaced as data-quality issues).
 */

const { CANONICAL_REGIONS, CANONICAL_REGION_SET } = require("./constants");

function newBucket() {
  return {
    accounts: new Set(),
    charterers: new Set(),
    brokers: new Set(),
    fleetOwners: new Set(),
    dualAccounts: new Set(),
  };
}

function addToBucket(bucket, r) {
  bucket.accounts.add(r.canonicalAccountId);
  if (r.isCharterer) bucket.charterers.add(r.canonicalAccountId);
  if (r.isBroker) bucket.brokers.add(r.canonicalAccountId);
  if (r.isFleetOwner) bucket.fleetOwners.add(r.canonicalAccountId);
  if (r.isDualAccount) bucket.dualAccounts.add(r.canonicalAccountId);
}

function summarize(bucket) {
  return {
    uniqueAccounts: bucket.accounts.size, // independent COUNT DISTINCT - never role1+role2+...
    charterers: bucket.charterers.size,
    brokers: bucket.brokers.size,
    fleetOwners: bucket.fleetOwners.size,
    dualAccounts: bucket.dualAccounts.size,
  };
}

/**
 * @param {Array} records - normalized records from normalize.js
 * @returns {{regionTotals: Object, countryTotals: Object, eligibleRecords: Array}}
 */
function aggregate(records) {
  // eligibility: parent included, child active, region is a valid canonical region
  const eligible = records.filter(
    (r) => r.includeInNetworkCoverage && r.active && r.canonicalRegion && CANONICAL_REGION_SET.has(r.canonicalRegion)
  );

  const regionBuckets = {};
  for (const region of CANONICAL_REGIONS) regionBuckets[region] = newBucket();
  const countryBuckets = {}; // country name -> bucket, created on demand

  for (const r of eligible) {
    addToBucket(regionBuckets[r.canonicalRegion], r);
    if (r.country) {
      if (!countryBuckets[r.country]) countryBuckets[r.country] = newBucket();
      addToBucket(countryBuckets[r.country], r);
    }
    // blank Country -> included in region totals above, excluded from country totals (no-op here)
  }

  const regionTotals = {};
  for (const region of CANONICAL_REGIONS) regionTotals[region] = summarize(regionBuckets[region]);

  const countryTotals = {};
  for (const country of Object.keys(countryBuckets)) countryTotals[country] = summarize(countryBuckets[country]);

  return { regionTotals, countryTotals, eligibleRecords: eligible };
}

module.exports = { aggregate };
