import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  addDays,
  dateKey,
  departmentLabels,
  isWorking,
} from "@shared/schedule";
import { useStaff } from "@/contexts/StaffContext";
import { EmptyState, PageHeading, ShiftCard } from "@/components/staff/Shared";

export default function Schedule() {
  const {
    staff,
    selected,
    week,
    day,
    setDay,
    changeWeek,
    resetWeek,
    weekQuery,
    today,
    myStaff,
    viewingOther,
    selectStaff,
  } = useStaff();
  const [mode, setMode] = useState<"mine" | "all">("mine");
  const [department, setDepartment] = useState("all");
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const data = (weekQuery.data ?? []).filter(
    s => s.date === day && isWorking(s.time)
  );
  const visible = data.filter(s =>
    mode === "mine"
      ? s.name === selected?.name && s.department === selected?.department
      : department === "all" || s.department === department
  );
  return (
    <>
      <PageHeading
        eyebrow="შენი დრო, შენი რიტმი"
        title="ცვლების განრიგი"
        description="ყველა ცვლა ერთ სივრცეში — დაგეგმე შენი კვირა."
        action={
          <Link href="/swap" className="primary-button">
            <ArrowLeftRight size={18} /> ჩანაცვლება
          </Link>
        }
      />
      <div className="schedule-toolbar">
        <div className="segmented-control">
          <button
            className={mode === "mine" ? "selected" : ""}
            onClick={() => setMode("mine")}
          >
            {viewingOther ? "არჩეული თანამშრომელი" : "ჩემი ცვლები"}
          </button>
          <button
            className={mode === "all" ? "selected" : ""}
            onClick={() => setMode("all")}
          >
            მთელი გუნდი
          </button>
        </div>
        {mode === "mine" && (
          <span className="schedule-viewer">
            {selected?.name}{" "}
            {myStaff && viewingOther && (
              <button
                className="text-link"
                onClick={() => selectStaff(myStaff.id)}
              >
                {" "}
                · ჩემი ცვლები
              </button>
            )}
          </span>
        )}
        {mode === "all" && (
          <select
            className="plain-select"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            aria-label="დეპარტამენტი"
          >
            <option value="all">ყველა დეპარტამენტი</option>
            {Object.entries(departmentLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      <section className="calendar-panel">
        <div className="month-heading">
          <h2>
            <CalendarDays size={18} />
            {week.toLocaleDateString("ka-GE", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div>
            <button className="today-button" onClick={resetWeek}>
              დღეს
            </button>
            <button
              className="icon-button"
              aria-label="წინა კვირა"
              onClick={() => changeWeek(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="შემდეგი კვირა"
              onClick={() => changeWeek(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="calendar-days">
          {days.map(d => {
            const key = dateKey(d);
            const has = (weekQuery.data ?? []).some(
              s =>
                s.date === key &&
                isWorking(s.time) &&
                (mode === "all" ||
                  (s.name === selected?.name &&
                    s.department === selected?.department))
            );
            return (
              <button
                className={`${key === day ? "selected" : ""} ${key === today ? "is-today" : ""}`}
                onClick={() => setDay(key)}
                key={key}
              >
                <span>
                  {d.toLocaleDateString("ka-GE", { weekday: "short" })}
                </span>
                <b>{d.getDate()}</b>
                <i className={has ? "has-shift" : ""} />
              </button>
            );
          })}
        </div>
      </section>
      <div className="daily-heading">
        <h2>
          {new Date(day + "T12:00:00").toLocaleDateString("ka-GE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h2>
        <span>{visible.length} ცვლა</span>
      </div>
      {weekQuery.isLoading ? (
        <div className="loading-grid">
          <div className="loading-card" />
          <div className="loading-card" />
        </div>
      ) : weekQuery.isError ? (
        <div className="error-banner">
          განრიგი ვერ ჩაიტვირთა.{" "}
          <button onClick={() => weekQuery.refetch()}>ხელახლა ცდა</button>
        </div>
      ) : visible.length ? (
        <div className="shift-grid">
          {visible.map(shift => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              staff={staff.find(
                s => s.name === shift.name && s.department === shift.department
              )}
              mine={
                shift.name === selected?.name &&
                shift.department === selected?.department
              }
              onSwap={
                shift.name === myStaff?.name &&
                shift.department === myStaff?.department &&
                shift.date >= today
                  ? () => window.location.assign(`/swap?date=${shift.date}`)
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="ამ დღეს ცვლა არ არის"
          description={
            mode === "mine"
              ? "არჩეული თანამშრომლისთვის ცვლა არ არის დაგეგმილი. ნახე მთელი გუნდი ან აირჩიე სხვა დღე."
              : "ამ თარიღზე არჩეული დეპარტამენტის ცვლა არ არის დაგეგმილი."
          }
        />
      )}
      <div className="info-strip">
        <span className="status-dot" />
        <p>
          განრიგი Supabase-დან იტვირთება. თუ მხოლოდ დაწყების დროა მითითებული,
          დასრულების საათს არ ვვარაუდობთ.
        </p>
      </div>
    </>
  );
}
