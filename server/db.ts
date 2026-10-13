import type { InsertUser, User } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { supabase, type AccountRow, type Department } from "./supabase";
import { isManagerIdentity } from "./manager";

export type StaffAccount = User & {
  department: Department | null;
  staffName: string | null;
  staffId: string | null;
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
  };
}

export async function getUserByOpenId(
  openId: string
): Promise<StaffAccount | undefined> {
  const rows = await supabase<AccountRow[]>(
    "tiflisi_accounts",
    `select=id,open_id,name,email,login_method,role,department,staff_name,staff_id,created_at,updated_at,last_signed_in&open_id=eq.${encodeURIComponent(openId)}&limit=1`
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
  // Email comes only from the trusted OAuth API or an existing server-only row.
  const email = user.email === undefined ? existing?.email : user.email;
  body.role =
    isManagerIdentity(email) ||
    (ENV.ownerOpenId && user.openId === ENV.ownerOpenId)
      ? "admin"
      : "user";
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
