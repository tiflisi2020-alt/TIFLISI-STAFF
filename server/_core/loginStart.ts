import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { OAUTH_STATE_COOKIE } from "../../shared/const";

const defaultOrigins = [
  "https://tiflisi-staff.vercel.app",
  "https://8328-iuhvk1pbi9bqbz79r589t-91545ddf.us1.manus.computer",
  "https://3000-iuhvk1pbi9bqbz79r589t-91545ddf.us1.manus.computer",
];

export function beginOAuth(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");
  const origin = typeof req.query.origin === "string" ? req.query.origin : "";
  const origins =
    process.env.OAUTH_ALLOWED_ORIGINS?.split(",")
      .map(v => v.trim())
      .filter(Boolean) ?? defaultOrigins;
  // Never trust Host / forwarded headers or accept arbitrary callback origins.
  if (!origins.includes(origin)) {
    res
      .status(400)
      .type("html")
      .send(
        '<!doctype html><html lang="ka"><meta charset="utf-8"><title>შესვლა ვერ დაიწყო</title><h1>საიტის მისამართი არ არის დაშვებული.</h1><p>გახსენი ტიფლისის მთავარი საიტი და ხელახლა სცადე.</p><a href="/profile">პროფილზე დაბრუნება</a></html>'
      );
    return;
  }
  const appId = process.env.MANUS_PROJECT_ID;
  const portal = process.env.MANUS_OAUTH_PORTAL_URL;
  if (!appId || !portal) {
    res
      .status(503)
      .type("html")
      .send(
        '<!doctype html><html lang="ka"><meta charset="utf-8"><title>შესვლა დროებით მიუწვდომელია</title><h1>შესვლა დროებით მიუწვდომელია.</h1><p>ავტორიზაციის პარამეტრები სერვერზე ვერ ჩაიტვირთა. დაუკავშირდი მენეჯერს.</p><a href="/profile">პროფილზე დაბრუნება</a></html>'
      );
    return;
  }
  const nonce = randomBytes(32).toString("hex");
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = Buffer.from(JSON.stringify({ redirectUri, nonce })).toString(
    "base64"
  );
  const url = new URL("/app-auth", portal);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("responseType", "code");
  res.cookie(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 600000,
  });
  res.redirect(302, url.toString());
}
