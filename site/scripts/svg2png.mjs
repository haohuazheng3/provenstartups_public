import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// SVG → PNG 精确栅格化。qlmanage 的 -s 是"最长边"限制,会把非正方形压变形;
// 浏览器渲染才能保住原始宽高比。
const [src, out, w, h] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
const svg = fs.readFileSync(path.resolve(src), "utf8");
await p.setContent(
  `<body style="margin:0;background:#fff">${svg}</body>`,
  { waitUntil: "networkidle" }
);
await p.locator("svg").first().evaluate((el, [w, h]) => {
  el.setAttribute("width", w); el.setAttribute("height", h);
}, [w, h]);
await p.screenshot({ path: path.resolve(out), clip: { x: 0, y: 0, width: +w, height: +h } });
await b.close();
console.log("→", out);
