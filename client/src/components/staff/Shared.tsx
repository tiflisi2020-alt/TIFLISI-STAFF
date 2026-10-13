import { ArrowRight, Clock3, MapPin } from "lucide-react";
import {
  prettyTime,
  shiftHours,
  type Shift,
  type Staff,
} from "@shared/schedule";

export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: "small" | "normal" | "large";
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join("");
  const color = name.length % 5;
  return (
    <span
      className={`avatar avatar-${color} avatar-${size}`}
      aria-hidden="true"
    >
      {initials || "ტ"}
    </span>
  );
}
export function GeorgianDate({
  date,
  short = false,
}: {
  date: string;
  short?: boolean;
}) {
  return (
    <>
      {new Date(`${date}T12:00:00`).toLocaleDateString("ka-GE", {
        day: "numeric",
        month: short ? "short" : "long",
      })}
    </>
  );
}
export function ShiftCard({
  shift,
  staff,
  onSwap,
  mine = false,
}: {
  shift: Shift;
  staff?: Staff;
  onSwap?: () => void;
  mine?: boolean;
}) {
  const hours = shiftHours(shift.time);
  return (
    <article className={`shift-card ${mine ? "is-mine" : ""}`}>
      <div className="shift-person">
        <Avatar name={shift.name} />
        <div>
          <strong>{shift.name}</strong>
          <span>{staff?.role ?? "თანამშრომელი"}</span>
        </div>
        {mine && <span className="tag">ჩემი ცვლა</span>}
      </div>
      <div className="shift-time">
        <h3>{prettyTime(shift.time)}</h3>
        <span>{hours !== null ? `${hours} საათი` : "დაწყების დრო"}</span>
      </div>
      <div className="shift-meta">
        <MapPin size={14} />
        <span>
          {shift.position ? `პოზიცია ${shift.position}` : "ტიფლისი"} ·{" "}
          <GeorgianDate date={shift.date} short />
        </span>
      </div>
      {shift.notes && <p className="shift-note">{shift.notes}</p>}
      {onSwap && (
        <button className="swap-card-button" onClick={onSwap}>
          <ArrowRight size={15} /> ცვლის გაცვლა
        </button>
      )}
    </article>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Clock3 size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
