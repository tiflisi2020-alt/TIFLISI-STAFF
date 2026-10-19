import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  CalendarDays,
  Check,
  UserRoundPlus,
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
  addDays,
  dateKey,
  departmentLabels,
  isWorking,
  mondayOf,
  prettyTime,
  restaurantToday,
  type DepartmentId,
} from "@shared/schedule";
import {
  EmptyState,
  GeorgianDate,
  PageHeading,
} from "@/components/staff/Shared";
import { getLoginHref } from "@/const";
import { EmployeeManager } from "@/components/staff/EmployeeManager";

type Department = DepartmentId;
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
  const [tab, setTab] = useState<
    "schedule" | "employees" | "requests" | "accounts"
  >("schedule");
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
  const weekStart = mondayOf(new Date(`${date}T12:00:00`));
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index)
  );
  const weekKeys = weekDays.map(dateKey);
  const shifts = trpc.staff.shifts.useQuery(
    { from: weekKeys[0], to: weekKeys[6] },
    { enabled: !!isAdmin, retry: false }
  );
  const current = shifts.data?.find(
    s =>
      s.name === person?.name &&
      s.department === department &&
      s.date === date
  );
  const moveWeek = (delta: number) =>
    setDate(dateKey(addDays(new Date(`${date}T12:00:00`), delta * 7)));
  const timeChoices = [
    "OFF",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
  ];
  if (!timeChoices.includes(time)) timeChoices.unshift(time);
  const requests = trpc.admin.requests.useQuery(
    { status, page },
    { enabled: !!isAdmin, retry: false }
  );
  const accounts = trpc.staff.accounts.useQuery(undefined, {
    enabled: !!isAdmin,
    retry: false,
  });
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      requested === "schedule" ||
      requested === "employees" ||
      requested === "requests" ||
      requested === "accounts"
    )
      setTab(requested);
  }, []);
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
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.status === "approved"
          ? "კოლეგა ცვლაზე ჩაჯდა, მომთხოვნი კი დაისვენებს."
          : "მოთხოვნა უარყოფილია."
      );
      await Promise.all([
        utils.admin.requests.invalidate(),
        utils.staff.requests.invalidate(),
        utils.staff.shifts.invalidate(),
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
        <a className="primary-button" href={getLoginHref()}>
          <LogIn size={17} /> ანგარიშში შესვლა
        </a>
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
  const shiftFor = (name: string, key: string) =>
    shifts.data?.find(
      item =>
        item.name === name &&
        item.department === department &&
        item.date === key
    );
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
        description="აირჩიე საქმე და გააკეთე ცვლილება რამდენიმე მარტივი ნაბიჯით."
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
      <div className="admin-quick-actions" aria-label="სწრაფი მოქმედებები">
        <button
          type="button"
          className="admin-quick-action"
          onClick={() => setTab("schedule")}
        >
          <CalendarDays size={20} />
          <span>
            <b>განრიგის შეცვლა</b>
            <small>აირჩიე თანამშრომელი და დღე</small>
          </span>
        </button>
        <button
          type="button"
          className="admin-quick-action"
          onClick={() => setTab("employees")}
        >
          <UserRoundPlus size={20} />
          <span>
            <b>თანამშრომლის დამატება</b>
            <small>მართე გუნდის წევრები</small>
          </span>
        </button>
        <button
          type="button"
          className={`admin-quick-action${requests.data?.length ? " has-alert" : ""}`}
          onClick={() => setTab("requests")}
        >
          <Check size={20} />
          <span>
            <b>მოთხოვნების ნახვა</b>
            <small>{requests.data?.length ? `${requests.data.length} ელოდება პასუხს` : "ყველაფერი მოწესრიგებულია"}</small>
          </span>
        </button>
      </div>
      <div className="admin-tabs">
        <button
          className={tab === "schedule" ? "active" : ""}
          onClick={() => setTab("schedule")}
        >
          <CalendarDays size={16} /> განრიგი
        </button>
        <button
          className={tab === "employees" ? "active" : ""}
          onClick={() => setTab("employees")}
        >
          <UserRoundPlus size={16} /> თანამშრომლები
        </button>
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          <Check size={16} /> მოთხოვნები
          {status === "pending" &&
            page === 0 &&
            !!requests.data?.length &&
            ` · ${Math.min(requests.data.length, 20)}`}
        </button>
        <button
          className={tab === "accounts" ? "active" : ""}
          onClick={() => setTab("accounts")}
        >
          <Link2 size={16} /> ანგარიშები
        </button>
      </div>
      {tab !== "requests" &&
        status === "pending" &&
        page === 0 &&
        !!requests.data?.length && (
          <div className="info-banner confirm-banner">
            <Check size={19} />
            <div>
              <b>ჩანაცვლება ელოდება დადასტურებას</b>
              <p>
                ღილაკი აქვე, ჩანართ „დადასტურებაშია“. დამტკიცების შემდეგ
                ისვენებს კოლეგა ცვლაზე ჩაჯდება.
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => setTab("requests")}
            >
              დადასტურება
            </button>
          </div>
        )}
      {tab === "schedule" && (
        <section className="manager-panel">
          <div className="section-title">
            <h2>კვირის განრიგი</h2>
            <button
              className="text-link"
              type="button"
              onClick={() => shifts.refetch()}
            >
              <RefreshCw size={14} /> განახლება
            </button>
          </div>
          <div className="admin-help-strip">
            <b>როგორ შევცვალოთ ცვლა:</b>
            <span>1. აირჩიე დეპარტამენტი · 2. დააჭირე თანამშრომელს · 3. აირჩიე დღე · 4. შეავსე ფორმა და შეინახე</span>
          </div>
          <div className="admin-weekbar">
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
            <div className="admin-weeknav">
              <button
                type="button"
                className="icon-button"
                aria-label="წინა კვირა"
                onClick={() => moveWeek(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <div>
                <b>
                  {weekDays[0].toLocaleDateString("ka-GE", {
                    day: "numeric",
                    month: "short",
                  })}
                  {" – "}
                  {weekDays[6].toLocaleDateString("ka-GE", {
                    day: "numeric",
                    month: "short",
                  })}
                </b>
                <span>{roster.length} თანამშრომელი</span>
              </div>
              <button
                type="button"
                className="today-button"
                onClick={() => setDate(restaurantToday())}
              >
                დღეს
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="შემდეგი კვირა"
                onClick={() => moveWeek(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          {shifts.isLoading ? (
            <div className="loading-card" />
          ) : shifts.isError ? (
            <div className="error-banner">
              განრიგი ვერ ჩაიტვირთა.{" "}
              <button type="button" onClick={() => shifts.refetch()}>
                ხელახლა ცდა
              </button>
            </div>
          ) : roster.length === 0 ? (
            <EmptyState
              title="თანამშრომლები არ არის"
              description="ამ დეპარტამენტში ჯერ არავინ არის ჩაწერილი."
            />
          ) : (
            <>
            <div className="admin-phone-board">
              <div className="admin-phone-days">
                {weekDays.map(dayDate => {
                  const key = dateKey(dayDate);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`admin-phone-day${date === key ? " selected" : ""}${key === restaurantToday() ? " is-today" : ""}`}
                      aria-pressed={date === key}
                      onClick={() => setDate(key)}
                    >
                      <span>
                        {dayDate.toLocaleDateString("ka-GE", {
                          weekday: "short",
                        })}
                      </span>
                      <b>{dayDate.getDate()}</b>
                    </button>
                  );
                })}
              </div>
              <p className="admin-phone-caption">
                {new Date(`${date}T12:00:00`).toLocaleDateString("ka-GE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <div className="admin-phone-list">
                {roster.map(member => {
                  const shift = shiftFor(member.name, date);
                  const working = isWorking(shift?.time);
                  const selected = person?.id === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={`admin-phone-person${working ? " working" : ""}${selected ? " selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => setStaffId(member.id)}
                    >
                      <b>{member.name}</b>
                      <span>
                        <strong>
                          {working ? prettyTime(shift?.time ?? "") : "OFF"}
                        </strong>
                        {shift?.position ? <small>{shift.position}</small> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="admin-board-wrap">
              <table className="admin-board">
                <thead>
                  <tr>
                    <th>თანამშრომელი</th>
                    {weekDays.map(dayDate => {
                      const key = dateKey(dayDate);
                      return (
                        <th
                          key={key}
                          className={key === restaurantToday() ? "is-today" : ""}
                        >
                          {dayDate.toLocaleDateString("ka-GE", {
                            weekday: "short",
                          })}
                          <small>{dayDate.getDate()}</small>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {roster.map(member => (
                    <tr key={member.id}>
                      <th>{member.name}</th>
                      {weekKeys.map(key => {
                        const shift = shiftFor(member.name, key);
                        const working = isWorking(shift?.time);
                        const selected = person?.id === member.id && date === key;
                        return (
                          <td key={key}>
                            <button
                              type="button"
                              className={`admin-cell${working ? " working" : ""}${selected ? " selected" : ""}${key === restaurantToday() ? " today" : ""}`}
                              aria-pressed={selected}
                              aria-label={`${member.name}, ${key}, ${shift?.time ?? "OFF"}`}
                              onClick={() => {
                                setStaffId(member.id);
                                setDate(key);
                              }}
                            >
                              <strong>
                                {working ? prettyTime(shift?.time ?? "") : "OFF"}
                              </strong>
                              {shift?.position ? <small>{shift.position}</small> : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
          <form onSubmit={submit} className="admin-edit-form">
            <div className="section-title">
              <h2>
                {person
                  ? `${person.name} · ${new Date(`${date}T12:00:00`).toLocaleDateString("ka-GE", { weekday: "long", day: "numeric", month: "long" })}`
                  : "ცვლის რედაქტირება"}
              </h2>
            </div>
            <div className="admin-form-grid">
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
                  {timeChoices.map(t => (
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
                  (!shifts.data && shifts.isFetching) ||
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
      {tab === "employees" && <EmployeeManager />}
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
              <b>დამტკიცება ცვლას ისვენებს კოლეგას გადასცემს</b>
              <p>
                მომთხოვნი იმ დღეს თავისუფლდება, ნაცვლად კი ის კოლეგა გამოდის,
                რომელიც ისვენებდა. თუ კოლეგამ უკვე დაიწყო მუშაობა ან ცვლა
                შეიცვალა, მოთხოვნა მოლოდინში რჩება. უარყოფა განრიგს არ ეხება.
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
                      {r.requester_name} → {r.target_name} გამოვა ნაცვლად
                    </b>
                    <span className={`request-status status-${r.status}`}>
                      {statusLabels[r.status]}
                    </span>
                  </div>
                  <p>
                    <GeorgianDate date={r.own_date} /> ·{" "}
                    {prettyTime(r.own_time)}
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
