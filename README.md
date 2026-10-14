# Agama Doc Validator

[![Continuous Integration](https://github.com/lslezak/agama-doc-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/lslezak/agama-doc-validator/actions/workflows/ci.yml)
[![Check Transpiled JavaScript](https://github.com/lslezak/agama-doc-validator/actions/workflows/check-dist.yml/badge.svg)](https://github.com/lslezak/agama-doc-validator/actions/workflows/check-dist.yml)

The **Agama Doc Validator** is a CLI tool designed to scan DocBook XML files, automatically identify
JSON snippets within `<screen>` tags, and validate them against an Agama Profile JSON Schema.

This tool is particularly useful for ensuring that documentation examples containing Agama profiles
are syntactically correct and adhere to the schema definitions.

## Features

- **Fast SAX Parsing**: Safely extracts `<screen>` content from DocBook XML files.
- **Heuristics Engine**: Automatically detects if a snippet inside a `<screen>` tag is a JSON object
  or array, handles also partial JSON fragments.
- **Schema Validation**: Validates the extracted JSON against a provided JSON Schema (supports local
  files, URLs, or predefined aliases).
- **Reporting**: Outputs detailed file names, line numbers, and exact validation errors.

## Prerequisites

- Node.js (v22 or higher recommended)
- `npm` (comes with Node.js)

## Installation & Build

1. Navigate to the tool directory:

   ```bash
   cd agama-doc-validator
   ```

2. Install dependencies:

   ```bash
   npm ci
   ```

## Usage

You can run the tool directly using `npm start` (which uses `tsx` to run the TypeScript file
directly). The command line options are described below.

```bash
# Using npm start (pass arguments after --)
npm start -- -i <path> -s <schema>
```

Alternatively you can compile the TypeScript and bundle all dependencies.

```bash
npm run bundle
```

The bundled script can be executed directly.

```bash
./bundle/agama-doc-validator.js -i <path> -s <schema>
```

### CLI Options

| Option | Long Option      | Description                                                                                                    |
| :----- | :--------------- | :------------------------------------------------------------------------------------------------------------- |
| `-i`   | `--input <path>` | Path to a single DocBook XML file or a directory to scan recursively. Default: the current directory           |
| `-s`   | `--schema <ref>` | Path, URL, or predefined alias (Git branch) to the target JSON Schema. Default: "latest"                       |
| `-v`   | `--verbose`      | Print out every file being processed and detailed results.                                                     |
| `-a`   | `--all`          | Process all `<screen>` blocks in the documents, guess which might be JSON and validate them.                   |
| `-m`   | `--missing`      | Scan for missing `language="agama-json"` attribute in `<screen>` blocks which validate against the JSON schema |
| `-h`   | `--help`         | Display usage information and exit.                                                                            |

### Schema Aliases

The tool comes with predefined aliases for quick validation against official Agama schemas:

- `latest` : Fetches the latest Agama profile schema from the GitHub master branch. This is for the
  currently developed product release.
- `SLE-16.1` : Fetches the Agama profile for the SLE-16.1 and openSUSE Leap 16.1 product
- `SLE-16.0` : Fetches the Agama profile for the SLE-16.0 and openSUSE Leap 16.0 product

Other aliases are mapped to the Agama GitHub repository branches.

## GitHub Action

The repository contains also a GitHub Action so it can be used as a CI check in pull requests.

Example usage:

```yaml
name: Validate Documentation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate-xml:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v7

      # this validates all <screen language="agama-json"> blocks in the documents
      - name: Run Agama JSON Validator
        uses: lslezak/agama-doc-validator@v1

      # this validates all <screen> blocks without "language=" attribute
      - name: Run Agama JSON Validator
        uses: lslezak/agama-doc-validator@v1
        with:
          mode: missing
```

See the [action.yml](action.yml) file for more details.

## Development

### Updating the built script

After doing any change in the code or after updating the dependencies you need to rebuild the
content of the `dist/` directory, simply run `npm run package`.

To ensure you do not forget doing this the `npm install` call installs a Git pre-push hook which
checks that everything is OK.

### Links

- [Creating a JavaScript Action](https://docs.github.com/en/actions/tutorials/create-actions/create-a-javascript-action)
- [Template for a TypeScript Action](https://github.com/actions/typescript-action)
- [Actions Toolkit library](https://github.com/actions/toolkit/)
- [Example actions/checkout](https://github.com/actions/checkout)
