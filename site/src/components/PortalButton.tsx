"use client";

import { useState } from "react";

export default function PortalButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      className="btn disabled:opacity-60"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/stripe/portal", { method: "POST" });
          const data = await res.json();
          if (res.ok && data.url) window.location.href = data.url;
          else setLoading(false);
        } catch {
          setLoading(false);
        }
      }}
    >
      {loading ? "Opening…" : "Manage subscription"}
    </button>
  );
}
