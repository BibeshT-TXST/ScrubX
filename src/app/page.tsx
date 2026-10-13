import { Suspense } from "react";
import { PageSkeleton } from "@/components/app/PageSkeleton";
import { ChatView } from "@/components/chat/ChatView";
import { scrubx } from "@/server/scrubx";

// Chat. Only the patient list is loaded here; the selected record comes from
// /api/patients/[id] on demand, and the browser only ever sends a patientId back.
export default function Home() {
  return (
    // A real patient source is request-time I/O, so it streams behind Suspense
    // (never `use cache`: patient data does not belong in a shared cache).
    <Suspense fallback={<PageSkeleton label="Loading patients" />}>
      <Chat />
    </Suspense>
  );
}

async function Chat() {
  const { patients, config } = scrubx();
  return <ChatView patients={await patients.list()} modelConnected={!!config.llm.apiKey} source={config.patientSource} />;
}
