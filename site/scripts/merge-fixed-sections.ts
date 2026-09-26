/**
 * 把 data/fixed/out/<slug>.json 里的四个固定段并进 projects.deep_dive:
 *   新 deep_dive = [01 原第一段(标题保持,编号 01)] + [02–05 固定段] + [原第二段起的所有段,重新编号 06…]
 * 幂等:若 deep_dive 里已含四个固定标题则跳过(避免重复插入)。
 * 同步写回 data/en/<slug>.json(存在时),这样 import-projects.ts 再跑也不会把固定段冲掉。
 * 用法:node --env-file=.env.local ./node_modules/.bin/tsx scripts/merge-fixed-sections.ts [--apply]
 */
import fs from "fs";
import path from "path";
import { db, projects } from "../src/db";
import { eq } from "drizzle-orm";

const FIXED = ["Getting the first customers from zero", "How the first dollar came in", "How the flywheel started turning", "Surviving the no-feedback stretch"];
const OUT = path.resolve(__dirname, "../../data/fixed/out");
const EN = path.resolve(__dirname, "../../data/en");
const apply = process.argv.includes("--apply");

type Sec = { num: string | null; title: string | null; content: string | null };

function merge(existing: Sec[], fixed: Sec[]): Sec[] | null {
  if (!existing.length) return null;
  const titles = new Set(existing.map((s) => (s.title || "").trim()));
  if (FIXED.every((t) => titles.has(t))) return null; // 已合并过
  const first = { ...existing[0], num: "01" };
  const rest = existing.slice(1).map((s, i) => ({ ...s, num: String(i + 6).padStart(2, "0") }));
  return [first, ...fixed.map((s) => ({ num: s.num, title: s.title, content: s.content })), ...rest];
}

async function main() {
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".json"));
  let merged = 0, skipped = 0, missing = 0, bad = 0;
  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    let data: { slug: string; sections: Sec[] };
    try { data = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")); } catch { bad++; continue; }
    const secs = data.sections ?? [];
    if (secs.length !== 4 || secs.some((s, i) => s.title !== FIXED[i] || !s.content)) { bad++; console.log("  ✗ 结构不合规:", slug); continue; }
    const [row] = await db.select({ deepDive: projects.deepDive }).from(projects).where(eq(projects.slug, slug)).limit(1);
    if (!row) { missing++; continue; }
    const next = merge(row.deepDive ?? [], secs);
    if (!next) { skipped++; continue; }
    if (apply) {
      await db.update(projects).set({ deepDive: next, updatedAt: new Date() }).where(eq(projects.slug, slug));
      const enPath = path.join(EN, `${slug}.json`);
      if (fs.existsSync(enPath)) {
        const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
        en.deep_dive = next; fs.writeFileSync(enPath, JSON.stringify(en, null, 1) + "\n");
      }
    }
    merged++;
  }
  console.log(`${apply ? "已合并" : "dry-run 将合并"} ${merged} | 已合并过跳过 ${skipped} | 库里无此 slug ${missing} | 结构不合规 ${bad} | 输出文件总数 ${files.length}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
