# 11 · Clinical UI rules

> Every screen is built for a tired physician switching patients: the right patient is unmistakable, numbers can't be misread, AI output is always labelled, and nothing depends on color alone.

**Status:** accepted (revises the UI parts of [10](10-single-role-real-model-observation-only.md))

## The problem

The first UI was built to demonstrate the pipeline, not for clinicians:
- it pre-selected the first patient
- labels were 10–11px mono text
- dates were US-style (`03/14/2026` reads as two different days depending on the reader)
- status relied on color alone
- a half-typed message was lost when switching views

In a clinical tool each of these is a patient-safety problem: wrong-patient errors, misread doses, missed warnings.

## What we decided

- **Type and tokens.** Inter, with `cv05`/`cv08` so `Il1` stay distinct, and JetBrains Mono for IDs, MRNs and doses. A rem type scale runs from `text-meta` (13px) to `text-hero` (36px). Status tokens (`allow`, `flag`, `block`, `notice`, `focus`) have light and dark values. Nothing renders below 12px, and that is checked in a real browser, scaled SVG text included.
- **Formatting in one place.** One module formats dates (`09-Feb-1968`), 24-hour times with relative time (`14:20 · 3 h ago`), ages and doses (leading zero kept, trailing zero dropped, "units" never "U"), plus Tall Man lettering and durations. Components never format inline. A date of birth is formatted from its parts, never through `new Date()`, so it can't shift a day across time zones.
- **Patient identity.** Every worklist row shows two identifiers (DOB and MRN). No patient is pre-selected. A fixed banner shows name, DOB with age, sex and MRN. The open patient's row becomes a raised tab joined to the chart, and it slides when you switch. The composer restates the patient next to Send. Clearing a conversation asks first, naming the patient and MRN.
- **AI output.** Each answer is labelled "AI-generated" with the model that actually answered, shows ScrubX's verdict as an icon plus a word, and says "Not added to the record". Copying is the only way out, and it's a deliberate click. Blocked and flagged requests are inline notices, never pop-ups.
- **Interruption.** The selected patient and each patient's draft survive switching patient or view, in memory only ([06](06-stateless-server-client-held-history.md)).
- **Keyboard.** The patient search sits at the top of the worklist (name, MRN or DOB; Enter opens the first match), and ⌘K/Ctrl+K focuses it. Arrow keys move through the worklist and the trace steps. Focus is a 2px outline everywhere.
- **Motion.** `motion/react` at 150–200ms, honouring `prefers-reduced-motion`.
- **Display.** A theme (system/light/dark) and two densities (44px or 36px rows), both per viewer.
- **Layout.** Multi-pane on wide screens. Below `xl` (200% zoom on a 1920px display), the record and the chat share one pane behind a two-button switch, and both stay mounted.

## How it plays out in ScrubX

April Moss's medication table shows `SUMAtriptan` and `50 mg` in mono, right-aligned. Her DOB reads `17-Apr-1990 (36 y)`. The worklist row for Will Marsh reads `03-Nov-1949 (76 y M) MRN-100689`, so two patients with similar names can't be confused. An answer about him ends with `Allowed · Not added to the record · Copy answer · View trace`.

## Where it lives

- [src/app/globals.css](../../src/app/globals.css): type scale, status, focus and density tokens, reduced-motion override
- [src/lib/clinical-format.ts](../../src/lib/clinical-format.ts): every date, time, age, dose, Tall Man and duration
- [src/lib/patient-search.ts](../../src/lib/patient-search.ts): the worklist filter
- [src/lib/display.ts](../../src/lib/display.ts) and [display-bootstrap.ts](../../src/lib/display-bootstrap.ts): theme and density, applied before first paint
- [src/components/chat/](../../src/components/chat): `PatientList`, `PatientBanner`, `PatientRecord`, `ChatPanel`, `Message`
- [src/components/clinical/status.tsx](../../src/components/clinical/status.tsx): `OutcomeBadge` and `Notice`, always icon + word

## Trade-offs

- **No allergy notice in the banner, by product decision.** Clinicians check allergies in their own workflows, and a standing reminder in an assistant is noise. The records have no allergy field anyway.
- **Gaps in the data model.** Code status and "entered by" aren't recorded either. Sex is read from the summary prefix ("58F") and shown as "Not recorded" otherwise. Adding real fields means schema, migration and role-policy work.
- **Notes stay unformatted.** Free-text notes are shown exactly as stored, dates and all, because exposing hidden markup and planted instructions is the point.
- **Session timeouts** belong to the host, which owns authentication.
