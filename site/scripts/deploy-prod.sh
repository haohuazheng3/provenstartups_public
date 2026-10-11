#!/usr/bin/env bash
# 生产部署的统一入口:git push 之后跑这个,不要再直接调 Vercel API 让它打包。
#
#   site/scripts/deploy-prod.sh [sha]      # 默认 HEAD
#
# 默认路径:push 到 main 且改了 site/** → .github/workflows/deploy.yml 在 GitHub Actions 里
# 打包并上传产物(Vercel 不再打包,省 Build CPU 费用)。本脚本只负责等它跑完并核对生产。
#
# 退回路径:GitHub Actions 起不来(私有库每月 2,000 分钟额度用完、账单受限、平台故障、
# 排队超过 10 分钟)时,自动改用老办法 —— Vercel API 按 gitSource 部署,由 Vercel 打包。
# 代码本身构建失败(类型错误、lint、build 报错)不会退回:那种错换到 Vercel 上一样会失败,
# 脚本直接打印失败日志并退出 1。
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
SHA="${1:-$(git rev-parse HEAD)}"
SHA="$(git rev-parse "$SHA")"
SHORT="${SHA::7}"
WORKFLOW="deploy.yml"
PROJECT_ID="prj_smOVZj1ZZdxp0zd7WXWtx4MCfXUs"
REPO_ID=1311241807

health_commit() {
  curl -s https://provenstartups.com/api/health \
    | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("commit") or "")
except Exception: print("")' || true
}

wait_for_production() {
  for _ in $(seq 1 30); do
    [ "$(health_commit)" = "$SHORT" ] && { echo "✓ production is on $SHORT"; return 0; }
    sleep 10
  done
  echo "✗ production did not switch to $SHORT within 5 minutes" >&2
  return 1
}

vercel_build_fallback() {
  echo "→ fallback: Vercel builds $SHORT (GitHub Actions unavailable: $1)"
  local vt
  vt=$(grep -h '^VERCEL_TOKEN=' ~/Desktop/.env ~/Desktop/创业/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '" \r\n')
  [ -n "$vt" ] || { echo "VERCEL_TOKEN not found in ~/Desktop/.env" >&2; exit 1; }
  local dep state
  dep=$(curl -s -X POST "https://api.vercel.com/v13/deployments" \
    -H "Authorization: Bearer $vt" -H "Content-Type: application/json" \
    -d "{\"name\":\"provenstartups\",\"project\":\"$PROJECT_ID\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"repoId\":$REPO_ID,\"ref\":\"main\",\"sha\":\"$SHA\"}}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  echo "  deployment $dep"
  for _ in $(seq 1 60); do
    state=$(curl -s "https://api.vercel.com/v13/deployments/$dep" -H "Authorization: Bearer $vt" \
      | python3 -c 'import json,sys; print(json.load(sys.stdin).get("readyState"))')
    case "$state" in READY) break ;; ERROR|CANCELED) echo "✗ Vercel build $state" >&2; exit 1 ;; esac
    sleep 15
  done
  wait_for_production
}

[ "$(health_commit)" = "$SHORT" ] && { echo "✓ production already on $SHORT"; exit 0; }

# 1) 找这次提交对应的 deploy.yml 运行(push 后几秒到一两分钟才出现)
run_id=""
for _ in $(seq 1 24); do
  run_id=$(gh run list --workflow "$WORKFLOW" --commit "$SHA" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)
  [ -n "$run_id" ] && break
  sleep 5
done

if [ -z "$run_id" ]; then
  # deploy.yml 只在 site/** 有改动时触发;只改文档的推送本来就不需要部署
  prod="$(health_commit)"
  if [ -n "$prod" ] && git cat-file -e "$prod^{commit}" 2>/dev/null \
     && git diff --quiet "$prod" "$SHA" -- site .github/workflows/deploy.yml; then
    echo "✓ no site changes since production ($prod) — nothing to deploy"
    exit 0
  fi
  vercel_build_fallback "no workflow run appeared for $SHORT"
  exit 0
fi
echo "→ GitHub Actions run $run_id for $SHORT"

# 2) 等它跑完;排队超过 10 分钟当作起不来
deadline=$(( $(date +%s) + 35*60 ))
queued_since=$(date +%s)
while :; do
  read -r status conclusion < <(gh run view "$run_id" --json status,conclusion --jq '"\(.status) \(.conclusion // "-")"')
  [ "$status" = "completed" ] && break
  if [ "$status" = "queued" ] || [ "$status" = "waiting" ] || [ "$status" = "pending" ]; then
    if [ $(( $(date +%s) - queued_since )) -gt 600 ]; then
      gh run cancel "$run_id" >/dev/null 2>&1 || true
      vercel_build_fallback "run $run_id queued for more than 10 minutes"
      exit 0
    fi
  else
    queued_since=$(date +%s)
  fi
  [ "$(date +%s)" -gt "$deadline" ] && { echo "✗ run $run_id still $status after 35 minutes" >&2; exit 1; }
  sleep 15
done

if [ "$conclusion" = "success" ]; then
  wait_for_production
  exit $?
fi

# 3) 失败了:区分"没起来"(额度/账单/平台)和"代码真的有问题"
steps_ran=$(gh run view "$run_id" --json jobs --jq '[.jobs[].steps[]? | select(.conclusion == "success")] | length')
if [ "$conclusion" = "startup_failure" ] || [ "${steps_ran:-0}" -eq 0 ]; then
  vercel_build_fallback "run $run_id did not start ($conclusion)"
  exit 0
fi

echo "✗ deploy run $run_id failed ($conclusion) — this is a code/build failure, not a quota problem:" >&2
gh run view "$run_id" --log-failed 2>/dev/null | tail -60 >&2 || true
exit 1
