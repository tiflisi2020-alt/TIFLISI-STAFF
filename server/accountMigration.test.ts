import { afterEach, describe, expect, it, vi } from "vitest";
import * as connection from "./supabase";
import { upsertSupabaseUser } from "./db";

const uid = "11111111-1111-4111-8111-111111111111";
const now = "2026-10-13T00:00:00Z";
afterEach(() => vi.restoreAllMocks());
describe("verified account migration", () => {
  it("keeps the existing numeric account ID and staff link for the verified same-email manager", async () => {
    const row: any = {
      id: 1,
      open_id: "legacy-manus-user",
      email: "merabtamoevi@gmail.com",
      name: "Manager",
      login_method: "google",
      role: "admin",
      department: "waiters",
      staff_id: "stable-staff",
      staff_name: "Existing Staff",
      session_version: 0,
      created_at: now,
      updated_at: now,
      last_signed_in: now,
    };
    vi.spyOn(connection, "supabase").mockImplementation(
      async (_table, query = "", options = {}) => {
        if (options.method === "PATCH") {
          Object.assign(row, options.body);
          return [row] as never;
        }
        if (query.includes("open_id=eq."))
          return (
            decodeURIComponent(query.split("open_id=eq.")[1].split("&")[0]) ===
            row.open_id
              ? [row]
              : []
          ) as never;
        if (query.includes("email=eq.")) return [row] as never;
        throw new Error("Unexpected mock database operation");
      }
    );
    const account = await upsertSupabaseUser({
      id: uid,
      email: "merabtamoevi@gmail.com",
      email_confirmed_at: now,
      user_metadata: { full_name: "Verified Manager" },
    });
    expect(account.id).toBe(1);
    expect(account.openId).toBe("supabase:" + uid);
    expect(account.staffId).toBe("stable-staff");
    expect(account.role).toBe("admin");
  });
  it("does not contact or change app accounts for an unconfirmed claimed manager", async () => {
    const mock = vi.spyOn(connection, "supabase");
    await expect(
      upsertSupabaseUser({
        id: uid,
        email: "merabtamoevi@gmail.com",
        email_confirmed_at: null,
      })
    ).rejects.toThrow("დადასტურება");
    expect(mock).not.toHaveBeenCalled();
  });
  it("ignores claimed admin metadata for a verified non-manager email", async () => {
    const row: any = {
      id: 5,
      open_id: "supabase:" + uid,
      email: "staff@example.com",
      name: "Staff",
      login_method: "supabase",
      role: "user",
      department: null,
      staff_id: null,
      staff_name: null,
      session_version: 0,
      created_at: now,
      updated_at: now,
      last_signed_in: now,
    };
    vi.spyOn(connection, "supabase").mockImplementation(
      async (_t, _q, options = {}) => {
        if (options.method === "PATCH") Object.assign(row, options.body);
        return [row] as never;
      }
    );
    const account = await upsertSupabaseUser({
      id: uid,
      email: "staff@example.com",
      email_confirmed_at: now,
      user_metadata: { role: "admin", email: "merabtamoevi@gmail.com" },
    });
    expect(account.role).toBe("user");
  });
});
