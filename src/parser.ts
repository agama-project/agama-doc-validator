/**
 * @fileoverview Extracts XML `<screen>` snippets from DocBook files using a SAX parser.
 */

import fs from "node:fs";
import sax from "sax";
import pc from "picocolors";

// DocBook 5 XML namespace
const DOCBOOK_NS = "http://docbook.org/ns/docbook";

/**
 * Represents an extracted snippet from a `<screen>` tag.
 */
export interface ScreenSnippet {
  file: string;
  line: number;
  text: string;
  language?: string;
}

/**
 * Extracts the text content of `<screen>` tags from a given XML file.
 *
 * @param {string} filePath - The path to the XML file to parse.
 * @param {boolean} [all=false] - If true, extracts all `<screen>` tags regardless of the language attribute.
 * @returns {ScreenSnippet[]} An array of extracted screen snippets.
 */
export function extractScreenSnippets(filePath: string, all: boolean = false): ScreenSnippet[] {
  const snippets: ScreenSnippet[] = [];
  const content = fs.readFileSync(filePath, "utf-8");

  // Using non-strict mode to avoid crashing on DocBook custom entities (e.g. &prompt.sudo;)
  const parser = sax.parser(false, { lowercase: true, xmlns: true });
  let inScreen = false;
  let currentText = "";
  let startLine = 0;
  let currentLanguage: string | undefined = undefined;
  // the qualified name of the opened <screen> tag (might include a namespace prefix)
  let screenTag = "";

  parser.onopentag = (node) => {
    // with the "xmlns: true" option all tags are qualified, accept the DocBook 5 namespace
    // and also the namespace-less files (DocBook 4)
    if ("uri" in node && node.local === "screen" && (node.uri === DOCBOOK_NS || node.uri === "")) {
      const lang = node.attributes.language?.value;
      const isAgamaJson = lang === "agama-json";
      if (all || isAgamaJson) {
        inScreen = true;
        screenTag = node.name;
        currentText = "";
        startLine = parser.line;
        currentLanguage = lang;
      }
    }
  };

  parser.ontext = (text) => {
    if (inScreen) {
      // TODO: what about the XML entities, replace them?
      // currentText += text.replace(/&[a-zA-Z0-9_.-]+;/g, '"__ENTITY__"');
      currentText += text;
    }
  };

  parser.onclosetag = (name) => {
    if (inScreen && name === screenTag) {
      inScreen = false;

      snippets.push({
        file: filePath,
        line: startLine + 1, // sax parser lines are 0-indexed
        text: currentText,
        language: currentLanguage
      });
    }
  };

  try {
    parser.write(content).close();
  } catch (error: any) {
    // Continue if the parser crashes to check all files
    console.log(pc.yellowBright(`WARNING: parsing ${filePath} failed: ${error?.message}`));
  }

  return snippets;
}
