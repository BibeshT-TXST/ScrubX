"use client";

import { FileText, MessageSquareText, UserRoundSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { PatientContext, PatientSummary } from "@/core/types";
import { chatActions, useChatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./ChatPanel";
import { PatientBanner } from "./PatientBanner";
import { PatientList } from "./PatientList";
import { PatientRecord } from "./PatientRecord";

interface Props {
  patients: PatientSummary[];
  modelConnected: boolean;
  source: "demo" | "supabase";
}

/** Focuses the patient search that's on screen; false when none is (narrow screens with a chart open). */
function focusPatientSearch(): boolean {
  const input = [...document.querySelectorAll<HTMLInputElement>("[data-patient-search]")].find((el) => el.offsetParent !== null);
  input?.focus();
  input?.select();
  return !!input;
}

const PANES = [
  { id: "record", label: "Record", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquareText },
] as const;

export function ChatView({ patients, modelConnected, source }: Props) {
  const selectedId = useChatStore((s) => s.selectedPatientId);
  const threads = useChatStore((s) => s.threads);
  // Full records load on demand, one per opened patient, and are kept for the session.
  const [records, setRecords] = useState<Record<string, { record: PatientContext; at: number }>>({});
  const [listOpen, setListOpen] = useState(false);
  // Below xl (narrow screens, 200% zoom) the record and the chat share one pane.
  const [pane, setPane] = useState<"record" | "chat">("chat");

  const patient = patients.find((p) => p.id === selectedId);
  const active = useMemo(() => new Set(Object.keys(threads).filter((id) => threads[id]?.length)), [threads]);
  const loaded = patient && records[patient.id];

  useEffect(() => {
    if (!patient || loaded) return;
    let live = true;
    fetch(`/api/patients/${encodeURIComponent(patient.id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<PatientContext>) : null))
      .then((record) => {
        if (live && record) setRecords((all) => ({ ...all, [record.id]: { record, at: Date.now() } }));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [patient, loaded]);

  // Cmd/Ctrl+K jumps to the patient search from anywhere on this screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      // The drawer's first field is its search, so opening it puts the cursor there.
      if (!focusPatientSearch()) setListOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = (id: string) => {
    chatActions.selectPatient(id);
    setListOpen(false);
  };
  const list = (className: string) => (
    <PatientList patients={patients} selectedId={selectedId} onSelect={select} active={active} className={className} />
  );

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
      {list("hidden lg:flex")}
      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="left" className="w-80 gap-0 p-0">
          <SheetTitle className="sr-only">Patients</SheetTitle>
          {list("flex flex-1 shadow-none")}
        </SheetContent>
      </Sheet>

      {patient ? (
        <main className="flex min-h-0 flex-col">
          <PatientBanner patient={patient} onSwitch={() => setListOpen(true)} />

          <div role="group" aria-label="Show" className="flex gap-1 border-b px-(--pane-x) py-2 xl:hidden">
            {PANES.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={pane === id ? "secondary" : "ghost"}
                aria-pressed={pane === id}
                onClick={() => setPane(id)}
                className={cn(pane === id && "font-semibold")}
              >
                <Icon /> {label}
              </Button>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(24rem,2fr)_minmax(0,3fr)]">
            <PatientRecord
              record={loaded?.record}
              retrievedAt={loaded?.at}
              source={source}
              className={cn("xl:flex xl:border-r", pane === "record" ? "flex" : "hidden")}
            />
            <ChatPanel patient={patient} modelConnected={modelConnected} className={cn("xl:flex", pane === "chat" ? "flex" : "hidden")} />
          </div>
        </main>
      ) : (
        <NoPatientSelected>{list("flex flex-1 shadow-none lg:hidden")}</NoPatientSelected>
      )}
    </div>
  );
}

/** No chart opens by itself: the clinician always makes the pick. */
function NoPatientSelected({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-0 flex-col">
      <div className="hidden flex-1 place-items-center p-8 lg:grid">
        <div className="max-w-md space-y-4 text-center">
          <UserRoundSearch className="mx-auto size-10 text-muted-foreground" />
          <h1 className="text-title font-semibold">No patient selected</h1>
          <p className="text-body text-muted-foreground">
            Choose a patient from the list, or search by name, MRN or date of birth. ScrubX never opens a chart for you.
          </p>
          <Button variant="outline" size="lg" onClick={focusPatientSearch}>
            <UserRoundSearch /> Search patients
          </Button>
        </div>
      </div>
      {children}
    </main>
  );
}
