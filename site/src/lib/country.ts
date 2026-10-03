/**
 * 国名 → ISO alpha-2 码。
 * 行里放两个字母而不是国旗 emoji:国旗在 Windows 上根本不渲染成旗,
 * 退化成同样的两个字母,还要多担一份字素切分的风险。
 */
const CODES: Record<string, string> = {
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  "united kingdom": "UK",
  uk: "UK",
  england: "UK",
  scotland: "UK",
  wales: "UK",
  ireland: "IE",
  canada: "CA",
  mexico: "MX",
  brazil: "BR",
  argentina: "AR",
  chile: "CL",
  colombia: "CO",
  peru: "PE",
  uruguay: "UY",
  ecuador: "EC",
  venezuela: "VE",
  spain: "ES",
  portugal: "PT",
  france: "FR",
  germany: "DE",
  austria: "AT",
  switzerland: "CH",
  netherlands: "NL",
  belgium: "BE",
  denmark: "DK",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  iceland: "IS",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  poland: "PL",
  "czech republic": "CZ",
  czechia: "CZ",
  slovakia: "SK",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  serbia: "RS",
  croatia: "HR",
  slovenia: "SI",
  greece: "GR",
  italy: "IT",
  turkey: "TR",
  ukraine: "UA",
  russia: "RU",
  israel: "IL",
  "united arab emirates": "AE",
  uae: "AE",
  dubai: "AE",
  "saudi arabia": "SA",
  qatar: "QA",
  egypt: "EG",
  morocco: "MA",
  nigeria: "NG",
  kenya: "KE",
  ghana: "GH",
  "south africa": "ZA",
  uganda: "UG",
  tanzania: "TZ",
  rwanda: "RW",
  ethiopia: "ET",
  india: "IN",
  pakistan: "PK",
  bangladesh: "BD",
  "sri lanka": "LK",
  nepal: "NP",
  china: "CN",
  "hong kong": "HK",
  taiwan: "TW",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  singapore: "SG",
  malaysia: "MY",
  indonesia: "ID",
  thailand: "TH",
  vietnam: "VN",
  philippines: "PH",
  cambodia: "KH",
  australia: "AU",
  "new zealand": "NZ",
};

export function countryCode(region: string | null | undefined) {
  if (!region) return null;
  const key = region.trim().toLowerCase().replace(/\.$/, "");
  if (CODES[key]) return CODES[key];
  // "Bengaluru, India" / "Remote (Germany)" —— 从尾部往前找一个认得的地名
  const parts = key.split(/[,(){}/]|\s-\s/).map((s) => s.trim()).filter(Boolean);
  for (const p of parts.reverse()) {
    if (CODES[p]) return CODES[p];
  }
  return null;
}

/** 用于统计"覆盖了多少个国家" —— 归一化后去重,别把 UK 和 England 数成两个。 */
export function countCountries(regions: (string | null | undefined)[]) {
  const set = new Set<string>();
  for (const r of regions) {
    const c = countryCode(r);
    if (c) set.add(c);
  }
  return set.size;
}
