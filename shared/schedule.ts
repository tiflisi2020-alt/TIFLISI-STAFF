export type Staff = {
  id: string;
  name: string;
  department: string;
  role: string;
  avatarUrl?: string | null;
};
export type Shift = {
  id: string;
  name: string;
  department: string;
  date: string;
  time: string;
  position: string;
  notes: string;
};
export const departmentIds = [
  "waiters",
  "chefs",
  "cleaners",
  "cashiers",
  "hostesses",
  "administrators",
] as const;
export type DepartmentId = (typeof departmentIds)[number];
export const departmentLabels: Record<DepartmentId, string> = {
  waiters: "მიმტანები",
  chefs: "სამზარეულო",
  cleaners: "დასუფთავება",
  cashiers: "მოლარეები",
  hostesses: "ჰოსტესები",
  administrators: "ადმინისტრაცია",
};
export function isWorking(time: string | null | undefined) {
  return Boolean(
    time?.trim() &&
      !/^(off|holiday|vacation|დასვენება|შვებულება|-)$/i.test(time.trim())
  );
}
export function shiftHours(time: string): number | null {
  const match = time.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return ((end - start + 1440) % 1440) / 60;
}
export function prettyTime(time: string): string {
  return time
    .replace(/\b(\d):(\d{2})/g, "0$1:$2")
    .replace(/\s*[-–—]\s*/g, " – ");
}
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
export function restaurantToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tbilisi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function restaurantDate(now = new Date()): Date {
  return new Date(`${restaurantToday(now)}T12:00:00`);
}
