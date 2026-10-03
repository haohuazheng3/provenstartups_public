#!/bin/bash
# 俱乐部改版的发布顺序(CLAUDE.md 进度指针里的铁律):
#   1 合并固定四段入库  2 SEO 第五轮 QC+发布  3 类型检查  4 提交推送  5 API 部署并等 READY  6 smoke  7 IndexNow
# 任一步失败即停。用法: bash scripts/release-club.sh [--skip-merge] [--skip-seo]
set -euo pipefail
cd "$(dirname "$0")/.."; ROOT="$(cd .. && pwd)"
SKIP_MERGE=0; SKIP_SEO=0; for a in "$@"; do [ "$a" = "--skip-merge" ] && SKIP_MERGE=1; [ "$a" = "--skip-seo" ] && SKIP_SEO=1; done

echo "== 1 固定四段合并"; if [ $SKIP_MERGE = 0 ]; then
  node --env-file=.env.local ./node_modules/.bin/tsx scripts/merge-fixed-sections.ts --apply; fi

echo "== 2 SEO 第五轮"; if [ $SKIP_SEO = 0 ]; then
  # 两遍:第一遍发全部;hub 页链到本轮的对比页,只有兄弟页落盘后才过死链检查,故第二遍单发 hub
  ( cd "$ROOT/docs/seo/round5" && python3 publish5.py publish | tee /tmp/pub5.txt
    python3 publish5.py publish claude-code-vs-cursor-vs-codex-revenue | tee -a /tmp/pub5.txt
    if grep -q "跳过" /tmp/pub5.txt; then echo "  ✗ 有页面未过 QC,停止"; grep "跳过\|越界\|死链\|禁用词\|缺 H1\|多个 H1" /tmp/pub5.txt; exit 1; fi
    N=$(ls "$ROOT/site/src/content/blog"/*/ | grep -c "\.json$"); echo "  博客 JSON 总数 $N" ); fi

echo "== 3 类型检查"; npx tsc --noEmit
echo "== 4 提交推送"; cd "$ROOT"; git add -A site/src site/scripts site/e2e site/public docs data CLAUDE.md 2>/dev/null || true
git -c user.name="Haohua" commit -q -m "Release the club: playbooks, filters, build desk, and 34 SEO pages

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" || echo "  (无新改动)"
git push -q origin main; SHA=$(git rev-parse HEAD); echo "  $SHA"

echo "== 5 部署"; VT=$(grep -E "^VERCEL_TOKEN=" ~/Desktop/.env | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
ID=$(curl -s -X POST "https://api.vercel.com/v13/deployments" -H "Authorization: Bearer $VT" -H "Content-Type: application/json" \
  -d "{\"name\":\"provenstartups\",\"project\":\"prj_smOVZj1ZZdxp0zd7WXWtx4MCfXUs\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"repoId\":1311241807,\"ref\":\"main\",\"sha\":\"$SHA\"}}" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id') or '')")
echo "  deployment $ID"; for i in $(seq 1 60); do sleep 10; S=$(curl -s -H "Authorization: Bearer $VT" "https://api.vercel.com/v13/deployments/$ID" | python3 -c "import sys,json;print(json.load(sys.stdin).get('readyState'))"); [ "$S" = "READY" ] && break; [ "$S" = "ERROR" ] && { echo "  ✗ 部署失败"; exit 1; }; done
curl -s https://provenstartups.com/api/health | python3 -c "import sys,json;d=json.load(sys.stdin);print('  生产 commit=',d.get('commit'),'healthy=',d.get('healthy'));assert d.get('healthy')"

echo "== 6 smoke"; cd "$ROOT/site" && npm run smoke 2>&1 | grep -E "passed|failed" | tail -2
echo "== 7 IndexNow"; cd "$ROOT" && python3 scripts/indexnow.py 2>&1 | tail -3
echo "== 完成"
