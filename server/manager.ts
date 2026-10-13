// Explicitly selected by the restaurant owner. Only trusted OAuth identity data
// may be compared to this value; no client-supplied email can grant privileges.
export const MANAGER_EMAIL = "merabtamoevi@gmail.com";
export function isManagerIdentity(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === MANAGER_EMAIL;
}
