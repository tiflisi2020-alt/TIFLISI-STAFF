import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  ImagePlus,
  Info,
  Link2,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useStaff } from "@/contexts/StaffContext";
import { trpc } from "@/lib/trpc";
import { getLoginHref } from "@/const";
import {
  addDays,
  dateKey,
  departmentLabels,
  isWorking,
  prettyTime,
  shiftHours,
  type DepartmentId,
} from "@shared/schedule";
import {
  Avatar,
  EmptyState,
  GeorgianDate,
  PageHeading,
} from "@/components/staff/Shared";
import {
  RowSkeleton,
  StatSkeleton,
  WeekSkeleton,
} from "@/components/staff/Skeletons";

const statuses: Record<string, string> = {
  pending: "განხილვის მოლოდინში",
  approved: "დადასტურებული",
  rejected: "უარყოფილი",
  cancelled: "გაუქმებული",
};

function getDepartmentLabel(department?: string) {
  return department && department in departmentLabels
    ? departmentLabels[department as DepartmentId]
    : "—";
}

async function compressAvatar(file: File) {
  const source = await createImageBitmap(file);
  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ფოტოს დამუშავება ვერ შესრულდა.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, "image/webp", 0.72)
  );
  if (!blob) throw new Error("ფოტოს შეკუმშვა ვერ შესრულდა.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return { base64: btoa(binary), size: blob.size };
}

export default function Profile() {
  const {
    auth,
    selected,
    myStaff,
    staff,
    account,
    week,
    weekQuery,
    upcoming,
    today,
    selectDate,
  } = useStaff();
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
  const profile = trpc.staff.profile.useQuery(undefined, {
    enabled: !!auth.user,
    retry: false,
  });
  const privateProfile = auth.user ? profile.data : undefined;
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  useEffect(() => {
    if (!privateProfile) return;
    setPreferredName(privateProfile.preferredName);
    setPhone(privateProfile.phone);
    setBio(privateProfile.bio);
    setEmergencyContact(privateProfile.emergencyContact);
  }, [privateProfile]);
  const [accountId, setAccountId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [tab, setTab] = useState<
    "overview" | "stats" | "personal" | "swaps" | "accounts"
  >("overview");
  const person = myStaff ?? selected;
  const pendingIncoming = incoming.data?.length ?? 0;
  useEffect(() => {
    if (tab === "personal" && !auth.user) setTab("overview");
    if (tab === "accounts" && auth.user?.role !== "admin") setTab("overview");
  }, [tab, auth.user]);
  const personShift = (s: { name: string; department: string; time: string }) =>
    s.name === person?.name &&
    s.department === person?.department &&
    isWorking(s.time);
  const shifts = (weekQuery.data ?? []).filter(personShift);
  const upcomingShifts = (upcoming.data ?? [])
    .filter(personShift)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const weekHours = shifts.reduce(
    (sum, s) => sum + (shiftHours(s.time) ?? 0),
    0
  );
  const upcomingHours = upcomingShifts.reduce(
    (sum, s) => sum + (shiftHours(s.time) ?? 0),
    0
  );
  const activeDays = new Set(shifts.map(s => s.date)).size;
  const upcomingDays = new Set(upcomingShifts.map(s => s.date)).size;
  const nextShift = upcomingShifts[0];
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const weekLabel = `${week.toLocaleDateString("ka-GE", {
    day: "numeric",
    month: "short",
  })} – ${addDays(week, 6).toLocaleDateString("ka-GE", {
    day: "numeric",
    month: "short",
  })}`;
  const formatHours = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(1);
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
  const saveProfile = trpc.staff.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("პროფილის ინფორმაცია შენახულია.");
      await profile.refetch();
    },
    onError: error => toast.error(error.message),
  });
  const uploadAvatar = trpc.staff.uploadAvatar.useMutation({
    onSuccess: async () => {
      toast.success("პროფილის ფოტო განახლდა.");
      await Promise.all([profile.refetch(), utils.staff.roster.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const deleteAvatar = trpc.staff.deleteAvatar.useMutation({
    onSuccess: async () => {
      toast.success("პროფილის ფოტო წაიშალა.");
      await Promise.all([profile.refetch(), utils.staff.roster.invalidate()]);
    },
    onError: error => toast.error(error.message),
  });
  const avatarInput = useRef<HTMLInputElement>(null);
  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("აირჩიე JPG, PNG ან WebP ფოტო.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ფოტო უნდა იყოს 5 MB-ზე ნაკლები.");
      return;
    }
    try {
      const compressed = await compressAvatar(file);
      if (compressed.size > 1.5 * 1024 * 1024) {
        toast.error("ფოტოს შემცირებული ზომაც ზედმეტად დიდია.");
        return;
      }
      uploadAvatar.mutate({
        mimeType: "image/webp",
        base64: compressed.base64,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ფოტოს დამუშავება ვერ შესრულდა.");
    }
  };
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
        title={myStaff ? "ჩემი პროფილი" : "პროფილი"}
        description={
          myStaff
            ? "ანგარიში, სამუშაო ინფორმაცია და ცვლების გაცვლის მოთხოვნები."
            : "არჩეული თანამშრომლის სამუშაო ინფორმაცია და განრიგი."
        }
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
      {auth.user && profile.isLoading && <RowSkeleton count={2} />}
      {auth.user && profile.isError && (
        <div className="error-banner" role="alert">
          პროფილის მონაცემები ვერ ჩაიტვირთა.{" "}
          <button type="button" onClick={() => profile.refetch()}>
            ხელახლა ცდა
          </button>
        </div>
      )}
      <div className="profile-tabs" role="tablist" aria-label="პროფილის სექციები">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          <UserRound size={16} /> პროფილი
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stats"}
          className={tab === "stats" ? "active" : ""}
          onClick={() => setTab("stats")}
        >
          <ChartNoAxesColumn size={16} /> მუშაობის სტატისტიკა
        </button>
        {auth.user && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "personal"}
            className={tab === "personal" ? "active" : ""}
            onClick={() => setTab("personal")}
          >
            <ImagePlus size={16} /> პირადი
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "swaps"}
          className={tab === "swaps" ? "active" : ""}
          onClick={() => setTab("swaps")}
        >
          <ArrowLeftRight size={16} /> გაცვლები
          {pendingIncoming > 0 ? ` · ${pendingIncoming}` : ""}
        </button>
        {auth.user?.role === "admin" && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "accounts"}
            className={tab === "accounts" ? "active" : ""}
            onClick={() => setTab("accounts")}
          >
            <Link2 size={16} /> ანგარიშები
          </button>
        )}
      </div>
      <div className="profile-stack">
        {tab === "overview" && (
          <>
            <section className="profile-section profile-identity">
              <div className="profile-cover" />
              <div className="profile-identity-body">
                <Avatar
                  name={
                    privateProfile?.preferredName ||
                    myStaff?.name ||
                    auth.user?.name ||
                    selected?.name ||
                    "ტიფლისი"
                  }
                  src={privateProfile?.avatarUrl}
                  size="large"
                />
                {auth.user && (
                  <div className="profile-avatar-actions">
                    <input
                      ref={avatarInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={selectAvatar}
                      hidden
                    />
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={uploadAvatar.isPending || deleteAvatar.isPending}
                      onClick={() => avatarInput.current?.click()}
                    >
                      <ImagePlus size={15} />
                      {uploadAvatar.isPending ? "იტვირთება…" : "ფოტოს ატვირთვა"}
                    </button>
                    {privateProfile?.avatarUrl && (
                      <button
                        className="text-link"
                        type="button"
                        disabled={
                          uploadAvatar.isPending || deleteAvatar.isPending
                        }
                        onClick={() => deleteAvatar.mutate()}
                      >
                        <Trash2 size={14} /> წაშლა
                      </button>
                    )}
                    <small>ავტომატურად მცირდება 512px-მდე · მაქს. 1.5 MB</small>
                  </div>
                )}
                <h2>
                  {privateProfile?.preferredName ||
                    myStaff?.name ||
                    auth.user?.name ||
                    selected?.name ||
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
              </div>
            </section>

            <section className="profile-section">
              <div className="section-title">
                <h2>ანგარიშის ინფორმაცია</h2>
                <UserRound size={19} />
              </div>
              <dl className="profile-details">
                <div>
                  <dt>რესტორანი</dt>
                  <dd>ტიფლისი</dd>
                </div>
                <div>
                  <dt>დეპარტამენტი</dt>
                  <dd>
                    {myStaff
                      ? getDepartmentLabel(myStaff.department)
                      : auth.user
                        ? "დაკავშირება საჭიროა"
                        : getDepartmentLabel(selected?.department)}
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

          </>
        )}

        {tab === "stats" && (
          <div className="profile-stats-dashboard">
            <div className="dashboard-top">
              <section className="hero-shift">
                <div className="hero-top">
                  <span>
                    <span className="hero-dot" />
                    {person?.name ? `${person.name} · უახლოესი ცვლა` : "უახლოესი ცვლა"}
                  </span>
                  <span className="hero-badge">
                    {nextShift ? (
                      <GeorgianDate date={nextShift.date} />
                    ) : (
                      "განრიგი"
                    )}
                  </span>
                </div>
                {upcoming.isLoading ? (
                  <p className="hero-empty-description">იტვირთება…</p>
                ) : nextShift ? (
                  <>
                    <h2>{prettyTime(nextShift.time)}</h2>
                    <div className="hero-location">
                      <MapPin size={17} /> რესტორანი ტიფლისი
                      {nextShift.position
                        ? ` · პოზიცია ${nextShift.position}`
                        : ""}
                      {shiftHours(nextShift.time) != null
                        ? ` · ${formatHours(shiftHours(nextShift.time)!)} სთ`
                        : ""}
                    </div>
                    <div className="hero-bottom">
                      <div className="coworkers">
                        <span>
                          {getDepartmentLabel(nextShift.department)} ·{" "}
                          {person?.role ?? "თანამშრომელი"}
                        </span>
                      </div>
                      <Link href="/schedule" onClick={() => selectDate(nextShift.date)}>
                        დეტალურად <ArrowRight size={17} />
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="hero-empty-title">ცვლა ჯერ არ არის დაგეგმილი</h2>
                    <p className="hero-empty-description">
                      შენი ახალი ცვლა აქ გამოჩნდება.
                    </p>
                    <Link href="/schedule" className="hero-empty-link">
                      განრიგის ნახვა <ArrowRight size={17} />
                    </Link>
                  </>
                )}
                <div className="hero-decoration" aria-hidden="true">
                  <CalendarDays />
                </div>
              </section>

              <section className="week-summary">
                <div className="section-title">
                  <h2>შენი კვირა</h2>
                  <span>{weekLabel}</span>
                </div>
                {weekQuery.isLoading ? (
                  <StatSkeleton />
                ) : (
                  <div className="stats-row">
                    <div className="stat-card">
                      <span className="stat-icon">
                        <CalendarDays size={19} />
                      </span>
                      <strong>
                        {weekQuery.isError ? "—" : shifts.length}
                      </strong>
                      <span>დაგეგმილი ცვლა</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">
                        <Clock3 size={19} />
                      </span>
                      <strong>
                        {weekQuery.isError ? "—" : activeDays}
                      </strong>
                      <span>სამუშაო დღე</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">
                        <Coffee size={19} />
                      </span>
                      <strong>
                        {weekQuery.isError ? "—" : 7 - activeDays}
                      </strong>
                      <span>ცვლის გარეშე</span>
                    </div>
                  </div>
                )}
                <div className="stats-row profile-stats-hours">
                  <div className="stat-card">
                    <span className="stat-icon">
                      <ChartNoAxesColumn size={19} />
                    </span>
                    <strong>
                      {weekQuery.isError ? "—" : formatHours(weekHours)}
                    </strong>
                    <span>კვირის საათები</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">
                      <CalendarDays size={19} />
                    </span>
                    <strong>
                      {upcoming.isError ? "—" : upcomingShifts.length}
                    </strong>
                    <span>ცვლა · 28 დღე</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">
                      <Clock3 size={19} />
                    </span>
                    <strong>
                      {upcoming.isError ? "—" : formatHours(upcomingHours)}
                    </strong>
                    <span>საათი · 28 დღე</span>
                  </div>
                </div>
                <div className="stat-footnote">
                  <Info size={13} /> სტატისტიკა დაგეგმილი ცვლების მიხედვით ·{" "}
                  {upcomingDays} სამუშაო დღე მომდევნო 28 დღეში
                </div>
              </section>
            </div>

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
              ) : weekQuery.isError ? (
                <div className="error-banner">
                  კვირის მიმოხილვა ვერ ჩაიტვირთა.{" "}
                  <button type="button" onClick={() => weekQuery.refetch()}>
                    ხელახლა ცდა
                  </button>
                </div>
              ) : (
                <div className="overview-days">
                  {weekDays.map(d => {
                    const key = dateKey(d);
                    const dayShifts = shifts
                      .filter(s => s.date === key)
                      .sort((a, b) =>
                        `${a.time}`.localeCompare(`${b.time}`)
                      );
                    const shift = dayShifts[0];
                    return (
                      <Link
                        href="/schedule"
                        onClick={() => selectDate(key)}
                        key={key}
                        className={`overview-day ${key === today ? "today" : ""} ${shift ? "working" : ""}`}
                      >
                        <div>
                          <span>
                            {d.toLocaleDateString("ka-GE", {
                              weekday: "short",
                            })}
                          </span>
                          {key === today && (
                            <span className="today-chip">დღეს</span>
                          )}
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
                  <Link href="/schedule" className="text-link">
                    ყველა <ArrowRight size={14} />
                  </Link>
                </div>
                {upcoming.isError ? (
                  <EmptyState
                    title="განრიგი ვერ ჩაიტვირთა"
                    description="ხელახლა ცადე მონაცემების ჩატვირთვა."
                  />
                ) : upcoming.isLoading ? (
                  <RowSkeleton />
                ) : upcomingShifts.length ? (
                  upcomingShifts.slice(0, 5).map(shift => (
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
                            : "რესტორანი ტიფლისი"}
                          {shiftHours(shift.time) != null
                            ? ` · ${formatHours(shiftHours(shift.time)!)} სთ`
                            : ""}
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

              <section className="profile-section profile-stats-outlook">
                <div className="section-title">
                  <div>
                    <h2>28 დღის მიმოხილვა</h2>
                    <p>მომავალი სამუშაო დატვირთვა</p>
                  </div>
                  <ChartNoAxesColumn size={19} />
                </div>
                <div className="work-stat-grid">
                  <div className="work-stat">
                    <span className="stat-icon">
                      <CalendarDays size={21} />
                    </span>
                    <div>
                      <b>{upcomingShifts.length} ცვლა</b>
                      <span>დაგეგმილი გასვლები</span>
                    </div>
                  </div>
                  <div className="work-stat">
                    <span className="stat-icon">
                      <Clock3 size={21} />
                    </span>
                    <div>
                      <b>{upcomingDays} დღე</b>
                      <span>სამუშაო დღეები</span>
                    </div>
                  </div>
                  <div className="work-stat">
                    <span className="stat-icon">
                      <ChartNoAxesColumn size={21} />
                    </span>
                    <div>
                      <b>{formatHours(upcomingHours)} სთ</b>
                      <span>სავარაუდო საათები</span>
                    </div>
                  </div>
                  <div className="work-stat">
                    <span className="stat-icon">
                      <Coffee size={21} />
                    </span>
                    <div>
                      <b>
                        {upcomingShifts.length
                          ? formatHours(upcomingHours / upcomingShifts.length)
                          : "0"}{" "}
                        სთ
                      </b>
                      <span>საშუალო ცვლაზე</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === "personal" && auth.user && (
          <section className="profile-section profile-editor">
            <div className="section-title">
              <div>
                <h2>პირადი ინფორმაცია</h2>
                <p>ეს მონაცემები მხოლოდ შენს ანგარიშში ინახება.</p>
              </div>
              <UserRound size={19} />
            </div>
            <div className="profile-editor-grid">
              <label>
                სასურველი სახელი
                <input
                  value={preferredName}
                  onChange={event => setPreferredName(event.target.value)}
                  maxLength={80}
                  placeholder="როგორ მოგმართოთ"
                />
              </label>
              <label>
                ტელეფონი
                <input
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  maxLength={40}
                  placeholder="+995 5XX XX XX XX"
                />
              </label>
              <label>
                საგანგებო კონტაქტი
                <input
                  value={emergencyContact}
                  onChange={event => setEmergencyContact(event.target.value)}
                  maxLength={120}
                  placeholder="სახელი და ნომერი"
                />
              </label>
              <label className="profile-editor-wide">
                მოკლე ბიო / დამატებითი ინფორმაცია
                <textarea
                  value={bio}
                  onChange={event => setBio(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="მაგ. გამოცდილება, ენა ან სამუშაო პრეფერენცია"
                />
              </label>
            </div>
            <div className="admin-save-row">
              <span className="muted">სავალდებულო ველი არ არის.</span>
              <button
                className="primary-button"
                type="button"
                disabled={
                  saveProfile.isPending || profile.isLoading || profile.isError
                }
                onClick={() =>
                  saveProfile.mutate({
                    preferredName,
                    phone,
                    bio,
                    emergencyContact,
                  })
                }
              >
                {saveProfile.isPending ? "ინახება…" : "პროფილის შენახვა"}
              </button>
            </div>
          </section>
        )}

        {tab === "accounts" && auth.user?.role === "admin" && (
          <section className="profile-section manager-panel">
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
                      {a.staff_name
                        ? ` · ${a.staff_name}`
                        : " · დასაკავშირებელი"}
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

        {tab === "swaps" && (
          <>
            {!!auth.user && (
              <section className="profile-section requests-panel">
                <div className="section-title">
                  <h2>დასადასტურებელი გაცვლები</h2>
                  <span className="tag">შენ გთხოვენ</span>
                </div>
                {incoming.isLoading ? (
                  <RowSkeleton count={2} />
                ) : incoming.isError ? (
                  <div className="error-banner">
                    მოთხოვნები ვერ ჩაიტვირთა.{" "}
                    <button onClick={() => incoming.refetch()}>
                      ხელახლა ცდა
                    </button>
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

            <section className="profile-section requests-panel">
              <div className="section-title">
                <h2>ჩემი გაცვლის მოთხოვნები</h2>
                <Link href="/swap" className="text-link">
                  ახალი მოთხოვნა
                </Link>
              </div>
              {requests.isLoading && auth.user ? (
                <RowSkeleton count={2} />
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
        )}
      </div>
    </>
  );
}
