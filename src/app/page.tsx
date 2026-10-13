import { ChatView } from "@/components/chat/ChatView";
import type { PatientContext } from "@/core";
import { scrubx } from "@/server/scrubx";

// Chat View. Patient records are loaded on the server; the browser only ever
// sends a patientId back, never a record.
export default async function Home() {
  const { patients } = scrubx();
  const records = await Promise.all((await patients.list()).map((p) => patients.get(p.id)));
  return <ChatView patients={records.filter((p): p is PatientContext => p !== null)} />;
}
