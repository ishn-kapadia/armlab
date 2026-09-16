import { useEffect, useRef, useState } from 'react';
import { applyGeometry, solveTarget } from './core/commands';
import { DEFAULT_POSE, DEFAULT_ROBOT, branchPose, clamp, distance, forward, inverse, poseValid, type Branch, type Point, type Pose, type Robot } from './core/kinematics';
import { MAX_SAMPLES, MAX_TRAIL, advanceMotion, appendBounded, createMotion, motionSample, pauseMotion, recordSample, resumeMotion, stopMotion, type Motion, type Sample } from './core/motion';
import { demoSession, type Session, type Waypoint } from './core/session';
export type SimState = {
    robot: Robot;
    pose: Pose;
    target: Point;
    branch: Branch;
    duration: number;
    waypoints: Waypoint[];
    motion: Motion | null;
    runId: number;
    trail: Point[];
    recording: Sample[];
    notice: string;
    revision: number;
};
const initial = (): SimState => ({ robot: structuredClone(DEFAULT_ROBOT), pose: [...DEFAULT_POSE], target: forward(DEFAULT_ROBOT, DEFAULT_POSE).tip, branch: 'positive', duration: 2, waypoints: [], motion: null, runId: 0, trail: [], recording: [], notice: '', revision: 0 });
export function useSimulator() {
    const [state, setState] = useState<SimState>(initial);
    const ref = useRef(state);
    const commit = (next: SimState) => { ref.current = next; setState(next); };
    const withTrail = (s: SimState, pose: Pose): Point[] => {
        const tip = forward(s.robot, pose).tip;
        return !s.trail.length || distance(s.trail[s.trail.length - 1], tip) > 0.05 ? appendBounded(s.trail, tip, MAX_TRAIL) : s.trail;
    };
    // One requestAnimationFrame owner. New runs and status changes clean up the previous owner.
    useEffect(() => {
        if (state.motion?.status !== 'running')
            return;
        let id = 0, last = performance.now();
        const tick = (now: number) => {
            const s = ref.current;
            if (s.motion?.status !== 'running')
                return;
            const motion = advanceMotion(s.motion, Math.max(0, now - last));
            last = now;
            const { pose, segment } = motionSample(motion);
            const target = forward(s.robot, motion.poses[segment + 1]).tip;
            const previous = s.recording[s.recording.length - 1];
            const recording = !previous || motion.elapsedMs - previous.elapsedMs >= 50 || motion.status === 'complete' ? appendBounded(s.recording, recordSample(s.robot, pose, motion.elapsedMs), MAX_SAMPLES) : s.recording;
            const goalB = motion.poses[segment + 1][1];
            const branch = Math.abs(Math.sin(goalB)) < 1e-9 ? s.branch : Math.sin(goalB) > 0 ? 'positive' : 'negative';
            commit({ ...s, motion, pose, target, branch, recording, trail: withTrail(s, pose) });
            if (motion.status === 'running')
                id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [state.runId, state.motion?.status]); // ref supplies the latest geometry and pose without starting extra loops.
    useEffect(() => {
        const hidden = () => { const s = ref.current; if (document.hidden && s.motion?.status === 'running')
            commit({ ...s, motion: pauseMotion(s.motion), notice: 'Playback paused because the tab was hidden. Resume when ready.' }); };
        document.addEventListener('visibilitychange', hidden);
        return () => document.removeEventListener('visibilitychange', hidden);
    }, []);
    const manual = (pose: Pose) => {
        const s = ref.current;
        if (!poseValid(pose, s.robot))
            return;
        const branch = Math.abs(Math.sin(pose[1])) < 1e-9 ? s.branch : Math.sin(pose[1]) > 0 ? 'positive' : 'negative';
        commit({ ...s, pose, branch, target: forward(s.robot, pose).tip, motion: null, trail: withTrail(s, pose), notice: '' });
    };
    const targetCommand = (target: Point, live: boolean, branch = ref.current.branch) => {
        target = { x: clamp(target.x, -100000, 100000), y: clamp(target.y, -100000, 100000) };
        const s = ref.current;
        const result = live ? solveTarget(s.robot, s.pose, target, branch) : { pose: s.pose, error: null };
        commit({ ...s, target, branch, pose: result.pose, motion: null, trail: live ? withTrail(s, result.pose) : s.trail, notice: result.error ?? '' });
    };
    const start = (destinations: Pose[]) => {
        const s = ref.current;
        try {
            const motion = createMotion(s.robot, s.pose, destinations, s.duration);
            commit({ ...s, motion, runId: s.runId + 1, target: forward(s.robot, destinations[0]).tip, recording: [recordSample(s.robot, s.pose, 0)], notice: '' });
        }
        catch (e) {
            commit({ ...s, notice: (e as Error).message });
        }
    };
    const animateTarget = () => {
        const s = ref.current, result = inverse(s.robot, s.target, s.pose), pose = branchPose(result, s.branch);
        if (pose)
            start([pose]);
        else
            commit({ ...s, notice: result.ok ? 'The selected branch is excluded by joint limits.' : result.message });
    };
    const togglePause = () => { const s = ref.current; if (s.motion)
        commit({ ...s, motion: s.motion.status === 'paused' ? resumeMotion(s.motion) : pauseMotion(s.motion), notice: '' }); };
    const stop = () => { const s = ref.current; if (s.motion) {
        const recording = appendBounded(s.recording, recordSample(s.robot, s.pose, s.motion.elapsedMs), MAX_SAMPLES);
        commit({ ...s, motion: stopMotion(s.motion), recording, notice: 'Motion stopped at the current pose.' });
    } };
    const settings = (robot: Robot) => {
        const s = ref.current, revised = applyGeometry(robot, s.pose);
        commit({ ...s, robot, ...revised, motion: null, trail: [], recording: [], revision: s.revision + 1, notice: 'Settings applied. Pose revalidated; target moved to the end effector. Stored joint waypoints are retained.' });
    };
    const load = (session: Session, notice = 'Session imported. Playback stopped; trail and recording cleared.') => {
        const s = ref.current;
        commit({ ...s, robot: session.robot, pose: session.pose, target: session.target, branch: session.branch, waypoints: session.waypoints, duration: session.durationSeconds, motion: null, recording: [], trail: [], revision: s.revision + 1, notice });
    };
    return { state, manual, targetCommand, start, animateTarget, togglePause, stop, settings, load,
        reset: () => { const s = ref.current; commit({ ...initial(), revision: s.revision + 1, runId: s.runId + 1, notice: 'Default robot restored. Waypoints, trail, and recording cleared.' }); },
        demo: () => load(demoSession(), 'Four-pose demo loaded with default geometry. Press Play sequence.'),
        duration: (duration: number) => { const s = ref.current; commit({ ...s, duration }); },
        waypoints: (waypoints: Waypoint[]) => { const s = ref.current; commit({ ...s, waypoints }); },
        clearTrail: () => { const s = ref.current; commit({ ...s, trail: [] }); },
        notify: (notice: string) => { const s = ref.current; commit({ ...s, notice }); },
        exportSession: (): Session => { const s = ref.current; return { format: 'armlab', version: 1, units: { length: 'mm', angle: 'rad' }, robot: s.robot, pose: s.pose, target: s.target, branch: s.branch, waypoints: s.waypoints, durationSeconds: s.duration }; }
    };
}
