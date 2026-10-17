/**
 * 本地渲染一期 The Drop(不发信),把 HTML / 纯文本落盘看版式。
 * 用法: node --env-file=.env.local ./node_modules/.bin/tsx scripts/drop-preview.ts <请求 JSON:{slugs,content,issue?}> <输出目录>
 * 请求 JSON 与 POST /api/admin/drops 的 body 同格式(mode 字段忽略)。
 */
import fs from "fs";
import path from "path";
import { checkDropContent, loadDropProjects, renderDropWithinLimit, dropStats } from "../src/lib/drop-email";

async function main() {
  const [reqFile, outDir = "/tmp"] = process.argv.slice(2);
  const req = JSON.parse(fs.readFileSync(reqFile, "utf8"));
  const list = await loadDropProjects(req.slugs);
  const problems = checkDropContent(req.content, req.slugs, list);
  const out = renderDropWithinLimit(req.content, list, { issue: req.issue ?? 1, date: new Date() });
  fs.writeFileSync(path.join(outDir, "drop-preview.html"), out.html);
  fs.writeFileSync(path.join(outDir, "drop-preview.txt"), out.text);
  console.log(JSON.stringify({ problems, bytes: out.bytes, restShown: out.restShown, restTotal: out.restTotal, stats: dropStats(list) }));
}
main().then(() => process.exit(0));
