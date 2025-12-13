import { Project, Node } from "ts-morph";
export type OperationName =
  | "get"
  | "list"
  | "create"
  | "update"
  | "delete"
  | "observeQuery"
  | "onCreate"
  | "onUpdate"
  | "onDelete"
  | string;
export type UsageMap = Record<string, OperationName[]>;
interface ScanOptions {
  tsconfigPath: string;
  includeGlobs?: string[];
}

export function scanAmplifyUsage(options: ScanOptions): UsageMap {
  const project = new Project({ tsConfigFilePath: options.tsconfigPath });
  const usage = new Map<string, Set<OperationName>>();
  const sourceFiles = options.includeGlobs
    ? project.getSourceFiles(options.includeGlobs)
    : project.getSourceFiles(["**/*.ts", "**/*.tsx"]);

  for (const sf of sourceFiles) {
    const clientVars = new Set<string>();

    sf.forEachDescendant((node) => {
      if (Node.isVariableDeclaration(node)) {
        const init = node.getInitializer();
        if (init && Node.isCallExpression(init)) {
          const expr = init.getExpression();
          if (Node.isIdentifier(expr) && expr.getText() === "generateClient") {
            const nameNode = node.getNameNode();
            if (Node.isIdentifier(nameNode)) clientVars.add(nameNode.getText());
          }
        }
      }
    });
    if (clientVars.size === 0) continue;

    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression();
      if (!Node.isPropertyAccessExpression(callee)) return;
      const operationName = callee.getName();
      const modelAccess = callee.getExpression();
      if (!Node.isPropertyAccessExpression(modelAccess)) return;
      const model = modelAccess
        .getNameNode()
        .getText()
        .replace(/^["'`](.*)["'`]$/, "$1");
      const modelsExpr = modelAccess.getExpression();
      if (!Node.isPropertyAccessExpression(modelsExpr)) return;
      if (modelsExpr.getName() !== "models") return;
      const clientExpr = modelsExpr.getExpression();
      if (!Node.isIdentifier(clientExpr)) return;
      if (!clientVars.has(clientExpr.getText())) return;

      if (!usage.has(model)) usage.set(model, new Set());
      usage.get(model)!.add(operationName as OperationName);
    });
  }

  const result: UsageMap = {};
  for (const [model, ops] of usage.entries()) {
    result[model] = Array.from(ops.values()).sort();
  }
  return result;
}
