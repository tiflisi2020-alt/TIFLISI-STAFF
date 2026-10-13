import type { InsertUser, User } from "../drizzle/schema";
import { supabase, type AccountRow, type Department } from "./supabase";
import { isManagerIdentity } from "./manager";

export type StaffAccount = User & {
  department: Department | null;
  staffName: string | null;
  staffId: string | null;
  sessionVersion: number;
};

function asUser(row: AccountRow): StaffAccount {
  return {
    id: Number(row.id),
    openId: row.open_id,
    name: row.name,
    email: row.email,
    loginMethod: row.login_method,
    role: row.role,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastSignedIn: new Date(row.last_signed_in),
    department: row.department,
    staffName: row.staff_name,
    staffId: row.staff_id,
    sessionVersion: row.session_version,
  };
}

export async function getUserByOpenId(
  openId: string
): Promise<StaffAccount | undefined> {
  const rows = await supabase<AccountRow[]>(
    "tiflisi_accounts",
    `select=id,open_id,name,email,login_method,role,department,staff_name,staff_id,created_at,updated_at,last_signed_in,session_version&open_id=eq.${encodeURIComponent(openId)}&limit=1`
  );
  return rows[0] ? asUser(rows[0]) : undefined;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const existing = await getUserByOpenId(user.openId);
  const body: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (user.name !== undefined) body.name = user.name;
  if (user.email !== undefined) body.email = user.email;
  if (user.loginMethod !== undefined) body.login_method = user.loginMethod;
  if (user.lastSignedIn !== undefined) body.last_signed_in = user.lastSignedIn;
  // Email comes only from trusted provider identity or an existing server-only row.
  const email = user.email === undefined ? existing?.email : user.email;
  body.role = isManagerIdentity(email) ? "admin" : "user";
  if (existing) {
    await supabase("tiflisi_accounts", `id=eq.${existing.id}`, {
      method: "PATCH",
      body,
    });
  } else {
    await supabase("tiflisi_accounts", "", {
      method: "POST",
      body: { ...body, open_id: user.openId },
    });
  }
}

// Called only with a server-verified Supabase /user response with confirmed email.
export async function upsertSupabaseUser(
  identity: import("./supabaseAuth").SupabaseIdentity
): Promise<StaffAccount> {
  const { requireConfirmedIdentity } = await import("./supabaseAuth");
  requireConfirmedIdentity(identity);
  const openId = `supabase:${identity.id}`;
  const email = identity.email!.trim().toLowerCase();
  const name =
    typeof identity.user_metadata?.full_name === "string"
      ? identity.user_metadata.full_name.trim().slice(0, 100)
      : email.split("@")[0];
  const existing = await getUserByOpenId(openId);
  if (!existing) {
    const matches = await supabase<AccountRow[]>(
      "tiflisi_accounts",
      `select=id,open_id,login_method&email=eq.${encodeURIComponent(email)}&limit=2`
    );
    if (matches.length > 1)
      throw new Error(
        "ამ ელფოსტაზე რამდენიმე ძველი ანგარიშია. მენეჯერის დახმარებაა საჭირო."
      );
    const legacy = matches[0];
    if (legacy && !legacy.open_id.startsWith("supabase:")) {
      // Keep numeric ID / requests / staff link. Never match an unverified email.
      await supabase("tiflisi_accounts", `id=eq.${legacy.id}`, {
        method: "PATCH",
        body: { open_id: openId, login_method: "supabase" },
      });
    } else if (legacy) {
      throw new Error(
        "ეს ელფოსტა სხვა დადასტურებულ ანგარიშთან არის დაკავშირებული."
      );
    }
  }
  await upsertUser({
    openId,
    email,
    name,
    loginMethod: "supabase",
    lastSignedIn: new Date(),
  });
  const account = await getUserByOpenId(openId);
  if (!account) throw new Error("ანგარიშის შენახვა ვერ შესრულდა.");
  return account;
}

export async function invalidateUserSessions(openId: string): Promise<void> {
  await supabase("rpc/invalidate_tiflisi_sessions", "", {
    method: "POST",
    body: { p_open_id: openId },
  });
}
