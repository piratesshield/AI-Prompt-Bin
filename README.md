
# AI Prompt Bin

**AI Prompt Bin** is a powerful Chrome Extension designed to capture, organize, and visualize your interactions with major AI tools like **ChatGPT, Gemini, Claude, Perplexity, and Copilot**.

It runs entirely in your browser (offline-first) and provides a standalone dashboard for analytics.

---

## 🚀 Features

### 1. ⚡ Intelligent Auto-Capture
Automatically saves every prompt you send and every response you receive.
- **Pending Prompt Logic**: Waits for the AI response to start before saving the prompt, ensuring it captures the **exact permanent URL** of the chat session (fixing issues with `/new` temporary URLs).
- **Robust Capture**: Works even if the website clears the input box instantly (buffered recording).
- **Universal Support**: Works on ChatGPT, Gemini, Claude, Perplexity, and Microsoft Copilot.
- **Privacy First**: All data is stored locally in your browser (`chrome.storage.local`).

### 2. 🧠 Memory Graph
A visual node-link diagram in the dashboard showing the relationship between:
- **AI Tools** (Which ones you use most)
- **Topics/Categories** (Code, Writing, General)
- **Individual Prompts** (Visualized as nodes)

### 3. 📊 Analytics Dashboard
Track your AI usage over time.
- **Stacked Bar Charts**: View activity by Day, Week, Month, or Year.
- **Tool Breakdown**: See exactly which AI tool you used on specific days.
- **Copy Button**: Quickly copy old prompts from the table to your clipboard.

### 4. 💡 Autocomplete Suggestions
As you type in any AI chat box, a non-intrusive popup suggests previous prompts you've used.
- **Paste (Cmd+V Style)**: New robust paste button that simulates a human paste action, working even on complex apps like Perplexity.
- **Cross-Platform**: Use your ChatGPT prompts inside Claude or Gemini instantly.
- **Copy & Link**: Copy text or jump to the original conversation URL.

### 5. 🔍 Organization
- **Search**: Filter history by keyword.
- **Filters**: Sort by AI Tool or Type (Prompt vs Response).
- **Export**: Download your entire history as JSON.

---

## 🛠 Installation Guide

Since this is a developer build, you must load it as an "Unpacked Extension" in Chrome.

1.  **Download the Code**: Ensure you have all the files (`manifest.json`, `background.js`, `content.js`, etc.) in a folder named `ai-prompt-bin`.
2.  **Open Extensions Page**: 
    - Open Google Chrome.
    - Go to `chrome://extensions`.
3.  **Enable Developer Mode**:
    - Toggle the **Developer mode** switch in the top right corner.
4.  **Load Extension**:
    - Click the **Load unpacked** button (top left).
    - Select the folder containing the files.
5.  **Pin it**: Click the Puzzle icon in your Chrome toolbar and pin **AI Prompt Bin**.

---

## 📖 How to Use

1.  **Chat Normally**: Go to ChatGPT or Gemini and start typing. 
2.  **See Suggestions**: If you type 3+ characters that match a previous prompt, a suggestion box will appear.
3.  **Capture**: When you hit **Enter**, the prompt is queued. It is saved the moment the AI starts responding.
4.  **View History**:
    - Click the extension icon to see the **Last 5 captures**.
    - Click **"Dashboard"** to open the full analytics suite.

---

## 🧩 Supported Platforms

| AI Tool | Prompt Capture | Response Capture | Auto-Link |
| :--- | :---: | :---: | :---: |
| **ChatGPT** | ✅ | ✅ | ✅ |
| **Gemini** | ✅ | ✅ | ✅ |
| **Claude** | ✅ | ✅ | ✅ |
| **Perplexity** | ✅ | ✅ | ✅ |
| **Copilot** | ✅ | ✅ | ✅ |

---

## 🔒 Privacy

**AI Prompt Bin** creates zero network requests to external servers. 
- All data resides in `chrome.storage.local`.
- No tracking, no analytics, no cloud sync.
- You can export your data to JSON at any time.

---

*Version 6.1.0*
