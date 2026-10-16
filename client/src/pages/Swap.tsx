import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Info,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useStaff } from "@/contexts/StaffContext";
import { trpc } from "@/lib/trpc";
import { isWorking, prettyTime, type Shift } from "@shared/schedule";
import { Avatar, GeorgianDate, PageHeading } from "@/components/staff/Shared";

export default function Swap() {
  const { auth, selected, myStaff, staff, upcoming, today } = useStaff();
  const utils = trpc.useUtils();
  const [ownId, setOwnId] = useState("");
  const [coverId, setCoverId] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const person = myStaff ?? selected;
  const departmentShifts = (upcoming.data ?? []).filter(
    shift => shift.date >= today && shift.department === person?.department
  );
  const ownOptions = departmentShifts.filter(
    shift => shift.name === person?.name && isWorking(shift.time)
  );
  const own = ownOptions.find(shift => shift.id === ownId);
  const covers = staff.filter(
    colleague =>
      colleague.department === person?.department &&
      colleague.name !== person?.name &&
      !departmentShifts.some(
        shift =>
          shift.name === colleague.name &&
          shift.date === own?.date &&
          isWorking(shift.time)
      )
  );
  const cover = covers.find(colleague => colleague.id === coverId);
  const coverShift = departmentShifts.find(
    shift => shift.name === cover?.name && shift.date === own?.date
  );
  const shiftLabel = (shift: Shift) => {
    const when = new Date(`${shift.date}T12:00:00`).toLocaleDateString(
      "ka-GE",
      { weekday: "short", day: "numeric", month: "short" }
    );
    return `${when} · ${prettyTime(shift.time)}`;
  };
  useEffect(() => {
    const initialDate = new URLSearchParams(window.location.search).get("date");
    const first = ownOptions.find(s => s.date === initialDate) ?? ownOptions[0];
    if (first && !ownOptions.some(s => s.id === ownId)) setOwnId(first.id);
  }, [upcoming.data, person?.id]);
  const mutation = trpc.staff.createSwap.useMutation({
    onSuccess: () => {
      setSent(true);
      utils.staff.requests.invalidate();
      toast.success("მოთხოვნა წარმატებით გაიგზავნა.");
    },
    onError: error => toast.error(error.message),
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user || !myStaff)
      return toast.error("მოთხოვნისთვის საჭიროა დაკავშირებული ანგარიში.");
    if (!own || !cover) return toast.error("აირჩიე შენი ცვლა და კოლეგა.");
    if (reason.trim().length < 10)
      return toast.error("მიზეზი მინიმუმ 10 სიმბოლოს უნდა შეიცავდეს.");
    mutation.mutate({
      department: myStaff.department as
        | "waiters"
        | "chefs"
        | "cleaners"
        | "cashiers"
        | "hostesses",
      own: { name: own.name, date: own.date, time: own.time },
      target: {
        name: cover.name,
        date: own.date,
        time: coverShift && !isWorking(coverShift.time) ? coverShift.time : "OFF",
      },
      reason: reason.trim(),
    });
  }
  return (
    <>
      <Link href="/schedule" className="back-link">
        <ArrowLeft size={16} /> განრიგზე დაბრუნება
      </Link>
      <PageHeading
        eyebrow="მოქნილი სამუშაო რიტმი"
        title="ცვლის ჩანაცვლება"
        description="ვინც მუშაობს, სთხოვს იმ კოლეგას, რომელიც იმ დღეს ისვენებს, რომ მის ნაცვლად გამოვიდეს."
      />
      {sent ? (
        <div className="success-panel">
          <CheckCircle2 size={52} />
          <h2>მოთხოვნა გაგზავნილია</h2>
          <p>
            მოთხოვნა განხილვის მოლოდინშია. სანამ მენეჯერი არ დაამტკიცებს, შენ
            კვლავ ამ ცვლაზე ხარ.
          </p>
          <Link href="/profile" className="primary-button">
            ჩემი მოთხოვნების ნახვა
          </Link>
          <button
            className="text-link"
            onClick={() => {
              setSent(false);
              setCoverId("");
              setReason("");
            }}
          >
            ახალი მოთხოვნა
          </button>
        </div>
      ) : (
        <div className="swap-layout">
          <form className="swap-form" onSubmit={submit}>
            {(!auth.user || !myStaff) && (
              <div className="info-banner">
                <Info size={19} />
                <div>
                  <b>
                    {auth.user
                      ? "ანგარიშის დაკავშირება საჭიროა"
                      : "შედი ანგარიშში"}
                  </b>
                  <p>
                    ფორმის ნახვა შეგიძლია, თუმცა გაგზავნისთვის საჭიროა
                    თანამშრომელთან დაკავშირებული ანგარიში.{" "}
                    <Link href="/profile">პროფილის ნახვა</Link>
                  </p>
                </div>
              </div>
            )}
            <label>
              შენი სამუშაო დღე{" "}
              <select
                value={ownId}
                onChange={e => {
                  setOwnId(e.target.value);
                  setCoverId("");
                }}
                required
              >
                <option value="">აირჩიე შენი ცვლა</option>
                {ownOptions.map(s => (
                  <option value={s.id} key={s.id}>
                    {shiftLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="swap-preview own-preview">
              <span className="eyebrow">შენ მუშაობ</span>
              {own ? (
                <>
                  <div className="swap-preview-person">
                    <Avatar name={own.name} size="small" />
                    <div>
                      <b>{own.name}</b>
                      <span>
                        <GeorgianDate date={own.date} />
                      </span>
                    </div>
                  </div>
                  <h3>{prettyTime(own.time)}</h3>
                </>
              ) : (
                <p className="muted">ჯერ აირჩიე ცვლა</p>
              )}
            </div>
            <div className="swap-direction">
              <ArrowLeftRight size={19} />
            </div>
            <label>
              ვინ გამოვიდეს შენს ნაცვლად?{" "}
              <select
                value={coverId}
                onChange={e => setCoverId(e.target.value)}
                required
                disabled={!own}
              >
                <option value="">
                  {own ? "აირჩიე კოლეგა, რომელიც ისვენებს" : "ჯერ აირჩიე შენი ცვლა"}
                </option>
                {own &&
                  covers.map(colleague => (
                    <option value={colleague.id} key={colleague.id}>
                      {colleague.name} · ისვენებს
                    </option>
                  ))}
              </select>
            </label>
            <div className="swap-preview target-preview">
              <span className="eyebrow">შენს ნაცვლად</span>
              {cover && own ? (
                <>
                  <div className="swap-preview-person">
                    <Avatar name={cover.name} size="small" />
                    <div>
                      <b>{cover.name}</b>
                      <span>
                        <GeorgianDate date={own.date} /> · ისვენებს
                      </span>
                    </div>
                  </div>
                  <h3>{prettyTime(own.time)}</h3>
                </>
              ) : (
                <p className="muted">ჯერ აირჩიე კოლეგა</p>
              )}
            </div>
            {own && cover && (
              <div className="swap-result">
                <b>დამტკიცების შემდეგ</b>
                <p>
                  {cover.name} გამოვა შენს ნაცვლად, {prettyTime(own.time)}-ზე.
                  შენ ამ დღეს დაისვენებ.
                </p>
              </div>
            )}
            <label>
              მიზეზი <span className="optional-label">მინ. 10 სიმბოლო</span>
              <textarea
                placeholder="მოკლედ აღწერე, რატომ გჭირდება ჩანაცვლება…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                minLength={10}
                maxLength={200}
                required
                rows={4}
              />
            </label>
            <div className="character-counter">{reason.length} / 200</div>
            {upcoming.isError && (
              <p className="form-error">
                ცვლები ვერ ჩაიტვირთა.{" "}
                <button type="button" onClick={() => upcoming.refetch()}>
                  განახლება
                </button>
              </p>
            )}
            {!upcoming.isLoading && !ownOptions.length && (
              <p className="form-error">
                მომდევნო ოთხ კვირაში შენი ცვლა არ არის დაგეგმილი.
              </p>
            )}
            {own && !covers.length && (
              <p className="form-error">
                ამ დღეს ყველა კოლეგა უკვე მუშაობს, ამიტომ ჩანაცვლება ვერ მოხდება.
              </p>
            )}
            <button
              className="primary-button full-width"
              type="submit"
              disabled={
                !auth.user ||
                !myStaff ||
                !own ||
                !cover ||
                reason.trim().length < 10 ||
                mutation.isPending
              }
            >
              <Send size={17} />
              {mutation.isPending
                ? "მოთხოვნა იგზავნება…"
                : "მოთხოვნის გაგზავნა"}
            </button>
            <p className="form-footnote">
              მოთხოვნა განრიგს მაშინვე არ ცვლის. დამტკიცების შემდეგ კოლეგა
              გამოდის შენს ნაცვლად.
            </p>
          </form>
          <aside className="swap-guide">
            <span className="guide-icon">
              <ArrowLeftRight size={26} />
            </span>
            <h2>როგორ მუშაობს ჩანაცვლება?</h2>
            <div>
              <span>01</span>
              <p>
                <b>აირჩიე შენი სამუშაო დღე</b>მხოლოდ მომავალი ცვლა, რომელზეც შენ
                მუშაობ.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <b>აირჩიე ისვენებს კოლეგა</b>იმავე დეპარტამენტიდან, ვისაც ამ
                დღეს ცვლა არ აქვს.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <b>მენეჯერი ამტკიცებს</b>კოლეგა შენს ცვლას იღებს, შენ კი იმ დღეს
                ისვენებ.
              </p>
            </div>
            <div className="guide-note">
              <Info size={17} />
              <p>
                სანამ მოთხოვნა მოლოდინშია, განრიგი უცვლელია. უარყოფის ან
                გაუქმების შემდეგ შენ კვლავ შენს ცვლაზე რჩები.
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
