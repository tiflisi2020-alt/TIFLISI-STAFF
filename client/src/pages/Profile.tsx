import { useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Link2,
  LogIn,
  LogOut,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useStaff } from "@/contexts/StaffContext";
import { trpc } from "@/lib/trpc";
import { getLoginHref } from "@/const";
import {
  departmentLabels,
  isWorking,
  prettyTime,
  type DepartmentId,
} from "@shared/schedule";
import {
  Avatar,
  EmptyState,
  GeorgianDate,
  PageHeading,
} from "@/components/staff/Shared";

const statuses: Record<string, string> = {
  pending: "განხილვის მოლოდინში",
  approved: "დადასტურებული",
  rejected: "უარყოფილი",
  cancelled: "გაუქმებული",
};
export default function Profile() {
  const { auth, selected, myStaff, staff, account, weekQuery } = useStaff();
  const utils = trpc.useUtils();
  const requests = trpc.staff.requests.useQuery(undefined, {
    enabled: !!auth.user,
    retry: false,
  });
  const incoming = trpc.staff.incoming.useQuery(undefined, {
    enabled: !!auth.user,
    retry: false,
  });
  const accounts = trpc.staff.accounts.useQuery(undefined, {
    enabled: auth.user?.role === "admin",
    retry: false,
  });
  const [accountId, setAccountId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const person = myStaff ?? selected;
  const shifts = (weekQuery.data ?? []).filter(
    s =>
      s.name === person?.name &&
      s.department === person?.department &&
      isWorking(s.time)
  );
  const cancel = trpc.staff.cancelSwap.useMutation({
    onSuccess: async () => {
      toast.success("მოთხოვნა გაუქმდა.");
      await utils.staff.requests.invalidate();
      await utils.staff.notices.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const respond = trpc.staff.respondSwap.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.status === "approved"
          ? "დაადასტურე. ეს ცვლა ახლა შენია, კოლეგა კი ისვენებს."
          : "მოთხოვნა უარყოფილია."
      );
      await Promise.all([
        utils.staff.incoming.invalidate(),
        utils.staff.notices.invalidate(),
        utils.staff.requests.invalidate(),
        utils.staff.shifts.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const link = trpc.staff.linkAccount.useMutation({
    onSuccess: async () => {
      toast.success("ანგარიში თანამშრომელთან დაკავშირებულია.");
      await Promise.all([
        utils.staff.accounts.invalidate(),
        utils.staff.account.invalidate(),
        utils.auth.me.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const connect = () => {
    const s = staff.find(s => s.id === employeeId);
    const id = Number(accountId || auth.user?.id);
    if (s && id)
      link.mutate({
        accountId: id,
        department: s.department as DepartmentId,
        staffId: s.id,
      });
  };
  return (
    <>
      <PageHeading
        eyebrow="შენი სივრცე"
        title="ჩემი პროფილი"
        description="ანგარიში, სამუშაო ინფორმაცია და ცვლების გაცვლის მოთხოვნები."
        action={
          auth.user ? (
            <button
              className="secondary-button"
              onClick={() =>
                auth.logout().catch(() => toast.error("გამოსვლა ვერ შესრულდა."))
              }
            >
              <LogOut size={16} /> გამოსვლა
            </button>
          ) : undefined
        }
      />
      {!auth.user && (
        <section className="login-panel">
          <div className="login-icon">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2>შედი შენს სამუშაო სივრცეში</h2>
            <p>
              გაცვლის მოთხოვნის გასაგზავნად საჭიროა ავტორიზაცია და მენეჯერის
              მიერ თანამშრომელთან დაკავშირებული ანგარიში.
            </p>
          </div>
          <a className="primary-button" href={getLoginHref()}>
            <LogIn size={17} /> ანგარიშში შესვლა
          </a>
        </section>
      )}
      {auth.user && !myStaff && (
        <div className="info-banner">
          <Link2 size={20} />
          <div>
            <b>ანგარიში ჯერ არ არის დაკავშირებული თანამშრომელთან</b>
            <p>
              {auth.user.role === "admin"
                ? "ქვემოთ აირჩიე თანამშრომელი და დაუკავშირე შენს ან გუნდის წევრის ანგარიშს."
                : "მენეჯერმა შენი ანგარიში შესაბამის თანამშრომელს უნდა დაუკავშიროს. მანამდე განრიგის ნახვა შეგიძლია."}
            </p>
          </div>
        </div>
      )}
      <div className="profile-grid">
        <section className="profile-card">
          <div className="profile-cover" />
          <Avatar
            name={
              myStaff?.name ?? auth.user?.name ?? selected?.name ?? "ტიფლისი"
            }
            size="large"
          />
          <h2>
            {myStaff?.name ??
              auth.user?.name ??
              selected?.name ??
              "თანამშრომელი"}
          </h2>
          <p>
            {myStaff?.role ??
              (auth.user
                ? auth.user.role === "admin"
                  ? "მენეჯერი"
                  : "თანამშრომლის ანგარიში"
                : selected?.role)}
          </p>
          <span className="tag">
            <CheckCircle2 size={13} />{" "}
            {auth.user ? "ავტორიზებული ანგარიში" : "ნახვის რეჟიმი"}
          </span>
          <dl>
            <div>
              <dt>რესტორანი</dt>
              <dd>ტიფლისი</dd>
            </div>
            <div>
              <dt>დეპარტამენტი</dt>
              <dd>
                {myStaff
                  ? departmentLabels[myStaff.department]
                  : auth.user
                    ? "დაკავშირება საჭიროა"
                    : (departmentLabels[selected?.department ?? ""] ?? "—")}
              </dd>
            </div>
            {auth.user?.email && (
              <div>
                <dt>ელფოსტა</dt>
                <dd>{auth.user.email}</dd>
              </div>
            )}
          </dl>
        </section>
        <section className="profile-work">
          <div className="section-title">
            <h2>სამუშაო ინფორმაცია</h2>
            <UserRound size={19} />
          </div>
          <p className="muted">{person?.name} · არჩეული კვირა</p>
          <div className="work-stat">
            <span className="stat-icon">
              <CalendarDays size={21} />
            </span>
            <div>
              <b>{shifts.length} ცვლა</b>
              <span>კვირის დაგეგმილი ცვლები</span>
            </div>
          </div>
          <div className="work-stat">
            <span className="stat-icon">
              <Clock3 size={21} />
            </span>
            <div>
              <b>{new Set(shifts.map(s => s.date)).size} სამუშაო დღე</b>
              <span>არსებული განრიგის მიხედვით</span>
            </div>
          </div>
          <Link href="/schedule" className="secondary-button full-width">
            განრიგის ნახვა
          </Link>
        </section>
      </div>
      {auth.user?.role === "admin" && (
        <Link href="/admin" className="primary-button admin-profile-link">
          <ShieldCheck size={17} /> ადმინისტრაციის სამართავი გვერდი
        </Link>
      )}
      {auth.user?.role === "admin" && (
        <section className="manager-panel">
          <div className="section-title">
            <h2>
              <ShieldCheck size={20} /> ანგარიშების დაკავშირება
            </h2>
            <span className="tag">მენეჯერი</span>
          </div>
          <p className="muted">
            შესული თანამშრომლის ანგარიში დაუკავშირე რეალურ ჩანაწერს. თითო
            თანამშრომელი მხოლოდ ერთ ანგარიშს უკავშირდება.
          </p>
          <div className="manager-form">
            <label>
              ანგარიში
              <select
                value={accountId || String(auth.user.id)}
                onChange={e => setAccountId(e.target.value)}
              >
                {(
                  accounts.data ?? [
                    {
                      id: auth.user.id,
                      name: auth.user.name,
                      email: auth.user.email,
                      staff_name: myStaff?.name,
                    },
                  ]
                ).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.email || `ანგარიში #${a.id}`}
                    {a.staff_name ? ` · ${a.staff_name}` : " · დასაკავშირებელი"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              თანამშრომელი
              <select
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
              >
                <option value="">აირჩიე თანამშრომელი</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary-button"
              disabled={!employeeId || link.isPending}
              onClick={connect}
            >
              <Link2 size={16} />
              {link.isPending ? "ინახება…" : "დაკავშირება"}
            </button>
          </div>
          {accounts.isError && (
            <p className="form-error">ანგარიშების სია ვერ ჩაიტვირთა.</p>
          )}
        </section>
      )}
      {!!auth.user && (
        <section className="requests-panel">
          <div className="section-title">
            <h2>დადასტურება</h2>
            <span className="tag">შენ გთხოვენ</span>
          </div>
          {incoming.isLoading ? (
            <div className="loading-card" />
          ) : incoming.isError ? (
            <div className="error-banner">
              მოთხოვნები ვერ ჩაიტვირთა.{" "}
              <button onClick={() => incoming.refetch()}>ხელახლა ცდა</button>
            </div>
          ) : incoming.data?.length ? (
            <div className="request-list">
              {incoming.data.map(r => (
                <article className="request-row" key={r.id}>
                  <div>
                    <b>
                      {r.requester_name} გთხოვს, გამახვიდე ნაცვლად
                    </b>
                    <p>
                      <GeorgianDate date={r.own_date} /> ·{" "}
                      {prettyTime(r.own_time)}
                    </p>
                    <small>{r.reason}</small>
                  </div>
                  <div className="request-actions">
                    <button
                      className="primary-button"
                      onClick={() =>
                        respond.mutate({ id: r.id, status: "approved" })
                      }
                      disabled={respond.isPending}
                    >
                      <Check size={15} /> ვადასტურებ
                    </button>
                    <button
                      className="secondary-button reject-button"
                      onClick={() =>
                        respond.mutate({ id: r.id, status: "rejected" })
                      }
                      disabled={respond.isPending}
                    >
                      <X size={15} /> უარს ვამბობ
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="დასადასტურებელი არაფერია"
              description="როცა კოლეგა შენს ნაცვლად გამოსვლას გთხოვს, ღილაკები აქ და ზარის შეტყობინებაში გამოჩნდება."
            />
          )}
        </section>
      )}
      <section className="requests-panel">
        <div className="section-title">
          <h2>ჩემი გაცვლის მოთხოვნები</h2>
          <Link href="/swap" className="text-link">
            ახალი მოთხოვნა
          </Link>
        </div>
        {requests.isLoading && auth.user ? (
          <div className="loading-card" />
        ) : requests.isError ? (
          <div className="error-banner">
            მოთხოვნები ვერ ჩაიტვირთა.{" "}
            <button onClick={() => requests.refetch()}>ხელახლა ცდა</button>
          </div>
        ) : requests.data?.length ? (
          <div className="request-list">
            {requests.data.map(r => (
              <article className="request-row" key={r.id}>
                <div>
                  <b>
                    <GeorgianDate date={r.own_date} /> ·{" "}
                    {prettyTime(r.own_time)}
                  </b>
                  <p>{r.target_name} გამოვა ნაცვლად</p>
                  <small>{r.reason}</small>
                </div>
                <div className="request-actions">
                  <span className={`request-status status-${r.status}`}>
                    {statuses[r.status]}
                  </span>
                  {r.status === "pending" && (
                    <button
                      className="request-cancel"
                      onClick={() => cancel.mutate({ id: r.id })}
                      disabled={cancel.isPending}
                    >
                      გაუქმება
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="მოთხოვნები ჯერ არ არის"
            description={
              auth.user
                ? "გაგზავნილი მოთხოვნა და მისი სტატუსი აქ გამოჩნდება."
                : "შედი ანგარიშში, რომ შენი მოთხოვნები ნახო."
            }
          />
        )}
      </section>
    </>
  );
}
