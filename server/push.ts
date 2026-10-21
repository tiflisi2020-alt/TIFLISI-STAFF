import webpush from "web-push";

const { sendNotification, setVapidDetails, WebPushError } = webpush;
import { prettyTime } from "../shared/schedule";
import { departments, supabase, type Department } from "./supabase";

export type PushMessage = {
  title: string;
  body: string;
  url: string;
  urgent?: boolean;
};

type SubscriptionRow = {
  id: string;
  account_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[A-Za-z0-9_-]{8,200}$/;
const months = [
  "იან",
  "თებ",
  "მარ",
  "აპრ",
  "მაი",
  "ივნ",
  "ივლ",
  "აგვ",
  "სექ",
  "ოქტ",
  "ნოე",
  "დეკ",
];

export function isPushEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return (
    PUSH_HOSTS.has(url.hostname) || url.hostname.endsWith(".notify.windows.com")
  );
}

export function pushPublicConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const enabled = Boolean(
    publicKey &&
      process.env.VAPID_PRIVATE_KEY &&
      (process.env.VAPID_SUBJECT ?? "").match(/^(mailto:|https:)/)
  );
  return { publicKey: enabled ? publicKey : "", enabled };
}

function canSend() {
  const config = pushPublicConfig();
  if (!config.enabled) return false;
  setVapidDetails(
    process.env.VAPID_SUBJECT ?? "",
    config.publicKey,
    process.env.VAPID_PRIVATE_KEY ?? ""
  );
  return true;
}

function ids(values: number[]) {
  return [...new Set(values.filter(id => Number.isInteger(id) && id > 0))].slice(
    0,
    40
  );
}

export function pushAudiences(
  requesterId: number,
  targetIds: number[],
  managerIds: number[]
) {
  const covers = ids(targetIds.filter(id => id !== requesterId));
  const covered = new Set(covers);
  const reviews = ids(
    managerIds.filter(id => id !== requesterId && !covered.has(id))
  );
  return { covers, reviews };
}

export function shortShiftLabel(date: string, time: string) {
  const [, month, day] = date.split("-");
  const name = months[Number(month) - 1];
  const when = name && Number(day) ? `${Number(day)} ${name}` : date;
  return `${when} · ${prettyTime(time)}`;
}

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function accountIds(query: string) {
  const rows = await supabase<{ id: number }[]>(
    "tiflisi_accounts",
    `select=id&${query}&limit=30`
  );
  return rows.map(row => row.id);
}

async function sendToAccounts(accountIdsToNotify: number[], message: PushMessage) {
  const recipients = ids(accountIdsToNotify);
  if (!recipients.length || !canSend()) return;
  const rows = await supabase<SubscriptionRow[]>(
    "tiflisi_push_subscriptions",
    `select=id,account_id,endpoint,p256dh,auth&account_id=in.(${recipients.join(",")})&limit=80`
  );
  await deliver(rows, message);
}

async function deliver(rows: SubscriptionRow[], message: PushMessage) {
  const payload = JSON.stringify({
    title: clip(message.title, 80),
    body: clip(message.body, 180),
    url: message.url.startsWith("/") && !message.url.startsWith("//") ? message.url : "/",
  });
  await Promise.all(
    rows.map(async row => {
      if (!UUID.test(row.id) || !isPushEndpoint(row.endpoint)) return;
      try {
        await sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
          {
            TTL: 60 * 60 * 24,
            timeout: 8000,
            urgency: message.urgent ? "high" : "normal",
          }
        );
      } catch (error) {
        const status =
          error instanceof WebPushError
            ? error.statusCode
            : typeof error === "object" &&
                error !== null &&
                "statusCode" in error &&
                typeof error.statusCode === "number"
              ? error.statusCode
              : 0;
        if (status === 404 || status === 410) {
          await supabase(
            "tiflisi_push_subscriptions",
            `id=eq.${row.id}`,
            { method: "DELETE" }
          ).catch(() => undefined);
          return;
        }
        console.warn("[push] გაგზავნა ვერ შესრულდა", status || "network");
      }
    })
  );
}

export async function savePushSubscription(
  accountId: number,
  input: { endpoint: string; p256dh: string; auth: string }
) {
  if (!Number.isInteger(accountId) || accountId <= 0)
    throw new Error("ანგარიში ვერ მოიძებნა.");
  if (!isPushEndpoint(input.endpoint))
    throw new Error("შეტყობინების მისამართი არასწორია.");
  if (!KEY.test(input.p256dh) || !KEY.test(input.auth))
    throw new Error("შეტყობინების გასაღები არასწორია.");
  try {
    const rows = await supabase<{ id: string }[]>(
      "tiflisi_push_subscriptions",
      "on_conflict=endpoint",
      {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: {
          account_id: accountId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          updated_at: new Date().toISOString(),
        },
      }
    );
    if (!rows[0]) throw new Error("შეტყობინების შენახვა ვერ შესრულდა.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("შეტყობინების"))
      throw error;
    throw new Error("შეტყობინების შენახვა ვერ შესრულდა.");
  }
}

export async function removePushSubscription(accountId: number, endpoint: string) {
  if (!Number.isInteger(accountId) || accountId <= 0 || !isPushEndpoint(endpoint))
    return;
  await supabase(
    "tiflisi_push_subscriptions",
    `account_id=eq.${accountId}&endpoint=eq.${encodeURIComponent(endpoint)}`,
    { method: "DELETE" }
  );
}

async function safely(task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.warn(
      "[push]",
      error instanceof Error ? error.message : "შეტყობინება ვერ გაიგზავნა"
    );
  }
}

export async function notifySwapRequested(input: {
  requesterId: number;
  department: Department;
  requesterName: string;
  targetName: string;
  ownDate: string;
  ownTime: string;
}) {
  await safely(async () => {
    if (!(input.department in departments)) return;
    const [targets, managers] = await Promise.all([
      accountIds(
        `department=eq.${encodeURIComponent(input.department)}&staff_name=eq.${encodeURIComponent(input.targetName)}`
      ),
      accountIds("role=eq.admin"),
    ]);
    const { covers, reviews } = pushAudiences(
      input.requesterId,
      targets,
      managers
    );
    const when = shortShiftLabel(input.ownDate, input.ownTime);
    await sendToAccounts(covers, {
      title: "ჩანაცვლების მოთხოვნა",
      body: `${input.requesterName} გთხოვს გამოსვლას · ${when}`,
      url: "/profile",
    });
    await sendToAccounts(reviews, {
      title: "ახალი მოთხოვნა",
      body: `${input.requesterName} → ${input.targetName} · ${when}`,
      url: "/admin",
    });
  });
}

export async function notifySwapAnswered(input: {
  requesterId?: number;
  status: "approved" | "rejected";
  targetName?: string;
  ownDate?: string;
  ownTime?: string;
}) {
  await safely(async () => {
    if (!input.requesterId || !input.ownDate || !input.ownTime) return;
    const when = shortShiftLabel(input.ownDate, input.ownTime);
    await sendToAccounts([input.requesterId], {
      title:
        input.status === "approved"
          ? "ჩანაცვლება დადასტურდა"
          : "ჩანაცვლება უარყოფილია",
      body:
        input.status === "approved"
          ? `${input.targetName ?? "კოლეგა"} გამოვა შენს ნაცვლად · ${when}`
          : when,
      url: "/profile",
    });
  });
}

export async function notifySwapCancelled(input: {
  requesterId?: number;
  department?: Department;
  requesterName?: string;
  targetName?: string;
  ownDate?: string;
  ownTime?: string;
}) {
  await safely(async () => {
    if (
      !input.requesterId ||
      !input.department ||
      !input.requesterName ||
      !input.targetName ||
      !input.ownDate ||
      !input.ownTime ||
      !(input.department in departments)
    )
      return;
    const [targets, managers] = await Promise.all([
      accountIds(
        `department=eq.${encodeURIComponent(input.department)}&staff_name=eq.${encodeURIComponent(input.targetName)}`
      ),
      accountIds("role=eq.admin"),
    ]);
    const { covers, reviews } = pushAudiences(
      input.requesterId,
      targets,
      managers
    );
    await sendToAccounts([...covers, ...reviews], {
      title: "მოთხოვნა გაუქმდა",
      body: `${input.requesterName} აღარ ითხოვს ჩანაცვლებას · ${shortShiftLabel(input.ownDate, input.ownTime)}`,
      url: "/profile",
    });
  });
}

export async function notifyAnnouncement(input: {
  title: string;
  body: string;
  createdBy: number;
  urgent?: boolean;
}) {
  await safely(async () => {
    if (!Number.isInteger(input.createdBy) || input.createdBy <= 0 || !canSend())
      return;
    const rows = await supabase<SubscriptionRow[]>(
      "tiflisi_push_subscriptions",
      "select=id,account_id,endpoint,p256dh,auth&limit=200"
    );
    await deliver(rows, {
      title: input.title,
      body: input.body,
      url: "/",
      urgent: input.urgent,
    });
  });
}
