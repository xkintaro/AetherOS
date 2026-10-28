import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialFiles as seedFiles,
  ROOT_ID,
  resolvePath,
  childrenOf,
  validName,
  filePath,
} from "../src/lib/filesystem";
const initialFiles = [
  ...seedFiles,
  {
    id: "notes",
    name: "Notes",
    parent: ROOT_ID,
    kind: "folder" as const,
    content: "",
    modified: 0,
  },
  {
    id: "projects",
    name: "Projects",
    parent: ROOT_ID,
    kind: "folder" as const,
    content: "",
    modified: 0,
  },
  {
    id: "ideas",
    name: "Little ideas.txt",
    parent: "notes",
    kind: "text" as const,
    content: "Test notes",
    modified: 0,
  },
];
test("paths support absolute, relative, home and parent navigation", () => {
  assert.equal(
    resolvePath(initialFiles, "notes", "../Documents/Guide.txt")?.id,
    "readme",
  );
  assert.equal(
    resolvePath(initialFiles, ROOT_ID, "~/Projects")?.id,
    "projects",
  );
  assert.equal(
    resolvePath(initialFiles, ROOT_ID, "aether/Notes/Little ideas.txt")?.id,
    "ideas",
  );
  assert.equal(resolvePath(initialFiles, ROOT_ID, "/missing"), undefined);
  assert.equal(filePath(initialFiles, "readme"), "aether/documents/Guide.txt");
});
test("trashed files disappear and names reject path traversal", () => {
  assert.equal(
    childrenOf(
      initialFiles.map((f) =>
        f.id === "readme" ? { ...f, trashed: true } : f,
      ),
      "documents",
    ).length,
    0,
  );
  for (const name of ["", "..", "a/b", "a\\b", "\u0000"])
    assert.equal(validName(name), false);
  assert.equal(validName("My ideas.md"), true);
});
