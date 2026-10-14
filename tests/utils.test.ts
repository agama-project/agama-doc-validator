import { describe, it, mock, afterEach, beforeEach } from "node:test";
import * as assert from "node:assert";
import fs from "node:fs";
import { findXmlFiles, loadSchema } from "../src/utils.js";

describe("Utils", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  describe("findXmlFiles", () => {
    it("should return the file if a single XML file path is provided", () => {
      mock.method(fs, "statSync", () => {
        return { isFile: () => true, isDirectory: () => false } as fs.Stats;
      });

      const result = findXmlFiles("test.xml");
      assert.strictEqual(result.length, 1);
      assert.ok(result[0].endsWith("test.xml"));
    });

    it("should recursively find XML files in a directory", () => {
      mock.method(fs, "statSync", (p: string) => {
        const isDir = p.endsWith("dir") || p.endsWith("sub");
        return {
          isFile: () => !isDir,
          isDirectory: () => isDir
        } as fs.Stats;
      });

      mock.method(fs, "readdirSync", (p: string) => {
        if (p.endsWith("sub")) {
          return [{ name: "test3.xml", isFile: () => true, isDirectory: () => false }];
        } else if (p.endsWith("dir")) {
          return [
            { name: "test1.xml", isFile: () => true, isDirectory: () => false },
            { name: "test2.txt", isFile: () => true, isDirectory: () => false },
            { name: "sub", isFile: () => false, isDirectory: () => true }
          ];
        }
        return [];
      });

      const result = findXmlFiles("dir");
      assert.strictEqual(result.length, 2);
      assert.ok(result.some((r) => r.endsWith("test1.xml")));
      assert.ok(result.some((r) => r.endsWith("test3.xml")));
      assert.ok(!result.some((r) => r.endsWith("test2.txt")));
    });
  });

  describe("loadSchema", () => {
    beforeEach(() => {
      // Mute console.log to avoid spamming the test output during fetchSchema
      mock.method(console, "log", () => {});
    });

    it("should load a local schema and resolve references", async () => {
      mock.method(fs, "existsSync", () => true);
      mock.method(fs, "readFileSync", (p: string) => {
        if (p.endsWith("main.json")) {
          return JSON.stringify({
            $schema: "draft",
            type: "object",
            properties: { refData: { $ref: "sub.json" } }
          });
        } else if (p.endsWith("sub.json")) {
          return JSON.stringify({ type: "string" });
        }
        return "{}";
      });

      const schemas = await loadSchema("main.json");
      assert.strictEqual(schemas.length, 2);
      assert.strictEqual(schemas[0].schema.type, "object");
      assert.strictEqual(schemas[0].schema.$schema, undefined); // Should be deleted
      assert.strictEqual(schemas[1].schema.type, "string");
    });

    it("should fetch a schema from a URL and resolve references", async () => {
      mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("main.json")) {
          return {
            ok: true,
            json: async () => ({ type: "object", properties: { refData: { $ref: "sub.json" } } })
          } as Response;
        } else if (urlStr.endsWith("sub.json")) {
          return { ok: true, json: async () => ({ type: "string" }) } as Response;
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      });

      const schemas = await loadSchema("http://example.com/main.json");
      assert.strictEqual(schemas.length, 2);
      assert.strictEqual(schemas[0].uri, "http://example.com/main.json");
      assert.strictEqual(schemas[1].uri, "http://example.com/sub.json");
    });

    it("should fetch a schema using an alias", async () => {
      mock.method(
        globalThis,
        "fetch",
        async () => ({ ok: true, json: async () => ({}) }) as Response
      );
      mock.method(fs, "existsSync", () => false);

      const schemas = await loadSchema("latest");
      assert.strictEqual(schemas.length, 1);
      assert.match(schemas[0].uri, /nightly.*config\.schema\.json/);
    });

    it("should throw an error on fetch failure", async () => {
      mock.method(
        globalThis,
        "fetch",
        async () => ({ ok: false, statusText: "Not Found" }) as Response
      );
      await assert.rejects(
        async () => await loadSchema("http://example.com/missing.json"),
        /Not Found/
      );
    });
  });
});
