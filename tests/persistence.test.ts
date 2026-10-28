import { test } from "node:test";
import assert from "node:assert/strict";
import { initialFiles } from "../src/lib/filesystem";

test("invalid saved files survive subsequent actions until a valid backup is explicitly restored", async (context) => {
  const raw = JSON.stringify({ version: 4, state: { files: null } });
  const items = new Map([["aetheros-v1", raw]]);
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
  context.mock.method(console, "error", () => {});
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  context.after(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  const { useOS } = await import("../src/lib/store");
  await Promise.resolve();
  useOS.getState().openApp("files");
  useOS.getState().createFile("documents", "Temporary.txt", "text");
  assert.equal(items.get("aetheros-v1"), raw);
  assert.ok(
    useOS
      .getState()
      .notices.some(
        (notice) => notice.title === "Workspace could not be restored",
      ),
  );
  assert.equal(
    useOS.getState().importBackup({ version: 3, files: initialFiles }),
    true,
  );
  const saved = JSON.parse(items.get("aetheros-v1")!);
  assert.equal(saved.state.files.length, initialFiles.length);
  assert.deepEqual(saved.state.windows, []);
});
