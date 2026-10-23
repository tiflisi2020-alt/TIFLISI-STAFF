import type { Express, Request, Response } from "express";
import { z } from "zod";
import { COOKIE_NAME, SESSION_MS } from "../shared/const";
import { clearSessionCookies, getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { upsertSupabaseUser, invalidateUserSessions } from "./db";
import { AuthError, authRequest, verifiedIdentity } from "./supabaseAuth";

const SITE = "https://tiflisi-staff.vercel.app";
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z
  .string()
  .min(8, "პაროლი უნდა შეიცავდეს სულ მცირე 8 სიმბოლოს.")
  .max(128);
const credentials = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100),
});
const tokenSchema = z.string().min(20).max(8192);
const allowedOrigins = new Set([
  SITE,
  "https://8328-iuhvk1pbi9bqbz79r589t-91545ddf.us1.manus.computer",
  "https://3000-iuhvk1pbi9bqbz79r589t-91545ddf.us1.manus.computer",
]);
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");
}

export function requireSameOrigin(
  req: Request,
  res: Response,
  next: () => void
) {
  const origin = req.headers.origin;
  // Browser fetches to this API must be same-origin JSON; no CORS / form fallback.
  if (
    typeof origin !== "string" ||
    !allowedOrigins.has(origin) ||
    !req.is("application/json") ||
    req.headers["sec-fetch-site"] === "cross-site"
  ) {
    res.status(403).json({
      error: "მოთხოვნა არ არის დაშვებული. გახსენი ტიფლისის მთავარი საიტი.",
    });
    return;
  }
  next();
}
function route(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error:
            "გადაამოწმე ელფოსტა და ყველა აუცილებელი ველი. პაროლი უნდა შეიცავდეს სულ მცირე 8 სიმბოლოს.",
        });
        return;
      }
      if (error instanceof AuthError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      // Never log request body, passwords, access tokens, or upstream errors.
      console.error("[Supabase Auth] Operation failed");
      res.status(503).json({
        error: "ანგარიშის დამუშავება ვერ შესრულდა. ცოტა ხანში სცადე.",
      });
    }
  };
}
async function establishSession(token: string, req: Request, res: Response) {
  const identity = await verifiedIdentity(token);
  const account = await upsertSupabaseUser(identity);
  const session = await sdk.createSessionToken(account.openId, {
    name: account.name ?? "",
    expiresInMs: SESSION_MS,
    authVersion: account.sessionVersion,
  });
  res.cookie(COOKIE_NAME, session, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_MS,
  });
  res.json({ success: true, role: account.role });
}
export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/status", (_req, res) =>
    res
      .set("Cache-Control", "no-store")
      .json({ provider: "supabase", emailConfirmationRequired: true })
  );
  // Legacy bookmarks never send visitors to Manus after the agreed migration.
  app.get("/api/oauth/start", (_req, res) => res.redirect(302, "/login"));
  app.get("/api/oauth/callback", (_req, res) =>
    res.redirect(302, "/login?notice=provider-changed")
  );
  app.use("/api/auth", requireSameOrigin);
  app.post(
    "/api/auth/login",
    route(async (req, res) => {
      const input = credentials.parse(req.body);
      const data = await authRequest<{ access_token?: string }>(
        "token?grant_type=password",
        { body: input }
      );
      if (!data.access_token)
        throw new AuthError(401, "ავტორიზაცია ვერ შესრულდა.");
      await establishSession(data.access_token, req, res);
    })
  );
  app.post(
    "/api/auth/signup",
    route(async (req, res) => {
      const input = signupSchema.parse(req.body);
      await authRequest(
        "signup?redirect_to=" + encodeURIComponent(`${SITE}/login`),
        {
          body: {
            email: input.email,
            password: input.password,
            data: { full_name: input.name },
          },
        }
      );
      // Do not issue an app session even if Supabase settings change to auto-confirm.
      res.json({
        success: true,
        message:
          "შეამოწმე ელფოსტა და დაადასტურე ანგარიში მიღებულ წერილში. შემდეგ შედი შენი პაროლით.",
      });
    })
  );
  app.post(
    "/api/auth/resend",
    route(async (req, res) => {
      const email = emailSchema.parse(req.body.email);
      await authRequest(
        "resend?redirect_to=" + encodeURIComponent(`${SITE}/login`),
        { body: { email, type: "signup" } }
      );
      res.json({
        success: true,
        message:
          "თუ ანგარიშს დადასტურება სჭირდება, წერილს მიიღებ. შეამოწმე Spam საქაღალდეც.",
      });
    })
  );
  app.post(
    "/api/auth/recover",
    route(async (req, res) => {
      const email = emailSchema.parse(req.body.email);
      await authRequest(
        "recover?redirect_to=" + encodeURIComponent(`${SITE}/reset-password`),
        { body: { email } }
      );
      res.json({
        success: true,
        message:
          "თუ ამ ელფოსტაზე ანგარიში არსებობს, პაროლის აღდგენის წერილს მიიღებ.",
      });
    })
  );
  app.post(
    "/api/auth/exchange",
    route(async (req, res) => {
      const token = tokenSchema.parse(req.body.accessToken);
      await establishSession(token, req, res);
    })
  );
  app.post(
    "/api/auth/password",
    route(async (req, res) => {
      const input = z
        .object({ accessToken: tokenSchema, password: passwordSchema })
        .parse(req.body);
      const identity = await verifiedIdentity(input.accessToken);
      await authRequest("user", {
        method: "PUT",
        token: input.accessToken,
        body: { password: input.password },
      });
      // Require a fresh password sign-in after resetting, instead of logging in with
      // a recovery link. Old local app sessions in this browser are cleared.
      await invalidateUserSessions(`supabase:${identity.id}`);
      clearSessionCookies(res, COOKIE_NAME);
      res.json({
        success: true,
        message: "პაროლი შეიცვალა. შედი ახალი პაროლით.",
      });
    })
  );
}
