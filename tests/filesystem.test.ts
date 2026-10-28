import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialFiles,
  ROOT_ID,
  HOME_ID,
  DESKTOP_ID,
  DOCUMENTS_ID,
  DOWNLOADS_ID,
  isProtected,
  childrenOf,
  filePath,
  resolvePath,
  moveEntry,
  moveError,
  isAvailable,
  migrateFiles,
  parseBackup,
  type VFile,
} from "../src/lib/filesystem";
import { desktopLayout, desktopCell } from "../src/lib/desktop-layout";

const folder = (id: string, name: string, parent: string): VFile => ({
  id,
  name,
  parent,
  kind: "folder",
  content: "",
  modified: 1,
});
const fixture = (): VFile[] => [
  ...initialFiles,
  folder("project", "Project", HOME_ID),
  folder("nested", "Nested", "project"),
  {
    id: "work",
    name: "work.txt",
    parent: "nested",
    kind: "text",
    content: "keep this content",
    modified: 1,
  },
];

test("aether paths, separators and case-insensitive lookup resolve the same nodes", () => {
  assert.equal(filePath(initialFiles, ROOT_ID), "aether/");
  assert.equal(filePath(initialFiles, DESKTOP_ID), "aether/desktop");
  for (const path of [
    "aether/desktop",
    "aether\\desktop",
    "~/Desktop",
    "/desktop",
  ])
    assert.equal(resolvePath(initialFiles, HOME_ID, path)?.id, DESKTOP_ID);
  assert.equal(resolvePath(initialFiles, HOME_ID, "D:/Users"), undefined);
  assert.equal(resolvePath(initialFiles, ROOT_ID, "../../")?.id, ROOT_ID);
  assert.equal(
    resolvePath(initialFiles, HOME_ID, "Documents/Guide.txt/nope"),
    undefined,
  );
});
test("moving a nested folder preserves every ID, child and content", () => {
  const files = fixture(),
    next = moveEntry(files, "project", DESKTOP_ID, { x: 16, y: 16 });
  assert.equal(next.result.ok, true);
  assert.equal(files.find((f) => f.id === "project")?.parent, HOME_ID);
  assert.equal(
    filePath(next.files, "work"),
    "aether/desktop/Project/Nested/work.txt",
  );
  assert.equal(
    next.files.find((f) => f.id === "work")?.content,
    "keep this content",
  );
  assert.equal(next.files.length, files.length);
  const back = moveEntry(next.files, "project", HOME_ID);
  assert.equal(back.result.ok, true);
  assert.equal(
    back.files.find((f) => f.id === "project")?.desktopPosition,
    undefined,
  );
});
test("moves reject cycles, protected folders, files as destinations and name collisions", () => {
  const files = fixture();
  for (const [source, target] of [
    ["project", "project"],
    ["project", "nested"],
    [ROOT_ID, HOME_ID],
    [DESKTOP_ID, "project"],
    ["project", "work"],
  ])
    assert.equal(moveEntry(files, source, target).result.ok, false);
  const duplicate = [...files, folder("duplicate", "PROJECT", DESKTOP_ID)];
  const failed = moveEntry(duplicate, "project", DESKTOP_ID);
  assert.equal(failed.result.ok, false);
  assert.equal(failed.files, duplicate);
  assert.equal(moveError(files, "project", HOME_ID), null);
});
test("trashing a parent hides its descendants from navigation and move targets", () => {
  const files = fixture().map((f) =>
    f.id === "project" ? { ...f, trashed: true } : f,
  );
  assert.equal(isAvailable(files, "work"), false);
  assert.equal(
    resolvePath(files, HOME_ID, "Project/Nested/work.txt"),
    undefined,
  );
  assert.deepEqual(childrenOf(files, "nested"), []);
  assert.notEqual(moveError(files, "readme", "nested"), null);
  const restored = files.map((f) =>
    f.id === "project" ? { ...f, trashed: false } : f,
  );
  assert.equal(isAvailable(restored, "work"), true);
});
test("v1 migration retains existing IDs, data and Trash and is idempotent", () => {
  const legacy: VFile[] = [
    { ...folder("home", "Home", ""), parent: null },
    folder("documents", "Documents", "home"),
    {
      id: "old",
      name: "Saved.txt",
      parent: "documents",
      kind: "text",
      content: "original",
      modified: 123,
      trashed: true,
    },
  ];
  const next = migrateFiles(legacy);
  assert.deepEqual(
    next.find((f) => f.id === "old"),
    legacy[2],
  );
  assert.equal(filePath(next, "documents"), "aether/documents");
  assert.equal(filePath(next, DESKTOP_ID), "aether/desktop");
  assert.equal(migrateFiles(next), next);
  assert.equal(
    parseBackup({ version: 1, files: legacy })?.find((f) => f.id === "old")
      ?.content,
    "original",
  );
});
test("legacy drive/user wrappers flatten without losing nested files or colliding names", () => {
  const legacy: VFile[] = [
    { ...folder("drive-c", "C:", ""), parent: null },
    folder("users", "Users", "drive-c"),
    folder("home", "Guest", "users"),
    folder(DESKTOP_ID, "Desktop", "home"),
    folder(DOCUMENTS_ID, "Documents", "home"),
    folder(DOWNLOADS_ID, "Downloads", "home"),
    folder("root-work", "Work", "drive-c"),
    folder("user-work", "Work", "home"),
    {
      id: "nested-keep",
      name: "Keep.txt",
      parent: "user-work",
      kind: "text",
      content: "saved contents",
      modified: 7,
    },
  ];
  const next = migrateFiles(legacy);
  assert.equal(
    next.some((file) => ["drive-c", "users", "home"].includes(file.id)),
    false,
  );
  assert.equal(filePath(next, DOCUMENTS_ID), "aether/documents");
  assert.equal(next.find((file) => file.id === "root-work")?.parent, ROOT_ID);
  assert.equal(next.find((file) => file.id === "user-work")?.parent, ROOT_ID);
  assert.notEqual(
    next.find((file) => file.id === "root-work")?.name,
    next.find((file) => file.id === "user-work")?.name,
  );
  assert.equal(
    next.find((file) => file.id === "nested-keep")?.content,
    "saved contents",
  );
  assert.equal(
    next.find((file) => file.id === "nested-keep")?.parent,
    "user-work",
  );
  assert.ok(parseBackup({ version: 2, files: legacy }));
  assert.equal(migrateFiles(next), next);
});

test("backup validation rejects cycles, missing parents and extra roots", () => {
  assert.ok(parseBackup({ version: 3, files: fixture() }));
  const bad = fixture().map((f) =>
    f.id === "project" ? { ...f, parent: "nested" } : f,
  );
  assert.equal(parseBackup({ version: 3, files: bad }), null);
  assert.equal(
    parseBackup({
      version: 3,
      files: [...initialFiles, folder("orphan", "Orphan", "missing")],
    }),
    null,
  );
  assert.equal(
    parseBackup({
      version: 3,
      files: [
        ...initialFiles,
        { ...folder("root2", "Other", ROOT_ID), parent: null },
      ],
    }),
    null,
  );
});

test("known folders are protected and moved Documents is repaired with its contents intact", () => {
  for (const id of [DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID]) {
    assert.equal(isProtected(id), true);
    assert.equal(moveEntry(initialFiles, id, ROOT_ID).result.ok, false);
  }
  const moved = initialFiles.map((file) =>
    file.id === DOCUMENTS_ID
      ? { ...file, parent: DESKTOP_ID, desktopPosition: { x: 16, y: 16 } }
      : file,
  );
  const repaired = migrateFiles(moved);
  assert.equal(filePath(repaired, DOCUMENTS_ID), "aether/documents");
  assert.equal(
    repaired.find((file) => file.id === DOCUMENTS_ID)?.desktopPosition,
    undefined,
  );
  assert.deepEqual(
    repaired.find((file) => file.id === "readme"),
    moved.find((file) => file.id === "readme"),
  );
  assert.equal(migrateFiles(repaired), repaired);
});
test("repair does not overwrite a user folder occupying a system location", () => {
  const files = initialFiles.map((file) =>
    file.id === DOCUMENTS_ID ? { ...file, parent: DESKTOP_ID } : file,
  );
  files.push(folder("user-documents", "Documents", HOME_ID));
  files.push({
    id: "user-content",
    name: "Keep.txt",
    parent: "user-documents",
    kind: "text",
    content: "preserve",
    modified: 1,
  });
  const repaired = migrateFiles(files);
  assert.equal(filePath(repaired, DOCUMENTS_ID), "aether/documents");
  assert.equal(
    repaired.find((file) => file.id === "user-documents")?.name,
    "Documents (2)",
  );
  assert.equal(
    repaired.find((file) => file.id === "user-content")?.content,
    "preserve",
  );
});
test("desktop placements stay distinct and clamp to the current viewport", () => {
  const files = [
    {
      ...folder("a", "A", DESKTOP_ID),
      desktopPosition: { x: 99999, y: 99999 },
    },
    {
      ...folder("b", "B", DESKTOP_ID),
      desktopPosition: { x: 99999, y: 99999 },
    },
    folder("c", "C", DESKTOP_ID),
  ];
  const layout = desktopLayout(files, 600, 1000);
  assert.equal(
    new Set([...layout.values()].map((p) => p.x + ":" + p.y)).size,
    3,
  );
  const point = desktopCell({ x: 99999, y: 99999 }, 600, 1000);
  assert.ok(point.x < 1000 && point.y < 600);
});

test("dropping into the same folder preserves desktop positions and modification times", () => {
  const files = [
    ...fixture(),
    {
      id: "desktop-note",
      name: "note.txt",
      parent: DESKTOP_ID,
      kind: "text" as const,
      content: "Keep",
      modified: 123,
      desktopPosition: { x: 304, y: 208 },
    },
  ];
  for (const [id, parent] of [
    ["desktop-note", DESKTOP_ID],
    ["work", "nested"],
    ["project", HOME_ID],
  ]) {
    const result = moveEntry(files, id, parent);
    assert.equal(result.result.ok, true);
    assert.equal(result.files, files);
    assert.deepEqual(
      result.files.find((file) => file.id === id),
      files.find((file) => file.id === id),
    );
  }
  const repositioned = moveEntry(files, "desktop-note", DESKTOP_ID, {
    x: 16,
    y: 112,
  });
  assert.equal(repositioned.result.ok, true);
  assert.deepEqual(
    repositioned.files.find((file) => file.id === "desktop-note")
      ?.desktopPosition,
    { x: 16, y: 112 },
  );
  const moved = moveEntry(files, "desktop-note", DOCUMENTS_ID);
  assert.equal(moved.result.ok, true);
  assert.equal(
    moved.files.find((file) => file.id === "desktop-note")?.desktopPosition,
    undefined,
  );
  assert.equal(
    moved.files.find((file) => file.id === "desktop-note")?.content,
    "Keep",
  );
});
