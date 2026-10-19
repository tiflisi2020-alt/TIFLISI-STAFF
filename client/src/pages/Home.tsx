import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Coffee,
  Info,
  MapPin,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useStaff } from "@/contexts/StaffContext";
import { addDays, dateKey, isWorking, prettyTime } from "@shared/schedule";
import {
  Avatar,
  EmptyState,
  GeorgianDate,
  PageHeading,
} from "@/components/staff/Shared";

function shiftSortKey(shift: { date: string; time: string }) {
  const start = shift.time.match(/\d{1,2}:\d{2}/)?.[0] ?? "23:59";
  return `${shift.date}T${start.padStart(5, "0")}`;
}

export default function Home() {
  const {
    selected,
    staff,
    weekQuery,
    upcoming,
    week,
    today,
    setDay,
    selectDate,
    viewingOther,
    auth,
  } = useStaff();
  const weekShifts = (weekQuery.data ?? []).filter(
    s =>
      s.name === selected?.name &&
      s.department === selected?.department &&
      isWorking(s.time)
  );
  const mine = (upcoming.data ?? [])
    .filter(
      s =>
        s.name === selected?.name &&
        s.department === selected?.department &&
        isWorking(s.time)
    )
    .sort((a, b) => shiftSortKey(a).localeCompare(shiftSortKey(b)));
  const next = mine[0];
  const colleagues = next
    ? (upcoming.data ?? []).filter(
        s =>
          s.date === next.date &&
          s.time === next.time &&
          isWorking(s.time) &&
          !(s.name === next.name && s.department === next.department)
      )
    : [];
  const activeDays = new Set(weekShifts.map(s => s.date)).size;
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const currentWeekLabel = `${week.toLocaleDateString("ka-GE", { day: "numeric", month: "short" })} – ${addDays(week, 6).toLocaleDateString("ka-GE", { day: "numeric", month: "short" })}`;
  return (
    <>
      <PageHeading
        eyebrow="შენი სამუშაო დღე"
        title={
          viewingOther
            ? "გამარჯობა, გუნდო!"
            : `გამარჯობა, ${selected?.name.trim().split(/\s+/)[0] ?? "გუნდო"}!`
        }
        description="კარგი დღე იწყება მოწესრიგებული განრიგით."
        action={
          <div className="greeting-avatar">
            <Avatar name={selected?.name ?? "ტიფლისი"} size="large" />
          </div>
        }
      />
      {viewingOther && (
        <div className="view-mode">
          <span className="status-dot" /> {selected?.name} · განრიგის ნახვა{" "}
          <Link href={auth.user ? "/profile" : "/login"}>
            {auth.user ? "ჩემი პროფილი" : "ანგარიშში შესვლა"}{" "}
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      {weekQuery.isError || upcoming.isError ? (
        <div className="error-banner">
          განრიგის ჩატვირთვა ვერ მოხერხდა.{" "}
          <button
            onClick={() => {
              weekQuery.refetch();
              upcoming.refetch();
            }}
          >
            ხელახლა ცდა
          </button>
        </div>
      ) : null}
      <div className="dashboard-top">
        <section className="hero-shift">
          <div className="hero-top">
            <span>
              <span className="hero-dot" />
              {next?.date === today
                ? "დღევანდელი ცვლა"
                : viewingOther
                  ? "უახლოესი ცვლა"
                  : "შენი უახლოესი ცვლა"}
            </span>
            <span className="hero-badge">
              {next ? (
                <GeorgianDate date={next.date} />
              ) : upcoming.isLoading ? (
                "იტვირთება"
              ) : (
                "განრიგი"
              )}
            </span>
          </div>
          {next ? (
            <>
              <h2>{prettyTime(next.time)}</h2>
              <div className="hero-location">
                <MapPin size={17} /> რესტორანი ტიფლისი{" "}
                {next.position && <> · პოზიცია {next.position}</>}
              </div>
              <div className="hero-bottom">
                <div className="coworkers">
                  <div className="avatar-stack">
                    {colleagues.slice(0, 3).map(c => (
                      <Avatar name={c.name} size="small" key={c.id} />
                    ))}
                  </div>
                  <span>
                    {colleagues.length
                      ? `${colleagues.length} თანამშრომელი შენთან ერთად`
                      : "შენი სამუშაო დღე"}
                  </span>
                </div>
                <Link href="/schedule">
                  დეტალურად <ArrowRight size={17} />
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="hero-empty-title">
                {upcoming.isLoading
                  ? "ცვლები იტვირთება…"
                  : "ცვლა ჯერ არ არის დაგეგმილი"}
              </h2>
              <p className="hero-empty-description">
                {upcoming.isLoading
                  ? "მონაცემებს Supabase-დან ვიღებთ."
                  : "შენი ახალი ცვლა აქ გამოჩნდება."}
              </p>
              <Link href="/schedule" className="hero-empty-link">
                განრიგის ნახვა <ArrowRight size={17} />
              </Link>
            </>
          )}
          <div className="hero-decoration" aria-hidden="true">
            <CalendarDays />
          </div>
        </section>
        <section className="week-summary">
          <div className="section-title">
            <h2>{viewingOther ? "კვირის სტატისტიკა" : "შენი კვირა"}</h2>
            <span>{currentWeekLabel}</span>
          </div>
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-icon">
                <CalendarDays size={19} />
              </span>
              <strong>
                {weekQuery.isLoading || weekQuery.isError ? "—" : weekShifts.length}
              </strong>
              <span>დაგეგმილი ცვლა</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <Clock3 size={19} />
              </span>
              <strong>
                {weekQuery.isLoading || weekQuery.isError ? "—" : activeDays}
              </strong>
              <span>სამუშაო დღე</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <Coffee size={19} />
              </span>
              <strong>
                {weekQuery.isLoading || weekQuery.isError ? "—" : 7 - activeDays}
              </strong>
              <span>ცვლის გარეშე</span>
            </div>
          </div>
          <div className="stat-footnote">
            <Info size={13} /> სტატისტიკა დაგეგმილი ცვლების მიხედვით
          </div>
        </section>
      </div>
      <section className="week-panel">
        <div className="section-title">
          <div>
            <h2>კვირის მიმოხილვა</h2>
            <p>შენი სამუშაო რიტმი, ერთი შეხედვით</p>
          </div>
          <Link href="/schedule" className="text-link">
            სრული განრიგი <ArrowRight size={16} />
          </Link>
        </div>
        <div className="overview-days">
          {days.map(d => {
            const key = dateKey(d);
            const dayShifts = weekShifts
              .filter(s => s.date === key)
              .sort((a, b) => shiftSortKey(a).localeCompare(shiftSortKey(b)));
            const shift = dayShifts[0];
            return (
              <Link
                href="/schedule"
                onClick={() => setDay(key)}
                key={key}
                className={`overview-day ${key === today ? "today" : ""} ${shift ? "working" : ""}`}
              >
                <div>
                  <span>
                    {d.toLocaleDateString("ka-GE", { weekday: "short" })}
                  </span>
                  {key === today && <span className="today-chip">დღეს</span>}
                </div>
                <b>{String(d.getDate()).padStart(2, "0")}</b>
                <span className="day-shift">
                  {shift
                    ? `${prettyTime(shift.time)}${dayShifts.length > 1 ? ` +${dayShifts.length - 1}` : ""}`
                    : "ცვლის გარეშე"}
                </span>
                <i />
              </Link>
            );
          })}
        </div>
      </section>
      <div className="dashboard-bottom">
        <section className="next-panel">
          <div className="section-title">
            <h2>შემდეგი ცვლები</h2>
          </div>
          {upcoming.isError ? (
            <EmptyState
              title="განრიგი ვერ ჩაიტვირთა"
              description="ხელახლა ცადე მონაცემების ჩატვირთვა ზემოთ მოცემული ღილაკით."
            />
          ) : mine.length ? (
            mine.slice(0, 3).map(shift => (
              <Link
                key={shift.id}
                href="/schedule"
                className="upcoming-row"
                onClick={() => selectDate(shift.date)}
              >
                <span className="date-block">
                  <b>{shift.date.slice(8)}</b>
                  <small>
                    {new Date(shift.date + "T12:00:00").toLocaleDateString(
                      "ka-GE",
                      { month: "short" }
                    )}
                  </small>
                </span>
                <div>
                  <strong>{prettyTime(shift.time)}</strong>
                  <span>
                    {shift.position
                      ? `პოზიცია ${shift.position}`
                      : "რესტორანი ტიფლისი"}{" "}
                    · {selected?.role}
                  </span>
                </div>
                <ArrowUpRight size={19} />
              </Link>
            ))
          ) : (
            <EmptyState
              title="მშვიდი კალენდარი"
              description="მომდევნო ოთხ კვირაში ცვლა არ არის დამატებული."
            />
          )}
        </section>
        <section className="team-panel">
          <div className="team-panel-icon">
            <Users size={27} />
          </div>
          <span className="eyebrow">ჩვენი გუნდი</span>
          <h2>ერთად, უკეთესად.</h2>
          <p>
            {staff.length} თანამშრომელი, ერთი საერთო მიზანი.
            <br />
            იპოვე კოლეგა და ნახე მისი განრიგი.
          </p>
          <div className="team-preview">
            {staff.slice(0, 5).map(s => (
              <Avatar key={s.id} name={s.name} size="small" />
            ))}
            {staff.length > 5 && <span>+{staff.length - 5}</span>}
          </div>
          <Link href="/team" className="secondary-button">
            გუნდის ნახვა <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </>
  );
}
