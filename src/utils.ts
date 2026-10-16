/**
 * @fileoverview Utility functions for finding XML files and loading/fetching JSON schemas.
 */

import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

export type Schema = any;

/**
 * Represents a loaded JSON schema definition and its URI.
 */
export interface SchemaDefinition {
  uri: string;
  schema: Schema;
}

/**
 * Recursively finds all `.xml` files in a directory, or returns the file if a single file is provided.
 *
 * @param {string} dirOrFile - The path to a directory or a single XML file.
 * @returns {string[]} An array of absolute paths to the found XML files.
 */
export function findXmlFiles(dirOrFile: string): string[] {
  const absolutePath = path.resolve(dirOrFile);
  const stats = fs.statSync(absolutePath);

  if (stats.isFile()) return [absolutePath];

  const files: string[] = [];
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...findXmlFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith(".xml")) {
      files.push(fullPath);
    }
  }
  return files;
}

// map some special names to Git branches
const ALIASES: Record<string, string> = {
  latest:
    "https://raw.githubusercontent.com/agama-project/agama-openapi/refs/heads/main/nightly/schemas/config.schema.json",
  "SLE-16.0":
    "https://raw.githubusercontent.com/agama-project/agama/refs/heads/SLE-16/rust/agama-lib/share/profile.schema.json",
  "SLE-16.1":
    "https://raw.githubusercontent.com/agama-project/agama/refs/heads/SLE-16.1/rust/share/profile.schema.json"
};

/**
 * Loads a JSON schema from a URL, local file path, or predefined alias.
 *
 * @param {string} schemaRef - The schema reference (URL, file path, or alias).
 * @returns {Promise<SchemaDefinition[]>} A promise resolving to an array of schema definitions.
 */
export async function loadSchema(schemaRef: string): Promise<SchemaDefinition[]> {
  // explicit URL
  if (schemaRef.startsWith("http://") || schemaRef.startsWith("https://")) {
    return await fetchSchema(schemaRef);
  }
  // local file
  else if (fs.existsSync(path.resolve(schemaRef))) {
    return await loadLocalSchema(schemaRef);
  }
  // Git branch name
  else {
    const url =
      ALIASES[schemaRef] ||
      `https://raw.githubusercontent.com/agama-project/agama/refs/heads/${schemaRef}/rust/share/profile.schema.json`;
    return await fetchSchema(url);
  }
}

/**
 * Loads a JSON schema from a local file and recursively fetches referenced schemas.
 *
 * @param {string} filePath - The local file path to the schema.
 * @param {Set<string>} visited - Already loaded schema paths, shared across recursive calls.
 * @returns {Promise<SchemaDefinition[]>} A promise resolving to an array of schema definitions.
 */
async function loadLocalSchema(
  filePath: string,
  visited: Set<string> = new Set()
): Promise<SchemaDefinition[]> {
  const absolutePath = path.resolve(filePath);
  visited.add(absolutePath);
  const content = fs.readFileSync(absolutePath, "utf-8");
  const json = JSON.parse(content);
  delete json.$schema;

  const result: SchemaDefinition[] = [
    {
      uri: absolutePath,
      schema: json
    }
  ];

  async function findReferences(data: Schema) {
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        // ignore relative references, process only JSON references
        if (
          key === "$ref" &&
          typeof value === "string" &&
          !value.startsWith("#") &&
          value.endsWith(".json")
        ) {
          const dir = path.dirname(absolutePath);
          const referencedPath = path.resolve(dir, value);

          // skip schemas already loaded (duplicate or circular references)
          if (!visited.has(referencedPath)) {
            const nestedData = await loadLocalSchema(referencedPath, visited);
            result.push(...nestedData);
          }
        }
        await findReferences(value);
      }
    }
  }

  await findReferences(json);
  return result;
}

/**
 * Fetches a JSON schema from a URL and recursively fetches referenced schemas.
 *
 * @param {string} url - The URL of the schema to download.
 * @param {Set<string>} visited - Already fetched schema URLs, shared across recursive calls.
 * @returns {Promise<SchemaDefinition[]>} A promise resolving to an array of schema definitions.
 */
async function fetchSchema(
  url: string,
  visited: Set<string> = new Set()
): Promise<SchemaDefinition[]> {
  visited.add(url);
  console.log(pc.gray(`Downloading ${url}...`));

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch schema ${url}: ${response.statusText}`);

  const json = await response.json();
  delete json.$schema;

  const result: SchemaDefinition[] = [
    {
      uri: url,
      schema: json
    }
  ];

  async function findReferences(data: Schema) {
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        // ignore relative references, process only JSON references
        if (
          key === "$ref" &&
          typeof value === "string" &&
          !value.startsWith("#") &&
          value.endsWith(".json")
        ) {
          // replace the base filename in the URL path
          const schemaUrl = new URL(url);
          const pathParts = schemaUrl.pathname.split("/");
          pathParts[pathParts.length - 1] = value;
          schemaUrl.pathname = pathParts.join("/");

          // skip schemas already fetched (duplicate or circular references)
          const nestedUrl = schemaUrl.toString();
          if (!visited.has(nestedUrl)) {
            const nestedData = await fetchSchema(nestedUrl, visited);
            result.push(...nestedData);
          }
        }
        await findReferences(value);
      }
    }
  }

  await findReferences(json);

  return result;
}
