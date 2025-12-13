#!/usr/bin/env node
import { scanAmplifyUsage } from "./scanAmplifyUsage.js";
import { applyDisableOperations } from "./updateAmplifyResource.js";
import * as fs from "node:fs";
import * as path from "node:path";

function help() {
  console.log(`Usage:
  amplify-unused-ops scan --project tsconfig.json --out usage.json
  amplify-unused-ops apply --resource amplify/data/resource.ts --usage usage.json [--dry-run]`);
}

const args = process.argv.slice(2);
const cmd = args[0];
if (!cmd) { help(); process.exit(0); }

function arg(name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i+1];
}
function flag(name: string): boolean {
  return args.includes(name);
}

if (cmd === "scan") {
  const project = arg("--project");
  const out = arg("--out");
  if (!project || !out) { help(); process.exit(1); }
  const usage = scanAmplifyUsage({ tsconfigPath: project });
  const dir = path.dirname(out);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(out, JSON.stringify(usage,null,2));
  console.log("written:", out);
  process.exit(0);
}

if (cmd === "apply") {
  const resource = arg("--resource");
  const usage = arg("--usage");
  if (!resource || !usage) { help(); process.exit(1); }
  applyDisableOperations({
    resourcePath: resource,
    usagePath: usage,
    dryRun: flag("--dry-run"),
    backup: !flag("--no-backup")
  });
  process.exit(0);
}

help();
