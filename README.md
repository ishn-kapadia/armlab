# ArmLab. An Interactive Robot Kinematics Simulator

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

## Engineering and portfolio material

- [Engineering notes and worked example](docs/engineering-notes.md)
- [Executed checks and limitations](docs/validation.md)
