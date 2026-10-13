# Clinical UI/UX Design Guidelines (Physician-Facing Medical Application)

> **Purpose of this file:** Use these guidelines as the design specification whenever you generate, review, or modify UI for this application. Treat rules marked **MUST** as non-negotiable. Treat **SHOULD** as strong defaults that need a stated reason to break. Font colors and color palettes are intentionally out of scope and defined elsewhere.

How ScrubX applies them, and where it can't yet, is in [ADR 0011](adr/0011-clinical-ui-guidelines.md).

---

## 0. Context: Who the Users Are

- Users are **physicians**: expert, time-pressed, frequently interrupted, often fatigued, and switching between patients.
- Decisions made in this UI affect patient safety. **Every design choice is a safety choice.**
- Users want **high information density**, keyboard efficiency, and predictable layouts. They don't want hand-holding or decorative flourishes.

---

## 1. Core Principles (apply in priority order when they conflict)

1. **Safety over aesthetics.** If "clean" and "unambiguous" conflict, choose unambiguous.
2. **Glanceability.** A physician must grasp the patient's status within ~5 seconds of opening a screen.
3. **Density with clarity.** Show a lot of information, organized well. Don't hide clinically relevant data behind extra clicks.
4. **Respect interruption.** Preserve state everywhere. Make resuming a task trivial.
5. **Earned attention.** Interruptions (modals, blocking alerts) are reserved for high-severity events only.
6. **Physician in control.** The system suggests; the clinician decides. Never auto-commit consequential actions.

---

## 2. Typography

### 2.1 Font Families

- **MUST** use a sans-serif with clearly distinguishable glyphs. Test against: `Il1|`, `O0`, `rn` vs `m`, `5S`, `8B`.
- UI/body font (pick one): `Inter`, `IBM Plex Sans`, `Source Sans 3`, `Atkinson Hyperlegible`.
- Monospace (for MRNs, IDs, codes, and dose columns in tables): `IBM Plex Mono` or `JetBrains Mono`.
- **MUST NOT** use thin/light display fonts, condensed fonts for data, or decorative fonts.
- **MUST** enable tabular numerals for all numeric data: `font-variant-numeric: tabular-nums;`

### 2.2 Type Scale (desktop workstation)

| Token | Role | Size | Weight | Line height |
|---|---|---|---|---|
| `--text-hero` | Critical value / key vital | 28–40px | 600 | 1.1 |
| `--text-title` | Page title | 24px | 600 | 1.25 |
| `--text-section` | Section header | 18–20px | 600 | 1.3 |
| `--text-body` | Body / reading text | 16px | 400 | 1.5 |
| `--text-data` | Dense tables & forms | 14px | 400–500 | 1.3–1.4 |
| `--text-meta` | Labels, timestamps, "entered by" | 12–13px | 500 | 1.3 |

### 2.3 Typography Rules

- **MUST NOT** render any text below 12px. **MUST NOT** render clinical data below 14px.
- **MUST** use only weights 400, 500, 600. No weights ≤ 300.
- **MUST** size type in `rem` so the layout survives 200% browser zoom.
- **SHOULD** cap line length at 60–80 characters for notes and reports.
- **MUST NOT** use ALL CAPS for running text (short labels only, sparingly).
- On bedside tablets, **SHOULD** raise body text to 17–18px.

### 2.4 Reference CSS

```css
:root {
  --font-ui: "Inter", "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace;

  --text-meta: 0.8125rem;   /* 13px */
  --text-data: 0.875rem;    /* 14px */
  --text-body: 1rem;        /* 16px */
  --text-section: 1.25rem;  /* 20px */
  --text-title: 1.5rem;     /* 24px */
  --text-hero: 2.25rem;     /* 36px */
}

body {
  font-family: var(--font-ui);
  font-size: var(--text-body);
  line-height: 1.5;
}

.numeric, td.num, .vital, .lab-value {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

---

## 3. Clinical Data Formatting (patient-safety rules)

All of these are **MUST** rules (based on ISMP and Joint Commission medication-safety guidance):

- **Leading zero, never trailing zero.** `0.5 mg` ✅ `.5 mg` ❌ — `5 mg` ✅ `5.0 mg` ❌
- **Unit attached to every value**, every time: `142 mmol/L`. A unit in the column header alone is not enough.
- **No error-prone abbreviations.** Write `units` (not `U` / `IU`), `daily` (not `QD`), `every other day` (not `QOD`).
- **Tall Man lettering** for look-alike/sound-alike drugs: `hydrOXYzine` / `hydrALAZINE`, `predniSONE` / `prednisoLONE`.
- **Unambiguous dates:** `12-Oct-2026`. Never `10/12/26` or `12/10/26`.
- **24-hour time:** `14:20`.
- **Show absolute and relative time together** for clinical data: `14:20 · 3 h ago`.
- **Numbers right-aligned or decimal-aligned** in tables. Text left-aligned.
- **Abnormal values flagged with text/icon, never color alone:** `H`, `L`, `!!` (critical), ▲ / ▼ trend arrows.

---

## 4. Layout and Spacing

- **MUST** use an 8-point spacing grid (4px half-steps allowed in dense components).
  Tokens: `4, 8, 12, 16, 24, 32, 48, 64`.
- **SHOULD** design for a 12-column grid on wide screens (1920px+ is common). Use multi-pane layouts; avoid one narrow centered column.
- **MUST** offer two density modes:
  - *Comfortable* (default): 44–48px table rows
  - *Compact*: 32–36px table rows
- **MUST** keep layout positions stable across all screens and all patients. Physicians rely on spatial memory ("labs are always top-right").
- **SHOULD** follow progressive disclosure: overview first → zoom and filter → details on demand.

### 4.1 Persistent Patient Banner (MUST)

Every screen that shows patient data **MUST** have a fixed banner containing:

- At least **two identifiers**: full name + DOB and/or MRN
- Age, sex
- **Allergies** (always visible, never collapsed)
- Key flags: code status, isolation, etc.

If multiple patient charts can be open at once, each **MUST** be visually distinct and impossible to confuse. Wrong-patient errors are a known failure mode.

---

## 5. Interaction Design

### 5.1 Target Sizes

| Context | Minimum target |
|---|---|
| Mouse, dense desktop | 32×32px (WCAG 2.2 AA floor: 24×24) |
| Touch / tablet | 44×44px |
| Gloved hands / mobile rounds | 48×48px+ |

### 5.2 Efficiency

- **MUST** be fully keyboard-operable with logical tab order and visible focus states.
- **SHOULD** provide shortcuts for frequent actions and a command palette (`Ctrl/Cmd + K`) to jump to patients, orders, and results.
- **SHOULD** minimize clicks on frequent paths: reviewing labs, signing notes, reordering.

### 5.3 Defaults

- **MUST NOT** pre-fill doses or pre-select patients.
- Smart suggestions are fine, but consequential choices **MUST** require an explicit user action.

### 5.4 Tiered Alert System

Match intrusiveness to severity. Most information belongs in tiers 1–2.

| Tier | Pattern | Example |
|---|---|---|
| 1. Passive | Inline icon or badge | Result pending |
| 2. Advisory | Non-blocking banner | Duplicate therapy suggestion |
| 3. Soft stop | Modal, overridable **with a required reason** | Moderate drug interaction |
| 4. Hard stop | Blocks the action entirely | Documented anaphylaxis to the ordered drug |

- **MUST NOT** use blocking modals for low-severity information.

### 5.5 Error Prevention and Recovery

- Confirm only irreversible or high-risk actions, and the confirmation **MUST** restate the specifics:
  > Discontinue **heparin infusion** for **J. Smith (MRN 4471)**?

  Never a generic "Are you sure?"
- **SHOULD** offer undo wherever clinically possible.
- **MUST** autosave drafts continuously.
- On session timeout, **MUST** warn before expiry and preserve unsaved work.
- **MUST NOT** use optimistic UI for orders or other clinical actions. Show "sent" only after server confirmation.

---

## 6. Trust, Provenance, and AI Output

- **MUST** show provenance for clinical data: who entered it, when, source/device, and status (preliminary vs. final).
- **MUST** make view mode and edit mode visually distinct.
- AI-generated content:
  - **MUST** be clearly labeled (e.g., `AI-suggested · Model v2.1`).
  - **SHOULD** show confidence and supporting evidence (highlighted image region, contributing features).
  - **MUST** require a deliberate physician action to accept or reject.
  - **MUST NOT** enter the record silently.

---

## 7. Imaging and Data Visualization

- Image viewers: neutral, non-distracting surround; zoom, pan, and measurement tools; side-by-side comparison across time.
- **SHOULD** place a sparkline or trend next to the current value of labs and vitals.
- Charts: labeled axes **with units**, reference ranges as a shaded band, no 3D, minimal gridlines, no decorative elements.

---

## 8. Accessibility and Environment

- **MUST** meet WCAG 2.2 AA: 200% zoom support, screen-reader semantics, visible focus indicators.
- **MUST NOT** rely on color alone to convey meaning; pair it with an icon, text, or shape.
- **SHOULD** account for real conditions: glare, older monitors, night shifts (support a dark theme), shared workstations (fast login/logout, privacy-aware idle states).

---

## 9. Motion and Performance

- **MUST** give visible feedback within 100ms of any interaction. Use skeleton loaders for slower operations.
- Motion **SHOULD** be 150–200ms and purposeful (show what changed, never decorate).
- **MUST** respect `prefers-reduced-motion`.
- Treat speed as a clinical feature: slow screens cause workarounds, and workarounds create risk.

---

## 10. Review Checklist (run before shipping any screen)

- [ ] Patient banner present with 2+ identifiers and allergies visible
- [ ] No text below 12px; no clinical data below 14px
- [ ] Tabular numerals on all numeric data; numbers right/decimal-aligned
- [ ] Every value has its unit attached
- [ ] Leading zeros present, trailing zeros absent
- [ ] Dates in `DD-Mmm-YYYY`, times in 24h
- [ ] Abnormal values flagged with text/icon, not color alone
- [ ] Alerts use the correct tier; no unnecessary modals
- [ ] High-risk confirmations restate drug, dose, and patient
- [ ] No pre-filled doses or pre-selected patients
- [ ] Drafts autosave; timeouts preserve work
- [ ] AI output labeled and requires explicit acceptance
- [ ] Fully keyboard-operable with visible focus
- [ ] Works at 200% zoom and in both density modes

---

## 11. Reference Standards

- **IEC 62366-1** — Usability engineering for medical devices
- **FDA**, *Applying Human Factors and Usability Engineering to Medical Devices*
- **ISMP** and **Joint Commission "Do Not Use" list** — abbreviations and dose formatting
- **NHS Common User Interface (CUI)** guidelines — patient banner, date/time display
- **WCAG 2.2** — accessibility baseline
