import { auth, currentUser } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { SITE } from "./site";

export type ViewerLevel = "guest" | "free" | "member";

export type Viewer = {
  level: ViewerLevel;
  clerkUserId: string | null;
  email: string | null;
  isAdmin: boolean;
};

/** 读取当前访问者的访问级别(服务端)。会在首次见到已登录用户时落库。 */
export async function getViewer(): Promise<Viewer> {
  const { userId } = await auth();
  if (!userId) return { level: "guest", clerkUserId: null, email: null, isAdmin: false };

  const rows = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1);
  let row = rows[0];

  if (!row) {
    const cu = await currentUser();
    const email = cu?.emailAddresses?.[0]?.emailAddress ?? "";
    const inserted = await db
      .insert(users)
      .values({
        clerkUserId: userId,
        email,
        isAdmin: email.toLowerCase() === SITE.adminEmail,
      })
      .onConflictDoNothing()
      .returning();
    row =
      inserted[0] ??
      (await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1))[0];
  }

  const memberActive =
    row?.plan === "member" && (!row.memberUntil || row.memberUntil > new Date());

  return {
    level: memberActive ? "member" : "free",
    clerkUserId: userId,
    email: row?.email ?? null,
    isAdmin: !!row?.isAdmin,
  };
}
