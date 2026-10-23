import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME, SESSION_MS } from "../shared/const";

vi.mock("./_core/sdk", () => ({
  sdk: {
    verifySession: vi.fn(),
    createSessionToken: vi.fn(),
  },
}));

import { sdk } from "./_core/sdk";
import { renewSessionCookieIfNeeded } from "./_core/session";

describe("session sliding renewal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not renew when more than 15 days remain", async () => {
    const exp = Math.floor((Date.now() + 20 * 24 * 60 * 60 * 1000) / 1000);
    vi.mocked(sdk.verifySession).mockResolvedValue({
      openId: "supabase:u1",
      appId: "app",
      name: "Staff",
      authVersion: 1,
      exp,
    });
    const cookie = vi.fn();
    await renewSessionCookieIfNeeded(
      {
        headers: { cookie: `${COOKIE_NAME}=existing-token` },
      } as never,
      { cookie } as never,
      {
        id: 1,
        openId: "supabase:u1",
        name: "Staff",
        sessionVersion: 1,
      } as never
    );
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
  });

  it("renews when fewer than 15 days remain", async () => {
    const exp = Math.floor((Date.now() + 5 * 24 * 60 * 60 * 1000) / 1000);
    vi.mocked(sdk.verifySession).mockResolvedValue({
      openId: "supabase:u1",
      appId: "app",
      name: "Staff",
      authVersion: 1,
      exp,
    });
    vi.mocked(sdk.createSessionToken).mockResolvedValue("fresh-token");
    const cookie = vi.fn();
    await renewSessionCookieIfNeeded(
      {
        headers: { cookie: `${COOKIE_NAME}=existing-token` },
      } as never,
      { cookie } as never,
      {
        id: 1,
        openId: "supabase:u1",
        name: "Staff",
        sessionVersion: 2,
      } as never
    );
    expect(sdk.createSessionToken).toHaveBeenCalledWith(
      "supabase:u1",
      expect.objectContaining({
        expiresInMs: SESSION_MS,
        authVersion: 2,
      })
    );
    expect(cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      "fresh-token",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: SESSION_MS,
      })
    );
  });
});
