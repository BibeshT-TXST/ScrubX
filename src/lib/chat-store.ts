import { useSyncExternalStore } from "react";
import type { StageSpan, Step } from "@/core/pipeline/events";
import type { ChatTurn, DecisionAction, PipelineResult } from "@/core/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
  /** Latest pipeline step reported by the stream while the answer is in flight. */
  step?: Step;
  requestId?: string;
  decision?: DecisionAction;
  outcome?: PipelineResult["outcome"];
  quarantined?: number;
}

/** A request as the Dev View sees it: spans accumulate as they stream in, then the result lands. */
export interface LiveTrace {
  requestId: string;
  patientId: string;
  role: string;
  message: string;
  spans: StageSpan[];
  result?: PipelineResult;
  error?: string;
}

interface ChatState {
  role: string;
  mask: boolean;
  threads: Record<string, ChatMessage[]>;
  traces: Record<string, LiveTrace>;
}

const MAX_TRACES = 20;
const HISTORY_TURNS = 10;

/**
 * In-memory only. Survives navigating between Chat View and Dev View but
 * not a refresh, which matches the stateless design: no PHI in browser storage.
 */
let state: ChatState = { role: "physician", mask: true, threads: {}, traces: {} };
const listeners = new Set<() => void>();

function set(update: (s: ChatState) => ChatState) {
  state = update(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getChatState = (): ChatState => state;

export function useChatStore<T>(select: (s: ChatState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state), () => select(state));
}

function patchTrace(requestId: string, patch: (t: LiveTrace) => Partial<LiveTrace>) {
  set((s) => {
    const t = s.traces[requestId];
    return t ? { ...s, traces: { ...s.traces, [requestId]: { ...t, ...patch(t) } } } : s;
  });
}

export const chatActions = {
  setRole(role: string) {
    set((s) => ({ ...s, role }));
  },

  setMask(mask: boolean) {
    set((s) => ({ ...s, mask }));
  },

  append(patientId: string, ...messages: ChatMessage[]) {
    set((s) => ({ ...s, threads: { ...s.threads, [patientId]: [...(s.threads[patientId] ?? []), ...messages] } }));
  },

  update(patientId: string, id: string, patch: Partial<ChatMessage>) {
    set((s) => ({
      ...s,
      threads: { ...s.threads, [patientId]: (s.threads[patientId] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) },
    }));
  },

  clear(patientId: string) {
    set((s) => ({ ...s, threads: { ...s.threads, [patientId]: [] } }));
  },

  startTrace(trace: Omit<LiveTrace, "spans">) {
    set((s) => {
      const kept = Object.entries(s.traces).slice(-(MAX_TRACES - 1));
      return { ...s, traces: { ...Object.fromEntries(kept), [trace.requestId]: { ...trace, spans: [] } } };
    });
  },

  addSpan(requestId: string, span: StageSpan) {
    patchTrace(requestId, (t) => ({ spans: [...t.spans, span] }));
  },

  // The result's trace is authoritative: it replaces the spans gathered from the stream.
  finishTrace(requestId: string, result: PipelineResult) {
    patchTrace(requestId, () => ({ result, spans: result.trace.spans }));
  },

  failTrace(requestId: string, error: string) {
    patchTrace(requestId, () => ({ error }));
  },
};

/**
 * Prior turns to send with the next request. Blocked exchanges are left out:
 * resending an injection every turn would only get it quarantined again.
 */
export function historyFor(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  messages.forEach((m, i) => {
    const reply = m.role === "user" ? messages[i + 1] : m;
    if (reply?.role === "assistant" && reply.outcome === "answered" && reply.status === "done") {
      turns.push({ role: m.role, content: m.content });
    }
  });
  return turns.slice(-HISTORY_TURNS);
}
