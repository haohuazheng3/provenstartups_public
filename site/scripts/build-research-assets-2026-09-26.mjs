import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
const sourceDir = join(projectRoot, "data/en");
const outputDir = join(here, "../public/datasets/2026-09-26");
const snapshotDate = "2026-09-26";

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

const categories = [...new Set(projects.map((project) => project.category))].sort();
const fullDenominator = projects.length;

// Asset 1: explicit region disclosure. Missing values remain missing rather than
// being inferred from names, languages, currencies, channels, or source hosts.
const explicitRegionProjects = projects.filter((project) => project.region?.trim());
const regionCounts = new Map();
for (const project of explicitRegionProjects) {
  const region = project.region.trim();
  regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
}
const regionRows = [
  {
    region: "Not stated",
    project_count: fullDenominator - explicitRegionProjects.length,
    share_of_full_sample_percent: round(((fullDenominator - explicitRegionProjects.length) / fullDenominator) * 100),
    share_of_explicit_region_subset_percent: "not applicable",
    full_sample_denominator: fullDenominator,
    explicit_region_denominator: explicitRegionProjects.length,
    snapshot_date: snapshotDate,
  },
  ...[...regionCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([region, count]) => ({
      region,
      project_count: count,
      share_of_full_sample_percent: round((count / fullDenominator) * 100),
      share_of_explicit_region_subset_percent: round((count / explicitRegionProjects.length) * 100),
      full_sample_denominator: fullDenominator,
      explicit_region_denominator: explicitRegionProjects.length,
      snapshot_date: snapshotDate,
    })),
];
writeCsv(
  "startup-region-disclosure-audit",
  [
    "region",
    "project_count",
    "share_of_full_sample_percent",
    "share_of_explicit_region_subset_percent",
    "full_sample_denominator",
    "explicit_region_denominator",
    "snapshot_date",
  ],
  regionRows,
);
writeJson("startup-region-disclosure-audit", regionRows);

// Asset 2: time-basis language in the revenue field. Signals overlap by design;
// the no-token row is the complement of the union, not a sum residual.
const cadenceSignals = [
  ["Monthly run-rate language", /\bMRR\b|\/\s*mo(?:nth)?\b|\bper month\b|\bmonthly\b/i],
  ["Annual run-rate language", /\bARR\b|\/\s*y(?:ea)?r\b|\bper year\b|\bannual(?:ly)?\b|\byearly\b/i],
  ["Cumulative or lifetime language", /\blifetime\b|\ball[- ]time\b|\bto date\b|\btotal(?:led)?\b|\bcumulative\b/i],
  ["Daily or weekly language", /\/\s*day\b|\bper day\b|\bdaily\b|\/\s*w(?:ee)?k\b|\bper week\b|\bweekly\b/i],
];
const cadenceRows = cadenceSignals.map(([signal, matcher]) => {
  const cohort = projects.filter((project) => matcher.test(project.revenue ?? ""));
  return {
    time_basis_signal: signal,
    project_count: cohort.length,
    share_of_full_sample_percent: round((cohort.length / fullDenominator) * 100),
    verified_count: cohort.filter((project) => evidenceClass(project.evidence) === "Third-party verified").length,
    founder_reported_count: cohort.filter((project) => evidenceClass(project.evidence) === "Founder-reported").length,
    creator_relayed_count: cohort.filter((project) => evidenceClass(project.evidence) === "Creator-relayed").length,
    unproven_count: cohort.filter((project) => evidenceClass(project.evidence) === "Unproven").length,
    counting_rule: "Signals overlap when one revenue field contains more than one time basis",
    full_sample_denominator: fullDenominator,
    snapshot_date: snapshotDate,
  };
});
const projectsWithCadence = projects.filter((project) =>
  cadenceSignals.some(([, matcher]) => matcher.test(project.revenue ?? "")),
);
const noCadence = projects.filter((project) => !projectsWithCadence.includes(project));
cadenceRows.push({
  time_basis_signal: "No recognized time-basis token",
  project_count: noCadence.length,
  share_of_full_sample_percent: round((noCadence.length / fullDenominator) * 100),
  verified_count: noCadence.filter((project) => evidenceClass(project.evidence) === "Third-party verified").length,
  founder_reported_count: noCadence.filter((project) => evidenceClass(project.evidence) === "Founder-reported").length,
  creator_relayed_count: noCadence.filter((project) => evidenceClass(project.evidence) === "Creator-relayed").length,
  unproven_count: noCadence.filter((project) => evidenceClass(project.evidence) === "Unproven").length,
  counting_rule: "No monthly, annual, cumulative/lifetime, daily, or weekly token matched",
  full_sample_denominator: fullDenominator,
  snapshot_date: snapshotDate,
});
writeCsv(
  "startup-revenue-time-basis-audit",
  [
    "time_basis_signal",
    "project_count",
    "share_of_full_sample_percent",
    "verified_count",
    "founder_reported_count",
    "creator_relayed_count",
    "unproven_count",
    "counting_rule",
    "full_sample_denominator",
    "snapshot_date",
  ],
  cadenceRows,
);
writeJson("startup-revenue-time-basis-audit", cadenceRows);

// Shared, documented channel taxonomy used by the earlier frequency and pair
// assets. Breadth is the count of distinct normalized families per project.
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
function channelBreadth(project) {
  const values = project.quick_card?.channels ?? [];
  return channelTaxonomy.filter(([, matcher]) => values.some((value) => matcher.test(value))).length;
}
function breadthRowsForSegment(segmentType, segment, cohort) {
  return Array.from({ length: channelTaxonomy.length + 1 }, (_, breadth) => {
    const count = cohort.filter((project) => channelBreadth(project) === breadth).length;
    return {
      segment_type: segmentType,
      segment,
      normalized_channel_family_count: breadth,
      project_count: count,
      share_within_segment_percent: round((count / cohort.length) * 100),
      segment_denominator: cohort.length,
      taxonomy_family_count: channelTaxonomy.length,
      snapshot_date: snapshotDate,
    };
  });
}
const breadthRows = [
  ...breadthRowsForSegment("Full sample", "All projects", projects),
  ...["Tier 1", "Tier 2", "Tier 3"].flatMap((tier) =>
    breadthRowsForSegment("Editorial tier", tier, projects.filter((project) => tierClass(project.tier) === tier)),
  ),
];
writeCsv(
  "startup-acquisition-breadth-distribution",
  [
    "segment_type",
    "segment",
    "normalized_channel_family_count",
    "project_count",
    "share_within_segment_percent",
    "segment_denominator",
    "taxonomy_family_count",
    "snapshot_date",
  ],
  breadthRows,
);
writeJson("startup-acquisition-breadth-distribution", breadthRows);

// Asset 4: which of the five editorial difficulty dimensions is tied for the
// highest score in each project. Ties are retained, so shares can exceed 100%.
const scoreKeys = ["tech", "acquisition", "capital", "competition", "validation"];
function bottleneckRowsForSegment(segmentType, segment, cohort) {
  return scoreKeys.map((dimension) => {
    const count = cohort.filter((project) => {
      const maxScore = Math.max(...scoreKeys.map((key) => project.scores[key]));
      return project.scores[dimension] === maxScore;
    }).length;
    const uniqueCount = cohort.filter((project) => {
      const maxScore = Math.max(...scoreKeys.map((key) => project.scores[key]));
      return project.scores[dimension] === maxScore && scoreKeys.filter((key) => project.scores[key] === maxScore).length === 1;
    }).length;
    return {
      segment_type: segmentType,
      segment,
      difficulty_dimension: dimension,
      tied_for_highest_count: count,
      tied_for_highest_share_percent: round((count / cohort.length) * 100),
      unique_highest_count: uniqueCount,
      unique_highest_share_percent: round((uniqueCount / cohort.length) * 100),
      segment_denominator: cohort.length,
      score_scale: "1=easier; 5=harder",
      snapshot_date: snapshotDate,
    };
  });
}
const bottleneckRows = [
  ...bottleneckRowsForSegment("Full sample", "All projects", projects),
  ...categories.flatMap((category) =>
    bottleneckRowsForSegment("Business-model category", category, projects.filter((project) => project.category === category)),
  ),
];
writeCsv(
  "startup-difficulty-bottleneck-benchmark",
  [
    "segment_type",
    "segment",
    "difficulty_dimension",
    "tied_for_highest_count",
    "tied_for_highest_share_percent",
    "unique_highest_count",
    "unique_highest_share_percent",
    "segment_denominator",
    "score_scale",
    "snapshot_date",
  ],
  bottleneckRows,
);
writeJson("startup-difficulty-bottleneck-benchmark", bottleneckRows);

// Asset 5: structured-source host concentration. This measures where links
// point, not source independence, accuracy, ownership, or claim quality.
function normalizedHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    return host === "youtu.be" ? "youtube.com" : host;
  } catch {
    return "invalid-or-missing-url";
  }
}
const sourceRowsRaw = projects.flatMap((project) =>
  (project.sources ?? []).map((source, index) => ({
    slug: project.slug,
    host: normalizedHost(source.video_url ?? ""),
    isPrimary: index === 0,
  })),
);
const hosts = [...new Set(sourceRowsRaw.map((row) => row.host))];
const sourceDomainRows = hosts
  .map((host) => {
    const entries = sourceRowsRaw.filter((row) => row.host === host);
    return {
      source_host: host,
      structured_source_entries: entries.length,
      share_of_all_source_entries_percent: round((entries.length / sourceRowsRaw.length) * 100),
      unique_projects_with_host: new Set(entries.map((row) => row.slug)).size,
      primary_source_projects: new Set(entries.filter((row) => row.isPrimary).map((row) => row.slug)).size,
      all_source_entries_denominator: sourceRowsRaw.length,
      full_sample_denominator: fullDenominator,
      snapshot_date: snapshotDate,
    };
  })
  .sort((a, b) => b.structured_source_entries - a.structured_source_entries || a.source_host.localeCompare(b.source_host));
sourceDomainRows.push({
  source_host: "No structured source attached",
  structured_source_entries: 0,
  share_of_all_source_entries_percent: 0,
  unique_projects_with_host: projects.filter((project) => !(project.sources?.length)).length,
  primary_source_projects: 0,
  all_source_entries_denominator: sourceRowsRaw.length,
  full_sample_denominator: fullDenominator,
  snapshot_date: snapshotDate,
});
writeCsv(
  "startup-source-domain-concentration",
  [
    "source_host",
    "structured_source_entries",
    "share_of_all_source_entries_percent",
    "unique_projects_with_host",
    "primary_source_projects",
    "all_source_entries_denominator",
    "full_sample_denominator",
    "snapshot_date",
  ],
  sourceDomainRows,
);
writeJson("startup-source-domain-concentration", sourceDomainRows);

const manifest = {
  title: "ProvenStartups research asset manifest",
  version: snapshotDate,
  source_record_count: fullDenominator,
  structured_source_entry_count: sourceRowsRaw.length,
  source_files: "data/en/*.json in the private ProvenStartups repository",
  generated_at: `${snapshotDate}T05:00:00-04:00`,
  assets: [
    { slug: "startup-region-disclosure-audit", rows: regionRows.length },
    { slug: "startup-revenue-time-basis-audit", rows: cadenceRows.length },
    { slug: "startup-acquisition-breadth-distribution", rows: breadthRows.length },
    { slug: "startup-difficulty-bottleneck-benchmark", rows: bottleneckRows.length },
    { slug: "startup-source-domain-concentration", rows: sourceDomainRows.length },
  ],
  limitations: [
    `The ${fullDenominator.toLocaleString("en-US")}-record index is a curated convenience sample, not a representative sample of all startups.`,
    "Region is reported only when explicitly present in the coded record; missing locations are not inferred.",
    "Revenue time-basis signals are reproducible regular-expression matches and can overlap or miss uncommon phrasing.",
    "Acquisition breadth uses eight normalized text-match families and does not measure spend, sequence, conversion, or effectiveness.",
    "Difficulty bottlenecks use editorial ordinal scores; ties are retained and category shares can sum above 100 percent.",
    "Source-host concentration measures structured link destinations, not source independence, accuracy, ownership, or claim quality.",
    "All downloadable files contain aggregate results only; no restricted row-level project export is published.",
  ],
};
writeJson("manifest", manifest);

console.log(JSON.stringify(manifest, null, 2));
