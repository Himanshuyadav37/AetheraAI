import api, { getBaseURL } from "./api";

export async function runComputerTask(payload) {
  const res = await api.post("/computer/run", payload);
  return res.data;
}

export async function approveComputerAction(payload) {
  const res = await api.post("/computer/approve", payload);
  return res.data;
}

export async function resetComputerSession(sessionId) {
  const res = await api.post("/computer/reset", { session_id: sessionId });
  return res.data;
}

export async function getComputerScreenshot(sessionId) {
  const res = await api.get(`/computer/screenshot/${sessionId}`);
  return res.data;
}

export async function listComputerSessions() {
  const res = await api.get("/computer/sessions");
  return res.data || [];
}

export async function getComputerSession(sessionId) {
  const res = await api.get(`/computer/sessions/${sessionId}`);
  return res.data;
}

export async function deleteComputerSession(sessionId) {
  const res = await api.delete(`/computer/sessions/${sessionId}`);
  return res.data;
}

export async function getSystemTelemetry() {
  const res = await api.get("/computer/system-status");
  return res.data;
}

export async function transcribeVoiceAudio(audioBase64, language = "en") {
  const res = await api.post("/computer/transcribe-voice", {
    audio_base64: audioBase64,
    language
  });
  return res.data;
}

export function getComputerWebSocketUrl(sessionId) {
  const base = getBaseURL();
  const wsProto = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  return `${wsProto}://${host}/computer/ws/${sessionId}`;
}
