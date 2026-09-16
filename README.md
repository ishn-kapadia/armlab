# ArmLab — Interactive Robot Kinematics Simulator

A local, interactive engineering workbench for a planar robot with two revolute joints. Explore forward and analytical inverse kinematics, both elbow configurations, joint limits, and smooth joint-space motion. Built with TypeScript, React, Vite, SVG, and plain CSS.

This is **kinematics and trajectory simulation**, not a physics engine.


## Try it in one minute

1. Move the shoulder and elbow sliders. Watch the tip coordinates change.
2. Enter target x = 150 mm and y = 100 mm, then choose **Solve now**.
3. Switch between **Positive** and **Negative**. Both configurations reach the same target; the dashed arm previews the alternative.
4. Enter x = 300 mm. The arm stays put and the status explains why the target is outside reach.
5. Choose **Load demo**, then **Play sequence**. Pause, resume, or stop with the motion transport.
6. Open **Export JSON**, or export the animation with **CSV**. Download or copy the complete file text.

The [demo session](examples/demo-session.json) can also be imported immediately. Loading the built-in demo replaces robot settings and waypoints with the default four-pose session. A [recorded CSV example](examples/recorded-motion.csv) contains actual samples captured from the browser export dialog during validation, starting at the then-current pose.

## Features and interaction rules

- Joint sliders and numeric inputs, with inclusive editable joint limits.
- Draggable Cartesian target, numeric entry, and keyboard target movement. Arrow keys move 5 mm; Shift + arrow moves 1 mm.
- Geometric reach shading, labelled axes, alternate IK preview, bounded trail, zoom, and fit view.
- Distinct messages for outside reach, the inner unreachable region, a restricted branch, and both branches excluded by limits.
- Actual tip, target, elbow, orientation, and Euclidean position error. Error always uses the **current** joint pose, including during motion.
- Cubic joint-space trajectories, 0.25–10 seconds per segment, with play, pause/resume, and stop.
- Up to 64 named joint waypoints, individual playback, deletion, clearing, and sequential playback.
- Versioned JSON import/export with validation. Actual animation samples export as CSV.
- Responsive laptop and small-screen layouts, labelled inputs, keyboard controls, and native accessible dialogs.

**Numeric targets are staged.** Entering valid x/y coordinates stops motion and changes the target without teleporting the arm. Choose Solve now or Animate target. Dragging solves live. Empty or invalid numeric fields do not become zero; errors are shown and affected commands are disabled.

**Command ownership:** manual joints, target edits, branch changes, settings application, import, and reset stop or replace the previous motion. A new animation has one owner and starts from the current pose. Pause freezes active elapsed time; resume uses a fresh clock reference. Stop retains the current pose and samples. Hiding the tab automatically pauses playback.

**Settings policy:** applying settings stops motion, chooses equivalent allowed angles when possible, and clamps any remaining excluded joints to their limits. The target moves to the new tip. Trail and recording clear. Waypoints keep their original joint angles and are flagged if excluded by the new limits. Changing a link length changes their Cartesian positions. Reset session restores the initial robot and clears waypoints, trail, and recording.

**Waypoint policy:** saving captures the actual valid joint pose, even if a requested Cartesian target is invalid. Playback snapshots the waypoint list when Play sequence is pressed; editing that list changes future runs. Every pose must satisfy current limits before a sequence can start. The preset is a pick-and-place-style **motion demonstration**, with no simulated grasp, payload, or contact.

## Coordinates and mathematics

Lengths and coordinates are in millimetres. The base is (0, 0), world +x points right, and world +y points up. The interface shows degrees; the mathematical core and JSON store radians. Positive angles are counterclockwise. Joint 2 is relative to link 1.

Default geometry is L₁ = 150 mm and L₂ = 100 mm. Both joint limits default to [−180°, +180°]. Supported link lengths are 0.1–10,000 mm; joint endpoints are within [−360°, +360°], with minimum ≤ maximum. Equal endpoints lock a joint.

### Forward kinematics

```text
x₁ = L₁ cos θ₁
y₁ = L₁ sin θ₁
x₂ = x₁ + L₂ cos(θ₁ + θ₂)
y₂ = y₁ + L₂ sin(θ₁ + θ₂)
```

The final link's orientation is θ₁ + θ₂. Position error is hypot(actual.x − target.x, actual.y − target.y).

### Analytical inverse kinematics

First compare target radius r = hypot(x, y) with the geometric annulus:

```text
|L₁ − L₂| ≤ r ≤ L₁ + L₂
```

Only after the reach check, evaluate:

```text
c₂ = (x² + y² − L₁² − L₂²) / (2 L₁ L₂)
θ₂ = ±acos(c₂)
θ₁ = atan2(y, x) − atan2(L₂ sin θ₂, L₁ + L₂ cos θ₂)
```

Each angle is adjusted by an integer multiple of 2π to find a representative inside its joint interval, preferring the representative nearest the current joint value. The limit check is separate from geometric reachability. Invalid targets never move the arm. The reach shading ignores joint limits and is not an exact limited workspace.

Extended and folded configurations are singular because the planar position Jacobian has determinant L₁L₂ sin θ₂ = 0. This reduces local Cartesian motion capability; it does not automatically invalidate the pose. At an equal-link origin target, any shoulder angle can work with a fully folded elbow. ArmLab retains the current shoulder within its limits and merges equivalent branches. See [engineering notes](docs/engineering-notes.md) for tolerances and examples.

### Smooth trajectories

For segment duration T and active elapsed time t:

```text
u = clamp(t / T, 0, 1)
s(u) = 3u² − 2u³
θ(u) = θstart + s(u) (θend − θstart)
```

The easing has zero endpoint velocity. Each angle is a convex combination of valid endpoints, so the whole segment stays in its interval. There is **no wrapped shortest-angle shortcut**: a move from +170° to −170° passes through 0° and remains inside [−180°, +180°]. A joint-space line generally creates a curved end-effector path.

Each waypoint segment comes to rest. Acceleration is not guaranteed continuous across boundaries, and no speed, acceleration, torque, or collision constraints are enforced.

## Data and bounded storage

Version 1 JSON includes `format: "armlab"`, `version: 1`, explicit mm/rad units, robot settings, current joint pose, target, selected branch, segment duration, and named joint waypoints. Import validates the complete document before replacing any state. Unknown fields are discarded. Invalid waypoints under edited limits can be retained in a session but cannot be played until made valid. Import has a 256 KB size limit.

CSV columns:

```text
elapsed_s,theta1_deg,theta2_deg,x_mm,y_mm
```

The recorder captures the initial pose, actual rendered samples at intervals of at least 50 ms, and the final or stopped pose. Timing is not a fixed sampling frequency: frame scheduling can lengthen intervals. Elapsed time excludes pauses. A new run replaces the previous recording. At most the most recent 12,000 samples and 600 trail points are retained. View toggles hide layers without stopping collection. No data is saved automatically across page reloads.

Export dialogs provide a full text preview, a Download file link, and Select all text for embedded browsers with download restrictions. After selecting, use Ctrl+C or Command+C and save the text with the filename shown. The application does not claim that a file has been saved merely because a download was requested.

## Architecture

```text
src/core/kinematics.ts    Pure geometry, FK, IK, limits, validation
src/core/motion.ts        Pure interpolation, elapsed-time state, bounded records
src/core/commands.ts      Target failure and settings-revalidation policies
src/core/session.ts       Versioned parser, waypoint types, demo preset
src/core/*.test.ts        Mathematical and transition tests
src/useSimulator.ts      Browser clock, command ownership, React state
src/components/          SVG scene, numeric inputs, dialogs
src/App.tsx              Controls, inspector, data and waypoint flows
src/styles.css           Responsive visual design
examples/                Importable demonstration session
docs/                    Engineering, interview, and validation material
```

No robotics functions depend on React or SVG. The renderer performs one explicit y-axis inversion: screenY = centreY − worldY × scale. Pointer input applies the inverse transform using the SVG screen matrix, including browser scaling.

## Tests

```sh
pnpm test
pnpm typecheck
pnpm build
```

Use `pnpm test:watch` during development. Tests cover known FK configurations, FK/IK round trips, both branches, boundaries, invalid targets and inputs, equivalent angles, limits, degeneracy, singularities, interpolation, pause/resume/stop, buffer bounds, and session validation. [Validation results](docs/validation.md) distinguish automated checks, browser checks, and remaining unverified behavior.

## Engineering and portfolio material

- [Engineering notes and worked example](docs/engineering-notes.md)
- [Executed checks and limitations](docs/validation.md)
