# UI and Responsive Design Requirements

## 50. RESPONSIVE DESIGN
---
The application must be fully responsive and usable on:
* Desktop
* Laptop
* Tablet
* Mobile phone

The interface must adapt to the available screen width without requiring horizontal scrolling.

## 51. RESPONSIVE SIDEBAR
---
On large screens:
* The conversation sidebar should remain visible.
* The chat interface should occupy the remaining available space.
* The model/server management area may be displayed alongside the chat or through a dedicated panel.

**Example (Large Screen):**
```text
+-------------+-------------------------------------------+
| Chat Sidebar|                  Chat                     |
|             |                                           |
|             |                                           |
+-------------+-------------------------------------------+
```

On smaller screens:
* The sidebar should become collapsible.
* The sidebar should be opened through a menu button.
* Opening the sidebar should not permanently reduce the chat area.

**Example (Small Screen):**
```text
+-------------------------------------------+
| ☰  Local AI Chat              Model ▼     |
+-------------------------------------------+
|                                           |
|              AI CHAT                      |
|                                           |
|                                           |
+-------------------------------------------+
```
When the sidebar is opened on mobile, it may appear as an overlay or drawer above the chat interface.

## 52. RESPONSIVE CHAT INPUT
---
The message input must adapt to smaller screens.

Requirements:
* Input must remain usable on mobile devices.
* Attach-file controls must remain accessible.
* Send button must remain accessible.
* The input area may expand vertically for multiline messages.
* Long messages must not break the layout.
* Attached files must remain visible and manageable on small screens.

## 53. RESPONSIVE MODEL MANAGEMENT
---
The model management interface must also adapt to smaller screens.

On desktop:
* Model information can be displayed in a table or multi-column layout.

On mobile:
* Each model should be displayed as a card.

**Desktop:**
```text
+----------------------+---------+---------+---------+
| Model                | Status  | Memory  | Action  |
+----------------------+---------+---------+---------+
| Qwen3-VL-2B          | Loaded  | 4.2 GB  | Unload  |
+----------------------+---------+---------+---------+
```

**Mobile:**
```text
+--------------------------------+
| Qwen3-VL-2B                    |
| Status: Loaded                 |
| Memory: 4.2 GB                 |
|                                |
| [ Unload ]                     |
+--------------------------------+
```

## 54. RESPONSIVE PERFORMANCE INFORMATION
---
Performance metrics must remain readable on mobile devices. The metrics may change from a horizontal layout to a vertical layout.

**Desktop:**
`TTFT: 180 ms | 42.5 tok/s | Total: 12.15 s`

**Mobile:**
```text
TTFT: 180 ms
Tokens/s: 42.5
Total: 12.15 s
```

## 55. RESPONSIVE FILE ATTACHMENTS
---
Attached PDFs and images must remain usable on all screen sizes.

The application should:
* Display file attachment chips/cards.
* Prevent attachments from overflowing the screen.
* Allow users to remove an attachment before sending.
* Allow users to open supported files after they have been attached.
* Use thumbnails for images when practical.

## 65. UPDATED MAIN INTERFACE
---
**Desktop:**
```text
+---------------------------------------------------------------------+
| Local AI Chat                                    RAM / Server Status|
+----------------------+----------------------------------------------+
| CHAT HISTORY         |                 AI CHAT                      |
|                      |                                              |
| + New Chat           |  User message...                             |
|                      |                                              |
| Search chats... 🔍   |  AI response...                              |
|                      |                                              |
| Today                |  [Reasoning]                                 |
| C++ optimization     |                                              |
| PDF analysis         |  TTFT: 180 ms                                |
| Transformers API     |  Tokens/s: 42.5                              |
|                      |  Reasoning: 3.42 s                           |
| Yesterday            |  Generation: 8.73 s                          |
| Java API             |  Total: 12.15 s                              |
| Math exercise        |                                              |
|                      |  +-----------------------------------------+ |
| 🗑 Trash              |  | Attach | Message...              | Send | |
|                      |  +-----------------------------------------+ |
+----------------------+----------------------------------------------+
```

**Mobile:**
```text
+-------------------------------------------+
| ☰  Local AI Chat             Model ▼      |
+-------------------------------------------+
|                                           |
|              AI CHAT                      |
|                                           |
| User message...                           |
|                                           |
| AI response...                            |
|                                           |
| TTFT: 180 ms                              |
| Tokens/s: 42.5                            |
| Total: 12.15 s                            |
|                                           |
+-------------------------------------------+
| 📎       Message...                 Send  |
+-------------------------------------------+
```