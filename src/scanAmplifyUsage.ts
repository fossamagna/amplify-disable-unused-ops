import { Project, Node, SourceFile } from "ts-morph";
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

interface ExportedClient {
  filePath: string;
  localName: string;
  exportedName: string;
  type: 'variable' | 'function';
}

export function scanAmplifyUsage(options: ScanOptions): UsageMap {
  const project = new Project({ tsConfigFilePath: options.tsconfigPath });
  const usage = new Map<string, Set<OperationName>>();
  const sourceFiles = options.includeGlobs
    ? project.getSourceFiles(options.includeGlobs)
    : project.getSourceFiles(["**/*.ts", "**/*.tsx"]);

  // Step 1: Find all exported clients that are created with generateClient
  const exportedClients: ExportedClient[] = [];
  
  // Helper function to check if a function returns generateClient
  const functionReturnsGenerateClient = (funcNode: Node): boolean => {
    let returnsGenerateClient = false;
    funcNode.forEachDescendant((descendant) => {
      if (Node.isReturnStatement(descendant)) {
        const expr = descendant.getExpression();
        if (expr && Node.isCallExpression(expr)) {
          const callExpr = expr.getExpression();
          if (Node.isIdentifier(callExpr) && callExpr.getText() === "generateClient") {
            returnsGenerateClient = true;
          }
        }
      }
    });
    return returnsGenerateClient;
  };
  
  for (const sf of sourceFiles) {
    sf.forEachDescendant((node) => {
      if (Node.isVariableDeclaration(node)) {
        const init = node.getInitializer();
        if (init && Node.isCallExpression(init)) {
          const expr = init.getExpression();
          if (Node.isIdentifier(expr) && expr.getText() === "generateClient") {
            const nameNode = node.getNameNode();
            if (Node.isIdentifier(nameNode)) {
              const localName = nameNode.getText();
              // Check if this variable is exported
              const variableStatement = node.getVariableStatement();
              if (variableStatement?.isExported()) {
                exportedClients.push({
                  filePath: sf.getFilePath(),
                  localName,
                  exportedName: localName,
                  type: 'variable',
                });
              }
            }
          }
        }
      }
      
      // Check for exported functions that return generateClient
      if (Node.isFunctionDeclaration(node)) {
        if (node.isExported() && functionReturnsGenerateClient(node)) {
          const name = node.getName();
          if (name) {
            exportedClients.push({
              filePath: sf.getFilePath(),
              localName: name,
              exportedName: name,
              type: 'function',
            });
          }
        }
      }
      
      // Also check for named exports
      if (Node.isExportSpecifier(node)) {
        const name = node.getName();
        const aliasNode = node.getAliasNode();
        const exportedName = aliasNode ? aliasNode.getText() : name;
        
        // Check if this export refers to a generateClient variable
        const sourceFile = node.getSourceFile();
        const variableDeclaration = sourceFile.getVariableDeclaration(name);
        if (variableDeclaration) {
          const init = variableDeclaration.getInitializer();
          if (init && Node.isCallExpression(init)) {
            const expr = init.getExpression();
            if (Node.isIdentifier(expr) && expr.getText() === "generateClient") {
              exportedClients.push({
                filePath: sourceFile.getFilePath(),
                localName: name,
                exportedName,
                type: 'variable',
              });
            }
          }
        }
        
        // Check if this export refers to a function that returns generateClient
        const functionDeclaration = sourceFile.getFunction(name);
        if (functionDeclaration && functionReturnsGenerateClient(functionDeclaration)) {
          exportedClients.push({
            filePath: sourceFile.getFilePath(),
            localName: name,
            exportedName,
            type: 'function',
          });
        }
      }
    });
  }

  // Step 2: For each source file, collect client variables (both local and imported)
  for (const sf of sourceFiles) {
    const clientVars = new Set<string>();
    const clientFunctions = new Set<string>();

    // Find local generateClient calls
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
    
    // Find local functions that return generateClient
    sf.forEachDescendant((node) => {
      if (Node.isFunctionDeclaration(node) && functionReturnsGenerateClient(node)) {
        const name = node.getName();
        if (name) clientFunctions.add(name);
      }
    });

    // Find imported clients and functions
    for (const importDecl of sf.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierSourceFile();
      if (!moduleSpecifier) continue;
      
      const importPath = moduleSpecifier.getFilePath();
      
      // Check if this import is importing an exported client or function
      for (const namedImport of importDecl.getNamedImports()) {
        const importedName = namedImport.getName();
        const aliasNode = namedImport.getAliasNode();
        const localName = aliasNode ? aliasNode.getText() : importedName;
        
        // Check if this matches any exported client
        const matchingExport = exportedClients.find(
          (ec) => ec.filePath === importPath && ec.exportedName === importedName
        );
        
        if (matchingExport) {
          if (matchingExport.type === 'variable') {
            clientVars.add(localName);
          } else if (matchingExport.type === 'function') {
            clientFunctions.add(localName);
          }
        }
      }
    }
    
    // Find variables that are assigned the result of calling a client function
    sf.forEachDescendant((node) => {
      if (Node.isVariableDeclaration(node)) {
        const init = node.getInitializer();
        if (init) {
          // Handle direct function call: const client = createAmplifyClient()
          let callExpr = init;
          
          // Handle await: const client = await createAmplifyClient()
          if (Node.isAwaitExpression(init)) {
            const awaitedExpr = init.getExpression();
            if (Node.isCallExpression(awaitedExpr)) {
              callExpr = awaitedExpr;
            }
          }
          
          if (Node.isCallExpression(callExpr)) {
            const expr = callExpr.getExpression();
            if (Node.isIdentifier(expr) && clientFunctions.has(expr.getText())) {
              const nameNode = node.getNameNode();
              if (Node.isIdentifier(nameNode)) {
                clientVars.add(nameNode.getText());
              }
            }
          }
        }
      }
    });

    // Step 3: Scan for operation usages with any of the client variables
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
