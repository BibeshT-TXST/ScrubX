import { DemoPatientRepository } from "@/core";

// Phase 0 placeholder: proves the core data layer loads in a server component.
// Replaced by the Chat View in Phase 2.
export default async function Home() {
  const patients = await new DemoPatientRepository().list();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">ScrubX</h1>
        <p className="text-muted-foreground">
          Secure inference pipeline: normalize, detect, decide, tokenize, model, restore.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          demo patients · synthetic data
        </h2>
        <ul className="divide-y rounded-lg border">
          {patients.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="font-medium">{p.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{p.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
