import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification, WebPushError } from "web-push";
import {
  isPushEndpoint,
  notifyAnnouncement,
  notifySwapRequested,
  pushAudiences,
  savePushSubscription,
  shortShiftLabel,
} from "./push";
import { supabase } from "./supabase";

vi.mock("web-push", () => {
  class WebPushError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  const api = {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
    WebPushError,
  };
  return { default: api, ...api };
});
vi.mock("./supabase", async () => {
  const actual = await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, supabase: vi.fn() };
});

const mock = vi.mocked(supabase);
const send = vi.mocked(sendNotification);
const endpoint = "https://fcm.googleapis.com/fcm/send/device";
const gone = "d0b3f5c1-7aca-4dcf-9484-47e908c68cdd";

beforeEach(() => {
  mock.mockReset();
  send.mockReset();
  vi.stubEnv("VAPID_SUBJECT", "mailto:staff@example.com");
  vi.stubEnv("VAPID_PUBLIC_KEY", "public-key");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
});

describe("phone push", () => {
  it("accepts only known push services", () => {
    expect(isPushEndpoint(endpoint)).toBe(true);
    expect(isPushEndpoint("https://wns2-am.notifiy.windows.com/nope")).toBe(false);
    expect(isPushEndpoint("https://wns2-am3p.notify.windows.com/w/?token=1")).toBe(
      true
    );
    expect(isPushEndpoint("http://127.0.0.1/push")).toBe(false);
    expect(isPushEndpoint("https://example.com/push")).toBe(false);
  });

  it("formats a shift for the lock screen", () => {
    expect(shortShiftLabel("2026-10-22", "9:00")).toBe("22 ოქტ · 09:00");
  });

  it("notifies the asked colleague and the manager separately", () => {
    expect(pushAudiences(3, [8, 3], [2, 8, 3])).toEqual({
      covers: [8],
      reviews: [2],
    });
  });

  it("sends a cover request and a manager review", async () => {
    mock.mockImplementation(async (table, query) => {
      const text = String(query ?? "");
      if (table === "tiflisi_accounts" && text.includes("staff_name"))
        return [{ id: 8 }];
      if (table === "tiflisi_accounts") return [{ id: 2 }, { id: 8 }];
      if (table === "tiflisi_push_subscriptions" && text.includes("in.(8)"))
        return [
          {
            id: "11111111-1111-4111-8111-111111111111",
            account_id: 8,
            endpoint,
            p256dh: "colleague-key",
            auth: "colleague-auth",
          },
        ];
      if (table === "tiflisi_push_subscriptions" && text.includes("in.(2)"))
        return [
          {
            id: "22222222-2222-4222-8222-222222222222",
            account_id: 2,
            endpoint: "https://web.push.apple.com/device",
            p256dh: "manager-key",
            auth: "manager-auth",
          },
        ];
      return [];
    });
    await notifySwapRequested({
      requesterId: 3,
      department: "waiters",
      requesterName: "ანა",
      targetName: "ნინო",
      ownDate: "2026-10-22",
      ownTime: "9:00",
    });
    const bodies = send.mock.calls.map(call => String(call[1]));
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain("ანა გთხოვს გამოსვლას");
    expect(bodies[0]).toContain("/profile");
    expect(bodies[1]).toContain("ანა → ნინო");
    expect(bodies[1]).toContain("/admin");
  });

  it("removes a subscription the phone no longer accepts", async () => {
    mock.mockImplementation(async (table, query, options) => {
      if (table === "tiflisi_push_subscriptions" && !options?.method)
        return [
          {
            id: gone,
            account_id: 4,
            endpoint,
            p256dh: "device-key",
            auth: "device-auth",
          },
        ];
      return [];
    });
    send.mockRejectedValueOnce(
      new WebPushError("gone", 410, {}, "", endpoint)
    );
    await notifyAnnouncement({
      title: "საღამოს ცვლა",
      body: "ხვალ გუნდი ერთი საათით ადრე გამოდის.",
      createdBy: 1,
    });
    expect(mock).toHaveBeenCalledWith(
      "tiflisi_push_subscriptions",
      `id=eq.${gone}`,
      { method: "DELETE" }
    );
  });

  it("does not store an endpoint outside a push service", async () => {
    await expect(
      savePushSubscription(4, {
        endpoint: "https://example.com/hook",
        p256dh: "device-key",
        auth: "device-auth",
      })
    ).rejects.toThrow("მისამართი");
    expect(mock).not.toHaveBeenCalled();
  });
});
