import { expect, it } from 'vitest';
import { DEFAULT_ROBOT, forward, type Pose } from './kinematics';
import { applyGeometry, solveTarget } from './commands';
it('keeps the last valid pose for unreachable and branch-excluded commands', () => {
    const current: Pose = [0.3, 0.6];
    expect(solveTarget(DEFAULT_ROBOT, current, { x: 500, y: 0 }, 'positive').pose).toBe(current);
    const limited = { ...DEFAULT_ROBOT, limits: [DEFAULT_ROBOT.limits[0], { min: 0, max: Math.PI }] as typeof DEFAULT_ROBOT.limits };
    const result = solveTarget(limited, current, { x: 150, y: 100 }, 'negative');
    expect(result.pose).toBe(current);
    expect(result.error).toContain('branch');
});
it('makes a valid target command agree with FK', () => { const result = solveTarget(DEFAULT_ROBOT, [0, 0], { x: 150, y: 100 }, 'positive'); expect(result.error).toBeNull(); expect(forward(DEFAULT_ROBOT, result.pose).tip.x).toBeCloseTo(150); });
it('revalidates pose and target coherently after geometry changes', () => { const robot = { ...DEFAULT_ROBOT, l1: 200 }; const result = applyGeometry(robot, [0.3, 0.6]); expect(result.target).toEqual(forward(robot, result.pose).tip); });
