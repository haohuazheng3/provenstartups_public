/**
 * 把 data/en/<slug>.json 里 sources[i].quotes(data/source_quotes.py 产出)同步进库里的 projects.sources。
 * 只动 quotes 这一个键,其余字段与排名都不碰 —— 所以不用整套 import-projects.ts,
 * 也就不会顺手把 data/en 里还没上线的草稿(rank 0)导进来。按 video_url 对齐来源,对不上的来源跳过。
 *
 * 用法(在 site/ 下): npx tsx --env-file=.env.local scripts/sync-source-quotes.ts [--dry]
 * 跑完要 POST /api/admin/revalidate(项目页的 getProject 有 unstable_cache,见 CLAUDE.md 坑 45)
 */
// env 由 node --env-file=.env.local 注入
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { db, projects } from "../src/db";
import { eq } from "drizzle-orm";

type Quote = { t: number; text: string; lang?: string };
type Src = { video_url?: string; quotes?: Quote[] } & Record<string, unknown>;

const dry = process.argv.includes("--dry");
const EN = path.resolve(process.cwd(), "../data/en"); // 在 site/ 下运行

async function main() {
  const rows = await db.select({ slug: projects.slug, sources: projects.sources }).from(projects);
  const bySlug = new Map(rows.map((r) => [r.slug, (r.sources ?? []) as Src[]]));
  let changed = 0;
  let quotes = 0;
  let missing = 0;
  for (const f of readdirSync(EN).filter((n) => n.endsWith(".json"))) {
    let file: { slug?: string; sources?: Src[] };
    try {
      file = JSON.parse(readFileSync(path.join(EN, f), "utf8"));
    } catch {
      continue;
    }
    const cur = file.slug ? bySlug.get(file.slug) : undefined;
    if (!cur) {
      missing++;
      continue;
    }
    const want = new Map((file.sources ?? []).filter((s) => s.video_url).map((s) => [s.video_url!, s.quotes ?? []]));
    const next = cur.map((s) => {
      const q = s.video_url ? want.get(s.video_url) : undefined;
      if (q === undefined) return s;
      const rest = { ...s };
      delete rest.quotes;
      return q.length ? { ...rest, quotes: q } : rest;
    });
    if (JSON.stringify(next) === JSON.stringify(cur)) continue;
    changed++;
    quotes += next.reduce((n, s) => n + (s.quotes?.length ?? 0), 0);
    if (!dry) await db.update(projects).set({ sources: next as never }).where(eq(projects.slug, file.slug!));
  }
  console.log(`${dry ? "[dry] " : ""}${changed} projects updated, ${quotes} quotes in them; ${missing} files not in DB (drafts) skipped`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
