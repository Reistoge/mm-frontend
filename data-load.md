
## 2. Local Scanning & Data Feeding Strategies

To give users the flexibility of scanning their code locally or referencing a cloud API, we support two data paths:

### Mode A: Remote API (Current Default)
* The app requests metrics data from the central API server.
* Best for public repositories or projects analyzed by CI/CD pipelines.

### Mode B: Local Execution (New)
We have two ways to feed local data into the frontend:

1. **Option 1: Drag-and-Drop / File Upload (Zero-Setup)**
   * **Workflow**: The user runs a local CLI scan tool which saves metrics to a `metrics.json` file. The user uploads this file to the frontend.
   * **Pros**: Simple, fast, secure (no local ports or network configuration required).
   * **Cons**: Manual file management.
2. **Option 3: Localhost API Server**
   * **Workflow**: The local CLI tool runs a tiny background HTTP server (e.g. port 3000) that exposes the scanned data.
   * **Pros**: Live updates as the user edits code; feels automatic.
   * **Cons**: Requires configuring CORS on the local CLI server to accept connections from browser extensions/pages.

---

## 3. Monorepo Migration Plan

To combine the frontend, the scanner CLI, and potential backend APIs, we propose migrating to a Monorepo structure using standard `npm`/`pnpm` workspaces.

### Target Directory Layout
```text
mm-monorepo/
├── packages/
│   ├── frontend/         # Current Angular SPA (emefjs)
│   ├── scanner/          # CLI parsing engine (runs scans, outputs JSON or starts local server)
│   ├── api/              # Metrics server API (orchestrates scan jobs)
│   └── types/            # Shared types (GraphNode, GraphLink, ScanResult DTOs)
├── package.json          # Workspace root configuring packages
└── README.md
```

### Steps to Migrate
1. Create a root workspace directory and initialize a workspace `package.json`.
2. Move the current `mm-frontend` into `packages/frontend`.
3. Extract metrics type interfaces into `packages/types` to share with the scanner.
4. Set up cross-package scripts in the root `package.json` for easy dev/build commands.
