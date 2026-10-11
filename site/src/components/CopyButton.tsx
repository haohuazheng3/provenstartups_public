"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.psTrack?.("copy_prompt", { feature: "build_prompt" });
          window.fw?.("event", "core_feature_used", { feature: "build_prompt" });
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard denied */
        }
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}
