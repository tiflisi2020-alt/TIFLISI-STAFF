import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { staffRouter } from "./staffRouter";
import { supabase } from "./supabase";

vi.mock("./supabase", async () => {
  const actual =
    await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, supabase: vi.fn() };
});
const mock = vi.mocked(supabase);
const user: User = {
  id: 1,
  openId: "verified-user",
  name: "Test",
  email: null,
  loginMethod: null,
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
function caller(account: User | null = user) {
  return staffRouter.createCaller({
    user: account,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
const tomorrow = new Date();
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);
const input = {
  department: "waiters" as const,
  own: { name: "Staff A", date, time: "14:00" },
  target: { name: "Staff B", date, time: "9:00" },
  reason: "მნიშვნელოვანი პირადი მიზეზი",
};

beforeEach(() => mock.mockReset());
describe("staff authorization and swap validation", () => {
  it("rejects anonymous swap requests before accessing database", async () => {
    await expect(caller(null).createSwap(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mock).not.toHaveBeenCalled();
  });
  it("rejects ordinary users linking accounts", async () => {
    await expect(
      caller().linkAccount({
        accountId: 1,
        department: "waiters",
        staffId: "waiters:1",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("requires verified account-to-staff linkage", async () => {
    mock.mockResolvedValueOnce([{ id: 1, department: null, staff_name: null }]);
    await expect(caller().createSwap(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it("rejects impersonation via the viewed staff selection", async () => {
    mock.mockResolvedValueOnce([
      { id: 1, department: "waiters", staff_name: "Different Staff" },
    ]);
    await expect(caller().createSwap(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("rejects self-swaps", async () => {
    mock.mockResolvedValueOnce([
      {
        id: 1,
        department: "waiters",
        staff_name: "Staff A",
        staff_id: "waiters:1",
      },
    ]);
    mock.mockResolvedValueOnce([
      { id: 1, name: "Staff A" },
      { id: 2, name: "Staff B" },
    ]);
    for (let i = 0; i < 5; i++) mock.mockResolvedValueOnce([]);
    await expect(
      caller().createSwap({
        ...input,
        target: { ...input.target, name: "Staff A" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects historical shifts", async () => {
    mock.mockResolvedValueOnce([
      {
        id: 1,
        department: "waiters",
        staff_name: "Staff A",
        staff_id: "waiters:1",
      },
    ]);
    mock.mockResolvedValueOnce([
      { id: 1, name: "Staff A" },
      { id: 2, name: "Staff B" },
    ]);
    for (let i = 0; i < 5; i++) mock.mockResolvedValueOnce([]);
    await expect(
      caller().createSwap({
        ...input,
        own: { ...input.own, date: "2020-01-01" },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("rejects invalid reasons and oversized read ranges", async () => {
    await expect(
      caller().createSwap({ ...input, reason: "short" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(null).shifts({ from: "2026-01-01", to: "2026-12-31" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mock).not.toHaveBeenCalled();
  });
  it("rechecks current schedule and rejects stale selections", async () => {
    mock.mockResolvedValueOnce([
      {
        id: 1,
        department: "waiters",
        staff_name: "Staff A",
        staff_id: "waiters:1",
      },
    ]);
    mock.mockResolvedValueOnce([
      { id: 1, name: "Staff A" },
      { id: 2, name: "Staff B" },
    ]);
    for (let i = 0; i < 5; i++) mock.mockResolvedValueOnce([]);
    mock.mockResolvedValue([]);
    await expect(caller().createSwap(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mock.mock.calls.some(call => call[2]?.method === "POST")).toBe(
      false
    );
  });
  it("hides switched-off employees from the roster", async () => {
    mock.mockImplementation(async table => {
      if (table === "waiters")
        return [
          { id: 1, name: "Staff A" },
          { id: 2, name: "Staff B" },
        ];
      if (table === "tiflisi_staff_status")
        return [{ staff_id: "waiters:2" }];
      return [];
    });
    const roster = await caller(null).roster();
    expect(roster.map(person => person.name)).toEqual(["Staff A"]);
  });
  it("writes a pending request only after verifying both real shifts", async () => {
    mock.mockImplementation(async (table, _query, options) => {
      if (table === "tiflisi_accounts")
        return [
          {
            id: 1,
            department: "waiters",
            staff_name: "Staff A",
            staff_id: "waiters:1",
          },
        ];
      if (table === "waiters")
        return [
          { id: 1, name: "Staff A" },
          { id: 2, name: "Staff B" },
        ];
      if (table === "waiter_positions")
        return [
          {
            waiter_name: "Staff A",
            shift_date: date,
            shift_time: "14:00",
            position: "A",
            notes: "",
          },
          {
            waiter_name: "Staff B",
            shift_date: date,
            shift_time: "9:00",
            position: "H",
            notes: "",
          },
        ];
      if (table === "tiflisi_swap_requests")
        return [
          { id: "request", status: "pending", ...(options?.body as object) },
        ];
      return [];
    });
    const result = await caller().createSwap(input);
    expect(result.status).toBe("pending");
    expect(
      mock.mock.calls.filter(call => call[2]?.method === "POST")
    ).toHaveLength(1);
    expect(mock.mock.calls.find(call => call[2]?.method === "POST")?.[0]).toBe(
      "tiflisi_swap_requests"
    );
  });
});
