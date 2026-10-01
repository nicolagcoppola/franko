import test from "node:test";
import assert from "node:assert/strict";
import { deriveTitle, isMeaningfulPrompt, stripPasted } from "../lib/titles.mjs";

test("command-only, pasted-only and empty prompts are not meaningful", () => {
  assert.equal(isMeaningfulPrompt("/plugin install franko"), false);
  assert.equal(isMeaningfulPrompt("!"), false);
  assert.equal(isMeaningfulPrompt("<command-name>/clear</command-name>"), false);
  assert.equal(isMeaningfulPrompt("devo fare questo: [Pasted text #1 +20 lines]"), false);
  assert.equal(isMeaningfulPrompt("ok"), false);
  assert.equal(isMeaningfulPrompt("uno"), true);
  assert.equal(isMeaningfulPrompt("sistemare il parser sessioni"), true);
});

test("deriveTitle skips commands and pasted-only prompts", () => {
  const title = deriveTitle([
    "/plugin install franko",
    "devo fare questo: [Pasted text #1 +20 lines]",
    "sistemare la validazione del catalogo",
  ]);
  assert.equal(title, "Sistemare la validazione del catalogo");
});

test("deriveTitle turns quoted errors into an Errore title", () => {
  const title = deriveTitle([
    'devo fare questo: "Error: This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header"',
  ]);
  assert.match(title, /^Errore: This API key is not scoped/);
});

test("deriveTitle strips filler and truncates at a word boundary", () => {
  assert.equal(
    deriveTitle(["vorrei capire come funziona il parser delle sessioni"]),
    "Capire come funziona il parser delle sessioni",
  );
  const long = deriveTitle([`mi serve ${"parola ".repeat(30)}`]);
  assert.ok(long.length <= 71, long);
  assert.ok(long.endsWith("…"));
});

test("deriveTitle returns null when nothing is meaningful", () => {
  assert.equal(deriveTitle(["/clear", "", null]), null);
});

test("stripPasted removes placeholder markers", () => {
  assert.equal(stripPasted("devo fare questo: [Pasted text #1 +20 lines]"), "devo fare questo:");
});
