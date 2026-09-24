# AGENTS.md

## Project

This is production code. Respect the existing architecture, file structure, style, and data model.

## Live Testing Campaign

- Use the **Testing Grounds** campaign for live browser testing.
- The large settlement performance fixture spans hexes **17:12** and **18:13**.
- Do not open, edit, or otherwise interact with the **Kadesh** campaign for testing. Leave its data untouched.
- Use the user's existing local server; do not start another server unless explicitly requested.

Do not introduce frameworks, build tools, servers, package managers, or large rewrites unless explicitly requested or clearly already part of the project.

## Core Rules

- Make the smallest safe change that solves the task.
- Change only what is necessary for the current task.
- Inspect relevant code before editing.
- Preserve existing behavior unless the request says otherwise.
- Do not replace large files with simplified rewrites.
- Avoid full rewrites. Refactor only the specific area needed to make the requested change safe.
- Do not remove assets, data references, comments, helper functions, or UI states unless clearly obsolete.
- Prefer editing existing helpers over duplicating logic.
- Keep desktop and mobile behavior working when applicable.
- Treat auth, permissions, secrets, database writes, and destructive actions carefully.

## Collaboration Style

- The user provides the product vision; Codex handles the technical execution.
- Explain technical choices in plain language, assuming the user is not a programmer.
- Be concise and practical. Avoid jargon unless it is necessary, and define it simply when used.
- When reporting work, focus on user-visible behavior: "It does this now."
- Do not explain where code moved or list changed files unless the user asks.
- Do not overload the user with implementation details unless they ask for them.
- If there are tradeoffs, summarize the options clearly and recommend one.
- The user tests through a local server. Give a simple "Test:" section with bullet points for what to try.
- For database work, tell the user simply which saved Supabase SQL query to run when that is the next step.

## Architecture Preferences

- Use existing project patterns.
- Keep shared logic in shared helpers.
- Keep page/component-specific render functions thin.
- Escape user/data text before inserting HTML.
- Prefer data-driven labels, field lists, comparators, filters, and configs.
- Avoid hardcoded duplicate dropdown/filter/list logic.
- Avoid unrelated refactors.

## UI Priorities

- Match the existing visual language.
- Preserve accessibility basics.
- Avoid visual clutter.
- Make responsive layouts work on both mobile and desktop.
- Do not add explanatory UI text unless it improves the actual user flow.

## Before Editing

- Inspect the exact function/block to change.
- Identify affected call sites.
- Keep diffs narrow.
- If touching shared helpers, check likely downstream usage.
- Ask only if ambiguity creates real risk.

## Generated Map Renderer Safeguards

Before editing `js/generated-map-renderer.js`, inspect the exact save/apply/undo/render functions involved and preserve tuned map behavior unless the user explicitly asks to change it.

- Do not simplify road, river, path, wall, mist, terrain, feature, generation, cache, zoom, or mobile editor logic as a cleanup side effect.
- Preserve layer/order behavior: roads over rivers, paths under rivers, region borders over overlays, and elevation bleed over roads/rivers/paths.
- Preserve path shaping rules: road/path snapping and center-bending only when appropriate, rivers blending/stopping at water, and water cutoff behavior.
- Preserve overlay behavior: roads/paths can register every hex they pass through, branches should not gain weird auto-curves, roads/paths into water should stop at coasts unless explicitly connected, and walls use the tuned dark layered stroke with light dash/crenellation styling.
- Preserve feature behavior: feature art cache/supersampling, dead woods/forest visual variants, no feature-art suppression under POIs, painting compatibility rules, max feature limits, and eyedropper hex highlight behavior.
- Preserve terrain behavior: manual terrain/feature painting rules, terrain generation preview behavior, elevation bleed over roads/rivers/paths, and cached canvas performance during pan/zoom.
- Preserve editor boundaries: Cartographer terrain/features are staged until Apply; Surveyor live-data tools write immediately unless intentionally changed. If a tool writes live, the UI must say so clearly.
- Preserve zoom/pan feel, including stepped zoom locking and stable cursor anchoring.
- Preserve mobile editor usability: collapse behavior, touch drawing intent, and no-tool hover/tooltip inspection should remain usable.
- Keep backend writes through existing Supabase RPCs and permission/RLS-safe paths; do not bypass security client-side.
- After renderer changes, run `node --check js/generated-map-renderer.js` and give a focused Test checklist for the affected map mechanics.

## After Editing

Verify what is practical:
- syntax/build passes
- changed UI flow works
- related existing behavior still works
- security-sensitive paths still enforce server-side/backend rules where applicable

Then summarize only:
1. what it does now
2. Test: short bullets for the local server
3. anything not verified

## Git

- Do not commit unless explicitly asked.
- Before committing, check status.
- Commit only relevant files.
- Report commit hash and clean/dirty status after commit.

## Output Style

- Be concise.
- Do not restate project history.
- Do not list file/code changes unless asked.
- Do not include long explanations unless asked.
- When giving code, prefer targeted replacement blocks for the exact function/section being changed.
