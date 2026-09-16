import { DEFAULT_ROBOT, forward, poseValid, radians, robotError, type Branch, type Point, type Pose, type Robot } from './kinematics';
export type Waypoint = {
    id: string;
    name: string;
    pose: Pose;
};
export type Session = {
    format: 'armlab';
    version: 1;
    units: {
        length: 'mm';
        angle: 'rad';
    };
    robot: Robot;
    pose: Pose;
    target: Point;
    branch: Branch;
    durationSeconds: number;
    waypoints: Waypoint[];
};
export const MAX_WAYPOINTS = 64;
export const MAX_FILE_BYTES = 256 * 1024;
export function demoWaypoints(): Waypoint[] {
    return [['Approach', 35, 65], ['Pick position', -15, 65], ['Transfer', 100, 55], ['Place position', 150, 45]].map(([name, a, b], i) => ({ id: `demo-${i}`, name: String(name), pose: [radians(Number(a)), radians(Number(b))] }));
}
export function demoSession(): Session {
    const waypoints = demoWaypoints(), pose = waypoints[0].pose;
    return { format: 'armlab', version: 1, units: { length: 'mm', angle: 'rad' }, robot: structuredClone(DEFAULT_ROBOT), pose, target: forward(DEFAULT_ROBOT, pose).tip, branch: 'positive', durationSeconds: 2, waypoints };
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function readPose(value: unknown, label: string): Pose {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(number))
        throw new Error(`${label} must contain exactly two finite joint angles in radians.`);
    return [value[0], value[1]];
}
export function parseSession(text: string): Session {
    if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
        throw new Error('Session file exceeds 256 KB.');
    let data: unknown;
    try {
        data = JSON.parse(text);
    }
    catch {
        throw new Error('The file is not valid JSON.');
    }
    if (!object(data) || data.format !== 'armlab' || data.version !== 1)
        throw new Error('Expected an ArmLab session with format "armlab" and version 1.');
    if (!object(data.units) || data.units.length !== 'mm' || data.units.angle !== 'rad')
        throw new Error('Version 1 requires millimetres (mm) and radians (rad).');
    if (!object(data.robot) || !number(data.robot.l1) || !number(data.robot.l2) || !Array.isArray(data.robot.limits) || data.robot.limits.length !== 2)
        throw new Error('Robot settings must include two link lengths and two joint limits.');
    const limits = data.robot.limits.map(v => { if (!object(v) || !number(v.min) || !number(v.max))
        throw new Error('Each joint limit needs finite min and max angles.'); return { min: v.min, max: v.max }; }) as Robot['limits'];
    const robot: Robot = { l1: data.robot.l1, l2: data.robot.l2, limits };
    const invalid = robotError(robot);
    if (invalid)
        throw new Error(invalid);
    const pose = readPose(data.pose, 'Current pose');
    if (!poseValid(pose, robot))
        throw new Error('Current pose is outside the imported joint limits.');
    if (!object(data.target) || !number(data.target.x) || !number(data.target.y) || Math.abs(data.target.x) > 100000 || Math.abs(data.target.y) > 100000)
        throw new Error('Target coordinates must be finite and within ±100,000 mm.');
    if (data.branch !== 'positive' && data.branch !== 'negative')
        throw new Error('Branch must be positive or negative.');
    if (!number(data.durationSeconds) || data.durationSeconds < 0.25 || data.durationSeconds > 10)
        throw new Error('Duration must be 0.25–10 seconds per segment.');
    if (!Array.isArray(data.waypoints) || data.waypoints.length > MAX_WAYPOINTS)
        throw new Error('A session can contain at most 64 waypoints.');
    const ids = new Set<string>();
    const waypoints = data.waypoints.map((v, i) => {
        if (!object(v) || typeof v.id !== 'string' || !v.id || v.id.length > 80 || ids.has(v.id))
            throw new Error(`Waypoint ${i + 1} needs a unique ID of 1–80 characters.`);
        if (typeof v.name !== 'string' || !v.name.trim() || v.name.trim().length > 40)
            throw new Error(`Waypoint ${i + 1} needs a name of 1–40 characters.`);
        const waypointPose = readPose(v.pose, `Waypoint ${i + 1}`);
        // Excluded waypoints can be saved after editing limits, but cannot be played.
        if (waypointPose.some(a => Math.abs(a) > 2 * Math.PI))
            throw new Error(`Waypoint ${i + 1} angles must be within ±360°.`);
        ids.add(v.id);
        return { id: v.id, name: v.name.trim(), pose: waypointPose };
    });
    return { format: 'armlab', version: 1, units: { length: 'mm', angle: 'rad' }, robot, pose, target: { x: data.target.x, y: data.target.y }, branch: data.branch, durationSeconds: data.durationSeconds, waypoints };
}
