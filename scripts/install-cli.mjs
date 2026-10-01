#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "franko.mjs");
const remove = process.argv.includes("--remove");
const binDir = path.join(os.homedir(), ".local", "bin");
const shimCmd = path.join(binDir, "franko.cmd");
const shimSh = path.join(binDir, "franko");

if (remove) {
  for (const file of [shimCmd, shimSh]) {
    try {
      fs.unlinkSync(file);
      console.log(`Rimosso ${file}`);
    } catch {
      /* già assente */
    }
  }
  process.exit(0);
}

fs.mkdirSync(binDir, { recursive: true });

if (process.platform === "win32") {
  fs.writeFileSync(shimCmd, `@echo off\r\nnode "${SCRIPT}" %*\r\n`);
  console.log(`Shim installato: ${shimCmd}`);
} else {
  fs.writeFileSync(shimSh, `#!/bin/sh\nexec node "${SCRIPT}" "$@"\n`);
  try {
    fs.chmodSync(shimSh, 0o755);
  } catch {
    /* ignore */
  }
  console.log(`Shim installato: ${shimSh}`);
}

console.log("Ora puoi usare: franko 3");
