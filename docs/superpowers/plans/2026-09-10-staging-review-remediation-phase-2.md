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

```bash
rg -n "@/components/ui|components/ui" src
rg -n "Button|Form|Input|Label|Switch|Toast|Toaster|useToast|use-toast" src
```
Record exact retained imports. Do not infer usage from filenames alone.

- [ ] **Step 3: Search dependency symbols before removal**

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

Preserve `chrome.runtime.openOptionsPage()` fallback behavior. Use:
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

Expected candidates:
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
Delete only files with zero retained consumers.

- [ ] **Step 3: Remove packages whose only consumers were deleted**

Run `npm uninstall` only for packages confirmed unused by the searches. Expected candidates are:
```bash
npm uninstall @hookform/resolvers @radix-ui/react-label @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-toast class-variance-authority clsx lucide-react react-hook-form tailwind-merge tailwindcss-animate zod
```
Remove names from this command if fresh code search finds a retained consumer.

- [ ] **Step 4: Remove Tailwind animation plugin/config if its package is removed**

Delete `plugins: [require("tailwindcss-animate")]` plus animation/keyframe config that has no retained class usage.

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
Confirm removed packages are not still direct dependencies.

- [ ] **Step 8: Commit**

```bash
git add src package.json package-lock.json tailwind.config.js components.json
git commit -m "refactor: remove unused UI dependencies"
```
Omit unchanged paths.

---

### Task 3: Upgrade the CRXJS/Vite compatibility group

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Potentially modify: `vite.config.ts`, `manifest.ts` only for documented breaking changes required by the selected stable versions

**Interfaces:**
- Must preserve Phase 1 manifest verifier expectations.

- [ ] **Step 1: Inspect current stable compatibility**

```bash
npm view @crxjs/vite-plugin version peerDependencies
npm view vite version engines
npm view @vitejs/plugin-react version peerDependencies engines
node --version
```
Use those results to choose one mutually compatible stable CRXJS/Vite/plugin-react set supported by the execution environment.

- [ ] **Step 2: Install the chosen compatibility group explicitly**

After selecting the versions in Step 1, run `npm install --save-dev` with all three exact `package@version` selections in one command. Do not install one package first and let npm opportunistically reshape the peer graph before the other two are selected.

- [ ] **Step 3: Run targeted build verification**

```bash
npm run build
npm run verify:manifest
```
If either fails, investigate the exact documented breaking change before modifying application behavior.

- [ ] **Step 4: Run full Phase 1 gate**

```bash
npm run check
```
Expected: PASS.

- [ ] **Step 5: Inspect output**

```bash
cat dist/manifest.json
find dist -maxdepth 2 -type f | sort
```
Confirm popup/options artifacts and expected content scripts remain.

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
- Existing source/type semantics must remain intact.

- [ ] **Step 1: Inspect stable versions and parser compatibility**

```bash
npm view typescript version
npm view @types/node version
npm view @types/react version
npm view @types/react-dom version
npm view @types/chrome version
npm view @typescript-eslint/parser peerDependencies
```
Choose a TypeScript version supported by the currently installed parser or defer the TypeScript bump until Task 5's parser selection is known. Do not create an intentionally broken intermediate commit.

- [ ] **Step 2: Install the chosen exact versions together**

Run one `npm install --save-dev` command containing the exact selected versions of TypeScript and the type packages from Step 1.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```
Resolve genuine compatibility issues without weakening strictness.

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
- Modify/replace: `.eslintrc.json` only if required by the selected stable ESLint major
- Potentially create: `eslint.config.js` if the selected ESLint major requires flat config

**Interfaces:**
- `npm run lint` must continue to cover `.js`, `.ts`, and `.tsx`.

- [ ] **Step 1: Inspect stable versions and peer constraints**

```bash
npm view eslint version engines
npm view @typescript-eslint/parser version peerDependencies
npm view @typescript-eslint/eslint-plugin version peerDependencies
npm view eslint-plugin-import version peerDependencies
npm view eslint-import-resolver-typescript version peerDependencies
```

- [ ] **Step 2: Select one coherent lint stack**

Choose exact versions with compatible peer ranges. If that ESLint major requires flat config, migrate explicitly rather than depending on deprecated compatibility behavior.

- [ ] **Step 3: Install all selected lint packages together**

Run one `npm install --save-dev` command containing the exact selected versions of ESLint, parser/plugin, import plugin, and resolver.

- [ ] **Step 4: Run lint and fix only real incompatibilities**

```bash
npm run lint
```
Do not globally disable the existing import-order or unresolved-import protections to make the upgrade pass.

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
Omit whichever config path does not exist.

---

### Task 6: Upgrade remaining React/Tailwind/PostCSS support packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Potentially modify: `tailwind.config.js`, `postcss.config.cjs`, `src/styles/globals.css`, React entry files only for required documented breaking changes

**Interfaces:**
- Popup and Options must still render/build; Phase 1 browser behavior must remain unaffected.

- [ ] **Step 1: Inventory remaining direct dependencies**

```bash
npm ls --depth=0
```

- [ ] **Step 2: Inspect stable versions/peer constraints**

```bash
npm view react version
npm view react-dom version peerDependencies
npm view tailwindcss version engines
npm view postcss version
npm view autoprefixer version peerDependencies
npm view tslib version
```

- [ ] **Step 3: Upgrade one compatible subgroup at a time**

Install exact versions selected from Step 2. Keep React/ReactDOM together. If the newest Tailwind major requires a significant CSS/build migration, make Tailwind/PostCSS its own subgroup and commit rather than combining it with React.

- [ ] **Step 4: Run the full gate after each subgroup**

```bash
npm run check
```
Expected: PASS before proceeding.

- [ ] **Step 5: Commit each subgroup separately**

Use descriptive commits such as:
```bash
git commit -m "chore: upgrade React dependencies"
git commit -m "chore: upgrade Tailwind build stack"
```

---

### Task 7: Audit the modernized dependency graph

**Files:**
- Create: `docs/dependency-audit.md` only if remaining advisories require explanation

**Interfaces:**
- Produces a factual record of remaining advisories and exposure classification.

- [ ] **Step 1: Run fresh audit commands**

```bash
npm audit
npm audit --omit=dev
```
Capture the exact outputs in execution notes.

- [ ] **Step 2: Inspect each remaining high/critical advisory path**

For each affected package:
```bash
npm explain PACKAGE_NAME
```
Replace `PACKAGE_NAME` with the exact affected package from `npm audit`. Classify each remaining path as runtime-shipped, build/dev-only, or not included in the bundled extension output.

- [ ] **Step 3: Apply safe supported upgrades only**

If an advisory has a compatible update, install it and rerun `npm run check` plus both audit commands. Do not use `npm audit fix --force`.

- [ ] **Step 4: Document remaining advisories only when nonzero**

Create `docs/dependency-audit.md` from the actual command output. Include the date, exact `npm audit` and `npm audit --omit=dev` summaries, and one row per remaining advisory with package/path, severity, runtime-shipped classification, reason retained, and mitigation/status. Do not create a template or placeholder-only document. If both audit commands report zero vulnerabilities, do not create this file.

- [ ] **Step 5: Run full gate again**

```bash
npm run check
```
Expected: PASS.

- [ ] **Step 6: Commit audit outcome if files changed**

```bash
git add package.json package-lock.json docs/dependency-audit.md
git commit -m "chore: document dependency audit status"
```
Do not create an empty commit.

---

### Task 8: Phase 2 completion verification

**Files:**
- No implementation changes expected.

**Interfaces:**
- Produces final modernization verification evidence.

- [ ] **Step 1: Run fresh verification**

```bash
npm ci
npm run check
npm audit
npm audit --omit=dev
```
Record exact results.

- [ ] **Step 2: Verify repository state**

```bash
git diff --check staging...HEAD
git status --short
npm ls --depth=0
```
Expected: no whitespace errors, clean working tree, coherent dependency tree.

- [ ] **Step 3: Re-read Phase 2 acceptance criteria**

Confirm unused UI/dependency surface is removed, remaining dependencies form a supported stable compatibility set, the full Phase 1 gate remains green, and final audit results are recorded/classified without unsupported force upgrades.

- [ ] **Step 4: Keep browser verification claims scoped**

Dependency modernization does not itself prove live Salesforce behavior. If no authenticated smoke test was run after the final build, preserve the Phase 1 caveat in the execution handoff.
