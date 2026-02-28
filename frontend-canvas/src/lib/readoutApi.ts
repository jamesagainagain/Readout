const base = import.meta.env.VITE_READOUT_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

// --- Types (matching readout/models/schemas.py) ---

export interface Draft {
  id?: string;
  channel: string;
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SubredditInfo {
  name: string;
  description?: string;
  subscribers?: number;
  rationale?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EngagementStat {
  label: string;
  value: string;
  delta: string;
}

export interface EngagementAnalyticsPayload {
  stats: EngagementStat[];
  reach_by_day: Record<string, string | number>[];
  channel_breakdown: Record<string, string | number>[];
  post_performance: Record<string, string | number>[];
}

// --- API functions ---

export function ingest(params: {
  owner: string;
  repo: string;
  paths?: string[];
  github_token?: string;
}): Promise<{ knowledge_id: string; chunks_count: number; summary?: unknown }> {
  return request("/ingest", { method: "POST", body: JSON.stringify(params) });
}

export function createBrief(params: {
  knowledge_id: string;
  audience: string;
  tone: string;
  goals?: string;
  channels: string[];
  constraints?: string;
}): Promise<{ brief_id: string }> {
  return request("/brief", { method: "POST", body: JSON.stringify(params) });
}

export function generate(params: {
  brief_id: string;
  channel: string;
  count?: number;
}): Promise<{ drafts: Draft[] }> {
  return request("/generate", { method: "POST", body: JSON.stringify(params) });
}

export function getDrafts(brief_id: string): Promise<{ drafts: Draft[] }> {
  return request(`/briefs/${brief_id}/drafts`);
}

export function discoverSubreddits(params: {
  brief_id: string;
}): Promise<{ subreddits: SubredditInfo[] }> {
  return request("/discover-subreddits", { method: "POST", body: JSON.stringify(params) });
}

export function chat(params: {
  knowledge_id: string;
  messages: ChatMessage[];
}): Promise<{ reply: string }> {
  return request("/chat", { method: "POST", body: JSON.stringify(params) });
}

export function analyzeEngagement(payload: EngagementAnalyticsPayload): Promise<{ analysis: string }> {
  return request("/analyze-engagement", { method: "POST", body: JSON.stringify(payload) });
}

export async function textToSpeech(text: string): Promise<string> {
  const res = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
