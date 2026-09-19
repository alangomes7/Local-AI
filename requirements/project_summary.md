# Project Summary

## 67. PROJECT SUMMARY
---

This project is a lightweight, responsive, local ChatGPT-like interface built with Next.js.

It connects to a Hugging Face Transformers server through a configurable REST API.

The Transformers server supports multiple AI models loaded simultaneously in memory.

The Next.js application acts as:

1. An AI chat client
2. A model/server management dashboard
3. A conversation manager
4. A local AI server monitoring interface

Users can:
* Create multiple conversations.
* See all conversations in a sidebar.
* Search conversations by title and message content.
* Open previous conversations.
* Continue previous conversations.
* Rename conversations.
* Delete conversations safely.
* Recover deleted conversations from Trash.
* Permanently delete conversations after confirmation.
* Use the interface on desktop, laptop, tablet, and mobile devices.
* Select different AI models.
* Change models during conversations.
* Maintain complete conversation context.
* Load specific AI models.
* Unload specific AI models.
* Unload all models.
* See which models are currently loaded.
* Monitor the memory consumption of loaded models.
* Monitor total AI server RAM usage.
* Send and receive text.
* Render Markdown.
* Render LaTeX mathematics.
* Send PDFs.
* Send images.
* Receive AI-generated files/images when supported.
* View AI reasoning when available.
* Monitor Time to First Token.
* Monitor tokens per second.
* Monitor reasoning time.
* Monitor generation time.
* Monitor total response time.
* Monitor client RAM.
* Monitor AI server RAM.
* Access the AI server from multiple LAN devices.

The primary objective is to provide a clean, lightweight, responsive local ChatGPT-like interface for managing conversations and interacting with multiple locally hosted Hugging Face Transformers models over a local network.