import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectionRect,
  intersects,
  combineSelection,
} from "../src/lib/selection";
import {
  initialFiles,
  DESKTOP_ID,
  DOCUMENTS_ID,
  DOWNLOADS_ID,
  ROOT_ID,
  moveEntries,
  selectionRoots,
  type VFile,
} from "../src/lib/filesystem";
import { desktopGroupPositions } from "../src/lib/desktop-layout";
import { useOS } from "../src/lib/store";

const note = (id: string, name: string, parent = DESKTOP_ID): VFile => ({
  id,
  name,
  parent,
  kind: "text",
  content: id,
  modified: 1,
});

test("lasso normalizes all drag directions and includes icons touched at an edge", () => {
  const rectangle = selectionRect({ x: 200, y: 150 }, { x: 10, y: 20 });
  assert.deepEqual(rectangle, { x: 10, y: 20, width: 190, height: 130 });
  assert.equal(
    intersects(rectangle, { x: 200, y: 150, width: 88, height: 88 }),
    true,
  );
  assert.equal(
    intersects(rectangle, { x: 201, y: 150, width: 88, height: 88 }),
    false,
  );
  assert.equal(
    intersects(rectangle, { x: 30, y: 40, width: 88, height: 88 }),
    true,
  );
});

test("Ctrl selection toggles independently and additive selection preserves existing items", () => {
  assert.deepEqual(combineSelection(["a", "b"], ["b", "c"], "replace"), [
    "b",
    "c",
  ]);
  assert.deepEqual(combineSelection(["a", "b"], ["b", "c"], "toggle"), [
    "a",
    "c",
  ]);
  assert.deepEqual(combineSelection(["a", "b"], ["b", "c"], "add"), [
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(combineSelection(["a", "b"], [], "toggle"), ["a", "b"]);
});

test("batch moves are atomic when a later item has a destination conflict", () => {
  const files = [
    ...initialFiles,
    note("a", "a.txt"),
    note("b", "b.txt"),
    note("conflict", "B.txt", DOCUMENTS_ID),
  ];
  const result = moveEntries(files, ["a", "b"], DOCUMENTS_ID);
  assert.equal(result.result.ok, false);
  assert.equal(result.files, files);
  assert.equal(
    result.files.find((file) => file.id === "a")?.parent,
    DESKTOP_ID,
  );
  const protectedMove = moveEntries(files, ["a", DESKTOP_ID], DOCUMENTS_ID);
  assert.equal(protectedMove.result.ok, false);
  assert.equal(protectedMove.files, files);
  const success = moveEntries(files, ["a", "b", "a"], DOWNLOADS_ID);
  assert.equal(success.result.ok, true);
  for (const id of ["a", "b"])
    assert.equal(
      success.files.find((file) => file.id === id)?.parent,
      DOWNLOADS_ID,
    );
});

test("selecting a folder and its child moves the subtree once without flattening it", () => {
  const files: VFile[] = [
    ...initialFiles,
    { ...note("folder", "Folder"), kind: "folder" },
    note("child", "child.txt", "folder"),
  ];
  assert.deepEqual(selectionRoots(files, ["child", "folder"]), ["folder"]);
  const moved = moveEntries(files, ["folder", "child"], DOCUMENTS_ID);
  assert.equal(moved.result.ok, true);
  assert.equal(
    moved.files.find((file) => file.id === "child")?.parent,
    "folder",
  );
  assert.equal(moveEntries(files, ["folder"], "folder").result.ok, false);
});

test("desktop group movement preserves offsets and does not overlap stationary icons", () => {
  const files = [
    { ...note("a", "a.txt"), desktopPosition: { x: 16, y: 16 } },
    { ...note("b", "b.txt"), desktopPosition: { x: 16, y: 112 } },
    { ...note("fixed", "fixed.txt"), desktopPosition: { x: 304, y: 16 } },
  ];
  const result = desktopGroupPositions(
    files,
    ["a", "b"],
    "a",
    { x: 208, y: 112 },
    700,
    1200,
  );
  assert.deepEqual(result, { a: { x: 208, y: 112 }, b: { x: 208, y: 208 } });
  const collision = desktopGroupPositions(
    files,
    ["a", "b"],
    "a",
    { x: 304, y: 16 },
    700,
    1200,
  );
  assert.notDeepEqual(collision.a, { x: 304, y: 16 });
  assert.notDeepEqual(collision.a, collision.b);
});

test("group cut, paste, trash and restore keep protected folders and clipboard consistent", () => {
  const previous = useOS.getState();
  useOS.setState({
    files: [...initialFiles, note("a", "a.txt"), note("b", "b.txt")],
    windows: [],
    cutFileIds: [],
    cutFileId: null,
    notices: [],
  });
  try {
    const state = useOS.getState();
    state.cutFiles([DESKTOP_ID, "a", "b"]);
    assert.deepEqual(useOS.getState().cutFileIds, ["a", "b"]);
    assert.equal(state.pasteFile(DOCUMENTS_ID).ok, true);
    assert.deepEqual(useOS.getState().cutFileIds, []);
    assert.equal(useOS.getState().cutFileId, null);
    for (const id of ["a", "b"])
      assert.equal(
        useOS.getState().files.find((file) => file.id === id)?.parent,
        DOCUMENTS_ID,
      );
    state.cutFiles(["a", "b"]);
    state.trashFiles([DESKTOP_ID, "a", "b"]);
    assert.deepEqual(useOS.getState().cutFileIds, []);
    assert.equal(
      useOS.getState().files.find((file) => file.id === DESKTOP_ID)?.trashed,
      undefined,
    );
    for (const id of ["a", "b"])
      assert.equal(
        useOS.getState().files.find((file) => file.id === id)?.trashed,
        true,
      );
    state.restoreFiles(["a", "b"]);
    for (const id of ["a", "b"])
      assert.equal(
        useOS.getState().files.find((file) => file.id === id)?.trashed,
        false,
      );
    const conflict = state.createFile(ROOT_ID, "a.txt", "text")!;
    state.cutFiles(["a", "b"]);
    assert.equal(state.pasteFile(ROOT_ID).ok, false);
    assert.deepEqual(useOS.getState().cutFileIds, ["a", "b"]);
    state.trashFile(conflict);
    assert.equal(state.pasteFile(ROOT_ID).ok, true);
  } finally {
    useOS.setState(previous);
  }
});

test("bulk restore rolls back all items on name conflicts", () => {
  const previous = useOS.getState();
  const files = [
    ...initialFiles,
    { ...note("a", "a.txt"), trashed: true },
    { ...note("b", "b.txt"), trashed: true },
    note("conflict", "b.txt"),
  ];
  useOS.setState({ files, notices: [] });
  try {
    useOS.getState().restoreFiles(["a", "b"]);
    assert.equal(useOS.getState().files, files);
    assert.equal(useOS.getState().notices[0]?.title, "Cannot restore");
  } finally {
    useOS.setState(previous);
  }
});
