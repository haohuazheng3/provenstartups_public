import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
const sourceDir = join(projectRoot, "data/en");
const outputDir = join(here, "../public/datasets/2026-09-22");
const snapshotDate = "2026-09-22";

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

function evidenceClass(value) {
  if (value.startsWith("✅")) return "Third-party verified";
  if (value.startsWith("🗣")) return "Founder-reported";
  if (value.startsWith("📎")) return "Creator-relayed";
  return "Unproven";
}

function tierClass(value) {
  if (value.startsWith("Tier 1")) return "Tier 1";
  if (value.startsWith("Tier 2")) return "Tier 2";
  return "Tier 3";
}

function quantile(sorted, q) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const remainder = position - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + remainder * (next - sorted[base]);
}

// Asset 1: source coverage. This counts only structured source records, not links
// embedded in prose, and therefore gives a conservative, reproducible audit.
const evidenceOrder = [
  "Third-party verified",
  "Founder-reported",
  "Creator-relayed",
  "Unproven",
];
const sourceCoverageRows = [];
for (const evidence of evidenceOrder) {
  const cohort = projects.filter((project) => evidenceClass(project.evidence) === evidence);
  for (const bucket of ["0", "1", "2+"]) {
    const count = cohort.filter((project) => {
      const sourceCount = project.sources?.length ?? 0;
      return bucket === "2+" ? sourceCount >= 2 : sourceCount === Number(bucket);
    }).length;
    sourceCoverageRows.push({
      evidence_class: evidence,
      structured_source_count: bucket,
      project_count: count,
      share_within_evidence_percent: round((count / cohort.length) * 100),
      evidence_class_denominator: cohort.length,
      full_sample_denominator: projects.length,
      snapshot_date: snapshotDate,
    });
  }
}
writeCsv(
  "startup-source-coverage-audit",
  [
    "evidence_class",
    "structured_source_count",
    "project_count",
    "share_within_evidence_percent",
    "evidence_class_denominator",
    "full_sample_denominator",
    "snapshot_date",
  ],
  sourceCoverageRows,
);
writeJson("startup-source-coverage-audit", sourceCoverageRows);

// Asset 2: editorial timing by business model. Timing is a two-value editorial
// label in every source record; it is not a forecast or a measured survival rate.
const categories = [...new Set(projects.map((project) => project.category))].sort();
const timingRows = categories.map((category) => {
  const cohort = projects.filter((project) => project.category === category);
  const evergreen = cohort.filter((project) => project.timing.startsWith("🌲")).length;
  const window = cohort.filter((project) => project.timing.startsWith("⏳")).length;
  return {
    category,
    project_count: cohort.length,
    evergreen_count: evergreen,
    evergreen_share_percent: round((evergreen / cohort.length) * 100),
    window_of_opportunity_count: window,
    window_of_opportunity_share_percent: round((window / cohort.length) * 100),
    full_sample_denominator: projects.length,
    snapshot_date: snapshotDate,
  };
});
writeCsv(
  "startup-opportunity-window-by-category",
  [
    "category",
    "project_count",
    "evergreen_count",
    "evergreen_share_percent",
    "window_of_opportunity_count",
    "window_of_opportunity_share_percent",
    "full_sample_denominator",
    "snapshot_date",
  ],
  timingRows,
);
writeJson("startup-opportunity-window-by-category", timingRows);

// Asset 3: conservative one-person signal. The rule intentionally requires the
// team field to begin with an explicit solo/one-person phrase and does not infer
// headcount from names, company type, or revenue.
const soloSignal = /^(solo\b|one person\b|one-person\b|1 person\b)/i;
const soloRows = categories.map((category) => {
  const cohort = projects.filter((project) => project.category === category);
  const signaled = cohort.filter((project) => soloSignal.test(project.team ?? "")).length;
  return {
    category,
    project_count: cohort.length,
    explicit_solo_or_one_person_signal_count: signaled,
    explicit_signal_share_percent: round((signaled / cohort.length) * 100),
    no_explicit_signal_count: cohort.length - signaled,
    counting_rule: "team text begins solo, one person, one-person, or 1 person",
    full_sample_denominator: projects.length,
    snapshot_date: snapshotDate,
  };
});
writeCsv(
  "solo-founder-operability-by-category",
  [
    "category",
    "project_count",
    "explicit_solo_or_one_person_signal_count",
    "explicit_signal_share_percent",
    "no_explicit_signal_count",
    "counting_rule",
    "full_sample_denominator",
    "snapshot_date",
  ],
  soloRows,
);
writeJson("solo-founder-operability-by-category", soloRows);

// Asset 4: composite difficulty distribution. Composite is the arithmetic mean
// of five editorial scores (tech, acquisition, capital, competition, validation).
const scoreKeys = ["tech", "acquisition", "capital", "competition", "validation"];
function compositeScore(project) {
  return scoreKeys.reduce((sum, key) => sum + project.scores[key], 0) / scoreKeys.length;
}
function distributionRow(segmentType, segment, cohort) {
  const scores = cohort.map(compositeScore).sort((a, b) => a - b);
  return {
    segment_type: segmentType,
    segment,
    project_count: cohort.length,
    mean_composite_difficulty: round(scores.reduce((sum, score) => sum + score, 0) / scores.length, 2),
    p25_composite_difficulty: round(quantile(scores, 0.25), 2),
    median_composite_difficulty: round(quantile(scores, 0.5), 2),
    p75_composite_difficulty: round(quantile(scores, 0.75), 2),
    share_at_or_above_3_5_percent: round((scores.filter((score) => score >= 3.5).length / scores.length) * 100),
    score_definition: "mean of five editorial 1=easier to 5=harder scores",
    snapshot_date: snapshotDate,
  };
}
const difficultyRows = [
  distributionRow("Full sample", "All projects", projects),
  ...evidenceOrder.map((evidence) =>
    distributionRow(
      "Evidence class",
      evidence,
      projects.filter((project) => evidenceClass(project.evidence) === evidence),
    ),
  ),
  ...["Tier 1", "Tier 2", "Tier 3"].map((tier) =>
    distributionRow(
      "Editorial tier",
      tier,
      projects.filter((project) => tierClass(project.tier) === tier),
    ),
  ),
];
writeCsv(
  "startup-difficulty-distribution",
  [
    "segment_type",
    "segment",
    "project_count",
    "mean_composite_difficulty",
    "p25_composite_difficulty",
    "median_composite_difficulty",
    "p75_composite_difficulty",
    "share_at_or_above_3_5_percent",
    "score_definition",
    "snapshot_date",
  ],
  difficultyRows,
);
writeJson("startup-difficulty-distribution", difficultyRows);

// Asset 5: channel-pair co-occurrence using the same public taxonomy as the
// 2026-09-18 channel-frequency asset, now measuring combinations rather than
// individual channel prevalence.
const channelTaxonomy = [
  ["Search and SEO", /\bseo\b|search|aso|app store|amazon|etsy|google|programmatic/i],
  ["Organic social", /instagram|tiktok|reels|shorts|twitter|\bx\b|linkedin|facebook|pinterest|douyin|xiaohongshu|wechat/i],
  ["Video and editorial content", /youtube|content|blog|newsletter|podcast|webinar|editorial/i],
  ["Communities", /reddit|discord|community|forum|hacker news|product hunt|indie hackers|skool/i],
  ["Paid acquisition", /\bads?\b|paid|sponsor|influencer|apple search ads/i],
  ["Referrals and partnerships", /refer|affiliate|partner|accountant|agency|word of mouth|marketplace/i],
  ["Founder-led outbound and sales", /outbound|cold|direct sales|founder-led|dm|email outreach|business development|sales call/i],
  ["Product-led and free tools", /freemium|free tool|watermark|viral|product-led|template|lead magnet/i],
];
const channelSets = new Map(
  channelTaxonomy.map(([channel, matcher]) => [
    channel,
    new Set(
      projects
        .filter((project) => (project.quick_card?.channels ?? []).some((value) => matcher.test(value)))
        .map((project) => project.slug),
    ),
  ]),
);
const channelPairRows = [];
for (let left = 0; left < channelTaxonomy.length; left += 1) {
  for (let right = left + 1; right < channelTaxonomy.length; right += 1) {
    const channelA = channelTaxonomy[left][0];
    const channelB = channelTaxonomy[right][0];
    const setA = channelSets.get(channelA);
    const setB = channelSets.get(channelB);
    const intersection = [...setA].filter((slug) => setB.has(slug)).length;
    const union = new Set([...setA, ...setB]).size;
    channelPairRows.push({
      channel_a: channelA,
      channel_b: channelB,
      projects_with_both_signals: intersection,
      share_of_406_percent: round((intersection / projects.length) * 100),
      channel_a_projects: setA.size,
      channel_b_projects: setB.size,
      jaccard_percent: round((intersection / union) * 100),
      counting_rule: "one project per pair; projects may appear in multiple pairs",
      snapshot_date: snapshotDate,
    });
  }
}
channelPairRows.sort(
  (a, b) => b.projects_with_both_signals - a.projects_with_both_signals ||
    a.channel_a.localeCompare(b.channel_a) ||
    a.channel_b.localeCompare(b.channel_b),
);
writeCsv(
  "startup-acquisition-channel-pairs",
  [
    "channel_a",
    "channel_b",
    "projects_with_both_signals",
    "share_of_406_percent",
    "channel_a_projects",
    "channel_b_projects",
    "jaccard_percent",
    "counting_rule",
    "snapshot_date",
  ],
  channelPairRows,
);
writeJson("startup-acquisition-channel-pairs", channelPairRows);

const manifest = {
  title: "ProvenStartups research asset manifest",
  version: snapshotDate,
  source_record_count: projects.length,
  source_files: "data/en/*.json in the private ProvenStartups repository",
  generated_at: `${snapshotDate}T08:00:00-04:00`,
  assets: [
    { slug: "startup-source-coverage-audit", rows: sourceCoverageRows.length },
    { slug: "startup-opportunity-window-by-category", rows: timingRows.length },
    { slug: "solo-founder-operability-by-category", rows: soloRows.length },
    { slug: "startup-difficulty-distribution", rows: difficultyRows.length },
    { slug: "startup-acquisition-channel-pairs", rows: channelPairRows.length },
  ],
  limitations: [
    "The 406-record index is a curated convenience sample, not a representative sample of all startups.",
    "Source coverage counts structured source records only; links embedded in editorial prose are not counted.",
    "Timing, team descriptions, tiers, and difficulty scores are editorial classifications rather than measured causal variables.",
    "The solo signal uses a conservative text-prefix rule and should not be read as verified current headcount.",
    "Channel pairs come from a documented regular-expression taxonomy and can contain false positives or omit synonyms.",
    "All files contain aggregate results only; no restricted row-level project export is published.",
  ],
};
writeJson("manifest", manifest);

console.log(JSON.stringify(manifest, null, 2));
