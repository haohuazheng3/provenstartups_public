import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE } from "./site";

/**
 * 邮件里的一键退订链接:?u=<clerk_user_id>&t=<HMAC>。不用登录就能退订(Gmail/Yahoo 对批量发件人的要求),
 * 也不能被人拿别人的 id 乱退。密钥优先 EMAIL_LINK_SECRET,没有就用 CRON_SECRET(两处环境都已有)。
 * 换密钥会让旧邮件里的退订链接失效 —— 失效时页面会引导去账户页关开关,不会卡死人。
 */
function secret() {
  const s = process.env.EMAIL_LINK_SECRET || process.env.CRON_SECRET;
  if (!s) throw new Error("EMAIL_LINK_SECRET/CRON_SECRET missing");
  return s;
}

export function unsubToken(clerkUserId: string) {
  return createHmac("sha256", secret()).update(`unsub:${clerkUserId}`).digest("base64url").slice(0, 32);
}

export function verifyUnsub(clerkUserId: string, token: string) {
  if (!clerkUserId || !token) return false;
  const want = Buffer.from(unsubToken(clerkUserId));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function unsubUrl(clerkUserId: string) {
  return `${SITE.url}/api/email/unsubscribe?u=${encodeURIComponent(clerkUserId)}&t=${unsubToken(clerkUserId)}`;
}
