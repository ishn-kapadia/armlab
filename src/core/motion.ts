import { forward, poseValid, type Point, type Pose, type Robot } from './kinematics';
export const MAX_SAMPLES = 12000;
export const MAX_TRAIL = 600;
export const smoothstep = (u: number) => { const t = Math.max(0, Math.min(1, u)); return 3 * t * t - 2 * t * t * t; };
/** Direct interpolation of stored angles: a convex combination stays inside both limits. */
export function interpolate(from: Pose, to: Pose, u: number): Pose {
    const s = smoothstep(u);
    return [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s];
}
export type Motion = {
    poses: Pose[];
    durationMs: number;
    elapsedMs: number;
    status: 'running' | 'paused' | 'complete' | 'stopped';
};
export function createMotion(robot: Robot, from: Pose, destinations: Pose[], durationSeconds: number): Motion {
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0.25 || durationSeconds > 10)
        throw new Error('Duration must be 0.25–10 seconds per segment.');
    if (!destinations.length || destinations.length > 64 || ![from, ...destinations].every(p => poseValid(p, robot)))
        throw new Error('Every motion pose must satisfy the current joint limits.');
    return { poses: [from, ...destinations].map(p => [...p] as Pose), durationMs: durationSeconds * 1000, elapsedMs: 0, status: 'running' };
}
export const totalMs = (m: Motion) => (m.poses.length - 1) * m.durationMs;
export function motionSample(m: Motion): {
    pose: Pose;
    segment: number;
    progress: number;
} {
    const segment = Math.min(m.poses.length - 2, Math.floor(m.elapsedMs / m.durationMs));
    const u = (m.elapsedMs - segment * m.durationMs) / m.durationMs;
    return { pose: interpolate(m.poses[segment], m.poses[segment + 1], u), segment, progress: m.elapsedMs / totalMs(m) };
}
export function advanceMotion(m: Motion, deltaMs: number): Motion {
    if (!Number.isFinite(deltaMs) || deltaMs < 0)
        throw new Error('Elapsed time must be finite and nonnegative.');
    if (m.status !== 'running')
        return m;
    const elapsedMs = Math.min(totalMs(m), m.elapsedMs + deltaMs);
    return { ...m, elapsedMs, status: elapsedMs >= totalMs(m) ? 'complete' : 'running' };
}
export const pauseMotion = (m: Motion): Motion => m.status === 'running' ? { ...m, status: 'paused' } : m;
export const resumeMotion = (m: Motion): Motion => m.status === 'paused' ? { ...m, status: 'running' } : m;
export const stopMotion = (m: Motion): Motion => ({ ...m, status: 'stopped' });
export type Sample = {
    elapsedMs: number;
    pose: Pose;
    tip: Point;
};
export const recordSample = (robot: Robot, pose: Pose, elapsedMs: number): Sample => ({ elapsedMs, pose: [...pose], tip: forward(robot, pose).tip });
export function appendBounded<T>(items: T[], item: T, maximum: number): T[] { return [...items.slice(-(maximum - 1)), item]; }
export function samplesCsv(samples: Sample[]): string {
    const deg = 180 / Math.PI;
    return ['elapsed_s,theta1_deg,theta2_deg,x_mm,y_mm', ...samples.map(s => [s.elapsedMs / 1000, s.pose[0] * deg, s.pose[1] * deg, s.tip.x, s.tip.y].map(v => v.toFixed(6)).join(','))].join('\r\n') + '\r\n';
}
