#!/usr/bin/env node
/**
 * 把 Clerk 的两个浏览器包(clerk-js + @clerk/ui)放到自己的域名下:public/clerk-bundle/<包>@<版本>/。
 *
 * 为什么(2026-11-01):两个包原来从 cdn.jsdelivr.net 拉(见 CLAUDE.md 坑 18),FlowGlance 30 天里
 * 记到约 15 个真人(多在中国大陆:南昌、嘉兴、深圳……)"SCRIPT failed to load"——jsDelivr 在那边时通时断,
 * 登录框根本出不来。页面本身是从我们域名加载成功的,所以同源的静态文件对这些人同样可达,还走 Vercel CDN、
 * 不经函数(proxy.ts 的 matcher 已排除 clerk-bundle/)。
 *
 * 两个包都按 document.currentScript 的目录去找分包,所以只要入口和它的分包放在同一目录。
 * 每个包的 dist 里有好几套构建(browser / legacy / native / 不同 hash),这里只拷入口引用的那一套。
 *
 * 用法(在 site/ 下): node scripts/vendor-clerk.mjs <clerk-js 版本> <@clerk/ui 版本>
 * 升级 @clerk/nextjs 时:版本号以同源代理 /__clerk/npm/... 307 到的 location 为准,跑完把
 * NEXT_PUBLIC_CLERK_JS_URL / NEXT_PUBLIC_CLERK_UI_URL(本地 .env.local 与 Vercel)改到新目录,旧目录删掉。
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const [jsVer, uiVer] = process.argv.slice(2);
if (!jsVer || !uiVer) {
  console.error("usage: node scripts/vendor-clerk.mjs <clerk-js version> <@clerk/ui version>");
  process.exit(1);
}

const OUT = path.resolve("public/clerk-bundle");
const tmp = mkdtempSync(path.join(os.tmpdir(), "clerk-vendor-"));

function vendor(pkg, version, entry) {
  execFileSync("npm", ["pack", `${pkg}@${version}`, "--silent"], { cwd: tmp, stdio: "pipe" });
  const tgz = readdirSync(tmp).find((f) => f.endsWith(`-${version}.tgz`) && f.includes(pkg.replace("@clerk/", "")));
  const dir = path.join(tmp, `${pkg.replace("/", "_")}-${version}`);
  mkdirSync(dir, { recursive: true });
  execFileSync("tar", ["-xzf", path.join(tmp, tgz), "-C", dir]);
  const dist = path.join(dir, "package", "dist");
  const src = readFileSync(path.join(dist, entry), "utf8");
  // 分包名由 webpack 拼出来:名字 + "_ui_" + h().slice(0,6) + "_1.32.1.js",h 写死在入口里:
  // `.h=()=>"13e6c805a070cc27"` —— 取前 6 位就是这套构建的分包后缀
  const hashes = new Set([...src.matchAll(/\.h=\(\)=>"([0-9a-f]{6})[0-9a-f]*"/g)].map((m) => m[1]));
  if (hashes.size !== 1) throw new Error(`${pkg}: expected one chunk hash in ${entry}, found ${[...hashes]}`);
  const [hash] = hashes;
  const files = readdirSync(dist).filter((f) => f === entry || f.includes(`_${hash}_${version}.js`));
  const dest = path.join(OUT, `${pkg.replace("@clerk/", "")}@${version}`);
  if (existsSync(dest)) rmSync(dest, { recursive: true });
  mkdirSync(dest, { recursive: true });
  for (const f of files) cpSync(path.join(dist, f), path.join(dest, f));
  console.log(`${pkg}@${version}: ${files.length} files → ${path.relative(process.cwd(), dest)}/${entry}`);
}

try {
  vendor("@clerk/clerk-js", jsVer, "clerk.browser.js");
  vendor("@clerk/ui", uiVer, "ui.browser.js");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
