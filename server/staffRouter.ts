import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { ADMIN_DEPARTMENT, hasAdminAccess, isManagerIdentity } from "./manager";
import {
  departments,
  removeStaffAvatar,
  signedStaffAvatarUrl,
  supabase,
  uploadStaffAvatar,
  type AccountRow,
  type Department,
} from "./supabase";
import {
  departmentIds,
  isWorking,
  restaurantToday,
  type Shift,
  type Staff,
} from "../shared/schedule";

const departmentEnum = z.enum(departmentIds);
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
export type Announcement = {
  id: string;
  title: string;
  body: string;
  kind: "info" | "urgent" | "schedule" | "event";
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  createdBy: number | null;
};
type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  kind: Announcement["kind"];
  is_pinned: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
  created_by: number | null;
};
const announcementFields =
  "id,title,body,kind,is_pinned,published_at,expires_at,created_at,created_by";
function asAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind,
    isPinned: row.is_pinned,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
  };
}
type ProfileDetailsRow = {
  avatar_path: string | null;
  preferred_name: string | null;
  phone: string | null;
  bio: string | null;
  emergency_contact: string | null;
};
const swapFields =
  "id,requester_id,department,requester_name,own_date,own_time,target_name,target_date,target_time,reason,status,created_at";

async function getStaffAvatarMap() {
  const accounts = await supabase<{ id: number; staff_id: string | null }[]>(
    "tiflisi_accounts",
    "select=id,staff_id&staff_id=not.is.null&limit=500"
  );
  const staffIds = accounts
    .map(row => row.staff_id)
    .filter((value): value is string => Boolean(value));
  if (!staffIds.length) return new Map<string, string>();
  const profiles = await supabase<
    { account_id: number; avatar_path: string | null }[]
  >(
    "tiflisi_profile_details",
    `select=account_id,avatar_path&avatar_path=not.is.null&limit=500`
  );
  const accountById = new Map(accounts.map(row => [row.id, row.staff_id]));
  const urls = await Promise.all(
    profiles
      .filter(row => row.avatar_path)
      .map(async row => {
        try {
          return [row.account_id, await signedStaffAvatarUrl(row.avatar_path!)] as const;
        } catch {
          return [row.account_id, null] as const;
        }
      })
  );
  const urlByAccount = new Map(urls.filter(([, url]) => url));
  const result = new Map<string, string>();
  for (const [index, staffId] of accountById) {
    const url = urlByAccount.get(index);
    if (staffId && url) result.set(staffId, url);
  }
  return result;
}

export async function getStaff(): Promise<Staff[]> {
  const [batches, inactive] = await Promise.all([
    Promise.all(
      Object.entries(departments).map(async ([department, config]) => {
        const rows = await supabase<
          { id: string | number; name: string; phone: string | null }[]
        >(
          department,
          "select=id,name,phone&order=position_order.asc,name.asc&limit=500"
        );
        return rows.map(row => ({
          id: `${department}:${row.id}`,
          name: row.name,
          department,
          role: config.role,
          phone: row.phone?.trim() ?? "",
        }));
      })
    ),
    supabase<{ staff_id: string }[]>(
      "tiflisi_staff_status",
      "select=staff_id&active=eq.false&limit=500"
    ),
  ]);
  const avatarByStaffId = await getStaffAvatarMap();
  const hidden = new Set(inactive.map(row => row.staff_id));
  return batches
    .flat()
    .filter(person => !hidden.has(person.id))
    .map(person => ({
      ...person,
      avatarUrl: avatarByStaffId.get(person.id) ?? null,
    }));
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

type ShiftCell = {
  exists: boolean;
  time: string | null;
  position: string | null;
  notes: string | null;
};
type ShiftWrite = {
  time: string | null;
  position: string | null;
  notes: string | null;
};

function fieldFilter(column: string, value: string | null) {
  return value === null
    ? `${column}=is.null`
    : `${column}=eq.${encodeURIComponent(value)}`;
}

async function readCell(
  department: Department,
  name: string,
  date: string
): Promise<ShiftCell> {
  const config = departments[department];
  const rows = await supabase<Record<string, string | null>[]>(
    config.shifts,
    `select=shift_time,position,notes&${config.nameColumn}=eq.${encodeURIComponent(name)}&shift_date=eq.${date}&limit=2`
  );
  if (rows.length > 1)
    throw new TRPCError({
      code: "CONFLICT",
      message: "ამ თარიღზე დუბლირებული ჩანაწერებია. გაცვლა არ შესრულდა.",
    });
  const row = rows[0];
  if (!row) return { exists: false, time: null, position: null, notes: null };
  return {
    exists: true,
    time: row.shift_time,
    position: row.position,
    notes: row.notes,
  };
}

async function writeCell(
  department: Department,
  name: string,
  date: string,
  before: ShiftCell,
  after: ShiftWrite
) {
  const config = departments[department];
  const identity = `${config.nameColumn}=eq.${encodeURIComponent(name)}&shift_date=eq.${date}`;
  if (!before.exists) {
    const created = await supabase<unknown[]>(config.shifts, "", {
      method: "POST",
      body: {
        [config.nameColumn]: name,
        shift_date: date,
        shift_time: after.time,
        position: after.position ?? "",
        notes: after.notes ?? "",
      },
    });
    if (!Array.isArray(created) || created.length !== 1)
      throw new TRPCError({
        code: "CONFLICT",
        message: "ცვლის ჩაწერა ვერ შესრულდა.",
      });
    return;
  }
  const updated = await supabase<unknown[]>(
    config.shifts,
    `${identity}&${fieldFilter("shift_time", before.time)}&${fieldFilter("position", before.position)}&${fieldFilter("notes", before.notes)}`,
    {
      method: "PATCH",
      body: {
        shift_time: after.time,
        position: after.position ?? "",
        notes: after.notes ?? "",
      },
    }
  );
  if (updated.length !== 1)
    throw new TRPCError({
      code: "CONFLICT",
      message: "ცვლა პარალელურად შეიცვალა. განაახლეთ მოთხოვნა.",
    });
}

async function undoCell(
  department: Department,
  name: string,
  date: string,
  before: ShiftCell,
  after: ShiftWrite
) {
  const config = departments[department];
  if (!before.exists) {
    await supabase(
      config.shifts,
      `${config.nameColumn}=eq.${encodeURIComponent(name)}&shift_date=eq.${date}&${fieldFilter("shift_time", after.time)}&${fieldFilter("position", after.position)}&${fieldFilter("notes", after.notes)}`,
      { method: "DELETE" }
    );
    return;
  }
  await writeCell(
    department,
    name,
    date,
    { exists: true, ...after },
    before
  );
}

function asWrite(cell: ShiftCell): ShiftWrite {
  return { time: cell.time, position: cell.position, notes: cell.notes };
}

export async function exchangeShifts(request: SwapRow) {
  const roster = await getStaff();
  for (const name of [request.requester_name, request.target_name]) {
    if (
      roster.filter(
        person =>
          person.department === request.department && person.name === name
      ).length !== 1
    )
      throw new TRPCError({
        code: "CONFLICT",
        message: "თანამშრომელი აღარ არის აქტიური ან ჩანაწერი ორაზროვანია.",
      });
  }
  if (request.own_date < todayTbilisi())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "გასული ცვლის ჩანაცვლება შეუძლებელია.",
    });
  if (request.own_date !== request.target_date)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ჩანაცვლება მხოლოდ იმავე დღეს ხდება.",
    });
  const own = await readCell(
    request.department,
    request.requester_name,
    request.own_date
  );
  const target = await readCell(
    request.department,
    request.target_name,
    request.own_date
  );
  if ((own.time ?? "OFF") !== request.own_time || !isWorking(own.time))
    throw new TRPCError({
      code: "CONFLICT",
      message: "განრიგი შეიცვალა. მოთხოვნა ვერ დამტკიცდება, სანამ ცვლა არ განახლდება.",
    });
  if (isWorking(target.time) || (target.time ?? "OFF") !== request.target_time)
    throw new TRPCError({
      code: "CONFLICT",
      message: "კოლეგა ამ დღეს უკვე მუშაობს ან მისი დასვენება შეიცვალა.",
    });
  const clear: ShiftWrite = { time: "OFF", position: "", notes: "" };
  const steps: {
    name: string;
    date: string;
    before: ShiftCell;
    after: ShiftWrite;
  }[] = [
    {
      name: request.target_name,
      date: request.own_date,
      before: target,
      after: asWrite(own),
    },
    {
      name: request.requester_name,
      date: request.own_date,
      before: own,
      after: clear,
    },
  ];
  const done: typeof steps = [];
  const undo = async () => {
    for (const step of [...done].reverse()) {
      await undoCell(
        request.department,
        step.name,
        step.date,
        step.before,
        step.after
      );
    }
  };
  try {
    for (const step of steps) {
      await writeCell(
        request.department,
        step.name,
        step.date,
        step.before,
        step.after
      );
      done.push(step);
    }
  } catch (error) {
    try {
      await undo();
    } catch {
      throw new TRPCError({
        code: "CONFLICT",
        message: "გაცვლა ვერ დასრულდა. გადაამოწმე ორივე თანამშრომლის განრიგი.",
      });
    }
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "CONFLICT",
      message: "გაცვლა ვერ შესრულდა. განრიგი უცვლელია.",
    });
  }
  return undo;
}

function avatarPathForUser(openId: string, extension: "jpg" | "png" | "webp") {
  const authId = openId.replace(/^supabase:/, "");
  if (!/^[0-9a-f-]{20,}$/i.test(authId))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ავატარის ატვირთვა მხოლოდ Supabase Auth ანგარიშისთვის არის შესაძლებელი.",
    });
  return `${authId}/avatar.${extension}`;
}

export const staffRouter = router({
  roster: publicProcedure.query(async ({ ctx }) => {
    const people = await getStaff();
    if (ctx.user) return people;
    return people.map(person => ({ ...person, phone: "" }));
  }),
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
  profile: protectedProcedure.query(async ({ ctx }) => {
    const rows = await supabase<ProfileDetailsRow[]>(
      "tiflisi_profile_details",
      `select=avatar_path,preferred_name,phone,bio,emergency_contact&account_id=eq.${ctx.user.id}&limit=1`
    );
    const row = rows[0];
    return row
      ? {
          avatarUrl: row.avatar_path
            ? await signedStaffAvatarUrl(row.avatar_path)
            : null,
          preferredName: row.preferred_name ?? "",
          phone: row.phone ?? "",
          bio: row.bio ?? "",
          emergencyContact: row.emergency_contact ?? "",
        }
      : {
          avatarUrl: null,
          preferredName: "",
          phone: "",
          bio: "",
          emergencyContact: "",
        };
  }),
  updateProfile: protectedProcedure
    .input(
      z.object({
        preferredName: z.string().trim().max(80),
        phone: z.string().trim().max(40),
        bio: z.string().trim().max(500),
        emergencyContact: z.string().trim().max(120),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rows = await supabase<ProfileDetailsRow[]>(
        "tiflisi_profile_details",
        "on_conflict=account_id",
        {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=representation",
          body: {
            account_id: ctx.user.id,
            preferred_name: input.preferredName || null,
            phone: input.phone || null,
            bio: input.bio || null,
            emergency_contact: input.emergencyContact || null,
            updated_at: new Date().toISOString(),
          },
        }
      );
      if (!rows[0])
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "პროფილის შენახვა ვერ შესრულდა.",
        });
      return { success: true };
    }),
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(100).max(2200000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const extension =
        input.mimeType === "image/jpeg"
          ? "jpg"
          : input.mimeType === "image/png"
            ? "png"
            : "webp";
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length > 1.5 * 1024 * 1024)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "შეკუმშული ფოტო უნდა იყოს 1.5 MB-ზე ნაკლები.",
        });
      const path = avatarPathForUser(ctx.user.openId, extension);
      const current = await supabase<Pick<ProfileDetailsRow, "avatar_path">[]>(
        "tiflisi_profile_details",
        `select=avatar_path&account_id=eq.${ctx.user.id}&limit=1`
      );
      await uploadStaffAvatar(path, bytes, input.mimeType);
      if (current[0]?.avatar_path && current[0].avatar_path !== path) {
        await removeStaffAvatar(current[0].avatar_path);
      }
      const rows = await supabase<ProfileDetailsRow[]>(
        "tiflisi_profile_details",
        "on_conflict=account_id",
        {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=representation",
          body: {
            account_id: ctx.user.id,
            avatar_path: path,
            updated_at: new Date().toISOString(),
          },
        }
      );
      if (!rows[0])
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ფოტოს ბმული ვერ შეინახა.",
        });
      return { avatarUrl: await signedStaffAvatarUrl(path) };
    }),
  deleteAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    const current = await supabase<Pick<ProfileDetailsRow, "avatar_path">[]>(
      "tiflisi_profile_details",
      `select=avatar_path&account_id=eq.${ctx.user.id}&limit=1`
    );
    if (current[0]?.avatar_path) await removeStaffAvatar(current[0].avatar_path);
    await supabase("tiflisi_profile_details", "on_conflict=account_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: {
        account_id: ctx.user.id,
        avatar_path: null,
        updated_at: new Date().toISOString(),
      },
    });
    return { success: true };
  }),
  announcements: protectedProcedure.query(async () => {
    const now = new Date().toISOString();
    const rows = await supabase<AnnouncementRow[]>(
      "tiflisi_announcements",
      `select=${announcementFields}&published_at=lte.${encodeURIComponent(now)}&or=(expires_at.is.null,expires_at.gte.${encodeURIComponent(now)})&order=is_pinned.desc,published_at.desc&limit=10`
    );
    return rows.map(asAnnouncement);
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
      const current = await supabase<Pick<AccountRow, "email">[]>(
        "tiflisi_accounts",
        `select=email&id=eq.${input.accountId}&limit=1`
      );
      if (!current[0])
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "ანგარიში ვერ მოიძებნა.",
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
            role:
              input.department === ADMIN_DEPARTMENT ||
              isManagerIdentity(current[0].email)
                ? "admin"
                : "user",
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
  incoming: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await supabase<AccountRow[]>(
      "tiflisi_accounts",
      `select=department,staff_name&id=eq.${ctx.user.id}&limit=1`
    );
    const account = accounts[0];
    if (!account?.staff_name || !account.department) return [];
    return supabase<SwapRow[]>(
      "tiflisi_swap_requests",
      `select=${swapFields}&department=eq.${account.department}&target_name=eq.${encodeURIComponent(account.staff_name)}&status=eq.pending&order=created_at.desc&limit=20`
    );
  }),
  notices: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await supabase<AccountRow[]>(
      "tiflisi_accounts",
      `select=department,staff_name&id=eq.${ctx.user.id}&limit=1`
    );
    const account = accounts[0];
    const incoming =
      account?.staff_name && account.department
        ? supabase<SwapRow[]>(
            "tiflisi_swap_requests",
            `select=${swapFields}&department=eq.${account.department}&target_name=eq.${encodeURIComponent(account.staff_name)}&status=eq.pending&order=created_at.desc&limit=8`
          )
        : Promise.resolve([] as SwapRow[]);
    const review =
      hasAdminAccess(ctx.user)
        ? supabase<SwapRow[]>(
            "tiflisi_swap_requests",
            `select=${swapFields}&status=eq.pending&order=created_at.desc&limit=8`
          )
        : Promise.resolve([] as SwapRow[]);
    const now = new Date().toISOString();
    const [outgoing, asked, pending, announcementRows] = await Promise.all([
      supabase<SwapRow[]>(
        "tiflisi_swap_requests",
        `select=${swapFields}&requester_id=eq.${ctx.user.id}&status=in.(pending,approved,rejected)&order=created_at.desc&limit=20`
      ),
      incoming,
      review,
      supabase<AnnouncementRow[]>(
        "tiflisi_announcements",
        `select=${announcementFields}&published_at=lte.${encodeURIComponent(now)}&or=(expires_at.is.null,expires_at.gte.${encodeURIComponent(now)})&order=is_pinned.desc,published_at.desc&limit=20`
      ),
    ]);
    return {
      outgoing,
      incoming: asked,
      review: pending,
      announcements: announcementRows.map(asAnnouncement),
    };
  }),
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
      if (input.own.date < todayTbilisi())
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "გასული ცვლის ჩანაცვლება შეუძლებელია.",
        });
      if (input.own.name === input.target.name)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "აირჩიეთ სხვა თანამშრომელი.",
        });
      if (input.own.date !== input.target.date)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ჩანაცვლება მხოლოდ იმავე დღეს ხდება.",
        });
      const shifts = await getShifts(input.own.date, input.own.date);
      const inDepartment = shifts.filter(
        shift => shift.department === input.department
      );
      const ownShift = inDepartment.find(
        shift => shift.name === input.own.name && shift.date === input.own.date
      );
      if (
        !ownShift ||
        ownShift.time !== input.own.time ||
        !isWorking(ownShift.time)
      )
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "განრიგი შეიცვალა. განაახლეთ გვერდი და თავიდან აირჩიეთ ცვლა.",
        });
      const coverShift = inDepartment.find(
        shift =>
          shift.name === input.target.name && shift.date === input.own.date
      );
      if (coverShift && isWorking(coverShift.time))
        throw new TRPCError({
          code: "CONFLICT",
          message: "კოლეგა ამ დღეს უკვე მუშაობს და ვერ გამოვა ნაცვლად.",
        });
      const coverTime = coverShift?.time ?? "OFF";
      if (input.target.time !== coverTime)
        throw new TRPCError({
          code: "CONFLICT",
          message: "კოლეგის დასვენება შეიცვალა. თავიდან აირჩიეთ.",
        });
      const pending = await supabase<
        Pick<
          SwapRow,
          "requester_name" | "own_date" | "target_name" | "target_date"
        >[]
      >(
        "tiflisi_swap_requests",
        `select=requester_name,own_date,target_name,target_date&department=eq.${input.department}&status=eq.pending&limit=500`
      );
      const locked = (name: string, date: string) =>
        pending.some(
          row =>
            (row.requester_name === name && row.own_date === date) ||
            (row.target_name === name && row.target_date === date)
        );
      if (
        locked(input.own.name, input.own.date) ||
        locked(input.target.name, input.target.date)
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "ამ ცვლაზე უკვე არის განუხილველი მოთხოვნა.",
        });
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
  respondSwap: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const accounts = await supabase<AccountRow[]>(
        "tiflisi_accounts",
        `select=department,staff_name&id=eq.${ctx.user.id}&limit=1`
      );
      const account = accounts[0];
      if (!account?.staff_name || !account.department)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ანგარიში თანამშრომელთან არ არის დაკავშირებული.",
        });
      const mine = `department=eq.${account.department}&target_name=eq.${encodeURIComponent(account.staff_name)}`;
      const pending = await supabase<SwapRow[]>(
        "tiflisi_swap_requests",
        `select=${swapFields}&id=eq.${input.id}&status=eq.pending&${mine}&limit=1`
      );
      const request = pending[0];
      if (!request)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ეს მოთხოვნა შენ არ გეკუთვნის ან უკვე განხილულია.",
        });
      if (input.status === "rejected") {
        const rows = await supabase<SwapRow[]>(
          "tiflisi_swap_requests",
          `id=eq.${input.id}&status=eq.pending&${mine}`,
          { method: "PATCH", body: { status: "rejected" } }
        );
        if (rows.length !== 1)
          throw new TRPCError({
            code: "CONFLICT",
            message: "მოთხოვნა უკვე განხილულია ან ვერ მოიძებნა.",
          });
        return { success: true };
      }
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
      return { success: true };
    }),
  cancelSwap: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await supabase<SwapRow[]>(
        "tiflisi_swap_requests",
        `id=eq.${input.id}&requester_id=eq.${ctx.user.id}&status=eq.pending`,
        { method: "PATCH", body: { status: "cancelled" } }
      );
      if (rows.length !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "მოთხოვნა უკვე განხილულია ან ვერ მოიძებნა.",
        });
      return { success: true };
    }),
});
