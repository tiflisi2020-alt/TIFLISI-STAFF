export const SUPABASE_URL = "https://bbroknpeebjuilycutjd.supabase.co";

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
    if (response.status === 409)
      throw new Error(
        "ეს ჩანაწერი უკვე არსებობს ან თანამშრომელი სხვა ანგარიშთან არის დაკავშირებული."
      );
    throw new Error(`Supabase-სთან კავშირი ვერ შესრულდა (${response.status}).`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
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
