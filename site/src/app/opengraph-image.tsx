import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

// 全站分享预览图。此前 og:image 完全缺失 —— 分享到 Slack/Discord/X 是一块空白,
// 外链点击率白扔。放在 app/ 根部,所有未自带 opengraph-image 的路由都继承它。
// 配色跟 globals.css 走:冷白底、电光蓝主色、绿色的钱。字体是 Poppins(站长指定的全站字)。
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// satori 只吃 TTF/OTF/WOFF(不吃 woff2);这两个是 Google Fonts 给非浏览器 UA 返回的 TTF 地址
const POPPINS = {
  600: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6V1s.ttf",
  700: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7V1s.ttf",
} as const;

async function loadFont(url: string) {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null; // 拿不到就退回系统无衬线,图照样出
  }
}

export default async function OpengraphImage() {
  const [semi, bold] = await Promise.all([loadFont(POPPINS[600]), loadFont(POPPINS[700])]);
  const fonts = [
    ...(semi ? [{ name: "Poppins", data: semi, weight: 600 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Poppins", data: bold, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#f4f7fd",
          backgroundImage: "linear-gradient(135deg, #dfe9ff 0%, #f7faff 46%, #dff3ff 100%)",
          padding: "72px 80px",
          fontFamily: fonts.length ? "Poppins, sans-serif" : "sans-serif",
        }}
      >
        {/* 品牌行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 40 }}>
            <div style={{ width: 10, height: 18, borderRadius: 3, background: "#1f5eff", opacity: 0.4 }} />
            <div style={{ width: 10, height: 28, borderRadius: 3, background: "#1f5eff", opacity: 0.78 }} />
            <div style={{ width: 10, height: 40, borderRadius: 3, background: "#10a86b" }} />
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, color: "#0c1633" }}>{SITE.name}</div>
        </div>

        {/* 主张:第二行用主色蓝 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
            }}
          >
            <div style={{ color: "#0c1633" }}>Startup ideas, ranked by</div>
            <div style={{ color: "#1f5eff" }}>the receipts behind them.</div>
          </div>
          <div style={{ fontSize: 27, fontWeight: 600, color: "#44506e", maxWidth: 900, lineHeight: 1.4 }}>
            Every revenue figure carries an evidence grade — so you can see how much each number
            is worth before you act on it.
          </div>
        </div>

        {/* 证据分级图例 —— 这是这个站真正的差异点 */}
        <div style={{ display: "flex", alignItems: "center", gap: 30, fontSize: 21, fontWeight: 600 }}>
          {[
            ["#10a86b", "Third-party verified"],
            ["#1f5eff", "Founder-reported"],
            ["#8b5cf6", "Creator-relayed"],
            ["#b3bdd1", "Unproven"],
          ].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 13, height: 13, borderRadius: 999, background: color }} />
              <div style={{ color: "#44506e" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
