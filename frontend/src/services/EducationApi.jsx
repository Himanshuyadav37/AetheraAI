import { getBaseURL } from "./api";
const BASE_URL = getBaseURL();

// ==========================================
// Normal Request
// ==========================================

export async function askEducationAI(
  prompt,
  conversationId = null,
  mode = null,
  connectors = null,
) {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `${BASE_URL}/education/chat`,

    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },

      body: JSON.stringify({
        prompt,

        conversation_id: conversationId,

        mode,
        connectors,
        session_id: sessionStorage.getItem("rag_session_id") || undefined,
        project_id: new URLSearchParams(window.location.search).get("projectId") || undefined,
        org_id: localStorage.getItem("active_org_id") || undefined
      }),
    },
  );

  if (!response.ok) {
    let errorMsg = "Failed to get response.";
    try {
      const errData = await response.json();
      if (errData && errData.detail) errorMsg = errData.detail;
    } catch (err) {
      // Ignore JSON parsing error on failure response
    }
    throw new Error(errorMsg);
  }

  return await response.json();
}

// ==========================================
// Streaming Request (ChatGPT Style)
// ==========================================

export async function streamEducationAI(
  prompt,

  onToken,

  conversationId = null,

  mode = null,
  connectors = null,
  attachments = null,
) {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `${BASE_URL}/education/stream`,

    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },

      body: JSON.stringify({
        prompt,

        conversation_id: conversationId,

        mode,
        connectors,
        session_id: sessionStorage.getItem("rag_session_id") || undefined,
        project_id: new URLSearchParams(window.location.search).get("projectId") || undefined,
        org_id: localStorage.getItem("active_org_id") || undefined,
        attachments
      }),
    },
  );

  if (!response.ok) {
    let errorMsg = "Streaming failed.";
    try {
      const errData = await response.json();
      if (errData && errData.detail) errorMsg = errData.detail;
    } catch (err) {
      // Ignore JSON parsing error on failure response
    }
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const {
      value,

      done,
    } = await reader.read();

    if (done) break;

    buffer += decoder.decode(
      value,

      {
        stream: true,
      },
    );

    const messages = buffer.split("\n\n");

    buffer = messages.pop();

    for (const message of messages) {
      if (!message.startsWith("data: ")) continue;

      const data = message.replace(
        "data: ",

        "",
      );

      if (data === "[DONE]") {
        return;
      }

      try {
        const parsed = JSON.parse(data);

        onToken(parsed);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
