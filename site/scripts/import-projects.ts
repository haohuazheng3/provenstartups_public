/**
 * 把 data/en/<slug>.json(英文成品)+ 中文 transcript 导入 Neon。
 * 幂等:按 slug upsert;transcript 按 (slug, sourceIndex) upsert。
 * 用法: npx tsx scripts/import-projects.ts
 */
import fs from "fs";
import path from "path";
import { db, projects, transcripts } from "../src/db";

const DATA = path.resolve(process.cwd(), "../data");
const EN = path.join(DATA, "en");
const ZH_FULL = path.join(DATA, "parsed", "projects_zh_full.json");

/** 原始导入的 201 个项目。之后的编号都属于 YouTube 挖出来的批次。 */
const IMPORTED_MAX_RANK = 201;

/**
 * 会员专供的归属由 slug 决定,不看源文件里的 member_only ——
 * 分析子代理是照着模板文件写的,模板恰好是个会员专供项目,于是整批都跟着变成了 true。
 *
 * YouTube 批次里约三分之一设为专供:全部专供的话 sitemap 会把这一整批挡在
 * 搜索之外,而目录站的流量正是从这些长尾页面来的。哈希取 slug 而非 rank,
 * 这样再导入几十个新项目也不会把已有项目的归属翻来覆去。
 */
function memberOnlyFor(p: { slug: string; rank: number; member_only?: boolean }) {
  if (p.rank <= IMPORTED_MAX_RANK) return p.member_only ?? false;
  let h = 0;
  for (const ch of p.slug) h = (h * 31 + ch.charCodeAt(0)) % 100003;
  return h % 3 === 0;
}

type EnProject = {
  slug: string;
  rank: number;
  tier: string;
  category: string;
  timing: string;
  evidence: string;
  name: string;
  tagline: string;
  revenue?: string | null;
  team?: string | null;
  region?: string | null;
  difficulty_dots?: number | null;
  one_liner?: string | null;
  scores?: Record<string, number> | null;
  potential_stars?: number | null;
  deep_dive?: { num: string; title: string; content: string }[];
  quick_card?: Record<string, unknown> | null;
  credibility?: string | null;
  build_prompt?: string | null;
  seo_prompt?: string | null;
  sources?: Record<string, unknown>[];
  member_only?: boolean;
  origin?: string;
};

async function main() {
  const files = fs.readdirSync(EN).filter((f) => f.endsWith(".json"));
  console.log(`found ${files.length} english project files`);

  const zhAll: { slug: string; sources?: { transcript?: string }[] }[] = JSON.parse(
    fs.readFileSync(ZH_FULL, "utf8")
  );
  const zhBySlug = new Map(zhAll.map((p) => [p.slug, p]));

  let ok = 0;
  let trCount = 0;
  const errors: string[] = [];

  // 先整批解析一遍。一个文件坏掉只该丢它自己 ——
  // 这一步以前没有 try,某个源文件里一个未转义的换行就能挡下全部导入。
  const parsed: [file: string, project: EnProject][] = [];
  for (const f of files) {
    try {
      parsed.push([f, JSON.parse(fs.readFileSync(path.join(EN, f), "utf8")) as EnProject]);
    } catch (e) {
      errors.push(`${f}: unparseable — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // YouTube 来源的新项目 rank=0,排在导入项目之后按加入顺序编号
  let nextRank = parsed.reduce((m, [, p]) => Math.max(m, p.rank ?? 0), 0);
  const assigned: [file: string, rank: number][] = [];

  for (const [f, p] of parsed) {
    try {
      const zh = zhBySlug.get(p.slug);
      if (!p.rank || p.rank <= 0) {
        p.rank = ++nextRank;
        // 编号写回源文件。不写回的话下一次导入会按字母序重编,
        // 新增几个文件就把已有项目的序号整片挪位。
        assigned.push([f, p.rank]);
      }

      // sources 加 has_transcript 标记(前端据此提示)
      const srcs = (p.sources ?? []).map((s, i) => ({
        ...s,
        has_transcript: !!zh?.sources?.[i]?.transcript,
      }));

      const values = {
        slug: p.slug,
        rank: p.rank,
        tier: p.tier,
        category: p.category,
        timing: p.timing,
        evidence: p.evidence,
        name: p.name,
        tagline: p.tagline,
        revenue: p.revenue ?? null,
        team: p.team ?? null,
        region: p.region ?? null,
        difficultyDots: p.difficulty_dots ?? null,
        oneLiner: p.one_liner ?? null,
        scores: p.scores ?? null,
        potentialStars: p.potential_stars ?? null,
        deepDive: p.deep_dive ?? null,
        quickCard: (p.quick_card as never) ?? null,
        credibility: p.credibility ?? null,
        buildPrompt: p.build_prompt ?? null,
        seoPrompt: p.seo_prompt ?? null,
        sources: srcs as never,
        memberOnly: memberOnlyFor(p),
        origin: p.origin ?? "imported",
        updatedAt: new Date(),
      };

      await db
        .insert(projects)
        .values(values)
        .onConflictDoUpdate({ target: projects.slug, set: values });

      // transcripts(中文原文)
      for (let i = 0; i < (zh?.sources?.length ?? 0); i++) {
        const t = zh!.sources![i]?.transcript;
        if (!t) continue;
        await db
          .insert(transcripts)
          .values({ projectSlug: p.slug, sourceIndex: i, lang: "zh", content: t })
          .onConflictDoUpdate({
            target: [transcripts.projectSlug, transcripts.sourceIndex],
            set: { content: t, lang: "zh" },
          });
        trCount++;
      }
      ok++;
    } catch (e) {
      errors.push(`${f}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const [f, rank] of assigned) {
    const fp = path.join(EN, f);
    const j = JSON.parse(fs.readFileSync(fp, "utf8"));
    j.rank = rank;
    fs.writeFileSync(fp, JSON.stringify(j, null, 1) + "\n");
  }
  if (assigned.length) console.log(`assigned + wrote back ${assigned.length} ranks`);

  console.log(`imported ${ok}/${files.length} projects, ${trCount} transcripts`);
  if (errors.length) {
    console.error("errors:");
    errors.forEach((e) => console.error("  " + e));
    process.exitCode = 1;
  }

  const rows = await db.select({ slug: projects.slug }).from(projects);
  console.log(`db now has ${rows.length} projects`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
