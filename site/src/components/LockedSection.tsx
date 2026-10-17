import Link from "@/components/HoverLink";
import { SITE } from "@/lib/site";

/**
 * 锁定段的预览卡:标题 + 前两句真话 + 一段"模糊正文" + 就地解锁按钮。
 * 目的是让锁"被感觉到":访客读到开头、看见后面还有多少,再决定要不要进俱乐部。
 *
 * 只有预览那两句进 HTML。模糊的部分是按剩余正文的词长画出来的条,不含任何文字 ——
 * 查看源代码、关掉 CSS、复制粘贴都拿不到会员内容。
 */

// 句子边界:句末标点(可带右引号/右括号)+ 空白 + 大写字母/数字/货币符号开头。
// 不用 [^.]+\. 那种写法 —— "$0.039 per image" 里的小数点会把句子切碎。
const SENTENCE_BREAK = /(?<=[.!?]["”’)]?)\s+(?=["“(]?[A-Z0-9$€£¥₹])/;

const MAX_TEASER_CHARS = 320;
const MAX_TEASER_SHARE = 0.45; // 预览最多占全文的这个比例,短段落只给一句
const GHOST_WORDS = 54;

export function teaserOf(content: string) {
  const text = content.replace(/^\s*\[(?:Video|AI)\]\s*/i, "").replace(/\s+/g, " ").trim();
  const sentences = text.split(SENTENCE_BREAK);
  let teaser = sentences.slice(0, 2).join(" ");
  if (teaser.length > MAX_TEASER_CHARS || teaser.length > text.length * MAX_TEASER_SHARE) teaser = sentences[0];
  if (teaser.length > MAX_TEASER_CHARS) teaser = teaser.slice(0, MAX_TEASER_CHARS - 20).replace(/\s+\S*$/, "") + "…";
  const rest = text.slice(Math.min(text.length, teaser.replace(/…$/, "").length)).trim();
  const restWords = rest ? rest.split(" ") : [];
  return { teaser, restWords };
}

export default function LockedSection({
  num,
  title,
  content,
  slug,
}: {
  num: string | null;
  title: string | null;
  content: string | null;
  slug: string;
}) {
  const { teaser, restWords } = teaserOf(content ?? "");
  const joinHref = `/pricing?from=${encodeURIComponent(`/projects/${slug}#section-${num}`)}`;
  return (
    <div id={`section-${num}`} className="panel scroll-mt-24 p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-baseline gap-3">
          <span className="serif text-[1.6rem] leading-none text-brand/30">{num}</span>
          <span className="h-sec text-[1.3rem]">{title}</span>
        </h3>
        <span className="badge-club shrink-0">{SITE.club.name}</span>
      </div>
      <p className="mt-4 text-[0.95rem] leading-[1.75] text-t2">{teaser}</p>
      {restWords.length > 0 && (
        <span aria-hidden className="ghost-text mt-2 text-[0.95rem] leading-[1.75]">
          {restWords.slice(0, GHOST_WORDS).map((w, i) => (
            <span key={i} className="ghost-word" style={{ width: `${Math.min(9, Math.max(1.1, w.length * 0.5))}em` }} />
          ))}
        </span>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={joinHref}
          className="btn btn-club btn-sm"
          data-track="join_click"
          data-track-placement="section_teaser"
          data-track-section={num}
        >
          Keep reading in the {SITE.club.name}
        </Link>
        {restWords.length > 0 && (
          <span className="text-[0.74rem] text-t3">
            <span className="mono">{restWords.length}</span> more words · ${SITE.priceMonthly}/mo, cancel anytime
          </span>
        )}
      </div>
    </div>
  );
}
