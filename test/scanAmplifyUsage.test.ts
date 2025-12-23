import { describe, it, expect } from "vitest";
import { scanAmplifyUsage } from "../src/scanAmplifyUsage";
import path from "node:path";
import posix from "node:path/posix";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toPosixPath = (p: string) => p.split(path.sep).join(posix.sep);

describe("scanAmplifyUsage", () => {
  describe("same file usage", () => {
    it("should detect operations in the same file as generateClient", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "same-file",
        "tsconfig.json"
      );
      const result = scanAmplifyUsage({ tsconfigPath });

      // Both app.ts and component.tsx are scanned
      expect(result).toEqual({
        Todo: ["create", "delete", "get", "list", "observeQuery"],
        Post: ["delete", "update"],
      });
    });

    it("should detect operations in tsx files with generateClient", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "same-file",
        "tsconfig.json"
      );
      const includeGlobs = [
        posix.join(toPosixPath(__dirname), "fixtures/same-file/**/*.tsx"),
      ];
      const result = scanAmplifyUsage({
        tsconfigPath,
        includeGlobs,
      });

      expect(result).toEqual({
        Todo: ["create", "delete", "observeQuery"],
      });
    });
  });

  describe("cross file usage", () => {
    it("should detect operations using exported and imported client", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "cross-file",
        "tsconfig.json"
      );
      const result = scanAmplifyUsage({ tsconfigPath });

      expect(result).toEqual({
        Comment: ["create", "observeQuery"],
        Post: ["create", "delete", "onCreate"],
        Todo: ["create", "list", "update"],
      });
    });

    it("should detect operations in specific service file", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "cross-file",
        "tsconfig.json"
      );
      const includeGlobs = [
        posix.join(
          toPosixPath(__dirname),
          "fixtures/cross-file/amplify-client.ts"
        ),
        posix.join(
          toPosixPath(__dirname),
          "fixtures/cross-file/todo-service.ts"
        ),
      ];
      const result = scanAmplifyUsage({
        tsconfigPath,
        includeGlobs,
      });

      expect(result).toEqual({
        Todo: ["create", "list", "update"],
      });
    });

    it("should handle aliased imports", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "cross-file",
        "tsconfig.json"
      );
      const includeGlobs = [
        posix.join(
          toPosixPath(__dirname),
          "fixtures/cross-file/amplify-client.ts"
        ),
        posix.join(
          toPosixPath(__dirname),
          "fixtures/cross-file/comment-component.tsx"
        ),
      ];
      const result = scanAmplifyUsage({
        tsconfigPath,
        includeGlobs,
      });

      expect(result).toEqual({
        Comment: ["create", "observeQuery"],
      });
    });
  });

  describe("mixed usage", () => {
    it("should detect both local and imported client usage", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "mixed",
        "tsconfig.json"
      );
      const result = scanAmplifyUsage({ tsconfigPath });

      expect(result).toEqual({
        Todo: ["create", "list"],
        Post: ["create", "delete"],
      });
    });

    it("should correctly separate operations from different clients", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "mixed",
        "tsconfig.json"
      );
      const includeGlobs = [
        posix.join(toPosixPath(__dirname), "fixtures/mixed/client.ts"),
        posix.join(toPosixPath(__dirname), "fixtures/mixed/service.ts"),
      ];
      const result = scanAmplifyUsage({
        tsconfigPath,
        includeGlobs,
      });

      // Both local and shared client operations should be detected
      expect(result.Todo).toBeDefined();
      expect(result.Todo).toContain("create");
      expect(result.Todo).toContain("list");
      expect(result.Post).toBeDefined();
      expect(result.Post).toContain("create");
      expect(result.Post).toContain("delete");
    });
  });

  describe("edge cases", () => {
    it("should return empty object when no operations are found", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "cross-file",
        "tsconfig.json"
      );
      const includeGlobs = [
        posix.join(
          toPosixPath(__dirname),
          "fixtures/cross-file/amplify-client.ts"
        ),
      ];
      const result = scanAmplifyUsage({
        tsconfigPath,
        includeGlobs,
      });

      expect(result).toEqual({});
    });

    it("should handle multiple operations on the same model", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "same-file",
        "tsconfig.json"
      );
      const includeGlobs = [
        posix.join(toPosixPath(__dirname), "fixtures/same-file/app.ts"),
      ];
      const result = scanAmplifyUsage({
        tsconfigPath,
        includeGlobs,
      });

      expect(result.Todo).toHaveLength(3);
      expect(result.Todo).toContain("create");
      expect(result.Todo).toContain("list");
      expect(result.Todo).toContain("get");
    });
  });

  describe("function client usage", () => {
    it("should detect operations using client returned from function", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "function-client",
        "tsconfig.json"
      );
      const result = scanAmplifyUsage({ tsconfigPath });

      expect(result).toEqual({
        Todo: ["list"],
        Post: ["create"],
      });
    });

    it("should handle async function calls with await", () => {
      const tsconfigPath = path.join(
        __dirname,
        "fixtures",
        "function-client",
        "tsconfig.json"
      );
      const includeGlobs = [
        posix.join(
          toPosixPath(__dirname),
          "fixtures/function-client/amplify-client.ts"
        ),
        posix.join(
          toPosixPath(__dirname),
          "fixtures/function-client/service.ts"
        ),
      ];
      const result = scanAmplifyUsage({
        tsconfigPath,
        includeGlobs,
      });

      expect(result.Todo).toBeDefined();
      expect(result.Todo).toContain("list");
      expect(result.Post).toBeDefined();
      expect(result.Post).toContain("create");
    });
  });
});
