import { describe, expect, it } from 'vitest';
import { ANGLE_EPS, DEFAULT_ROBOT as robot, branchPose, degrees, distance, equivalentInLimit, forward, inverse, parseFiniteInput, poseValid, radians as rad, revalidatePose, robotError, singularity, type Pose, type Robot } from './kinematics';
describe('forward kinematics and conventions', () => {
    it.each<[
        Pose,
        number,
        number
    ]>([[[0, 0], 250, 0], [[Math.PI / 2, 0], 0, 250], [[0, Math.PI / 2], 150, 100], [[0, Math.PI], 50, 0], [[Math.PI / 2, -Math.PI / 2], 100, 150]])('evaluates %j', (pose, x, y) => {
        const tip = forward(robot, pose).tip;
        expect(tip.x).toBeCloseTo(x, 9);
        expect(tip.y).toBeCloseTo(y, 9);
    });
    it('uses a relative second joint', () => { const f = forward(robot, [Math.PI / 2, -Math.PI / 2]); expect(f.elbow.y).toBeCloseTo(150); expect(f.tip.y).toBeCloseTo(150); });
});
describe('analytical inverse kinematics', () => {
    it('returns both distinct branches for a nonsingular target', () => {
        const result = inverse(robot, { x: 150, y: 100 });
        expect(result.solutions).toHaveLength(2);
        expect(branchPose(result, 'positive')![1]).toBeCloseTo(Math.PI / 2);
        expect(branchPose(result, 'negative')![1]).toBeCloseTo(-Math.PI / 2);
        result.solutions.forEach(s => expect(distance(forward(robot, s.pose).tip, { x: 150, y: 100 })).toBeLessThan(1e-7));
    });
    it('round trips a grid of poses through both branches', () => {
        for (const a of [-175, -120, -30, 0, 45, 120, 175])
            for (const b of [-160, -90, -20, 20, 90, 160]) {
                const tip = forward(robot, [rad(a), rad(b)]).tip, ik = inverse(robot, tip);
                expect(ik.ok).toBe(true);
                expect(ik.solutions).toHaveLength(2);
                for (const s of ik.solutions) {
                    expect(distance(forward(robot, s.pose).tip, tip)).toBeLessThan(1e-7);
                    expect(poseValid(s.pose, robot)).toBe(true);
                }
            }
    });
    it('distinguishes outer and inner unreachable targets', () => {
        expect(inverse(robot, { x: 251, y: 0 }).reason).toBe('outside');
        expect(inverse(robot, { x: 49, y: 0 }).reason).toBe('inside');
        expect(inverse(robot, { x: 0, y: 0 }).reason).toBe('inside');
    });
    it.each([250, 50, -250, -50])('handles workspace boundary x=%s without duplicate configurations', x => {
        const ik = inverse(robot, { x, y: 0 });
        expect(ik.ok).toBe(true);
        expect(ik.solutions).toHaveLength(1);
        expect(ik.solutions[0].branches).toEqual(['positive', 'negative']);
        expect(distance(forward(robot, ik.solutions[0].pose).tip, { x, y: 0 })).toBeLessThan(1e-7);
    });
    it('clamps roundoff only after a geometric tolerance check', () => {
        expect(inverse(robot, { x: 250 + 1e-8, y: 0 }).ok).toBe(true);
        expect(inverse(robot, { x: 250 + 1e-4, y: 0 }).reason).toBe('outside');
        expect(inverse(robot, { x: 50 - 1e-4, y: 0 }).reason).toBe('inside');
    });
    it('separates limit exclusion from reach', () => {
        const limited: Robot = { ...robot, limits: [{ min: 0, max: 0.1 }, { min: 0, max: 0.1 }] };
        expect(inverse(limited, { x: 150, y: 100 }).reason).toBe('limits');
        const one: Robot = { ...robot, limits: [robot.limits[0], { min: 0, max: Math.PI }] };
        const ik = inverse(one, { x: 150, y: 100 });
        expect(ik.solutions).toHaveLength(1);
        expect(branchPose(ik, 'negative')).toBeNull();
    });
    it('accepts equivalent angles at restricted limits', () => {
        expect(degrees(equivalentInLimit(rad(-170), { min: rad(180), max: rad(270) })!)).toBeCloseTo(190);
        const restricted: Robot = { ...robot, limits: [{ min: rad(180), max: rad(240) }, { min: rad(40), max: rad(100) }] };
        const tip = forward(restricted, [rad(210), rad(60)]).tip;
        expect(branchPose(inverse(restricted, tip), 'positive')![0]).toBeCloseTo(rad(210));
    });
    it('handles endpoint equivalence and tolerance consistently', () => {
        expect(equivalentInLimit(Math.PI, { min: -Math.PI, max: -Math.PI })).toBe(-Math.PI);
        expect(equivalentInLimit(1 + ANGLE_EPS / 2, { min: 0, max: 1 })).toBe(1);
        expect(equivalentInLimit(2, { min: 0, max: 1 })).toBeNull();
    });
    it('keeps the nearest allowed representative', () => { expect(equivalentInLimit(rad(-170), { min: -2 * Math.PI, max: 2 * Math.PI }, rad(200))).toBeCloseTo(rad(190)); });
    it('deliberately retains shoulder for equal-link origin degeneracy', () => {
        const equal = { ...robot, l2: 150 }, result = inverse(equal, { x: 0, y: 0 }, [rad(70), 0]);
        expect(result.ok).toBe(true);
        expect(result.degenerate).toBe(true);
        expect(result.solutions).toHaveLength(1);
        expect(result.solutions[0].pose[0]).toBeCloseTo(rad(70));
        expect(Math.hypot(...Object.values(forward(equal, result.solutions[0].pose).tip))).toBeLessThan(1e-7);
        expect(inverse({ ...equal, limits: [robot.limits[0], { min: -1, max: 1 }] }, { x: 0, y: 0 }).reason).toBe('limits');
    });
    it('handles a longer second link at the folded boundary', () => { const r = { ...robot, l1: 100, l2: 150 }; const ik = inverse(r, { x: 50, y: 0 }); expect(distance(forward(r, ik.solutions[0].pose).tip, { x: 50, y: 0 })).toBeLessThan(1e-7); });
    it('identifies extended/folded singularities without marking them invalid', () => {
        expect(singularity([0, 0])).toBe('extended');
        expect(singularity([0, Math.PI])).toBe('folded');
        expect(singularity([0, -Math.PI])).toBe('folded');
        expect(singularity([0, rad(30)])).toBeNull();
        expect(inverse(robot, { x: 250, y: 0 }).ok).toBe(true);
    });
    it('revalidates changed limits using equivalence then clamping', () => { const r: Robot = { ...robot, limits: [{ min: rad(180), max: rad(240) }, { min: 0, max: 1 }] }; const pose = revalidatePose([rad(-150), -1], r); expect(pose[0]).toBeCloseTo(rad(210), 12); expect(pose[1]).toBe(0); });
});
describe('numerical conditioning near singularities', () => {
    it('resolves a tiny nonzero target for equal links instead of rounding it to the origin', () => {
        const equal = { ...robot, l2: 150 };
        const target = { x: 0.000001, y: 0 };
        const result = inverse(equal, target);
        expect(result.degenerate).toBe(false);
        expect(result.solutions).toHaveLength(2);
        for (const solution of result.solutions) expect(distance(forward(equal, solution.pose).tip, target)).toBeLessThan(1e-9);
    });
    it('merges the exact folded boundary even when link lengths are almost equal', () => {
        const close = { ...robot, l1: 150.00000001, l2: 150 };
        const result = inverse(close, { x: close.l1 - close.l2, y: 0 });
        expect(result.solutions).toHaveLength(1);
        expect(result.solutions[0].branches).toEqual(['positive', 'negative']);
    });
    it.each([[0.1, 0.1], [0.1, 10000], [10000, 0.1], [10000, 10000]])('round trips supported length extremes %s/%s', (l1, l2) => {
        const geometry = { ...robot, l1, l2 };
        for (const pose of [[0.3, 0.7], [-2, -1.5], [1, 0.000001]] as Pose[]) {
            const target = forward(geometry, pose).tip;
            const result = inverse(geometry, target, pose);
            expect(result.ok).toBe(true);
            for (const solution of result.solutions) expect(distance(forward(geometry, solution.pose).tip, target)).toBeLessThan(1e-7 * (l1 + l2));
        }
    });
});
describe('invalid numbers', () => {
    it.each(['', ' ', 'Infinity', '-Infinity', 'NaN', '1x'])('rejects input %j', input => expect(parseFiniteInput(input)).toBeNull());
    it('accepts zero and decimals', () => { expect(parseFiniteInput('0')).toBe(0); expect(parseFiniteInput('-0.5')).toBe(-0.5); });
    it('rejects invalid geometry, limits and targets', () => {
        for (const l1 of [NaN, Infinity, 0, -10])
            expect(robotError({ ...robot, l1 })).not.toBeNull();
        expect(robotError({ ...robot, limits: [{ min: 1, max: -1 }, robot.limits[1]] })).not.toBeNull();
        expect(inverse(robot, { x: NaN, y: 0 }).reason).toBe('numeric');
        expect(() => forward(robot, [Infinity, 0])).toThrow();
        expect(poseValid([NaN, 0], robot)).toBe(false);
    });
});
