import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  CalendarDays,
  Clock3,
  Coffee,
  FileText,
  Info,
  MapPin,
  Megaphone,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { useStaff } from "@/contexts/StaffContext";
import { trpc } from "@/lib/trpc";
import { addDays, dateKey, isWorking, prettyTime } from "@shared/schedule";
import {
  NOTICE_MEMORY_EVENT,
  NOTICE_VISIBLE_MS,
  markNoticesSeen,
  readNoticeMemory,
  writeNoticeMemory,
  type NoticeMemory,
} from "@shared/noticeState";
import {
  Avatar,
  EmptyState,
  GeorgianDate,
  PageHeading,
} from "@/components/staff/Shared";
import {
  CardSkeleton,
  HeroSkeleton,
  RowSkeleton,
  StatSkeleton,
  WeekSkeleton,
} from "@/components/staff/Skeletons";

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
  const requests = trpc.staff.requests.useQuery(undefined, {
    enabled: !!auth.user && !viewingOther,
    retry: false,
  });
  const announcements = trpc.staff.announcements.useQuery(undefined, {
    enabled: !!auth.user && !viewingOther,
    retry: false,
  });
  const previewPublishedAt = new Date().toISOString();
  const previewExpiresAt = new Date(
    Date.now() + 3 * 24 * 60 * 60 * 1000
  ).toISOString();
  const previewAnnouncements = [
    {
      id: "preview-urgent-v1",
      title: "მნიშვნელოვანი — ხვალინდელი თანამშრომელთა შეხვედრა",
      body: "ხვალ, 24 ოქტომბერს, თანამშრომელთა მოკლე შეხვედრა გაიმართება 10:30 საათზე პერსონალის ოთახში. გთხოვთ, ცვლის დაწყებამდე 10 წუთით ადრე მოხვიდეთ, რათა გავიაროთ მომსახურების ახალი წესი და დღის სამუშაო განაწილება.\n\nთუ დასწრებას ვერ ახერხებ, წინასწარ აცნობე მენეჯერს.",
      kind: "urgent" as const,
      isPinned: true,
      publishedAt: previewPublishedAt,
      expiresAt: previewExpiresAt,
      createdAt: previewPublishedAt,
      createdBy: null,
    },
    {
      id: "preview-schedule-v1",
      title: "განრიგის განახლება — 25 ოქტომბერი",
      body: "25 ოქტომბრის ცვლები განახლებულია. გადაამოწმე დაწყების დრო და პოზიცია, სანამ რესტორანში გამოხვალ.",
      kind: "schedule" as const,
      isPinned: false,
      publishedAt: previewPublishedAt,
      expiresAt: null,
      createdAt: previewPublishedAt,
      createdBy: null,
    },
    {
      id: "preview-event-v1",
      title: "გუნდის შეკრება პარასკევს",
      body: "პარასკევს, 18:00 საათზე, გუნდის შეკრება გაიმართება. დეტალებს მენეჯერი ადგილზე გაგიზიარებთ.",
      kind: "event" as const,
      isPinned: false,
      publishedAt: previewPublishedAt,
      expiresAt: null,
      createdAt: previewPublishedAt,
      createdBy: null,
    },
    {
      id: "preview-info-v1",
      title: "შენიშვნა — მარაგების მიღება",
      body: "ორშაბათს დილის მარაგების მიღება დაიწყება 08:30 საათზე. გთხოვთ, მიმღები ზონა თავისუფალი დატოვოთ და მიღებული პროდუქტები შესაბამის თაროებზე განათავსოთ.",
      kind: "info" as const,
      isPinned: false,
      publishedAt: previewPublishedAt,
      expiresAt: null,
      createdAt: previewPublishedAt,
      createdBy: null,
    },
  ] satisfies NonNullable<typeof announcements.data>;
  const showAnnouncementPreview =
    typeof window !== "undefined" &&
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("announcementPreview") ===
      "1";
  const userId = auth.user?.id ?? null;
  const [noticeMemory, setNoticeMemory] = useState<NoticeMemory>(() =>
    readNoticeMemory(userId)
  );
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [expandedAnnouncementIds, setExpandedAnnouncementIds] = useState<
    Set<string>
  >(() => new Set());
  useEffect(() => {
    const syncNoticeMemory = () => setNoticeMemory(readNoticeMemory(userId));
    syncNoticeMemory();
    window.addEventListener(NOTICE_MEMORY_EVENT, syncNoticeMemory);
    return () =>
      window.removeEventListener(NOTICE_MEMORY_EVENT, syncNoticeMemory);
  }, [userId]);
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
  const announcementItems =
    showAnnouncementPreview && !announcements.data?.length
      ? previewAnnouncements
      : (announcements.data ?? []);
  const featuredAnnouncement =
    announcementItems.find(item => item.isPinned || item.kind === "urgent") ??
    announcementItems[0];
  const orderedAnnouncements = featuredAnnouncement
    ? [
        featuredAnnouncement,
        ...announcementItems.filter(
          item => item.id !== featuredAnnouncement.id
        ),
      ]
    : [];
  const displayedAnnouncements = showAllAnnouncements
    ? orderedAnnouncements
    : orderedAnnouncements.slice(0, 3);
  const markAnnouncementSeen = (id: string) => {
    if (!userId) return;
    const next = markNoticesSeen(readNoticeMemory(userId), [id], []);
    if (!next) return;
    writeNoticeMemory(userId, next);
    setNoticeMemory(next);
    window.dispatchEvent(new Event(NOTICE_MEMORY_EVENT));
  };
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
          {upcoming.isLoading ? (
            <HeroSkeleton />
          ) : (
            <>
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
                  {next ? <GeorgianDate date={next.date} /> : "განრიგი"}
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
                    ცვლა ჯერ არ არის დაგეგმილი
                  </h2>
                  <p className="hero-empty-description">
                    შენი ახალი ცვლა აქ გამოჩნდება.
                  </p>
                  <Link href="/schedule" className="hero-empty-link">
                    განრიგის ნახვა <ArrowRight size={17} />
                  </Link>
                </>
              )}
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
          {weekQuery.isLoading ? (
            <StatSkeleton />
          ) : (
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-icon">
                  <CalendarDays size={19} />
                </span>
                <strong>{weekQuery.isError ? "—" : weekShifts.length}</strong>
                <span>დაგეგმილი ცვლა</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">
                  <Clock3 size={19} />
                </span>
                <strong>{weekQuery.isError ? "—" : activeDays}</strong>
                <span>სამუშაო დღე</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">
                  <Coffee size={19} />
                </span>
                <strong>{weekQuery.isError ? "—" : 7 - activeDays}</strong>
                <span>ცვლის გარეშე</span>
              </div>
            </div>
          )}
          <div className="stat-footnote">
            <Info size={13} /> სტატისტიკა დაგეგმილი ცვლების მიხედვით
          </div>
        </section>
      </div>
      {!viewingOther && auth.user && (
        <section className="announcement-panel" id="announcements">
          <div className="section-title announcement-section-title">
            <div>
              <span className="eyebrow">შიდა ინფორმაცია</span>
              <h2>
                <Megaphone size={18} /> განცხადებები
              </h2>
            </div>
            <div className="announcement-section-actions">
              <span className="announcement-count">
                {announcements.isLoading
                  ? "იტვირთება…"
                  : `${announcementItems.length} განცხადება`}
              </span>
              {showAnnouncementPreview && (
                <span className="announcement-preview-note">
                  სატესტო · მხოლოდ preview-ში
                </span>
              )}
              {announcementItems.length > 3 && (
                <button
                  type="button"
                  className="announcement-list-toggle"
                  aria-expanded={showAllAnnouncements}
                  onClick={() => setShowAllAnnouncements(value => !value)}
                >
                  {showAllAnnouncements ? "ნაკლების ნახვა" : "ყველას ნახვა"}
                </button>
              )}
            </div>
          </div>
          {announcements.isLoading ? (
            <CardSkeleton count={2} className="announcement-list" />
          ) : announcements.isError ? (
            <div className="error-banner">განცხადებები ვერ ჩაიტვირთა.</div>
          ) : announcementItems.length ? (
            <div className="announcement-list">
              {displayedAnnouncements.map(item => {
                const expanded = expandedAnnouncementIds.has(item.id);
                const bodyCanExpand = item.body.length > 140;
                const publishedAge =
                  Date.now() - new Date(item.publishedAt).getTime();
                const isNew =
                  !noticeMemory.announcements.includes(item.id) &&
                  publishedAge >= 0 &&
                  publishedAge <= NOTICE_VISIBLE_MS;
                const kindLabel =
                  item.kind === "urgent"
                    ? "სასწრაფო"
                    : item.kind === "schedule"
                      ? "განრიგი"
                      : item.kind === "event"
                        ? "ღონისძიება"
                        : "ინფორმაცია";
                return (
                  <article
                    className={`announcement-card announcement-${item.kind}${item.id === featuredAnnouncement?.id ? " announcement-featured" : ""}`}
                    id={`announcement-${item.id}`}
                    key={item.id}
                  >
                    <div className="announcement-card-top">
                      <div className="announcement-labels">
                        <span
                          className={`announcement-kind announcement-kind-${item.kind}`}
                        >
                          {kindLabel}
                        </span>
                        {item.isPinned && (
                          <span className="announcement-priority">
                            მნიშვნელოვანი
                          </span>
                        )}
                        {isNew && (
                          <span className="announcement-new">ახალი</span>
                        )}
                      </div>
                      <div className="announcement-dates">
                        <time dateTime={item.publishedAt}>
                          {new Date(item.publishedAt).toLocaleDateString(
                            "ka-GE",
                            {
                              day: "numeric",
                              month: "short",
                            }
                          )}
                        </time>
                        {item.expiresAt && (
                          <span className="announcement-expiry">
                            ძალაშია{" "}
                            {new Date(item.expiresAt).toLocaleDateString(
                              "ka-GE",
                              {
                                day: "numeric",
                                month: "short",
                              }
                            )}
                            -მდე
                          </span>
                        )}
                      </div>
                    </div>
                    <h3>{item.title}</h3>
                    <p
                      className={`announcement-body${bodyCanExpand && !expanded ? " announcement-body-collapsed" : ""}`}
                    >
                      {item.body}
                    </p>
                    {(bodyCanExpand || isNew || item.kind === "schedule") && (
                      <div className="announcement-card-actions">
                        {bodyCanExpand && (
                          <button
                            type="button"
                            className="announcement-action-link"
                            aria-expanded={expanded}
                            onClick={() => {
                              setExpandedAnnouncementIds(previous => {
                                const next = new Set(previous);
                                if (expanded) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                              if (!expanded) markAnnouncementSeen(item.id);
                            }}
                          >
                            {expanded ? "ნაკლების ჩვენება" : "სრულად წაკითხვა"}
                          </button>
                        )}
                        {isNew && (
                          <button
                            type="button"
                            className="announcement-action-link"
                            onClick={() => markAnnouncementSeen(item.id)}
                          >
                            წაკითხულად მონიშვნა
                          </button>
                        )}
                        {item.kind === "schedule" && (
                          <Link
                            className="announcement-action-link"
                            href="/schedule"
                          >
                            განრიგის ნახვა <ArrowRight size={14} />
                          </Link>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="announcement-empty">
              <Megaphone size={20} />
              <span>ახალი განცხადებები ჯერ არ გამოქვეყნებულა.</span>
            </div>
          )}
        </section>
      )}
      {!viewingOther && (
        <section className="employee-portal">
          <div className="section-title">
            <div>
              <span className="eyebrow">თანამშრომლის პორტალი</span>
              <h2>ყველაფერი შენს სამუშაო სივრცეში</h2>
            </div>
            <Link
              href={auth.user ? "/profile" : "/login"}
              className="text-link"
            >
              {auth.user ? "პროფილის გახსნა" : "ანგარიშში შესვლა"}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="portal-grid">
            <Link
              href={auth.user ? "/profile" : "/login"}
              className="portal-card"
            >
              <span className="portal-card-icon">
                <UserRound size={20} />
              </span>
              <span>
                <strong>{auth.user ? "ჩემი პროფილი" : "შენი ანგარიში"}</strong>
                <small>
                  {auth.user
                    ? "პირადი ინფორმაცია და კვირის ცვლები"
                    : "შედი, რომ პირადი ფუნქციები გამოიყენო"}
                </small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link href="/swap" className="portal-card">
              <span className="portal-card-icon">
                <ArrowLeftRight size={20} />
              </span>
              <span>
                <strong>ცვლის ჩანაცვლება</strong>
                <small>გააგზავნე ან მართე გაცვლის მოთხოვნა</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link
              href={auth.user ? "/profile" : "/schedule"}
              className="portal-card"
            >
              <span className="portal-card-icon">
                <FileText size={20} />
              </span>
              <span>
                <strong>ჩემი მოთხოვნები</strong>
                <small>
                  {!auth.user ? (
                    "შედი ანგარიშში სტატუსების სანახავად"
                  ) : requests.isLoading ? (
                    <span className="pin pin-inline" />
                  ) : requests.isError ? (
                    "სტატუსი ვერ ჩაიტვირთა"
                  ) : requests.data?.length ? (
                    `${requests.data.filter(r => r.status === "pending").length} მიმდინარე მოთხოვნა`
                  ) : (
                    "მოთხოვნა ჯერ არ არის"
                  )}
                </small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      )}
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
        {weekQuery.isLoading ? (
          <WeekSkeleton />
        ) : (
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
        )}
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
          ) : upcoming.isLoading ? (
            <RowSkeleton />
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
