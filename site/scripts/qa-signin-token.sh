#!/bin/bash
# 给 QA 账号(qa-club@provenstartups.com)签发一次性登录链接,并把它在库里标成会员,用于会员态验收。
# 用法: bash scripts/qa-signin-token.sh [member|free]
set -euo pipefail
cd "$(dirname "$0")/.."
CK=$(grep -E "^CLERK_SECRET_KEY=" .env.local | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
UID_=$(curl -s -H "Authorization: Bearer $CK" "https://api.clerk.com/v1/users?email_address=qa-club@provenstartups.com" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'])")
PLAN=${1:-member}
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless'); const fs=require('fs');
const sql = neon(JSON.parse(fs.readFileSync('../.neon_project.json','utf8')).connection_uris[0].connection_uri);
(async()=>{ await sql\`INSERT INTO users (clerk_user_id,email,plan,member_until) VALUES ('$UID_','qa-club@provenstartups.com','$PLAN', now()+interval '30 days') ON CONFLICT (clerk_user_id) DO UPDATE SET plan='$PLAN', member_until=now()+interval '30 days'\`; console.log('  users 表: plan=$PLAN'); })();"
TOKEN_URL=$(curl -s -X POST -H "Authorization: Bearer $CK" -H "Content-Type: application/json" https://api.clerk.com/v1/sign_in_tokens -d "{\"user_id\":\"$UID_\",\"expires_in_seconds\":900}" | python3 -c "import sys,json;print(json.load(sys.stdin)['url'])")
echo "  一次性登录链接(15 分钟内有效): $TOKEN_URL"
