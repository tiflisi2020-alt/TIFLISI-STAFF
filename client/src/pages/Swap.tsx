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
  const { auth, selected, myStaff, upcoming, today } = useStaff();
  const utils = trpc.useUtils();
  const [ownId, setOwnId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const person = myStaff ?? selected;
  const shifts = (upcoming.data ?? []).filter(
    s =>
      s.date >= today &&
      isWorking(s.time) &&
      s.department === person?.department
  );
  const ownOptions = shifts.filter(s => s.name === person?.name);
  const targets = shifts.filter(s => s.name !== person?.name);
  const own = ownOptions.find(s => s.id === ownId);
  const target = targets.find(s => s.id === targetId);
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
    if (!own || !target) return toast.error("აირჩიე ორივე ცვლა.");
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
      target: { name: target.name, date: target.date, time: target.time },
      reason: reason.trim(),
    });
  }
  function shiftPreview(shift: Shift | undefined, own: boolean) {
    return (
      <div className={`swap-preview ${own ? "own-preview" : "target-preview"}`}>
        <span className="eyebrow">{own ? "შენი ცვლა" : "სასურველი ცვლა"}</span>
        {shift ? (
          <>
            <div className="swap-preview-person">
              <Avatar name={shift.name} size="small" />
              <div>
                <b>{shift.name}</b>
                <span>
                  <GeorgianDate date={shift.date} />
                </span>
              </div>
            </div>
            <h3>{prettyTime(shift.time)}</h3>
          </>
        ) : (
          <p className="muted">ჯერ აირჩიე ცვლა</p>
        )}
      </div>
    );
  }
  return (
    <>
      <Link href="/schedule" className="back-link">
        <ArrowLeft size={16} /> განრიგზე დაბრუნება
      </Link>
      <PageHeading
        eyebrow="მოქნილი სამუშაო რიტმი"
        title="ცვლის გაცვლა"
        description="აირჩიე ცვლა, მიუთითე მიზეზი და გააგზავნე მოთხოვნა."
      />
      {sent ? (
        <div className="success-panel">
          <CheckCircle2 size={52} />
          <h2>მოთხოვნა გაგზავნილია</h2>
          <p>
            მოთხოვნა Supabase-ში შეინახა და განხილვის მოლოდინშია. განრიგი ჯერ არ
            შეცვლილა.
          </p>
          <Link href="/profile" className="primary-button">
            ჩემი მოთხოვნების ნახვა
          </Link>
          <button
            className="text-link"
            onClick={() => {
              setSent(false);
              setTargetId("");
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
              შენი ცვლა{" "}
              <select
                value={ownId}
                onChange={e => setOwnId(e.target.value)}
                required
              >
                <option value="">აირჩიე შენი ცვლა</option>
                {ownOptions.map(s => (
                  <option value={s.id} key={s.id}>
                    {s.date} · {prettyTime(s.time)}
                  </option>
                ))}
              </select>
            </label>
            {shiftPreview(own, true)}
            <div className="swap-direction">
              <ArrowLeftRight size={19} />
            </div>
            <label>
              ვისთან გსურს გაცვლა?{" "}
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                required
              >
                <option value="">აირჩიე თანამშრომელი და ცვლა</option>
                {targets.map(s => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {s.date} · {prettyTime(s.time)}
                  </option>
                ))}
              </select>
            </label>
            {shiftPreview(target, false)}
            <label>
              გაცვლის მიზეზი{" "}
              <span className="optional-label">მინ. 10 სიმბოლო</span>
              <textarea
                placeholder="მოკლედ აღწერე, რატომ გსურს ცვლის გაცვლა…"
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
            <button
              className="primary-button full-width"
              type="submit"
              disabled={
                !auth.user ||
                !myStaff ||
                !own ||
                !target ||
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
              მოთხოვნის გაგზავნა განრიგს ავტომატურად არ ცვლის.
            </p>
          </form>
          <aside className="swap-guide">
            <span className="guide-icon">
              <ArrowLeftRight size={26} />
            </span>
            <h2>როგორ მუშაობს გაცვლა?</h2>
            <div>
              <span>01</span>
              <p>
                <b>აირჩიე შენი ცვლა</b>მხოლოდ მომავალი, შენთან დაკავშირებული
                ცვლა.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <b>იპოვე სასურველი ცვლა</b>აირჩიე კოლეგა იმავე დეპარტამენტიდან.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <b>გააგზავნე მოთხოვნა</b>მოთხოვნა განხილვის მოლოდინში შეინახება.
              </p>
            </div>
            <div className="guide-note">
              <Info size={17} />
              <p>
                სტატუსის ნახვა პროფილში შეგიძლია. საბოლოო ცვლილებას მენეჯერი
                არსებულ განრიგში ასახავს.
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
