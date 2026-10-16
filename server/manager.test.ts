import { describe, expect, it } from "vitest";
import { accountRole, hasAdminAccess, isManagerIdentity } from "./manager";

describe("owner-selected manager identity", () => {
  it("accepts only the exact selected OAuth email", () => {
    expect(isManagerIdentity("merabtamoevi@gmail.com")).toBe(true);
    expect(isManagerIdentity("MERABTAMOEVI@gmail.com")).toBe(true);
    expect(isManagerIdentity("other@gmail.com")).toBe(false);
    expect(isManagerIdentity(null)).toBe(false);
    expect(isManagerIdentity("merabtamoevi@gmail.com.attacker.test")).toBe(
      false
    );
  });
  it("gives the administrators department full admin access", () => {
    expect(accountRole("chef@example.com", "administrators")).toBe("admin");
    expect(accountRole("merabtamoevi@gmail.com", "waiters")).toBe("admin");
    expect(accountRole("waiter@example.com", "waiters")).toBe("user");
    expect(
      hasAdminAccess({
        email: "chef@example.com",
        role: "admin",
        department: "administrators",
      })
    ).toBe(true);
    expect(
      hasAdminAccess({
        email: "chef@example.com",
        role: "admin",
        department: "chefs",
      })
    ).toBe(false);
    expect(
      hasAdminAccess({
        email: "chef@example.com",
        role: "user",
        department: "administrators",
      })
    ).toBe(false);
  });
});
