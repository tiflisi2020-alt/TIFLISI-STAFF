import { Link, useLocation } from "wouter";
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
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useStaff } from "@/contexts/StaffContext";
import { Avatar, GeorgianDate } from "./Shared";
import { prettyTime, restaurantDate } from "@shared/schedule";
import { getLoginHref } from "@/const";
import { trpc } from "@/lib/trpc";

const nav = [
  { path: "/", label: "მთავარი", icon: Home },
  { path: "/schedule", label: "განრიგი", icon: CalendarDays },
  { path: "/team", label: "გუნდი", icon: Users },
  { path: "/profile", label: "პროფილი", icon: UserRound },
];
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
  const [location] = useLocation();
  const { staff, selected, selectStaff, auth, roster } = useStaff();
  const [notifications, setNotifications] = useState(false);
  const [selector, setSelector] = useState(false);
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
  const weekAgo = Date.now() - 7 * 86400000;
  const review = isManager ? (notices.data?.review ?? []) : [];
  const reviewIds = new Set(review.map(item => item.id));
  const outgoing = (notices.data?.outgoing ?? []).filter(
    item =>
      !reviewIds.has(item.id) &&
      (item.status === "pending" ||
        new Date(item.created_at).getTime() >= weekAgo)
  );
  const incoming = isManager ? [] : (notices.data?.incoming ?? []);
  const noticeCount = incoming.length + review.length + outgoing.length;
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
          {!auth.user ? (
            <p>შეტყობინების სანახავად შედი ანგარიშში.</p>
          ) : noticeCount === 0 ? (
            <p>ახალი შეტყობინება არ არის.</p>
          ) : (
            <div className="notice-list">
              {review.map(item => (
                <div key={`review-${item.id}`} className="notice-item">
                  <b>
                    {item.requester_name} → {item.target_name}
                  </b>
                  <span>
                    დადასტურება გელოდება ·{" "}
                    <GeorgianDate date={item.own_date} short /> ·{" "}
                    {prettyTime(item.own_time)}
                  </span>
                  <div className="notice-actions">
                    <button
                      type="button"
                      className="notice-confirm"
                      disabled={deciding}
                      onClick={() =>
                        reviewRequest.mutate({ id: item.id, status: "approved" })
                      }
                    >
                      <Check size={14} /> დადასტურება
                    </button>
                    <button
                      type="button"
                      className="notice-decline"
                      disabled={deciding}
                      onClick={() =>
                        reviewRequest.mutate({ id: item.id, status: "rejected" })
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
                    მის ნაცვლად გამოსვლა ·{" "}
                    <GeorgianDate date={item.own_date} short /> ·{" "}
                    {prettyTime(item.own_time)}
                  </span>
                  <small>გახსენი პროფილი დასადასტურებლად</small>
                </Link>
              ))}
              {outgoing.map(item => (
                <Link
                  key={`out-${item.id}`}
                  href="/profile"
                  className="notice-item"
                  onClick={() => setNotifications(false)}
                >
                  <b>
                    {item.status === "approved"
                      ? `${item.target_name} დამტკიცდა შენს ნაცვლად`
                      : item.status === "rejected"
                        ? "ჩანაცვლება უარყოფილია"
                        : `${item.target_name} ელოდება დამტკიცებას`}
                  </b>
                  <span>
                    <GeorgianDate date={item.own_date} short /> ·{" "}
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
