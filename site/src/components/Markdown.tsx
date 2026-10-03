import Link from "next/link";
import { BLOG_CATEGORIES, BLOG_POSTS, type BlogImage } from "@/lib/blog";
import { RETIRED_REDIRECTS } from "@/lib/retired-blog";
import { SITE } from "@/lib/site";

/**
 * 站内博客链接的兜底:正文是写手产出的,会引用后来被删除/合并的文章。
 * 指向合并页的直接改指最终地址(不让读者和爬虫走一跳 308);指向不存在文章或分类的降级成纯文本
 * (不留 404/410 死链)。/blog 以外的站内路径原样放行。
 */
const LIVE_BLOG_PATHS = new Set<string>([
  "/blog",
  ...BLOG_CATEGORIES.map((c) => `/blog/${c.slug}`),
  ...BLOG_POSTS.map((p) => `/blog/${p.category}/${p.slug}`),
]);

function resolveBlogHref(href: string): string | null {
  const m = href.match(/^(\/blog(?:\/[^?#]*)?)([?#].*)?$/);
  if (!m) return href;
  const path = m[1].length > 5 ? m[1].replace(/\/+$/, "") : m[1];
  if (LIVE_BLOG_PATHS.has(path)) return href;
  const moved = RETIRED_REDIRECTS[path];
  return moved ?? null;
}

/**
 * 轻量 markdown 渲染。只支持文章实际用到的语法 ——
 * 装一个完整 markdown 库为这点用量不值得,而且渲染出的类名不受控。
 */

type Block =
  | { t: "h2" | "h3"; text: string; id: string }
  | { t: "p"; text: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "hr" };

function slugId(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function parse(md: string): Block[] {
  const lines = md.split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    // 表格:表头 + 分隔行 + 数据行
    if (t.startsWith("|") && lines[i + 1]?.trim().match(/^\|[\s:|-]+\|$/)) {
      const cells = (s: string) =>
        s.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(t);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push({ t: "table", head, rows });
      continue;
    }
    const h = t.match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      const text = h[2].replace(/\*\*/g, "").trim();
      out.push({ t: h[1].length === 2 ? "h2" : "h3", text, id: slugId(text) });
      i++;
      continue;
    }
    if (/^#\s+/.test(t)) {
      i++; // 顶层 H1 由页面 header 负责,正文里跳过
      continue;
    }
    if (/^(---|\*\*\*)$/.test(t)) {
      out.push({ t: "hr" });
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
        i++;
      }
      out.push({ t: "ul", items });
      continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "").trim());
        i++;
      }
      out.push({ t: "ol", items });
      continue;
    }
    // 段落:连续非空行合成一段
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|\|)/.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    if (buf.length) out.push({ t: "p", text: buf.join(" ") });
    else {
      // 以 "|" 开头却不是合法表头(下一行不是分隔行)的孤行:当普通段落吃掉,保证 i 前进 ——
      // 否则这里会死循环,2026-09-22 一篇 hub 页的 "|  |" 行让构建卡满 45 分钟
      out.push({ t: "p", text: t });
      i++;
    }
  }
  return out;
}

function internalHref(href: string): string | null {
  if (href.startsWith("#") || href.startsWith("?") || /^\.{1,2}\//.test(href)) return href;
  if (href.startsWith("/") && !href.startsWith("//")) return href;

  try {
    const target = new URL(href);
    if (target.origin !== new URL(SITE.url).origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

/** 行内:**粗体**、[文本](链接)、`代码` */
function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const rx = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = rx.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      const href = m[2];
      const raw = internalHref(href);
      const internal = raw === null ? null : resolveBlogHref(raw);
      if (raw !== null && internal === null) {
        // 指向已删除文章:保留文字,去掉链接
        parts.push(m[1]);
        last = m.index + m[0].length;
        continue;
      }
      parts.push(
        internal ? (
          <Link key={k++} href={internal} className="link">
            {m[1]}
          </Link>
        ) : /^https?:\/\//i.test(href) ? (
          <a
            key={k++}
            href={href}
            target="_blank"
            rel="noopener nofollow"
            className="link"
          >
            {m[1]}
          </a>
        ) : (
          <a key={k++} href={href} className="link">
            {m[1]}
          </a>
        )
      );
    } else if (m[3]) {
      parts.push(
        <strong key={k++} className="font-semibold text-t1">
          {m[3]}
        </strong>
      );
    } else if (m[4]) {
      parts.push(
        <code key={k++} className="mono rounded bg-paper-2 px-1.5 py-0.5 text-[0.86em] text-t1">
          {m[4]}
        </code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Figure({ img }: { img: BlogImage }) {
  return (
    <figure className="panel my-8 overflow-hidden">
      {/* 外链图片(Pexels):Next 的 Image 要在 config 里列域名,这里用原生 img 避开
          配置耦合。定向豁免而不是关规则 —— CI 用 --max-warnings=0,留着会让关卡红。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.alt} loading="lazy" className="h-auto w-full" />
      {img.photographer && (
        <figcaption className="border-t border-line px-4 py-2 text-[0.72rem] text-t4">
          Photo by{" "}
          {img.creditUrl ? (
            <a href={img.creditUrl} target="_blank" rel="noopener nofollow" className="hover:text-t2">
              {img.photographer}
            </a>
          ) : (
            img.photographer
          )}{" "}
          on Pexels
        </figcaption>
      )}
    </figure>
  );
}

export default function Markdown({ body, images = [] }: { body: string; images?: BlogImage[] }) {
  const blocks = parse(body);
  // 配图插在 H2 之间,均匀铺开 —— 不要全堆在开头
  const h2Idx = blocks.map((b, i) => (b.t === "h2" ? i : -1)).filter((i) => i >= 0);
  const slots = new Map<number, BlogImage>();
  images.slice(0, 3).forEach((img, n) => {
    const pos = h2Idx[Math.floor(((n + 1) * h2Idx.length) / (images.length + 1))];
    if (pos != null && !slots.has(pos)) slots.set(pos, img);
  });

  return (
    <div className="text-[1.02rem] leading-[1.78] text-t2">
      {blocks.map((b, i) => (
        <div key={i}>
          {slots.has(i) && <Figure img={slots.get(i)!} />}
          {b.t === "h2" && (
            <h2 id={b.id} className="h-sec mt-11 mb-4 scroll-mt-20 text-[1.7rem] text-t1">
              {b.text}
            </h2>
          )}
          {b.t === "h3" && (
            <h3 id={b.id} className="mt-7 mb-2 scroll-mt-20 text-[1.08rem] font-semibold tracking-[-0.01em] text-t1">
              {b.text}
            </h3>
          )}
          {b.t === "p" && (
            <p className="my-4">
              <Inline text={b.text} />
            </p>
          )}
          {b.t === "ul" && (
            <ul className="my-3.5 flex flex-col gap-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mono shrink-0 font-bold text-brand">·</span>
                  <span>
                    <Inline text={it} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {b.t === "ol" && (
            <ol className="my-3.5 flex flex-col gap-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mono shrink-0 text-t3">{j + 1}.</span>
                  <span>
                    <Inline text={it} />
                  </span>
                </li>
              ))}
            </ol>
          )}
          {b.t === "table" && (
            <div className="scroll-x panel my-7">
              <table className="w-full text-[0.86rem]">
                <thead>
                  <tr className="border-b border-line bg-sheet-2">
                    {b.head.map((h, j) => (
                      <th key={j} className="px-3.5 py-2.5 text-left font-medium text-t1">
                        <Inline text={h} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-b border-line last:border-0">
                      {r.map((c, k2) => (
                        <td key={k2} className="px-3.5 py-2.5 align-top">
                          <Inline text={c} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {b.t === "hr" && <div className="hairline my-8" />}
        </div>
      ))}
    </div>
  );
}
