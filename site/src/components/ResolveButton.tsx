"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResolveButton({ id }: { id: number }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      className="btn shrink-0 !px-3 !py-1 !text-[0.72rem] disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/admin/resolve-error", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id }),
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      ✓ Resolve
    </button>
  );
}
