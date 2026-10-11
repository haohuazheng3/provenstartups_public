import Link from "@/components/HoverLink";
import { SITE } from "@/lib/site";

/**
 * 两张锁卡。2026-09-22 起是俱乐部制:游客和免费账号视野相同,墙后的东西只对会员开放。
 * 所以 SignupCta 不再承诺"免费账号解锁全部"；免费账号可保存筛选。
 * 真正的解锁按钮是 JoinCta(墨面板 + 铜字),价格从 SITE 读,不允许在别处手写 "$N/mo"。
 * 两个按钮都带 data-track(ClickTracker 统一上报),placement 标明是哪一处的按钮。
 */
export function SignupCta({ note, redirectTo, placement = "signup_card" }: { note: string; redirectTo?: string; placement?: string }) {
  const href = redirectTo
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`
    : "/sign-in";
  return (
    <div className="panel flex flex-col items-center gap-3 p-8 text-center">
      <span className="label">Free account</span>
      <p className="max-w-sm text-[0.92rem] leading-relaxed text-t2">{note}</p>
      <Link href={href} className="btn" data-track="weekly_drop_click" data-track-placement={placement}>
        Save filters — free
      </Link>
      <span className="text-xs text-t4">Email code only. No password.</span>
    </div>
  );
}

export function JoinCta({
  note,
  redirectTo,
  compact = false,
  placement = "join_card",
}: {
  note: string;
  /** 付费后回到哪(默认回当前页) */
  redirectTo?: string;
  compact?: boolean;
  /** 埋点位置名,例如 deep_dive / build_prompts */
  placement?: string;
}) {
  const href = redirectTo
    ? `/pricing?from=${encodeURIComponent(redirectTo)}`
    : "/pricing";
  return (
    <div
      className={`panel-club flex flex-col items-center gap-3.5 text-center ${
        compact ? "p-6 sm:p-7" : "p-8 sm:p-10"
      }`}
    >
      <span className="badge-club">{SITE.club.name}</span>
      <p className={`max-w-md leading-relaxed ${compact ? "text-[0.9rem] text-t2" : "text-[1.06rem] font-medium text-t1"}`}>{note}</p>
      <Link href={href} className={`btn btn-club ${compact ? "" : "btn-lg"}`} data-track="join_click" data-track-placement={placement}>
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
