#!/usr/bin/env node
import { validateGreetings } from "../lib/greetings.mjs";

const result = validateGreetings();
const steps = Object.keys(result.counts).sort();

for (const step of steps) {
  console.log(`  ${step.padEnd(10)} ${result.counts[step]}`);
}

if (result.ok) {
  const total = steps.reduce((sum, step) => sum + result.counts[step], 0);
  console.log(`validate-catalog: OK (${total} phrases)`);
} else {
  console.error(`validate-catalog: ${result.errors.length} error(s)`);
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exitCode = 1;
}
