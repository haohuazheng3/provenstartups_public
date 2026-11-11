/**
 * 项目正文 → tools[](受控词表)。backfill-filters.ts 每次导入后调用;"用 X 做的 App"系列页面按这个标签实时取案例。
 *
 * 2026-10-17 重写:旧版只看"正文里出现没出现这个词",于是
 * - runway 233 个全是误标(创业语境里的 runway = 现金还能撑多久,真正提到 Runway 视频工具的是 0 个)
 * - bubble 命中 "AI bubble"、expo 命中展会、notion 命中 "the notion of"、cursor 命中竞品对比里的顺口一提
 * 这些标签直接决定"用 Cursor 做的 App"页面列出谁,错一个就是在页面上说谎。
 *
 * 新规则分两类:
 * - 词本身不会有歧义的(Supabase、n8n、RevenueCat…):出现即算
 * - 有歧义的词、以及 AI 编程/建站工具:提到它的那句话里要有"在用"的动词或语境,且提到它的前后不能是
 *   对比/竞品语境(vs、unlike、competitors like、alternative to…)—— 一家公司说"我们比 Cursor 好",它不是用 Cursor 做的
 */

type Rule = { tag: string; rx: RegExp; usage?: boolean };

// 出现即算
const PLAIN: Rule[] = [
  { tag: "supabase", rx: /\bsupabase\b/i },
  { tag: "firebase", rx: /\bfirebase\b/i },
  { tag: "stripe", rx: /\bstripe\b/i },
  { tag: "revenuecat", rx: /\brevenuecat\b/i },
  { tag: "n8n", rx: /\bn8n\b/i },
  { tag: "zapier", rx: /\bzapier\b/i },
  // Make 是常用动词,只认 make.com 和"Zapier/n8n 和 Make"并列、"Make scenario"这类明确指平台的写法(区分大小写)
  { tag: "make", rx: /\b[Mm]ake\.com\b|\b(?:[Zz]apier|n8n|N8N),? (?:and|or|\/) Make\b|\bMake,? (?:and|or|\/) (?:[Zz]apier|n8n|N8N|Airtable)\b|\bMake scenarios?\b/ },
  { tag: "elevenlabs", rx: /\beleven ?labs\b/i },
  { tag: "midjourney", rx: /\bmidjourney\b/i },
  { tag: "webflow", rx: /\bwebflow\b/i },
  { tag: "nextjs", rx: /\bnext\.?js\b/i },
  { tag: "airtable", rx: /\bairtable\b/i },
  { tag: "gumroad", rx: /\bgumroad\b/i },
  { tag: "etsy", rx: /\betsy\b/i },
  { tag: "kdp", rx: /\bkdp\b|kindle direct/i },
  { tag: "shopify", rx: /\bshopify\b/i },
  { tag: "shopify-app", rx: /\bshopify app(?! store\b)s?\b|\bshopify plugin|\bapp on the shopify app store|\bshopify app store\b/i },
  { tag: "wordpress", rx: /\bwordpress\b/i },
  { tag: "youtube", rx: /\byoutube\b/i },
  { tag: "tiktok", rx: /\btiktok\b/i },
  { tag: "telegram", rx: /\btelegram\b/i },
  { tag: "discord", rx: /\bdiscord\b/i },
  { tag: "figma", rx: /\bfigma\b/i },
  { tag: "chrome-extension", rx: /\bchrome (web store )?extensions?\b|\bbrowser extensions?\b/i },
];

// 要看语境
const USAGE: Rule[] = [
  { tag: "claude-code", rx: /\bclaude code\b/gi, usage: true },
  { tag: "cursor", rx: /\bcursor(?: ai| ide| editor| composer| agent)?\b/gi, usage: true },
  { tag: "codex", rx: /\b(?:openai )?codex(?: cli)?\b/gi, usage: true },
  { tag: "chatgpt", rx: /\bchatgpt\b|\bgpt-?[345](?:\.\d)?o?\b/gi, usage: true },
  // Google AI Studio 是 Gemini 的开发平台,Nano Banana 是 Gemini 的图像模型 —— 用它们就是在用 Gemini
  { tag: "gemini", rx: /\bgemini(?: cli| pro| flash| api)?\b|\bgoogle ai studio\b|\bnano banana(?: pro)?\b/gi, usage: true },
  // 只认大写开头的品牌名:小写的 lovable 几乎都是形容词("a lovable character system")
  { tag: "lovable", rx: /\bLovable(?:\.dev)?\b|\blovable\.dev\b/g, usage: true },
  { tag: "bolt", rx: /\bbolt\.new\b|\bbolt(?= (?:ai|app|to build|for|and lovable|or lovable))|\b(?:on|with|in|using|via) bolt\b/gi, usage: true },
  { tag: "replit", rx: /\breplit(?: agent)?\b/gi, usage: true },
  { tag: "v0", rx: /\bv0(?:\.dev| by vercel)?\b(?!\.\d)/gi, usage: true },
  { tag: "windsurf", rx: /\bwindsurf\b/gi, usage: true },
  { tag: "copilot", rx: /\bgithub copilot\b|\bcopilot (?:chat|agent|coding|workspace)\b/gi, usage: true },
  { tag: "base44", rx: /\bbase ?44\b/gi, usage: true },
  { tag: "bubble", rx: /\bbubble(?:\.io)?\b(?! tea)(?=[^.]{0,60}\b(?:no-?code|app|built|editor|plugin|workflow|database|template)\b)|\b(?:on|with|in|using|via) bubble(?:\.io)?\b(?! tea)/gi, usage: true },
  { tag: "framer", rx: /\bframer\b(?! motion)/gi, usage: true },
  { tag: "notion", rx: /\bnotion (?:templates?|databases?|pages?|api|workspaces?|integrations?|sites?|forms?|dashboards?)\b|\b(?:in|on|with|using|built in|built on) notion\b/gi, usage: true },
  { tag: "expo", rx: /\bexpo(?: go| router| eas| sdk)?\b(?=[^.]{0,50}\b(?:react|app|mobile|ios|android|build)\b)|\breact native\b/gi, usage: true },
  { tag: "runway", rx: /\brunway ?(?:ml|gen-?\d|ai)\b|\brunway'?s (?:video|gen)/gi, usage: true },
];

// "在用"的语境。强信号:明确在用它做东西;弱信号:只是写代码/做 App 的泛语境
const STRONG_RX =
  /\b(?:built|build(?:s|ing)? (?:it |the \w+ |everything |this )?(?:with|on|in|using)|coded|vibe[- ]?cod(?:e|ed|ing)|prototyped|shipped (?:it )?(?:with|on|in)|wrote (?:it |the \w+ )?(?:with|in)|written in|using|uses|used|use (?:it |\w+ )?(?:to|for)|stack|switched (?:to|from)|moved (?:to|from)|leans?|leaned|relies|relied|powered by|plugs? in|ide|editor|for (?:building|coding|development|design|the (?:art|ui|design|backend|frontend|landing page|site|app))|landing page|tell|tells|told|prompt\w*|clone[sd]? [^.]{0,30}\bwith|names|workflow (?:is|was|runs)|on top of)\b/i;
const WEAK_RX =
  /\b(?:build|builds|building|code|coding|codes|made|make|making|developed|develop|developing|ship|ships|shipping|created|generated|generates|runs|running|ran|hosted|backend|back-end|frontend|front-end|agent|agents|workflow|workflows|automat\w*|integrat\w*|plugin|plugins|template|templates|extension|app|apps|site|sites|website|mvp|launched|launch|deploy\w*|subscription to|paid for|pays for)\b/i;
// 同一句里出现的其它工具名(用来判断"一串工具名的泛泛列举")
const ANY_TOOL_RX =
  /\b(?:claude code|cursor|codex|chatgpt|gemini|lovable|bolt(?:\.new)?|replit|v0|windsurf|copilot|base ?44|bubble|framer|webflow|supabase|firebase|n8n|zapier|make\.com|flutterflow|glide|softr|perplexity|claude)\b/gi;
// 这几个更多是被"提到"而不是被"用来做产品":一律要强信号
const STRICT = new Set(["chatgpt", "gemini"]);

// 工具成本清单:"Claude Code $200/month"、"$100 for Claude Code" —— 付钱在用,算
const PRICE_AFTER = /^\s*(?:\(|,|:|-|\u2014|\u2013)?\s*(?:about |around |roughly |~)?\$\d[\d,.]*\s*(?:\/|per |a )\s*(?:month|mo|year|yr)\b/i;
const PRICE_BEFORE = /\$\d[\d,.]*\s*(?:\/\s*mo\w*|per month|a month)?\s*(?:for|on)\s*$/i;
// 对比/竞品语境:只看提到工具的前 32 个字符和后 24 个字符
const NEG_BEFORE =
  /(?:\b(?:vs\.?|versus|unlike|than|against|compet\w*(?: with| like| such as| including)?|rivals?(?: like)?|alternatives? (?:to|like)|instead of|clone of|copy of|(?:customers?|clients?|users?|logos?) (?:include|includes|including|like|such as)|predated|before|killed by|there (?:was|were) no|no|without|(?:signups?|customers?|users?|clients?|logos?)(?: \w+){0,2} (?:from|at)|(?:extension|plugin|add-on|wrapper|companion) (?:for|on|around))\s*(?:[\w.()]+\s*,?\s*){0,4}$|\b(?:an?|the) (?:smaller|cheaper|better|open[- ]source|mini|indie|faster|simpler|leaner|local) $|["\u201c']$)/i;
const NEG_AFTER = /^(?:[^.]{0,24}\b(?:competitor|rival|alternative|clone|killer)s?\b|[^.]{0,30}\b(?:existed|(?:did not|didn't|does not|doesn't) (?:yet )?exist|did not exist yet)\b|'s release|\s+(?:folder |sidebar |prompt )?(?:extension|plugin|add-on|wrapper)\b)/i;

// 句子边界:句号/问号/叹号后面跟空白或引号才算,"Next.js""Opus 4.5""bolt.new"里的点不算
const END_RX = /[.!?](?=["'\u201d\u2019)\]]?(?:\s|\\n|$))|\n|\\n/g;

function sentenceAround(text: string, start: number, end: number) {
  let left = Math.max(0, start - 240);
  let right = Math.min(text.length, end + 240);
  END_RX.lastIndex = 0;
  for (const m of text.matchAll(END_RX)) {
    const i = m.index ?? 0;
    if (i < start && i >= left) left = i + 1;
    if (i >= end) {
      right = Math.min(right, i);
      break;
    }
  }
  return text.slice(left, right);
}

function usedIn(text: string, rx: RegExp, strict = false) {
  rx.lastIndex = 0;
  for (const m of text.matchAll(rx)) {
    const s = m.index ?? 0;
    const e = s + m[0].length;
    const before = text.slice(Math.max(0, s - 32), s);
    const after = text.slice(e, e + 24);
    if (NEG_BEFORE.test(before) || NEG_AFTER.test(after)) continue;
    if (PRICE_AFTER.test(after) || PRICE_BEFORE.test(before)) return true;
    const sent = sentenceAround(text, s, e).replace(m[0], " ");
    if (STRONG_RX.test(sent)) return true;
    const others = (sent.match(ANY_TOOL_RX) ?? []).length;
    if (!strict && others < 2 && WEAK_RX.test(sent)) return true;
  }
  return false;
}

// 写手生成的"建议怎么做"句子("A lean implementation could use Next.js App Router…, Neon Postgres with Drizzle…")
// 是本站推荐的栈,不是创始人用的 —— 打标签前整句去掉(2026-10-17 查出 84 条项目带这类句子,Next.js/Stripe 标签被它撑大)
const ADVICE_RX =
  /\b(?:a|an|the) (?:modern|lean|practical|simple|minimal|common lean|cheap)\b[^.]{0,30}\b(?:mvp|build|version|implementation|setup|stack)\b[^.]{0,15}\b(?:can|could|would|should|might|needs?)\b|\bnext\.js app router\b|\bneon postgres with drizzle\b|\b(?:application|app|product|mvp) (?:can|could) use\b|\bcommon lean saas setup\b/i;
function stripAdvice(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\\n|\n/)
    .filter((s) => !ADVICE_RX.test(s))
    .join(" ");
}

export function toolTags(raw: string, slug?: string): string[] {
  const text = stripAdvice(raw);
  const out: string[] = [];
  for (const r of PLAIN) if (r.rx.test(text)) out.push(r.tag);
  for (const r of USAGE) if (usedIn(text, r.rx, STRICT.has(r.tag))) out.push(r.tag);
  // 人工排除在打标签这一步就生效:数据库、目录筛选、导出文件、"用 X 做的 App"页面看到的是同一份
  return slug ? out.filter((t) => !TOOL_EXCLUDE[t]?.includes(slug)) : out;
}

/**
 * 人工核过的排除:标签规则按语境判断,仍会有几类它分不清 ——
 * 工具公司自己的条目(Lovable 的公司不是"用 Lovable 做的")、名字里恰好带工具名的别家产品(Codex Heim 是写作工具,不是 OpenAI Codex)。
 * 写每一页时逐条核对案例,发现一个就加在这里。
 */
export const TOOL_EXCLUDE: Record<string, string[]> = {
  // 只是拿"Shopify 应用"举例的(lemlist、Photoshop 插件、Founderpath、播客)、"不用装应用"的泛论、用别人应用搭店的店铺
  "shopify-app": [
    "lemlist-cold-email-community-flywheel", "bulk-mockup-photoshop-plugin", "typeflo-google-docs-seo-blog-ltd",
    "operators-podcast-niche-b2b-sponsorship", "founderpath-mrr-backed-loans-bootstrapped-saas", "shopify-ai-store-builder-zendrop-dropship",
  ],
  // 建站工具:只是"客户在用 Webflow/Framer"的集成对象(DropInBlog、Distribute)、竞品(Unicorn Platform、Ready)、
  // "迁移很难"的泛论(Typeflo)、点子清单、"工具在趋同"的感叹;Firebase:"Clerk 或 Firebase"二选一、分析工具建议清单
  firebase: ["cupsa-ai-resume-builder-review", "turkish-ai-video-prompt-credit-saas"],
  webflow: ["dropinblog-embedded-business-blogging-platform", "data-fetcher", "unicorn-platform-niche-builder", "typeflo-google-docs-seo-blog-ltd"],
  framer: [
    "dropinblog-embedded-business-blogging-platform", "distribute-io-reddit-llm-ranking-engine", "unicorn-platform-niche-builder", "nate-micro-niche-ai-sidehustle-stack",
    "typeflo-google-docs-seo-blog-ltd", "ai-1hr-site-agency", "ready-ai-landing-page-builder",
  ],
  // 竞品都在用的那套(Swipe)、预测曲线、"别用 ElevenLabs"的警告、工具清单、建议用克隆音规避的灰产、
  // "ElevenLabs 或 MiniMax"二选一且教人克隆他人声音、教练给的复刻栈
  elevenlabs: [
    "swipe-by-door-to-door-ai-marketing-main-street", "spotify-ai-dubbed-podcast", "barrera-kids-gaming-faceless-youtube",
    "poppy-ai-visual-creator-canvas", "clickbank-spirituality-faceless-affiliate", "rook-ai-avatar-faceless-finance",
    "zinny-studio-ai-avatar-skool-community",
  ],
  // n8n/Zapier/Make:收入是对标频道的、"上一轮热点"的感叹、专门替代 n8n 的产品、"我们没用 n8n"、按任务计价的提醒、
  // 拿 Zapier 当增长案例/类比/建议清单、"没用 Zapier"
  n8n: [
    "loic-creator", "modiversity-n8n-faceless-youtube", "acquisition-io-agentic-growth-firm", "instance-ai-text-to-automation-platform",
    "quimple-ai-automation-agency-pricing", "ai-agent-trio-coaching-company-ops",
  ],
  zapier: [
    "hyros-free-first-results-ladder-attribution", "taskmagic-tentpole-browser-automation-saas", "scalestack-b2b-sales-data-workflow-platform",
    "aeo-service", "solesavy-sneakerhead-paid-community", "instance-ai-text-to-automation-platform", "medium-to-gumroad-digital-product-flywheel",
    "turkish-ai-video-prompt-credit-saas",
  ],
  make: ["ai-agent-trio-coaching-company-ops"],
  // "OpenAI 或 Gemini 都行""Gemini/Manus"这类二选一、工具清单式的泛泛列举、对比
  gemini: [
    "stamp-identifier-aso-micro-app", "aura-vibe-design-template-library", "local-internet-presence", "nate-micro-niche-ai-sidehustle-stack",
    "ghost-niche-faceless-news-channels", "tokfy-tiktok-shop-ai-ecosystem", "ai-lead-generation", "mine-marketing",
    // Nano Banana 一并计入后新出现的:二选一(Arcads)、收入是对标对象的(播客频道、Etsy 参考店)、
    // "照着做可以用"的建议栈、Minea 早年收入、把 Nano Banana 写进关键词被封号的反面教材
    "arcads-ai-video-ad-generation", "loic-creator", "zinny-studio-ai-avatar-skool-community", "ai-english-podcast-wondercraft-channel",
    "your-beat-ai-content-script-writer", "etsy-ai-clipart-packs-claude-code", "adam-lyttle-app-store-account-risk-portfolio",
  ],
  // 访谈里"推荐的移动端技术栈"、"Claude Code 能帮你写"的设想、对标对象的收入、"我们的看法"类的施工建议
  expo: [
    "coinsnap-niche-id-app-empire", "riz-gpt-ai-dating-assistant", "umax-ai-looksmaxing-app", "ci-ai-mobile-app",
    "receipt-scanner-micro-app-niche", "dialogue-paid-translation-app", "kickstart-ai-mobile-app", "cupsa-ai-resume-builder-review",
  ],
  // 收入早于现在这套栈的、只是"推荐"的架构、还没做的点子、泛泛谈技术的;Jamjam Pasta 是餐厅,那句技术栈是写手串稿
  nextjs: [
    "loic-creator", "receipt-scanner-micro-app-niche", "cupsa-ai-resume-builder-review", "guilty-chef-programmatic-seo-recipe-directory",
    "permit-sync-local-permit-saas", "spec-sheet-b2b-pdf-compare", "materialize-admin-envato-dashboard-template",
    "ready-ai-landing-page-builder", "jamjam-pasta-food-business",
  ],
  // 克隆教程(收入是被克隆那个 App 的)、还没做出来的点子、教人用它的训练营、"用不着 Supabase"、收入早于现在这套栈的
  supabase: [
    "loic-creator", "receipt-scanner-micro-app-niche", "nate-micro-niche-ai-sidehustle-stack", "wordcounter-net-utility-ad-revenue",
    "simplified-clone-bloated-saas-emergent", "ai-coding-bootcamp-landing-page-playbook", "i-am-sober-tracker-clone-rocket",
    "permit-sync-local-permit-saas", "spec-sheet-b2b-pdf-compare", "guilty-chef-programmatic-seo-recipe-directory",
  ],
  // ChatGPT 是"被提到"最多的词:当竞品/风险("ChatGPT 自己也能做")、AEO 卖点("让 ChatGPT 推荐你")、
  // 劝人别做("别在 ChatGPT 上面做")、"试过 ChatGPT 失败了"、"Claude 或 ChatGPT 都行"这种二选一 —— 都不算用它做的
  chatgpt: [
    "outrank", "dialogue-paid-translation-app", "praylock-faith-habit-app", "couplepreneurs-marriage-business-coaching",
    "claude-resume-ats-linkedin-optimizer-service", "data-fetcher", "blogtopin-pinterest-pin-automation", "audiopen-voice-to-text-note-app",
    "claude-code-niche-lead-gen-directory", "nofap-mens-selfimprovement-app", "rhythm-ai-cold-call-simulator",
    "claude-linkedin-executive-ghostwriting", "pantry-chef-ai-fridge-recipe-app", "rabbit-holes-ai-branching-chat-lifetime-deal",
    "ghost-niche-faceless-news-channels", "topical-map-ai-seo-tool-and-exit", "poppy-ai-visual-creator-canvas",
    "free-ai-workshop-trojan-horse-funnel", "claude-team-training-service", "next-love-niche-finder-extension",
    "ai-tools-assessment-999-prescription", "tone-adapt-guitar-tone-app", "tokfy-tiktok-shop-ai-ecosystem",
    "adam-lyttle-app-store-account-risk-portfolio", "postscript-human-sales-floor-then-ai-agents", "tube-magic-multivideo-script-tool",
    "claude-dating-profile-writing-service", "ai-coding-bootcamp-landing-page-playbook", "minnow-marketing-ai-local-marketing-agency",
    "diesel-dudes-trucking-repair-local-seo", "zeeshan-vibe-coded-website-automation-agency", "peptide-tracker-app",
    "rachel-richards-two-book-kdp-royalties", "richard-yu-ai-product-arbitrage-digital-products", "local-internet-presence",
  ],
  // 只是"用了"别人的浏览器插件、保护插件、插件"在做"、或者讲的是创始人以前的另一个产品 —— 都不是做插件的生意
  "chrome-extension": [
    "pluto-security-vibe-code-security-platform", "single-page-read-later-app-replit", "website-landlord-rank-and-rent-local-leadgen",
    "shipyard-indie-ai-app-builder", "elder-wisdom-ai-avatar-youtube-channel", "ai-first-one-person-media-thailand",
    "ready-ai-landing-page-builder", "meetbot-zero-burn-solo-saas-portfolio", "everbee-creator-business-platform",
    "typeflo-google-docs-seo-blog-ltd", "indie-hackers-interview-site-sponsorships", "ramp-ventures-buy-grow-sell-saas-portfolio",
    "documind-chat-with-pdf-saas", "typingmind-tony-dinh-solo-product-portfolio",
  ],
  // Lovable 公司本身(两条)、Lovable 的竞品、"SLC (Simple, Lovable, Complete)"里的形容词、竞品列举、只是推荐工具清单的视频、
  // 教人用 Lovable 的训练营、未商业化的个人项目、"用 Cursor 或 Lovable 都能做"的假设句
  lovable: [
    "lovable-ai-software-builder-100m-arr", "lovable-vibe-coding-platform", "fluently-youtube-translate-extension", "ready-ai-landing-page-builder",
    "nate-micro-niche-ai-sidehustle-stack", "ai-coding-bootcamp-landing-page-playbook", "topbook-local-first-health-pkm-app",
    "rabbit-holes-ai-branching-chat-lifetime-deal", "waterllama-hydration-tracker",
    "shipyard-indie-ai-app-builder", "rvv-ontheffing-dutch-road-exemption-saas", // "a smaller Lovable"/拿 Lovable 作对比
  ],
  // Replit 公司本身、"注册用户来自 Replit 公司"、克隆教程(收入是被克隆的 TinyURL/Pocket 类/Floe 的)
  replit: [
    "replit-vibe-coding-platform", "rhythm-ai-cold-call-simulator", "clone-floe-saas-codeguide", "tinyurl-clone-replit-adsense-tool",
    "single-page-read-later-app-replit",
  ],
  // "Bolt/Cursor 都行"的方法论
  bolt: ["four-day-ai-app-99-blueprint"],
  // "照样可以用 Bubble 做"的建议
  bubble: ["rizz-gpt-screenshot-coach-viral-app"],
  // Codex Heim 是写作工具不是 OpenAI Codex;"用 Claude 或 ChatGPT Codex 不写代码就能做"的推销话术;"Claude Code 或 Codex"二选一;
  // 只是能启动 Codex 的产品(CNVS);未商业化的个人项目
  codex: [
    "codex-heim-fantasy-writing-workspace", "dialogue-paid-translation-app", "praylock-faith-habit-app",
    "anonymous-vibecode-3d-web-studio", "cnvs-voice-controlled-coding-agent-workspace", "topbook-local-first-health-pkm-app",
  ],
  // 2026-10-17 逐条核过:做的时候 Cursor 还不存在/后来才开始用(BlogToPin、Bubble 起家的那个、Sync2Sheets、Minea、Guilty Chef、Evergreen);
  // 访谈里"推荐的技术栈"而不是自己用的(Umax、CI、RizzGPT);客户/对比/顺口一提(Tabs、Medvi、
  // Chartbrew、IdeaBrowse、AEO 视频里另一家);产品只是能启动 Cursor(CNVS);给 Cursor 用户做的目录(Cursor Directory,写进正文不进清单)
  cursor: [
    "blogtopin-pinterest-pin-automation", "paid-ads-first-solo-saas-exit-attempt", "sync2sheets-notion-google-sheets-addon",
    "loic-creator", "guilty-chef-programmatic-seo-recipe-directory", "evergreen-display-ad-directory-portfolio",
    "umax-ai-looksmaxing-app", "ci-ai-mobile-app", "riz-gpt-ai-dating-assistant",
    "tabs-ai-contract-to-cash-finance", "medvi-solo-glp1-telehealth", "chartbrew-chartdb-oss-db-viz", "ideabrowse-daily-trend-startup-ideas",
    "aeo-service", "cnvs-voice-controlled-coding-agent-workspace", "cursor-directory", "ready-ai-landing-page-builder",
    "opus-clip-agent-opus", "four-day-ai-app-99-blueprint",
  ],
  // 2026-10-17 逐条核过:BlogToPin/Packager 原文说做的时候 Claude Code 还不存在;Minea 的 $750K 峰值早于 Claude Code;
  // CoinSnap、Bright Side、收据 App、Etsy 剪贴画、whitescreen 的收入是对标对象的,不是用 Claude Code 做的那个;
  // 其余是对比/顺口一提(Cursor 公司本身、Arvow"别人一个周末就能克隆"、TrustMRR 视频里的支线、CNVS 只是能启动 Claude Code)
  "claude-code": [
    "cursor", "coinsnap-niche-id-app-empire", "intune-app-packager-boring-saas", "receipt-scanner-micro-app-niche",
    "brightside-ai-documentary-channel-mcp", "trustmrr-startup-marketplace", "blogtopin-pinterest-pin-automation",
    "arvow-ai-seo-saas-youtube-channel-army", "cnvs-voice-controlled-coding-agent-workspace", "ideabrowse-daily-trend-startup-ideas",
    "acquisition-io-agentic-growth-firm", "ready-ai-landing-page-builder", "white-screen-tool-display-ad-reality-check",
    "etsy-ai-clipart-packs-claude-code", "loic-creator", "guilty-chef-programmatic-seo-recipe-directory",
    "evergreen-display-ad-directory-portfolio",
  ],
};


/** 页面上显示的工具名 */
export const TOOL_LABELS: Record<string, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  lovable: "Lovable",
  bolt: "Bolt",
  replit: "Replit",
  v0: "v0",
  windsurf: "Windsurf",
  copilot: "GitHub Copilot",
  base44: "Base44",
  bubble: "Bubble",
  framer: "Framer",
  notion: "Notion",
  expo: "Expo / React Native",
  runway: "Runway",
  supabase: "Supabase",
  firebase: "Firebase",
  stripe: "Stripe",
  revenuecat: "RevenueCat",
  n8n: "n8n",
  zapier: "Zapier",
  make: "Make",
  elevenlabs: "ElevenLabs",
  midjourney: "Midjourney",
  webflow: "Webflow",
  nextjs: "Next.js",
  airtable: "Airtable",
  shopify: "Shopify",
  "shopify-app": "Shopify app",
  wordpress: "WordPress",
  "chrome-extension": "Chrome extension",
  figma: "Figma",
};
