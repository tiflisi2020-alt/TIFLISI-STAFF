import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Link2,
  LogIn,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useStaff } from "@/contexts/StaffContext";
import {
  departmentLabels,
  prettyTime,
  restaurantToday,
} from "@shared/schedule";
import {
  EmptyState,
  GeorgianDate,
  PageHeading,
} from "@/components/staff/Shared";
import { startLogin } from "@/const";

type Department = "waiters" | "chefs" | "cleaners" | "cashiers" | "hostesses";
type Status = "pending" | "approved" | "rejected" | "all";
const statusLabels: Record<string, string> = {
  pending: "მოლოდინში",
  approved: "დამტკიცებული",
  rejected: "უარყოფილი",
  cancelled: "გაუქმებული",
};

export default function Admin() {
  const { auth, staff } = useStaff();
  const utils = trpc.useUtils();
  const isAdmin = auth.user?.role === "admin";
  const [tab, setTab] = useState<"schedule" | "requests" | "accounts">(
    "schedule"
  );
  const [department, setDepartment] = useState<Department>("waiters");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(restaurantToday());
  const [time, setTime] = useState("OFF");
  const [position, setPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [linkedStaff, setLinkedStaff] = useState("");
  const roster = staff.filter(s => s.department === department);
  const person = roster.find(s => s.id === staffId) ?? roster[0];
  const shifts = trpc.staff.shifts.useQuery(
    { from: date, to: date },
    { enabled: !!isAdmin && !!date, retry: false }
  );
  const current = shifts.data?.find(
    s => s.name === person?.name && s.department === department
  );
  const requests = trpc.admin.requests.useQuery(
    { status, page },
    { enabled: !!isAdmin, retry: false }
  );
  const accounts = trpc.staff.accounts.useQuery(undefined, {
    enabled: !!isAdmin,
    retry: false,
  });
  useEffect(() => {
    setTime(current?.time ?? "OFF");
    setPosition(current?.position ?? "");
    setNotes(current?.notes ?? "");
  }, [
    current?.id,
    current?.time,
    current?.position,
    current?.notes,
    person?.id,
    date,
  ]);
  const save = trpc.admin.updateShift.useMutation({
    onSuccess: async () => {
      toast.success("ცვლა Supabase-ში შეინახა.");
      await Promise.all([
        utils.staff.shifts.invalidate(),
        utils.admin.requests.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message),
  });
  const review = trpc.admin.reviewRequest.useMutation({
    onSuccess: async () => {
      toast.success("მოთხოვნის სტატუსი განახლდა.");
      await Promise.all([
        utils.admin.requests.invalidate(),
        utils.staff.requests.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message),
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
    onError: e => toast.error(e.message),
  });
  if (auth.loading) return <div className="loading-card" />;
  if (!auth.user)
    return (
      <section className="success-panel">
        <ShieldCheck size={42} />
        <h2>ადმინისტრატორის შესვლა</h2>
        <p>
          სამართავი გვერდი ხელმისაწვდომია მხოლოდ მენეჯერისთვის. შედი
          merabtamoevi@gmail.com ანგარიშით.
        </p>
        <button className="primary-button" onClick={() => startLogin()}>
          <LogIn size={17} /> ანგარიშში შესვლა
        </button>
      </section>
    );
  if (!isAdmin)
    return (
      <section className="success-panel">
        <ShieldCheck size={42} />
        <h2>წვდომა შეზღუდულია</h2>
        <p>
          შენი ანგარიში არ არის ადმინისტრატორი. სამართავი გვერდი სხვა
          თანამშრომლებისთვის დახურულია.
        </p>
        <Link href="/profile" className="secondary-button">
          პროფილზე დაბრუნება
        </Link>
      </section>
    );
  const connect = () => {
    const selected = staff.find(s => s.id === linkedStaff);
    if (selected && accountId)
      link.mutate({
        accountId: Number(accountId),
        department: selected.department as Department,
        staffId: selected.id,
      });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!person || !shifts.data || shifts.isError) return;
    save.mutate({
      department,
      staffId: person.id,
      date,
      time,
      position,
      notes,
      expected: current
        ? {
            time: current.time,
            position: current.position,
            notes: current.notes,
          }
        : null,
    });
  };
  return (
    <>
      <PageHeading
        eyebrow="რესტორანის მართვა"
        title="ადმინისტრაცია"
        description="განრიგი, გაცვლის მოთხოვნები და ანგარიშების დაკავშირება."
        action={
          <span className="admin-access">
            <ShieldCheck size={17} /> ადმინისტრატორის წვდომა
          </span>
        }
      />
      <div className="info-banner">
        <ShieldCheck size={19} />
        <div>
          <b>{auth.user.email}</b>
          <p>
            სრული სამართავი წვდომა აქტიურია. ცვლილება მხოლოდ შესაბამისი შენახვის
            ღილაკის დაჭერის შემდეგ აისახება რეალურ Supabase ბაზაში.
          </p>
        </div>
      </div>
      <div className="admin-tabs">
        <button
          className={tab === "schedule" ? "active" : ""}
          onClick={() => setTab("schedule")}
        >
          <CalendarDays size={16} /> განრიგის მართვა
        </button>
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          <Check size={16} /> გაცვლის მოთხოვნები
        </button>
        <button
          className={tab === "accounts" ? "active" : ""}
          onClick={() => setTab("accounts")}
        >
          <Link2 size={16} /> ანგარიშები
        </button>
      </div>
      {tab === "schedule" && (
        <section className="manager-panel">
          <div className="section-title">
            <h2>ცვლის დამატება / რედაქტირება</h2>
            <button className="text-link" onClick={() => shifts.refetch()}>
              <RefreshCw size={14} /> განახლება
            </button>
          </div>
          <form onSubmit={submit} className="admin-edit-form">
            <div className="admin-form-grid">
              <label>
                დეპარტამენტი
                <select
                  value={department}
                  onChange={e => {
                    setDepartment(e.target.value as Department);
                    setStaffId("");
                  }}
                >
                  {Object.entries(departmentLabels).map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                თანამშრომელი
                <select
                  value={person?.id ?? ""}
                  onChange={e => setStaffId(e.target.value)}
                >
                  {roster.map(s => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                თარიღი
                <input
                  type="date"
                  value={date}
                  onChange={e => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                  required
                />
              </label>
              <label>
                დაწყების დრო
                <select value={time} onChange={e => setTime(e.target.value)}>
                  {[
                    ...new Set([
                      "OFF",
                      "9:00",
                      "10:00",
                      "14:00",
                      "15:00",
                      "18:00",
                      time,
                    ]),
                  ].map(t => (
                    <option value={t} key={t}>
                      {t === "OFF" ? "OFF — ცვლის გარეშე" : prettyTime(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                პოზიცია
                <input
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="მაგ. A, H, V"
                  maxLength={100}
                />
              </label>
              <label>
                სხვა დაწყების საათი
                <input
                  type="time"
                  value={time === "OFF" ? "" : time.padStart(5, "0")}
                  onChange={e => {
                    if (e.target.value) setTime(e.target.value);
                  }}
                />
              </label>
            </div>
            <label>
              შენიშვნა
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="ცვლის დამატებითი ინფორმაცია"
              />
            </label>
            <div className="admin-save-row">
              <span className="muted">
                {shifts.isLoading
                  ? "ცვლა იტვირთება…"
                  : current
                    ? "არსებული ჩანაწერი რედაქტირდება"
                    : "ამ დღეს ჩანაწერი ჯერ არ არის; შეიქმნება ახალი ცვლა."}
              </span>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  save.isPending ||
                  shifts.isFetching ||
                  shifts.isError ||
                  !person
                }
              >
                <Save size={16} />
                {save.isPending ? "ინახება…" : "ცვლის შენახვა"}
              </button>
            </div>
            {shifts.isError && (
              <p className="form-error">
                ცვლა ვერ ჩაიტვირთა. შენახვა უსაფრთხოებისთვის გამორთულია.
              </p>
            )}
          </form>
          <div className="info-strip">
            <CalendarDays size={16} />
            <p>
              მონაცემები რეალურ განრიგში იცვლება. დასრულების დრო არ არის
              გამოგონილი; OFF ნიშნავს ცვლის გარეშე დღეს.
            </p>
          </div>
        </section>
      )}
      {tab === "requests" && (
        <section className="requests-panel">
          <div className="section-title">
            <h2>გაცვლის მოთხოვნები</h2>
            <select
              className="plain-select"
              value={status}
              onChange={e => {
                setStatus(e.target.value as Status);
                setPage(0);
              }}
            >
              {["pending", "approved", "rejected", "all"].map(s => (
                <option key={s} value={s}>
                  {s === "all" ? "ყველა სტატუსი" : statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="info-banner">
            <div>
              <b>დამტკიცება მხოლოდ მოთხოვნის სტატუსს ცვლის</b>
              <p>
                ცვლები ავტომატურად არ იცვლება. შეთანხმებული ცვლილებები შეიტანე
                „განრიგის მართვის“ ფორმაში ორივე თანამშრომლისთვის.
              </p>
            </div>
          </div>
          {requests.isLoading ? (
            <div className="loading-card" />
          ) : requests.isError ? (
            <div className="error-banner">
              მოთხოვნები ვერ ჩაიტვირთა.{" "}
              <button onClick={() => requests.refetch()}>ხელახლა ცდა</button>
            </div>
          ) : requests.data?.length ? (
            <div>
              {requests.data.slice(0, 20).map(r => (
                <article className="admin-request" key={r.id}>
                  <div className="admin-request-top">
                    <b>
                      {r.requester_name} → {r.target_name}
                    </b>
                    <span className={`request-status status-${r.status}`}>
                      {statusLabels[r.status]}
                    </span>
                  </div>
                  <p>
                    <GeorgianDate date={r.own_date} /> ·{" "}
                    {prettyTime(r.own_time)} ⇄{" "}
                    <GeorgianDate date={r.target_date} /> ·{" "}
                    {prettyTime(r.target_time)}
                  </p>
                  <p className="muted">{r.reason}</p>
                  {r.status === "pending" && (
                    <div className="admin-request-actions">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          review.mutate({ id: r.id, status: "approved" })
                        }
                        disabled={review.isPending}
                      >
                        <Check size={15} /> დამტკიცება
                      </button>
                      <button
                        className="secondary-button reject-button"
                        onClick={() =>
                          review.mutate({ id: r.id, status: "rejected" })
                        }
                        disabled={review.isPending}
                      >
                        <X size={15} /> უარყოფა
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="მოთხოვნები არ არის"
              description="არჩეული სტატუსით მოთხოვნა ჯერ არ არის გაგზავნილი."
            />
          )}
          <div className="admin-pagination">
            <button
              className="secondary-button"
              disabled={page === 0 || requests.isFetching}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} /> წინა
            </button>
            <span>გვერდი {page + 1}</span>
            <button
              className="secondary-button"
              disabled={
                (requests.data?.length ?? 0) <= 20 || requests.isFetching
              }
              onClick={() => setPage(page + 1)}
            >
              შემდეგი <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}
      {tab === "accounts" && (
        <section className="manager-panel">
          <div className="section-title">
            <h2>ანგარიშების დაკავშირება</h2>
            <span>{accounts.data?.length ?? 0} ანგარიში</span>
          </div>
          <p className="muted">
            მომხმარებელი ჯერ უნდა შევიდეს აპლიკაციაში. ამის შემდეგ მისი ანგარიში
            აქ გამოჩნდება და რეალურ თანამშრომელთან დაკავშირებას შეძლებ.
          </p>
          <div className="manager-form">
            <label>
              ანგარიში
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
              >
                <option value="">აირჩიე ანგარიში</option>
                {accounts.data?.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.email ?? a.name ?? `#${a.id}`}
                    {a.staff_name ? ` · ${a.staff_name}` : " · დასაკავშირებელი"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              თანამშრომელი
              <select
                value={linkedStaff}
                onChange={e => setLinkedStaff(e.target.value)}
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
              disabled={!accountId || !linkedStaff || link.isPending}
              onClick={connect}
            >
              <Link2 size={16} />
              {link.isPending ? "ინახება…" : "დაკავშირება"}
            </button>
          </div>
          {accounts.isError && (
            <div className="error-banner">
              ანგარიშები ვერ ჩაიტვირთა.{" "}
              <button onClick={() => accounts.refetch()}>ხელახლა ცდა</button>
            </div>
          )}
          <div className="admin-account-list">
            {accounts.data?.map(a => (
              <div key={a.id}>
                <span>
                  <b>{a.name ?? "თანამშრომელი"}</b>
                  <small>{a.email}</small>
                </span>
                <span className="muted">
                  {a.staff_name ?? "ჯერ არ არის დაკავშირებული"}
                </span>
                <span className="tag">
                  {a.role === "admin" ? "ადმინისტრატორი" : "თანამშრომელი"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
