import { describe, it, mock, afterEach, beforeEach } from "node:test";
import * as assert from "node:assert";
import fs from "node:fs";
import sax from "sax";
import { extractScreenSnippets } from "../src/parser.js";

describe("Parser", () => {
  let logs: string[] = [];

  beforeEach(() => {
    logs = [];
    // Mute console output and capture it to verify warnings
    mock.method(console, "log", (msg?: string) => {
      if (msg) logs.push(msg.toString());
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("should extract only agama-json snippets by default", () => {
    mock.method(
      fs,
      "readFileSync",
      () => `
      <book>
        <screen language="agama-json">{"key": "value"}</screen>
        <screen language="bash">echo "hello"</screen>
        <screen>plain text</screen>
      </book>
    `
    );

    const snippets = extractScreenSnippets("test.xml");
    assert.strictEqual(snippets.length, 1);
    assert.strictEqual(snippets[0].language, "agama-json");
    assert.strictEqual(snippets[0].text, '{"key": "value"}');
    assert.strictEqual(snippets[0].file, "test.xml");
    assert.strictEqual(snippets[0].line, 3); // 0-indexed line + 1
  });

  it("should extract all snippets when 'all' flag is true", () => {
    mock.method(
      fs,
      "readFileSync",
      () => `
      <book>
        <screen language="agama-json">{"key": "value"}</screen>
        <screen language="bash">echo "hello"</screen>
        <screen>plain text</screen>
      </book>
    `
    );

    const snippets = extractScreenSnippets("test.xml", true);
    assert.strictEqual(snippets.length, 3);
    assert.strictEqual(snippets[0].language, "agama-json");
    assert.strictEqual(snippets[1].language, "bash");
    assert.strictEqual(snippets[2].language, undefined);
  });

  it("should extract snippets from the DocBook namespace", () => {
    mock.method(
      fs,
      "readFileSync",
      () => `
      <book xmlns="http://docbook.org/ns/docbook" xmlns:db="http://docbook.org/ns/docbook">
        <screen language="agama-json">{"default": "ns"}</screen>
        <db:screen language="agama-json">{"prefixed": "ns"}</db:screen>
      </book>
    `
    );

    const snippets = extractScreenSnippets("test.xml");
    assert.strictEqual(snippets.length, 2);
    assert.strictEqual(snippets[0].text, '{"default": "ns"}');
    assert.strictEqual(snippets[0].language, "agama-json");
    assert.strictEqual(snippets[1].text, '{"prefixed": "ns"}');
    assert.strictEqual(snippets[1].language, "agama-json");
  });

  it("should ignore <screen> tags from other namespaces", () => {
    mock.method(
      fs,
      "readFileSync",
      () => `
      <book xmlns="http://docbook.org/ns/docbook" xmlns:x="http://example.com/other">
        <x:screen language="agama-json">{"other": "ns"}</x:screen>
        <para xmlns="http://example.com/other">
          <screen language="agama-json">{"other": "default"}</screen>
        </para>
      </book>
    `
    );

    const snippets = extractScreenSnippets("test.xml", true);
    assert.strictEqual(snippets.length, 0);
  });

  it("should return an empty array if no screens are found", () => {
    mock.method(fs, "readFileSync", () => `<book><para>No screens here!</para></book>`);

    const snippets = extractScreenSnippets("test.xml");
    assert.strictEqual(snippets.length, 0);
  });

  it("should handle parser errors gracefully", () => {
    mock.method(fs, "readFileSync", () => `<screen language="agama-json">test</screen>`);

    // Force the SAX parser to throw an error when processing
    mock.method(sax, "parser", () => {
      const p = {
        line: 0,
        write: () => p, // Allow chaining for .write(content).close()
        close: () => {
          throw new Error("Simulated parse error");
        }
      };
      return p as any;
    });

    const snippets = extractScreenSnippets("broken.xml");
    assert.strictEqual(snippets.length, 0);
    assert.ok(
      logs.some((log) => log.includes("WARNING: parsing broken.xml failed: Simulated parse error"))
    );
  });
});
