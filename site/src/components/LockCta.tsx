import Link from "next/link";
import { SITE } from "@/lib/site";

/**
 * 两张锁卡。2026-09-22 起是俱乐部制:游客和免费账号视野相同,墙后的东西只对会员开放。
 * 所以 SignupCta 不再承诺"免费账号解锁全部" —— 它只负责一件事:留邮箱收每周新项目。
 * 真正的解锁按钮是 JoinCta,价格从 SITE 读,不允许在别处手写 "$N/mo"。
 */
export function SignupCta({ note, redirectTo }: { note: string; redirectTo?: string }) {
  const href = redirectTo
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`
    : "/sign-in";
  return (
    <div className="panel panel-lit flex flex-col items-center gap-3 p-8 text-center">
      <span className="text-2xl">✉️</span>
      <p className="max-w-sm text-sm text-t2">{note}</p>
      <Link href={href} className="btn">
        Get the weekly drop — free
      </Link>
      <span className="text-xs text-t4">Email code only. No password.</span>
    </div>
  );
}

export function JoinCta({
  note,
  redirectTo,
  compact = false,
}: {
  note: string;
  /** 付费后回到哪(默认回当前页) */
  redirectTo?: string;
  compact?: boolean;
}) {
  const href = redirectTo
    ? `/pricing?from=${encodeURIComponent(redirectTo)}`
    : "/pricing";
  return (
    <div
      className={`panel panel-lit panel-club flex flex-col items-center gap-3 text-center ${
        compact ? "p-6" : "p-8"
      }`}
    >
      <span className="badge-club">{SITE.club.name}</span>
      <p className="max-w-md text-sm text-t2">{note}</p>
      <Link href={href} className="btn btn-primary">
        {SITE.club.cta} — ${SITE.priceMonthly}/mo
      </Link>
      <span className="text-xs text-t3">{SITE.club.guarantee}</span>
    </div>
  );
}

/** 旧名保留一个转发,避免漏改的调用点炸掉;新代码一律用 JoinCta。 */
export function ProCta(props: { note: string }) {
  return <JoinCta {...props} />;
}
