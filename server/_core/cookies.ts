import type { CookieOptions, Request } from "express";

function needsCrossSiteCookie(req: Request) {
  const site = req.headers["sec-fetch-site"];
  const dest = req.headers["sec-fetch-dest"];
  return site === "cross-site" || dest === "iframe";
}

export function getSessionCookieOptions(req: Request): CookieOptions {
  // First-party staff app uses Lax (more reliable on mobile Safari / PWA).
  // Cross-site Preview iframes still need None + Secure.
  return {
    httpOnly: true,
    path: "/",
    sameSite: needsCrossSiteCookie(req) ? "none" : "lax",
    secure: true,
  };
}

/** Clear both Lax and None variants so older cookies cannot linger after logout. */
export function clearSessionCookies(res: {
  clearCookie: (name: string, options: CookieOptions) => void;
}, cookieName: string) {
  const base = { httpOnly: true, path: "/", secure: true } as const;
  res.clearCookie(cookieName, { ...base, sameSite: "lax" });
  res.clearCookie(cookieName, { ...base, sameSite: "none" });
}
