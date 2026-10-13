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
import { useStaff } from "@/contexts/StaffContext";
import { Avatar } from "./Shared";
import { restaurantDate } from "@shared/schedule";
import { startLogin } from "@/const";

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
            რესტორანი ტიფლისი <span>/</span> <b>თანამშრომლების განრიგი</b>
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
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={20} />
              {auth.user && <span className="notification-dot" />}
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
          <p>გაცვლის მოთხოვნების სტატუსები პროფილში გამოჩნდება.</p>
          <Link
            href="/profile"
            onClick={() => setNotifications(false)}
            className="text-link"
          >
            პროფილის ნახვა <ArrowUpRight size={14} />
          </Link>
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
              <button
                className="secondary-button full-width"
                onClick={() => startLogin()}
              >
                <LogIn size={17} /> ანგარიშში შესვლა
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
