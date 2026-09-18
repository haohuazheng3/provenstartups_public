"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn !px-4 !py-1.5 !text-[0.8rem]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.psTrack?.("copy_prompt");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard denied */
        }
      }}
    >
      {copied ? "✓ Copied" : `📋 ${label}`}
    </button>
  );
}
