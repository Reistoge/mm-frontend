# Files Metric

### ID

`files`

### Name

**Files on Repository**

### Description

Collects and records all source files in the repository by their path. The final result is a simple array of file paths that were discovered during AST traversal.

### Output Format (example)

```json
{
  "name": "Files on Repository",
  "description": "Collects and records all source files in the repository by their path.",
  "result": [
    "/home/daniel/Workspace/jtmetrics/test/test-src/files/JS/fileA.js",
    "/home/daniel/Workspace/jtmetrics/test/test-src/files/JS/subdir/fileB.js",
    "/home/daniel/Workspace/jtmetrics/test/test-src/files/TS/fileA.ts",
    "/home/daniel/Workspace/jtmetrics/test/test-src/files/TS/subdir/fileB.ts"
  ],
  "status": true
}
```

### How it works

1. **Traversal step (Program visitor)**

    * On each parsed file, the metric reads `path.node.filePath` and stores it in `state.currentFile`.
    * It adds an entry to `state.result` keyed by that file path (initially assigned an empty object).
2. **Post-processing**

    * Removes the temporary `currentFile` field from state.
    * Transforms `state.result` (an object keyed by file paths) into an **array** of keys: `Object.keys(state.result)`.
    * Filters out keys that are numeric-only (regex `/^\d+$/`) to avoid including numeric-only paths.
    * Sets `state.status = true` to mark completion.

### Notes

* The implementation accumulates file paths as object keys during traversal and converts them to an array at the end to produce a clean list.
* The filter `!/^\d+$/.test(k)` is used to exclude numeric-only keys from the final list.
* Paths in `result` are absolute.

### Use cases

* Produce a complete inventory of source files in a repository.
* Provide a file list for other metrics that require per-file mapping (e.g., classes-per-file, functions-per-file).