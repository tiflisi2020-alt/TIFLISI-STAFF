import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { adminRouter } from "./adminRouter";
import { supabase } from "./supabase";
vi.mock("./supabase", async () => {
  const actual =
    await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, supabase: vi.fn() };
});
const mock = vi.mocked(supabase);
const manager: User = {
  id: 1,
  openId: "verified-manager",
  name: "Manager",
  email: "merabtamoevi@gmail.com",
  loginMethod: "google",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
const caller = (user: User | null = manager) =>
  adminRouter.createCaller({
    user,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
const input = {
  department: "waiters" as const,
  staffId: "waiters:1",
  date: "2026-10-15",
  time: "14:00",
  position: "A",
  notes: "განახლება",
  expected: { time: "9:00", position: "H", notes: "" },
};
beforeEach(() => {
  mock.mockReset();
  vi.stubEnv("OWNER_OPEN_ID", "");
});
describe("admin controls", () => {
  it("rejects anonymous users", async () => {
    await expect(
      caller(null).requests({ status: "all", page: 0 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("does not grant access to an arbitrary stored admin role", async () => {
    await expect(
      caller({ ...manager, email: "other@example.com" }).updateShift(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("permits the exact manager to page requests", async () => {
    mock.mockResolvedValue([]);
    await caller().requests({ status: "pending", page: 1 });
    expect(mock).toHaveBeenCalledWith(
      "tiflisi_swap_requests",
      expect.stringContaining("limit=21&offset=20")
    );
  });
  it("updates only a pending request status, never the schedule", async () => {
    mock.mockResolvedValue([{ id: "r", status: "approved" }]);
    await caller().reviewRequest({
      id: "d0b3f5c1-7aca-4dcf-9484-47e908c68cdd",
      status: "approved",
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      "tiflisi_swap_requests",
      expect.stringContaining("status=eq.pending"),
      { method: "PATCH", body: { status: "approved" } }
    );
  });
  it("rejects a request already reviewed", async () => {
    mock.mockResolvedValue([]);
    await expect(
      caller().reviewRequest({
        id: "d0b3f5c1-7aca-4dcf-9484-47e908c68cdd",
        status: "rejected",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("validates time and date before accessing the database", async () => {
    await expect(
      caller().updateShift({ ...input, time: "26:00" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller().updateShift({ ...input, date: "2026-02-30" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("fails closed on concurrent schedule edits", async () => {
    mock.mockImplementation(async table =>
      table === "waiters"
        ? [{ id: 1, name: "Staff A" }]
        : table === "waiter_positions"
          ? [{ id: "1", shift_time: "10:00", position: "H", notes: "" }]
          : []
    );
    await expect(caller().updateShift(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mock.mock.calls.some(c => c[2]?.method === "PATCH")).toBe(false);
  });
  it("writes only the requested shift after snapshot validation", async () => {
    mock.mockImplementation(async (table, _query, options) =>
      table === "waiters"
        ? [{ id: 1, name: "Staff A" }]
        : table === "waiter_positions"
          ? options?.method === "PATCH"
            ? [{ id: "1" }]
            : [{ id: "1", shift_time: "9:00", position: "H", notes: "" }]
          : []
    );
    await caller().updateShift(input);
    const writes = mock.mock.calls.filter(c => c[2]?.method === "PATCH");
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toContain(
      "waiter_name=eq.Staff%20A&shift_date=eq.2026-10-15"
    );
    expect(writes[0][2]?.body).toEqual({
      shift_time: "14:00",
      position: "A",
      notes: "განახლება",
    });
  });
});
