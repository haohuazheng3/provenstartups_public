import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

// 全站分享预览图。此前 og:image 完全缺失 —— 分享到 Slack/Discord/X 是一块空白,
// 外链点击率白扔。放在 app/ 根部,所有未自带 opengraph-image 的路由都继承它。
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* 品牌行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 5,
              height: 40,
            }}
          >
            <div style={{ width: 10, height: 18, borderRadius: 3, background: "#a5b4fc" }} />
            <div style={{ width: 10, height: 28, borderRadius: 3, background: "#7c6cff" }} />
            <div style={{ width: 10, height: 40, borderRadius: 3, background: "#5b4bf5" }} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, color: "#0f172a" }}>{SITE.name}</div>
        </div>

        {/* 主张 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              maxWidth: 940,
            }}
          >
            Startup ideas, ranked by the receipts behind them.
          </div>
          <div style={{ fontSize: 29, color: "#64748b", maxWidth: 900, lineHeight: 1.4 }}>
            Every revenue figure carries an evidence grade — so you can see how much
            each number is worth before you act on it.
          </div>
        </div>

        {/* 证据分级图例 —— 这是这个站真正的差异点 */}
        <div style={{ display: "flex", alignItems: "center", gap: 30, fontSize: 22 }}>
          {[
            ["#059669", "Third-party verified"],
            ["#4f46e5", "Founder-reported"],
            ["#9333ea", "Creator-relayed"],
            ["#94a3b8", "Unproven"],
          ].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{ width: 13, height: 13, borderRadius: 999, background: color }}
              />
              <div style={{ color: "#475569" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
