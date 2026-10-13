import { Suspense } from "react";
import { DevView } from "@/components/dev/DevView";
import { scrubx } from "@/server/scrubx";

// Dev View: watch one request move through every stage. The trace itself
// lives in the browser tab that ran it; the server keeps nothing.
export default async function DevPage() {
  const patients = await scrubx().patients.list();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <DevView patients={patients} />
    </Suspense>
  );
}
