import { branchPose, forward, inverse, revalidatePose, type Branch, type Point, type Pose, type Robot } from './kinematics';
/** An invalid target never changes the last valid pose. */
export function solveTarget(robot: Robot, current: Pose, target: Point, branch: Branch): {
    pose: Pose;
    error: string | null;
} {
    const result = inverse(robot, target, current), pose = branchPose(result, branch);
    return pose ? { pose, error: null } : { pose: current, error: result.ok ? 'This branch is excluded by joint limits. Choose the other branch.' : result.message };
}
/** Settings changes stop motion, revalidate joints, and move the target to the new tip. */
export function applyGeometry(robot: Robot, current: Pose): {
    pose: Pose;
    target: Point;
} {
    const pose = revalidatePose(current, robot);
    return { pose, target: forward(robot, pose).tip };
}
