/**
 * 保存筛选周报的演练:给 QA 账号插两条"8 天前保存"的筛选,只算不发(dryRun),把信的 HTML 落到 /tmp 看,最后删掉。
 * 用法: node --env-file=.env.local ./node_modules/.bin/tsx scripts/digest-dryrun.ts [输出目录]
 */
import fs from "fs";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";
import { db, savedFilters, users } from "../src/db";
import { enqueueSavedFilterDigests } from "../src/lib/saved-filter-digest";
import { describeFilterQuery } from "../src/lib/list-filters";

async function main() {
  const out = process.argv[2] || "/tmp";
  const [qa] = await db.select().from(users).where(eq(users.email, "qa-club@provenstartups.com")).limit(1);
  if (!qa) throw new Error("QA user not found");
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  const queries = ["build=weekend", "evidence=verified&tier=1"];
  const inserted = await db
    .insert(savedFilters)
    .values(queries.map((q) => ({ clerkUserId: qa.clerkUserId, query: q, label: describeFilterQuery(q), createdAt: eightDaysAgo })))
    .onConflictDoNothing()
    .returning({ id: savedFilters.id });
  try {
    const r = await enqueueSavedFilterDigests({ dryRun: true, onlyClerkUserId: qa.clerkUserId });
    console.log(JSON.stringify({ dueFilters: r.dueFilters, digestsQueued: r.digestsQueued, previews: r.previews.map(({ html, ...p }) => ({ ...p, htmlChars: html.length })) }, null, 2));
    r.previews.forEach((p, i) => fs.writeFileSync(path.join(out, `digest-preview-${i}.html`), p.html));
    // dryRun 不能推 lastSentAt
    const after = await db.select({ lastSentAt: savedFilters.lastSentAt }).from(savedFilters).where(eq(savedFilters.clerkUserId, qa.clerkUserId));
    console.log("lastSentAt after dry run:", after.map((a) => a.lastSentAt));
  } finally {
    await db.delete(savedFilters).where(and(eq(savedFilters.clerkUserId, qa.clerkUserId), inArray(savedFilters.id, inserted.map((x) => x.id))));
    console.log("cleaned up", inserted.length, "rows");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
