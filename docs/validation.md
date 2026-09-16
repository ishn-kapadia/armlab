# Validation record

Executed on Windows on September 10, 2026. This records observed results, not intended future checks.

## Final automated results

**63 tests passed across four test files.** TypeScript checking and the production build passed. The latest successful core test run followed the near-singularity fixes and the corrected almost-equal-link regression case.

| Area | Tests |
|---|---:|
| Kinematics, limits, numerical input and conditioning | 36 |
| Joint interpolation, elapsed-time transitions and recording | 10 |
| Versioned session validation | 14 |
| Invalid commands and geometry revalidation | 3 |

The suite includes 42 FK/IK round-trip poses, both branches, known FK configurations, inner/outer failures, workspace boundaries, equivalent angles, excluded limits, equal-link origin degeneracy, singularity indication, tiny nonzero targets, supported geometry extremes, invalid numbers, cubic endpoints/midpoint, limit preservation, frame subdivision, pause/resume/stop, multi-segment completion, bounded buffers, and imported data validation.

## Commands actually executed

Commands ran from `outputs/armlab`, unless stated otherwise. Node was v24.19.0. The available package manager was the bundled pnpm 11.19.0; npm was not on this environment's PATH.

```powershell
# <bundled-pnpm> below was this executable:
# C:/Users/ishan/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd

& 'C:/Users/ishan/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd' install --store-dir ../../work/pnpm-store
& 'C:/Users/ishan/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd' --config.store-dir=../../work/pnpm-store build

node node_modules/vitest/vitest.mjs run --configLoader native
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build --configLoader native

node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173 --strictPort --configLoader native
```

- Dependency installation succeeded after network permission was granted and esbuild's installation script was allowed in `pnpm-workspace.yaml`. A pnpm lockfile was generated and is included.
- The full `build` package script, including TypeScript checking, passed. The direct commands above were also used for targeted final checks.
- Final production output consists of `dist/index.html`, the local favicon, and bundled CSS/JavaScript. No external runtime assets are needed.
- An HTTP request using `Invoke-WebRequest` to `http://127.0.0.1:5173/` returned **200**. The running production preview was used for browser checks.
- A PowerShell check parsed the actual 19-row browser CSV payload, checked nondecreasing timestamps, recomputed FK from the rounded exported angles, and compared it with the exported tip coordinates. Maximum difference was **2.294569 × 10⁻⁶ mm**, below the 10⁻⁵ mm rounding allowance. This is a numerical consistency check, not measured hardware accuracy or a performance benchmark.

### Initial failures and fixes

- The first dependency attempt failed because registry access was restricted. A later authorized installation succeeded.
- pnpm initially rejected an unapproved esbuild installation script; the project's explicit allow-list resolved that.
- The default configuration bundler could not read an ancestor directory in this sandbox. Standard scripts now use Vite's native config loader.
- The first core run passed 53 of 54 tests. Its failing assertion compared equivalent floating-point angles with exact equality. A numerical-tolerance assertion fixed the test.
- Initial integration found a missing duration input handler and an invalid CSS import. Both were fixed before successful builds and interface testing.
- Additional mathematical review identified loss of tiny offsets near singularities. The implementation now uses a cosine-rule half-angle form near ±1 and an exact zero sine at exact folding/extension; six additional tests cover conditioning and length extremes.

## Browser checks actually performed

The Codex in-app Chromium browser was used through its documented tools. Checks were made against rendered controls, DOM values, screenshots, and console logs.

| Feature | Observed result |
|---|---|
| Joint numeric controls | (0°, 0°) produced (250, 0) mm; slider keyboard input updated its joint |
| IK branches | (150, 100) mm gave (0°, 90°) and approximately (67.38°, −90°), both with 0.000 mm displayed error |
| Outside target | (300, 100) mm was rejected and the prior actual tip remained (150, 100) mm |
| Inner target | (0, 0) mm was rejected for unequal default links |
| Empty target field | Keyboard deletion showed a finite-input error and disabled target actions |
| Live dragging | Pointer drag moved the target and arm together with 0.000 mm displayed error |
| Target keyboard input | ArrowUp increased target/actual y by 5 mm |
| Settings validation | Negative link length and reversed limits produced errors |
| Branch exclusion | Restricting joint 2 to nonnegative angles excluded the negative branch and retained the actual pose |
| Settings revalidation | Narrowing shoulder limits flagged excluded saved poses, disabled sequence playback, and kept actual/target error at zero |
| Reset | Restored the default 30°/60° pose and default robot |
| Animation and pause | A 10-second motion was paused at progress 0.08679; the error and progress were unchanged on a later read |
| Resume and stop | Resume advanced from saved progress; Stop disabled playback controls and retained the intermediate pose |
| Demo playback | Four 0.25-second segments ended at 150°/45°, elapsed 1.00 s, progress 100%, and error 0.000 mm |
| Waypoint editing | Save added a fifth named pose; Delete returned the list to four |
| JSON import | The supplied demo session loaded with four poses |
| Invalid import | A version-99 file produced a useful error and preserved the existing four waypoints |
| JSON export | The visible export payload had format/version/units/settings/pose/target/waypoints; a real `armlab-session.json` file was also observed in Downloads |
| CSV export | The actual visible CSV had the declared header, 19 samples, and final row `1.000000,150.000000,45.000000,-226.496393,49.118095` |
| Text export fallback | Select all text selected the payload and displayed keyboard-copy instructions |
| Visualization controls | Labels hid/restored, reach/trail toggles responded, Clear trail disabled itself after clearing |
| Zoom and fit | Zoom in displayed 125%; Fit view restored 100% |
| Responsive layout | Tested requested viewports 1440×1000 and 390×844; document scroll width equalled its client width in both cases (1425 and 375 px with scrollbars) |
| Console | Final captured warning/error log was empty |

The saved screenshot is an actual browser capture. No screenshot, sample, or test result was fabricated.

## Remaining limitations and checks to repeat on another machine

- **Development server in this sandbox:** `vite --configLoader native` started, but its dependency optimizer then failed on denied ancestor-directory access. The production build and production preview work. The normal `pnpm dev` workflow is documented for an ordinary local terminal but was not successfully exercised inside this sandbox.
- **Embedded browser file handling:** the browser download-event waiter timed out. A JSON file was observed on disk, but automatic CSV saving to the expected Downloads path could not be confirmed. The complete CSV payload was independently checked and saved as `examples/recorded-motion.csv` from the visible export text. Download links remain available; use Select all text if the embedded browser suppresses a download.
- **Clipboard:** the embedded browser reported a successful copy while its automation clipboard read was empty. The final UI therefore uses explicit text selection and keyboard-copy instructions instead of claiming a successful clipboard write. Cross-application paste should be checked in the user's normal browser.
- The settings policy during active animation is implemented in the same command handler that clears motion. One automation attempt to open settings during live playback timed out; settled settings/revalidation and the underlying command policy were checked. Repeat the active-playback settings check manually.
- Physical touch input, screen-reader output, 200% text enlargement, and other browser engines were not tested. Responsive layout and keyboard alternatives were checked.
- No long-duration 12,000-row browser run was performed; buffer bounds and timing transitions were checked with automated tests.
- Hiding the browser tab is implemented to pause playback; the visibility-change path was not explicitly exercised through browser automation.
- The model is 2D, two-joint, ideal rigid-link kinematics. There is no dynamics, torque, collision, gripping, payload, or hardware validation.

## Short manual checklist for an interview machine

1. Install from the lockfile, run `pnpm test`, `pnpm build`, and `pnpm dev` in a normal terminal.
2. Reproduce (150, 100) mm with both branches, then try outer/inner targets and empty fields.
3. Play the demo, pause/resume, issue another target command during motion, and apply settings during motion. Confirm old playback stops.
4. Export JSON and CSV, inspect the saved filenames, re-import the JSON, and test select/copy/paste into a text editor.
5. Zoom the browser to 200%, check keyboard navigation, and hide/reopen the tab during playback to verify automatic pause.
