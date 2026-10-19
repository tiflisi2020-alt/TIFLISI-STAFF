import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { PageHeading } from "@/components/staff/Shared";

type Mode = "login" | "signup" | "recover" | "reset";
async function authPost(action: string, body: unknown) {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "სერვერთან კავშირი ვერ შესრულდა. ხელახლა სცადე." }));
  if (!response.ok) throw new Error(data.error ?? "მოთხოვნა ვერ შესრულდა.");
  return data as { success?: boolean; message?: string; role?: string };
}
export default function Login() {
  const [incoming] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return {
      token: hash.get("access_token") ?? "",
      type: hash.get("type") ?? "",
      error: hash.get("error_description") ?? "",
    };
  });
  const isResetPath = window.location.pathname === "/reset-password";
  const [mode, setMode] = useState<Mode>(
    isResetPath && incoming.token && incoming.type === "recovery"
      ? "reset"
      : isResetPath
        ? "recover"
        : "login"
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState(null, "", window.location.pathname);
    if (isResetPath) {
      if (incoming.error || !incoming.token || incoming.type !== "recovery") {
        setMode("recover");
        if (incoming.error) {
          setError("ბმული ვადაგასულია ან არასწორია. მოითხოვე ახალი წერილი.");
        }
        if (!incoming.token || incoming.type !== "recovery") {
          setMessage(
            "პაროლის შეცვლას მოქმედი აღდგენის ბმული სჭირდება. მოითხოვე ახალი წერილი."
          );
        }
      } else {
        setMode("reset");
      }
      if (!incoming.token || incoming.type !== "recovery") {
        setMode("recover");
      }
      return;
    }
    if (incoming.token) {
      setBusy(true);
      authPost("exchange", { accessToken: incoming.token })
        .then(data =>
          window.location.replace(data.role === "admin" ? "/admin" : "/profile")
        )
        .catch(e =>
          setError(
            e instanceof Error ? e.message : "ბმულის დამუშავება ვერ შესრულდა."
          )
        )
        .finally(() => setBusy(false));
    }
  }, [incoming, isResetPath]);

  function choose(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
    setShowPassword(false);
    setPassword("");
    setConfirmation("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if ((mode === "signup" || mode === "reset") && password !== confirmation) {
      setError("პაროლები არ ემთხვევა.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const data = await authPost("login", { email, password });
        setPassword("");
        window.location.replace(data.role === "admin" ? "/admin" : "/profile");
      } else if (mode === "signup") {
        const data = await authPost("signup", { email, password, name });
        setMessage(data.message ?? "შეამოწმე დადასტურების წერილი.");
        setPassword("");
        setConfirmation("");
        setMode("login");
      } else if (mode === "recover") {
        const data = await authPost("recover", { email });
        setMessage(data.message ?? "შეამოწმე ელფოსტა.");
      } else {
        const data = await authPost("password", {
          accessToken: incoming.token,
          password,
        });
        setMessage(data.message ?? "პაროლი განახლებულია.");
        setMode("login");
        window.history.replaceState(null, "", "/login");
        setPassword("");
        setConfirmation("");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "კავშირი ვერ შესრულდა. ხელახლა სცადე."
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!email) {
      setError("ჯერ შეიყვანე შენი ელფოსტა.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await authPost("resend", { email });
      setMessage(data.message ?? "შეამოწმე ელფოსტა.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "წერილი ვერ გაიგზავნა.");
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "signup"
      ? "შექმენი ანგარიში"
      : mode === "recover"
        ? "პაროლის აღდგენა"
        : mode === "reset"
          ? "ახალი პაროლი"
          : "ანგარიშში შესვლა";
  const description =
    mode === "signup"
      ? "შექმენი თანამშრომლის ანგარიში ელფოსტის დადასტურებით."
      : mode === "recover"
        ? "ელფოსტაზე გამოგიგზავნით პაროლის აღდგენის ბმულს."
        : mode === "reset"
          ? "მიუთითე ახალი პაროლი მოქმედი აღდგენის ბმულით."
          : "უსაფრთხოდ შედი ტიფლისის გუნდის სივრცეში.";
  return (
    <>
      <PageHeading
        eyebrow="შენი სამუშაო სივრცე"
        title={title}
        description={description}
      />
      <section className="auth-card">
        <div className="auth-emblem">
          <ShieldCheck size={30} />
        </div>
        <h2>{title}</h2>
        <p className="muted">
          {mode === "signup"
            ? "ანგარიშის გააქტიურებას ელფოსტის დადასტურება სჭირდება."
            : mode === "recover"
              ? "ელფოსტაზე გამოგიგზავნით პაროლის აღდგენის ბმულს."
              : mode === "reset"
                ? "მიუთითე ახალი პაროლი. მას მხოლოდ Supabase Auth ინახავს."
                : "შეიყვანე შენი ანგარიშის ელფოსტა და პაროლი."}
        </p>
        {(mode === "login" || mode === "signup") && (
          <div
            className="auth-tabs"
            role="group"
            aria-label="შესვლა ან რეგისტრაცია"
          >
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              disabled={busy}
              onClick={() => choose("login")}
            >
              შესვლა
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              disabled={busy}
              onClick={() => choose("signup")}
            >
              რეგისტრაცია
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner auth-alert" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="info-banner auth-alert" role="status">
            {message}
          </div>
        )}
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              სახელი და გვარი
              <input
                required
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              ელფოსტა
              <div className="auth-input">
                <Mail size={18} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@example.com"
                  maxLength={254}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
            </label>
          )}
          {mode !== "recover" && (
            <label>
              {mode === "reset" ? "ახალი პაროლი" : "პაროლი"}
              <div className="auth-input">
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={mode === "login" ? 1 : 8}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? "პაროლის დამალვა" : "პაროლის ჩვენება"
                  }
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}
          {(mode === "signup" || mode === "reset") && (
            <label>
              გაიმეორე პაროლი
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmation}
                onChange={e => setConfirmation(e.target.value)}
                disabled={busy}
              />
              <small>
                სულ მცირე 8 სიმბოლო. გამოიყენე უნიკალური ძლიერი პაროლი.
              </small>
            </label>
          )}
          <button
            className="primary-button full-width"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "მუშავდება…"
              : mode === "signup"
                ? "ანგარიშის შექმნა"
                : mode === "recover"
                  ? "აღდგენის წერილის გაგზავნა"
                  : mode === "reset"
                    ? "ახალი პაროლის შენახვა"
                    : "შესვლა"}
          </button>
        </form>
        <div className="auth-actions">
          {mode === "login" && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose("recover")}
              >
                პაროლი დაგავიწყდა?
              </button>
              <button type="button" disabled={busy} onClick={resend}>
                დადასტურების წერილის ხელახლა გაგზავნა
              </button>
            </>
          )}
          {(mode === "recover" || mode === "reset") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => choose("login")}
            >
              <ArrowLeft size={14} /> შესვლაზე დაბრუნება
            </button>
          )}
        </div>
        <p className="auth-footnote">
          დაცულია Supabase Auth-ით. პაროლი არ შეინახება ბრაუზერში ან ტიფლისის
          მონაცემთა ცხრილებში.
        </p>
        <Link href="/schedule" className="text-link">
          განრიგის ნახვა შესვლის გარეშე
        </Link>
      </section>
    </>
  );
}
