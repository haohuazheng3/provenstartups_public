import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/viewer";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import PortalButton from "@/components/PortalButton";
import NotifyToggle from "@/components/NotifyToggle";

export const metadata = { title: "Account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (viewer.level === "guest") redirect("/sign-in?redirect_url=%2Faccount");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, viewer.clerkUserId!))
    .limit(1);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="panel panel-lit p-6 sm:p-7"><span className="label">Account</span><h1 className="mt-1.5 text-[1.5rem] font-semibold tracking-[-0.035em]">{viewer.email}</h1></div>

      <div className="panel panel-lit mt-4 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-t3">Email</span>
          <span className="text-sm font-medium">{viewer.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-t3">Plan</span>
          {viewer.level === "member" ? (
            <span className="chip chip-solid">PRO</span>
          ) : (
            <span className="chip">Free</span>
          )}
        </div>
        {viewer.level === "member" && user?.memberUntil && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-t3">Renews / valid until</span>
            <span className="text-sm font-medium">
              {user.memberUntil.toISOString().slice(0, 10)}
            </span>
          </div>
        )}
      </div>

      <div className="panel panel-lit mt-4 flex flex-wrap items-center justify-between gap-3 p-6">
        {viewer.level === "member" ? (
          <>
            <div>
              <div className="font-semibold">Subscription</div>
              <p className="mt-1 text-xs text-t4">
                Update payment method, cancel, or view invoices.
              </p>
            </div>
            <PortalButton />
          </>
        ) : (
          <>
            <div>
              <div className="font-semibold">Upgrade to Pro</div>
              <p className="mt-1 text-xs text-t4">
                Build prompts, transcripts, exclusive ideas, email alerts.
              </p>
            </div>
            <Link href="/pricing" className="btn btn-primary">
              Go Pro
            </Link>
          </>
        )}
      </div>

      {viewer.level === "member" && (
        <div className="panel panel-lit mt-4 flex items-center justify-between gap-3 p-6">
          <div>
            <div className="font-semibold">New-idea email alerts</div>
            <p className="mt-1 text-xs text-t4">
              Get notified when new proven ideas drop.
            </p>
          </div>
          <NotifyToggle initial={user?.notifyNewProjects ?? true} />
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <SignOutButton redirectUrl="/">
          <button className="text-sm text-t4 hover:text-t2">Sign out</button>
        </SignOutButton>
        {viewer.isAdmin && (
          <Link href="/admin" className="text-sm text-t1 hover:underline">
            Admin →
          </Link>
        )}
      </div>
    </div>
  );
}
