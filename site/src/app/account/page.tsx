import Link from "@/components/HoverLink";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/viewer";
import { SITE } from "@/lib/site";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import PortalButton from "@/components/PortalButton";
import NotifyToggle from "@/components/NotifyToggle";
import SavedFiltersList from "@/components/SavedFiltersList";

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
      <div className="panel p-6 sm:p-7"><span className="label">Account</span><h1 className="h-sec mt-2 text-[1.6rem]">{viewer.email}</h1></div>

      <div className="panel mt-4 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-t3">Email</span>
          <span className="text-sm font-medium">{viewer.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-t3">Plan</span>
          {viewer.level === "member" ? (
            <span className="badge-club">Member</span>
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

      <div className="panel mt-4 flex flex-wrap items-center justify-between gap-3 p-6">
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
              <div className="font-semibold">{SITE.club.cta}</div>
              <p className="mt-1 text-xs text-t4">
                Every breakdown, the founder playbooks, filters, and build specs.
              </p>
            </div>
            <Link href="/pricing" className="btn btn-club">
              {SITE.club.cta} — ${SITE.priceMonthly}/mo
            </Link>
          </>
        )}
      </div>

      <div className="panel mt-4 flex items-center justify-between gap-3 p-6">
        <div>
          <div className="font-semibold">Email alerts preference</div>
          <p className="mt-1 text-xs text-t4">
            Save your preference now. Email delivery is not active yet; this switch will control alerts when it starts.
          </p>
        </div>
        <NotifyToggle initial={user?.notifyNewProjects ?? true} />
      </div>

      <div className="panel mt-4 p-6">
        <div className="font-semibold">Saved filters</div>
        <p className="mt-1 text-xs text-t4">
          Keep up to 5 filters for quick access. Matching email alerts are not active yet.
        </p>
        <div className="mt-3">
          <SavedFiltersList />
        </div>
      </div>

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
