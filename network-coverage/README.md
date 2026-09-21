# Network Coverage Aggregation Pipeline

Durable implementation of the Nauticworx Partner Program "Network Coverage"
aggregation pipeline (Batch 2A-2G). Plain Node.js, zero dependencies, isolated
from `index.html` — this folder produces a JSON file that `index.html` reads;
it contains no frontend/map code.

## Source modules

- `constants.js` — the 16 approved canonical regions, the region coordinate
  lookup (external cartographic data, copied from the live
  `data/network-coverage.json`), and the Categorie_Klanten → role-flag map.
- `normalize.js` — joins each `Network_Coverage_Geography` child row to its
  `Klanten` parent, producing one flat record per row with role flags applied.
  Canonical account identity = Klanten CRM record ID (a duplicate-override map
  can be supplied later if an explicit merge is ever approved; none exists yet).
- `dataQuality.js` — non-mutating checks over normalized records: missing
  parent identity, missing Klanten lookup, blank/invalid Canonical Region,
  duplicate Klanten+Country+Region, inactive row, parent excluded, blank
  Country (informational, non-fatal), unclassified client, invalid category.
- `aggregate.js` — region and country aggregation. Only rows where
  `parent.Include_in_Network_Coverage=true` AND `child.Active=true` AND the
  region is one of the 16 canonical regions are eligible. All counts are
  `COUNT DISTINCT canonicalAccountId` — **uniqueAccounts is never derived by
  summing role counts**, because Dual Accounts overlap Charterer/Fleet Owner.
- `buildJson.js` — joins aggregated totals with the coordinate lookup into the
  exact schema `index.html` consumes (verified against the live repo on
  2026-09-21 — see "Schema verification" below).
- `run-tests.js` — the durable test suite (`node run-tests.js`).
- `fixtures/pilot-live.js` — the real 3-client Worldwide pilot as read from
  live CRM on 2026-09-21 (Batch 2F/2G), used as a live validation fixture.

## Role mapping

| Categorie_Klanten | Role flags |
|---|---|
| Charterer | isCharterer |
| Broker | isBroker |
| Fleet Owner | isFleetOwner |
| Ship Owner | isFleetOwner (approved synonym, Batch 2F) |
| Dual Account / Dual account (Fleet Owner/Charterer) | isCharterer + isFleetOwner + isDualAccount |
| Advertiser / Adverteerder / blank | no role flags (flagged as UNCLASSIFIED_CLIENT) |

## Inclusion rules

A geography row is eligible for public totals only when:
- parent `Include_in_Network_Coverage = true`, AND
- child `Active = true`, AND
- `Canonical_Region` is one of the 16 approved values.

## Geography rules

- **Region totals**: `COUNT DISTINCT canonicalAccountId` per region. A blank
  `Country` on an eligible row is still counted here (region-only presence is
  valid and expected for `Worldwide`/`Continent`/`1 region` subscribers).
- **Country totals**: `COUNT DISTINCT canonicalAccountId` per country. Rows
  with blank `Country` are excluded here.
- **Worldwide subscribers**: per Batch 2F/2G business rule, `Region =
  Worldwide` on the Klanten parent means the client should have one active
  geography row per canonical region (16 total), Country blank. This is a
  human-approved CRM data state, not something the aggregation pipeline
  infers or generates — the pipeline only aggregates whatever geography rows
  actually exist.
- **Coordinates are never derived from CRM.** They come only from
  `constants.js`'s `REGION_GEO`/`COUNTRY_GEO`, which must be kept in sync with
  whatever the live Mapbox POC's cartographic reference is.

## How aggregation works

1. `normalize()` joins geography rows to Klanten parents and applies role flags.
2. `runDataQualityChecks()` scans the normalized records for the issues listed
   above — nothing here mutates data or blocks aggregation; blank Country is
   explicitly non-fatal.
3. `aggregate()` filters to eligible rows and computes per-region and
   per-country `Set`-based distinct-account totals.
4. `buildJson()` joins those totals with the coordinate lookup into the final
   schema.

## How to run tests

```
cd network-coverage
node run-tests.js
```

No install step — pure Node.js, no `node_modules`. Exits non-zero if any test
fails. Covers: single-role client, Dual Account, Ship Owner→Fleet Owner
synonym, same client in two countries/same region, same client in multiple
regions, duplicate geography row, blank Country, blank Region, unclassified
client, parent Include=false, child Active=false, and the live 3-client
Worldwide pilot (16-region total check + JSON schema shape check).

## How to generate JSON

`run-tests.js`'s pilot test (#12) already writes `network-coverage.test.json`
as a side effect of validating the live pilot. For a standalone generation
script outside the test run, call:

```js
const { normalize } = require("./normalize");
const { runDataQualityChecks } = require("./dataQuality");
const { aggregate } = require("./aggregate");
const { buildJson } = require("./buildJson");

const { records, issues: normIssues } = normalize(geographyRows, klantenById);
const dqIssues = runDataQualityChecks(records, normIssues);
const { regionTotals, countryTotals } = aggregate(records);
const json = buildJson(regionTotals, countryTotals);
```

## Schema verification (2026-09-21)

Verified against the live `Nauticworx/Partner-Program-Mapbox` repo:
- `index.html` fetches `data/network-coverage.json` and reads only
  `coverage.regions` at the top level (does not read `_meta`).
- Per region: `id`, `name` (required — validated), `coordinates` (2-element
  array — validated), `uniqueAccounts` (headline), `charterers`/`brokers`/
  `fleetOwners`/`dualAccounts` (popup rows), `countries` (defaults to `[]` if
  absent/null — `(region.countries || []).forEach(...)`).
- Per country: same field set as region, all validated identically.
- No other JSON files are fetched by `index.html`.

`buildJson()`'s output was diffed structurally against the live demo file and
matches exactly (same top-level keys, same per-region/per-country key set,
`countries: []` handled gracefully by index.html's existing code).

## What is still manual

- **Persisting these files into the actual `Partner-Program-Mapbox` GitHub
  repo.** This session had no GitHub write access (no `gh` CLI, no PAT, no
  connector) — files were only read via the GitHub web API this session. A
  human (or a future session with GitHub write access) needs to add this
  `network-coverage/` folder to the repo via a normal commit/PR.
- Extending `COUNTRY_GEO` and a country→region map in `constants.js` before
  any country-level (non-blank-Country) rows are aggregated — none exist yet.
- Deciding when/how `network-coverage.test.json` output is promoted to
  `data/network-coverage.json` (the live file) — not done automatically by
  this pipeline, and not done this batch.
- Locating or formally retiring the original "Batch 2C" prototype reference —
  this implementation is a from-spec reconstruction, not a recovered copy of
  those original files.

## What future automation will do (not implemented yet)

Per the Batch 2F/2G documented rule: if `Region = Worldwide` AND
`Include_in_Network_Coverage = true` on a Klanten record, ensure exactly one
active geography row exists per canonical region (16 total), Country blank.
If `Region` is later changed away from `Worldwide`, the resulting rows should
be reconciled (reviewed/deactivated deliberately), never bulk-deleted. Country
rows are never auto-generated from `Worldwide` alone. None of this is wired
into a Zoho Flow, webhook, or scheduled job — it remains a documented rule for
a human or a future approved automation batch to implement.
