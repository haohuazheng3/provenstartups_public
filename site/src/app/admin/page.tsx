import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { db, errorEvents, users, events, contactMessages, projects, notifyQueue } from "@/db";
import { sql, desc } from "drizzle-orm";
import ResolveButton from "@/components/ResolveButton";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer.isAdmin) notFound(); // 非管理员一律 404,不暴露存在

  const [errs, [userStats], [evStats], msgs, [projStats], [queueStats]] = await Promise.all([
    db.select().from(errorEvents).orderBy(desc(errorEvents.lastSeen)).limit(40),
    db
      .select({
        total: sql<number>`count(*)::int`,
        members: sql<number>`count(*) filter (where plan = 'member')::int`,
      })
      .from(users),
    db
      .select({
        total: sql<number>`count(*) filter (where is_self = false)::int`,
        pageviews: sql<number>`count(*) filter (where name = 'pageview' and is_self = false)::int`,
        checkouts: sql<number>`count(*) filter (where name = 'checkout_start' and is_self = false)::int`,
      })
      .from(events),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(10),
    db
      .select({
        total: sql<number>`count(*)::int`,
        memberOnly: sql<number>`count(*) filter (where member_only = true)::int`,
      })
      .from(projects),
    db
      .select({
        queued: sql<number>`count(*) filter (where status = 'queued')::int`,
        sent: sql<number>`count(*) filter (where status = 'sent')::int`,
        failed: sql<number>`count(*) filter (where status = 'failed')::int`,
      })
      .from(notifyQueue),
  ]);

  const unresolved = errs.filter((e) => !e.resolved);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Link href="/api/health" className="btn !py-1.5 !text-[0.8rem]">
          /api/health
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { n: projStats?.total ?? 0, l: "projects" },
          { n: projStats?.memberOnly ?? 0, l: "pro-only" },
          { n: userStats?.total ?? 0, l: "users" },
          { n: userStats?.members ?? 0, l: "paying" },
        ].map((s) => (
          <div key={s.l} className="panel panel-lit flex flex-col items-center gap-1 p-4">
            <span className="text-2xl font-semibold text-t1">{s.n}</span>
            <span className="text-xs text-t4">{s.l}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        {[
          { n: evStats?.pageviews ?? 0, l: "pageviews" },
          { n: evStats?.checkouts ?? 0, l: "checkout starts" },
          { n: `${queueStats?.queued ?? 0}/${queueStats?.failed ?? 0}`, l: "mail queued/failed" },
        ].map((s) => (
          <div key={s.l} className="panel panel-lit flex flex-col items-center gap-1 p-4">
            <span className="text-xl font-semibold">{s.n}</span>
            <span className="text-xs text-t4">{s.l}</span>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="px-2 font-semibold">
          Error inbox{" "}
          <span className={unresolved.length ? "text-red-600" : "text-t1"}>
            ({unresolved.length} unresolved)
          </span>
        </h2>
        <div className="mt-3 space-y-2">
          {errs.length === 0 && (
            <div className="panel panel-lit p-5 text-sm text-t4">No errors recorded. 🎉</div>
          )}
          {errs.map((e) => (
            <div key={e.id} className={`panel panel-lit p-4 ${e.resolved ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip">{e.side}</span>
                    <span className="text-sm font-semibold">{e.name}</span>
                    <span className="chip">×{e.count}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-t3">{e.message}</div>
                  <div className="mt-1 text-[0.7rem] text-t4">
                    {e.route} · last {e.lastSeen.toISOString().slice(0, 19).replace("T", " ")}
                  </div>
                  {e.stackHead && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[0.7rem] text-t4">stack</summary>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-bg p-2 text-[0.68rem] text-t2">
                        {e.stackHead}
                      </pre>
                    </details>
                  )}
                </div>
                {!e.resolved && <ResolveButton id={e.id} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="px-2 font-semibold">Recent contact messages</h2>
        <div className="mt-3 space-y-2">
          {msgs.length === 0 && (
            <div className="panel panel-lit p-5 text-sm text-t4">No messages yet.</div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className="panel panel-lit p-4">
              <div className="flex items-center justify-between text-xs text-t4">
                <span>{m.email}</span>
                <span>{m.createdAt.toISOString().slice(0, 10)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-t2">{m.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="px-2 font-semibold">Tools</h2>
        <div className="panel panel-lit mt-3 flex flex-wrap gap-3 p-5">
          <Link href="/self-exclude" className="btn !py-2 !text-[0.85rem]">
            Set analytics exclusion cookie
          </Link>
          <Link href="/api/rl-test" className="btn !py-2 !text-[0.85rem]">
            Rate-limit test endpoint
          </Link>
        </div>
      </section>
    </div>
  );
}
