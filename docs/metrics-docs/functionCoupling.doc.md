# Function Coupling Metric

### ID

`function-coupling`

### Name

**Function Coupling**

### Description

Measures **function-level coupling** by recording **Fan-In** and **Fan-Out** relationships between functions.

* **Fan-Out**: functions called by the current function.
* **Fan-In**: functions that call the current function.

### Output Format (example)

```json
{
  "name": "Function Coupling",
  "description": "Measures function-level coupling by recording Fan-In and Fan-Out relationships between functions",
  "result": {
    "/path/to/file.js": {
      "foo": {
        "type": "FunctionDeclaration",
        "fan-out": { "bar": 2, "baz": 1 },
        "fan-in": { "qux": 1 }
      },
      "bar": {
        "type": "FunctionExpression",
        "fan-out": { "baz": 1 },
        "fan-in": { "foo": 2 }
      }
    },
    "/path/to/anotherFile.ts": {
      "baz": {
        "type": "ArrowFunctionExpression",
        "fan-out": {},
        "fan-in": { "foo": 1, "bar": 1 }
      }
    }
  },
  "status": true
}
```

### How it works

1. **Dependencies**

    * Requires the `functions-per-file` metric to know all functions in the repository.
2. **Traversal**

    * For each function declaration, expression, or arrow function assigned to a variable:

        * Traverse all **CallExpression** nodes inside the function body.
        * Detect if the called function exists in the repository (within files of the same extension).
3. **Fan-Out Recording**

    * For each call found, increment the **fan-out** counter for the caller function.
4. **Fan-In Recording**

    * For each call found, increment the **fan-in** counter for the callee function.
5. **Scope Limitations**

    * Only considers calls to **named functions**.
    * Calls to anonymous inline functions or external libraries are ignored.
6. **Post-processing**

    * Cleans temporary state (`currentFile`, `dependencies`) and marks metric completion.

### Notes

* Provides a **per-file and per-function mapping** of coupling relationships.
* Useful to compute metrics like **fan-in/fan-out counts**, detect **highly coupled functions**, or analyze **modularity**.