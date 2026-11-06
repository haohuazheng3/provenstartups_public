#!/usr/bin/env python3
"""IndexNow 批量推送。Bing/Yandex/Seznam/Naver 共用这个协议,
推一次 api.indexnow.org 会分发给所有参与方。

key 必须能在 https://<domain>/<key>.txt 取到,内容就是 key 本身 —— 
所以 key 文件要先随站点部署上去,否则整批会被拒。
"""
import json, re, subprocess, sys, urllib.parse

DOMAIN = "provenstartups.com"
KEY = "8f3c1d7a9b4e42f0a6d5c8e1b7420f93"   # 32 位十六进制,无敏感性
BATCH = 10000   # 协议单次上限

def sitemap_urls():
    out = subprocess.run(["curl", "-s", "--max-time", "60",
                          f"https://{DOMAIN}/sitemap.xml"],
                         capture_output=True, text=True).stdout
    return re.findall(r"<loc>(.*?)</loc>", out)

def keyfile_ok():
    out = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                          f"https://{DOMAIN}/{KEY}.txt"],
                         capture_output=True, text=True).stdout
    return out.strip() == "200"

def push(urls):
    body = {"host": DOMAIN, "key": KEY,
            "keyLocation": f"https://{DOMAIN}/{KEY}.txt",
            "urlList": urls}
    r = subprocess.run(["curl", "-s", "-w", "\n%{http_code}", "--max-time", "90",
                        "-X", "POST", "https://api.indexnow.org/indexnow",
                        "-H", "Content-Type: application/json; charset=utf-8",
                        "-d", json.dumps(body)],
                       capture_output=True, text=True).stdout
    lines = r.strip().rsplit("\n", 1)
    return lines[-1], (lines[0][:200] if len(lines) > 1 else "")

if __name__ == "__main__":
    if not keyfile_ok():
        print(f"✗ key 文件不可达: https://{DOMAIN}/{KEY}.txt —— 先部署它再推")
        sys.exit(1)
    urls = sitemap_urls()
    print(f"sitemap 取到 {len(urls)} 个 URL")
    for i in range(0, len(urls), BATCH):
        chunk = urls[i:i + BATCH]
        code, resp = push(chunk)
        print(f"  批 {i//BATCH + 1}: {len(chunk)} 个 → HTTP {code} {resp}")
