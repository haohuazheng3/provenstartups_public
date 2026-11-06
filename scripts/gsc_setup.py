#!/usr/bin/env python3
"""
GSC 接入:
1) Site Verification API 取 DNS TXT token → 写入 Cloudflare → 验证
2) 把 haohuazheng001@gmail.com 加为该属性所有者(domain 方式)
3) Search Console API 添加站点 + 提交 sitemap
用法: python3 scripts/gsc_setup.py [step]
"""
import base64, json, os, subprocess, sys, time, urllib.parse

DOMAIN = "provenstartups.com"
OWNER_EMAIL = "haohuazheng001@gmail.com"
ZONE = "eb0a8c13ad064fea119265b586b4fce9"

def load_env():
    env = {}
    p = "/Users/haohuazheng/Desktop/创业/.env"
    for line in open(p):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env

ENV = load_env()

def sa_creds():
    raw = base64.b64decode(ENV["GOOGLE_SERVICE_ACCOUNT_B64"])
    return json.loads(raw)

def get_token(scopes):
    """Service account JWT → access token(纯标准库实现)"""
    import hashlib, hmac
    creds = sa_creds()
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    claim = {
        "iss": creds["client_email"],
        "scope": " ".join(scopes),
        "aud": "https://oauth2.googleapis.com/token",
        "exp": now + 3600,
        "iat": now,
    }
    def b64u(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=")
    signing_input = b64u(header) + b"." + b64u(claim)

    # RS256 需要 cryptography
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
    except ImportError:
        print("需要 cryptography: pip3 install --user cryptography")
        sys.exit(1)

    key = serialization.load_pem_private_key(creds["private_key"].encode(), password=None)
    sig = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    jwt = signing_input + b"." + base64.urlsafe_b64encode(sig).rstrip(b"=")

    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt.decode(),
    })
    # 用 curl 走系统 CA:本机 Python 的证书链不可用
    out = subprocess.run(
        ["curl", "-s", "--max-time", "40", "https://oauth2.googleapis.com/token", "-d", data],
        capture_output=True, text=True, check=True,
    ).stdout
    parsed = json.loads(out)
    if "access_token" not in parsed:
        print("token error:", str(parsed)[:300])
        sys.exit(1)
    return parsed["access_token"]

def api(url, token, method="GET", body=None):
    cmd = ["curl", "-s", "--max-time", "60", "-X", method, url,
           "-H", f"Authorization: Bearer {token}",
           "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    if not out.strip():
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"error": "parse", "detail": out[:300]}

def cf(path, method="GET", body=None):
    url = f"https://api.cloudflare.com/client/v4{path}"
    cmd = ["curl", "-s", "--max-time", "40", "-X", method, url,
           "-H", f"Authorization: Bearer {ENV['CLOUDFLARE_API_TOKEN']}",
           "-H", "Content-Type: application/json"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"success": False, "detail": out[:300]}

SCOPES = [
    "https://www.googleapis.com/auth/siteverification",
    "https://www.googleapis.com/auth/webmasters",
]

def main():
    token = get_token(SCOPES)
    print("got access token")

    # 1) 取 DNS TXT token
    r = api(
        "https://www.googleapis.com/siteVerification/v1/token",
        token, "POST",
        {"site": {"type": "INET_DOMAIN", "identifier": DOMAIN}, "verificationMethod": "DNS_TXT"},
    )
    if "error" in r:
        print("token error:", r)
        return
    txt = r["token"]
    print("verification TXT:", txt[:40] + "...")

    # 2) 写入 Cloudflare
    res = cf(f"/zones/{ZONE}/dns_records", "POST",
             {"type": "TXT", "name": "@", "content": txt, "ttl": 1})
    print("cloudflare TXT:", "OK" if res.get("success") else res)

    # 3) 等 DNS 传播后验证
    for attempt in range(12):
        time.sleep(20)
        v = api(
            "https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT",
            token, "POST",
            {"site": {"type": "INET_DOMAIN", "identifier": DOMAIN}},
        )
        if "error" not in v:
            print("verified! resource id:", v.get("id"))
            break
        print(f"  attempt {attempt+1}: not yet ({str(v)[:100]})")
    else:
        print("verification timed out — rerun later")
        return

    # 4) 加所有者
    res_id = v.get("id")
    # 返回的 id 已经是编码过的,别再 quote 一次
    cur = api(f"https://www.googleapis.com/siteVerification/v1/webResource/{res_id}", token)
    if "site" not in cur:
        print("read resource failed:", str(cur)[:200]); return
    owners = cur.get("owners", [])
    if OWNER_EMAIL not in owners:
        owners.append(OWNER_EMAIL)
        upd = api(
            f"https://www.googleapis.com/siteVerification/v1/webResource/{res_id}",
            token, "PUT",
            {"site": cur["site"], "owners": owners},
        )
        print("add owner:", "OK" if "error" not in upd else upd)
    else:
        print("owner already present")

    # 5) Search Console 添加属性 + 提交 sitemap
    site_url = f"sc-domain:{DOMAIN}"
    enc = urllib.parse.quote(site_url, safe="")
    add = api(f"https://www.googleapis.com/webmasters/v3/sites/{enc}", token, "PUT")
    print("add to GSC:", "OK" if "error" not in add else add)

    sm = urllib.parse.quote(f"https://{DOMAIN}/sitemap.xml", safe="")
    sub = api(f"https://www.googleapis.com/webmasters/v3/sites/{enc}/sitemaps/{sm}", token, "PUT")
    print("submit sitemap:", "OK" if "error" not in sub else sub)

if __name__ == "__main__":
    import urllib.parse
    main()
