# Functions Per File Metric

### ID

`functions-per-file`

### Name

**Functions Per File**

### Description

Records all **named functions** found in each source file.
Each function is stored under its file path and mapped by its name to its **AST node**.

### Output Format (example)

```json
{
  "name": "Functions Per File",
  "description": "Records all named functions in each source file, mapping function names to their AST node",
  "result": {
    "/path/to/file.ts": {
      "foo": { "type": "FunctionDeclaration", "id": { "name": "foo" } },
      "bar": { "type": "FunctionExpression" },
      "add": { "type": "ArrowFunctionExpression" }
    },
    "/path/to/file.js": {
      "baz": { "type": "FunctionExpression" },
      "qux": { "type": "FunctionExpression", "id": { "name": "quxNamed" } }
    }
  },
  "status": true
}
```

### How it works

1. **Dependencies**

    * Requires the `files` metric to provide the list of files being analyzed.
2. **Function Declarations**

    * Captures standard named functions (`function foo() {}` or `async function bar() {}`).
    * Skips unnamed declarations.
3. **Function Expressions**

    * Detects functions assigned to variables (`const baz = function() {}`).
    * Only included if the variable name exists.
4. **Arrow Functions**

    * Captures named arrow functions when assigned to variables (`const add = (a, b) => a + b`).
    * Inline/anonymous arrows (e.g., `arr.map(x => x * 2)`) are ignored.
5. **Post-processing**

    * Removes temporary state (`currentFile`, `dependencies`).
    * Marks metric completion with `status = true`.

### Notes

* Functions are **grouped per file**.
* Each entry in a file’s object is keyed by the **function name**.
* The value is the **AST node** of that function (includes parameters, body, async/generator flags, etc.).
* Anonymous inline callbacks are intentionally excluded unless assigned to a named variable.

### Use cases

* Detect all **top-level named functions** in a codebase.
* Provide data for metrics like *functions per file count* or *async vs sync usage*.
* Enable downstream analysis of function complexity or parameter patterns.