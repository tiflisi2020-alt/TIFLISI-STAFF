import express from "express";
import { request } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAuthRoutes } from "./authRoutes";
import * as auth from "./supabaseAuth";
import * as db from "./db";
import { sdk } from "./_core/sdk";

async function call(
  path: string,
  body?: unknown,
  origin = "https://tiflisi-staff.vercel.app"
) {
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  try {
    return await new Promise<{ status: number; headers: any; body: any }>(
      (resolve, reject) => {
        const req = request(
          {
            host: "127.0.0.1",
            port,
            path,
            method: body === undefined ? "GET" : "POST",
            headers: { origin, "Content-Type": "application/json" },
          },
          res => {
            let text = "";
            res.on("data", chunk => (text += chunk));
            res.on("end", () => {
              let parsed: any;
              try {
                parsed = JSON.parse(text);
              } catch {
                parsed = text;
              }
              resolve({
                status: res.statusCode!,
                headers: res.headers,
                body: parsed,
              });
            });
          }
        );
        req.on("error", reject);
        req.end(body === undefined ? undefined : JSON.stringify(body));
      }
    );
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}
afterEach(() => vi.restoreAllMocks());
describe("Supabase Auth route wiring", () => {
  it("keeps legacy sign-in bookmarks on the website instead of redirecting to Manus", async () => {
    const result = await call("/api/oauth/start");
    expect(result.status).toBe(302);
    expect(result.headers.location).toBe("/login");
  });
  it("does not issue a session to signup before email confirmation", async () => {
    const upstream = vi
      .spyOn(auth, "authRequest")
      .mockResolvedValue({ id: "pending-user" });
    const result = await call("/api/auth/signup", {
      email: "staff@example.com",
      password: "test-only-password",
      name: "Staff Test",
    });
    expect(result.status).toBe(200);
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(upstream.mock.calls[0][0]).toContain(
      encodeURIComponent("https://tiflisi-staff.vercel.app/login")
    );
  });
  it("issues the version-bound HttpOnly app cookie only after server identity verification", async () => {
    vi.spyOn(auth, "authRequest").mockResolvedValue({
      access_token: "mock-access-token",
    });
    vi.spyOn(auth, "verifiedIdentity").mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "staff@example.com",
      email_confirmed_at: "2026-10-13",
    });
    vi.spyOn(db, "upsertSupabaseUser").mockResolvedValue({
      openId: "supabase:verified-user",
      name: "Verified",
      role: "user",
      sessionVersion: 3,
    } as never);
    const sign = vi
      .spyOn(sdk, "createSessionToken")
      .mockResolvedValue("signed-app-token");
    const result = await call("/api/auth/login", {
      email: "staff@example.com",
      password: "test-only-password",
    });
    expect(result.status).toBe(200);
    expect(result.body.role).toBe("user");
    expect(result.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(result.headers["set-cookie"][0]).toContain("Secure");
    expect(result.headers["set-cookie"][0]).toContain("SameSite=Lax");
    expect(sign).toHaveBeenCalledWith(
      "supabase:verified-user",
      expect.objectContaining({
        authVersion: 3,
        expiresInMs: 1000 * 60 * 60 * 24 * 30,
      })
    );
  });
  it("returns a visible error and no cookie for an unconfirmed identity", async () => {
    vi.spyOn(auth, "authRequest").mockResolvedValue({
      access_token: "mock-access-token",
    });
    vi.spyOn(auth, "verifiedIdentity").mockRejectedValue(
      new auth.AuthError(403, "ელფოსტის დადასტურება აუცილებელია.")
    );
    const result = await call("/api/auth/login", {
      email: "staff@example.com",
      password: "test-only-password",
    });
    expect(result.status).toBe(403);
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(result.body.error).toContain("დადასტურება");
  });
  it("blocks a cross-origin request before contacting Supabase", async () => {
    const upstream = vi.spyOn(auth, "authRequest");
    const result = await call(
      "/api/auth/login",
      { email: "staff@example.com", password: "test-only-password" },
      "https://evil.example"
    );
    expect(result.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("updates the password with the verified token and invalidates old app sessions", async () => {
    vi.spyOn(auth, "verifiedIdentity").mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "staff@example.com",
      email_confirmed_at: "2026-10-13",
    });
    const upstream = vi.spyOn(auth, "authRequest").mockResolvedValue({});
    const invalidate = vi
      .spyOn(db, "invalidateUserSessions")
      .mockResolvedValue(undefined);
    const result = await call("/api/auth/password", {
      accessToken: "test-only-recovery-token",
      password: "new-test-only-password",
    });
    expect(result.status).toBe(200);
    expect(invalidate).toHaveBeenCalledWith(
      "supabase:11111111-1111-4111-8111-111111111111"
    );
    expect(upstream).toHaveBeenCalledWith(
      "user",
      expect.objectContaining({
        method: "PUT",
        token: "test-only-recovery-token",
      })
    );
  });
});
