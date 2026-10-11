#!/usr/bin/env python3
"""Capture free Bing RSS SERP evidence for the 2026-10-03 hard-ten shortlist."""

from __future__ import annotations

import datetime as dt
import json
import re
import subprocess
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "ops-reports" / "evidence" / "2026-10-03-hard-ten-serp.json"
QUERIES = [
    "business model examples",
    "revenue model examples",
    "template business model",
    "low cost business ideas",
    "niche business ideas",
    "subscription business ideas",
    "online business examples",
    "licensing business model",
    "retainer business model",
    "media business model",
]
STOP = {"a", "an", "and", "for", "in", "of", "the", "to", "with"}
UGC = {"reddit.com", "quora.com", "medium.com", "linkedin.com", "pinterest.com"}


def fetch(query: str) -> list[dict]:
    url = "https://www.bing.com/search?format=rss&setlang=en-us&cc=us&q=" + urllib.parse.quote(query)
    proc = subprocess.run(
        ["curl", "-fsS", "--retry", "3", "--retry-all-errors", "--max-time", "45", url],
        capture_output=True,
        text=True,
        check=True,
    )
    root = ET.fromstring(proc.stdout)
    rows = []
    required = {token for token in re.findall(r"[a-z0-9]+", query.lower()) if token not in STOP}
    for rank, item in enumerate(root.findall("./channel/item")[:10], start=1):
        title = item.findtext("title") or ""
        link = item.findtext("link") or ""
        description = re.sub(r"\s+", " ", item.findtext("description") or "").strip()
        host = urllib.parse.urlparse(link).netloc.lower().removeprefix("www.")
        title_tokens = set(re.findall(r"[a-z0-9]+", title.lower()))
        missing = sorted(required - title_tokens)
        reason = None
        if host in UGC or any(host.endswith("." + domain) for domain in UGC):
            reason = "UGC/community result rather than a purpose-built answer"
        elif len(missing) >= 2:
            reason = "title misses multiple core intent terms: " + ", ".join(missing)
        rows.append(
            {
                "rank": rank,
                "title": title,
                "url": link,
                "description": description,
                "weak": reason is not None,
                "weakReason": reason,
            }
        )
    return rows


def main() -> None:
    results = []
    for query in QUERIES:
        rows = fetch(query)
        results.append(
            {
                "query": query,
                "engine": "Bing RSS (free corroboration; not Google SERP)",
                "layout": "RSS exposes organic titles/URLs/descriptions only; ads, AI answers, and rich-result layout are unknown.",
                "top5WeakCount": sum(1 for row in rows[:5] if row["weak"]),
                "top10WeakCount": sum(1 for row in rows if row["weak"]),
                "results": rows,
            }
        )
    OUT.write_text(
        json.dumps(
            {
                "collectedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                "method": "Conservative title/host heuristic: UGC or a title missing at least two core intent terms is weak. No thinness, freshness, authority, Google position, AI Overview, or ad claim is inferred.",
                "queries": results,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(json.dumps({row["query"]: row["top5WeakCount"] for row in results}))


if __name__ == "__main__":
    main()
