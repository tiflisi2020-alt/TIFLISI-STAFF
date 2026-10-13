import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Search, Users } from "lucide-react";
import { departmentLabels, isWorking, prettyTime } from "@shared/schedule";
import { useStaff } from "@/contexts/StaffContext";
import { Avatar, EmptyState, PageHeading } from "@/components/staff/Shared";

export default function Team() {
  const { staff, selectStaff, upcoming, today, roster } = useStaff();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = useMemo(
    () =>
      staff.filter(
        s =>
          (filter === "all" || s.department === filter) &&
          s.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
      ),
    [staff, filter, search]
  );
  return (
    <>
      <PageHeading
        eyebrow="ტიფლისის ადამიანები"
        title="ჩვენი გუნდი"
        description={`${staff.length} თანამშრომელი · 5 დეპარტამენტი · ერთი გუნდი`}
        action={
          <span className="team-count-badge">
            <Users size={17} /> გუნდის წევრები
          </span>
        }
      />
      <div className="search-box">
        <Search size={19} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="მოძებნე თანამშრომელი…"
          aria-label="თანამშრომლის ძიება"
        />
        <kbd>ძებნა</kbd>
      </div>
      <div className="department-tabs">
        {[["all", "ყველა"], ...Object.entries(departmentLabels)].map(
          ([id, label]) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
              <span>
                {staff.filter(s => id === "all" || s.department === id).length}
              </span>
            </button>
          )
        )}
      </div>
      <div className="section-title team-list-heading">
        <h2>
          {filter === "all" ? "ყველა თანამშრომელი" : departmentLabels[filter]}
        </h2>
        <span>{visible.length} წევრი</span>
      </div>
      {roster.isError ? (
        <div className="error-banner">
          გუნდი ვერ ჩაიტვირთა.{" "}
          <button onClick={() => roster.refetch()}>ხელახლა ცდა</button>
        </div>
      ) : roster.isLoading ? (
        <div className="loading-grid">
          <div className="loading-card" />
          <div className="loading-card" />
        </div>
      ) : visible.length ? (
        <div className="team-grid">
          {visible.map(person => {
            const shift = (upcoming.data ?? [])
              .filter(
                s =>
                  s.name === person.name &&
                  s.department === person.department &&
                  isWorking(s.time)
              )
              .sort((a, b) => a.date.localeCompare(b.date))[0];
            const working = shift?.date === today;
            return (
              <article className="person-card" key={person.id}>
                <div className="person-top">
                  <Avatar name={person.name} size="large" />
                  <span className={`person-status ${working ? "working" : ""}`}>
                    <i />
                    {working ? "დღეს მუშაობს" : "გუნდის წევრი"}
                  </span>
                </div>
                <h3>{person.name}</h3>
                <p>{person.role}</p>
                <div className="person-next">
                  <span>
                    {shift
                      ? working
                        ? "დღევანდელი ცვლა"
                        : "უახლოესი ცვლა"
                      : "ცვლა ჯერ არ არის"}
                  </span>
                  <b>{shift ? prettyTime(shift.time) : "—"}</b>
                </div>
                <Link
                  href="/schedule"
                  className="person-link"
                  onClick={() => selectStaff(person.id)}
                >
                  განრიგის ნახვა <ArrowUpRight size={17} />
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="თანამშრომელი ვერ მოიძებნა"
          description="შეცვალე საძიებო სიტყვა ან აირჩიე სხვა დეპარტამენტი."
        />
      )}
      <div className="info-strip">
        <Users size={17} />
        <p>გუნდის მონაცემები არსებულ Supabase ცხრილებთან არის დაკავშირებული.</p>
      </div>
    </>
  );
}
