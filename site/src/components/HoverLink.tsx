"use client";

import NextLink from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * 全站统一的站内链接:只在"有意图"时预取(鼠标悬停 / 手指按下 / 键盘聚焦),不在进入视口时预取。
 *
 * 为什么(2026-10-11 查 Vercel 账单):本站页面全是动态渲染,next/link 默认会把视口里每个链接都
 * 在后台请求一遍 —— 每次请求就是一次计费的函数调用。7 天 13 万次调用里,顶栏 5 个链接、页脚 6 个链接、
 * 目录页一屏几十行项目链接的"顺手预取"占了一大块;跑 JS 的爬虫每打开一页也照样触发这一串。
 * 改成悬停预取是 Next 16 文档给的官方做法:真人点之前总会先悬停/按下,打开速度几乎不变;
 * 不悬停的(爬虫、只是滚过去的链接)就不再花钱。显式传了 prefetch 的地方按传入值走。
 */
export default function Link({
  prefetch,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...rest
}: ComponentProps<typeof NextLink>) {
  const [intent, setIntent] = useState(false);
  return (
    <NextLink
      {...rest}
      prefetch={prefetch !== undefined ? prefetch : intent ? null : false}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    />
  );
}
