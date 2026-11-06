import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
const sourceDir = join(projectRoot, "data/en");
const outputDir = join(here, "../public/datasets/2026-09-18");
const sourceDate = "2026-09-18";

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

const evidenceOrder = [
  "Third-party verified",
  "Founder-reported",
  "Creator-relayed",
  "Unproven",
];
const tierOrder = ["Tier 1", "Tier 2", "Tier 3"];
const evidenceRows = [];
for (const evidence of evidenceOrder) {
  for (const tier of tierOrder) {
    const count = projects.filter(
      (project) => evidenceClass(project.evidence) === evidence && tierClass(project.tier) === tier,
    ).length;
    evidenceRows.push({
      evidence_class: evidence,
      editorial_tier: tier,
      project_count: count,
      share_of_406_percent: round((count / projects.length) * 100),
      snapshot_date: sourceDate,
    });
  }
}
writeCsv(
  "startup-revenue-evidence-by-tier",
  ["evidence_class", "editorial_tier", "project_count", "share_of_406_percent", "snapshot_date"],
  evidenceRows,
);
writeJson("startup-revenue-evidence-by-tier", evidenceRows);

const scoreKeys = ["tech", "acquisition", "capital", "competition", "validation"];
const categories = [...new Set(projects.map((project) => project.category))].sort();
const categoryRows = categories.map((category) => {
  const cohort = projects.filter((project) => project.category === category);
  return {
    category,
    project_count: cohort.length,
    share_of_406_percent: round((cohort.length / projects.length) * 100),
    verified_count: cohort.filter((project) => evidenceClass(project.evidence) === "Third-party verified").length,
    founder_reported_count: cohort.filter((project) => evidenceClass(project.evidence) === "Founder-reported").length,
    creator_relayed_count: cohort.filter((project) => evidenceClass(project.evidence) === "Creator-relayed").length,
    unproven_count: cohort.filter((project) => evidenceClass(project.evidence) === "Unproven").length,
    snapshot_date: sourceDate,
  };
});
writeCsv(
  "ai-startup-category-benchmark",
  [
    "category",
    "project_count",
    "share_of_406_percent",
    "verified_count",
    "founder_reported_count",
    "creator_relayed_count",
    "unproven_count",
    "snapshot_date",
  ],
  categoryRows,
);
writeJson("ai-startup-category-benchmark", categoryRows);

const difficultyRows = categories.map((category) => {
  const cohort = projects.filter((project) => project.category === category);
  const row = {
    category,
    project_count: cohort.length,
    score_scale: "1=easier; 5=harder",
    snapshot_date: sourceDate,
  };
  for (const key of scoreKeys) {
    row[`mean_${key}`] = round(
      cohort.reduce((sum, project) => sum + project.scores[key], 0) / cohort.length,
      2,
    );
  }
  row.mean_all_five_dimensions = round(
    scoreKeys.reduce((sum, key) => sum + row[`mean_${key}`], 0) / scoreKeys.length,
    2,
  );
  return row;
});
writeCsv(
  "ai-startup-difficulty-by-category",
  [
    "category",
    "project_count",
    "mean_tech",
    "mean_acquisition",
    "mean_capital",
    "mean_competition",
    "mean_validation",
    "mean_all_five_dimensions",
    "score_scale",
    "snapshot_date",
  ],
  difficultyRows,
);
writeJson("ai-startup-difficulty-by-category", difficultyRows);

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
const channelRows = channelTaxonomy.map(([channel, matcher]) => {
  const cohort = projects.filter((project) =>
    (project.quick_card?.channels ?? []).some((value) => matcher.test(value)),
  );
  return {
    normalized_channel: channel,
    projects_with_signal: cohort.length,
    share_of_406_percent: round((cohort.length / projects.length) * 100),
    denominator: projects.length,
    counting_rule: "One project counted at most once per normalized channel; projects may appear in multiple channels",
    snapshot_date: sourceDate,
  };
});
writeCsv(
  "startup-acquisition-channel-signals",
  [
    "normalized_channel",
    "projects_with_signal",
    "share_of_406_percent",
    "denominator",
    "counting_rule",
    "snapshot_date",
  ],
  channelRows,
);
writeJson("startup-acquisition-channel-signals", channelRows);

const publicCautionRows = projects
  .filter((project) => project.category === "⚠️ Cautionary Tale" && project.member_only !== true)
  .sort((a, b) => a.rank - b.rank)
  .map((project) => ({
    project_name: project.name,
    project_slug: project.slug,
    evidence_class: evidenceClass(project.evidence),
    revenue_or_outcome_as_reported: project.revenue,
    primary_source_url: project.sources?.[0]?.video_url ?? "",
    case_page_url: `https://provenstartups.com/projects/${project.slug}`,
    snapshot_date: sourceDate,
  }));
writeCsv(
  "public-cautionary-startup-cases",
  [
    "project_name",
    "project_slug",
    "evidence_class",
    "revenue_or_outcome_as_reported",
    "primary_source_url",
    "case_page_url",
    "snapshot_date",
  ],
  publicCautionRows,
);
writeJson("public-cautionary-startup-cases", publicCautionRows);

const manifest = {
  title: "ProvenStartups research asset manifest",
  version: sourceDate,
  source_record_count: projects.length,
  source_files: "data/en/*.json in the private ProvenStartups repository",
  generated_at: `${sourceDate}T09:20:00Z`,
  assets: [
    { slug: "startup-revenue-evidence-by-tier", rows: evidenceRows.length },
    { slug: "ai-startup-category-benchmark", rows: categoryRows.length },
    { slug: "ai-startup-difficulty-by-category", rows: difficultyRows.length },
    { slug: "startup-acquisition-channel-signals", rows: channelRows.length },
    { slug: "public-cautionary-startup-cases", rows: publicCautionRows.length },
  ],
  limitations: [
    "The 406-record index is a curated convenience sample, not a representative sample of all startups.",
    "Most revenue claims are unaudited founder or creator reports.",
    "Channel labels are normalized with the documented regular-expression taxonomy in site/scripts/build-research-assets.mjs.",
    "The row-level cautionary-case file includes only 22 public non-Pro cases; aggregate category counts use all 406 records.",
  ],
};
writeJson("manifest", manifest);

console.log(JSON.stringify(manifest, null, 2));
