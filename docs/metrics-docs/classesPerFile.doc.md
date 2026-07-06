# Classes Per File Metric

### ID

`classes-per-file`

### Name

**Classes Per File**

### Description

Analyzes each source file to identify and record all **top-level classes** defined.
For each file, it stores the classes found as keys and lists their **methods** and **properties** as AST nodes.

### Output Format (example)

```json
{
  "name": "Classes Per File",
  "description": "Analyzes each source file to identify and record all top-level classes defined",
  "result": {
    "/home/daniel/Workspace/jtmetrics/test/test-src/classes-per-file/JS/classes.js": {
      "Calculator": [
        {
          "type": "ClassMethod",
          "key": { "type": "Identifier", "name": "foo" },
          "params": [],
          "body": { "type": "BlockStatement", "body": [] }
        },
        {
          "type": "ClassProperty",
          "key": { "type": "Identifier", "name": "bar" },
          "value": { "type": "ArrowFunctionExpression" }
        },
        {
          "type": "ClassProperty",
          "key": { "type": "Identifier", "name": "baz" },
          "value": { "type": "FunctionExpression" }
        }
      ],
      "Logger": [
        {
          "type": "ClassMethod",
          "key": { "type": "Identifier", "name": "foo" }
        }
      ]
    }
  },
  "status": true
}
```

### How it works

1. **Dependencies**

    * Requires the `files` metric to know which files are being analyzed.
2. **Class Declarations**

    * Captures **named classes** declared at the top level or exported (`class Foo {}`, `export default class Bar {}`).
    * If no name is provided (e.g., default export), the file name is used as the class name.
    * Ignores invalid cases like inline IIFEs or `class extends class {}`.
3. **Class Expressions**

    * Detects classes assigned to variables (`const Logger = class {}`) or used inside object properties (`{ Printer: class {} }`, `{ "LiteralClassName": class {} }`).
4. **Traversal inside each class**

    * Collects **methods** (`ClassMethod`) and **function-like properties** (`ClassProperty` containing arrow or function expressions).
    * Stores them as an array of AST nodes under each class name.
5. **Post-processing**

    * Cleans up temporary fields (`currentFile`, `dependencies`).
    * Marks the metric as completed by setting `state.status = true`.

### Notes

* Classes are grouped **per file**: each file path maps to one or more class names.
* Each class contains an **array of AST nodes** representing its members.
* The metric is designed to **ignore nested or anonymous usage** of classes unless they are explicitly assigned or exported.

### Use cases

* Identify how many classes exist per file.
* Analyze **class responsibilities** and complexity by inspecting their collected members.
* Provide a foundation for further metrics (e.g., coupling between classes, method counts, property usage).
