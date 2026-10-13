import { describe, expect, it } from "vitest";
import { isManagerIdentity } from "./manager";

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
});
