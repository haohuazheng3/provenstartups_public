#!/usr/bin/env python3
"""Build the 2026-10-03 hard-ten specs and approved JSON pages."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TMP = Path("/tmp/provenstartups-hardten-20261003")
SPEC_DIR = TMP / "specs"
DRAFT_DIR = TMP / "drafts"
SITE = "https://provenstartups.com"

loader = importlib.util.spec_from_file_location(
    "hardten_base", ROOT / "site" / "scripts" / "build-hard-ten-2026-09-30.py"
)
assert loader and loader.loader
base = importlib.util.module_from_spec(loader)
loader.loader.exec_module(base)


PAGES = [
    {
        "slug": "business-model-examples",
        "category": "startup-ideas",
        "title": "Business Model Examples: 10 Ways Real Companies Make Money",
        "keywords": ["business model examples", "business model examples with revenue"],
        "volume": "1,300; second variant measured 0 and retained only with free intent evidence",
        "ads": "$3.91 CPC / Low 4",
        "position": "A business model is not a label such as SaaS or marketplace. It is a testable chain from a specific buyer and recurring problem to delivery, charging unit, cost exposure, and evidence that money changed hands.",
        "cases": [
            "screenshotone-screenshot-api", "rocket-plan-b2b-saas-paid-funnel-agency",
            "freeeup-vetted-freelancer-marketplace", "eslo-notion-template-business",
            "from-boise-local-newsletter-sponsorships", "metafizzy-dual-licensed-javascript-widgets",
            "wp-curve-wordpress-support-subscription", "soccer-tech-affiliate-directory",
            "goodnotes-digital-planner-etsy-listing", "finimize-investing-content-community",
        ],
        "sources": [("U.S. SBA business planning guide", "https://www.sba.gov/business-guide/plan-your-business"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What makes a business model complete?", "Which ten business model examples show different money flows?", "How is a business model different from a revenue model?", "Which evidence changes the choice?", "How should a founder compare models before building?"],
    },
    {
        "slug": "revenue-model-examples",
        "category": "saas-metrics",
        "title": "Revenue Model Examples: How Money Actually Enters the Business",
        "keywords": ["revenue model examples", "monetization model examples"],
        "volume": "320; second variant measured 0 and retained only as a same-intent phrase",
        "ads": "CPC unknown / Low 1",
        "position": "A revenue model answers one narrow question: what event creates a charge and who pays it. It is not a synonym for the whole business model, and mixing the two hides margin, concentration, and delivery risk.",
        "cases": [
            "screenshotone-screenshot-api", "freeeup-vetted-freelancer-marketplace",
            "from-boise-local-newsletter-sponsorships", "extended-brain",
            "finimize-investing-content-community", "rocket-plan-b2b-saas-paid-funnel-agency",
            "turkish-ai-video-prompt-credit-saas", "metafizzy-dual-licensed-javascript-widgets",
        ],
        "sources": [("Stripe billing model guide", "https://stripe.com/resources/more/billing-models-types-and-their-challenges"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What is a revenue model?", "Which examples reveal different charging events?", "How do subscriptions, transactions, services, ads, and licenses differ?", "Which numbers are revenue rather than proof of profit?", "How should a founder choose and test a charging event?"],
    },
    {
        "slug": "template-business-model",
        "category": "digital-products",
        "title": "Template Business Model: Selling Once, Reusing the Work",
        "keywords": ["template business model", "template business model with examples"],
        "volume": "480; second variant measured 0 and retained with free wrong-intent SERP evidence",
        "ads": "$13.24 CPC / Medium 40",
        "position": "Templates are attractive only when reuse outruns support, updates, marketplace fees, and distribution work. A reusable file is inventory; a template business needs a buyer task, proof of demand, and a repeatable path to discovery.",
        "cases": [
            "goodnotes-digital-planner-etsy-listing", "etsy-canva-business-template-shop-philippines",
            "extended-brain", "eslo-notion-template-business", "matthew-notion-template-consulting",
            "aura-vibe-design-template-library", "stripo-email-template-builder",
        ],
        "sources": [("U.S. Copyright Office copyright basics", "https://www.copyright.gov/what-is-copyright/"), ("FTC endorsement disclosures", "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers")],
        "sections": ["What is the template business model?", "Which template businesses show the range of outcomes?", "What exactly is sold and how does it stay reusable?", "Where do distribution, support, and IP risk enter?", "How should a founder test one template before building a catalog?"],
    },
    {
        "slug": "low-cost-business-ideas",
        "category": "start-cheap",
        "title": "Low-Cost Business Ideas: 9 Models With Real Starting Constraints",
        "keywords": ["low cost business ideas", "low overhead business ideas", "business ideas with low startup costs"],
        "volume": "590; 210; 110",
        "ads": "$3.61 / Medium 38; $6.25 / Medium 34; $4.19 / Medium 52",
        "position": "Low cost must mean a stated cash, time, tool, inventory, or channel constraint—not an invented dollar budget. Missing startup-cost evidence stays missing, and a cheap test that earns nothing is more useful than a fantasy margin.",
        "cases": [
            "pocket-ai-agent-money-test", "faceless-youtube-30-day-affiliate-receipt",
            "etsy-canva-business-template-shop-philippines", "student-note-packs-facebook-study-groups",
            "income-tax-calculator-2026-android-app", "bot-eat-brain-ai-newsletter",
            "soccer-tech-affiliate-directory", "saas-boilerplate-honest-revenue-timeline",
            "junk-journal-printables-etsy-bundle",
        ],
        "sources": [("U.S. SBA startup cost guide", "https://www.sba.gov/business-guide/plan-your-business/calculate-your-startup-costs"), ("FTC endorsement disclosures", "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers")],
        "sections": ["What does low cost actually mean?", "Which ideas expose their real starting constraints?", "How should cash, time, inventory, and platform risk be compared?", "Which cheap tests failed or stayed tiny?", "How should a founder set a stop rule before spending?"],
    },
    {
        "slug": "niche-business-ideas",
        "category": "startup-ideas",
        "title": "Niche Business Ideas: 8 Narrow Markets With Revenue Evidence",
        "keywords": ["niche business ideas", "niche business examples"],
        "volume": "390; 260",
        "ads": "$3.11 / Low 29; $4.85 / Low 2",
        "position": "A useful niche is not merely small. It has a recognisable buyer, repeated problem, reachable channel, and economics that survive the limited audience. Narrowness should reduce acquisition ambiguity, not excuse weak demand.",
        "cases": [
            "soccer-tech-affiliate-directory", "nurse-jen-healthcare-navigation-channel",
            "goodnotes-digital-planner-etsy-listing", "insurance-sales-genie-niche-internal-tools",
            "receipt-scanner-micro-app-niche", "income-tax-calculator-2026-android-app",
            "thalamus-residency-recruitment-saas", "sober-nation-recovery-local-leadgen-directories",
        ],
        "sources": [("U.S. SBA market research guide", "https://www.sba.gov/business-guide/plan-your-business/market-research-competitive-analysis"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What makes a niche commercially useful?", "Which narrow markets show real demand signals?", "How do niche size, urgency, and channel fit interact?", "Which evidence limitations could make the niche look larger than it is?", "How should a founder run a narrow demand test?"],
    },
    {
        "slug": "subscription-business-ideas",
        "category": "startup-ideas",
        "title": "Subscription Business Ideas: 8 Reasons Customers Keep Paying",
        "keywords": ["subscription business ideas", "subscription business examples"],
        "volume": "110; 10",
        "ads": "$4.11 / Low 26; CPC unknown / Low 8",
        "position": "A subscription is justified only by a recurring job, replenishment, changing information, continuing service, or accumulating workflow value. Static access with recurring billing is not durable merely because the checkout repeats.",
        "cases": [
            "screenshotone-screenshot-api", "wp-curve-wordpress-support-subscription",
            "nomadlist-digital-nomad-membership", "examine-com-nutrition-evidence-membership",
            "from-boise-local-newsletter-sponsorships", "blocksurvey-privacy-first-survey-saas",
            "baremetrics-subscription-analytics", "founder-circle-paid-community-launch",
        ],
        "sources": [("Stripe subscription model guide", "https://stripe.com/resources/more/subscription-business-models-101-types-of-models-how-they-work-and-how-to-choose-one"), ("FTC click-to-cancel rule page", "https://www.ftc.gov/news-events/topics/truth-advertising/negative-options")],
        "sections": ["What makes a subscription worth renewing?", "Which examples reveal different renewal reasons?", "How are software, service, information, and community subscriptions different?", "Which churn and evidence risks matter?", "How should a founder test renewal before promising recurring revenue?"],
    },
    {
        "slug": "online-business-examples",
        "category": "startup-ideas",
        "title": "Online Business Examples: 10 Models With Revenue Receipts",
        "keywords": ["online business examples", "digital business examples", "internet business examples"],
        "volume": "110; 70; 10",
        "ads": "$1.60 / Low 9; remaining CPC unknown",
        "position": "Online is a delivery channel, not a business model. Useful examples name the buyer, paid outcome, delivery obligation, acquisition dependency, and evidence limit instead of treating websites, audiences, or downloads as revenue by themselves.",
        "cases": [
            "screenshotone-screenshot-api", "rocket-plan-b2b-saas-paid-funnel-agency",
            "freeeup-vetted-freelancer-marketplace", "goodnotes-digital-planner-etsy-listing",
            "from-boise-local-newsletter-sponsorships", "soccer-tech-affiliate-directory",
            "wp-curve-wordpress-support-subscription", "finimize-investing-content-community",
            "eslo-notion-template-business", "review-harvest",
        ],
        "sources": [("U.S. SBA online business launch guide", "https://www.sba.gov/business-guide/launch-your-business"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What counts as an online business example?", "Which ten examples represent distinct operating models?", "Who pays and what must be delivered?", "Which platform, evidence, and margin risks hide behind online scale?", "How should a founder choose an online model rather than copy a surface format?"],
    },
    {
        "slug": "licensing-business-model",
        "category": "startup-ideas",
        "title": "Licensing Business Model: What Gets Licensed and Who Pays",
        "keywords": ["licensing business model", "licensing business examples", "data licensing business model"],
        "volume": "40; 40; 10",
        "ads": "CPC unknown / Low 17; Low 1; Low 0",
        "position": "Licensing sells defined rights to use an asset without transferring the asset itself. The model only works when scope, usage, exclusivity, enforcement, updates, and dependence on a few licensees are explicit.",
        "cases": [
            "metafizzy-dual-licensed-javascript-widgets", "finimize-investing-content-community",
            "adrien-oxley-ai-voice-clone-licensing-side-hustle", "leadledger-nice-to-have-saas-postmortem",
            "freightwaves-freight-data-media-platform", "respona-ai-visibility-service",
            "boomerangme-wallet-loyalty-white-label",
        ],
        "sources": [("U.S. Copyright Office copyright basics", "https://www.copyright.gov/what-is-copyright/"), ("USPTO trademark basics", "https://www.uspto.gov/trademarks/basics")],
        "sections": ["What is a licensing business model?", "Which assets and rights do the examples license?", "How do perpetual, recurring, usage, data, and white-label licenses differ?", "Where do rights, concentration, and evidence risks appear?", "How should a founder define a licensable unit?"],
    },
    {
        "slug": "retainer-business-model",
        "category": "ai-agencies",
        "title": "Retainer Business Model: Recurring Service Without Fake SaaS",
        "keywords": ["retainer business model", "retainer business examples"],
        "volume": "10; second variant measured 0 and retained with free wrong-intent evidence",
        "ads": "CPC unknown / Low 10",
        "position": "A retainer sells reserved capacity or a continuing outcome, not unlimited labour. It becomes durable when scope, cadence, service level, rollover, reporting, and renewal criteria are written before the first month starts.",
        "cases": [
            "sandy-lee-nontechnical-ai-automation-retainer", "upwork-ai-seo-blog-retainer",
            "flowly-cloud-hr-recruitment-agent", "aeo-service",
            "ghl-crm-setup-3333-instagram-dm-close", "ai-tools-assessment-999-prescription",
            "ai-local-seo-indexable-website-retainers", "candybox-video-email-b2b-lead-agency",
        ],
        "sources": [("Stripe subscription revenue guide", "https://stripe.com/resources/more/subscription-revenue-101-how-it-works-and-how-businesses-can-make-the-most-of-it"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What is the retainer business model?", "Which retainer examples reveal different promises?", "How should scope, capacity, and price be bounded?", "Which margin and evidence risks make recurring revenue misleading?", "How should a service founder test the first retainer?"],
    },
    {
        "slug": "media-business-model",
        "category": "digital-products",
        "title": "Media Business Model: Audience Is Not the Revenue Line",
        "keywords": ["media business model", "media business examples"],
        "volume": "20; 30",
        "ads": "CPC unknown / Low 0",
        "position": "Media is distribution; the revenue model may be sponsorship, advertising, subscription, product, affiliate, event, or data licensing. Audience size alone says nothing about revenue quality until the buyer and paid outcome are named.",
        "cases": [
            "getlatka-saas-data-media-stack", "from-boise-local-newsletter-sponsorships",
            "tldr-daily-tech-newsletter-ads", "starter-story-founder-interview-library",
            "operators-podcast-niche-b2b-sponsorship", "indie-hackers-interview-site-sponsorships",
            "daily-newsletter-own-product-not-ads", "nurse-jen-healthcare-navigation-channel",
        ],
        "sources": [("Stripe media business model guide", "https://stripe.com/resources/more/media-business-models"), ("FTC endorsement disclosures", "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers")],
        "sections": ["What is a media business model?", "Which examples convert attention through different buyers?", "How do ads, sponsorships, subscriptions, products, and licensing differ?", "Which audience and evidence numbers are easy to misread?", "How should a founder pick one primary paid outcome?"],
    },
]


def write_specs() -> None:
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    DRAFT_DIR.mkdir(parents=True, exist_ok=True)
    combined = ["# 2026-10-03 hard-ten writing specs\n"]
    for index, page in enumerate(PAGES, 1):
        text = base.spec(page)
        (SPEC_DIR / f"{index:02d}-{page['slug']}.md").write_text(text)
        combined.append(f"\n## {index:02d} - {page['slug']}\n\n{text}")
    evidence = ROOT / "ops-reports" / "evidence" / "2026-10-03-hard-ten-specs.md"
    evidence.write_text("\n".join(combined))
    print(f"wrote {len(PAGES)} specs to {SPEC_DIR} and {evidence}")


def build_pages() -> None:
    base.PAGES = PAGES
    base.PUBLISHED = "2026-10-03"
    base.TMP = TMP
    base.SPEC_DIR = SPEC_DIR
    base.DRAFT_DIR = DRAFT_DIR
    base.build_pages()


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"specs", "build"}:
        raise SystemExit("usage: build-hard-ten-2026-10-03.py specs|build")
    write_specs() if sys.argv[1] == "specs" else build_pages()
