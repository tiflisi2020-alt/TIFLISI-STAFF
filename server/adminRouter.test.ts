import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { adminRouter } from "./adminRouter";
import { supabase } from "./supabase";
import { addDays, dateKey, restaurantDate } from "../shared/schedule";
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
const caller = (user: TrpcContext["user"] = manager) =>
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
  it("does not grant admin to OWNER_OPEN_ID with a different email", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "supabase:other-owner");
    await expect(
      caller({
        ...manager,
        openId: "supabase:other-owner",
        email: "other@example.com",
      }).updateShift(input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("permits an administrators-department account", async () => {
    mock.mockResolvedValue([]);
    await caller({
      ...manager,
      email: "admin.dept@example.com",
      department: "administrators",
    }).requests({ status: "pending", page: 0 });
    expect(mock).toHaveBeenCalled();
  });
  it("permits the exact manager to page requests", async () => {
    mock.mockResolvedValue([]);
    await caller().requests({ status: "pending", page: 1 });
    expect(mock).toHaveBeenCalledWith(
      "tiflisi_swap_requests",
      expect.stringContaining("limit=21&offset=20")
    );
  });
  it("rejects a request without changing the schedule", async () => {
    mock.mockResolvedValue([{ id: "r", status: "rejected" }]);
    await caller().reviewRequest({
      id: "d0b3f5c1-7aca-4dcf-9484-47e908c68cdd",
      status: "rejected",
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      "tiflisi_swap_requests",
      expect.stringContaining("status=eq.pending"),
      { method: "PATCH", body: { status: "rejected" } }
    );
  });
  it("gives the shift to the resting colleague when a cover is approved", async () => {
    const day = dateKey(addDays(restaurantDate(), 4));
    const id = "d0b3f5c1-7aca-4dcf-9484-47e908c68cdd";
    const request = {
      id,
      requester_id: 1,
      department: "waiters",
      requester_name: "Staff A",
      own_date: day,
      own_time: "14:00",
      target_name: "Staff B",
      target_date: day,
      target_time: "OFF",
      reason: "მნიშვნელოვანი პირადი მიზეზი",
      status: "pending",
      created_at: "2026-10-16T00:00:00.000Z",
    };
    mock.mockImplementation(async (table, query, options) => {
      const text = String(query ?? "");
      if (table === "tiflisi_swap_requests") {
        if (options?.method === "PATCH")
          return [{ ...request, status: "approved" }];
        return [request];
      }
      if (table === "waiters")
        return [
          { id: 1, name: "Staff A" },
          { id: 2, name: "Staff B" },
        ];
      if (table === "waiter_positions") {
        if (options?.method === "POST" || options?.method === "PATCH")
          return [{ id: "shift" }];
        if (text.includes(encodeURIComponent("Staff A")))
          return [{ shift_time: "14:00", position: "Hall", notes: "a" }];
        return [];
      }
      return [];
    });
    await caller().reviewRequest({ id, status: "approved" });
    const post = mock.mock.calls.find(call => call[2]?.method === "POST");
    const patches = mock.mock.calls.filter(call => call[2]?.method === "PATCH");
    expect(post?.[0]).toBe("waiter_positions");
    expect(post?.[2]?.body).toEqual({
      waiter_name: "Staff B",
      shift_date: day,
      shift_time: "14:00",
      position: "Hall",
      notes: "a",
    });
    expect(patches.map(call => call[0])).toEqual([
      "waiter_positions",
      "tiflisi_swap_requests",
    ]);
    expect(patches[0][1]).toContain(encodeURIComponent("Staff A"));
    expect(patches[0][2]?.body).toEqual({
      shift_time: "OFF",
      position: "",
      notes: "",
    });
    expect(patches[1][2]?.body).toEqual({ status: "approved" });
  });
  it("does not approve a request after the schedule changed", async () => {
    const day = dateKey(addDays(restaurantDate(), 4));
    const id = "d0b3f5c1-7aca-4dcf-9484-47e908c68cdd";
    mock.mockImplementation(async (table, query) => {
      const text = String(query ?? "");
      if (table === "tiflisi_swap_requests")
        return [
          {
            id,
            requester_id: 1,
            department: "waiters",
            requester_name: "Staff A",
            own_date: day,
            own_time: "14:00",
            target_name: "Staff B",
            target_date: day,
            target_time: "OFF",
            reason: "მნიშვნელოვანი პირადი მიზეზი",
            status: "pending",
            created_at: "2026-10-16T00:00:00.000Z",
          },
        ];
      if (table === "waiters")
        return [
          { id: 1, name: "Staff A" },
          { id: 2, name: "Staff B" },
        ];
      if (
        table === "waiter_positions" &&
        text.includes(encodeURIComponent("Staff A"))
      )
        return [{ shift_time: "10:00", position: "", notes: "" }];
      if (table === "waiter_positions")
        return [{ shift_time: "09:00", position: "", notes: "" }];
      return [];
    });
    await expect(
      caller().reviewRequest({ id, status: "approved" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mock.mock.calls.some(call => call[2]?.method === "PATCH")).toBe(
      false
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
  it("rejects a duplicate employee before inserting", async () => {
    mock.mockImplementation(async table =>
      table === "waiters" ? [{ id: 1, name: "Staff A" }] : []
    );
    await expect(
      caller().createEmployee({
        department: "waiters",
        name: "Staff A",
        phone: "",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mock.mock.calls.some(call => call[2]?.method === "POST")).toBe(
      false
    );
  });
  it("adds an employee after the current order", async () => {
    mock.mockImplementation(async (table, query, options) => {
      if (options?.method === "POST") return [{ id: 9 }];
      if (String(query).includes("position_order.desc"))
        return [{ position_order: 3 }];
      if (table === "waiters") return [{ id: 1, name: "Staff A" }];
      return [];
    });
    await expect(
      caller().createEmployee({
        department: "waiters",
        name: "ახალი",
        phone: "555",
      })
    ).resolves.toEqual({ id: "waiters:9" });
    const post = mock.mock.calls.find(call => call[2]?.method === "POST");
    expect(post?.[2]?.body).toEqual({
      name: "ახალი",
      phone: "555",
      position_order: 4,
    });
  });
  it("renames schedule rows when an employee name changes", async () => {
    mock.mockImplementation(async (table, query, options) => {
      if (options?.method === "PATCH") return [{ id: 1 }];
      if (table === "waiters" && String(query).startsWith("select=id,name"))
        return [{ id: 1, name: "Staff A" }];
      return [];
    });
    await caller().updateEmployee({
      department: "waiters",
      staffId: "waiters:1",
      name: "Staff B",
      phone: "",
      positionOrder: 2,
    });
    expect(mock).toHaveBeenCalledWith(
      "waiter_positions",
      "waiter_name=eq.Staff%20A",
      { method: "PATCH", body: { waiter_name: "Staff B" } }
    );
  });
  it("removes the roster row and unlinks accounts without deleting shifts", async () => {
    mock.mockImplementation(async (table, query, options) => {
      if (options?.method === "PATCH" || options?.method === "DELETE")
        return [{ id: 1 }];
      if (table === "waiters" && String(query).startsWith("select=id,name"))
        return [{ id: 1, name: "Staff A" }];
      return [];
    });
    await caller().deleteEmployee({
      department: "waiters",
      staffId: "waiters:1",
    });
    const writes = mock.mock.calls.filter(call => call[2]?.method);
    expect(writes.map(call => [call[0], call[2]?.method])).toEqual([
      ["tiflisi_accounts", "PATCH"],
      ["tiflisi_staff_status", "DELETE"],
      ["waiters", "DELETE"],
    ]);
    expect(writes.some(call => call[0] === "waiter_positions")).toBe(false);
  });
  it("stores the employee on/off state without changing the roster row", async () => {
    mock.mockImplementation(async (table, _query, options) => {
      if (table === "waiters") return [{ id: 1 }];
      if (options?.method === "POST") return [{ staff_id: "waiters:1" }];
      return [];
    });
    await expect(
      caller().setEmployeeActive({
        department: "waiters",
        staffId: "waiters:1",
        active: false,
      })
    ).resolves.toEqual({ active: false });
    const post = mock.mock.calls.find(call => call[2]?.method === "POST");
    expect(post?.[0]).toBe("tiflisi_staff_status");
    expect(post?.[2]?.body).toMatchObject({
      staff_id: "waiters:1",
      active: false,
    });
    expect(mock.mock.calls.some(call => call[2]?.method === "PATCH")).toBe(
      false
    );
  });
});
