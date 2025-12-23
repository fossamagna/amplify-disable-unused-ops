import {
  Project,
  Node,
  ObjectLiteralExpression,
  PropertyAccessExpression,
  CallExpression,
} from "ts-morph";
import type { UsageMap, OperationName } from "./scanAmplifyUsage.js";
import * as fs from "node:fs";

interface ApplyOptions {
  resourcePath: string;
  usagePath: string;
  dryRun?: boolean;
  backup?: boolean;
  onExisting?: "overwrite" | "skip" | "merge";
}

// observeQuery requires both queries and subscriptions to be enabled
const QUERY_OPS: OperationName[] = ["get", "list", "observeQuery"];
const MUTATION_OPS: OperationName[] = ["create", "update", "delete"];
const SUBSCRIPTION_OPS: OperationName[] = [
  "onCreate",
  "onUpdate",
  "onDelete",
  "observeQuery",
];

function buildDisableOperations(usedOps?: Set<OperationName>): string[] {
  if (!usedOps || usedOps.size === 0) {
    return ["queries", "mutations", "subscriptions"];
  }
  const used = (ops: OperationName[]) => ops.some((op) => usedOps.has(op));
  const disable: string[] = [];
  if (!used(QUERY_OPS)) {
    disable.push("queries");
  }
  if (!used(MUTATION_OPS)) {
    disable.push("mutations");
  }
  if (!used(SUBSCRIPTION_OPS)) {
    disable.push("subscriptions");
  }
  return disable;
}

function extractExistingDisableOperations(init: Node): string[] | undefined {
  const text = init.getText();
  const match = text.match(/\.disableOperations\(\[([^\]]+)\]\)/);
  if (!match) {
    return undefined;
  }
  const opsString = match[1];
  const ops = opsString
    .split(",")
    .map((s) => s.trim().replace(/^["'`]|["'`]$/g, ""))
    .filter((s) => s.length > 0);
  return ops;
}

function mergeDisableOperations(
  existing: string[],
  newOps: string[]
): string[] {
  const merged = new Set([...existing, ...newOps]);
  return Array.from(merged);
}

function removeDisableOperations(init: Node): string {
  const text = init.getText();
  return text.replace(/\.disableOperations\(\[[^\]]+\]\)/, "");
}

export function applyDisableOperations(opts: ApplyOptions) {
  const {
    resourcePath,
    usagePath,
    dryRun = false,
    backup = true,
    onExisting = "skip",
  } = opts;
  const usageJson: UsageMap = JSON.parse(fs.readFileSync(usagePath, "utf8"));
  const usageSet = new Map<string, Set<OperationName>>();
  for (const [m, ops] of Object.entries(usageJson)) {
    usageSet.set(m, new Set(ops));
  }

  const project = new Project({
    tsConfigFilePath: undefined,
    skipAddingFilesFromTsConfig: true,
  });
  const sf = project.addSourceFileAtPath(resourcePath);

  const schemaCall = sf.getFirstDescendant(
    (n) =>
      Node.isCallExpression(n) &&
      Node.isPropertyAccessExpression(n.getExpression()) &&
      (n.getExpression() as PropertyAccessExpression).getName() === "schema"
  );
  if (!schemaCall) {
    throw new Error("schema() not found");
  }

  const args = (schemaCall as CallExpression).getArguments();
  if (!args.length || !Node.isObjectLiteralExpression(args[0])) {
    throw new Error("schema() arg is not object");
  }

  const modelsObj = args[0] as ObjectLiteralExpression;

  if (!dryRun && backup) fs.copyFileSync(resourcePath, resourcePath + ".bak");

  for (const prop of modelsObj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) {
      continue;
    }

    const name = prop
      .getNameNode()
      .getText()
      .replace(/^["'`](.*)["'`]$/, "$1");
    const usedOps = usageSet.get(name);
    const disableOps = buildDisableOperations(usedOps);

    const init = prop.getInitializer();
    if (!init) {
      continue;
    }

    if (!isModelDefinitionExpression(init)) {
      continue;
    }

    const hasExisting = init.getText().includes(".disableOperations(");
    if (hasExisting) {
      if (onExisting === "skip") {
        console.warn("[skip] already has disableOperations:", name);
        continue;
      } else if (onExisting === "merge") {
        const existing = extractExistingDisableOperations(init);
        if (existing) {
          const merged = mergeDisableOperations(existing, disableOps);
          const textWithoutDisable = removeDisableOperations(init);
          if (merged.length === 0) {
            init.replaceWithText(textWithoutDisable);
          } else {
            const mergedArg =
              "[" + merged.map((op) => `"${op}"`).join(",") + "]";
            init.replaceWithText(
              textWithoutDisable + `.disableOperations(${mergedArg})`
            );
          }
          console.log(
            `[merge] merged disableOperations for ${name}: [${merged.join(", ")}]`
          );
        }
        continue;
      } else if (onExisting === "overwrite") {
        const textWithoutDisable = removeDisableOperations(init);
        if (disableOps.length === 0) {
          init.replaceWithText(textWithoutDisable);
        } else {
          const disableArg =
            "[" + disableOps.map((op) => `"${op}"`).join(",") + "]";
          init.replaceWithText(
            textWithoutDisable + `.disableOperations(${disableArg})`
          );
        }
        console.log(`[overwrite] replaced disableOperations for ${name}`);
        continue;
      }
    }

    if (disableOps.length !== 0) {
      const disableArg = "[" + disableOps.map((op) => `"${op}"`).join(",") + "]";
      init.replaceWithText(init.getText() + `.disableOperations(${disableArg})`);
    }
  }

  if (dryRun) {
    console.log("dry-run: no save");
  } else {
    sf.saveSync();
  }
}

function isModelDefinitionExpression(init: Node) {
  return findModelDefinitionExpression(init) !== undefined;
}

function findModelDefinitionExpression(init: Node) {
  if (Node.isCallExpression(init)) {
    const expr = init.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      if (name === "model") {
        return init;
      } else {
        return findModelDefinitionExpression(expr.getExpression());
      }
    }
  }
}
