"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Row = { id: number; query: string; label: string };

/** 账户页:我保存的筛选(每周一封新匹配邮件),可逐条删除 */
export default function SavedFiltersList() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/saved-filters")
      .then((r) => (r.ok ? r.json() : { filters: [] }))
      .then((d) => setRows(d.filters ?? []))
      .catch(() => setRows([]));
  }, []);

  const remove = async (id: number) => {
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
    await fetch(`/api/saved-filters?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  if (rows === null) return <p className="text-sm text-t3">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-t3">
        No saved filters yet. Filter the{" "}
        <Link href="/projects" className="text-t1 underline underline-offset-2">
          index
        </Link>{" "}
        and press “Email me new matches” to get new ideas that fit, once a week.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
          <Link href={r.query ? `/projects?${r.query}` : "/projects"} className="min-w-0 truncate text-sm font-medium text-t1 hover:underline">
            {r.label}
          </Link>
          <button type="button" onClick={() => remove(r.id)} className="shrink-0 text-xs text-t3 hover:text-t1">
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
