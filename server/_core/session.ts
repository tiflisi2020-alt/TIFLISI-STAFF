import type { Request, Response } from "express";
import {
  COOKIE_NAME,
  SESSION_MS,
  SESSION_RENEW_WHEN_REMAINING_MS,
} from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk, type AuthenticatedUser } from "./sdk";

function readSessionCookie(req: Request) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Extend the app session while the user is actively using the staff app. */
export async function renewSessionCookieIfNeeded(
  req: Request,
  res: Response,
  user: AuthenticatedUser
) {
  if (user.isCron || user.id < 0) return;
  const token = readSessionCookie(req);
  if (!token) return;
  try {
    const session = await sdk.verifySession(token);
    if (!session?.exp) return;
    const remainingMs = session.exp * 1000 - Date.now();
    if (remainingMs > SESSION_RENEW_WHEN_REMAINING_MS) return;
    const authVersion =
      "sessionVersion" in user && typeof user.sessionVersion === "number"
        ? user.sessionVersion
        : session.authVersion;
    const next = await sdk.createSessionToken(user.openId, {
      name: user.name ?? "",
      expiresInMs: SESSION_MS,
      authVersion,
    });
    res.cookie(COOKIE_NAME, next, {
      ...getSessionCookieOptions(req),
      maxAge: SESSION_MS,
    });
  } catch {
    // Leave the existing cookie; the next protected call can re-auth.
  }
}
