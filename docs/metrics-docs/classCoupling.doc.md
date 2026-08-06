# Class Coupling Metric

### ID

`class-coupling`

### Name

**Class Coupling**

### Description

Analyzes each class to identify **fan-out** (methods called from other classes) and **fan-in** (methods called by other classes).
This metric provides a **method-level dependency map** between classes to understand coupling in the codebase.

* **Fan-Out**: methods in the current class that call methods of other classes.
* **Fan-In**: methods in the current class that are called by methods of other classes.

### Output Format (example)

```json
{
  "name": "Class Coupling",
  "description": "Analyzes each class to identify Fan-Out and Fan-In",
  "result": {
    "/path/to/DeclaredClass.ts": {
      "DeclaredClass": [
        {
          "type": "ClassMethod",
          "key": { "type": "Identifier", "name": "declaredMethod" },
          "params": [],
          "body": { "type": "BlockStatement", "body": [] },
          "fan-in": {
            "ExpressedClass": { "expressedMethod": 2 }
          }
        }
      ]
    },
    "/path/to/ExpressedClass.ts": {
      "ExpressedClass": [
        {
          "type": "ClassMethod",
          "key": { "type": "Identifier", "name": "constructor" },
          "params": [],
          "body": { "type": "BlockStatement", "body": [] }
        },
        {
          "type": "ClassMethod",
          "key": { "type": "Identifier", "name": "expressedMethod" },
          "params": [],
          "body": { "type": "BlockStatement", "body": [] },
          "fan-out": {
            "DeclaredClass": { "declaredMethod": 2 }
          }
        }
      ]
    }
  },
  "status": true
}
```

### How it works

1. **Dependencies**

    * Requires `classes-per-file` to know all classes and their methods.
    * Requires `instance-mapper` to resolve which instances belong to which classes.

2. **Traversal**

    * Detects **ClassExpression** assigned to variables.
    * Traverses each class for:

        * **ClassMethod**
        * **ClassProperty** containing `ArrowFunctionExpression` or `FunctionExpression`.

3. **Fan-Out Recording**

    * For each **NewExpression** (e.g., `new ClassF()`), maps to the constructor (`_constructor`) of the instantiated class.
    * For each **CallExpression**:

        * Resolves method calls on instances and direct class calls.
        * Handles `this.property.method()` patterns using `instance-mapper`.
    * Increments `fan-out` counts for the caller method toward the callee method.

4. **Fan-In Recording**

    * Automatically updates `fan-in` for callee methods based on the caller’s fan-out.

5. **Post-processing**

    * Cleans temporary fields (`currentFile`, `dependencies`) and sets `status` to true.

### Notes

* Tracks **method-level dependencies**, not just class-level.
* Handles both **methods** and **function properties** inside classes.
* `_constructor` is used internally to avoid collisions with JavaScript’s reserved `constructor`.
* Useful to identify:

    * Highly coupled classes
    * Potential refactoring opportunities
    * Method-level dependencies for architectural analysis

### Use cases

* Measure **class coupling** to assess maintainability and modularity.
* Detect **fan-in hotspots** (methods heavily used by others) and **fan-out responsibilities** (methods calling many external methods).
* Serves as input for higher-level analysis, such as **system complexity** or **dependency graphs**.