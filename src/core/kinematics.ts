/** All lengths are mm; all internal angles are radians. No rendering or React. */
export type Pose = [
    number,
    number
];
export type Point = {
    x: number;
    y: number;
};
export type Limit = {
    min: number;
    max: number;
};
export type Robot = {
    l1: number;
    l2: number;
    limits: [
        Limit,
        Limit
    ];
};
export type Branch = 'positive' | 'negative';
export const TAU = 2 * Math.PI;
export const ANGLE_EPS = 1e-9;
export const radians = (degrees: number) => degrees * Math.PI / 180;
export const degrees = (rad: number) => rad * 180 / Math.PI;
export const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const DEFAULT_ROBOT: Robot = { l1: 150, l2: 100, limits: [{ min: -Math.PI, max: Math.PI }, { min: -Math.PI, max: Math.PI }] };
export const DEFAULT_POSE: Pose = [radians(30), radians(60)];
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const positionTolerance = (robot: Robot) => 1e-9 * Math.max(1, robot.l1 + robot.l2);
export function robotError(robot: Robot): string | null {
    if (![robot.l1, robot.l2].every(v => Number.isFinite(v) && v >= 0.1 && v <= 10000))
        return 'Link lengths must be between 0.1 and 10,000 mm.';
    if (robot.limits.length !== 2 || robot.limits.some(l => !Number.isFinite(l.min) || !Number.isFinite(l.max) || l.min < -TAU || l.max > TAU || l.min > l.max))
        return 'Each joint limit must be within −360° to +360°, with minimum ≤ maximum.';
    return null;
}
export function poseValid(pose: Pose, robot: Robot): boolean {
    return !robotError(robot) && pose.length === 2 && pose.every((a, i) => Number.isFinite(a) && a >= robot.limits[i].min - ANGLE_EPS && a <= robot.limits[i].max + ANGLE_EPS);
}
export function forward(robot: Robot, pose: Pose): {
    elbow: Point;
    tip: Point;
} {
    if (robotError(robot) || !pose.every(Number.isFinite))
        throw new Error('Forward kinematics requires valid geometry and finite angles.');
    const [a, b] = pose;
    const elbow = { x: robot.l1 * Math.cos(a), y: robot.l1 * Math.sin(a) };
    return { elbow, tip: { x: elbow.x + robot.l2 * Math.cos(a + b), y: elbow.y + robot.l2 * Math.sin(a + b) } };
}
/** Find a + 2πk inside the actual interval, preferring the current joint value. */
export function equivalentInLimit(a: number, limit: Limit, reference = 0): number | null {
    if (![a, limit.min, limit.max, reference].every(Number.isFinite) || limit.min > limit.max)
        return null;
    const low = Math.ceil((limit.min - a - ANGLE_EPS) / TAU);
    const high = Math.floor((limit.max - a + ANGLE_EPS) / TAU);
    if (low > high)
        return null;
    const k = clamp(Math.round((reference - a) / TAU), low, high);
    return clamp(a + k * TAU, limit.min, limit.max);
}
export function revalidatePose(pose: Pose, robot: Robot): Pose {
    return pose.map((a, i) => equivalentInLimit(a, robot.limits[i], a) ?? clamp(a, robot.limits[i].min, robot.limits[i].max)) as Pose;
}
export type IKResult = {
    ok: boolean;
    reason: 'ok' | 'outside' | 'inside' | 'limits' | 'numeric';
    message: string;
    solutions: {
        branches: Branch[];
        pose: Pose;
    }[];
    degenerate: boolean;
};
export function inverse(robot: Robot, target: Point, reference: Pose = [0, 0]): IKResult {
    const fail = (reason: IKResult['reason'], message: string): IKResult => ({ ok: false, reason, message, solutions: [], degenerate: false });
    if (robotError(robot) || ![target.x, target.y, ...reference].every(Number.isFinite))
        return fail('numeric', 'Enter finite coordinates and valid robot settings.');
    const r = Math.hypot(target.x, target.y), outer = robot.l1 + robot.l2, inner = Math.abs(robot.l1 - robot.l2), eps = positionTolerance(robot);
    // Geometry is checked BEFORE any acos clamping. Tolerance covers roundoff only.
    if (r > outer + eps)
        return fail('outside', `Outside reach: target is ${r.toFixed(2)} mm from the base; maximum is ${outer.toFixed(2)} mm.`);
    if (r < inner - eps)
        return fail('inside', `Inside the inner unreachable region: minimum radius is ${inner.toFixed(2)} mm.`);
    const degenerate = robot.l1 === robot.l2 && r <= eps;
    const c2 = clamp((target.x ** 2 + target.y ** 2 - robot.l1 ** 2 - robot.l2 ** 2) / (2 * robot.l1 * robot.l2), -1, 1);
    let b = degenerate ? Math.PI : Math.acos(c2);
    if (!degenerate && Math.abs(c2) > 1 - 1e-8) {
        // Equivalent cosine-rule half-angle form preserves tiny offsets when c2 rounds to ±1.
        const checkedRadius = clamp(r, inner, outer);
        b = 2 * Math.atan2(
            Math.sqrt((outer - checkedRadius) * (outer + checkedRadius)),
            Math.sqrt((checkedRadius - inner) * (checkedRadius + inner))
        );
    }
    const solutions: IKResult['solutions'] = [];
    for (const branch of ['positive', 'negative'] as const) {
        const rawB = branch === 'positive' ? b : -b;
        // At equal-link origin there are infinitely many shoulder angles. Keep the reference.
        const sinB = b === Math.PI || b === 0 ? 0 : Math.sin(rawB);
        const rawA = degenerate ? clamp(reference[0], robot.limits[0].min, robot.limits[0].max) : Math.atan2(target.y, target.x) - Math.atan2(robot.l2 * sinB, robot.l1 + robot.l2 * Math.cos(rawB));
        const a = equivalentInLimit(rawA, robot.limits[0], reference[0]);
        const angleB = equivalentInLimit(rawB, robot.limits[1], reference[1]);
        if (a === null || angleB === null)
            continue;
        const pose: Pose = [a, angleB];
        const same = solutions.find(s => s.pose.every((v, i) => Math.abs(Math.atan2(Math.sin(v - pose[i]), Math.cos(v - pose[i]))) <= ANGLE_EPS));
        if (same)
            same.branches.push(branch);
        else
            solutions.push({ branches: [branch], pose });
    }
    if (!solutions.length)
        return fail('limits', 'Geometrically reachable, but both inverse-kinematics configurations are excluded by joint limits.');
    return { ok: true, reason: 'ok', message: degenerate ? 'Equal-link origin: infinitely many shoulder angles. The current shoulder angle is retained within its limits.' : 'Target is reachable.', solutions, degenerate };
}
export function branchPose(result: IKResult, branch: Branch): Pose | null {
    return result.solutions.find(s => s.branches.includes(branch))?.pose ?? null;
}
export function singularity(pose: Pose): 'extended' | 'folded' | null {
    if (Math.abs(Math.sin(pose[1])) > 1e-7)
        return null;
    return Math.cos(pose[1]) >= 0 ? 'extended' : 'folded';
}
export function parseFiniteInput(text: string): number | null {
    if (!text.trim())
        return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
}
