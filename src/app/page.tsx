import { Suspense } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { scrubx } from "@/server/scrubx";

// Chat View. Only the patient list is loaded here; the selected record comes from
// /api/patients/[id] on demand, and the browser only ever sends a patientId back.
export default function Home() {
  return (
    // A real patient source is request-time I/O, so it streams behind Suspense
    // (never `use cache`: patient data does not belong in a shared cache).
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading patients…</p>}>
      <Chat />
    </Suspense>
  );
}

async function Chat() {
  return <ChatView patients={await scrubx().patients.list()} />;
}
