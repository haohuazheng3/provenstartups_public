import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
const sourceDir = join(projectRoot, "data/en");
const outputDir = join(here, "../public/datasets/2026-09-30");
const snapshotDate = "2026-09-30";

const projects = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(join(sourceDir, name), "utf8")))
  .filter((project) => project.published !== false);

mkdirSync(outputDir, { recursive: true });

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, columns, rows) {
  const body = [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  writeFileSync(join(outputDir, `${name}.csv`), `${body}\n`);
}

function writeJson(name, value) {
  writeFileSync(join(outputDir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function evidenceClass(value = "") {
  if (value.startsWith("✅")) return "Third-party verified";
  if (value.startsWith("🗣")) return "Founder-reported";
  if (value.startsWith("📎")) return "Creator-relayed";
  return "Unproven";
}

function tierClass(value = "") {
  if (value.startsWith("Tier 1")) return "Tier 1";
  if (value.startsWith("Tier 2")) return "Tier 2";
  return "Tier 3";
}

const fullDenominator = projects.length;
const evidenceClasses = ["Third-party verified", "Founder-reported", "Creator-relayed", "Unproven"];

// Asset 1: language-based financial metric disclosure. Families intentionally
// overlap; this describes wording in the revenue field rather than audited
// accounting classifications or normalized values.
const metricFamilies = [
  ["Recurring revenue", /\bMRR\b|\bARR\b|recurring revenue|subscription revenue/i],
  ["Profit or net income", /\bprofit(?:able|ability)?\b|net income|net profit|take[- ]home|earnings/i],
  ["Gross or top-line revenue", /\brevenue\b|gross sales|gross revenue|top[- ]line|sales of/i],
  ["GMV or transaction volume", /\bGMV\b|gross merchandise value|transaction volume|sales volume/i],
  ["Valuation, funding, or exit value", /valuation|valued at|funding|raised|acqui(?:red|sition)|exit(?:ed)?|sold for/i],
  ["Cumulative or lifetime amount", /lifetime|all[- ]time|to date|cumulative|total sales|total revenue/i],
];
const metricRows = metricFamilies.map(([family, matcher]) => {
  const cohort = projects.filter((project) => matcher.test(project.revenue ?? ""));
  return {
    metric_language_family: family,
    project_count: cohort.length,
    share_of_full_sample_percent: round((cohort.length / fullDenominator) * 100),
    verified_count: cohort.filter((project) => evidenceClass(project.evidence) === "Third-party verified").length,
    founder_reported_count: cohort.filter((project) => evidenceClass(project.evidence) === "Founder-reported").length,
    creator_relayed_count: cohort.filter((project) => evidenceClass(project.evidence) === "Creator-relayed").length,
    unproven_count: cohort.filter((project) => evidenceClass(project.evidence) === "Unproven").length,
    counting_rule: "Language families overlap; matches describe wording, not audited accounting classifications",
    full_sample_denominator: fullDenominator,
    snapshot_date: snapshotDate,
  };
});
const noMetric = projects.filter((project) => !metricFamilies.some(([, matcher]) => matcher.test(project.revenue ?? "")));
metricRows.push({
  metric_language_family: "No recognized metric-family wording",
  project_count: noMetric.length,
  share_of_full_sample_percent: round((noMetric.length / fullDenominator) * 100),
  verified_count: noMetric.filter((project) => evidenceClass(project.evidence) === "Third-party verified").length,
  founder_reported_count: noMetric.filter((project) => evidenceClass(project.evidence) === "Founder-reported").length,
  creator_relayed_count: noMetric.filter((project) => evidenceClass(project.evidence) === "Creator-relayed").length,
  unproven_count: noMetric.filter((project) => evidenceClass(project.evidence) === "Unproven").length,
  counting_rule: "No listed recurring, profit, revenue, GMV, valuation/funding/exit, or cumulative token matched",
  full_sample_denominator: fullDenominator,
  snapshot_date: snapshotDate,
});
writeCsv("startup-financial-metric-language-audit", Object.keys(metricRows[0]), metricRows);
writeJson("startup-financial-metric-language-audit", metricRows);

// Asset 2: count structured source entries per record. Entries are links, not
// necessarily independent corroborating sources.
function sourceBand(project) {
  const count = project.sources?.length ?? 0;
  if (count === 0) return "0 sources";
  if (count === 1) return "1 source";
  if (count === 2) return "2 sources";
  return "3 or more sources";
}
const sourceBands = ["0 sources", "1 source", "2 sources", "3 or more sources"];
function sourceMultiplicityRows(segmentType, segment, cohort) {
  return sourceBands.map((band) => {
    const matched = cohort.filter((project) => sourceBand(project) === band);
    return {
      segment_type: segmentType,
      segment,
      structured_source_band: band,
      project_count: matched.length,
      share_within_segment_percent: round((matched.length / cohort.length) * 100),
      structured_source_entries: matched.reduce((sum, project) => sum + (project.sources?.length ?? 0), 0),
      segment_denominator: cohort.length,
      snapshot_date: snapshotDate,
    };
  });
}
const sourceMultiplicity = [
  ...sourceMultiplicityRows("Full sample", "All projects", projects),
  ...evidenceClasses.flatMap((label) => sourceMultiplicityRows("Evidence class", label, projects.filter((p) => evidenceClass(p.evidence) === label))),
  ...["Tier 1", "Tier 2", "Tier 3"].flatMap((label) => sourceMultiplicityRows("Editorial tier", label, projects.filter((p) => tierClass(p.tier) === label))),
];
writeCsv("startup-structured-source-multiplicity", Object.keys(sourceMultiplicity[0]), sourceMultiplicity);
writeJson("startup-structured-source-multiplicity", sourceMultiplicity);

// Asset 3: freshness of structured-source fetch dates. This measures when a
// source was collected, not when the underlying claim occurred or was verified.
function ageDays(date) {
  const parsed = Date.parse(date ?? "");
  if (!Number.isFinite(parsed)) return null;
  return Math.floor((Date.parse(`${snapshotDate}T00:00:00Z`) - parsed) / 86_400_000);
}
function freshnessBand(source) {
  const days = ageDays(source.fetched);
  if (days == null) return "Missing or invalid fetch date";
  if (days <= 30) return "0-30 days";
  if (days <= 90) return "31-90 days";
  if (days <= 180) return "91-180 days";
  return "More than 180 days";
}
const freshnessBands = ["0-30 days", "31-90 days", "91-180 days", "More than 180 days", "Missing or invalid fetch date"];
function freshnessRows(segmentType, segment, cohort) {
  const entries = cohort.flatMap((project) => project.sources ?? []);
  return freshnessBands.map((band) => {
    const matched = entries.filter((source) => freshnessBand(source) === band);
    const projectsMatched = cohort.filter((project) => (project.sources ?? []).some((source) => freshnessBand(source) === band));
    return {
      segment_type: segmentType,
      segment,
      source_fetch_age_band: band,
      structured_source_entries: matched.length,
      share_of_segment_source_entries_percent: entries.length ? round((matched.length / entries.length) * 100) : 0,
      unique_projects_with_band: projectsMatched.length,
      segment_source_entry_denominator: entries.length,
      snapshot_date: snapshotDate,
    };
  });
}
const sourceFreshness = [
  ...freshnessRows("Full sample", "All projects", projects),
  ...evidenceClasses.flatMap((label) => freshnessRows("Evidence class", label, projects.filter((p) => evidenceClass(p.evidence) === label))),
];
writeCsv("startup-source-fetch-freshness-audit", Object.keys(sourceFreshness[0]), sourceFreshness);
writeJson("startup-source-fetch-freshness-audit", sourceFreshness);

// Asset 4: opportunity-window labels crossed with evidence classes. Both are
// editorial labels; the table does not predict durability or commercial success.
function timingClass(value = "") {
  if (/evergreen/i.test(value)) return "Evergreen";
  if (/window of opportunity/i.test(value)) return "Window of opportunity";
  return "Other or unstated";
}
const timingClasses = ["Evergreen", "Window of opportunity", "Other or unstated"];
const timingEvidence = timingClasses.flatMap((timing) => {
  const timingCohort = projects.filter((project) => timingClass(project.timing) === timing);
  return evidenceClasses.map((evidence) => {
    const count = timingCohort.filter((project) => evidenceClass(project.evidence) === evidence).length;
    const evidenceDenominator = projects.filter((project) => evidenceClass(project.evidence) === evidence).length;
    return {
      opportunity_window: timing,
      evidence_class: evidence,
      project_count: count,
      share_within_window_percent: timingCohort.length ? round((count / timingCohort.length) * 100) : 0,
      share_within_evidence_class_percent: evidenceDenominator ? round((count / evidenceDenominator) * 100) : 0,
      window_denominator: timingCohort.length,
      evidence_class_denominator: evidenceDenominator,
      full_sample_denominator: fullDenominator,
      snapshot_date: snapshotDate,
    };
  });
});
writeCsv("startup-opportunity-window-evidence-matrix", Object.keys(timingEvidence[0]), timingEvidence);
writeJson("startup-opportunity-window-evidence-matrix", timingEvidence);

// Asset 5: Spearman rank correlation among the five ordinal editorial scores.
// Average ranks are used for tied values.
const scoreKeys = ["tech", "acquisition", "capital", "competition", "validation"];
function ranks(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const out = Array(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end += 1;
    const averageRank = (start + 1 + end) / 2;
    for (let i = start; i < end; i += 1) out[sorted[i].index] = averageRank;
    start = end;
  }
  return out;
}
function pearson(a, b) {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  const numerator = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const denominator = Math.sqrt(
    a.reduce((sum, value) => sum + (value - meanA) ** 2, 0) *
    b.reduce((sum, value) => sum + (value - meanB) ** 2, 0),
  );
  return denominator ? numerator / denominator : 0;
}
const rankedScores = Object.fromEntries(scoreKeys.map((key) => [key, ranks(projects.map((project) => project.scores[key]))]));
const correlationRows = scoreKeys.flatMap((rowDimension) => scoreKeys.map((columnDimension) => ({
  row_dimension: rowDimension,
  column_dimension: columnDimension,
  spearman_rank_correlation: round(pearson(rankedScores[rowDimension], rankedScores[columnDimension]), 3),
  project_count: fullDenominator,
  score_scale: "1=easier; 5=harder",
  tie_method: "Average rank for tied ordinal scores",
  snapshot_date: snapshotDate,
})));
writeCsv("startup-difficulty-score-correlation-matrix", Object.keys(correlationRows[0]), correlationRows);
writeJson("startup-difficulty-score-correlation-matrix", correlationRows);

const manifest = {
  title: "ProvenStartups research asset manifest",
  version: snapshotDate,
  source_record_count: fullDenominator,
  structured_source_entry_count: projects.reduce((sum, project) => sum + (project.sources?.length ?? 0), 0),
  source_files: "data/en/*.json in the private ProvenStartups repository",
  generated_at: `${snapshotDate}T05:00:00-04:00`,
  assets: [
    { slug: "startup-financial-metric-language-audit", rows: metricRows.length },
    { slug: "startup-structured-source-multiplicity", rows: sourceMultiplicity.length },
    { slug: "startup-source-fetch-freshness-audit", rows: sourceFreshness.length },
    { slug: "startup-opportunity-window-evidence-matrix", rows: timingEvidence.length },
    { slug: "startup-difficulty-score-correlation-matrix", rows: correlationRows.length },
  ],
  limitations: [
    `The ${fullDenominator.toLocaleString("en-US")}-record index is a curated convenience sample, not a representative sample of all startups.`,
    "Financial metric families are reproducible regular-expression matches, may overlap, and are not audited accounting classifications.",
    "Structured source counts measure attached entries, not source independence, truth, corroboration, or claim quality.",
    "Fetch-date age measures collection recency, not the date of the claim, publication, event, or independent verification.",
    "Opportunity windows and evidence classes are editorial labels and do not predict commercial outcomes.",
    "Difficulty correlations use ordinal editorial scores with average ranks for ties; association is not causation.",
    "All downloadable files contain aggregate results only; no restricted row-level project export is published.",
  ],
};
writeJson("manifest", manifest);
console.log(JSON.stringify(manifest, null, 2));
