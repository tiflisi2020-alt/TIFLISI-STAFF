import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  addDays,
  dateKey,
  mondayOf,
  restaurantDate,
  restaurantToday,
} from "@shared/schedule";

function readStoredStaffId() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem("tiflisi-view-staff") ?? "";
  } catch {
    return "";
  }
}

function storeStaffId(id: string) {
  try {
    window.localStorage.setItem("tiflisi-view-staff", id);
  } catch {
    // Storage may be unavailable in private browsing; in-memory state still works.
  }
}

function useStaffState() {
  const auth = useAuth();
  const roster = trpc.staff.roster.useQuery(undefined, {
    // Wait for auth so signed-in sessions get phone numbers on the first fetch.
    enabled: !auth.loading,
    staleTime: 60000,
    retry: 1,
  });
  const [staffId, setStaffId] = useState(readStoredStaffId);
  const [week, setWeek] = useState(() => mondayOf(restaurantDate()));
  const [day, setDay] = useState(() => restaurantToday());
  const account = trpc.staff.account.useQuery(undefined, {
    enabled: !!auth.user,
    retry: false,
  });
  const today = restaurantToday();
  const weekQuery = trpc.staff.shifts.useQuery(
    { from: dateKey(week), to: dateKey(addDays(week, 6)) },
    { staleTime: 30000, retry: 1 }
  );
  const upcoming = trpc.staff.shifts.useQuery(
    { from: today, to: dateKey(addDays(restaurantDate(), 28)) },
    { staleTime: 30000, retry: 1 }
  );
  const staff = roster.data ?? [];
  const selected = staff.find(s => s.id === staffId) ?? staff[0];
  const myStaff = staff.find(s => s.id === account.data?.staffId);
  const viewingOther = Boolean(
    selected && (!myStaff || selected.id !== myStaff.id)
  );
  useEffect(() => {
    if (myStaff) setStaffId(myStaff.id);
  }, [myStaff?.id]);
  const selectStaff = (id: string) => {
    setStaffId(id);
    storeStaffId(id);
  };
  const selectDate = (date: string) => {
    setDay(date);
    setWeek(mondayOf(new Date(`${date}T12:00:00`)));
  };
  const changeWeek = (delta: number) => {
    const next = addDays(week, delta * 7);
    setWeek(next);
    setDay(dateKey(next));
  };
  const resetWeek = () => {
    setWeek(mondayOf(restaurantDate()));
    setDay(today);
  };
  return {
    auth,
    roster,
    staff,
    selected,
    myStaff,
    viewingOther,
    account,
    selectStaff,
    week,
    day,
    setDay,
    selectDate,
    changeWeek,
    resetWeek,
    today,
    weekQuery,
    upcoming,
  };
}
const StaffContext = createContext<ReturnType<typeof useStaffState> | null>(
  null
);
export function StaffProvider({ children }: { children: ReactNode }) {
  const state = useStaffState();
  return (
    <StaffContext.Provider value={state}>{children}</StaffContext.Provider>
  );
}
export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("StaffProvider is missing");
  return ctx;
}
