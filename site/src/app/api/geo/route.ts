export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EU + EEA + UK + Switzerland: FlowGlance only loads there after an explicit "Accept".
const OPT_IN = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]);

/** Region check for src/components/Consent.tsx (same contract as onwardscout.com's /api/geo). */
export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  // Unknown location (local dev, privacy relays) counts as opt-in: the conservative default.
  const consentRequired = !country || OPT_IN.has(country);
  // The browser keeps the answer for a day and Consent.tsx remembers the region in a cookie,
  // so a returning visitor doesn't cost a function call on every page.
  return Response.json(
    { consentRequired, country: country || null },
    { headers: { "Cache-Control": "private, max-age=86400" } }
  );
}
