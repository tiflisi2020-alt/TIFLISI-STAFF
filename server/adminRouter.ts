import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { departmentIds } from "../shared/schedule";
import { departments, supabase, type Department } from "./supabase";
import { notifyAnnouncement, notifySwapAnswered } from "./push";
import { exchangeShifts, getStaff, type SwapRow } from "./staffRouter";

const department = z.enum(departmentIds);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    v =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v
  );
const snapshot = z.object({
  time: z.string().max(80),
  position: z.string().max(200),
  notes: z.string().max(2000),
});
const fields =
  "id,requester_id,department,requester_name,own_date,own_time,target_name,target_date,target_time,reason,status,created_at";
const personName = z.string().trim().min(1).max(120);
const phoneField = z.string().trim().max(40);
const announcementFields =
  "id,title,body,kind,is_pinned,published_at,expires_at,created_at";
type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "urgent" | "schedule" | "event";
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
};
const announcementInput = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  kind: z.enum(["info", "urgent", "schedule", "event"]),
  isPinned: z.boolean(),
  expiresAt: z.string().nullable(),
});
function rawStaffId(staffId: string, department: Department) {
  const prefix = `${department}:`;
  if (!staffId.startsWith(prefix)) return null;
  const raw = staffId.slice(prefix.length);
  return raw.length > 0 && raw.length <= 80 ? raw : null;
}
async function uniqueName(department: Department, name: string, exceptId?: string) {
  const roster = await getStaff();
  if (
    roster.some(
      person =>
        person.department === department &&
        person.name === name &&
        person.id !== exceptId
    )
  )
    throw new TRPCError({
      code: "CONFLICT",
      message: "ამ დეპარტამენტში ეს სახელი უკვე არსებობს.",
    });
  return roster;
}

export const adminRouter = router({
  announcements: adminProcedure.query(() =>
    supabase<AdminAnnouncement[]>(
      "tiflisi_announcements",
      `select=${announcementFields}&order=is_pinned.desc,published_at.desc&limit=50`
    )
  ),
  createAnnouncement: adminProcedure
    .input(announcementInput)
    .mutation(async ({ ctx, input }) => {
      const actorId = ctx.user?.id;
      if (!actorId)
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ავტორიზაცია საჭიროა." });
      const rows = await supabase<unknown[]>("tiflisi_announcements", "", {
        method: "POST",
        body: {
          title: input.title,
          body: input.body,
          kind: input.kind,
          is_pinned: input.isPinned,
          expires_at: input.expiresAt,
          created_by: actorId,
        },
      });
      if (!rows[0])
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "განცხადების გამოქვეყნება ვერ შესრულდა.",
        });
      await notifyAnnouncement({
        title: input.title,
        body: input.body,
        createdBy: actorId,
        urgent: input.kind === "urgent",
      });
      return { success: true };
    }),
  updateAnnouncement: adminProcedure
    .input(announcementInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const existing = await supabase<AdminAnnouncement[]>(
        "tiflisi_announcements",
        `select=${announcementFields}&id=eq.${input.id}&limit=1`
      );
      if (!existing[0])
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "განცხადება ვერ მოიძებნა.",
        });
      const rows = await supabase<unknown[]>(
        "tiflisi_announcements",
        `id=eq.${input.id}`,
        {
          method: "PATCH",
          body: {
            title: input.title,
            body: input.body,
            kind: input.kind,
            is_pinned: input.isPinned,
            expires_at: input.expiresAt,
          },
        }
      );
      if (rows.length !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "განცხადება ვერ განახლდა. ხელახლა სცადე.",
        });
      return { success: true };
    }),
  archiveAnnouncement: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      const existing = await supabase<AdminAnnouncement[]>(
        "tiflisi_announcements",
        `select=${announcementFields}&id=eq.${input.id}&limit=1`
      );
      if (!existing[0])
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "განცხადება ვერ მოიძებნა.",
        });
      const rows = await supabase<unknown[]>(
        "tiflisi_announcements",
        `id=eq.${input.id}`,
        {
          method: "PATCH",
          body: { expires_at: now, is_pinned: false },
        }
      );
      if (rows.length !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "განცხადება ვერ დაიმალა. ხელახლა სცადე.",
        });
      return { success: true, hidden: true as const };
    }),
  deleteAnnouncement: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const rows = await supabase<unknown[]>(
        "tiflisi_announcements",
        `id=eq.${input.id}`,
        { method: "DELETE" }
      );
      if (rows.length !== 1)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "განცხადება ვერ მოიძებნა.",
        });
      return { success: true };
    }),
  requests: adminProcedure
    .input(
      z.object({
        status: z
          .enum(["all", "pending", "approved", "rejected"])
          .default("pending"),
        page: z.number().int().min(0).max(1000).default(0),
      })
    )
    .query(({ input }) =>
      supabase<SwapRow[]>(
        "tiflisi_swap_requests",
        `select=${fields}${input.status === "all" ? "" : `&status=eq.${input.status}`}&order=created_at.desc,id.desc&limit=21&offset=${input.page * 20}`
      )
    ),
  reviewRequest: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      if (input.status === "rejected") {
        const rows = await supabase<SwapRow[]>(
          "tiflisi_swap_requests",
          `id=eq.${input.id}&status=eq.pending`,
          { method: "PATCH", body: { status: "rejected" } }
        );
        if (rows.length !== 1)
          throw new TRPCError({
            code: "CONFLICT",
            message: "მოთხოვნა უკვე განხილულია ან ვერ მოიძებნა. განაახლეთ სია.",
          });
        await notifySwapAnswered({
          requesterId: rows[0].requester_id,
          status: "rejected",
          targetName: rows[0].target_name,
          ownDate: rows[0].own_date,
          ownTime: rows[0].own_time,
        });
        return { success: true };
      }
      const pending = await supabase<SwapRow[]>(
        "tiflisi_swap_requests",
        `select=${fields}&id=eq.${input.id}&status=eq.pending&limit=1`
      );
      const request = pending[0];
      if (!request)
        throw new TRPCError({
          code: "CONFLICT",
          message: "მოთხოვნა უკვე განხილულია ან ვერ მოიძებნა. განაახლეთ სია.",
        });
      const undo = await exchangeShifts(request);
      const rows = await supabase<SwapRow[]>(
        "tiflisi_swap_requests",
        `id=eq.${input.id}&status=eq.pending`,
        { method: "PATCH", body: { status: "approved" } }
      );
      if (rows.length !== 1) {
        try {
          await undo();
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "მოთხოვნა პარალელურად განიხილეს და განრიგის დაბრუნება ვერ შესრულდა. გადაამოწმე ორივე ცვლა.",
          });
        }
        throw new TRPCError({
          code: "CONFLICT",
          message: "მოთხოვნა პარალელურად განიხილეს. განრიგი უკან დაბრუნდა.",
        });
      }
      await notifySwapAnswered({
        requesterId: request.requester_id,
        status: "approved",
        targetName: request.target_name,
        ownDate: request.own_date,
        ownTime: request.own_time,
      });
      return { success: true };
    }),
  updateShift: adminProcedure
    .input(
      z.object({
        department,
        staffId: z.string().min(1).max(120),
        date,
        time: z
          .string()
          .regex(
            /^(OFF|([01]?\d|2[0-3]):[0-5]\d)$/,
            "მიუთითეთ დაწყების საათი ან OFF."
          ),
        position: z.string().trim().max(100),
        notes: z.string().trim().max(1000),
        expected: snapshot.nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const roster = await getStaff();
      const staff = roster.find(
        s => s.id === input.staffId && s.department === input.department
      );
      if (
        !staff ||
        roster.filter(
          s => s.department === staff.department && s.name === staff.name
        ).length !== 1
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "თანამშრომელი ვერ მოიძებნა ან სახელზე ერთზე მეტი ჩანაწერია.",
        });
      const config = departments[input.department];
      const filter = `${config.nameColumn}=eq.${encodeURIComponent(staff.name)}&shift_date=eq.${input.date}`;
      const rows = await supabase<Record<string, string | null>[]>(
        config.shifts,
        `select=${input.department === "waiters" ? "id," : ""}shift_time,position,notes&${filter}&limit=2`
      );
      if (rows.length > 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "ამ თარიღზე დუბლირებული ჩანაწერებია. ცვლილება არ შესრულდა.",
        });
      const existing = rows[0];
      const actual = existing
        ? {
            time: existing.shift_time ?? "OFF",
            position: existing.position ?? "",
            notes: existing.notes ?? "",
          }
        : null;
      if (JSON.stringify(actual) !== JSON.stringify(input.expected))
        throw new TRPCError({
          code: "CONFLICT",
          message: "განრიგი შეიცვალა. განაახლეთ ცვლა შენახვამდე.",
        });
      const body = {
        shift_time: input.time,
        position: input.position,
        notes: input.notes,
      };
      if (existing) {
        const timeFilter =
          existing.shift_time === null
            ? "shift_time=is.null"
            : `shift_time=eq.${encodeURIComponent(existing.shift_time)}`;
        const positionFilter =
          existing.position === null
            ? "position=is.null"
            : `position=eq.${encodeURIComponent(existing.position)}`;
        const notesFilter =
          existing.notes === null
            ? "notes=is.null"
            : `notes=eq.${encodeURIComponent(existing.notes)}`;
        const updated = await supabase<unknown[]>(
          config.shifts,
          `${filter}&${timeFilter}&${positionFilter}&${notesFilter}`,
          { method: "PATCH", body }
        );
        if (updated.length !== 1)
          throw new TRPCError({
            code: "CONFLICT",
            message: "ცვლა პარალელურად შეიცვალა. განაახლეთ მონაცემები.",
          });
      } else {
        await supabase(config.shifts, "", {
          method: "POST",
          body: {
            ...body,
            [config.nameColumn]: staff.name,
            shift_date: input.date,
          },
        });
      }
      return { success: true };
    }),
  directory: adminProcedure.input(z.object({ department })).query(async ({ input }) => {
    const config = departments[input.department];
    const [rows, inactive] = await Promise.all([
      supabase<
        {
          id: string | number;
          name: string;
          phone: string | null;
          position_order: number | null;
        }[]
      >(
        input.department,
        "select=id,name,phone,position_order&order=position_order.asc,name.asc&limit=500"
      ),
      supabase<{ staff_id: string }[]>(
        "tiflisi_staff_status",
        "select=staff_id&active=eq.false&limit=500"
      ),
    ]);
    const hidden = new Set(inactive.map(row => row.staff_id));
    return rows.map(row => ({
      id: `${input.department}:${row.id}`,
      name: row.name,
      phone: row.phone ?? "",
      positionOrder: row.position_order ?? 0,
      role: config.role,
      active: !hidden.has(`${input.department}:${row.id}`),
    }));
  }),
  setEmployeeActive: adminProcedure
    .input(
      z.object({
        department,
        staffId: z.string().min(3).max(80),
        active: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const raw = rawStaffId(input.staffId, input.department);
      if (!raw)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "თანამშრომელი ვერ მოიძებნა.",
        });
      const existing = await supabase<{ id: string | number }[]>(
        input.department,
        `select=id&id=eq.${encodeURIComponent(raw)}&limit=1`
      );
      if (!existing[0])
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "თანამშრომელი ვერ მოიძებნა.",
        });
      const saved = await supabase<{ staff_id: string }[]>(
        "tiflisi_staff_status",
        "on_conflict=staff_id",
        {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=representation",
          body: {
            staff_id: input.staffId,
            active: input.active,
            updated_at: new Date().toISOString(),
          },
        }
      );
      if (!saved[0])
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "თანამშრომლის სტატუსი ვერ შეინახა.",
        });
      return { active: input.active };
    }),
  createEmployee: adminProcedure
    .input(z.object({ department, name: personName, phone: phoneField.default("") }))
    .mutation(async ({ input }) => {
      await uniqueName(input.department, input.name);
      const existing = await supabase<{ position_order: number | null }[]>(
        input.department,
        "select=position_order&order=position_order.desc&limit=1"
      );
      const rows = await supabase<{ id: string | number }[]>(input.department, "", {
        method: "POST",
        body: {
          name: input.name,
          phone: input.phone,
          position_order: (existing[0]?.position_order ?? 0) + 1,
        },
      });
      if (!rows[0])
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "თანამშრომელი ვერ დაემატა.",
        });
      return { id: `${input.department}:${rows[0].id}` };
    }),
  updateEmployee: adminProcedure
    .input(
      z.object({
        department,
        staffId: z.string().min(3).max(80),
        name: personName,
        phone: phoneField,
        positionOrder: z.number().int().min(0).max(9999),
      })
    )
    .mutation(async ({ input }) => {
      const raw = rawStaffId(input.staffId, input.department);
      const roster = await uniqueName(input.department, input.name, input.staffId);
      const current = roster.find(person => person.id === input.staffId);
      if (!raw || !current)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "თანამშრომელი ვერ მოიძებნა.",
        });
      const config = departments[input.department];
      const updated = await supabase<unknown[]>(
        input.department,
        `id=eq.${encodeURIComponent(raw)}`,
        {
          method: "PATCH",
          body: {
            name: input.name,
            phone: input.phone,
            position_order: input.positionOrder,
          },
        }
      );
      if (updated.length !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "თანამშრომლის ჩანაწერი ვერ განახლდა.",
        });
      if (current.name !== input.name) {
        const encoded = encodeURIComponent(current.name);
        await supabase(
          config.shifts,
          `${config.nameColumn}=eq.${encoded}`,
          { method: "PATCH", body: { [config.nameColumn]: input.name } }
        );
        await supabase(
          "tiflisi_accounts",
          `staff_id=eq.${encodeURIComponent(input.staffId)}`,
          {
            method: "PATCH",
            body: {
              staff_name: input.name,
              updated_at: new Date().toISOString(),
            },
          }
        );
        await supabase(
          "tiflisi_swap_requests",
          `department=eq.${input.department}&requester_name=eq.${encoded}`,
          { method: "PATCH", body: { requester_name: input.name } }
        );
        await supabase(
          "tiflisi_swap_requests",
          `department=eq.${input.department}&target_name=eq.${encoded}`,
          { method: "PATCH", body: { target_name: input.name } }
        );
      }
      return { success: true };
    }),
  deleteEmployee: adminProcedure
    .input(z.object({ department, staffId: z.string().min(3).max(80) }))
    .mutation(async ({ input }) => {
      const raw = rawStaffId(input.staffId, input.department);
      const roster = await getStaff();
      if (!raw || !roster.some(person => person.id === input.staffId))
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "თანამშრომელი ვერ მოიძებნა.",
        });
      await supabase(
        "tiflisi_accounts",
        `staff_id=eq.${encodeURIComponent(input.staffId)}`,
        {
          method: "PATCH",
          body: {
            department: null,
            staff_name: null,
            staff_id: null,
            role: "user",
            updated_at: new Date().toISOString(),
          },
        }
      );
      await supabase(
        "tiflisi_staff_status",
        `staff_id=eq.${encodeURIComponent(input.staffId)}`,
        { method: "DELETE" }
      );
      const removed = await supabase<unknown[]>(
        input.department,
        `id=eq.${encodeURIComponent(raw)}`,
        { method: "DELETE" }
      );
      if (removed.length !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "თანამშრომელი ვერ წაიშალა.",
        });
      return { success: true };
    }),
});
