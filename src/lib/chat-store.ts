import { useSyncExternalStore } from "react";
import type { Step } from "@/core/pipeline/events";
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

interface ChatState {
  role: string;
  threads: Record<string, ChatMessage[]>;
  results: Record<string, PipelineResult>;
}

const MAX_RESULTS = 20;
const HISTORY_TURNS = 10;

/**
 * In-memory only. Survives navigating between Chat View and Dev View but
 * not a refresh, which matches the stateless design: no PHI in browser storage.
 */
let state: ChatState = { role: "physician", threads: {}, results: {} };
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

export const chatActions = {
  setRole(role: string) {
    set((s) => ({ ...s, role }));
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

  saveResult(result: PipelineResult) {
    set((s) => {
      const kept = Object.entries(s.results).slice(-(MAX_RESULTS - 1));
      return { ...s, results: { ...Object.fromEntries(kept), [result.requestId]: result } };
    });
  },

  clear(patientId: string) {
    set((s) => ({ ...s, threads: { ...s.threads, [patientId]: [] } }));
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
