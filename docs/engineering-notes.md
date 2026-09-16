# Engineering notes

These notes explain ArmLab's actual implementation, with enough detail to reproduce its main calculations.

## 1. Why a planar 2R robot?

Two revolute joints are small enough to understand completely but still demonstrate important robotics ideas: coordinate conventions, forward and inverse kinematics, multiple solutions, joint limits, singularities, and motion planning. A browser and SVG make the result easy to demonstrate without hardware.

The model contains only two link lengths and two angles. A revolute joint turns; it does not slide. The base is fixed. All links are ideal rigid line segments, so bending, friction, torque, and mass are outside the model.

The mathematical core uses radians, which match JavaScript's trigonometric functions. Conversion to degrees happens at the user interface and in CSV output. JSON explicitly declares radians to avoid ambiguous imported data.

## 2. Forward kinematics as adding vectors

Link 1 contributes the vector (L₁ cos θ₁, L₁ sin θ₁). Joint 2's angle is relative to link 1, so the second vector uses θ₁ + θ₂. Adding the two vectors gives the tip.

This detail matters: treating θ₂ as an absolute world angle produces a visibly plausible but incorrect robot. The tests include θ₁ = 90°, θ₂ = −90°: link 1 points up and link 2 points right, giving an elbow at (0, 150) mm and a tip at (100, 150) mm.

SVG's y-axis points down. ArmLab leaves the mathematics in an ordinary y-up frame and changes the sign only in the renderer:

```text
screenX = centreX + scale × worldX
screenY = centreY − scale × worldY
```

Pointer coordinates first pass through the inverse SVG screen matrix, then the inverse of these equations. This avoids changing the physics convention just to match the drawing system.

## 3. The two inverse-kinematics branches

The base, elbow, and target form a triangle. Rearranging the cosine rule gives:

```text
cos θ₂ = (x² + y² − L₁² − L₂²) / (2L₁L₂)
```

The cosine is the same for +θ₂ and −θ₂. These normally give two arm configurations at the same tip position. ArmLab labels them Positive and Negative using the sign of sin θ₂, and shows the alternative as a dashed arm. The labels do not promise that the elbow is globally above or below the target; that depends on the target direction.

Once θ₂ is known, subtract the triangle's internal direction offset from atan2(y, x) to find θ₁. atan2 uses both coordinates and keeps the correct quadrant.

The implementation returns an array of distinct configurations, with the branch names that lead to each. At an extended or folded boundary, both branch names can refer to the same configuration. Deduplication compares angles modulo 2π instead of treating +180° and −180° as different physical directions.

## 4. Worked example

Take L₁ = 150 mm, L₂ = 100 mm, and target (150, 100) mm.

```text
r² = 150² + 100² = 32,500 mm²
c₂ = (32,500 − 22,500 − 10,000) / 30,000 = 0
θ₂ = +90° or −90°
```

For the positive branch:

```text
θ₁ = atan2(100, 150) − atan2(100, 150) = 0°
x₂ = 150 cos 0° + 100 cos 90° = 150 mm
y₂ = 150 sin 0° + 100 sin 90° = 100 mm
```

For the negative branch:

```text
θ₁ = atan2(100, 150) − atan2(−100, 150)
   ≈ 67.380135°
θ₂ = −90°
```

Substitute θ₁ ≈ 67.380135° and θ₁ + θ₂ ≈ −22.619865° into FK. The first link ends at approximately (57.692308, 138.461538) mm. The second contributes approximately (92.307692, −38.461538) mm. The sum is (150, 100) mm again.

The unrestricted reach radii are |150 − 100| = 50 mm and 150 + 100 = 250 mm. The target radius is approximately 180.277564 mm, so it lies between those boundaries. Both solutions also satisfy the default joint limits.

## 5. Reachability is not the same as allowed motion

There are two different questions:

1. Can these lengths form a triangle reaching the target?
2. Can an IK solution use angles inside both configured joint intervals?

A radius greater than L₁ + L₂ is outside outer reach. A radius less than |L₁ − L₂| is inside the inner unreachable region. A point in the annulus can still require joint angles excluded by the limits.

ArmLab checks geometry first, then limits for each branch. It keeps the last valid pose if either the target is unreachable or the selected branch is excluded. It does not project a target to the boundary and claim success. The inspector still shows the actual error.

The workspace shading shows the annulus only. Computing the exact workspace under joint limits would require additional geometric analysis; the UI explicitly avoids claiming to do that.

## 6. Equivalent angles and joint intervals

Angles a and a + 2πk describe the same direction for any integer k. For example, −170° and +190° are equivalent, but only the second lies in [180°, 270°].

`equivalentInLimit` finds the range of integer k values that place the angle inside the actual interval. It chooses the representative nearest the current joint angle. This makes branch solutions consistent with restricted intervals and avoids unnecessary revolutions.

The stored joint value still matters for motion. For an interval [−180°, 180°], moving from +170° to −170° cannot take a shortcut through +180° and then jump to −180°. That would be a discontinuity in the configured joint coordinate. ArmLab interpolates directly through 0°. This is longer angular travel, but every value stays inside the interval.

On settings changes, an equivalent allowed angle is preferred; if no equivalent exists, the joint is clamped. That deliberate revalidation can change the tip. The target follows the resulting tip, so the inspector remains coherent.

## 7. Numerical tolerances and singularities

Computers approximate real numbers with floating-point values. A point on a boundary may produce a cosine slightly larger than 1 or smaller than −1. Passing that directly to acos would yield NaN.

ArmLab uses a position tolerance of **10⁻⁹ × max(1, L₁ + L₂) mm**. For the default arm this is 0.00000025 mm. The radius comparison happens before cosine clamping; only accepted roundoff is clamped to [−1, 1]. A target measurably outside that tolerance is rejected. A tolerated boundary discrepancy remains present in the exact position error, though the displayed error is rounded to 0.001 mm.

Very near a singularity, subtraction can round c₂ to exactly ±1 even for a target just inside the workspace. When |c₂| > 1 − 10⁻⁸, ArmLab evaluates the equivalent half-angle form below, using the radius already checked against the reach bounds:

```text
θ₂ magnitude = 2 atan2(√((outer − r)(outer + r)),
                      √((r − inner)(r + inner)))
```

This follows from the same cosine rule and preserves tiny offsets more accurately. At an exact extended or folded angle, the analytical sine is set to zero instead of using the small floating-point residue of sin(π). Regression tests cover tiny nonzero equal-link targets, almost-equal links at folding, and the supported length extremes.

Joint comparisons and branch deduplication use **10⁻⁹ radians**. Singularity indication uses **|sin θ₂| ≤ 10⁻⁷** as a numerical threshold for effectively extended or folded poses; it is not a measure of the width of a practically ill-conditioned region.

For planar position, the Jacobian is:

```text
J = [ −L₁ sin θ₁ − L₂ sin(θ₁+θ₂),  −L₂ sin(θ₁+θ₂) ]
    [  L₁ cos θ₁ + L₂ cos(θ₁+θ₂),   L₂ cos(θ₁+θ₂) ]

det J = L₁L₂ sin θ₂
```

At full extension or folding, the determinant is zero. Small joint changes cannot independently create small tip motions in every Cartesian direction. This is a limitation of local motion capability, not a rule saying the pose is invalid. ArmLab does not invert the Jacobian or implement velocity IK.

### Equal links at the origin

When L₁ = L₂ and the target is the origin, a fully folded elbow puts the tip at the base for any shoulder angle. The usual two-solution interpretation becomes a continuum of solutions. There is no unique shoulder direction.

The implementation deliberately detects equal links and an origin target within position tolerance. It keeps the current shoulder within its limits and looks for an allowed representative of a 180° elbow. If folding is excluded, the target is invalid under the limits. The UI explains this degeneracy instead of relying on atan2(0, 0).

## 8. Why cubic joint-space motion?

Linear interpolation in time would abruptly start and stop at a nonzero velocity. The cubic blend s(u) = 3u² − 2u³ has derivative 6u − 6u², which is zero at u = 0 and u = 1.

For 0 ≤ u ≤ 1, the blend stays between 0 and 1, so each joint value is a convex combination of the start and end values. An ordinary interval contains every such combination. This proves the limit property for each segment once both endpoints are valid.

The browser's animation callback supplies a timestamp. ArmLab accumulates actual elapsed milliseconds, rather than moving a fixed amount per frame. The same elapsed time gives the same pose regardless of how many frames were rendered. A delayed frame can cross multiple segments without losing time.

Pause preserves elapsed time. Resume starts a new clock reference, excluding time spent paused. One effect owns the animation loop and cancels it when the run or status changes. A new run starts at the current pose. Hiding the tab pauses playback to avoid surprising jumps after background throttling.

Zero endpoint velocity does not guarantee continuous acceleration. Each waypoint stops before the next segment. Joint trajectories are not generally straight Cartesian tip trajectories, and this implementation does not check physical motor capability.

## 9. Data and reproducibility choices

Waypoints store joint configurations because the trajectory is defined in joint space. Storing both joint angles and Cartesian coordinates as authoritative data would create contradictions after a length change. The UI computes waypoint tip positions from the current geometry when playing.

Import constructs a fresh validated session and replaces state only on success. Invalid numeric values, missing fields, unsupported versions or units, duplicate IDs, oversized files, and bad names produce errors. Waypoints excluded by edited limits remain useful records, so they can round trip through JSON; playback checks them separately.

The recording contains actual frame-sampled values, not invented measurements. It includes an initial sample, samples no more often than once per 50 ms, and a final sample. The buffer is bounded to the latest 12,000 rows. The trail is separately bounded to 600 points. The browser refresh rate and workload influence sampling intervals, so no fixed-frequency acquisition claim is made.

## 10. How the mathematical claims were checked

| Claim | Validation in this project |
|---|---|
| Relative joint convention and FK vectors | Five known configurations plus an explicit elbow/tip check |
| Both IK branches reach the same target | Worked-example assertions and FK substitution of both results |
| FK/IK consistency | Grid of 42 nonsingular input poses, checking both inverse results |
| Annulus and boundaries | Inner/outer failures, positive/negative x boundary targets, and roundoff cases |
| Limits are separate from reach | Fully excluded and one-branch-only configurations |
| Equivalent angles are accepted consistently | Restricted positive-angle intervals, ±π endpoints, and nearest representatives |
| Equal-link origin is deliberate | Retained shoulder, merged branches, and excluded folding |
| Singular poses need not be invalid | Extended/folded classification and accepted boundary IK |
| Cubic law and limit preservation | Endpoints, midpoint, finite-difference endpoint slope, and sampled interval compliance |
| Timing is independent of frame subdivision | One large time step compared with ten smaller steps |
| Pause, resume, and stop preserve state | Pure motion-state tests plus observed browser pause/resume |
| Invalid commands preserve the last pose | Pure command tests and browser invalid-target checks |
| Imported data is valid before use | Schema tests, demo round trip, and browser file import |

Automated tests are necessary evidence, not proof of every possible input. The analytical reasoning above explains why the formulas and interval policy work; the tests check representative boundaries and regressions. The [validation log](validation.md) records what was actually executed.
