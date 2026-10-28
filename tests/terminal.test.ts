import { test } from "node:test";
import assert from "node:assert/strict";
import { execute } from "../src/lib/terminal";

test("help only reports development status", () => {
  assert.deepEqual(execute(" help "), {
    output: "Terminal is under development.\nAvailable commands: help, clear.",
  });
  assert.deepEqual(execute("   "), { output: "" });
});
test("removed commands and shell operators are not executed", () => {
  for (const command of [
    "ls",
    "cd aether/desktop",
    "rm test.txt",
    "mv a b",
    "clear extra",
    "whoami",
    "echo test > result.txt",
    "help | ls",
    "help extra",
  ]) {
    assert.match(execute(command).output, /Unknown command/);
  }
});

test("clear requests an empty terminal without adding output", () => {
  assert.deepEqual(execute(" clear "), { output: "", clear: true });
});
