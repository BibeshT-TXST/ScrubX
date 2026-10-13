import { Suspense } from "react";
import { SecurityView } from "@/components/security/SecurityView";
import { scrubx } from "@/server/scrubx";

// Security Division: a strictly observational view of the requests made from
// Chat in this browser session. Nothing can be sent from here.
export default function SecurityPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <Security />
    </Suspense>
  );
}

async function Security() {
  return <SecurityView patients={await scrubx().patients.list()} />;
}
