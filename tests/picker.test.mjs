import test from "node:test";
import assert from "node:assert/strict";
import { filterSessions, parsePickerCommand } from "../lib/picker.mjs";

test("bare number opens the session", () => {
  assert.deepEqual(parsePickerCommand("2", 3), { type: "open", index: 1 });
});

test("empty line refreshes the list", () => {
  assert.deepEqual(parsePickerCommand("", 3), { type: "list" });
});

test("detail accepts English and Italian forms", () => {
  for (const line of ["d 2", "detail 2", "details 2", "dettagli 2"]) {
    assert.deepEqual(parsePickerCommand(line, 3), { type: "detail", index: 1 }, line);
  }
});

test("rename accepts English and Italian forms", () => {
  for (const line of ["r 2 Login refactoring", "rename 2 Login refactoring", "rinomina 2 Login refactoring"]) {
    assert.deepEqual(parsePickerCommand(line, 3), { type: "rename", index: 1, name: "Login refactoring" }, line);
  }
});

test("slash text filters the list", () => {
  assert.deepEqual(parsePickerCommand("/login", 3), { type: "search", query: "login" });
});

test("quit accepts the usual forms", () => {
  for (const line of ["q", "quit", "exit", "esci"]) {
    assert.deepEqual(parsePickerCommand(line, 3), { type: "quit" }, line);
  }
});

test("out of range and unknown commands are invalid", () => {
  assert.equal(parsePickerCommand("9", 3).type, "invalid");
  assert.equal(parsePickerCommand("d 9", 3).type, "invalid");
  assert.equal(parsePickerCommand("boh", 3).type, "invalid");
  assert.match(parsePickerCommand("boh", 3).reason, /unknown command/);
});

test("filterSessions matches title, project and cwd", () => {
  const sessions = [
    { displayName: "Login refactoring", projectLabel: "Nicola", cwd: "C:\\Users\\Nicola" },
    { displayName: "Spinner tema", projectLabel: "rockspinner", cwd: "D:\\Progetti\\rockspinner" },
  ];
  assert.equal(filterSessions(sessions, "login").length, 1);
  assert.equal(filterSessions(sessions, "ROCK").length, 1);
  assert.equal(filterSessions(sessions, "d:\\progetti").length, 1);
  assert.equal(filterSessions(sessions, "").length, 2);
});
