import { describe, expect, it } from 'vitest';
import { demoSession, parseSession } from './session';
import { poseValid } from './kinematics';
describe('versioned session validation', () => {
    it('round trips the immediately usable four-pose demo', () => { const s = demoSession(); expect(parseSession(JSON.stringify(s))).toEqual(s); expect(s.waypoints).toHaveLength(4); s.waypoints.forEach(w => expect(poseValid(w.pose, s.robot)).toBe(true)); });
    it('rejects malformed JSON and oversized files', () => { expect(() => parseSession('{')).toThrow('JSON'); expect(() => parseSession(' '.repeat(262145))).toThrow('256 KB'); });
    it.each(['version', 'units', 'robot', 'pose', 'target', 'branch', 'durationSeconds', 'waypoints'])('rejects a missing %s', field => { const s: Record<string, unknown> = { ...demoSession() }; delete s[field]; expect(() => parseSession(JSON.stringify(s))).toThrow(); });
    it('rejects bad versions, numbers, limits, units, poses, and duplicate IDs', () => {
        const cases = [{ ...demoSession(), version: 2 }, { ...demoSession(), durationSeconds: '2' }, { ...demoSession(), pose: [5, 0] }, { ...demoSession(), units: { length: 'mm', angle: 'deg' } }, { ...demoSession(), robot: { ...demoSession().robot, l1: -1 } }, { ...demoSession(), target: { x: null, y: 0 } }, { ...demoSession(), waypoints: [demoSession().waypoints[0], demoSession().waypoints[0]] }];
        cases.forEach(c => expect(() => parseSession(JSON.stringify(c))).toThrow());
    });
    it('preserves an unreachable target for honest replay', () => { const s = { ...demoSession(), target: { x: 999, y: 0 } }; expect(parseSession(JSON.stringify(s)).target.x).toBe(999); });
    it('retains waypoints excluded by edited limits for later revalidation', () => { const s = demoSession(); s.pose = [0, 0]; s.robot.limits = [{ min: 0, max: 0 }, { min: 0, max: 0 }]; expect(parseSession(JSON.stringify(s)).waypoints).toHaveLength(4); });
    it('rejects empty names, oversized lists, and nonnumeric waypoint angles', () => {
        const s = demoSession();
        s.waypoints[0].name = ' ';
        expect(() => parseSession(JSON.stringify(s))).toThrow('name');
        expect(() => parseSession(JSON.stringify({ ...demoSession(), waypoints: Array(65).fill(demoSession().waypoints[0]) }))).toThrow('64');
        expect(() => parseSession(JSON.stringify({ ...demoSession(), waypoints: [{ id: 'a', name: 'test', pose: ['0', 1] }] }))).toThrow('finite');
    });
});
