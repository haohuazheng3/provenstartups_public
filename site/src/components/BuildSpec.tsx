"use client";

import { useEffect, useState } from "react";

type Quota = { usedWeek: number; usedMonth: number; weekLimit: number; monthCap: number; remaining: number };

/**
 * 会员构建面板:三项输入 → 一份贴身的构建规格。结果是 markdown,这里只做最小渲染
 * (标题/段落/代码块),不引入 markdown 库 —— 输出是我们自己的模型产物,格式受控。
 */
function Sel({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-[0.78rem] text-t3">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-line bg-s1 px-3 py-2 text-[0.86rem] text-t1">
        {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}

export default function BuildSpec({ slug, name }: { slug: string; name: string }) {
  const [stack, setStack] = useState("nextjs-vercel");
  const [budget, setBudget] = useState("100-500");
  const [hours, setHours] = useState("5-10");
  const [notes, setNotes] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    fetch("/api/build").then((r) => (r.ok ? r.json() : null)).then((d) => d?.quota && setQuota(d.quota)).catch(() => {});
  }, []);

  async function run() {
    if (busy) return;
    setBusy(true); setErr(null); setOut(null);
    try {
      const r = await fetch("/api/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, stack, budget, hoursPerWeek: hours, notes }) });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error === "quota" ? `You've used this week's ${d.quota?.weekLimit ?? 10} builds. The counter resets on a rolling 7-day window.` : d.error === "not_configured" ? "Build desk is offline right now — try again in a few minutes." : "Something went wrong. Nothing was counted against your quota.");
        if (d.quota) setQuota(d.quota);
        return;
      }
      setOut(d.output); setCached(!!d.cached); if (d.quota) setQuota(d.quota);
      window.psTrack?.("build_spec", { slug, stack, budget, hours, cached: !!d.cached });
    } catch { setErr("Network error — please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="panel panel-lit p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="label">Build desk · members</span>
          <h3 className="mt-1 text-[1rem] font-semibold tracking-[-0.02em]">A build spec for {name}, sized to you</h3>
        </div>
        {quota && <span className="text-[0.75rem] text-t3"><span className="mono text-t1">{quota.remaining}</span> of {quota.weekLimit} builds left this week</span>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Sel label="Your stack" value={stack} onChange={setStack} opts={[["nextjs-vercel","Next.js + Vercel + Neon + Stripe"],["python-fastapi","Python / FastAPI"],["no-code","No-code (Lovable, Bolt, Bubble…)"],["mobile-expo","Mobile (Expo + RevenueCat)"],["wordpress","WordPress"],["other","Other"]]} />
        <Sel label="Launch budget" value={budget} onChange={setBudget} opts={[["under-100","Under $100"],["100-500","$100–500"],["500-2000","$500–2,000"],["2000-plus","$2,000+"]]} />
        <Sel label="Hours per week" value={hours} onChange={setHours} opts={[["under-5","Under 5"],["5-10","5–10"],["10-20","10–20"],["20-plus","20+"]]} />
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 400))} placeholder="Optional: your niche, audience, or a constraint (max 400 chars)" className="mt-3 w-full rounded-lg border border-line bg-s1 px-3 py-2 text-[0.86rem] text-t1" />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={busy || (quota?.remaining ?? 1) <= 0} className="btn btn-primary disabled:opacity-60">
          {busy ? "Writing your spec… (30–60s)" : "Build my spec"}
        </button>
        <span className="text-[0.75rem] text-t4">Same idea + same inputs returns the saved spec and doesn&apos;t count.</span>
      </div>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {out && (
        <div className="mt-5">
          {cached && <p className="mb-2 text-[0.75rem] text-t4">Saved spec (not counted).</p>}
          <Md text={out} />
          <button onClick={() => navigator.clipboard?.writeText(out)} className="btn mt-3">Copy the whole spec</button>
        </div>
      )}
    </div>
  );
}

/** 最小 markdown:## 标题、``` 代码块、段落、- 列表、数字列表。 */
function Md({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="my-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-bg p-4 text-[0.8rem] leading-relaxed text-t2">{buf.join("\n")}</pre>);
      continue;
    }
    if (/^#{1,3} /.test(l)) { blocks.push(<h4 key={k++} className="mt-5 text-[0.95rem] font-semibold tracking-[-0.02em]">{l.replace(/^#+ /, "")}</h4>); i++; continue; }
    if (/^(\s*[-*]|\s*\d+\.) /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*[-*]|\s*\d+\.) /.test(lines[i])) items.push(lines[i++].replace(/^(\s*[-*]|\s*\d+\.) /, ""));
      blocks.push(<ul key={k++} className="my-2 list-disc space-y-1 pl-5 text-[0.86rem] text-t2">{items.map((it, j) => <li key={j}>{it}</li>)}</ul>);
      continue;
    }
    if (l.trim()) { blocks.push(<p key={k++} className="my-2 text-[0.86rem] leading-relaxed text-t2">{l}</p>); }
    i++;
  }
  return <div>{blocks}</div>;
}
