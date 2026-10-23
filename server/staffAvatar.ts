import type { Express } from "express";
import { signedStaffAvatarUrl, supabase } from "./supabase";

export function registerStaffAvatarRoute(app: Express) {
  app.get("/api/staff-avatar/:staffId", async (req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    const staffId = String(req.params.staffId ?? "").trim();
    if (!staffId || staffId.length > 120 || staffId.includes("/")) {
      res.status(400).send("Invalid staff id");
      return;
    }
    try {
      const accounts = await supabase<{ id: number }[]>(
        "tiflisi_accounts",
        `select=id&staff_id=eq.${encodeURIComponent(staffId)}&limit=1`
      );
      const accountId = accounts[0]?.id;
      if (!accountId) {
        res.status(404).send("Avatar not found");
        return;
      }
      const profiles = await supabase<{ avatar_path: string | null }[]>(
        "tiflisi_profile_details",
        `select=avatar_path&account_id=eq.${accountId}&avatar_path=not.is.null&limit=1`
      );
      const path = profiles[0]?.avatar_path;
      if (!path) {
        res.status(404).send("Avatar not found");
        return;
      }
      const url = await signedStaffAvatarUrl(path, 60 * 60);
      if (!url) {
        res.status(404).send("Avatar not found");
        return;
      }
      res.redirect(302, url);
    } catch (error) {
      console.error("[staff-avatar] failed:", error);
      res.status(502).send("Avatar unavailable");
    }
  });
}
