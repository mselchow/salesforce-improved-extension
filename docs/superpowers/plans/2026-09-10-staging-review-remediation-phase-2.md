# Staging Review Remediation Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prune unused UI/dependency surface and modernize the remaining extension toolchain without regressing the behavior established by Phase 1.

**Architecture:** Treat the Phase 1 `npm run check` result as the behavioral safety net. Remove unused application/UI dependencies first, then upgrade compatibility groups one at a time, running the complete gate and inspecting the generated manifest after each group.

**Tech Stack:** npm, CRXJS/Vite, TypeScript, ESLint/typescript-eslint, React, Tailwind/PostCSS, Vitest/jsdom.

**Spec:** `docs/superpowers/specs/2026-09-10-staging-review-remediation-design.md`

## Global Constraints

- Do not begin this plan unless Phase 1's `npm run check` is green.
- Preserve all Phase 1 tests and generated-manifest invariants.
- Remove packages only after code search proves there is no retained consumer.
- Choose the newest mutually compatible stable versions available at execution time; do not force unsupported newest-major combinations.
- Do not run `npm audit fix --force`.
- Commit each compatibility group separately so regressions can be isolated.

---

### Task 1: Establish the Phase 2 baseline and identify unused UI surface

**Files:**
- Inspect: `src/components/ui/*`
- Inspect: `src/options/*`
- Inspect: `src/App.tsx`
- Inspect: `package.json`

**Interfaces:**
- Consumes: canonical `npm run check` from Phase 1.
- Produces: a verified list of removable files/packages.

- [ ] **Step 1: Verify the inherited Phase 1 baseline**

```bash
npm ci
npm run check
```
Expected: exit 0 before any Phase 2 edit.

- [ ] **Step 2: Search every UI component for retained consumers**

Run:
```bash
rg -n "@/components/ui|components/ui" src
rg -n "Button|Form|Input|Label|Switch|Toast|Toaster|useToast|use-toast" src
```

Record exact retained imports. Do not infer usage from filenames alone.

- [ ] **Step 3: Search dependency symbols before removal**

Run:
```bash
rg -n "@hookform/resolvers|@radix-ui|react-hook-form|zod|lucide-react|class-variance-authority|tailwind-merge|tailwindcss-animate|clsx" src tailwind.config.js
```

- [ ] **Step 4: Decide the minimal retained popup/options UI**

If `Button` is only used by `src/App.tsx`, replace it in Task 2 and remove its dependency chain. Keep the placeholder Options page functional; do not implement settings.

---

### Task 2: Remove unused shadcn/UI infrastructure and packages

**Files:**
- Modify: `src/App.tsx`
- Delete: unused files under `src/components/ui/`
- Delete: `src/lib/utils.ts` only if no retained consumer remains
- Modify or delete: `components.json`
- Modify: `tailwind.config.js` if `tailwindcss-animate` is removed
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- No new shared interfaces.

- [ ] **Step 1: Replace the shared Button with a native styled button if it has no other consumer**

Use the same user-visible behavior and preserve the `chrome.runtime.openOptionsPage()` fallback logic.

Representative JSX:
```tsx
<button
  type="button"
  className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
  onClick={() => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/index.html"));
    }
  }}
>
  Settings
</button>
```

- [ ] **Step 2: Delete UI files proven unused by Task 1 searches**

Expected candidates include:
```text
src/components/ui/button.tsx
src/components/ui/form.tsx
src/components/ui/input.tsx
src/components/ui/label.tsx
src/components/ui/switch.tsx
src/components/ui/toast.tsx
src/components/ui/toaster.tsx
src/components/ui/use-toast.ts
```
Delete only those with zero retained consumers.

- [ ] **Step 3: Remove packages whose only consumers were deleted**

Use `npm uninstall` for each confirmed-unused package, expected candidates:
```bash
npm uninstall @hookform/resolvers @radix-ui/react-label @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-toast class-variance-authority clsx lucide-react react-hook-form tailwind-merge tailwindcss-animate zod
```
Adjust the list to actual code-search evidence.

- [ ] **Step 4: Remove Tailwind animation plugin if its package is removed**

Delete:
```js
plugins: [require("tailwindcss-animate")],
```
and any animation/keyframe extension entries that exist solely for deleted components and have no retained class usage.

- [ ] **Step 5: Remove shadcn config/helper files when no longer useful**

If no shadcn-generated components remain, delete `components.json`. Delete `src/lib/utils.ts` only if no retained import remains.

- [ ] **Step 6: Run the full behavioral gate**

```bash
npm run check
```
Expected: PASS.

- [ ] **Step 7: Inspect dependency delta**

```bash
npm ls --depth=0
git diff -- package.json package-lock.json
```
Confirm removed packages are not silently reintroduced transitively as direct dependencies.

- [ ] **Step 8: Commit**

```bash
git add src package.json package-lock.json tailwind.config.js components.json
git commit -m "refactor: remove unused UI dependencies"
```
Omit deleted/unchanged paths as appropriate.

---

### Task 3: Upgrade the CRXJS/Vite compatibility pair

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Potentially modify: `vite.config.ts`, `manifest.ts` only for documented breaking changes required by the selected stable versions

**Interfaces:**
- Must preserve Phase 1 manifest verifier expectations.

- [ ] **Step 1: Inspect current stable compatibility before editing**

Run:
```bash
npm view @crxjs/vite-plugin version peerDependencies
npm view vite version engines
npm view @vitejs/plugin-react version peerDependencies engines
node --version
```

Select a stable CRXJS/Vite/plugin-react combination with mutually compatible peer ranges and Node support. Record the selected versions in the commit message/body or execution notes.

- [ ] **Step 2: Upgrade only this compatibility group**

Example shape, replacing `<version>` with the verified versions:
```bash
npm install --save-dev @crxjs/vite-plugin@<version> vite@<version> @vitejs/plugin-react@<version>
```

- [ ] **Step 3: Run targeted build verification first**

```bash
npm run build
npm run verify:manifest
```
If this fails, investigate the exact breaking change before modifying application behavior.

- [ ] **Step 4: Run the entire Phase 1 gate**

```bash
npm run check
```
Expected: PASS.

- [ ] **Step 5: Inspect built manifest/content script output**

```bash
cat dist/manifest.json
find dist -maxdepth 2 -type f | sort
```
Confirm the extension still contains the popup/options artifacts and expected content scripts.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts manifest.ts
git commit -m "chore: upgrade CRXJS and Vite"
```
Omit unchanged source files.

---

### Task 4: Upgrade TypeScript and type packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Potentially modify: `tsconfig.json`, `tsconfig.node.json` only for required compatibility changes

**Interfaces:**
- Existing project source/type semantics must remain intact.

- [ ] **Step 1: Inspect stable versions and peer constraints**

```bash
npm view typescript version
npm view @types/node version
npm view @types/react version
npm view @types/react-dom version
npm view @types/chrome version
npm view @typescript-eslint/parser peerDependencies
```
Choose TypeScript no newer than the installed/next ESLint parser compatibility range unless Task 5 is intentionally executed in the same temporary working state before verification.

- [ ] **Step 2: Upgrade the selected TypeScript/type set**

```bash
npm install --save-dev typescript@<version> @types/node@<version> @types/react@<version> @types/react-dom@<version> @types/chrome@<version>
```

- [ ] **Step 3: Run typecheck first**

```bash
npm run typecheck
```
Resolve only genuine new compiler/config incompatibilities; do not weaken strictness to make the upgrade pass.

- [ ] **Step 4: Run full gate**

```bash
npm run check
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json
git commit -m "chore: upgrade TypeScript toolchain"
```

---

### Task 5: Upgrade ESLint/typescript-eslint/import tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify/replace: `.eslintrc.json` only if required by the chosen supported ESLint major
- Potentially create: `eslint.config.js` if migrating to flat config is required/beneficial for the selected stable ESLint version

**Interfaces:**
- `npm run lint` must continue to cover `.js`, `.ts`, and `.tsx`.

- [ ] **Step 1: Inspect current stable versions and compatibility**

```bash
npm view eslint version engines
npm view @typescript-eslint/parser version peerDependencies
npm view @typescript-eslint/eslint-plugin version peerDependencies
npm view eslint-plugin-import version peerDependencies
npm view eslint-import-resolver-typescript version peerDependencies
```

- [ ] **Step 2: Select one coherent lint stack**

Prefer a supported stable combination rather than mixing newest majors with incompatible peer ranges. If the chosen ESLint major requires flat config, migrate config explicitly rather than relying on deprecated compatibility behavior.

- [ ] **Step 3: Upgrade the lint stack**

```bash
npm install --save-dev eslint@<version> @typescript-eslint/parser@<version> @typescript-eslint/eslint-plugin@<version> eslint-plugin-import@<version> eslint-import-resolver-typescript@<version>
```

- [ ] **Step 4: Run lint and fix configuration/API incompatibilities**

```bash
npm run lint
```
Do not globally disable existing import-order/unresolved protections just to complete the upgrade.

- [ ] **Step 5: Run full gate**

```bash
npm run check
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .eslintrc.json eslint.config.js
git commit -m "chore: upgrade lint toolchain"
```
Omit whichever config file does not exist after the selected approach.

---

### Task 6: Upgrade remaining React/Tailwind/PostCSS support packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Potentially modify: `tailwind.config.js`, `postcss.config.cjs`, `src/styles/globals.css`, React entry files only when required by documented breaking changes

**Interfaces:**
- Popup and Options must still render/build; Phase 1 browser behavior must remain unaffected.

- [ ] **Step 1: Inventory remaining direct dependencies**

```bash
npm ls --depth=0
```

- [ ] **Step 2: Inspect stable versions/peer constraints for remaining packages**

At minimum inspect React, ReactDOM, Tailwind, PostCSS, Autoprefixer, and `tslib` if still direct:
```bash
npm view react version
npm view react-dom version peerDependencies
npm view tailwindcss version engines
npm view postcss version
npm view autoprefixer version peerDependencies
npm view tslib version
```

- [ ] **Step 3: Upgrade one compatible support group**

Use explicit versions. If Tailwind's newest major requires a significant CSS/build migration, treat that as its own commit after React/support packages rather than combining unrelated migrations.

- [ ] **Step 4: Run full gate after each meaningful subgroup**

```bash
npm run check
```
Expected: PASS before proceeding to another subgroup.

- [ ] **Step 5: Commit each subgroup separately**

Examples:
```bash
git commit -m "chore: upgrade React dependencies"
git commit -m "chore: upgrade Tailwind build stack"
```

---

### Task 7: Audit the modernized dependency graph

**Files:**
- Create: `docs/dependency-audit.md` if remaining advisories require explanation; otherwise update an existing project note only if one already exists.

**Interfaces:**
- Produces a factual record of remaining advisories and their exposure classification.

- [ ] **Step 1: Run fresh audit commands**

```bash
npm audit
npm audit --omit=dev
```
Record exact counts/severities from both commands.

- [ ] **Step 2: Inspect each remaining direct advisory path**

For every remaining high/critical advisory, run:
```bash
npm explain <affected-package>
```
and determine whether it is runtime-shipped, build/dev-only, or unreachable after bundling.

- [ ] **Step 3: Apply safe supported upgrades only**

If a remaining advisory has a compatible non-breaking update, install it and rerun `npm run check` plus `npm audit`. Do not use `npm audit fix --force`.

- [ ] **Step 4: Document remaining advisories when nonzero**

Create `docs/dependency-audit.md` with:
```markdown
# Dependency Audit

**Date:** 2026-09-10

## Summary
- `npm audit`: <exact result>
- `npm audit --omit=dev`: <exact result>

## Remaining advisories
| Package/path | Severity | Runtime shipped? | Reason retained | Mitigation/status |
| --- | --- | --- | --- | --- |
```
Do not create the file if audit is zero and there is nothing substantive to document.

- [ ] **Step 5: Run full gate again**

```bash
npm run check
```
Expected: PASS.

- [ ] **Step 6: Commit audit outcome**

```bash
git add package.json package-lock.json docs/dependency-audit.md
git commit -m "chore: document dependency audit status"
```
If no files changed, do not create an empty commit.

---

### Task 8: Phase 2 completion verification

**Files:**
- No implementation changes expected.

**Interfaces:**
- Produces final modernization verification evidence.

- [ ] **Step 1: Run full fresh verification**

```bash
npm ci
npm run check
npm audit
npm audit --omit=dev
```
Record exact results.

- [ ] **Step 2: Verify clean diff and repository state**

```bash
git diff --check staging...HEAD
git status --short
npm ls --depth=0
```
Expected: no whitespace errors, clean working tree, coherent dependency tree.

- [ ] **Step 3: Re-read Phase 2 acceptance criteria in the approved spec**

Confirm:
- unused UI/dependency surface is removed;
- remaining dependencies are on a supported stable compatibility set;
- full Phase 1 gate passes after modernization;
- final audit is recorded/classified without force-fixing unsupported majors.

- [ ] **Step 4: Keep browser verification claims scoped**

Dependency modernization does not itself prove live Salesforce behavior. If no authenticated smoke test was run after the final build, preserve the Phase 1 caveat in the execution handoff.
