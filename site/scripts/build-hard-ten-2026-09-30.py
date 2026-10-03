#!/usr/bin/env python3
"""Build the 2026-09-30 hard-ten specs and JSON pages.

The script contains no credentials. It reads evidence already in data/en, writes
self-contained writer specs to a temporary directory, and converts approved
Markdown drafts into the site's existing JSON format.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "en"
TMP = Path("/tmp/provenstartups-hardten-20260930")
SPEC_DIR = TMP / "specs"
DRAFT_DIR = TMP / "drafts"
PUBLISHED = "2026-09-30"
SITE = "https://provenstartups.com"

IMAGES = [
    {
        "url": "https://images.pexels.com/photos/3862374/pexels-photo-3862374.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        "alt": "A person working on a laptop while taking notes from business charts.",
        "photographer": "ThisIsEngineering",
        "creditUrl": "https://www.pexels.com/photo/female-engineer-taking-notes-3862374/",
    },
    {
        "url": "https://images.pexels.com/photos/7948008/pexels-photo-7948008.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        "alt": "A founder reviewing company revenue data and graphs on a laptop.",
        "photographer": "RDNE Stock project",
        "creditUrl": "https://www.pexels.com/photo/close-up-shot-of-a-man-using-a-laptop-7948008/",
    },
    {
        "url": "https://images.pexels.com/photos/13929362/pexels-photo-13929362.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        "alt": "A creator arranging a phone, tripod, and laptop for digital production.",
        "photographer": "Mizuno K",
        "creditUrl": "https://www.pexels.com/photo/woman-using-smart-phone-on-tripod-and-a-laptop-computer-13929362/",
    },
    {
        "url": "https://images.pexels.com/photos/8102676/pexels-photo-8102676.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        "alt": "A creator editing digital content on two monitors in a studio.",
        "photographer": "Ron Lach",
        "creditUrl": "https://www.pexels.com/photo/man-sitting-at-the-desk-and-editing-footage-on-a-computer-8102676/",
    },
    {
        "url": "https://images.pexels.com/photos/7605981/pexels-photo-7605981.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        "alt": "Project planning documents and business charts arranged on a desk.",
        "photographer": "MART PRODUCTION",
        "creditUrl": "https://www.pexels.com/photo/photo-of-papers-on-table-7605981/",
    },
    {
        "url": "https://images.pexels.com/photos/8636589/pexels-photo-8636589.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        "alt": "A professional workspace with analytics displayed on a computer monitor.",
        "photographer": "Kampus Production",
        "creditUrl": "https://www.pexels.com/photo/computer-and-laptop-over-white-table-8636589/",
    },
]

PAGES = [
    {
        "slug": "data-product-examples",
        "category": "startup-ideas",
        "title": "Data Product Examples: 7 Businesses That Sell Useful Information",
        "keywords": ["data product examples", "data products business"],
        "volume": "90; second variant unknown",
        "ads": "$24.45 CPC / Low 14",
        "position": "A data product must sell cleaned, structured, decision-ready information; raw data without a recurring buyer decision is inventory, not a product.",
        "cases": ["askyourdatabase", "chartbrew-chartdb-oss-db-viz", "cloudlead-human-researched-b2b-contact-data", "corporate360-b2b-sales-intelligence-data-saas", "getlatka-saas-data-media-stack", "kled-human-data-marketplace", "finimize-investing-content-community"],
        "sources": [("U.S. Data.gov", "https://data.gov/"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What counts as a data product?", "Which examples reveal distinct data products?", "How do these businesses charge?", "What evidence and privacy risks change the decision?", "Which data product should a founder reject?"],
    },
    {
        "slug": "job-board-examples",
        "category": "startup-ideas",
        "title": "Job Board Examples: 7 Hiring Businesses and How They Make Money",
        "keywords": ["job board examples", "job board business examples"],
        "volume": "110; second variant unknown",
        "ads": "$14.45 CPC / Low 15",
        "position": "A job board wins by owning a scarce candidate or employer niche and a repeatable matching workflow; a generic list of vacancies is not defensible.",
        "cases": ["thalamus-residency-recruitment-saas", "workable-recruitment-software-global-saas", "interviewio-live-coding-hiring-assessments", "writeraccess-content-marketplace-workflow", "reworking-one-way-video-interview-saas", "mercor-ai-recruiting-platform", "weekcreateproblems-engineering-assessment-saas"],
        "sources": [("U.S. Employer.gov hiring guidance", "https://www.employer.gov/"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What makes a job board a business rather than a list?", "Which job board examples show distinct models?", "Who pays and what are they buying?", "What breaks liquidity and trust?", "How should a founder choose a niche?"],
    },
    {
        "slug": "faceless-business-ideas",
        "category": "side-income",
        "title": "Faceless Business Ideas: 8 Revenue Cases Without a Personal Brand",
        "keywords": ["faceless business ideas", "faceless online business ideas"],
        "volume": "90; second variant unknown",
        "ads": "$4.64 CPC / Low 26",
        "position": "Faceless is an operating constraint, not an advantage: choose a model where format, research, utility, or distribution matters more than the founder's identity.",
        "cases": ["zinny-studio-ai-avatar-skool-community", "faceless-channel-15-day-niche-test-portfolio", "faceless-youtube-channel", "faceless-youtube-30-day-affiliate-receipt", "barrera-kids-gaming-faceless-youtube", "jake-tran-faceless-documentary-youtube-channels", "ai-faceless-facebook-content-monetization", "binge-central-faceless-compilation-channel"],
        "sources": [("YouTube Partner Program overview", "https://support.google.com/youtube/answer/72851?hl=en"), ("FTC endorsement disclosures", "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers")],
        "sections": ["What is a faceless business?", "Which ideas have actual revenue evidence?", "Which monetization model fits each format?", "What costs and platform risks disappear from headline revenue?", "Which faceless idea is worth testing first?"],
    },
    {
        "slug": "niche-website-examples",
        "category": "blogs-and-affiliate",
        "title": "Niche Website Examples: 7 Sites With Revenue Evidence",
        "keywords": ["niche website examples", "profitable niche website examples"],
        "volume": "70; second variant unknown",
        "ads": "$1.21 CPC / Low 17",
        "position": "The durable niche site owns a narrow decision, dataset, or recurring workflow; traffic alone is fragile when the monetization and source quality are hidden.",
        "cases": ["mark-flippa-content-site-acquisitions", "syed-balkhi-wpbeginner-awesome-motive-wordpress-ecosystem", "soccer-tech-affiliate-directory", "termites-blog-website-flippa-acquisition", "guilty-chef-programmatic-seo-recipe-directory", "gasbuddy-crowdsourced-price-directory", "starter-story-founder-interview-library"],
        "sources": [("Google people-first content guidance", "https://developers.google.com/search/docs/fundamentals/creating-helpful-content"), ("FTC endorsement disclosures", "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers")],
        "sections": ["What makes a niche website defensible?", "Which niche website examples have useful evidence?", "How do the sites make money?", "What traffic and evidence risks matter?", "How should a founder select the niche?"],
    },
    {
        "slug": "lead-generation-business-model",
        "category": "ai-agencies",
        "title": "Lead Generation Business Model: Who Pays, What Counts, and Where It Breaks",
        "keywords": ["lead generation business model", "lead gen business model"],
        "volume": "50; second variant unknown",
        "ads": "CPC unknown / Low 5",
        "position": "Sell an auditable qualified outcome, not a spreadsheet of names; consent, definition, attribution, replacement policy, and unit economics belong in the offer.",
        "cases": ["leadto-listing-ai-agency", "passport-appointment-alert-service", "ih-landscaping-project-service-growth", "the-scalab-ai-cold-call-lead-gen-agency", "ai-lead-generation", "infinity-pilot-ai-setter-closer-funnel", "cloudlead-human-researched-b2b-contact-data"],
        "sources": [("FTC Telemarketing Sales Rule", "https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule"), ("FCC unwanted calls consumer guide", "https://docs.fcc.gov/public/attachments/DOC-408396A1.pdf")],
        "sections": ["What is the lead generation business model?", "Which real cases show the main variants?", "How should a qualified lead be priced?", "Where do consent, attribution, and delivery fail?", "When should a founder reject lead generation?"],
    },
    {
        "slug": "membership-business-model",
        "category": "startup-ideas",
        "title": "Membership Business Model: 7 Ways Belonging Becomes Recurring Revenue",
        "keywords": ["membership business model", "membership business examples"],
        "volume": "30; 10",
        "ads": "$2.75 CPC / Low 31",
        "position": "Membership renews only when access, identity, curation, accountability, or utility keeps changing; a static content vault is usually a one-time product with recurring billing.",
        "cases": ["solesavy-sneakerhead-paid-community", "nomadlist-digital-nomad-membership", "indie-worldwide-founder-community", "video-trading-com-membership", "founder-circle-paid-community-launch", "examine-com-nutrition-evidence-membership", "guilty-chef-programmatic-seo-recipe-directory"],
        "sources": [("Stripe subscription business models", "https://stripe.com/resources/more/subscription-business-models-101-types-of-models-how-they-work-and-how-to-choose-one"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What is a membership business model?", "Which examples reveal different renewal reasons?", "How should membership be priced and measured?", "Why do memberships churn?", "When is membership the wrong model?"],
    },
    {
        "slug": "newsletter-business-model",
        "category": "digital-products",
        "title": "Newsletter Business Model: 7 Ways Email Audiences Actually Pay",
        "keywords": ["newsletter business model", "newsletter monetization strategies"],
        "volume": "20; second variant unknown",
        "ads": "CPC unknown / Low 9",
        "position": "A newsletter is distribution, not the business model; ads, subscriptions, owned products, services, affiliate sales, and data licensing have different economics.",
        "cases": ["from-boise-local-newsletter-sponsorships", "bot-eat-brain-ai-newsletter", "daily-newsletter-own-product-not-ads", "morning-brew-newsletter-advertising", "tldr-daily-tech-newsletter-ads", "starter-story-founder-interview-library", "finimize-investing-content-community"],
        "sources": [("FTC CAN-SPAM compliance guide", "https://search.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What is the newsletter business model?", "Which examples show the major revenue lines?", "How do audience size and buyer type change pricing?", "What risks hide behind subscriber counts?", "Which newsletter model should a founder choose?"],
    },
    {
        "slug": "content-creator-business-model",
        "category": "digital-products",
        "title": "Content Creator Business Model: 7 Revenue Stacks Beyond Ad Views",
        "keywords": ["content creator business model", "creator business model"],
        "volume": "30; 10",
        "ads": "CPC unknown / Low 1",
        "position": "The strongest creator business owns a product, relationship, or commercial outcome; platform views are a distribution input, not a durable revenue stack.",
        "cases": ["salary-transparent-street-interview-media-business", "codie-sanchez-youtube-business-adsense", "nathan-barry-app-design-ebook-launch", "life-reset-self-improvement-habit-app", "operators-podcast-niche-b2b-sponsorship", "chicken-whisperer-poultry-media-commerce", "naijaloaded-fast-nigerian-entertainment-portal"],
        "sources": [("YouTube Partner Program overview", "https://support.google.com/youtube/answer/72851?hl=en"), ("FTC endorsement disclosures", "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers")],
        "sections": ["What is the content creator business model?", "Which cases show distinct revenue stacks?", "How should a creator choose the paid layer?", "What evidence and concentration risks matter?", "When should a creator refuse a revenue line?"],
    },
    {
        "slug": "affiliate-marketing-business-model",
        "category": "blogs-and-affiliate",
        "title": "Affiliate Marketing Business Model: 7 Revenue Cases and Their Hidden Costs",
        "keywords": ["affiliate marketing business model", "affiliate business model"],
        "volume": "50; 50",
        "ads": "$3.57 CPC / Low 15",
        "position": "Affiliate marketing is a distribution business paid on attributed outcomes; the merchant owns the offer and can change commissions, tracking, approval, or terms.",
        "cases": ["review-harvest", "soccer-tech-affiliate-directory", "faceless-youtube-30-day-affiliate-receipt", "millennial-money-man-blog-to-course", "termites-blog-website-flippa-acquisition", "clickbank-spirituality-faceless-affiliate", "pin-perfection-pinterest-search-traffic-system"],
        "sources": [("FTC endorsement disclosures", "https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers"), ("Amazon Associates operating agreement", "https://affiliate-program.amazon.com/help/operating/agreement")],
        "sections": ["What is the affiliate marketing business model?", "Which cases show different acquisition engines?", "How do commissions become actual economics?", "Which platform and evidence risks matter?", "When should a founder reject affiliate marketing?"],
    },
    {
        "slug": "api-business-model",
        "category": "saas-metrics",
        "title": "API Business Model: 7 Products That Charge for Infrastructure",
        "keywords": ["api business model", "api business examples"],
        "volume": "10; 10",
        "ads": "CPC unknown / Low 0 and Low 17",
        "position": "An API business sells a reliable unit inside another product's workflow; pricing must follow measurable consumption while reliability and support remain economically bounded.",
        "cases": ["screenshotone-screenshot-api", "scrapingbee-web-scraping-api-growth-exit", "pdfshift-html-to-pdf-api", "rest-pack-developer-api-tool-acquisition", "algolia-selling-into-us-from-paris", "finimize-investing-content-community", "data-fetcher"],
        "sources": [("Stripe usage-based pricing", "https://stripe.com/resources/more/usage-based-pricing-strategy-for-saas"), ("ProvenStartups evidence method", f"{SITE}/how-it-works")],
        "sections": ["What is an API business model?", "Which API products show different charging units?", "How should usage be priced?", "What reliability and concentration risks matter?", "When should a founder avoid an API business?"],
    },
]


def case_fact(slug: str) -> str:
    path = DATA / f"{slug}.json"
    data = json.loads(path.read_text())
    credibility = re.sub(r"\s+", " ", data.get("credibility", "")).strip()
    credibility = re.sub(r"[^.?!]*\bverify\b[^.?!]*[.?!]", "", credibility, flags=re.I).strip()
    if len(credibility) > 850:
        credibility = credibility[:847].rsplit(" ", 1)[0] + "..."
    return (
        f"- [{data['name']}]({SITE}/projects/{slug}) -- category: {data.get('category')}; "
        f"evidence: {data.get('evidence')}; reported result: {data.get('revenue')}; "
        f"team: {data.get('team')}. Evidence limitation: {credibility}"
    )


def spec(page: dict) -> str:
    sources = "\n".join(f"- [{name}]({url})" for name, url in page["sources"])
    cases = "\n".join(case_fact(slug) for slug in page["cases"])
    sections = "\n".join(
        f"- `## {heading}` -- begin with a 40-60 word direct answer, then use the supplied cases and a concrete decision tool."
        for heading in page["sections"]
    )
    hub = f"{SITE}/blog/{page['category']}"
    return f"""# {page['title']}

- Final title: {page['title']}
- Keywords and exact US demand: {', '.join(page['keywords'])}; measured monthly volume: {page['volume']}. Google Ads commercial signal: {page['ads']}. Keyword difficulty and clickstream are unknown.
- One intent: answer the title exactly. Do not broaden into a generic startup-ideas page or another page in this batch.
- Editorial position: {page['position']}
- Product bridge: after the first evidence table, invite the reader to inspect the linked project records and [compare all evidence-graded ideas]({SITE}/projects). Explain that the database helps compare claims; it does not guarantee outcomes.
- Evidence method: [How ProvenStartups grades claims]({SITE}/how-it-works). The current index contains 1,012 records as of 2026-09-30; this is a dated internal count, not a population estimate.

## Supplied case facts

Use at least six cases. Preserve every evidence label and limitation. Do not infer profit, retention, conversion, causality, or current performance unless explicitly supplied.

{cases}

## Supplied general sources

{sources}

## Required structure

{sections}
- Include one comparison table with case, offer or charging unit, reported result, evidence grade, and the limitation that changes the decision.
- Include one compact checklist a reader can apply.
- Include exactly four FAQs specific to `{page['keywords'][0]}`.
- Internal links beyond the cases: [all projects]({SITE}/projects), [evidence method]({SITE}/how-it-works), and the [category hub]({hub}).

## Delivery contract

Write 1,200-1,500 English words in pure Markdown. Start with one H1 and a 40-60 word answer-first summary, then a linked `## Table of Contents` list. Use short 2-4 sentence paragraphs, a decision table, and exactly four FAQ questions at the end under `## Frequently Asked Questions`. Every H2 and H3 must begin with a direct answer. Cite the supplied URLs throughout; do not invent facts, prices, results, credentials, surveys, dataset counts, or research. Treat every revenue statement as a claim with its supplied evidence grade and limitation, never as profit unless explicitly stated. Use ProvenStartups as the Organization voice and author, never a fictional person. Include at least eight natural internal source links, roughly one every 150-200 words. The page must answer the title promise and give the reader a usable decision process, not a generic list. Do not mention these instructions or the writing process. Do not use TODO, TBD, FIXME, XXX, placeholders, brackets for missing material, Chinese notes, lorem, `spec`, `supplied facts`, `provided materials`, `writer instructions`, or `insert here`.

Required delivery instruction: 根据 spec 直接产文：不要联网搜索、不做任何研究/查证；不要执行命令、不读取修改任何文件——spec 已含全部所需；一次成文，纯 Markdown 正文（含结尾 FAQ）输出后即结束。正文中不得出现任何写作备注、元说明、占位符、待补标记。
"""


def write_specs() -> None:
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    DRAFT_DIR.mkdir(parents=True, exist_ok=True)
    combined = ["# 2026-09-30 hard-ten writing specs\n"]
    for i, page in enumerate(PAGES, 1):
        text = spec(page)
        (SPEC_DIR / f"{i:02d}-{page['slug']}.md").write_text(text)
        combined.append(f"\n## {i:02d} - {page['slug']}\n\n{text}")
    evidence = ROOT / "ops-reports" / "evidence" / "2026-09-30-hard-ten-specs.md"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text("\n".join(combined))
    print(f"wrote {len(PAGES)} specs to {SPEC_DIR} and {evidence}")


def extract_faqs(body: str) -> list[dict[str, str]]:
    marker = "## Frequently Asked Questions"
    if marker not in body:
        raise ValueError("missing FAQ heading")
    tail = body.split(marker, 1)[1]
    parts = re.split(r"^###\s+", tail, flags=re.M)[1:]
    faqs = []
    for part in parts:
        lines = part.strip().splitlines()
        q = lines[0].strip()
        answer = " ".join(line.strip() for line in lines[1:] if line.strip() and not line.startswith("## "))
        answer = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", answer)
        answer = re.sub(r"[*_`]", "", answer)
        faqs.append({"q": q, "a": answer})
    if len(faqs) != 4:
        raise ValueError(f"expected four FAQs, got {len(faqs)}")
    return faqs


def build_pages() -> None:
    for i, page in enumerate(PAGES, 1):
        draft = DRAFT_DIR / f"{i:02d}-{page['slug']}.md"
        body = draft.read_text().strip() + "\n"
        faqs = extract_faqs(body)
        description = re.sub(r"[#*_`\[\]()]", "", body.split("\n\n", 2)[1]).strip()
        description = (description[:157].rsplit(" ", 1)[0] + "...") if len(description) > 160 else description
        canonical = f"{SITE}/blog/{page['category']}/{page['slug']}"
        images = [IMAGES[(2 * (i - 1)) % len(IMAGES)], IMAGES[(2 * (i - 1) + 1) % len(IMAGES)]]
        graph = [
            {
                "@type": "Article", "headline": page["title"], "description": description,
                "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
                "author": {"@type": "Organization", "name": "ProvenStartups", "url": SITE},
                "publisher": {"@type": "Organization", "name": "ProvenStartups", "url": SITE},
                "datePublished": PUBLISHED, "dateModified": PUBLISHED,
                "image": [x["url"] for x in images], "about": {"@type": "Thing", "name": page["keywords"][0]},
            },
            {
                "@type": "BreadcrumbList", "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE},
                    {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE}/blog"},
                    {"@type": "ListItem", "position": 3, "name": page["category"].replace("-", " ").title(), "item": f"{SITE}/blog/{page['category']}"},
                    {"@type": "ListItem", "position": 4, "name": page["title"], "item": canonical},
                ],
            },
            {
                "@type": "FAQPage", "mainEntity": [
                    {"@type": "Question", "name": x["q"], "acceptedAnswer": {"@type": "Answer", "text": x["a"]}}
                    for x in faqs
                ],
            },
        ]
        payload = {
            "slug": page["slug"], "category": page["category"], "title": page["title"],
            "description": description, "published": PUBLISHED, "keywords": page["keywords"],
            "images": images, "faqs": faqs,
            "schema": {"@context": "https://schema.org", "@graph": graph}, "body": body,
        }
        target = ROOT / "site" / "src" / "content" / "blog" / page["category"] / f"{page['slug']}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n")
        print(target)


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"specs", "build"}:
        raise SystemExit("usage: build-hard-ten-2026-09-30.py specs|build")
    write_specs() if sys.argv[1] == "specs" else build_pages()
