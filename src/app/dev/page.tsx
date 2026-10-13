import { Suspense } from "react";
import { TraceList } from "@/components/dev/TraceList";

// Phase 2 placeholder: a plain span list so "View trace" works end to end.
// Phase 3 replaces this with the full Dev View (stage card, graph, data lens).
export default function DevPage() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading trace…</p>}>
        <TraceList />
      </Suspense>
    </main>
  );
}
