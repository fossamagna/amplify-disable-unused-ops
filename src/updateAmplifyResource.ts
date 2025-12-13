import { Project, Node, ObjectLiteralExpression, PropertyAccessExpression, CallExpression } from "ts-morph";
import type { UsageMap, OperationName } from "./scanAmplifyUsage.js";
import * as fs from "node:fs";

interface ApplyOptions { resourcePath: string; usagePath: string; dryRun?: boolean; backup?: boolean; }

const QUERY_OPS: OperationName[] = ["get","list"];
const MUTATION_OPS: OperationName[] = ["create","update","delete"];
const SUBSCRIPTION_OPS: OperationName[] = ["onCreate","onUpdate","onDelete","observeQuery"];

function buildDisableOperations(usedOps?: Set<OperationName>): string[] {
  if (!usedOps || usedOps.size === 0) return ["queries","mutations","subscriptions"];
  const used = (ops: OperationName[]) => ops.some(op => usedOps.has(op));
  const disable: string[] = [];
  if (!used(QUERY_OPS)) disable.push("queries");
  if (!used(MUTATION_OPS)) disable.push("mutations");
  if (!used(SUBSCRIPTION_OPS)) disable.push("subscriptions");
  return disable;
}

export function applyDisableOperations(opts: ApplyOptions) {
  const { resourcePath, usagePath, dryRun=false, backup=true } = opts;
  const usageJson: UsageMap = JSON.parse(fs.readFileSync(usagePath,"utf8"));
  const usageSet = new Map<string, Set<OperationName>>();
  for (const [m, ops] of Object.entries(usageJson)) usageSet.set(m, new Set(ops));

  const project = new Project({ tsConfigFilePath: undefined, skipAddingFilesFromTsConfig: true });
  const sf = project.addSourceFileAtPath(resourcePath);

  const schemaCall = sf.getFirstDescendant(n =>
    Node.isCallExpression(n) &&
    Node.isPropertyAccessExpression(n.getExpression()) &&
    (n.getExpression() as PropertyAccessExpression).getName() === "schema"
  );
  if (!schemaCall) throw new Error("schema() not found");

  const args = (schemaCall as CallExpression).getArguments();
  if (!args.length || !Node.isObjectLiteralExpression(args[0])) throw new Error("schema() arg is not object");

  const modelsObj = args[0] as ObjectLiteralExpression;

  if (!dryRun && backup) fs.copyFileSync(resourcePath, resourcePath + ".bak");

  for (const prop of modelsObj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getNameNode().getText().replace(/^["'`](.*)["'`]$/, "$1");
    const usedOps = usageSet.get(name);
    const disableOps = buildDisableOperations(usedOps);
    if (!disableOps.length) continue;

    const init = prop.getInitializer();
    if (!init) continue;

    if (init.getText().includes(".disableOperations(")) {
      console.warn("[warn] already has disableOperations:", name);
      continue;
    }
    const disableArg = "[" + disableOps.map(op=>`"${op}"`).join(",") + "]";
    init.replaceWithText(init.getText() + `.disableOperations(${disableArg})`);
  }

  if (dryRun) console.log("dry-run: no save");
  else sf.saveSync();
}
