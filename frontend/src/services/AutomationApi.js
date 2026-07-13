/**
 * NexusAI AI - Automation API Service
 *
 * Provides:
 *  - streamAutomationAI(prompt, onEvent, conversationId, platform)
 *    → SSE streaming, same pattern as EducationApi.jsx
 *  - generateAutomation(prompt, conversationId, platform)
 *    → Normal POST, returns full JSON
 *  - listAutomationConversations()
 *  - getAutomationConversation(id)
 *  - deleteAutomationConversation(id)
 */
import { getBaseURL } from "./api";

const BASE_URL = getBaseURL();

// ─────────────────────────────────────────────────────────
// Auth header helper
// ─────────────────────────────────────────────────────────
function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─────────────────────────────────────────────────────────
// Full JSON generation
// ─────────────────────────────────────────────────────────
export async function generateAutomation(
  prompt,
  conversationId = null,
  platform = null,
  connectors = null,
) {
  const response = await fetch(`${BASE_URL}/automation/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      prompt,
      conversation_id: conversationId,
      platform,
      connectors,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Automation generation failed.");
  }

  return await response.json();
}

// ─────────────────────────────────────────────────────────
// SSE Streaming generation
// Same SSE parsing pattern as EducationApi.jsx
// ─────────────────────────────────────────────────────────
export async function streamAutomationAI(
  prompt,
  onEvent,
  conversationId = null,
  platform = null,
  connectors = null,
) {
  const response = await fetch(`${BASE_URL}/automation/stream`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      prompt,
      conversation_id: conversationId,
      platform,
      connectors,
    }),
  });

  if (!response.ok) {
    throw new Error("Automation streaming failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop();

    for (const message of messages) {
      if (!message.startsWith("data: ")) continue;

      const data = message.replace("data: ", "");
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        onEvent(parsed);
      } catch {
        // Ignore malformed SSE frames
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
// Conversation CRUD
// ─────────────────────────────────────────────────────────

export async function listAutomationConversations() {
  const response = await fetch(`${BASE_URL}/automation/conversations`, {
    headers: authHeaders(),
  });
  if (!response.ok) return [];
  return await response.json();
}

export async function getAutomationConversation(id) {
  const response = await fetch(
    `${BASE_URL}/automation/conversations/${id}`,
    { headers: authHeaders() },
  );
  if (!response.ok) throw new Error("Conversation not found.");
  return await response.json();
}

export async function deleteAutomationConversation(id) {
  const response = await fetch(
    `${BASE_URL}/automation/conversations/${id}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
  if (!response.ok) throw new Error("Delete failed.");
  return await response.json();
}
