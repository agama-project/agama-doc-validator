# Guide: Documenting Agama JSON Profiles

The Agama Doc Validator automatically scans the DocBook XML files to ensure that any Agama
installation profile examples provided to users are perfectly valid and compliant with the Agama
profile JSON schema.

## Generic requirements

There are some generic rules about writing JSON documents so let's start with them.

### JSON syntax

The validator (and the Agama installer) uses a strict JSON parser. Be careful to avoid common syntax
mistakes that DocBook doesn't catch but a real JSON parser will reject:

- **No trailing commas:** `{"id": "SLES",}` will fail validation.
- **Double quotes only:** Always use double quotes (`"`) for keys and string values, never single
  quotes (`'`).
- **Avoid XML entities:** Avoid using XML entities (like `&productname;`) inside the Agama JSON
  examples, they are not expanded by the validator and it might report validation errors because of
  that.

### Schema compliance

Even if your JSON is syntactically correct, it must also match the Agama profile JSON schema. If you
document a property that requires a boolean but provide a string (e.g., `"autologin": "true"`
instead of `"autologin": true`), the validator will report it as a schema violation and point you to
the exact file and line number to fix it.

## Rules for documenting the Agama JSON profiles

The validator follows some specific rules when validating the profile examples. Here is how you
should format the Agama examples in the documentation:

### 1. Mark examples with the `agama-json` language

The validator **ignores all code snippets except those explicitly marked**. To have your JSON
snippet validated, you must wrap it in a `<screen>` tag with the `language="agama-json"` attribute.

The reason is that the `<screen>` tag is used in the documentation for many purposes, it can be used
for terminal output, shell scripts, shell commands, example configuration files, etc. To know which
blocks refer to an Agama autoinstallation JSON we need to mark them explicitly.

```xml
<screen language="agama-json">
{
  "product": {
    "id": "SLES"
  }
}
</screen>
```

_(Snippets marked as `language="json"`, `language="bash"`, or lacking a language attribute entirely
will be skipped during validation. This is useful if you ever need to document intentionally invalid
JSON or a JSON not intended for the Agama installer.)_

### 2. Partial JSON fragments are supported

You don't always have to write a full, top-level JSON object. If you are documenting a specific
nested property, you can write it as a fragment. The validator is smart enough to wrap a fragment in
curly braces `{}` before validating it.

This is equivalent to the previous example:

```xml
<screen language="agama-json">
"product": {
  "id": "SLES"
}
</screen>
```

### 3. Using `...` for omitted content

When writing large examples, you often want to omit irrelevant sections using `...`. The validator
automatically detects and removes the `...` placeholder before evaluating the JSON, so it won't
trigger a syntax error.

```xml
<screen language="agama-json">
"network": {
  ...
}
</screen>
```

## 4. Hiding outer parts of the JSON snippet with `<remark>`

Sometimes you might want to provide a fully valid JSON object for the validator, but hide the outer
structure (like parent keys or objects) from the reader so they can focus on a specific inner
property. You can achieve this by wrapping the hidden parts in a `<remark>` DocBook tag.

The validator automatically strips all XML tags (including `<remark>`) found inside a `<screen>`
block before validation, but it **keeps the text content** inside them. However, in the rendered
HTML or PDF documentation, the contents of the `<remark>` tag are not displayed.

This documentation snippet

```xml
<screen language="agama-json">
<remark>"storage": { "drives": [</remark>
{ "search": "/dev/sda" }
<remark>]}</remark>
</screen>
```

is validated as this JSON

```json
{
  "storage": { "drives": [{ "search": "/dev/sda" }] }
}
```

but it is rendered in the generated HTML and PDF documentation only as

```json
{ "search": "/dev/sda" }
```

## 5. Using the `<replaceable>` tags in examples

Because the validator ignores the nested XML tags (see the previous paragraph) you can also use the
`<replaceable>` tags in examples without any validation problems.

This documentation snippet

```xml
<screen language="agama-json">
"bootloader": {
  "timeout": <replaceable>5</replaceable>,
  "extraKernelParams": <replaceable>"quiet"</replaceable>
}
</screen>
```

is validated as this JSON

```json
{
  "bootloader": {
    "timeout": 5,
    "extraKernelParams": "quiet"
  }
}
```

and in the rendered documentation the marked parts are displayed using a different visual style.
