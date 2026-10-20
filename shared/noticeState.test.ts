import { describe, expect, it } from "vitest";
import {
  NOTICE_VISIBLE_MS,
  markNoticesSeen,
  rememberResolved,
  visibleAnnouncements,
  visibleAnswers,
  type NoticeMemory,
} from "./noticeState";

const memory = (): NoticeMemory => ({
  announcements: [],
  requests: [],
  resolvedAt: {},
});
const now = Date.parse("2026-10-20T12:00:00Z");

describe("notice bell rules", () => {
  it("keeps pinned and urgent announcements and hides the author's own post", () => {
    const items = visibleAnnouncements(
      [
        {
          id: "own",
          kind: "info",
          isPinned: true,
          publishedAt: "2026-10-20T08:00:00Z",
          createdBy: 4,
        },
        {
          id: "old-note",
          kind: "info",
          isPinned: false,
          publishedAt: "2026-10-01T08:00:00Z",
          createdBy: 1,
        },
        {
          id: "pinned",
          kind: "info",
          isPinned: true,
          publishedAt: "2026-09-01T08:00:00Z",
          createdBy: 1,
        },
        {
          id: "urgent",
          kind: "urgent",
          isPinned: false,
          publishedAt: "2026-09-01T08:00:00Z",
          createdBy: 1,
        },
        {
          id: "fresh",
          kind: "schedule",
          isPinned: false,
          publishedAt: "2026-10-19T08:00:00Z",
          createdBy: 1,
        },
      ],
      4,
      now
    );
    expect(items.map(item => item.id)).toEqual(["pinned", "urgent", "fresh"]);
  });

  it("shows an answer for three days after it is first noticed", () => {
    const requests = [{ id: "swap", status: "approved" }];
    const remembered = rememberResolved(memory(), requests, now);
    expect(remembered?.resolvedAt.swap).toBe(now);
    expect(visibleAnswers(requests, remembered!, now + NOTICE_VISIBLE_MS)).toEqual(
      requests
    );
    expect(visibleAnswers(requests, remembered!, now + NOTICE_VISIBLE_MS + 1)).toEqual(
      []
    );
    expect(visibleAnswers([{ id: "open", status: "pending" }], memory(), now)).toEqual(
      []
    );
  });

  it("marks news as seen and leaves the memory unchanged the second time", () => {
    const seen = markNoticesSeen(memory(), ["post"], ["swap"]);
    expect(seen).toMatchObject({ announcements: ["post"], requests: ["swap"] });
    expect(markNoticesSeen(seen!, ["post"], ["swap"])).toBeNull();
  });
});
