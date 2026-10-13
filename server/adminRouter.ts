import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { departments, supabase } from "./supabase";
import { getStaff, type SwapRow } from "./staffRouter";

const department = z.enum([
  "waiters",
  "chefs",
  "cleaners",
  "cashiers",
  "hostesses",
]);
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

export const adminRouter = router({
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
      const rows = await supabase<SwapRow[]>(
        "tiflisi_swap_requests",
        `id=eq.${input.id}&status=eq.pending`,
        { method: "PATCH", body: { status: input.status } }
      );
      if (rows.length !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "მოთხოვნა უკვე განხილულია ან ვერ მოიძებნა. განაახლეთ სია.",
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
});
