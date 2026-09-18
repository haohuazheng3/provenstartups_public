import Link from "next/link";

export function SignupCta({ note, redirectTo }: { note: string; redirectTo?: string }) {
  const href = redirectTo
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`
    : "/sign-in";
  return (
    <div className="panel panel-lit flex flex-col items-center gap-3 p-8 text-center">
      <span className="text-2xl">🔒</span>
      <p className="max-w-sm text-sm text-t2">{note}</p>
      <Link href={href} className="btn btn-primary">
        Create free account
      </Link>
      <span className="text-xs text-t4">Email code only. No password.</span>
    </div>
  );
}

export function ProCta({ note }: { note: string }) {
  return (
    <div className="panel panel-lit flex flex-col items-center gap-3 p-8 text-center">
      <span className="chip chip-solid">PRO</span>
      <p className="max-w-sm text-sm text-t2">{note}</p>
      <Link href="/pricing" className="btn btn-primary">
        Go Pro — $10/mo
      </Link>
      <span className="text-xs text-t4">Cancel anytime.</span>
    </div>
  );
}
