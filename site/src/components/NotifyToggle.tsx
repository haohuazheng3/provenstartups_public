"use client";

import { useState } from "react";

export default function NotifyToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <button
      className={`btn !px-4 !py-1.5 !text-[0.8rem] ${on ? "!bg-s3" : ""} disabled:opacity-60`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const next = !on;
        try {
          const res = await fetch("/api/account/notify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: next }),
          });
          if (res.ok) setOn(next);
        } finally {
          setBusy(false);
        }
      }}
    >
      {on ? "✓ On" : "Off"}
    </button>
  );
}
