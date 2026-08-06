# File Coupling Metric

### ID

`file-coupling`

### Name

**File Coupling**

### Description

Measures **file-level coupling** by computing each file’s **fan-in** (dependent files) and **fan-out** (dependencies).

* **Fan-Out**: files that the current file imports or requires.
* **Fan-In**: files that depend on the current file (other files importing it).

### Output Format (example)

```json
{
  "name": "File Coupling",
  "description": "Measures file-level coupling by computing each file’s fan-in (dependent files) and fan-out (dependencies)",
  "result": {
    "/path/to/app.ts": {
      "fanOut": ["/path/to/utils/index.ts"],
      "fanIn": []
    },
    "/path/to/utils/index.ts": {
      "fanOut": [],
      "fanIn": ["/path/to/app.ts"]
    }
  },
  "status": true
}
```

### How it works

1. **Dependencies**

    * Requires the `files` metric to know all files in the repository.
2. **Traversal**

    * Detects all **import statements** (`import ... from`), **require calls**, and **TypeScript `import=` declarations**.
    * Resolves relative or absolute paths to real files using `resolveImportPath`.
3. **Fan-Out Recording**

    * Stores each resolved import/require in the `fanOut` array of the current file.
4. **Fan-In Recording**

    * Builds `fanIn` arrays by keeping track of which files import the current file.
5. **Post-processing**

    * Normalizes the results into `{ fanOut: [...], fanIn: [...] }` per file.
    * Cleans temporary state (`currentFile`, `dependencies`) and sets `status` to true.

### Notes

* Only considers local files (`.` or `/`)—external packages are ignored.
* Tries `.js`, `.cjs`, `.ts`, `.jsx`, `.tsx`, `.json` extensions and `index.*` in directories.
* Useful to identify **highly dependent files**, **core modules**, or **potential bottlenecks**.