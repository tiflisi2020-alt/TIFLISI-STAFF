import { describe, expect, it, vi } from "vitest";
import { readLocalStorage, writeLocalStorage } from "./safeStorage";

describe("safe browser storage", () => {
  it("reads values from available storage", () => {
    const getStorage = () => ({
      getItem: (key: string) => (key === "staff" ? "waiters:1" : null),
      setItem: () => undefined,
    });

    expect(readLocalStorage("staff", getStorage)).toBe("waiters:1");
    expect(readLocalStorage("missing", getStorage)).toBeNull();
  });

  it("returns null when the browser denies storage access", () => {
    expect(
      readLocalStorage("staff", () => {
        throw new DOMException("Blocked", "SecurityError");
      })
    ).toBeNull();
  });

  it("keeps application flows running when storage writes are denied", () => {
    const deniedStorage = () => ({
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    const write = () => writeLocalStorage("staff", "waiters:1", deniedStorage);

    expect(write).not.toThrow();
  });

  it("writes values when storage is available", () => {
    const setItem = vi.fn();
    const getStorage = () => ({ getItem: () => null, setItem });

    writeLocalStorage("staff", "waiters:1", getStorage);

    expect(setItem).toHaveBeenCalledWith("staff", "waiters:1");
  });
});
