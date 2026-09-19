# Sidebar and Search Requirements

## 48. SIDEBAR SEARCH
---
The conversation sidebar must include a search function.

The user must be able to search through saved conversations by:
* Conversation title
* Message content

**Example:**
```text
+--------------------------------+
| Search chats...          🔍    |
+--------------------------------+
|                                |
| Results for: "transformers"    |
|                                |
| Transformers Attention         |
| Qwen Transformers API          |
| Model Loading and Memory       |
|                                |
+--------------------------------+
```

Search behavior:
* Search should update as the user types.
* Results should be filtered without requiring a page reload.
* Matching conversations should remain selectable.
* Selecting a search result must open the corresponding conversation.
* Clearing the search field must restore the normal conversation list.
* Search should be case-insensitive.
* Search should support partial matches.

The search should preferably search locally stored conversation data rather than sending conversation content to an external service.

## 49. SIDEBAR SEARCH RESULTS
---
When a search is active, the sidebar should display matching conversations.

Each result should show at least:
* Conversation title
* Last updated date/time
* Optionally, matching text can be highlighted.

**Example:**
Search: "Java"

Results:
* Java Spring Boot API (Last updated: Today)
* Java REST Authentication (Last updated: Yesterday)
* Java Memory Optimization (Last updated: Sep 17)

## 64. UPDATED CHAT HISTORY REQUIREMENTS
---
The application must:
* Display all active conversations in the sidebar.
* Provide sidebar search.
* Allow searching by title and message content.
* Allow the user to create a new conversation.
* Allow the user to select an existing conversation.
* Load the complete conversation when selected.
* Preserve conversation messages.
* Preserve attached files associated with the conversation.
* Preserve conversation context.
* Preserve model information associated with each message when relevant.
* Allow conversations to remain available after closing/reopening the application.
* Allow conversations to be moved to Trash.
* Allow conversations to be restored.
* Allow permanent deletion after explicit confirmation.