import { SUPABASE_URL } from "./supabase";

// Publishable key: safe to publish, never a service-role credential.
const AUTH_KEY = "sb_publishable_WredFIhLOOAUfUCp3XZ6Ig_cd8sWthQ";
export type SupabaseIdentity = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean;
  user_metadata?: Record<string, unknown>;
};
export class AuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
function authMessage(code: string, status: number) {
  if (code === "email_not_confirmed")
    return "ჯერ დაადასტურე ელფოსტა მიღებულ წერილში.";
  if (code === "invalid_credentials") return "ელფოსტა ან პაროლი არასწორია.";
  if (code === "user_already_exists" || code === "email_exists")
    return "ამ ელფოსტით ანგარიში უკვე არსებობს. გამოიყენე შესვლა ან პაროლის აღდგენა.";
  if (code === "weak_password")
    return "პაროლი არასაკმარისად ძლიერია. გამოიყენე სულ მცირე 8 სიმბოლო.";
  if (code === "email_address_not_authorized")
    return "Supabase-ის ელფოსტის სერვისი ამ მისამართზე წერილს არ აგზავნის. მენეჯერმა უნდა დააკონფიგურიროს SMTP.";
  if (code === "email_address_invalid") return "შეიყვანე სწორი ელფოსტა.";
  if (status === 429 || code.includes("rate_limit"))
    return "მოთხოვნების ლიმიტი ამოიწურა. ცოტა ხანში ხელახლა სცადე.";
  if (code === "otp_expired")
    return "დადასტურების ბმული ვადაგასულია ან უკვე გამოყენებულია. მოითხოვე ახალი წერილი.";
  if (code === "signup_disabled")
    return "რეგისტრაცია ამჟამად გათიშულია. დაუკავშირდი მენეჯერს.";
  return "ავტორიზაცია ვერ შესრულდა. გადაამოწმე მონაცემები ან ხელახლა სცადე.";
}
export async function authRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Promise<T> {
  let response: globalThis.Response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: options.method ?? "POST",
      headers: {
        apikey: AUTH_KEY,
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AuthError(
      503,
      "Supabase Auth-სთან კავშირი დროებით ვერ შესრულდა. ხელახლა სცადე."
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new AuthError(
      response.status >= 500 ? 503 : response.status === 429 ? 429 : 400,
      authMessage(String(data.error_code ?? data.code ?? ""), response.status)
    );
  return data as T;
}
export function requireConfirmedIdentity(user: SupabaseIdentity) {
  if (
    !user ||
    !/^[0-9a-f-]{36}$/i.test(user.id) ||
    !user.email ||
    !user.email_confirmed_at ||
    user.is_anonymous
  ) {
    throw new AuthError(
      403,
      "ელფოსტის დადასტურება აუცილებელია. შეამოწმე მიღებული წერილი."
    );
  }
  return user;
}
export async function verifiedIdentity(accessToken: string) {
  const user = await authRequest<SupabaseIdentity>("user", {
    method: "GET",
    token: accessToken,
  });
  return requireConfirmedIdentity(user);
}
