## 1. Browser Extension Architecture (Chrome/Firefox/Edge)

Integrating the graph visualization directly into GitHub makes modularity analysis contextual and immediate.

### Key Components
* **Manifest V3 Setup**: Define extension permissions, matches, and entrypoints.
* **Content Script (`content.js`)**:
  * Runs automatically on `https://github.com/*`.
  * Detects the repository owner and name from the current browser URL path (e.g. `github.com/:owner/:repo`).
  * Injects a custom UI trigger (e.g., a "View Code Graph" tab next to the repository navigation header or as a floating badge).
  * Embeds the Angular app inside an `iframe` or a drawer panel on demand.
* **Angular Application Integration**:
  * **Routing**: Since Angular is already configured with `HashLocationStrategy` (`withHashLocation()`), it will route correctly within the `chrome-extension://` URL scheme.
  * **Relative Assets**: Build with `ng build --base-href ./` to resolve script/style assets relatively.


