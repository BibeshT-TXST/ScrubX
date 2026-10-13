import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { SecurityView } from "@/components/security/SecurityView";
import { scrubx } from "@/server/scrubx";

// Security Division: a strictly observational view of the requests made from
// Chat in this browser session. Nothing can be sent from here.
export default function SecurityPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Loading the Security Division" />}>
      <Security />
    </Suspense>
  );
}

async function Security() {
  return <SecurityView patients={await scrubx().patients.list()} />;
}
