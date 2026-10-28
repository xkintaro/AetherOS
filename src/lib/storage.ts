import type { StateStorage } from "zustand/middleware";

export const STORAGE_ERROR_EVENT = "aetheros-storage-error";

/** Storage failure must not interrupt an action after its in-memory update. */
export function resilientStorage(
  storage: StateStorage,
  onError: () => void,
): StateStorage {
  let reported = false;
  return {
    getItem: (name) => storage.getItem(name),
    removeItem: (name) => storage.removeItem(name),
    setItem(name, value) {
      try {
        storage.setItem(name, value);
        reported = false;
      } catch {
        if (!reported) {
          reported = true;
          // Notifications can update the store; avoid reentering persistence.
          queueMicrotask(onError);
        }
      }
    },
  };
}
