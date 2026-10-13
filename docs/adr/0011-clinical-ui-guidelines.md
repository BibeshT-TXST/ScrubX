# 0011 · Clinical UI guidelines as the design spec

**Status:** accepted (revises the UI parts of 0010)

**Context.** The UI was built for demonstrating the pipeline, not for physicians. It pre-selected the first patient, used 10–11px mono labels, US-style dates, colour-only status, and lost the draft on navigation. [docs/ui-guidelines.md](../ui-guidelines.md) is now the specification for every screen. Its MUST rules are patient-safety rules (ISMP, Joint Commission, NHS CUI, WCAG 2.2).

**Decision.**
- **Type and tokens.** Inter (with `cv05`/`cv08` so `Il1` stay apart) and JetBrains Mono for IDs, MRNs and doses, via `next/font`. A rem type scale (`text-meta` 13px → `text-hero` 36px) and status tokens (`allow`, `flag`, `block`, `notice`, `focus`) live in `globals.css` with light and dark values. Nothing renders below 12px. A browser check measures every visible text node, scaled SVG included.
- **Formatting is one pure module.** `src/lib/clinical-format.ts` owns dates (`09-Feb-1968`, never from `new Date(iso)`, so a DOB can't shift a day), 24-hour times with relative time (`14:20 · 3 h ago`), ages, leading/trailing-zero rules, dose splitting, "Do Not Use" unit words and Tall Man lettering (a data list). Components never format inline.
- **Patient identity.** `PatientSummary` gains `dob` and `mrn`, so every worklist row carries two identifiers. No patient is pre-selected. A fixed banner shows name, DOB with age, sex and MRN. The open patient's row becomes a raised tab that joins the chart and slides when you switch, so the selection reads by shape and motion, not by a coloured bar. The composer restates the patient next to Send, and clearing a conversation confirms with the patient's name and MRN.
- **AI output.** Each answer is labelled "AI-generated" with the model the trace says answered, shows ScrubX's verdict as icon plus word, and says "Not added to the record". Copying it is the only way it leaves, and that's a deliberate action. Blocked and flagged requests are inline tier-2/4 notices, never modals.
- **Interruption.** The selected patient and each patient's draft live in the in-memory chat store (ADR 0006), so they survive switching patient or view. They are not in browser storage, because drafts can hold PHI.
- **Per-viewer display.** Theme (system/light/dark) and density (comfortable 44px rows, compact 36px) are the only things in `localStorage`. A pre-paint script in the root layout applies them.
- **Keyboard and motion.** The patient search sits at the top of the worklist (name, MRN or DOB; Enter opens the first match), and ⌘K/Ctrl+K focuses it. There is no command palette: views are two tabs in the header and display settings are one menu. Arrow keys move through the worklist and the trace steps. Focus is a 2px outline, and component rings use the same color. Motion (`motion/react`) runs 150–200ms with `reducedMotion="user"`, and CSS animations are disabled under `prefers-reduced-motion`.
- **Layout.** Multi-pane on wide screens. Below `xl`, which covers 200% zoom on a 1920px display, the record and chat share one pane behind a two-button switch, and both stay mounted.

**Consequences.**
- **Allergies are not in the banner, by product decision.** The guideline makes them a MUST. Clinician feedback was that allergy checking belongs to the clinical workflows physicians already follow, and a standing reminder in an assistant is noise. The records have no allergy field anyway. **Code status** isn't a field either. **Sex** is read from the summary prefix ("58F") and shown as "Not recorded" otherwise. **Entered by** isn't recorded either. Adding these fields means a schema, Supabase migration and role-policy change, and whether they're sent to the model (Retrieval) is a separate decision.
- Session timeout warnings belong to the host, which owns auth (ADR 0007). ScrubX has no session to expire.
- Free-text notes are shown exactly as stored, dates and all, because showing hidden markup and injected instructions is the point. Reformatting applies to structured fields only.
- Abnormal-value flags and lab sparklines (guidelines §3, §7) have nothing to attach to until the record has structured results.
