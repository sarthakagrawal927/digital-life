# Viewer direction decision

Audience: researchers inspecting executable organisms and experimental outcomes.
Screen job: understand the world, inspect a program, replay it and compare the mutation experiment.
Shared requirements: restrained 2D graphics; clear distinctions between organisms and sources; visible seed/config/tick; accessible controls and data alternatives; no fitness score or invented adaptation claims.

The first direction set was rejected by the owner: “Please work harder and design better.” It is retained at `design/round-1.html` as historical evidence. The archived second direction set is at `design/v2/index.html`; `/` now serves the live Observatory. The probes use the same real seed-4 mutation-run at tick 1000 as its initial evaluation scenario. It also exposes all five recorded paired runs.

- A — Specimen bench: a continuous warm-gray laboratory surface, Helvetica hierarchy and Menlo program annotations. A large coordinate-indexed world shares a reading order with an organism's reserves, program counter, bytecode, working memory and ancestry. Moss-green sources, ink-green organisms, rust-orange selection. Signature: the selected ring, program row and generation chain express one actual executable specimen. Interaction: select a cell or use the organism picker; traverse saved snapshots. Risk: the sparse composition consumes vertical space; the mobile inspector follows the field rather than overlapping it.
- B — Observatory: the field owns the screen, framed by population/genome/generation readings to its left and executable evidence to its right. Deep forest surfaces, pale chlorophyll rings, amber selection, restrained Georgia headings and monospace annotations. Signature: ring radius encodes reserve, a stem encodes facing, a second dot signals co-occupancy, and source intensity encodes available energy. Interaction: observe the recorded world, then inspect a mark. Risk: beauty could imply emergent complexity; show literal encoded meanings and the requirement for matched replay.
- C — Experiment ledger: an editorial document with Georgia questions, a large paired population trace, a five-seed outcome table, and a smaller spatial/program inspection alongside it. Paper, graphite, moss sources and rust treatment traces. Signature: extinction and compute censorship are first-class results, with candidate persistence distinguished from reproduction. Interaction: choose a seed from the table, inspect its field, and scrub through saved frames. Risk: terminal rows span unequal horizons; label this explicitly and keep the shared-axis graph visible.

Recommendation: B for the live viewer; it gives this world a distinct identity while keeping behavior inspectable. A favors close reading of a program; C favors evaluating the experiment. The owner selected B — Observatory: “B seems fine”.

## Probe boundary and evidence

Working code is necessary to compare how each composition supports selection, inspection and snapshot traversal. These are local-only direction probes, not production navigation or an implemented live viewer. All frames, organisms, lineage links, program bytes and trend values are sourced from `results/first/`. Playback traverses selected recorded snapshots; it does not simulate intermediate ticks. No inert controls represent unavailable capabilities.

The comparison surface is noindex, has no analytics, no third-party runtime requests, and no new dependencies. Standard labeled range/select controls and horizontal direction navigation use the structural principles of Preline's range-slider and segmented-navigation documentation. Exact references inspected 2026-10-01:

- https://preline.co/docs/components/range-slider.html
- https://preline.co/docs/components/tabs.html
- https://preline.co/license.html

No Preline runtime, protected component source, fonts or branded assets were copied. Links navigate between complete direction pages rather than pretending to be ARIA content tabs. The product-specific grid, glyph encoding and chart rendering are original simulation evidence views.

Browser evidence: `design/v2/{a,b,c}-{390,768,1440}.png`. All three directions have no horizontal overflow and their form/button controls have accessible names at all three widths. The browser console was clean. Selection updated program inspection; previous-frame traversal changed the displayed tick; seed 3 displayed extinction and its earlier snapshot restored an inspectable founder. Controls are keyboard accessible. Native simulation behavior was not changed.

Critique corrections: source legend now matches the field's green shading; full-width charts preserve legible labels on phones; the ledger inspector no longer overflows its desktop column; equal-scale traces and explicit compute-cap annotations avoid misleading comparisons. The mobile run table retains the control-to-mutation arrow. Live viewer review and evidence are recorded below.

B — Observatory is selected. The design receipt records explicit owner approval; the three recorded-data probes remain available as comparison evidence.


## Live Observatory — implemented system

The root route is the owner-selected B composition: forest field, pale chlorophyll organisms, amber selection, Georgia display headings, Helvetica controls, and Menlo bytecode/data. The field is a real canvas driven by worker state, never an invented population or animation. Source brightness represents available energy; ring radius represents reserve; stem shows facing; co-occupancy has a small dot. Actual births expand briefly and actual deaths fade as crosses. Reduced-motion snaps between states and removes those transitions.

Core tokens: paper #0d1715, field #14281d, ink #e4e8dc, secondary #a1b4a6, structural line #344c3f, control border #6d8975, selection #edc28b, organism #d9edaf, source #83bc85. Controls use the project's established labeled native selects, buttons, file controls and details disclosure patterns. Canvas colors resolve the same CSS tokens. No additional runtime, font, or image dependencies.

At desktop width, readings, world, and inspector form three columns. Tablet moves readings above a two-column field/inspector. Phone stacks them, retaining a selected-organism cue and direct Inspect link near transport. World rules and advanced JSON are progressively disclosed. Experiment results use locally scrollable tables on narrow screens. Cell navigation announces a deliberate selection through a polite status; it does not flood assistive technology with tick updates. Program help explains the current opcode and the instructions actually present.

Paused, running, empty/extinct, population safeguard, compute stop, loading comparison, cancellation, invalid JSON, and successful import/export states are explicit. Configuration drafts do not change the current run. Old replay buttons are removed while replacement experiments run. Checkpoint replay drops future checkpoints and preserves the original session's compute allowance.


Final evidence: `design/live-{390,768,1440}.png` and `.fleet/design-evidence.json`. Independent Assessment A scored 32/40; independent Assessment B scored 18/20, with no remaining P0/P1. Initial review found inaccessible cell feedback, weak input borders and stale comparison replay; all were fixed and independently retested. The mechanical detector ran once and returned one advisory about dash-like placeholders, judged a false positive. Earlier overlay findings are historical, not a current score. The final receipt retains owner selection B and passes the Fleet design-workflow check.


## First-visit explanation

The owner reported that new visitors did not understand the opening screen. Preserve the selected Observatory composition and explain its marks, resource costs, inherited copying errors, visitor role and first action in the existing introduction. Replace unexplained opening labels with “Living programs” and “Different programs”. The first action is watch, pause, select a ring; changing energy in World rules introduces the first environmental comparison. This is a copy-only clarification, with no new navigation or simulation behavior. Verify first-viewport legibility and comprehension at phone, tablet and desktop widths.


## Executed-action explanation — Observatory preserved

The owner clarified that the existing design was acceptable; the issue was understanding what the programs were doing. The behavior direction probes are historical exploration, superseded by this clarification. Preserve B’s forest field, three-column composition and typography. The added close-up, literal action/reserve explanation, recorded-action slider and readable parent-to-child instruction differences strengthen the same direction. Default playback is now one tick per second; existing acceleration remains available.

A selected action uses engine-generated before/after state, actual local source reserves and copy/death causes. The main field remains at the current tick while the close-up can show an earlier action from the selected last observed tick. The readable routine highlights that recorded instruction in amber, while the bytecode inspector continues to identify the next VM instruction. Source transfers, movement trails and action tags use actual events; action tags anchor the recorded action location. Reduced motion retains static explanations and removes animated effects.

Observation does not enter world snapshots or RNG state. Retain at most 96 events and the last selected instruction batch (at most 65 entries including upkeep), each with nine local cells. Clear observations on rewind; imported snapshots carry state, not historical action recordings. Changed-at-birth picker labels and inspectable birth/death activity improve discovery. Deliberate scrubbing supplies aria-valuetext and a short polite announcement; playback does not continuously announce. No change is presented as proof of adaptation.

Evidence: design/actions-{390,768,1440}.png and .fleet/action-evidence.json. Independent critique 32/40, audit 18/20, no P0/P1. Keyboard explanation, literal harvest/copy/death causes, inheritance, imported-state recovery, reduced motion and worker/headless parity verified.
