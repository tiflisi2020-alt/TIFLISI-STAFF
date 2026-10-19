export const SUPABASE_URL = "https://bbroknpeebjuilycutjd.supabase.co";
export const STAFF_AVATAR_BUCKET = "staff-avatars";

export async function supabase<T>(
  table: string,
  query = "",
  options: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<T> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase სერვერული გასაღები არ არის დამატებული.");
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`,
    {
      method: options.method ?? "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: options.prefer ?? "return=representation",
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 409)
      throw new Error(
        detail ||
          "ეს ჩანაწერი უკვე არსებობს ან თანამშრომელი სხვა ანგარიშთან არის დაკავშირებული."
      );
    throw new Error(
      `Supabase-სთან კავშირი ვერ შესრულდა (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }
  const text = await response.text();
  if (!text.trim()) return [] as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Supabase-მა არასწორი მონაცემთა ფორმატი დააბრუნა.");
  }
}

function storagePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function storageResponse(path: string, options: RequestInit = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase სერვერული გასაღები არ არის დამატებული.");
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage-ის შეცდომა (${response.status})${detail ? `: ${detail}` : "."}`);
  }
  return response;
}

export async function uploadStaffAvatar(
  path: string,
  bytes: Uint8Array,
  contentType: string
) {
  await storageResponse(`object/${STAFF_AVATAR_BUCKET}/${storagePath(path)}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes as unknown as BodyInit,
  });
}

export async function removeStaffAvatar(path: string) {
  await storageResponse(`object/${STAFF_AVATAR_BUCKET}/${storagePath(path)}`, {
    method: "DELETE",
  });
}

export async function signedStaffAvatarUrl(path: string, expiresIn = 3600) {
  const response = await storageResponse(
    `object/sign/${STAFF_AVATAR_BUCKET}/${storagePath(path)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    }
  );
  const data = (await response.json()) as { signedURL?: string };
  return data.signedURL ? `${SUPABASE_URL}/storage/v1${data.signedURL}` : null;
}

export const departments = {
  waiters: {
    label: "მიმტანები",
    role: "მიმტანი",
    shifts: "waiter_positions",
    nameColumn: "waiter_name",
  },
  chefs: {
    label: "სამზარეულო",
    role: "მზარეული",
    shifts: "chef_positions",
    nameColumn: "chef_name",
  },
  cleaners: {
    label: "დასუფთავება",
    role: "დამლაგებელი",
    shifts: "cleaner_positions",
    nameColumn: "cleaner_name",
  },
  cashiers: {
    label: "მოლარეები",
    role: "მოლარე",
    shifts: "cashier_positions",
    nameColumn: "cashier_name",
  },
  hostesses: {
    label: "ჰოსტესები",
    role: "ჰოსტესი",
    shifts: "hostess_positions",
    nameColumn: "hostess_name",
  },
  administrators: {
    label: "ადმინისტრაცია",
    role: "ადმინისტრატორი",
    shifts: "administrator_positions",
    nameColumn: "administrator_name",
  },
} as const;
export type Department = keyof typeof departments;
export type AccountRow = {
  id: number;
  open_id: string;
  name: string | null;
  email: string | null;
  login_method: string | null;
  role: "user" | "admin";
  department: Department | null;
  staff_name: string | null;
  staff_id: string | null;
  created_at: string;
  updated_at: string;
  last_signed_in: string;
  session_version: number;
};
