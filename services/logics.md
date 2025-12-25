# New Feature Logic Documentation

This document outlines the technical logic behind the newly implemented "Supermemory" features in the Prompt Bin extension.

## 1. Intelligent "Mem0" Tagging
**Goal**: Automatically categorize prompts into meaningful topics (e.g., "React", "Debugging") instead of just "General".
**Logic Location**: `extension/background.js` -> `extractTags(text)`

**Algorithm**:
1.  **Keyword Mapping**: A dictionary (`KEYWORD_MAP`) maps common terms to tags strings.
    *   *Example*: "react", "hooks", "jsx" -> `React`.
    *   *Example*: "fix", "error", "crash" -> `Debugging`.
2.  **Heuristic Detection**: 
    *   **Code Detection**: Regex scans for syntax characters (`{`, `}`, `;`, `=>`) combined with keywords (`function`, `const`) to tag as `Code`.
    *   **Question Detection**: Checks if the prompt starts with `how`, `what`, or `why` to tag as `Question`.
3.  **Result**: Returns an array of up to 3 tags (e.g., `['React', 'Code', 'Question']`).

---

## 2. Thread-Based Session Reconstruction
**Goal**: Group individual prompt/response captures into a coherent conversation view, rather than a flat spreadsheet.
**Logic Location**: `dashboard.js` -> `processThreads(data)`

**Algorithm**:
1.  **Grouping Key**: Iterates through all captured items and groups them by `sessionUrl`. 
    *   *Why*: All interactions on `chatgpt.com/c/123-abc` belong to the same conversation.
2.  **Sorting**: 
    *   **Inside Thread**: Items are sorted by `timestamp` (Oldest -> Newest) to reconstruct the flow.
    *   **Sidebar List**: Threads are sorted by the `timestamp` of their *last message* (Newest Activity -> Top).
3.  **Metadata Extraction**: The sidebar displays the *last user prompt* as the thread preview and the *most frequent tag* as the thread topic.

---

## 3. Custom Markdown Rendering Engine
**Goal**: Render code blocks, bold text, and lists in the dashboard to mimic the AI's actual interface.
**Logic Location**: `dashboard.js` -> `parseMarkdown(text)`

**Algorithm**:
1.  **Escape HTML**: First, sanitize input to prevent XSS.
2.  **Code Block Extraction**: 
    *   Regex: `/```(\w*)([\s\S]*?)```/g` accounts for multiline code.
    *   **Strategy**: Replaces code blocks with a placeholder `__CODE_0__` to prevent internal content from being parsed as bold/italic.
3.  **Inline Formatting**:
    *   `**bold**` -> `<strong>`
    *   `*italic*` -> `<em>`
    *   `` `code` `` -> `<code>`
4.  **Syntax Highlighting (Lightweight)**:
    *   The engine applies simple regex to colorize keywords (`function`, `const`, `return`) and strings inside extracted code blocks.
5.  **Re-injection**: Placeholders are swapped back with the formatted `<pre><code>...</code></pre>` blocks.

---

## 4. Analytics: "Topic Cloud" & Active Streak
**Goal**: Visualize user interests and habit consistency.
**Logic Location**: `dashboard.js` -> `renderAnalytics()`

**Logic**:
*   **Active Streak**:
    *   Creates a `Set` of unique dates: `new Set(items.map(i => new Date(i.timestamp).toDateString()))`.
    *   The `size` of this Set represents the number of unique days the user has been active.
*   **Topic Cloud**:
    *   Iterates over all items.
    *   Aggregates counts for each tag in `item.tags`.
    *   **Visualization**: Renders HTML pills where `font-size` and `opacity` are calculated relative to the most frequent tag (`count / maxCount`).

---

## 5. Robust Capture System (The "Manifest Fix")
**Goal**: ensure reliability.
**Logic Location**: `extension/content.js` & `extension/background.js`

**Logic**:
*   **Manifest V3 Service Worker**: The `manifest.json` now correctly points to `extension/background.js`.
*   **Visual Feedback**: `content.js` injects a "Toast" notification into the DOM purely via JS whenever a capture succeeds, giving the user immediate confidence.
*   **Deduplication**: 
    *   Before saving, the background script checks if the *last saved item* has identical content.
    *   If `last.content === new.content`, the save is rejected as a "duplicate".
