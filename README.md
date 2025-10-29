# Noibu PII Masker

The **Noibu PII Masker** extension helps protect sensitive data from appearing in your Noibu session replays.

It automatically replaces text or elements you specify — such as email addresses, names, or customer identifiers — with masked characters, ensuring that no personally identifiable information (PII) is visible during replay analysis.

You can add text patterns (partial matches allowed) or CSS selectors to hide specific elements.

Once activated, the extension continuously monitors dynamic page changes — including shadow DOMs and iframes — so your data remains masked even when new content loads during a session replay.

Key features:

- 🔒 Customizable text and CSS masking
- 🔁 Real-time masking for dynamic pages
- 💾 Persistent settings (saved automatically)
- 🧩 Global ON/OFF toggle
- 💬 Intuitive interface with add/remove controls
- 🌐 Works only on `https://console.noibu.com/*`

This extension is designed specifically for Noibu’s session replay console and does not collect or transmit any personal data. All settings are stored locally in your browser using Chrome Sync.


## 🚀 1. Installation (Local)

You can load the extension locally from our shared ZIP package.

1. **Download** the latest ZIP or clone the repository
2. **Unzip** it to a local folder (e.g., `~/Documents/noibu-pii-masker`).
3. Open Chrome and go to:
    
    ```
    chrome://extensions
    ```
    
4. Turn **Developer mode** ON (top right).
5. Click **Load unpacked**.
6. Select your unzipped folder.

You should now see the **PII Masker** icon (`***` on white background) in your toolbar.

## ⚙️ 2. Configuration

Click the extension icon to open the popup window.

### ➕ Add Masking Rules

Each line lets you define what to hide:

| Field | Description | Example |
| --- | --- | --- |
| **Type** | Choose between `Text` or `CSS` | `Text` hides literal strings; `CSS` hides by selector |
| **Value** | What to search for | `john@`, `.rivo-login-subtitle`, `#user-email` |

> Tip:
> 
> - For CSS, always prefix classes with `.` and IDs with `#`.
> - For Text, partial matches are allowed (e.g., “john@” will mask “john@example.com”).

Click **➕ Add Entry** to add new lines.

Click **–** to remove an entry.

💾 **Auto-Save:**

Changes are saved instantly — no manual Save button needed.

---

## 🔘 3. Using ON / OFF Toggle

- **🟢 ON** — starts masking immediately on `console.noibu.com`.
- **🔴 OFF** — disables masking (useful for debugging).
    
    This toggle applies globally across all Noibu console tabs. 
    **Remember to refresh the page once you have toggled ON/OFF**
    

---

## 🔍 4. How Masking Works

- Replaces matching text with the same number of  (preserves layout).
- Monitors the DOM in real-time:
    - dynamically loaded replay frames
    - shadow DOM elements
    - iframes within the console

So even if session data loads progressively, PII stays hidden.

## 🧪 5. Example Configuration

| Type | Value | Description |
| --- | --- | --- |
| Text | `john@gmail.com` | Masks this text |
| CSS | `.rivo-login-subtitle` | Masks the text in that class |
| CSS | `#user-email` | Masks by element ID |
