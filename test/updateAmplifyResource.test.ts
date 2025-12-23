import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDisableOperations } from "../src/updateAmplifyResource";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("applyDisableOperations", () => {
  let tempDir: string;
  let resourcePath: string;
  let usagePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "amplify-test-"));
    resourcePath = path.join(tempDir, "resource.ts");
    usagePath = path.join(tempDir, "usage.json");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("simple a.model() pattern", () => {
    it("should add disableOperations to simple a.model() definition", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create", "list"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // create (mutation) and list (query) are used, so only subscriptions should be disabled
      expect(result).toContain('.disableOperations(["subscriptions"])');
    });

    it("should add disableOperations for all operations when no usage", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
  Post: a.model({
    title: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Post: ["create", "delete"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toContain('Todo: a.model');
      expect(result).toContain('.disableOperations(["queries","mutations","subscriptions"])');
    });

    it("should not add disableOperations when all operation types are used", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["get", "list", "create", "update", "delete", "onCreate"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).not.toContain("disableOperations");
    });
  });

  describe("chained method calls pattern", () => {
    it("should add disableOperations to a.model().authorization() chain", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toContain(".authorization((allow) => [allow.publicApiKey()])");
      expect(result).toContain('.disableOperations(["queries","subscriptions"])');
    });

    it("should handle multiple chained methods", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Post: a
    .model({
      title: a.string(),
      content: a.string(),
    })
    .authorization((allow) => [allow.owner()])
    .secondaryIndexes((index) => [index("title")]),
});
`;
      const usageContent = JSON.stringify({
        Post: ["get", "list"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toContain(".authorization((allow) => [allow.owner()])");
      expect(result).toContain('.secondaryIndexes((index) => [index("title")])');
      expect(result).toContain('.disableOperations(["mutations","subscriptions"])');
    });

    it("should add disableOperations at the end of the chain", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Comment: a
    .model({
      text: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});
`;
      const usageContent = JSON.stringify({
        Comment: ["onCreate", "observeQuery"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // observeQuery requires both queries and subscriptions to be enabled, so only mutations should be disabled
      expect(result).toContain('.disableOperations(["mutations"])');
      // disableOperations should be at the end
      const disableOpsIndex = result.indexOf('.disableOperations(');
      const authIndex = result.indexOf('.authorization(');
      expect(disableOpsIndex).toBeGreaterThan(authIndex);
    });
  });

  describe("mixed models", () => {
    it("should handle multiple models with different patterns", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
  Post: a
    .model({
      title: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
  Comment: a
    .model({
      text: a.string(),
    })
    .authorization((allow) => [allow.owner()])
    .secondaryIndexes((index) => [index("text")]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create", "list"],
        Post: ["get"],
        Comment: ["create", "update", "delete"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      
      // Todo: mutations (create) + queries (list) used, so only subscriptions disabled
      expect(result).toMatch(/Todo:.*\.disableOperations\(\["subscriptions"\]\)/s);
      
      // Post: only queries (get) used
      expect(result).toMatch(/Post:.*\.disableOperations\(\["mutations","subscriptions"\]\)/s);
      
      // Comment: all mutations (create, update, delete) used, so queries and subscriptions disabled
      expect(result).toMatch(/Comment:.*\.disableOperations\(\["queries","subscriptions"\]\)/s);
    });
  });

  describe("dry-run mode", () => {
    it("should not modify file in dry-run mode", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: true,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toBe(resourceContent);
      expect(result).not.toContain("disableOperations");
    });
  });

  describe("backup mode", () => {
    it("should create backup file when backup is enabled", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: true,
      });

      const backupPath = resourcePath + ".bak";
      expect(fs.existsSync(backupPath)).toBe(true);
      const backupContent = fs.readFileSync(backupPath, "utf8");
      expect(backupContent).toBe(resourceContent);
    });
  });

  describe("onExisting option", () => {
    it("should skip models that already have disableOperations when onExisting='skip' (default)", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .disableOperations(["mutations"]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
        onExisting: "skip",
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // Should not change the existing disableOperations
      expect((result.match(/disableOperations/g) || []).length).toBe(1);
      expect(result).toContain('.disableOperations(["mutations"])');
    });

    it("should overwrite existing disableOperations when onExisting='overwrite'", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .disableOperations(["mutations"]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
        onExisting: "overwrite",
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // Should replace mutations with queries,subscriptions (since create is used)
      expect((result.match(/disableOperations/g) || []).length).toBe(1);
      expect(result).not.toContain('.disableOperations(["mutations"])');
      expect(result).toContain('.disableOperations(["queries","subscriptions"])');
    });

    it("should merge existing and new disableOperations when onExisting='merge'", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .disableOperations(["mutations"]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["get"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
        onExisting: "merge",
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // Should merge mutations (existing) with mutations,subscriptions (new, since only get is used)
      // Result should be mutations,subscriptions
      expect((result.match(/disableOperations/g) || []).length).toBe(1);
      expect(result).toContain('.disableOperations(["mutations","subscriptions"])');
    });

    it("should merge without duplicates", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .disableOperations(["queries","mutations"]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["onCreate"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
        onExisting: "merge",
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // Should merge [queries,mutations] (existing) with [queries,mutations] (new, since only onCreate is used)
      // Result should be queries,mutations (no duplicates)
      expect((result.match(/disableOperations/g) || []).length).toBe(1);
      expect(result).toContain('.disableOperations(["queries","mutations"])');
    });

    it("should handle merge with chained methods", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()])
    .disableOperations(["subscriptions"]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["get"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
        onExisting: "merge",
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // Should merge subscriptions (existing) with mutations,subscriptions (new, since only get is used)
      // Result should be mutations,subscriptions (order may vary due to Set)
      expect(result).toContain(".authorization((allow) => [allow.publicApiKey()])");
      expect(result).toMatch(/\.disableOperations\(\["(subscriptions","mutations|mutations","subscriptions)"\]\)/);
    });

    it("should handle overwrite with chained methods", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Post: a
    .model({
      title: a.string(),
    })
    .authorization((allow) => [allow.owner()])
    .disableOperations(["queries"])
    .secondaryIndexes((index) => [index("title")]),
});
`;
      const usageContent = JSON.stringify({
        Post: ["list"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
        onExisting: "overwrite",
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // Should replace queries with mutations,subscriptions (since list is used)
      expect(result).toContain(".authorization((allow) => [allow.owner()])");
      expect(result).toContain('.secondaryIndexes((index) => [index("title")])');
      expect(result).toContain('.disableOperations(["mutations","subscriptions"])');
      // disableOperations should now be at the end after removal and re-addition
      const disableIndex = result.lastIndexOf('.disableOperations(');
      const secondaryIndex = result.lastIndexOf('.secondaryIndexes(');
      expect(disableIndex).toBeGreaterThan(secondaryIndex);
    });
  });

  describe("edge cases", () => {
    it("should skip models that already have disableOperations", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .disableOperations(["mutations"]),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // Should not add another disableOperations
      expect((result.match(/disableOperations/g) || []).length).toBe(1);
    });

    it("should handle quoted model names", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  "Todo": a.model({
    content: a.string(),
  }),
  'Post': a.model({
    title: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create"],
        Post: ["get"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toContain("disableOperations");
      // Should have 2 disableOperations calls
      expect((result.match(/disableOperations/g) || []).length).toBe(2);
    });
  });

  describe("operation type grouping", () => {
    it("should disable only queries when only mutations and subscriptions are used", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["create", "delete", "onCreate"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toContain('.disableOperations(["queries"])');
    });

    it("should disable only mutations when only queries and subscriptions are used", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["get", "list", "observeQuery"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toContain('.disableOperations(["mutations"])');
    });

    it("should disable only subscriptions when only queries and mutations are used", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["get", "create", "update"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      expect(result).toContain('.disableOperations(["subscriptions"])');
    });

    it("should not disable queries when only observeQuery is used", () => {
      const resourceContent = `import { a } from "@aws-amplify/backend";

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
  }),
});
`;
      const usageContent = JSON.stringify({
        Todo: ["observeQuery"],
      });

      fs.writeFileSync(resourcePath, resourceContent, "utf8");
      fs.writeFileSync(usagePath, usageContent, "utf8");

      applyDisableOperations({
        resourcePath,
        usagePath,
        dryRun: false,
        backup: false,
      });

      const result = fs.readFileSync(resourcePath, "utf8");
      // observeQuery requires both queries and subscriptions to be enabled
      expect(result).toContain('.disableOperations(["mutations"])');
      expect(result).not.toContain('"queries"');
      expect(result).not.toContain('"subscriptions"');
    });
  });
});
