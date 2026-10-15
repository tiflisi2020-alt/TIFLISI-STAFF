import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import {
  departments,
  supabase,
  type AccountRow,
  type Department,
} from "./supabase";
import {
  isWorking,
  restaurantToday,
  type Shift,
  type Staff,
} from "../shared/schedule";

const departmentEnum = z.enum([
  "waiters",
  "chefs",
  "cleaners",
  "cashiers",
  "hostesses",
]);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    v =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "თარიღი არასწორია"
  );
const selection = z.object({
  name: z.string().min(1).max(120),
  date: isoDate,
  time: z.string().min(1).max(80),
});
export type SwapRow = {
  id: string;
  requester_id: number;
  department: Department;
  requester_name: string;
  own_date: string;
  own_time: string;
  target_name: string;
  target_date: string;
  target_time: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
};

export async function getStaff(): Promise<Staff[]> {
  const [batches, inactive] = await Promise.all([
    Promise.all(
      Object.entries(departments).map(async ([department, config]) => {
        const rows = await supabase<{ id: string | number; name: string }[]>(
          department,
          "select=id,name&order=position_order.asc,name.asc&limit=500"
        );
        return rows.map(row => ({
          id: `${department}:${row.id}`,
          name: row.name,
          department,
          role: config.role,
        }));
      })
    ),
    supabase<{ staff_id: string }[]>(
      "tiflisi_staff_status",
      "select=staff_id&active=eq.false&limit=500"
    ),
  ]);
  const hidden = new Set(inactive.map(row => row.staff_id));
  return batches.flat().filter(person => !hidden.has(person.id));
}

export async function getShifts(from: string, to: string): Promise<Shift[]> {
  const batches = await Promise.all(
    Object.entries(departments).map(async ([department, config]) => {
      const all: Shift[] = [];
      for (let offset = 0; ; offset += 500) {
        const rows = await supabase<Record<string, string | null>[]>(
          config.shifts,
          `select=${config.nameColumn},shift_date,shift_time,position,notes&shift_date=gte.${from}&shift_date=lte.${to}&order=shift_date.asc,${config.nameColumn}.asc&limit=500&offset=${offset}`
        );
        all.push(
          ...rows.map(row => ({
            id: `${department}:${row[config.nameColumn]}:${row.shift_date}`,
            department,
            name: row[config.nameColumn] ?? "",
            date: row.shift_date ?? "",
            time: row.shift_time ?? "OFF",
            position: row.position ?? "",
            notes: row.notes ?? "",
          }))
        );
        if (rows.length < 500) break;
      }
      return all;
    })
  );
  return batches.flat();
}

const todayTbilisi = restaurantToday;

export const staffRouter = router({
  roster: publicProcedure.query(getStaff),
  shifts: publicProcedure
    .input(
      z
        .object({ from: isoDate, to: isoDate })
        .refine(
          v =>
            v.to >= v.from &&
            (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 35,
          "აირჩიეთ მაქსიმუმ 35-დღიანი პერიოდი"
        )
    )
    .query(({ input }) => getShifts(input.from, input.to)),
  account: protectedProcedure.query(async ({ ctx }) => {
    const rows = await supabase<AccountRow[]>(
      "tiflisi_accounts",
      `select=id,name,email,department,staff_name,staff_id,role&id=eq.${ctx.user.id}&limit=1`
    );
    return rows[0]
      ? {
          id: rows[0].id,
          name: rows[0].name,
          email: rows[0].email,
          department: rows[0].department,
          staffName: rows[0].staff_name,
          staffId: rows[0].staff_id,
          role: rows[0].role,
        }
      : null;
  }),
  accounts: adminProcedure.query(async () => {
    return supabase<
      Pick<
        AccountRow,
        "id" | "name" | "email" | "department" | "staff_name" | "role"
      >[]
    >(
      "tiflisi_accounts",
      "select=id,name,email,department,staff_name,role&order=created_at.desc&limit=100"
    );
  }),
  linkAccount: adminProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        department: departmentEnum,
        staffId: z.string().min(1).max(120),
      })
    )
    .mutation(async ({ input }) => {
      const roster = await getStaff();
      const selected = roster.find(
        staff =>
          staff.id === input.staffId && staff.department === input.department
      );
      if (!selected)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "თანამშრომელი ვერ მოიძებნა.",
        });
      if (
        roster.filter(
          s => s.department === selected.department && s.name === selected.name
        ).length !== 1
      )
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "დეპარტამენტში ერთნაირი სახელებია. ჯერ გაასწორეთ თანამშრომლების ჩანაწერები.",
        });
      const rows = await supabase<AccountRow[]>(
        "tiflisi_accounts",
        `id=eq.${input.accountId}`,
        {
          method: "PATCH",
          body: {
            department: input.department,
            staff_name: selected.name,
            staff_id: selected.id,
            updated_at: new Date().toISOString(),
          },
        }
      );
      if (!rows.length)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "ანგარიში ვერ მოიძებნა.",
        });
      return { success: true };
    }),
  requests: protectedProcedure.query(({ ctx }) =>
    supabase<SwapRow[]>(
      "tiflisi_swap_requests",
      `select=id,requester_id,department,requester_name,own_date,own_time,target_name,target_date,target_time,reason,status,created_at&requester_id=eq.${ctx.user.id}&order=created_at.desc&limit=50`
    )
  ),
  createSwap: protectedProcedure
    .input(
      z.object({
        department: departmentEnum,
        own: selection,
        target: selection,
        reason: z
          .string()
          .trim()
          .min(10, "მიზეზი მინიმუმ 10 სიმბოლოს უნდა შეიცავდეს.")
          .max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const accounts = await supabase<AccountRow[]>(
        "tiflisi_accounts",
        `select=id,department,staff_name,staff_id&id=eq.${ctx.user.id}&limit=1`
      );
      const account = accounts[0];
      if (
        !account?.department ||
        account.department !== input.department ||
        account.staff_name !== input.own.name
      )
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "შეგიძლიათ მხოლოდ თქვენს ანგარიშთან დაკავშირებული თანამშრომლის ცვლა გაცვალოთ.",
        });
      const roster = await getStaff();
      const owner = roster.find(
        s => s.id === account.staff_id && s.department === account.department
      );
      if (!owner || owner.name !== input.own.name)
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "თანამშრომლის ჩანაწერი შეიცვალა. მენეჯერმა კავშირი ხელახლა უნდა გადაამოწმოს.",
        });
      for (const name of [input.own.name, input.target.name]) {
        if (
          roster.filter(
            s => s.department === input.department && s.name === name
          ).length !== 1
        )
          throw new TRPCError({
            code: "CONFLICT",
            message: "თანამშრომლის ჩანაწერი ორაზროვანია ან წაშლილია.",
          });
      }
      if (input.own.date < todayTbilisi() || input.target.date < todayTbilisi())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "გასული ცვლის გაცვლა შეუძლებელია.",
        });
      if (input.own.name === input.target.name)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "აირჩიეთ სხვა თანამშრომელი.",
        });
      const dates = [input.own.date, input.target.date].sort();
      if ((Date.parse(dates[1]) - Date.parse(dates[0])) / 86400000 > 35)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ცვლები 35-დღიანი პერიოდის ფარგლებში უნდა იყოს.",
        });
      const shifts = await getShifts(dates[0], dates[1]);
      for (const selected of [input.own, input.target]) {
        if (
          !shifts.some(
            shift =>
              shift.department === input.department &&
              shift.name === selected.name &&
              shift.date === selected.date &&
              shift.time === selected.time &&
              isWorking(shift.time)
          )
        )
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "განრიგი შეიცვალა. განაახლეთ გვერდი და თავიდან აირჩიეთ ცვლა.",
          });
      }
      const rows = await supabase<SwapRow[]>("tiflisi_swap_requests", "", {
        method: "POST",
        body: {
          requester_id: ctx.user.id,
          department: input.department,
          requester_name: input.own.name,
          own_date: input.own.date,
          own_time: input.own.time,
          target_name: input.target.name,
          target_date: input.target.date,
          target_time: input.target.time,
          reason: input.reason,
        },
      });
      return rows[0];
    }),
});
