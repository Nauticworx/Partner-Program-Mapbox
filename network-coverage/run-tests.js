/**
 * run-tests.js
 * Durable automated test suite for the Network Coverage pipeline.
 * Run with: node run-tests.js
 * No external dependencies (uses Node's built-in assert).
 */

const assert = require("assert");
const { normalize } = require("./normalize");
const { runDataQualityChecks } = require("./dataQuality");
const { aggregate } = require("./aggregate");
const { buildJson } = require("./buildJson");
const { CANONICAL_REGIONS } = require("./constants");

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS - ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log(`  FAIL - ${name}`);
    console.log(`         ${err.message}`);
  }
}

function run(geographyRows, klantenById) {
  const { records, issues: normIssues } = normalize(geographyRows, klantenById);
  const dqIssues = runDataQualityChecks(records, normIssues);
  const { regionTotals, countryTotals } = aggregate(records);
  return { records, issues: dqIssues, regionTotals, countryTotals };
}

console.log("Network Coverage pipeline - test suite\n");

// 1. single-role Client (Charterer)
test("1. single-role Client counts once, correct role", () => {
  const klantenById = { K1: { id: "K1", company: "A", categorieKlanten: "Charterer", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [{ id: "g1", klantenId: "K1", country: null, canonicalRegion: "North America", active: true }];
  const { regionTotals } = run(rows, klantenById);
  assert.strictEqual(regionTotals["North America"].uniqueAccounts, 1);
  assert.strictEqual(regionTotals["North America"].charterers, 1);
  assert.strictEqual(regionTotals["North America"].fleetOwners, 0);
});

// 2. Dual Account
test("2. Dual Account contributes to charterers + fleetOwners, uniqueAccounts stays 1", () => {
  const klantenById = { K2: { id: "K2", company: "B", categorieKlanten: "Dual account (Fleet Owner/Charterer)", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [{ id: "g2", klantenId: "K2", country: null, canonicalRegion: "West Asia", active: true }];
  const { regionTotals } = run(rows, klantenById);
  const t = regionTotals["West Asia"];
  assert.strictEqual(t.uniqueAccounts, 1);
  assert.strictEqual(t.charterers, 1);
  assert.strictEqual(t.fleetOwners, 1);
  assert.strictEqual(t.dualAccounts, 1);
});

// 3. Ship Owner -> Fleet Owner synonym
test("3. Ship Owner aggregates as Fleet Owner (approved synonym)", () => {
  const klantenById = { K3: { id: "K3", company: "C", categorieKlanten: "Ship Owner", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [{ id: "g3", klantenId: "K3", country: null, canonicalRegion: "East Asia", active: true }];
  const { regionTotals } = run(rows, klantenById);
  assert.strictEqual(regionTotals["East Asia"].fleetOwners, 1);
  assert.strictEqual(regionTotals["East Asia"].charterers, 0);
});

// 4. same Client, two countries, same region -> region counts once, each country counts once
test("4. same Client in two countries/same region: region=1, each country=1", () => {
  const klantenById = { K4: { id: "K4", company: "D", categorieKlanten: "Broker", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [
    { id: "g4a", klantenId: "K4", country: "Netherlands", canonicalRegion: "Northern Europe", active: true },
    { id: "g4b", klantenId: "K4", country: "Norway", canonicalRegion: "Northern Europe", active: true },
  ];
  const { regionTotals, countryTotals } = run(rows, klantenById);
  assert.strictEqual(regionTotals["Northern Europe"].uniqueAccounts, 1);
  assert.strictEqual(countryTotals["Netherlands"].uniqueAccounts, 1);
  assert.strictEqual(countryTotals["Norway"].uniqueAccounts, 1);
});

// 5. same Client, multiple regions -> each region counts once
test("5. same Client in multiple regions: each region counts the client once", () => {
  const klantenById = { K5: { id: "K5", company: "E", categorieKlanten: "Fleet Owner", includeInNetworkCoverage: true, regionScope: "Continent" } };
  const rows = [
    { id: "g5a", klantenId: "K5", country: null, canonicalRegion: "South America", active: true },
    { id: "g5b", klantenId: "K5", country: null, canonicalRegion: "Southern Africa", active: true },
  ];
  const { regionTotals } = run(rows, klantenById);
  assert.strictEqual(regionTotals["South America"].uniqueAccounts, 1);
  assert.strictEqual(regionTotals["Southern Africa"].uniqueAccounts, 1);
});

// 6. duplicate geography row (same Klanten+Country+Region twice) -> flagged, not double counted
test("6. duplicate Klanten+Country+Region row is flagged and not double-counted", () => {
  const klantenById = { K6: { id: "K6", company: "F", categorieKlanten: "Charterer", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [
    { id: "g6a", klantenId: "K6", country: null, canonicalRegion: "Middle East", active: true },
    { id: "g6b", klantenId: "K6", country: null, canonicalRegion: "Middle East", active: true },
  ];
  const { regionTotals, issues } = run(rows, klantenById);
  assert.strictEqual(regionTotals["Middle East"].uniqueAccounts, 1); // Set-based, so no inflation regardless
  assert.ok(issues.some((i) => i.code === "DUPLICATE_KLANTEN_COUNTRY_REGION"));
});

// 7. blank Country -> included in region totals, excluded from country totals, flagged info (non-fatal)
test("7. blank Country: included in region totals, excluded from country totals, non-fatal", () => {
  const klantenById = { K7: { id: "K7", company: "G", categorieKlanten: "Fleet Owner", includeInNetworkCoverage: true, regionScope: "Worldwide" } };
  const rows = [{ id: "g7", klantenId: "K7", country: null, canonicalRegion: "West Africa", active: true }];
  const { regionTotals, countryTotals, issues } = run(rows, klantenById);
  assert.strictEqual(regionTotals["West Africa"].uniqueAccounts, 1);
  assert.strictEqual(Object.keys(countryTotals).length, 0);
  assert.ok(issues.some((i) => i.code === "BLANK_COUNTRY" && i.severity === "info"));
});

// 8. blank Region -> excluded from public totals, surfaced in data quality
test("8. blank Canonical Region excluded from totals, surfaced as data-quality issue", () => {
  const klantenById = { K8: { id: "K8", company: "H", categorieKlanten: "Broker", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [{ id: "g8", klantenId: "K8", country: null, canonicalRegion: null, active: true }];
  const { regionTotals, issues } = run(rows, klantenById);
  for (const region of CANONICAL_REGIONS) assert.strictEqual(regionTotals[region].uniqueAccounts, 0);
  assert.ok(issues.some((i) => i.code === "BLANK_CANONICAL_REGION"));
});

// 9. unclassified Client (Advertiser) -> no role flags, still counts toward uniqueAccounts if included/active
test("9. unclassified Client (Advertiser): no role flags, flagged, still counts uniqueAccounts", () => {
  const klantenById = { K9: { id: "K9", company: "I", categorieKlanten: "Advertiser", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [{ id: "g9", klantenId: "K9", country: null, canonicalRegion: "South Asia", active: true }];
  const { regionTotals, issues } = run(rows, klantenById);
  const t = regionTotals["South Asia"];
  assert.strictEqual(t.uniqueAccounts, 1);
  assert.strictEqual(t.charterers, 0);
  assert.strictEqual(t.brokers, 0);
  assert.strictEqual(t.fleetOwners, 0);
  assert.ok(issues.some((i) => i.code === "UNCLASSIFIED_CLIENT"));
});

// 10. parent Include_in_Network_Coverage = false -> excluded from public totals
test("10. parent Include_in_Network_Coverage=false excludes the row from totals", () => {
  const klantenById = { K10: { id: "K10", company: "J", categorieKlanten: "Fleet Owner", includeInNetworkCoverage: false, regionScope: "Worldwide" } };
  const rows = [{ id: "g10", klantenId: "K10", country: null, canonicalRegion: "East Africa", active: true }];
  const { regionTotals, issues } = run(rows, klantenById);
  assert.strictEqual(regionTotals["East Africa"].uniqueAccounts, 0);
  assert.ok(issues.some((i) => i.code === "PARENT_EXCLUDED_FROM_NETWORK_COVERAGE"));
});

// 11. child Active = false -> excluded from totals
test("11. child Active=false excludes the row from totals", () => {
  const klantenById = { K11: { id: "K11", company: "K", categorieKlanten: "Charterer", includeInNetworkCoverage: true, regionScope: "1 region" } };
  const rows = [{ id: "g11", klantenId: "K11", country: null, canonicalRegion: "Central Africa", active: false }];
  const { regionTotals, issues } = run(rows, klantenById);
  assert.strictEqual(regionTotals["Central Africa"].uniqueAccounts, 0);
  assert.ok(issues.some((i) => i.code === "INACTIVE_GEOGRAPHY_ROW"));
});

// 12. live 3-client Worldwide pilot
test("12. live 3-client Worldwide pilot matches expected totals in all 16 regions", () => {
  const { klantenById, geographyRows } = require("./fixtures/pilot-live");
  const { regionTotals, countryTotals, records } = run(geographyRows, klantenById);

  for (const region of CANONICAL_REGIONS) {
    const t = regionTotals[region];
    assert.strictEqual(t.uniqueAccounts, 3, `${region}: uniqueAccounts`);
    assert.strictEqual(t.charterers, 1, `${region}: charterers`);
    assert.strictEqual(t.brokers, 0, `${region}: brokers`);
    assert.strictEqual(t.fleetOwners, 2, `${region}: fleetOwners`);
    assert.strictEqual(t.dualAccounts, 0, `${region}: dualAccounts`);
  }
  assert.strictEqual(Object.keys(countryTotals).length, 0, "no country rows expected");

  // role overlap sanity: uniqueAccounts must equal distinct account count, not
  // charterers+brokers+fleetOwners+dualAccounts (which would be 1+0+2+0=3 here
  // coincidentally, so also check it's not silently derived by summation logic)
  assert.strictEqual(records.filter((r) => r.canonicalRegion === "North America").length, 3);

  // 5. schema compatibility with live Mapbox POC
  const json = buildJson(regionTotals, countryTotals);
  assert.ok(Array.isArray(json.regions));
  assert.strictEqual(json.regions.length, 16);
  for (const region of json.regions) {
    assert.ok(region.id && region.name);
    assert.ok(Array.isArray(region.coordinates) && region.coordinates.length === 2);
    assert.ok(Array.isArray(region.countries));
    assert.strictEqual(typeof region.uniqueAccounts, "number");
  }

  require("fs").writeFileSync(
    require("path").join(__dirname, "network-coverage.test.json"),
    JSON.stringify(json, null, 2)
  );
});

console.log(`\n${passed} passed, ${failed} failed (of ${passed + failed})`);
if (failed > 0) process.exit(1);
