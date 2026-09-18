"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 客户端边界错误也进错误收件箱,绝不静默
    fetch("/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: error.name || "RenderError",
        message: error.message,
        stack: error.stack,
        route: typeof location !== "undefined" ? location.pathname : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 pt-24 text-center">
      <div className="panel panel-lit flex w-full flex-col items-center gap-4 p-10">
        <span className="text-4xl">⚠️</span>
        <h1 className="text-xl font-bold">Something broke on our side</h1>
        <p className="text-sm text-t3">
          We&apos;ve logged it and will look into it. Try again in a moment.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <Link href="/" className="btn">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
