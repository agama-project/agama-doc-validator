import { describe, it } from "node:test";
import * as assert from "node:assert";
import { analyzeSnippet } from "../src/heuristics.js";

describe("Heuristics Engine", () => {
  it("should handle empty or whitespace text", () => {
    assert.deepStrictEqual(analyzeSnippet("   "), { isJson: false });
    assert.deepStrictEqual(analyzeSnippet("   ", true), {
      isJson: true,
      error: "Unexpected end of JSON input"
    });
  });

  it("should reject known non-JSON snippets", () => {
    assert.deepStrictEqual(analyzeSnippet("&prompt.sudo; systemctl start agama"), {
      isJson: false
    });
    assert.deepStrictEqual(analyzeSnippet("</screen>"), { isJson: false });
    assert.deepStrictEqual(analyzeSnippet('"ignition": { "version": "3.1.0" }'), { isJson: false });
  });

  it("should reject INI file formats", () => {
    const iniText = `[main]\nkey=value`;
    assert.deepStrictEqual(analyzeSnippet(iniText), { isJson: false });
  });

  it("should wrap and parse JSON fragments", () => {
    const fragment = '"name": "agama"';
    const result = analyzeSnippet(fragment);
    assert.strictEqual(result.isJson, true);
    assert.deepStrictEqual(result.parsed, { name: "agama" });
  });

  it("should not treat single-quoted fragments as JSON", () => {
    assert.deepStrictEqual(analyzeSnippet("'name': 'agama'"), { isJson: false });

    // when forced, parse as-is without wrapping in {}
    const result = analyzeSnippet("'name': 'agama'", true);
    assert.strictEqual(result.isJson, true);
    assert.ok(result.error);
  });

  it("should parse valid JSON objects and arrays", () => {
    const objResult = analyzeSnippet('{"product": "SLES"}');
    assert.strictEqual(objResult.isJson, true);
    assert.deepStrictEqual(objResult.parsed, { product: "SLES" });
  });

  it("should return an error for malformed JSON", () => {
    const result = analyzeSnippet('{"product": "SLES", }'); // trailing comma is invalid
    assert.strictEqual(result.isJson, true);
    // just check that an error message was returned
    assert.ok(result.error);
  });

  it("should bypass heuristics if forceJson is true", () => {
    // Normally rejected because it doesn't start with { or [ or "
    const text = "invalid json";
    const result = analyzeSnippet(text, true);
    assert.strictEqual(result.isJson, true);
    assert.ok(result.error);
  });

  it("should remove '...' placeholders before parsing", () => {
    const text = '{ "name": "agama" ... }';
    const result = analyzeSnippet(text);
    assert.strictEqual(result.isJson, true);
    assert.deepStrictEqual(result.parsed, { name: "agama" });
  });
});
