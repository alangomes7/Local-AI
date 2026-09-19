# Chat Lifecycle and Management Requirements

## 56. CHAT DELETION
---
The application must provide a way to delete conversations. Deleting a conversation must require explicit user confirmation.

**Example confirmation dialog:**
```text
+---------------------------------------------+
| Delete conversation?                        |
|                                             |
| "C++ Graph Optimization"                    |
|                                             |
| This conversation will be moved to Trash.   |
| You can recover it later.                   |
|                                             |
|             [ Cancel ]  [ Delete ]          |
+---------------------------------------------+
```

## 57. DELETE CONFIRMATION
---
The confirmation dialog should clearly identify the conversation that will be deleted.
The application must not delete a conversation immediately when the user clicks the delete action.
The user must explicitly confirm the operation.

Available actions:
* Cancel (must leave the conversation unchanged)
* Delete

## 58. SOFT DELETE / TRASH
---
Conversation deletion should use a soft-delete mechanism.
When the user confirms deletion:
* The conversation is moved to Trash.
* The conversation is removed from the normal sidebar.
* The conversation data is not immediately permanently deleted.
* Attached files associated with the conversation should also remain recoverable when possible.

The deleted conversation should remain recoverable for a configurable retention period or until the user permanently deletes it.

## 59. TRASH
---
The sidebar or chat management interface should provide access to deleted conversations.

**Example:**
```text
+--------------------------------+
| Chat History                   |
|                                |
| Today                          |
| C++ Optimization               |
| PDF Analysis                   |
|                                |
| ---------------------------------- |
| 🗑 Trash                           |
| +--------------------------------+ |
```

The Trash view should display deleted conversations.
Each deleted conversation should show:
* Conversation title
* Deletion date/time
* Original last updated date/time

## 60. CHAT RECOVERY
---
The user must be able to restore a deleted conversation.

**Example:**
```text
TRASH

C++ Graph Optimization
Deleted: Today, 15:42

[ Restore ]   [ Delete Permanently ]
```

When the user selects Restore:
* The conversation is removed from Trash.
* The conversation becomes visible in the normal chat history.
* All available messages are restored.
* Associated metadata is restored.
* Associated files are restored when available.
* The conversation can be continued normally.

## 61. PERMANENT DELETION
---
The user may permanently delete a conversation from Trash.
Permanent deletion must require a second explicit confirmation.

**Example:**
```text
+---------------------------------------------+
| Permanently delete conversation?            |
|                                             |
| This action cannot be undone.               |
| All conversation data will be deleted.      |
|                                             |
|       [ Cancel ]  [ Delete Permanently ]    |
+---------------------------------------------+
```

After permanent deletion:
* The conversation is removed permanently.
* Its messages are removed.
* Associated metadata is removed.
* Associated files should also be removed when appropriate.

## 62. DELETION STATES
---
A conversation should have a lifecycle similar to:

```text
ACTIVE
|
| Delete
v
TRASH
|
+---- Restore ----> ACTIVE
|
|
+---- Permanent Delete ----> DELETED
```

The application should distinguish between:
* Active conversation
* Conversation in Trash
* Permanently deleted conversation

## 63. DELETION SAFETY
---
The application must protect against accidental deletion.

Requirements:
* No immediate deletion from a single accidental click.
* Confirmation before moving a chat to Trash.
* Confirmation before permanent deletion.
* Recovery from Trash.
* Clear distinction between "Delete" and "Delete Permanently".
* The delete operation must not affect other conversations.
* Deleting a conversation must not unload or delete the AI model used by that conversation.

## Chat Export
---
The application must allow the user to export a conversation as a **Markdown (`.md`) file**.

### Export requirements
* Add an **Export as Markdown** action to each conversation.
* Export the complete selected conversation.
* Preserve:
  * Conversation title
  * User messages
  * AI responses
  * Markdown formatting
  * Code blocks
  * LaTeX/math expressions
  * Message order
  * Relevant timestamps when available
  * Model name used for each response when available
* Attached files should be referenced in the exported Markdown when they cannot be embedded directly.
* Exported conversations should use standard Markdown syntax so they can be opened in common Markdown editors.
* The exported filename should be generated from the conversation title.
* Sanitize invalid filesystem characters from the filename.
* The export must not modify or delete the original conversation.
* Export must work independently of whether the model used in the conversation is currently loaded.

### Example
`C++ Graph Optimization.md`

Example exported structure:
```markdown
# C++ Graph Optimization

## User
How can I optimize this graph algorithm?

## AI
You can improve the algorithm by using...

```cpp
// code
```

The complexity is:
\(O(V + E)\)
```

This also fits naturally with the existing **chat history and Trash system**: exporting a chat should be available for active conversations and, if desired, restored conversations, but it should not affect the chat's lifecycle.