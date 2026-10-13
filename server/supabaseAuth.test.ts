import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requireConfirmedIdentity,
  verifiedIdentity,
  authRequest,
} from "./supabaseAuth";
import { isManagerIdentity } from "./manager";
import { requireSameOrigin } from "./authRoutes";
import { sdk } from "./_core/sdk";
import * as db from "./db";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "merabtamoevi@gmail.com",
  email_confirmed_at: "2026-10-13T00:00:00Z",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Supabase identity verification", () => {
  it("rejects an unconfirmed manager even if user metadata claims admin", () => {
    expect(() =>
      requireConfirmedIdentity({
        ...user,
        email_confirmed_at: null,
        user_metadata: { role: "admin" },
      })
    ).toThrow("დადასტურება");
    expect(() =>
      requireConfirmedIdentity({ ...user, is_anonymous: true })
    ).toThrow();
  });
  it("uses only the provider-confirmed email for the manager identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              ...user,
              email: "staff@example.com",
              user_metadata: { role: "admin", email: "merabtamoevi@gmail.com" },
            })
          )
        )
    );
    const identity = await verifiedIdentity("opaque-test-token");
    expect(isManagerIdentity(identity.email)).toBe(false);
  });
  it("maps invalid credentials to a clear Georgian error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error_code: "invalid_credentials" }), {
            status: 400,
          })
        )
    );
    await expect(
      authRequest("token?grant_type=password", { body: {} })
    ).rejects.toThrow("ელფოსტა ან პაროლი არასწორია");
  });
});
describe("same-origin auth API", () => {
  function res() {
    const r: any = { status: vi.fn(), json: vi.fn() };
    r.status.mockReturnValue(r);
    return r;
  }
  it("rejects cross-site and non-JSON login requests", () => {
    const next = vi.fn();
    const r = res();
    requireSameOrigin(
      { headers: { origin: "https://evil.example" }, is: () => true } as never,
      r,
      next
    );
    expect(r.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("accepts a same-origin production JSON request", () => {
    const next = vi.fn();
    const r = res();
    requireSameOrigin(
      {
        headers: { origin: "https://tiflisi-staff.vercel.app" },
        is: () => true,
      } as never,
      r,
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
describe("app session migration and revocation", () => {
  it("does not accept a valid legacy Manus user as an interactive account", async () => {
    vi.spyOn(sdk, "verifySession").mockResolvedValue({
      openId: "legacy-user",
      appId: "test",
      name: "",
    });
    const lookup = vi.spyOn(db, "getUserByOpenId");
    await expect(
      sdk.authenticateRequest({
        path: "/api/trpc/auth.me",
        headers: { cookie: "webdev_app_session=opaque-test" },
      } as never)
    ).rejects.toThrow("Login provider changed");
    expect(lookup).not.toHaveBeenCalled();
  });
  it("rejects a Supabase session revoked after password reset", async () => {
    vi.spyOn(sdk, "verifySession").mockResolvedValue({
      openId: "supabase:" + user.id,
      appId: "test",
      name: "",
      authVersion: 0,
    });
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue({
      openId: "supabase:" + user.id,
      sessionVersion: 1,
    } as never);
    await expect(
      sdk.authenticateRequest({
        path: "/api/trpc/auth.me",
        headers: { cookie: "webdev_app_session=opaque-test" },
      } as never)
    ).rejects.toThrow("Session expired");
  });
});
