# DOCUMENTO Design System & UI/UX Principles
## Product-specific visual language, components, layouts, and interaction standards

**Repository:** `yasheshbhavsar/The-Documento`  
**Primary implementation:** `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/page.tsx`, and `apps/web/components/**`  
**Audience:** Claude Code CLI, frontend engineers, product designers, QA, and contributors  
**Status:** Design contract for incremental implementation. Existing patterns should be audited and consolidated—not blindly replaced.

> This document defines the intended design system. It does not claim every component, state, accessibility behavior, or responsive rule described here is already implemented. Before changing code, inspect current component and page implementations, identify duplication and gaps, and preserve working behavior.

---

## 1. Product design mission

Documento is a professional immigration case and document-intelligence platform. Its UI must make sensitive, complex work feel calm, trustworthy, understandable, and controlled.

The product serves different users with different needs:
- **Clients/applicants:** simple next steps, document uploads, clear status, messaging, forms, and reassurance.
- **Case processing officers:** document triage, review, requests, corrections, form preparation, and package preparation.
- **Senior reviewers/lawyers/authorized professionals:** evidence-backed decisions, discrepancy review, approvals, deadlines, and quality control.
- **Managers/organization owners:** urgent work, workload, blocked cases, escalations, staff visibility, operational health, and configuration.
- **Rule editors/approvers/auditors/system administrators:** governed configuration, source/version traceability, audit and reliability tools.

The interface must not expose staff-only operations or internal risk notes to clients. Role and tenant authorization must be enforced on the server; UI visibility is only a convenience layer.

### Design outcomes
1. Users immediately understand where they are and what matters next.
2. Critical deadlines and unresolved high-priority issues are visible without creating constant alarm.
3. AI findings are explainable, source-linked, and clearly distinguished from human decisions.
4. The client portal remains simple even while the staff workspace supports complexity.
5. Every interaction has a predictable state: idle, loading, success, empty, error, retry, disabled, or permission denied.
6. The UI feels distinctively Documento, not like an unmodified admin template.
7. Visual quality never overrides accessibility, speed, accuracy, privacy, or workflow safety.

---

## 2. Audited starting point and implementation boundaries

The repository currently contains:
- Next.js/React UI under `apps/web`.
- TypeScript UI components and role-specific surfaces including `ClientPortal`, `EmployeeWorkspace`, and `OwnerMasterDashboard`.
- A global light-theme stylesheet in `apps/web/app/globals.css`.
- Shared components such as `Button`, `Badge`, `Card`, `DataTable`, and `MetricCard`.
- A foundation architecture that identifies a multi-tenant, multi-country case and document-intelligence product.

The current stylesheet already defines:
- Brand teal, mint, seafoam, cream, and white colors.
- Inter, Instrument Serif, and Plus Jakarta Sans font stacks.
- Semantic state colors.
- Radius and shadow variables.
- Keyboard focus-visible rules, a skip-to-content pattern, and reduced-motion support.
- Application shell, sidebar, navigation, topbar, and user-chip styles.

**Implementation rule:** use and consolidate existing theme tokens before adding new ones. Do not introduce a separate UI framework or competing token system without a documented reason. The code and rendered browser state are the source of truth for what actually works.

---

## 3. Brand personality

### 3.1 Desired qualities
- Calm confidence.
- Human and reassuring, without infantilizing users.
- Precise and evidence-led.
- Premium editorial character, used selectively.
- Modern and technically capable without looking futuristic for its own sake.
- Warm enough for applicants; disciplined enough for legal and professional workflows.

### 3.2 Avoid
- Dense dashboards that expose every feature at once.
- Excessive cards nested inside other cards.
- Constant gradients, glass effects, glows, and blurred backgrounds.
- Neon colors or exaggerated AI motifs.
- Generic stock SaaS illustrations that compete with task completion.
- Using red for ordinary pending work.
- Fake metrics, fake processing progress, static demo values presented as live data, and dead buttons.
- All-uppercase text for ordinary labels.
- Overly tiny type, dense tables on mobile, or color-only status communication.
- Automatically treating AI suggestions as approved facts.

### 3.3 Signature visual language
Use a combination of:
- Warm neutral canvas.
- Deep teal for trusted structure and primary actions.
- Mint/seafoam for quiet emphasis and success-neutral surfaces.
- Editorial serif headlines at high-level moments.
- Highly legible sans-serif body/UI typography.
- Thin borders, restrained elevation, clear alignment, and comfortable spacing.
- Optional travel imagery or abstract route/globe motifs in marketing and select empty states—not on every dashboard card.

The image-led, cinematic direction belongs primarily to public marketing pages and carefully chosen dashboard moments. Operational views should prioritize clarity and speed.

---

## 4. Color system

Use CSS custom properties in `apps/web/app/globals.css` as the single source of truth. Components should consume variables rather than hard-coded hex codes.

### 4.1 Brand palette

| Token | Value | Intended use |
|---|---|---|
| `--brand-deep` | `#063C3D` | Dark brand surfaces, strong emphasis, compact headers |
| `--brand-teal` | `#0D6866` | Main brand and primary controls |
| `--brand-teal-bright` | `#2A9288` | Hover/active emphasis and restrained visual accent |
| `--brand-mint` | `#B9DED4` | Decorative mint and large quiet accents |
| `--brand-seafoam` | `#DDEFE8` | Selected navigation and subtle highlighted surfaces |
| `--brand-cream` | `#F8F7F2` | Warm page canvas |
| `--brand-white` | `#FFFFFF` | Main surfaces |

### 4.2 Semantic tokens

| Token | Existing/intended value | Meaning |
|---|---|---|
| `--text` | `#172322` | Primary text |
| `--text-muted` / `--muted` | `#445451` | Secondary text |
| `--text-quiet` / `--quiet` | `#6E7F7C` | Tertiary text; verify contrast before use |
| `--border` / `--border-subtle` | `#DCE5E1` | Subtle separation |
| `--border-strong` | `#BDCDC7` | Stronger boundaries |
| `--success` | `#176B50` | Completed/verified success |
| `--success-soft` | `#EAF6F0` | Success surface |
| `--warning` | `#8A5A10` | Attention needed |
| `--warning-soft` | `#FEF7EA` | Warning surface |
| `--critical` | `#A62D35` | Blocking/error/critical |
| `--critical-soft` | `#FDF2F2` | Critical surface |
| `--info` | `#205E8C` | Informational or in-progress state |
| `--info-soft` | `#EDF5FB` | Information surface |

### 4.3 Rules
- Use semantic tokens for status, not brand tokens.
- A status always has text/icon/shape, not color alone.
- Red is reserved for errors, blocking issues, overdue critical matters, and destructive confirmation.
- Amber communicates attention or a client/staff action required—not failure.
- Blue communicates neutral information or in-progress review, when that distinction is useful.
- Green is for an explicitly completed, verified, or successful state.
- Do not use mint text on white or quiet grey text on cream unless contrast is verified.
- Do not use gradient text for critical information.
- Keep a light theme as the product default; no dark-mode toggle unless product direction explicitly changes. Dark teal sections may exist as controlled brand surfaces, not a competing theme.

---

## 5. Typography

The existing font intent is:
- **Instrument Serif:** expressive page titles, marketing headlines, selected high-level section titles.
- **Inter:** UI text, forms, tables, metadata, navigation, buttons.
- **Plus Jakarta Sans:** compact display or emphasis where needed; do not use it as a third competing hierarchy everywhere.

### 5.1 Type scale

| Role | Suggested desktop size | Weight | Use |
|---|---:|---|---|
| Marketing display | 56–88 px, fluid | Regular | Landing hero only |
| Page title | 34–44 px | Serif regular or sans semibold | Top-level landing/dashboard welcome |
| Section title | 20–26 px | 500–650 | Primary content section |
| Card title | 16–19 px | 600 | Card or panel title |
| Body | 15–16 px | 400 | Main content |
| Secondary/body small | 13–14 px | 400 | Supporting text |
| Label | 12–13 px | 500–650 | Form and metadata labels |
| Eyebrow | 10–12 px | 650–750, letter spacing | Rare section overline |
| Dense table metadata | 12–13 px | 400–500 | Only where necessary |

Values are guidelines, not a mandate to enlarge every text element. Maintain readable line height; ordinary body text should begin around 1.5 line-height. Prefer fluid `clamp()` for display typography and avoid layout jumps at breakpoints.

### 5.2 Typography rules
- Use sentence case for navigation and labels.
- Use serif sparingly; never use it for dense tables, controls, or complex document data.
- Avoid long paragraphs with very wide line lengths.
- Use tabular numerals for counts, dates, amounts, and IDs where alignment matters.
- Use a real heading hierarchy (`h1`, `h2`, `h3`) instead of styling arbitrary elements to look like headings.
- Do not rely on weight alone to differentiate status.

---

## 6. Spacing, grids, containers, and geometry

### 6.1 Spacing scale
Use a consistent 4px base scale: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.

- 4–8px: icon/text gaps and compact internal alignment.
- 12–16px: control/panel internals.
- 20–24px: card padding and standard section gaps.
- 32–40px: page section separation.
- 48–96px: marketing sections and page-level breathing room.

Avoid one-off spacing values unless a visual refinement justifies them. Do not over-space dense professional queues where scan speed matters.

### 6.2 Radius and elevation
Existing tokens begin at 8px, 12px, and 16px. Keep radii consistent:
- Small controls/chips: 6–9px.
- Standard controls/cards: 8–12px.
- Major editorial/hero panels: up to 16–24px only when the design merits it.
- Pills: full radius, used selectively.

Use shadows from subtle to stronger only when surfaces genuinely need hierarchy. Prefer borders and background contrast over large floating shadows. Avoid giving every card the same heavy shadow.

### 6.3 Main layout
- Use a responsive layout with a clear page container and predictable gutters.
- Desktop staff views can use a persistent sidebar and flexible main content.
- Client views should have a simpler, lower-choice navigation.
- Use a 12-column mental grid for complex desktop screens but do not force every region into 12 visible cards.
- Keep main content `min-width: 0` and handle table overflow deliberately.
- Avoid horizontal page scroll at any supported width.
- Keep primary action visible without excessive scrolling on common laptop viewports.
- Use `max-width` to maintain readable text and prevent full-width cards on ultra-wide screens.

### 6.4 Suggested app-shell measurements
These are targets; preserve current measurements where already sound:
- Desktop sidebar: 224–256px, with a compact/collapsed option only if it is useful and accessible.
- Top bar: about 64–80px.
- Page horizontal padding: 24–40px desktop, 16–24px tablet, 16px mobile.
- Page section gaps: 20–32px.
- Form max-width: 640–800px for linear forms; document review can use a split workspace.
- Client dashboard: main content should prioritize next action and progress; keep secondary actions below the primary task.

---

## 7. Layout archetypes

Do not force one layout on every user role.

### 7.1 Public marketing site
Purpose: explain value and build trust.
- Distinctive editorial hero; one primary CTA and one secondary CTA.
- One carefully art-directed image/illustration, not a gallery of generic cards.
- Clear product workflow section, product proof/demo, security/trust information, supported-scope explanation, and footer.
- Motion is purposeful and supports story; content remains accessible and performance-friendly.
- Never fabricate customer counts, success rates, countries, legal claims, or customer logos.

### 7.2 Client portal shell
Purpose: help applicants understand status and complete actions.
- Minimal navigation: Overview, My Documents, Messages, My Application. Add secondary options only when truly needed.
- Header: Documento mark, language preference, notification indicator if live, and client profile menu.
- Welcome title and short status sentence.
- Progress tracker with clear labels.
- One primary “next step” panel when a client action is outstanding.
- Compact document checklist summary.
- Case officer/message preview.
- Help/support area.
- Do not display staff-only review notes, fraud flags, internal risk scores, operational metrics, or irrelevant configuration.
- If no client action is required, display a calm “Nothing needed from you right now” state with the next expected update when known.

### 7.3 Case workspace
Purpose: review one matter with full context.
- Case identity, client/applicants, jurisdiction/pathway and support status.
- Stage/status, next action, owner, due dates, and approval requirements.
- Tabs or anchored sections: Overview, Documents, Requirements, Forms, Messages/Correspondence, Timeline, Package.
- Document states must separate uploaded, processed, reviewed, accepted, rejected, correction-required, verified, and package eligible.
- All discrepancy claims link to source pages.
- Avoid duplicating the same checklist and timeline in every panel.

### 7.4 Employee workspace
Purpose: complete assigned work efficiently.
- My queue, due/overdue tasks, client responses, reviews waiting, and assigned cases.
- Filters and sort controls are visible and understandable.
- Clear ownership, due date, urgency, and next action.
- Bulk actions allowed only when safe, permissioned, and reversible/audited.
- Prefer a fast list/queue + detail panel pattern for repeated review work.

### 7.5 Manager/owner workspace
Purpose: control risk and workload.
Priority order:
1. Urgent/overdue immigration-authority deadlines.
2. Workload and capacity.
3. Blocked cases.
4. Overdue client responses.
5. Pending reviews/approvals.
6. Quality issues and escalations.
7. Payment status.
8. Overall operational performance.

Show real data only. Use clear summaries with drill-down, not vanity dashboards. Alerts should state case, owner, deadline, urgency, and next action.

### 7.6 Document review workspace
Purpose: inspect source evidence, AI analysis, and review decision.
- Split view: document/PDF preview on one side; extracted data, checks, and review controls on the other.
- Page thumbnails/controls and zoom.
- Extracted fields with source location and original/raw value where available.
- Comparison panel for mismatches and the documents/pages involved.
- Distinguish OCR confidence from identity certainty, consistency, legal sufficiency, and human verification.
- Clear “confirm”, “correct”, “needs more review”, and “reject/request correction” actions according to actual permissions.
- Sticky review controls only when they do not obscure source content.
- Do not show an AI finding as a final legal conclusion.

### 7.7 Upload center
- Clear drop zone plus browse/file picker; mobile camera support when available.
- Accepted file types/size and upload limits before selection.
- Multi-file queue with each file's progress, status, retry, remove/cancel if safe, and error reason.
- Combined PDF guidance.
- Clear note: uploaded does not mean accepted/verified.
- Prevent duplicate submission and handle interrupted uploads.
- Accessible drag-and-drop must have a keyboard/file-picker alternative.

### 7.8 Settings/configuration
- Organize by recognizable groups: Firm, Users & Roles, Countries & Pathways, Checklists, Folder/Package Rules, Notifications & Escalations, Data Lifecycle, Integrations.
- Separate draft from published settings where governance matters.
- Show the impact of changes and effective version.
- Dangerous/irreversible actions require confirmation and audit.
- Keep legal-rule editing and publication separation intact.

---

## 8. Component inventory and component contracts

Use a small, consistent set of reusable components. Extend existing components in `apps/web/components/common/**` before creating duplicates.

### 8.1 Brand and structure
**BrandMark / BrandLockup**
- Logo mark and wordmark variants.
- Supports light and deep-teal backgrounds.
- Must remain legible at small sizes.
- Do not approximate logo with arbitrary emoji.

**AppShell**
- Handles app layout, navigation, content frame, and responsive behavior.
- Should not own business data-fetching or role decisions.

**Sidebar / SideNav**
- Active route, icon, label, optional badge, grouped navigation.
- Keyboard navigation and accessible names.
- Mobile becomes a drawer or simplified navigation.
- Only show routes authorized for the current role, backed by server authorization.

**TopBar**
- Page context, global search only if functional, notifications only if live, language and account menus.
- Avoid stacking too many controls in narrow viewports.

**Breadcrumbs**
- Use on deep staff workflows, not every client screen.
- Must be navigable and semantically marked.

**PageHeader**
- Title, optional description, status, contextual action.
- One dominant primary action per screen where possible.

**SectionHeader**
- Title, optional count/help text, optional secondary link/action.

### 8.2 Buttons and controls
**Button variants**
- Primary: main task action (deep/primary teal).
- Secondary: alternative action, restrained border/surface.
- Tertiary/ghost: low-emphasis actions.
- Destructive: delete/revoke/cancel final action only.
- Link: navigation/action in text form.
- Icon-only: only with tooltip and accessible label.

**Button sizes**
- Small for dense toolbars, medium default, large for prominent client upload/CTA.
- Target touch area around 44px where practical; avoid tiny hit targets.

**Button states**
- Default, hover, focus-visible, pressed, disabled, loading, success feedback where suitable.
- Loading buttons prevent duplicate actions and announce state.
- Never use a fake button; if disabled, explain why when it is not obvious.

**Form controls**
- Text input, textarea, select/combobox, checkbox, radio, switch, date/time control, file picker, search input.
- Always have a visible label or equivalent accessible name.
- Helper text, validation state, error association, required/optional label.
- Validate client-side for usability and server-side for authority.
- Preserve user input when a recoverable error occurs.
- Avoid placeholders as the only labels.

**Search & filters**
- Clear filter chips, active filter count, reset action, loading/no-results state.
- Support keyboard access and sensible query persistence.
- Do not add global search UI unless search is implemented.

**Pagination / table controls**
- Display result count, current page, page size where useful.
- Avoid loading thousands of records into a client-side table.
- Maintain filters when navigating if expected.

### 8.3 Surfaces and containers
**Card / Panel**
- Use for related content grouping, not as a default wrapper for every element.
- Prefer flat sections with separators when a card adds no meaning.
- Card variants: standard, subtle, interactive/clickable, critical/attention panel.
- Interactive card must have a clear affordance and keyboard semantics.

**Modal / Dialog**
- Use for focused tasks that benefit from context preservation.
- Trap focus, label dialog, close with Escape when safe, restore focus.
- Destructive confirmation must name the consequence.
- Do not put complex multi-page workflows in a tiny modal.

**Drawer**
- Use for contextual case/document details where the underlying queue should remain visible.
- On mobile, use a full-screen or near-full-screen presentation.

**Popover / Tooltip**
- Use for short optional explanations, never for essential instructions inaccessible to touch/keyboard users.
- Tooltips must not hold the only copy of critical information.

**Tabs**
- Use for equivalent peer content areas.
- Keep tab labels short; support keyboard interaction and correct ARIA roles.
- Do not use tabs to hide urgent tasks from overview.

**Accordion / disclosure**
- Use to reduce secondary information.
- Avoid hiding required action, deadline, or high-severity alert by default.

**Divider / Spacer**
- Prefer spacing and background changes first; use divider only where it clarifies grouping.

### 8.4 Data display
**Badge / StatusPill**
- Compact status text with semantic styling and optional icon.
- Avoid badge overload; most rows need one clear status.
- Use consistent vocabulary from domain states.

**AlertBanner / InlineAlert**
- Severity: information, success, warning, critical.
- Says what happened, what it means, and what the user should do.
- Dismissible only when appropriate; critical blocking issues must not disappear without resolution.

**MetricCard**
- Reserved for useful, real, contextual measures.
- Include label, value, comparison/time range if valid, and link to details where helpful.
- Never show fabricated metrics.

**DataTable**
- Appropriate for dense staff queues, not default client layouts.
- Clear columns, sorting, filtering, pagination, row actions, selected state.
- Responsive strategy: horizontal scroll with clear affordance or switch to stacked rows/cards.
- Do not force complex desktop tables on mobile.
- Accessible header scope and row/action labels.

**List / ActivityFeed**
- Use for recent document events, timeline, notifications, and case activity.
- Time, actor, event, and result where meaningful.
- Do not expose internal staff notes in a client-visible activity feed.

**Progress**
- Stepper: discrete workflow stages.
- Progress bar: a measurable known fraction only.
- Skeleton: layout placeholder while loading.
- Never present invented percentage completeness or pretend external-authority processing progress is known.

**Timeline**
- Chronological events with timestamps, actor, event, and result where meaningful.
- Distinguish client-visible from staff-only events.

**EmptyState**
- Short title, helpful reason, one action where appropriate, optionally restrained illustration.
- Avoid blaming the user.
- Do not use an empty state when data is still loading or failed to load.

**Skeleton**
- Match the final content dimensions; use sparingly.
- Respect reduced-motion preferences.

### 8.5 Document and AI components
**DocumentRow / DocumentCard**
- File name/type, applicant association if confirmed, lifecycle status, last update, permitted actions.
- Never imply acceptance based on upload or OCR alone.

**UploadDropzone**
- Browse/file-picker alternative, upload limits, progress/retry states, accessible drop behavior.

**PDFViewer / PageStrip**
- Page navigation, zoom, rotate where supported, loading/error state, keyboard-friendly controls.
- Keep original immutable evidence distinct from derived previews.

**ExtractedField**
- Field label, normalized value, original value if relevant, source page and location, confidence/uncertainty, validation/review state.

**ConfidenceIndicator**
- Explain what confidence measures (e.g. OCR transcription confidence).
- Do not make it look like a probability of visa approval, truthfulness, or legal sufficiency.

**EvidenceCitation**
- Link a claim/field/finding to source file/page/snippet where available.
- Citations must resolve to the exact evidence referenced.

**DiscrepancyCard**
- Shows the values compared, source documents/pages, comparison type, severity, uncertainty, and review action.
- Do not label discrepancy as fraud or dictate legal treatment.

**ReviewDecisionPanel**
- Allowed decisions for current role and workflow state.
- Captures decision, reason, actor, timestamp, and notes according to policy.
- No bypass of mandatory package/approval gates.

**DocumentStatusStepper**
- Keep distinct states for uploaded/received, processing, under review, accepted/rejected/correction required, verified, and package eligibility.
- The exact mapping must match backend domain state; do not infer success from missing errors.

**PackageManifest**
- Included/excluded file, reasons, order, configured name, source IDs/pages, reviewer or disposition, warnings, configuration version.
- Allow permitted adjustments, recording every consequential change.

**AIProcessingState**
- Pending, processing, completed, needs review, partial failure, failed/retryable.
- State what is happening in human terms.
- Never show indefinite fake progress.

### 8.6 Messaging and task components
**MessageThread**
- Clearly marks sender, timestamp, delivery/read state only if actually supported.
- Client conversation and team/internal notes must be visually and access-wise separate.
- Do not imply messages are end-to-end encrypted unless implemented and verified.

**InternalNote**
- Strong visual label “Internal note — not visible to client”.
- Avoid using client-facing chat style that could cause accidental disclosure.

**TaskItem / ActionCard**
- Title, case/applicant context, owner, due date, urgency, next action, blocked reason.
- Critical deadline should not be hidden behind hover or tooltip.

**NotificationItem**
- Event and destination, time, unread state.
- Do not show notifications without a real event source.

**AppointmentCard**
- Date/time/timezone, purpose, location/link, relevant actions.
- Empty/cancelled states must be clear.

### 8.7 People and roles
**Avatar / UserChip**
- Use initials when photo is not available; do not require profile photos.
- Avoid exposing unnecessary personal details.

**RoleBadge**
- Use only in staff contexts where role is relevant.
- Not a substitute for authorization.

**ApplicantSummary**
- Clear identity context, family relationship only where appropriate, and privacy-conscious display of sensitive identifiers (mask when full value is unnecessary).

### 8.8 Feedback and overlays
**Toast**
- Short, non-critical confirmation/error.
- Do not use toast as the only reporting of critical errors or destructive consequences.

**Inline form error**
- Persistent until corrected; associated with the relevant control.

**ConfirmationDialog**
- Describes exact action and consequence, especially irreversible deletion or withdrawal.
- Use specific action labels, not ambiguous “OK”.

**Command menu**
- Only if there are enough keyboard workflows to justify it.
- Should not duplicate standard navigation.

**Help widget**
- Must be unobtrusive and usable on mobile.
- Do not obscure upload controls or critical actions.

---

## 9. Domain status vocabulary

Use consistent plain-language terms. Backend status names may differ, but UI mappings must be explicit and centralized.

### 9.1 Client document lifecycle
Recommended visible words:
- **Not requested** — no requirement currently exists.
- **Needed** — the client must provide it.
- **Received** — uploaded/received; not yet accepted.
- **Processing** — extraction/classification is running.
- **Under review** — a staff member is reviewing it.
- **Correction needed** — action required from the client.
- **Accepted** — staff accepted it for the stated checklist purpose.
- **Verified** — required human review checks have passed for the stated scope.
- **Optional** — not mandatory under the current configured checklist.
- **Unavailable / exception review** — client reported inability to obtain it; approval may be required.
- **Package ready** — eligible for a package only after all required checks/approvals pass.

Do not collapse Received, Accepted, Verified, and Package ready into one “Complete” state.

### 9.2 AI finding lifecycle
- New finding.
- Needs human review.
- Confirmed issue.
- Not an issue / false positive.
- Resolved with documented disposition.
- Reopened after new evidence.

Use neutral labels; avoid “fraud detected” unless an authorized human-led workflow supports such a conclusion and the exact policy has been reviewed.

### 9.3 Case workflow
Case statuses must be driven by the actual domain model and configured workflow. UI labels should distinguish:
- Active work.
- Waiting for client.
- Waiting for internal review/approval.
- On hold.
- Ready for authorized submission.
- Submitted / awaiting authority.
- Completed.
- Withdrawn / closed.

Do not infer legal outcome or approval timeline from internal workflow progress.

---

## 10. Interaction and motion principles

### 10.1 Motion purpose
Motion should communicate continuity, hierarchy, or feedback, not decoration for its own sake.

Good uses:
- Short hover/focus transitions.
- Smooth drawer/modal entry.
- Progress-step transition after a real state change.
- Subtle image crop or depth effect on marketing pages.
- Scroll-linked storytelling on public pages when content remains accessible.

Avoid:
- Long transitions for routine staff tasks.
- Scroll hijacking.
- Animating every card independently.
- Parallax behind critical text or document previews.
- Motion that delays upload, review, or navigation.
- Auto-playing video/audio in the client portal.

### 10.2 Motion tokens
Suggested starting points:
- Micro interaction: 120–180ms.
- Standard transition: 180–260ms.
- Complex overlay: 220–320ms.
- Use ease-out for entrances and ease-in/out for state changes.
- Keep hover/focus movement minimal (1–2px) and avoid layout shifts.
- Use CSS variables for duration/easing if motion becomes a recurring system.

### 10.3 Reduced motion
The existing `prefers-reduced-motion` support must be preserved. Any new animation should honor it. Never rely on animation alone to communicate state.

---

## 11. Responsive behavior

Test at minimum:
- 320–375px narrow phones.
- 390–430px common phones.
- 768px tablet/portrait.
- 1024px compact laptop/tablet landscape.
- 1280–1440px common desktop.
- 1600px+ wide desktop.

### Mobile
- Client portal is first-class; not a shrunken desktop.
- Sidebar becomes a navigation drawer or compact bottom/top navigation.
- Keep one primary action in the first viewport where practical.
- Use stacked document rows with type/status and a clear open action.
- Avoid side-by-side dense cards and wide tables.
- Make upload accessible by touch and keyboard.
- Keep dialogs nearly full-screen for complex review.
- Do not require hover.
- Maintain a minimum comfortable target around 44×44px when practical.

### Tablet
- Collapse secondary columns before shrinking body text.
- Keep primary actions visible.
- Consider a collapsible sidebar.

### Desktop
- Use split view for review and queue workflows.
- Limit wide content line length.
- Do not spread small widgets across the entire viewport solely to fill space.

---

## 12. Accessibility and inclusive UX

Target WCAG 2.2 AA as an engineering goal; verify it through testing rather than making an untested compliance claim.

Required patterns:
- Semantic landmarks, one primary page heading, correct heading order.
- Keyboard-operable navigation, menus, dialogs, tables, and review controls.
- Visible focus that is never obscured.
- Labelled inputs with errors programmatically associated.
- Accessible names for icon-only buttons.
- Sufficient contrast for text, icons, status badges, and disabled controls.
- Status communicated by text/icon as well as color.
- Focus management and restoration for modal/drawer.
- `aria-live` for important dynamic feedback where appropriate.
- Reduced-motion support.
- Zoom/reflow usability and no loss of function at narrow widths.
- No time-limited tasks without warning and recovery.
- Plain-language copy, short sentences, defined technical terms.
- Language selector and localized content must reflect actual supported translations; do not pretend untranslated strings are localized.
- Important client instructions must not exist only in tooltips, imagery, or color.

---

## 13. Data, privacy, and trustworthy presentation

- Never show a client's document or sensitive details in example data, screenshots, logs, or telemetry unless explicitly authorized.
- Use synthetic demo names/documents and visibly identify demo mode.
- Mask passports, financial identifiers, and other sensitive IDs unless their full value is necessary for the current task and access is authorized.
- Do not claim end-to-end encryption unless it is implemented and verified.
- Do not show live/integration badges unless backend connectivity is actually established.
- Show the time and status of last synchronization when relevant.
- Distinguish authority updates from internal case milestones.
- Never present a visa outcome probability, legal conclusion, or government processing timeline without a validated, approved basis and clear limitations.
- Client-facing copy must not expose internal risk notes or staff-only deliberations.
- Respect server-enforced roles and organization boundaries even when the UI route or component is directly accessed.
- Empty, loading, and unavailable data must be distinct. Do not replace API failure with plausible-looking fake business data without a clear demo marker.

---

## 14. Content and microcopy

Prefer action-oriented, calm language.

Good:
- “Upload your latest bank statement.”
- “We’ve received your passport. Our team is reviewing it.”
- “We need a clearer scan to continue.”
- “Your case officer will contact you if anything else is needed.”
- “Nothing is needed from you right now.”
- “This item needs a professional review.”

Avoid:
- “AI verified your legal eligibility” unless this is truly supported and appropriately authorized.
- “Your visa will be approved.”
- “Fraud detected” based only on an automated mismatch.
- “100% ready” when any mandatory review or approval is pending.
- Ambiguous error “Something went wrong” without retry or next action.
- Internal phrases like “RAG”, “OCR threshold”, “tenant ID”, or “model confidence” in ordinary client-facing views.

For AI-related issues, explain the practical meaning, not the implementation jargon. Example: “The name on these two documents differs. A case officer needs to review it.”

---

## 15. Component states matrix

Every interactive component should define its relevant states before implementation.

| Component | Required states |
|---|---|
| Button | Default, hover, focus, pressed, disabled, loading |
| Input | Empty, filled, focused, invalid, disabled, read-only |
| Upload | Idle, selecting, uploading, processing, received, partial failure, failed/retry |
| Document row | Needed, received, processing, under review, accepted, correction needed, optional, unavailable |
| AI finding | Pending review, confirmed, dismissed, resolved, reopened |
| Progress stepper | Not started, current, complete, blocked, not applicable |
| Table/list | Loading, populated, empty, filtered-empty, failed, partial data |
| Dialog/drawer | Open/closed, submitting, validation error, server error, success |
| Message | Sending, sent, failed/retry, read only if supported, internal vs client-visible |
| Package build | Not started, validating, building, ready, blocked, failed/retry, download status as truly known |
| Notification | Unread, read, expired/resolved if supported |
| Settings | Loading, draft, saved, validation failure, published/active where workflow exists |

Do not implement irrelevant states as fake UI. State support must match the actual backend contract.

---

## 16. Performance and technical implementation

- Preserve Next.js App Router and existing React/TypeScript patterns unless the audit justifies a change.
- Keep shared UI primitives under the existing component structure where appropriate.
- Use CSS variables as design tokens and consolidate repeated values.
- Avoid duplicating theme values in component styles.
- Keep components focused; do not build one giant component for the entire dashboard.
- Separate UI presentation from API access and business logic.
- Avoid unnecessary client components and expensive re-renders.
- Use responsive images and avoid loading large decorative assets in data-heavy screens.
- Prefer lightweight CSS transitions over heavy animation libraries unless the project has a justified use case.
- Use stable keys and accessible semantics.
- Treat API state as server-authoritative.
- Keep skeletons and loading transitions lightweight.
- Optimize document preview workflows separately from public marketing visuals.
- Use current project conventions; do not add a new component library just for visual polish.

---

## 17. Design QA and acceptance checklist

A screen is not done because it looks good in one screenshot. Verify:

### Visual
- [ ] Correct brand tokens; no unexplained hard-coded colors.
- [ ] Clear information hierarchy.
- [ ] Consistent spacing, typography, radius, borders, and shadows.
- [ ] Primary action obvious; secondary actions visually subordinate.
- [ ] Empty space is intentional, not a result of missing data.
- [ ] No excessive cards, badges, nested surfaces, or gradients.
- [ ] Text wraps cleanly; content does not overlap at responsive breakpoints.

### Functional
- [ ] Every visible control works and has the advertised result.
- [ ] Loading, empty, failure, retry, and disabled states are implemented.
- [ ] Real data is distinguished from demo/fallback content.
- [ ] Confirmations and errors provide clear feedback.
- [ ] UI state matches server response and authorization.

### Accessibility
- [ ] Keyboard-only flow tested.
- [ ] Focus visible and correctly managed.
- [ ] Labels and accessible names checked.
- [ ] Contrast and zoom/reflow checked.
- [ ] Color is not the only status signal.
- [ ] Reduced motion respected.

### Privacy and safety
- [ ] Client view has no staff-only data or notes.
- [ ] Sensitive data exposure is minimized.
- [ ] AI results show appropriate uncertainty and evidence.
- [ ] Document receipt is not mislabeled as acceptance or readiness.
- [ ] No unsafe action can bypass server-side workflow/permission checks.

### Responsive and performance
- [ ] At least the viewports in §11 tested.
- [ ] No horizontal overflow except intentionally contained tables/viewers.
- [ ] Mobile upload and navigation usable.
- [ ] No excessive layout shift or heavy decorative loading.
- [ ] Loading state does not imply fake progress.

---

## 18. Phased design-system implementation

Do not perform a wholesale redesign in one change. Use small, reviewed steps.

### Phase A — Audit and baseline
- Inventory current components, CSS selectors, token usage, and duplicated patterns.
- Identify the highest-impact inconsistency and existing regressions.
- Capture baseline screenshots at key sizes for client, employee, and owner views.
- Record which components already meet this standard.

### Phase B — Tokens and primitives
- Consolidate colors, typography, spacing, radii, shadows, and motion variables.
- Improve `Button`, `Badge`, `Card`, `DataTable`, `MetricCard`, and shared navigation primitives in place.
- Add or update component tests where feasible.
- Preserve all existing business behavior.

### Phase C — Shell and responsive layout
- Refine app shell, sidebar, top bar, page container, headers, responsive navigation.
- Verify role-specific navigation and mobile behavior.
- Add keyboard and accessibility checks.

### Phase D — Client portal simplification
- Prioritize progress, next client action, short checklist, officer contact, and help.
- Move dense/secondary information to relevant pages.
- Remove duplicate content only after verifying that functions remain reachable.
- Ensure copy and status states accurately reflect backend data.

### Phase E — Staff workflow workspaces
- Improve case workspace, task queues, review split view, discrepancy evidence, package manifest, and manager priorities.
- Favor scan efficiency and source traceability.
- Keep professional actions and review gates intact.

### Phase F — Marketing art direction and motion
- Separate public-site storytelling from operational dashboard patterns.
- Use high-quality assets, responsive crops, restrained motion, and performance budgets.
- Verify reduced motion and mobile behavior.

### Phase G — Visual regression and release
- Run frontend tests/build and relevant backend integration tests.
- Review responsive screenshots and keyboard flows.
- Check real/fallback data disclosure and access control.
- Report unresolved gaps honestly.

---

## 19. Claude Code implementation prompt

Use this section as a task prompt when asking Claude Code to implement the design system.

> Read this document and inspect the existing app before changing code. Audit the current `apps/web/app/globals.css`, `apps/web/components/common/**`, the `ClientPortal`, `EmployeeWorkspace`, `OwnerMasterDashboard`, app shell, and their tests. Make a gap matrix showing current behavior, target behavior, affected files, risk, and acceptance tests.
>
> Do not rewrite the entire frontend. Preserve the existing Next.js/React/TypeScript stack, API contracts, role permissions, product functionality, and working styles where they meet the standard. Reuse the current teal/mint/cream tokens and existing components. Do not add a competing theme system or UI library without a documented reason.
>
> Implement in stages: (1) token/component consolidation, (2) app shell and responsive behavior, (3) minimal client dashboard focused on progress and next action, (4) staff dashboard and evidence-first document review. Keep visual effects restrained, accessible, responsive, and performant.
>
> Never fabricate business data or treat a fallback result as live. Do not expose internal findings to clients. Do not collapse received/accepted/verified/package-ready states. All authorization remains server-enforced. Preserve reduced-motion and visible keyboard focus behavior.
>
> For each stage, add/update tests, run the frontend tests and production build, capture exact results, review the diff, and report files changed, unresolved issues, and recommended next step. Fix tests rather than weakening them. Ask before destructive or broad changes.

---

## 20. Final principle

**The client should see clarity. The professional should see evidence. The manager should see risk and ownership. The system should never imply certainty that it cannot prove.**

Documento's visual identity should be memorable, but the product's highest design achievement is making complicated immigration document work feel simpler without hiding uncertainty, responsibility, or risk.
