type StorageAccess = () => Pick<Storage, "getItem" | "setItem">;

const browserLocalStorage: StorageAccess = () => window.localStorage;

/** Storage is a convenience only; privacy modes and embedded browsers may deny it. */
export function readLocalStorage(
  key: string,
  getStorage: StorageAccess = browserLocalStorage
): string | null {
  try {
    return getStorage().getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(
  key: string,
  value: string,
  getStorage: StorageAccess = browserLocalStorage
): void {
  try {
    getStorage().setItem(key, value);
  } catch {
    // App rendering and core flows must not depend on optional browser storage.
  }
}
