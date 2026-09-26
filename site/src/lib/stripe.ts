import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return _stripe;
}

/** 站点→品牌 映射由后端白名单控制,严禁前端传入品牌名 */
export const BRAND = {
  displayName: "ProvenStartups",
  statementSuffix: "PROVENSTARTUP", // 与账户前缀拼接后需 ≤22 拉丁字符
} as const;
