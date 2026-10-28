import { test } from "node:test";
import assert from "node:assert/strict";
import { restoreSession } from "../src/lib/session";
import {
  initialFiles,
  ROOT_ID,
  DOCUMENTS_ID,
  DESKTOP_ID,
  DOWNLOADS_ID,
  parseBackup,
} from "../src/lib/filesystem";
import { useOS } from "../src/lib/store";
import { resilientStorage } from "../src/lib/storage";

const win = {
  id: "one",
  app: "editor",
  title: "Document",
  width: 800,
  height: 500,
  x: 20,
  y: 50,
  z: 1,
  workspace: 0,
};

test("session restoration whitelists fields and normalizes malformed windows and preferences", () => {
  const state = restoreSession({
    files: initialFiles,
    windows: [
      null,
      win,
      win,
      { ...win, id: "unknown", app: "removed" },
      { ...win, id: "two", width: -10, x: Infinity, z: 999999, workspace: 1 },
    ],
    activeId: "two",
    wallpaperColor: null,
    atmosphere: "unknown",
    openApp: "overwrite",
  });
  assert.equal(state.windows.length, 2);
  assert.equal(state.activeId, "one");
  assert.equal(state.windows[1].width, 560);
  assert.equal(state.windows[1].x, 16);
  assert.equal(state.windows[1].z, 2);
  assert.equal(state.theme, "dark");
  assert.equal(state.wallpaperColor, "#1f2923");
  assert.equal("openApp" in state, false);
  assert.throws(() => restoreSession({ files: null }), /invalid file data/);
});

test("session migration retains legacy files and redirects old folder windows", () => {
  const legacy = [
    {
      id: "home",
      name: "Home",
      kind: "folder",
      parent: null,
      content: "",
      modified: 0,
    },
    {
      id: "note",
      name: "note.txt",
      kind: "text",
      parent: "home",
      content: "unchanged",
      modified: 1,
    },
  ];
  const state = restoreSession({
    files: legacy,
    windows: [{ ...win, app: "files", folderId: "home", fileId: "home" }],
  });
  assert.equal(state.files.find((f) => f.id === "note")?.content, "unchanged");
  assert.equal(state.windows[0].folderId, ROOT_ID);
});

test("backup validation rejects duplicate sibling names and malformed positions", () => {
  const duplicate = {
    ...initialFiles.find((f) => f.id === "readme")!,
    id: "other",
    name: "GUIDE.TXT",
  };
  assert.equal(
    parseBackup({ version: 3, files: [...initialFiles, duplicate] }),
    null,
  );
  assert.ok(
    parseBackup({
      version: 3,
      files: [...initialFiles, { ...duplicate, trashed: true }],
    }),
  );
  for (const desktopPosition of [
    null,
    false,
    "",
    { x: -1, y: 1 },
    { x: 1, y: Infinity },
  ]) {
    assert.equal(
      parseBackup({
        version: 3,
        files: [
          ...initialFiles,
          { ...duplicate, name: "Other.txt", desktopPosition },
        ],
      }),
      null,
    );
  }
  assert.equal(
    parseBackup({
      version: 3,
      files: [...initialFiles, { ...duplicate, name: "bad?.txt" }],
    }),
    null,
  );
});

test("deep backup trees validate without recursive stack overflow", () => {
  const files = [...initialFiles];
  let parent = DOCUMENTS_ID;
  for (let i = 0; i < 5000; i++) {
    const id = `nested-${i}`;
    files.push({
      id,
      parent,
      name: id,
      kind: "folder",
      content: "",
      modified: 0,
    });
    parent = id;
  }
  assert.equal(parseBackup({ version: 3, files })?.length, files.length);
});

test("focus restores the correct workspace and closing a background window preserves focus", () => {
  useOS.setState({ windows: [], activeId: null, workspace: 0 });
  useOS.getState().openApp("editor");
  const editor = useOS.getState().activeId!;
  useOS.getState().openApp("files");
  const files = useOS.getState().activeId!;
  useOS.getState().focus(editor);
  useOS.getState().close(files);
  assert.equal(useOS.getState().activeId, editor);
  useOS.getState().focus("missing");
  assert.equal(useOS.getState().activeId, editor);
  useOS.getState().setWorkspace(1);
  useOS.getState().focus(editor);
  assert.equal(useOS.getState().workspace, 0);
  useOS.getState().setWorkspace(42);
  assert.equal(useOS.getState().workspace, 0);
});

test("storage quota failures do not interrupt actions or flood error notifications", async () => {
  let fail = true,
    errors = 0;
  const storage = resilientStorage(
    {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        if (fail) throw new Error("Quota exceeded");
      },
    },
    () => errors++,
  );
  storage.setItem("workspace", "a");
  storage.setItem("workspace", "b");
  await Promise.resolve();
  assert.equal(errors, 1);
  fail = false;
  storage.setItem("workspace", "c");
  fail = true;
  storage.setItem("workspace", "d");
  await Promise.resolve();
  assert.equal(errors, 2);
});

test("system folders cannot be deleted, renamed or moved while their contents remain editable", () => {
  const previous = useOS.getState();
  useOS.setState({
    files: structuredClone(initialFiles),
    windows: [],
    cutFileId: null,
  });
  try {
    const state = useOS.getState();
    for (const id of [DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID]) {
      const original = useOS.getState().files.find((file) => file.id === id);
      state.trashFile(id);
      assert.equal(state.renameFile(id, "Changed"), false);
      const destination = id === DOCUMENTS_ID ? DOWNLOADS_ID : DOCUMENTS_ID;
      assert.equal(state.moveFile(id, destination).ok, false);
      assert.deepEqual(
        useOS.getState().files.find((file) => file.id === id),
        original,
      );
      const child = state.createFile(id, "User note.txt", "text", "Hello");
      assert.ok(child);
      state.trashFile(child);
      assert.equal(
        useOS.getState().files.find((file) => file.id === child)?.trashed,
        true,
      );
    }
  } finally {
    useOS.setState(previous);
  }
});

test("text documents keep .txt and coexist with folders using the same stem", () => {
  const previous = useOS.getState();
  useOS.setState({ files: structuredClone(initialFiles), windows: [] });
  try {
    const state = useOS.getState();
    const text = state.createFile(ROOT_ID, "x", "text", "User content");
    assert.ok(text);
    assert.equal(
      useOS.getState().files.find((file) => file.id === text)?.name,
      "x.txt",
    );
    const folder = state.createFile(ROOT_ID, "x", "folder");
    assert.ok(folder);
    assert.equal(state.createFile(ROOT_ID, "X.TXT", "text"), null);
    assert.equal(state.createFile(ROOT_ID, "X", "folder"), null);
    assert.equal(state.renameFile(text, "notes.md"), true);
    assert.equal(
      useOS.getState().files.find((file) => file.id === text)?.name,
      "notes.txt",
    );
    assert.equal(state.renameFile(folder, "notes"), true);
    assert.equal(state.moveFile(text, folder).ok, true);
    assert.equal(
      useOS.getState().files.find((file) => file.id === text)?.content,
      "User content",
    );
    state.trashFile(text);
    state.restoreFile(text);
    assert.equal(
      useOS.getState().files.find((file) => file.id === text)?.trashed,
      false,
    );
  } finally {
    useOS.setState(previous);
  }
});
