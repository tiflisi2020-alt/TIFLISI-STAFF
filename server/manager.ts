// Explicitly selected by the restaurant owner. Only trusted OAuth identity data
// may be compared to this value; no client-supplied email can grant privileges.
export const MANAGER_EMAIL = "merabtamoevi@gmail.com";
export const ADMIN_DEPARTMENT = "administrators";
export function isManagerIdentity(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === MANAGER_EMAIL;
}
export function isDepartmentAdmin(department: string | null | undefined) {
  return department === ADMIN_DEPARTMENT;
}
export function accountRole(
  email: string | null | undefined,
  department: string | null | undefined
): "admin" | "user" {
  return isManagerIdentity(email) || isDepartmentAdmin(department)
    ? "admin"
    : "user";
}
export function hasAdminAccess(
  user:
    | {
        email?: string | null;
        role?: string | null;
        department?: string | null;
      }
    | null
    | undefined
) {
  return (
    !!user &&
    user.role === "admin" &&
    (isManagerIdentity(user.email) || isDepartmentAdmin(user.department))
  );
}
