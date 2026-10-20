function Pins({
  count,
  className,
  itemClass,
}: {
  count: number;
  className: string;
  itemClass: string;
}) {
  return (
    <div className={className} role="status" aria-label="იტვირთება">
      {Array.from({ length: count }, (_, index) => (
        <div className={`pin ${itemClass}`} key={index} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="pin-hero-copy" role="status" aria-label="იტვირთება">
      <span className="pin pin-on-dark pin-line pin-w-40" />
      <span className="pin pin-on-dark pin-line pin-h-lg pin-w-70" />
      <span className="pin pin-on-dark pin-line pin-w-50" />
    </div>
  );
}

export function StatSkeleton() {
  return <Pins count={3} className="stats-row" itemClass="pin-stat" />;
}

export function WeekSkeleton() {
  return <Pins count={7} className="pin-days" itemClass="pin-day" />;
}

export function RowSkeleton({ count = 3 }: { count?: number }) {
  return <Pins count={count} className="pin-list" itemClass="pin-list-row" />;
}

export function CardSkeleton({
  count = 3,
  className = "pin-grid",
  itemClass = "pin-card",
}: {
  count?: number;
  className?: string;
  itemClass?: string;
}) {
  return <Pins count={count} className={className} itemClass={itemClass} />;
}

export function TeamSkeleton() {
  return <CardSkeleton count={6} className="team-grid" itemClass="pin-card" />;
}

export function ShiftSkeleton() {
  return <CardSkeleton count={2} className="shift-grid" itemClass="pin-shift" />;
}

export function AdminSkeleton() {
  return (
    <div className="pin-admin" role="status" aria-label="იტვირთება">
      <span className="pin pin-line pin-w-30" />
      <span className="pin pin-line pin-h-lg pin-w-55" />
      <div className="pin-tabs">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="pin pin-tab" key={index} />
        ))}
      </div>
      <RowSkeleton count={6} />
    </div>
  );
}

export function PreviewSkeleton() {
  return (
    <div className="pin-preview" role="status" aria-label="იტვირთება">
      <span className="pin pin-line pin-w-40" />
      <span className="pin pin-line pin-h-lg pin-w-55" />
    </div>
  );
}
