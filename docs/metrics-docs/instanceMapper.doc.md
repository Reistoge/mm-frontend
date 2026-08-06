# Instance Mapper Metric

### ID

`instance-mapper`

### Name

**Instance Mapper**

### Description

Walks through **each class method** to identify **instance accesses** (`this.prop`) and **local variable instances**, mapping them to their **constructor types**.

* Detects `new ClassName()` inside:

    * `this.prop = new ClassName()`
    * `const/let varName = new ClassName()`
* Tracks instance properties and local variables for all class declarations and expressions.

### Output Format (example)

```json
{
  "name": "Instance Mapper",
  "description": "Walks through each class method to identify instance accesses (this.prop and local variables) and map them to their constructor types",
  "result": {
    "/path/to/defaultClass.ts": {
      "defaultClass": {
        "this.foo": "AClass",
        "constFoo": "AClass",
        "letFoo": "AClass",
        "this.bar": "AClass",
        "constBar": "AClass",
        "letBar": "AClass"
      }
    },
    "/path/to/instances.ts": {
      "AClass": {
        "this.fooB": "BClass",
        "constFooB": "BClass",
        "letFooB": "BClass"
      },
      "BClass": {
        "this.fooC": "CClass",
        "constFooC": "CClass",
        "letFooC": "CClass"
      }
    }
  },
  "ignore": true,
  "status": true
}
```

### How it works

1. **Dependencies**

    * Operates **per file**, does not depend on other metrics.
2. **Class Traversal**

    * Handles `ClassDeclaration`, `ClassExpression`, and `ExportDefaultDeclaration`.
    * Ignores inline or anonymous classes inside IIFEs or nested class expressions.
3. **Instance Detection**

    * Traverses `ClassMethod` and `ClassProperty` nodes.
    * Detects `NewExpression` assigned to:

        * `this.prop` → mapped as `"this.prop": "ConstructorName"`
        * Local variables (`const`/`let`) → mapped as `"varName": "ConstructorName"`
4. **Mapping**

    * Maps all instances created inside a class method or property to the constructor name.
    * Works for arrow functions and regular function expressions in class properties.
5. **Post-processing**

    * Cleans temporary state (`currentFile`).
    * Sets `status` to `true`.
6. **Notes**

    * Marked with `"ignore": true` (not included in the library output, internal/helper metric for class-coupling metric).
    * Useful for analyzing **instance relationships** and **class-level dependencies** inside code.
