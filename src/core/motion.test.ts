import { describe, expect, it } from 'vitest';
import { DEFAULT_ROBOT as robot, poseValid, radians as rad, type Pose } from './kinematics';
import { advanceMotion, appendBounded, createMotion, interpolate, motionSample, pauseMotion, recordSample, resumeMotion, samplesCsv, smoothstep, stopMotion } from './motion';
describe('joint-space interpolation', () => {
    it('has correct endpoints and midpoint', () => { expect(smoothstep(0)).toBe(0); expect(smoothstep(0.5)).toBe(0.5); expect(smoothstep(1)).toBe(1); expect(interpolate([0, 1], [2, 3], 0)).toEqual([0, 1]); expect(interpolate([0, 1], [2, 3], 0.5)).toEqual([1, 2]); expect(interpolate([0, 1], [2, 3], 1)).toEqual([2, 3]); });
    it('has zero endpoint slope within finite-difference tolerance', () => { const h = 1e-6; expect(smoothstep(h) / h).toBeLessThan(1e-5); expect((1 - smoothstep(1 - h)) / h).toBeLessThan(1e-5); });
    it('stays inside limits without taking a wrapped shortcut', () => {
        const from: Pose = [rad(170), rad(-120)], to: Pose = [rad(-170), rad(120)];
        expect(interpolate(from, to, 0.5)[0]).toBeCloseTo(0);
        for (let i = 0; i <= 100; i++)
            expect(poseValid(interpolate(from, to, i / 100), robot)).toBe(true);
    });
    it('rejects invalid duration and destinations', () => { expect(() => createMotion(robot, [0, 0], [[4, 0]], 2)).toThrow(); expect(() => createMotion(robot, [0, 0], [], 2)).toThrow(); for (const d of [0, -1, NaN, 11])
        expect(() => createMotion(robot, [0, 0], [[1, 1]], d)).toThrow(); });
});
describe('elapsed-time state transitions', () => {
    it('is independent of frame subdivision', () => {
        const m = createMotion(robot, [0, 0], [[1, 1]], 2);
        let split = m;
        for (let i = 0; i < 10; i++)
            split = advanceMotion(split, 100);
        expect(motionSample(split)).toEqual(motionSample(advanceMotion(m, 1000)));
    });
    it('pauses and resumes without a jump', () => {
        let m = advanceMotion(createMotion(robot, [0, 0], [[1, 1]], 2), 500);
        const before = motionSample(m);
        m = pauseMotion(m);
        m = advanceMotion(m, 9000);
        expect(motionSample(m)).toEqual(before);
        m = resumeMotion(m);
        expect(motionSample(m)).toEqual(before);
        m = advanceMotion(m, 500);
        expect(motionSample(m).pose).toEqual([0.5, 0.5]);
    });
    it('stops at the current pose', () => { const m = stopMotion(advanceMotion(createMotion(robot, [0, 0], [[1, 1]], 2), 500)); expect(advanceMotion(m, 2000)).toEqual(m); });
    it('crosses multiple segments in one delayed frame and ends exactly', () => {
        const m = createMotion(robot, [0, 0], [[1, 1], [2, 0]], 1);
        expect(motionSample(advanceMotion(m, 1000)).pose).toEqual([1, 1]);
        expect(motionSample(advanceMotion(m, 1500)).pose).toEqual([1.5, 0.5]);
        const end = advanceMotion(m, 9000);
        expect(end.status).toBe('complete');
        expect(end.elapsedMs).toBe(2000);
        expect(motionSample(end).pose).toEqual([2, 0]);
    });
    it('rejects invalid clock deltas', () => { const m = createMotion(robot, [0, 0], [[1, 1]], 1); expect(() => advanceMotion(m, -1)).toThrow(); expect(() => advanceMotion(m, NaN)).toThrow(); });
    it('bounds buffers and exports actual samples in declared units', () => {
        expect(appendBounded([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
        const csv = samplesCsv([recordSample(robot, [Math.PI / 2, 0], 500)]);
        expect(csv).toContain('elapsed_s,theta1_deg,theta2_deg,x_mm,y_mm');
        expect(csv).toContain('0.500000,90.000000,0.000000,0.000000,250.000000');
    });
});
