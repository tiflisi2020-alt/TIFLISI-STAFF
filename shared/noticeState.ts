export const NOTICE_VISIBLE_MS = 3 * 24 * 60 * 60 * 1000;

export type NoticeMemory = {
  announcements: string[];
  requests: string[];
  resolvedAt: Record<string, number>;
};

export type NoticeAnnouncement = {
  id: string;
  kind: string;
  isPinned: boolean;
  publishedAt: string;
  createdBy: number | null;
};

export type NoticeRequest = {
  id: string;
  status: string;
  requester_id?: number;
};

const emptyMemory = (): NoticeMemory => ({
  announcements: [],
  requests: [],
  resolvedAt: {},
});

function storageKey(userId: number) {
  return `tiflisi-notices:${userId}`;
}

export function readNoticeMemory(userId: number | null): NoticeMemory {
  if (!userId || typeof window === "undefined") return emptyMemory();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return emptyMemory();
    const parsed = JSON.parse(raw) as Partial<NoticeMemory>;
    return {
      announcements: Array.isArray(parsed.announcements)
        ? parsed.announcements.filter(id => typeof id === "string")
        : [],
      requests: Array.isArray(parsed.requests)
        ? parsed.requests.filter(id => typeof id === "string")
        : [],
      resolvedAt:
        parsed.resolvedAt && typeof parsed.resolvedAt === "object"
          ? Object.fromEntries(
              Object.entries(parsed.resolvedAt).filter(
                (entry): entry is [string, number] =>
                  typeof entry[0] === "string" && typeof entry[1] === "number"
              )
            )
          : {},
    };
  } catch {
    return emptyMemory();
  }
}

export function writeNoticeMemory(userId: number, memory: NoticeMemory) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(memory));
  } catch {
    // Private browsing can block storage; the bell still works for this visit.
  }
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function visibleAnnouncements<T extends NoticeAnnouncement>(
  items: T[],
  userId: number,
  now: number
) {
  return items.filter(item => {
    if (item.isPinned || item.kind === "urgent") return true;
    return now - new Date(item.publishedAt).getTime() <= NOTICE_VISIBLE_MS;
  });
}

export function rememberResolved(
  memory: NoticeMemory,
  requests: NoticeRequest[],
  now: number
): NoticeMemory | null {
  const resolvedAt = { ...memory.resolvedAt };
  let changed = false;
  const active = new Set<string>();
  for (const item of requests) {
    if (item.status !== "approved" && item.status !== "rejected") continue;
    active.add(item.id);
    if (!resolvedAt[item.id]) {
      resolvedAt[item.id] = now;
      changed = true;
    }
  }
  for (const [id, at] of Object.entries(resolvedAt)) {
    if (!active.has(id) && now - at > NOTICE_VISIBLE_MS) {
      delete resolvedAt[id];
      changed = true;
    }
  }
  if (!changed) return null;
  return { ...memory, resolvedAt };
}

export function visibleAnswers<T extends NoticeRequest>(
  requests: T[],
  memory: NoticeMemory,
  now: number
) {
  return requests.filter(item => {
    if (item.status !== "approved" && item.status !== "rejected") return false;
    const seenAt = memory.resolvedAt[item.id];
    if (!seenAt) return true;
    return now - seenAt <= NOTICE_VISIBLE_MS;
  });
}

export function markNoticesSeen(
  memory: NoticeMemory,
  announcementIds: string[],
  requestIds: string[]
): NoticeMemory | null {
  const announcements = [...memory.announcements];
  const requests = [...memory.requests];
  let changed = false;
  for (const id of announcementIds) {
    if (!announcements.includes(id)) {
      announcements.push(id);
      changed = true;
    }
  }
  for (const id of requestIds) {
    if (!requests.includes(id)) {
      requests.push(id);
      changed = true;
    }
  }
  const nextAnnouncements = announcements.slice(-80);
  const nextRequests = requests.slice(-80);
  if (
    !changed &&
    sameIds(nextAnnouncements, memory.announcements) &&
    sameIds(nextRequests, memory.requests)
  )
    return null;
  return { ...memory, announcements: nextAnnouncements, requests: nextRequests };
}
