import { Link, useLocation } from "wouter";
import PhoneNotifications from "./PhoneNotifications";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Home,
  LogIn,
  Users,
  UserRound,
  X,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useStaff } from "@/contexts/StaffContext";
import { Avatar, GeorgianDate } from "./Shared";
import {
  NOTICE_MEMORY_EVENT,
  markNoticesSeen,
  readNoticeMemory,
  rememberResolved,
  visibleAnnouncements,
  visibleAnswers,
  writeNoticeMemory,
  type NoticeMemory,
} from "@shared/noticeState";
import { prettyTime, restaurantDate } from "@shared/schedule";
import { getLoginHref } from "@/const";
import { trpc } from "@/lib/trpc";

const nav = [
  { path: "/", label: "მთავარი", icon: Home },
  { path: "/schedule", label: "განრიგი", icon: CalendarDays },
  { path: "/team", label: "გუნდი", icon: Users },
  { path: "/profile", label: "პროფილი", icon: UserRound },
];
const adminNav = { path: "/admin", label: "მართვა", icon: ShieldCheck };
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-symbol">
        <CalendarDays size={23} />
      </span>
      <span>
        <b>
          ტიფლისი<span className="brand-dot">.</span>
        </b>
        <small>გუნდის სივრცე</small>
      </span>
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { staff, selected, selectStaff, auth, roster } = useStaff();
  const [notifications, setNotifications] = useState(false);
  const [selector, setSelector] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const url = event.data?.url;
      if (event.data?.type !== "tiflisi-open" || typeof url !== "string")
        return;
      if (!url.startsWith("/") || url.startsWith("//")) return;
      navigate(url);
      setNotifications(false);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
  useEffect(() => {
    if (!notifications && !selector) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [notifications, selector]);
  const utils = trpc.useUtils();
  const notices = trpc.staff.notices.useQuery(undefined, {
    enabled: !!auth.user,
    retry: false,
    refetchInterval: 20000,
  });
  const refreshAfterDecision = async () => {
    await Promise.all([
      utils.staff.notices.invalidate(),
      utils.staff.incoming.invalidate(),
      utils.staff.requests.invalidate(),
      utils.staff.shifts.invalidate(),
      utils.admin.requests.invalidate(),
    ]);
  };
  const reviewRequest = trpc.admin.reviewRequest.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.status === "approved"
          ? "ჩანაცვლება დადასტურდა."
          : "მოთხოვნა უარყოფილია."
      );
      await refreshAfterDecision();
    },
    onError: error => toast.error(error.message),
  });
  const deciding = reviewRequest.isPending;
  const isManager = auth.user?.role === "admin";
  const userId = auth.user?.id ?? null;
  const [memory, setMemory] = useState<NoticeMemory>(() =>
    readNoticeMemory(userId)
  );
  useEffect(() => {
    setMemory(readNoticeMemory(userId));
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const syncNoticeMemory = () => setMemory(readNoticeMemory(userId));
    window.addEventListener(NOTICE_MEMORY_EVENT, syncNoticeMemory);
    return () =>
      window.removeEventListener(NOTICE_MEMORY_EVENT, syncNoticeMemory);
  }, [userId]);
  const review = (isManager ? (notices.data?.review ?? []) : []).filter(
    item => item.requester_id !== userId
  );
  const reviewIds = new Set(review.map(item => item.id));
  const incoming = (isManager ? [] : (notices.data?.incoming ?? [])).filter(
    item => item.requester_id !== userId
  );
  const answers = visibleAnswers(
    (notices.data?.outgoing ?? []).filter(item => !reviewIds.has(item.id)),
    memory,
    Date.now()
  );
  const posted = visibleAnnouncements(
    notices.data?.announcements ?? [],
    userId ?? 0,
    Date.now()
  );
  const unseenAnswers = answers.filter(
    item => !memory.requests.includes(item.id)
  );
  const unseenPosts = posted.filter(
    item => !memory.announcements.includes(item.id)
  );
  const noticeCount =
    incoming.length + review.length + unseenAnswers.length + unseenPosts.length;
  const noticeListCount =
    incoming.length + review.length + answers.length + posted.length;
  useEffect(() => {
    if (!userId) return;
    const next = rememberResolved(
      memory,
      notices.data?.outgoing ?? [],
      Date.now()
    );
    if (!next) return;
    writeNoticeMemory(userId, next);
    setMemory(next);
  }, [memory, notices.data?.outgoing, userId]);
  useEffect(() => {
    if (!notifications || !userId) return;
    const next = markNoticesSeen(
      memory,
      [],
      answers.map(item => item.id)
    );
    if (!next) return;
    writeNoticeMemory(userId, next);
    setMemory(next);
  }, [answers, memory, notifications, userId]);
  const pageLabel =
    location === "/admin"
      ? "ადმინისტრაცია"
      : location === "/team"
        ? "გუნდი"
        : location === "/profile"
          ? "პროფილი"
          : location === "/swap"
            ? "ცვლის ჩანაცვლება"
            : location === "/schedule"
              ? "განრიგი"
              : "მთავარი";
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">სამუშაო სივრცე</div>
        <nav className="desktop-nav">
          {nav.map(item => (
            <Link
              key={item.path}
              href={item.path}
              className={
                location === item.path ||
                (item.path === "/schedule" && location === "/swap")
                  ? "nav-item active"
                  : "nav-item"
              }
            >
              <item.icon size={20} />
              {item.label}
              {item.path === "/team" && staff.length > 0 && (
                <span className="nav-count">{staff.length}</span>
              )}
            </Link>
          ))}
          {auth.user?.role === "admin" && (
            <Link
              href="/admin"
              className={location === "/admin" ? "nav-item active" : "nav-item"}
            >
              <ShieldCheck size={20} /> ადმინისტრაცია
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="restaurant-note">
            <span className="note-rule" />
            <p>
              ერთი გუნდი.
              <br />
              <b>საერთო რიტმი.</b>
            </p>
            <small>რესტორანი „ტიფლისი“</small>
          </div>
          <div className="connection">
            <span className={`status-dot ${roster.isError ? "offline" : ""}`} />
            {roster.isError ? "კავშირი შეწყვეტილია" : "Supabase დაკავშირებულია"}
            <Check size={13} />
          </div>
          <div className="sidebar-person">
            <Avatar name={selected?.name ?? "ტიფლისი"} />
            <div>
              <strong>{selected?.name ?? "თანამშრომელი"}</strong>
              <span>
                {auth.user ? "ანგარიში აქტიურია" : "განრიგის ნახვის რეჟიმი"}
              </span>
            </div>
            <button
              aria-label="პროფილის ნახვა"
              onClick={() => window.location.assign("/profile")}
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="breadcrumb">
            რესტორანი ტიფლისი <span>/</span> <b>{pageLabel}</b>
          </div>
          <div className="header-actions">
            <span className="header-date">
              {restaurantDate().toLocaleDateString("ka-GE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            {auth.user?.role === "admin" && (
              <Link
                href="/admin"
                className="header-admin-link"
                aria-label="ადმინისტრაციის სამართავი გვერდი"
              >
                <ShieldCheck size={19} />
                <span>მართვა</span>
              </Link>
            )}
            <button
              className="icon-button notification-button"
              aria-label="შეტყობინებები"
              onClick={() => {
                setNotifications(!notifications);
                if (!notifications) notices.refetch();
              }}
            >
              <Bell size={20} />
              {noticeCount > 0 && <span className="notification-dot" />}
            </button>
            <span className="header-divider" />
            <button
              className="viewer-button"
              onClick={() => setSelector(true)}
              aria-label="თანამშრომლის განრიგის არჩევა"
            >
              <Avatar name={selected?.name ?? "ტიფლისი"} size="small" />
              <span className="viewer-name">
                {selected?.name ?? "თანამშრომელი"}
              </span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main className="main-content">
          {children}
          <footer className="page-footer">
            <span>ტიფლისი · გუნდის სივრცე</span>
            <span>მონაცემები განახლებულია Supabase-დან</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="მთავარი ნავიგაცია">
        {nav.map(item => (
          <Link
            key={item.path}
            href={item.path}
            className={
              location === item.path ||
              (item.path === "/schedule" && location === "/swap")
                ? "active"
                : ""
            }
          >
            <item.icon size={21} />
            <span>{item.label}</span>
          </Link>
        ))}
        {auth.user?.role === "admin" && (
          <Link
            href={adminNav.path}
            className={location === adminNav.path ? "active" : ""}
            aria-label="ადმინისტრაცია"
          >
            <adminNav.icon size={21} />
            <span>{adminNav.label}</span>
          </Link>
        )}
      </nav>
      {notifications && (
        <div className="popover notification-popover">
          <div className="popover-heading">
            <b>შეტყობინებები</b>
            <button
              className="icon-button"
              onClick={() => setNotifications(false)}
              aria-label="დახურვა"
            >
              <X size={17} />
            </button>
          </div>
          {auth.user ? <PhoneNotifications userId={auth.user.id} /> : null}
          {!auth.user ? (
            <p>შეტყობინების სანახავად შედი ანგარიშში.</p>
          ) : noticeListCount === 0 ? (
            <p>ახალი შეტყობინება არ არის.</p>
          ) : (
            <div className="notice-list">
              {review.map(item => (
                <div key={`review-${item.id}`} className="notice-item">
                  <b>
                    {item.requester_name} → {item.target_name}
                  </b>
                  <span>
                    მოთხოვნა · დადასტურება გელოდება ·{" "}
                    <GeorgianDate date={item.own_date} short /> ·{" "}
                    {prettyTime(item.own_time)}
                  </span>
                  <div className="notice-actions">
                    <button
                      type="button"
                      className="notice-confirm"
                      disabled={deciding}
                      onClick={() =>
                        reviewRequest.mutate({
                          id: item.id,
                          status: "approved",
                        })
                      }
                    >
                      <Check size={14} /> დადასტურება
                    </button>
                    <button
                      type="button"
                      className="notice-decline"
                      disabled={deciding}
                      onClick={() =>
                        reviewRequest.mutate({
                          id: item.id,
                          status: "rejected",
                        })
                      }
                    >
                      უარყოფა
                    </button>
                  </div>
                </div>
              ))}
              {incoming.map(item => (
                <Link
                  key={`in-${item.id}`}
                  href="/profile"
                  className="notice-item"
                  onClick={() => setNotifications(false)}
                >
                  <b>{item.requester_name} გთხოვს ჩანაცვლებას</b>
                  <span>
                    მოთხოვნა · მის ნაცვლად გამოსვლა ·{" "}
                    <GeorgianDate date={item.own_date} short /> ·{" "}
                    {prettyTime(item.own_time)}
                  </span>
                  <small>გახსენი პროფილი დასადასტურებლად</small>
                </Link>
              ))}
              {posted.map(item => (
                <Link
                  key={`announcement-${item.id}`}
                  href="/"
                  className="notice-item"
                  onClick={() => {
                    if (userId) {
                      const next = markNoticesSeen(
                        readNoticeMemory(userId),
                        [item.id],
                        []
                      );
                      if (next) {
                        writeNoticeMemory(userId, next);
                        setMemory(next);
                        window.dispatchEvent(new Event(NOTICE_MEMORY_EVENT));
                      }
                    }
                    setNotifications(false);
                  }}
                >
                  <b>{item.title}</b>
                  <span>
                    {item.isPinned
                      ? "მნიშვნელოვანი განცხადება"
                      : item.kind === "urgent"
                        ? "სასწრაფო განცხადება"
                        : item.kind === "schedule"
                          ? "განრიგის განცხადება"
                          : item.kind === "event"
                            ? "ღონისძიება"
                            : "განცხადება"}
                    {" · "}
                    {new Date(item.publishedAt).toLocaleDateString("ka-GE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <small>
                    {item.body.replace(/\s+/g, " ").trim().slice(0, 90)}
                    {item.body.trim().length > 90 ? "…" : ""}
                  </small>
                </Link>
              ))}
              {answers.map(item => (
                <Link
                  key={`out-${item.id}`}
                  href="/profile"
                  className="notice-item"
                  onClick={() => setNotifications(false)}
                >
                  <b>
                    {item.status === "approved"
                      ? `${item.target_name} დამტკიცდა შენს ნაცვლად`
                      : "ჩანაცვლება უარყოფილია"}
                  </b>
                  <span>
                    მოთხოვნა · <GeorgianDate date={item.own_date} short /> ·{" "}
                    {prettyTime(item.own_time)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      {selector && (
        <div className="modal-backdrop" onClick={() => setSelector(false)}>
          <div className="select-modal" onClick={e => e.stopPropagation()}>
            <div className="popover-heading">
              <div>
                <span className="eyebrow">განრიგის ნახვა</span>
                <h2>აირჩიე თანამშრომელი</h2>
              </div>
              <button
                className="icon-button"
                aria-label="დახურვა"
                onClick={() => setSelector(false)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="muted">
              არჩევანი მხოლოდ განრიგის ხედს ცვლის და არ ანიჭებს სხვისი სახელით
              მოთხოვნის გაგზავნის უფლებას.
            </p>
            <div className="staff-picker">
              {staff.map(s => (
                <button
                  key={s.id}
                  className={selected?.id === s.id ? "chosen" : ""}
                  onClick={() => {
                    selectStaff(s.id);
                    setSelector(false);
                  }}
                >
                  <Avatar name={s.name} />
                  <div>
                    <b>{s.name}</b>
                    <small>{s.role}</small>
                  </div>
                  {selected?.id === s.id && <Check size={17} />}
                </button>
              ))}
            </div>
            {!auth.user && (
              <a className="secondary-button full-width" href={getLoginHref()}>
                <LogIn size={17} /> ანგარიშში შესვლა
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
