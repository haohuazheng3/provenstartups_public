#!/usr/bin/env python3
"""Collect non-secret demand and live-intent evidence for the 2026-10-03 hard-ten run.

Credentials are accepted only through the process environment. Output contains
GSC query/page rows, aggregate FlowGlance data, and DataForSEO keyword metrics;
no credential or account token is persisted.
"""

from __future__ import annotations

import base64
import datetime as dt
import json
import os
import re
import subprocess
import time
import urllib.parse
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ops-reports" / "evidence"
SITE_URL = "sc-domain:provenstartups.com"
FLOW_SITE_ID = "xwD8uANq1a3e"
SCOPES = ["https://www.googleapis.com/auth/webmasters"]


def curl_json(
    url: str,
    *,
    token: str | None = None,
    method: str = "GET",
    body: Any | None = None,
    basic: str | None = None,
) -> dict[str, Any]:
    cmd = ["curl", "-sS", "--max-time", "120", "-X", method, url]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if basic:
        cmd += ["-H", f"Authorization: Basic {basic}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd += ["-w", "\n__STATUS__:%{http_code}\n"]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    payload_text, _, status_text = proc.stdout.rpartition("\n__STATUS__:")
    status = int(status_text.strip())
    payload = json.loads(payload_text) if payload_text.strip() else {}
    if status >= 400:
        message = payload.get("error", payload)
        raise RuntimeError(f"HTTP {status}: {message}")
    return payload


def google_token() -> str:
    raw = os.environ["GOOGLE_SERVICE_ACCOUNT_B64"]
    creds = json.loads(base64.b64decode(raw))
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claim = {
        "iss": creds["client_email"],
        "scope": " ".join(SCOPES),
        "aud": "https://oauth2.googleapis.com/token",
        "exp": now + 3600,
        "iat": now,
    }

    def b64u(value: dict[str, Any]) -> bytes:
        return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=")

    signing_input = b64u(header) + b"." + b64u(claim)
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    key = serialization.load_pem_private_key(creds["private_key"].encode(), password=None)
    signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    assertion = signing_input + b"." + base64.urlsafe_b64encode(signature).rstrip(b"=")
    encoded = urllib.parse.urlencode(
        {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion.decode(),
        }
    )
    response = subprocess.run(
        [
            "curl", "--http1.1", "-sS", "--retry", "3", "--retry-all-errors",
            "--max-time", "60", "https://oauth2.googleapis.com/token", "-d", "@-",
        ],
        input=encoded,
        capture_output=True,
        text=True,
    )
    if response.returncode:
        raise RuntimeError(f"Google OAuth request failed with curl exit {response.returncode}")
    payload = json.loads(response.stdout)
    if "access_token" not in payload:
        raise RuntimeError(
            f"Google OAuth rejected the service account assertion: {payload.get('error')} / "
            f"{payload.get('error_description')}"
        )
    return payload["access_token"]


def gsc_rows() -> dict[str, Any]:
    end = dt.date.today() - dt.timedelta(days=3)
    start = end - dt.timedelta(days=27)
    encoded_site = urllib.parse.quote(SITE_URL, safe="")
    result = curl_json(
        f"https://searchconsole.googleapis.com/webmasters/v3/sites/{encoded_site}/searchAnalytics/query",
        token=google_token(),
        method="POST",
        body={
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dimensions": ["query", "page"],
            "rowLimit": 25000,
            "dataState": "final",
            "type": "web",
        },
    )
    rows = []
    for row in result.get("rows", []):
        query, page = row.get("keys", ["", ""])
        rows.append(
            {
                "query": query,
                "page": page,
                "clicks": row.get("clicks"),
                "impressions": row.get("impressions"),
                "ctr": row.get("ctr"),
                "position": row.get("position"),
            }
        )
    return {
        "source": "Google Search Console Search Analytics API",
        "site": SITE_URL,
        "dataState": "final",
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "rowCount": len(rows),
        "rows": rows,
    }


def flow_data() -> dict[str, Any]:
    account_token = os.environ["FLOWGLANCE_API"]
    site = curl_json(
        f"https://flowglance.com/api/v1/sites/{FLOW_SITE_ID}", token=account_token
    )
    site_data = site.get("site", site.get("data", site))
    ingest = (site_data.get("data_api") or {}).get("token")
    if not ingest:
        match = re.search(r"fw_ing_[A-Za-z0-9_-]+", json.dumps(site))
        ingest = match.group(0) if match else None
    if not ingest:
        raise RuntimeError("FlowGlance site response did not include a Data API token")
    overview = curl_json(
        "https://flowglance.com/api/data/overview?range=28d", token=ingest
    )
    seo = curl_json("https://flowglance.com/api/data/seo?range=28d", token=ingest)
    # Store aggregate/path/query evidence only. People identities and form data are unnecessary here.
    return {
        "source": "FlowGlance Data API",
        "siteId": FLOW_SITE_ID,
        "domain": site_data.get("domain") or site_data.get("hostname"),
        "range": "28d rolling at collection time",
        "collectedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "overview": overview,
        "seo": seo,
    }


def existing_terms() -> set[str]:
    terms: set[str] = set()
    for path in (ROOT / "site" / "src" / "content" / "blog").rglob("*.json"):
        data = json.loads(path.read_text())
        for term in [data.get("slug", ""), data.get("title", ""), *(data.get("keywords") or [])]:
            normalized = re.sub(r"[^a-z0-9 ]+", " ", str(term).lower())
            terms.add(re.sub(r"\s+", " ", normalized).strip())
    return terms


def candidates() -> list[str]:
    roots = [
        "bootstrapped startup examples", "bootstrapped business examples", "bootstrap business ideas",
        "online business examples", "digital business examples", "internet business examples",
        "low overhead business ideas", "low cost business ideas", "lean business ideas",
        "subscription business examples", "subscription business ideas", "recurring revenue business ideas",
        "recurring revenue business examples", "one person business examples", "solo business examples",
        "solopreneur business ideas", "solopreneur business examples", "self funded startup examples",
        "profitable website examples", "profitable online business examples", "small online business examples",
        "creator economy business models", "creator business examples", "community business model",
        "community business examples", "paid community examples", "membership website examples",
        "information product examples", "information business ideas", "knowledge business examples",
        "freelance business model", "freelance business examples", "agency business model",
        "agency business examples", "consulting business examples", "service business models",
        "marketplace examples", "online marketplace examples", "two sided marketplace examples",
        "software business model", "software business examples", "saas revenue model examples",
        "b2b business model examples", "b2c business model examples", "business model examples",
        "revenue model examples", "monetization model examples", "pricing model examples",
        "usage based pricing examples", "freemium examples", "tiered pricing examples",
        "productized service ideas", "productized consulting examples", "retainer business model",
        "retainer business examples", "licensing business model", "licensing business examples",
        "data licensing business model", "api business examples", "developer tool business model",
        "directory business model", "directory website examples", "job board business model",
        "newsletter business examples", "media business model", "media business examples",
        "content business model", "content business examples", "digital product business model",
        "digital product examples", "online course business model", "course business examples",
        "template business model", "template business examples", "micro saas business model",
        "micro saas examples", "small saas examples", "vertical saas examples",
        "profitable saas examples", "bootstrapped saas examples", "indie hacker business ideas",
        "indie business examples", "boring business ideas", "boring business examples",
        "niche business ideas", "niche business examples", "cash flow business ideas",
        "high margin business ideas", "high margin business examples", "business ideas under 1000",
        "business ideas under 5000", "business ideas with low startup costs", "capital light business ideas",
        "small business revenue examples", "startup revenue examples", "startup revenue models",
        "founder reported revenue", "how to verify company revenue", "how to verify startup revenue",
        "revenue evidence", "revenue proof", "revenue verification methods",
        "business revenue benchmarks", "startup revenue benchmarks", "small business revenue benchmarks",
        "customer concentration risk", "revenue concentration risk", "platform dependency risk",
        "startup risk assessment", "business model risk assessment", "startup due diligence checklist",
        "business idea validation checklist", "business model validation checklist", "startup evaluation framework",
        "how to compare business ideas", "how to choose a business model", "how to evaluate a startup idea",
        "revenue vs profit", "revenue vs income", "gross revenue vs net revenue",
        "monthly revenue vs mrr", "arr vs sales", "bookings vs billings",
        "revenue quality", "quality of revenue", "recurring revenue quality",
        "revenue multiple calculator", "small business valuation calculator", "saas valuation calculator",
        "subscription revenue calculator", "mrr growth calculator", "customer concentration calculator",
        "break even revenue calculator", "profit margin calculator business", "revenue growth calculator",
        "business idea scorecard", "startup idea scorecard", "business model scorecard",
        "online business checklist", "startup due diligence template", "business model comparison table",
        "best business models", "profitable business models", "online business models",
        "digital business models", "small business models", "startup business models",
    ]
    modifiers = [
        "", " for beginners", " for solo founders", " for small business", " with examples",
        " with revenue", " that make money", " in 2026", " explained", " guide",
    ]
    seen = existing_terms()
    output: list[str] = []
    for root in roots:
        for suffix in modifiers:
            term = re.sub(r"\s+", " ", f"{root}{suffix}".lower()).strip()
            if term in seen or term in output:
                continue
            if len(term.split()) > 10 or not re.fullmatch(r"[a-z0-9 ']+", term):
                continue
            output.append(term)
            if len(output) == 1000:
                return output
    # Fill the single paid batch with business-relevant permutations only.
    prefixes = ["real", "successful", "profitable", "small", "online", "solo", "bootstrapped", "independent"]
    nouns = ["business", "startup", "saas", "website", "community", "agency", "marketplace", "newsletter"]
    endings = ["examples", "ideas", "business model", "revenue model", "case studies", "revenue examples"]
    for prefix in prefixes:
        for noun in nouns:
            for ending in endings:
                term = f"{prefix} {noun} {ending}"
                if term in seen or term in output:
                    continue
                output.append(term)
                if len(output) == 1000:
                    return output
    return output


def keyword_volume() -> dict[str, Any]:
    terms = candidates()
    if len(terms) != 1000:
        raise RuntimeError(f"Expected 1,000 candidate keywords, generated {len(terms)}")
    response = curl_json(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
        method="POST",
        basic=os.environ["DATAFORSEO_B64"],
        body=[
            {
                "keywords": terms,
                "location_code": 2840,
                "language_code": "en",
                "include_adult_keywords": False,
            }
        ],
    )
    tasks = response.get("tasks", [])
    if not tasks:
        raise RuntimeError("DataForSEO response did not include tasks")
    task = tasks[0]
    rows = []
    for row in task.get("result") or []:
        rows.append(
            {
                "keyword": row.get("keyword"),
                "search_volume": row.get("search_volume"),
                "competition": row.get("competition"),
                "competition_index": row.get("competition_index"),
                "cpc": row.get("cpc"),
                "monthly_searches": row.get("monthly_searches"),
            }
        )
    rows.sort(key=lambda row: (row.get("search_volume") or -1, row.get("cpc") or -1), reverse=True)
    return {
        "source": "DataForSEO keywords_data/google_ads/search_volume/live",
        "location": "United States (2840)",
        "language": "English",
        "candidateCount": len(terms),
        "returnedCount": len(rows),
        "costUsd": task.get("cost"),
        "statusCode": task.get("status_code"),
        "statusMessage": task.get("status_message"),
        "note": "Google Ads competition is not keyword difficulty; KD and clickstream were not purchased.",
        "rows": rows,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    payloads = {
        OUT / "2026-10-03-hard-ten-gsc.json": gsc_rows(),
        OUT / "2026-10-03-hard-ten-flowglance.json": flow_data(),
        OUT / "2026-10-03-hard-ten-keywords.json": keyword_volume(),
    }
    for path, payload in payloads.items():
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    keyword = payloads[OUT / "2026-10-03-hard-ten-keywords.json"]
    print(
        json.dumps(
            {
                "gscRows": payloads[OUT / "2026-10-03-hard-ten-gsc.json"]["rowCount"],
                "flowDomain": payloads[OUT / "2026-10-03-hard-ten-flowglance.json"]["domain"],
                "keywordRows": keyword["returnedCount"],
                "dataForSeoCostUsd": keyword["costUsd"],
            }
        )
    )


if __name__ == "__main__":
    main()
