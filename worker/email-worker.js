/**
 * Cloudflare Email Worker: test@provenstartups.com → 站点 /api/inbound-email
 * 环境变量(通过 wrangler secret 设置): SITE_URL, INBOUND_EMAIL_TOKEN
 */
export default {
  async email(message, env) {
    const headers = {};
    for (const [k, v] of message.headers) headers[k.toLowerCase()] = v;

    // 送达证据:DKIM/SPF 认证头
    const authResults =
      headers["authentication-results"] || headers["arc-authentication-results"] || "";

    let text = "";
    try {
      const raw = await new Response(message.raw).text();
      text = raw.slice(0, 100000);
    } catch {
      text = "";
    }

    await fetch(`${env.SITE_URL}/api/inbound-email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-inbound-token": env.INBOUND_EMAIL_TOKEN,
      },
      body: JSON.stringify({
        to: message.to,
        from: message.from,
        subject: headers["subject"] || "",
        text,
        headers,
        authResults,
      }),
    });
  },
};
