import { useRef, type PointerEvent } from 'react';
import { branchPose, clamp, forward, type Branch, type IKResult, type Point, type Pose, type Robot } from '../core/kinematics';
type Props = {
    robot: Robot;
    pose: Pose;
    target: Point;
    ik: IKResult;
    branch: Branch;
    trail: Point[];
    showReach: boolean;
    showTrail: boolean;
    showLabels: boolean;
    fitRadius: number;
    onTarget: (p: Point) => void;
    invalid: boolean;
};
export function RobotCanvas({ robot, pose, target, ik, branch, trail, showReach, showTrail, showLabels, fitRadius, onTarget, invalid }: Props) {
    const svg = useRef<SVGSVGElement>(null), dragging = useRef(false);
    const scale = 242 / fitRadius, center = { x: 360, y: 294 };
    const screen = (p: Point): Point => ({ x: center.x + p.x * scale, y: center.y - p.y * scale });
    const { elbow, tip } = forward(robot, pose), e = screen(elbow), t = screen(tip), targetScreen = screen(target);
    const tx = clamp(targetScreen.x, 22, 698), ty = clamp(targetScreen.y, 22, 558), offView = tx !== targetScreen.x || ty !== targetScreen.y;
    const other = branchPose(ik, branch === 'positive' ? 'negative' : 'positive');
    const ghost = other && ik.solutions.length > 1 ? forward(robot, other) : null;
    const step = 10 ** Math.floor(Math.log10(fitRadius / 4)) * (fitRadius / 4 / 10 ** Math.floor(Math.log10(fitRadius / 4)) >= 5 ? 5 : fitRadius / 4 / 10 ** Math.floor(Math.log10(fitRadius / 4)) >= 2 ? 2 : 1);
    const ticks = Array.from({ length: 2 * Math.floor(fitRadius * 1.4 / step) + 1 }, (_, i) => (i - Math.floor(fitRadius * 1.4 / step)) * step);
    const move = (event: PointerEvent<SVGSVGElement>) => {
        const matrix = svg.current?.getScreenCTM();
        if (!matrix)
            return;
        const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        onTarget({ x: (p.x - center.x) / scale, y: (center.y - p.y) / scale });
    };
    const points = trail.map(p => { const s = screen(p); return `${s.x},${s.y}`; }).join(' ');
    return <svg ref={svg} className="robot-canvas" viewBox="0 0 720 580" aria-label="Robot workspace. Drag the amber target or click and drag the grid. World y points upward." onPointerDown={event => { if (event.button !== 0)
        return; dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={event => { if (dragging.current)
        move(event); }} onPointerUp={event => { dragging.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { dragging.current = false; }}>
    <defs><radialGradient id="workspace-glow"><stop offset="0" stopColor="#203846" stopOpacity=".45"/><stop offset="1" stopColor="#0c1821" stopOpacity="0"/></radialGradient><mask id="annulus"><rect width="720" height="580" fill="white"/><circle cx={center.x} cy={center.y} r={Math.abs(robot.l1 - robot.l2) * scale} fill="black"/></mask></defs>
    <rect width="720" height="580" fill="url(#workspace-glow)"/>
    {showReach && <g className="reach-region"><circle cx={center.x} cy={center.y} r={(robot.l1 + robot.l2) * scale} fill="#4dc7b4" fillOpacity=".055" mask="url(#annulus)"/><circle cx={center.x} cy={center.y} r={(robot.l1 + robot.l2) * scale} fill="none" stroke="#335651" strokeDasharray="5 7"/><circle cx={center.x} cy={center.y} r={Math.abs(robot.l1 - robot.l2) * scale} fill="none" stroke="#335651" strokeDasharray="3 5"/></g>}
    <g className="grid-lines">{ticks.map(v => <g key={v}><line x1={center.x + v * scale} y1="0" x2={center.x + v * scale} y2="580"/><line x1="0" y1={center.y - v * scale} x2="720" y2={center.y - v * scale}/></g>)}</g>
    <g className="axis-lines"><line x1="20" y1={center.y} x2="700" y2={center.y}/><line x1={center.x} y1="14" x2={center.x} y2="566"/></g>
    {showLabels && <g className="grid-labels">{ticks.filter(v => v !== 0).map(v => <g key={v}><text x={center.x + v * scale} y={center.y + 19} textAnchor="middle">{Number(v.toPrecision(5))}</text><text x={center.x - 10} y={center.y - v * scale + 4} textAnchor="end">{Number(v.toPrecision(5))}</text></g>)}<text x="695" y={center.y - 12} textAnchor="end" className="axis-name">x / mm</text><text x={center.x + 12} y="23" className="axis-name">y / mm</text></g>}
    {showTrail && trail.length > 1 && <polyline points={points} fill="none" stroke="#f0bc6f" strokeWidth="2" strokeOpacity=".55" strokeLinejoin="round"/>}
    {ghost && <g className="ghost-arm"><polyline points={`${center.x},${center.y} ${screen(ghost.elbow).x},${screen(ghost.elbow).y} ${screen(ghost.tip).x},${screen(ghost.tip).y}`}/><circle cx={screen(ghost.elbow).x} cy={screen(ghost.elbow).y} r="6"/></g>}
    <g className="arm"><line className="link-shadow" x1={center.x} y1={center.y + 4} x2={e.x} y2={e.y + 4}/><line className="link-shadow" x1={e.x} y1={e.y + 4} x2={t.x} y2={t.y + 4}/><line className="link link-one" x1={center.x} y1={center.y} x2={e.x} y2={e.y}/><line className="link-highlight" x1={center.x} y1={center.y - 2} x2={e.x} y2={e.y - 2}/><line className="link link-two" x1={e.x} y1={e.y} x2={t.x} y2={t.y}/><circle className="base-outer" cx={center.x} cy={center.y} r="21"/><circle className="joint" cx={center.x} cy={center.y} r="12"/><circle cx={center.x} cy={center.y} r="4" fill="#55d9c1"/><circle className="joint" cx={e.x} cy={e.y} r="11"/><circle cx={e.x} cy={e.y} r="4" fill="#8daffd"/><circle className="tip" cx={t.x} cy={t.y} r="7"/></g>
    {showLabels && <g className="arm-labels"><text x={center.x + 24} y={center.y + 36}>BASE · 0, 0</text><text x={(center.x + e.x) / 2 - 14} y={(center.y + e.y) / 2 - 16} textAnchor="end" fill="#69dfca">L₁ · {robot.l1} mm</text><text x={(e.x + t.x) / 2 + 15} y={(e.y + t.y) / 2} fill="#9abaff">L₂ · {robot.l2} mm</text><text x={e.x + 17} y={e.y + 23}>J₂</text></g>}
    <g className={`target-marker ${invalid ? 'target-invalid' : ''}`} role="slider" aria-label="Draggable Cartesian target" aria-valuetext={`x ${target.x.toFixed(2)} mm, y ${target.y.toFixed(2)} mm. Arrow keys move 5 mm, Shift moves 1 mm.`} tabIndex={0} onKeyDown={event => { const d = event.shiftKey ? 1 : 5, moves: Record<string, Point> = { ArrowUp: { x: 0, y: d }, ArrowDown: { x: 0, y: -d }, ArrowLeft: { x: -d, y: 0 }, ArrowRight: { x: d, y: 0 } }; const delta = moves[event.key]; if (delta) {
        event.preventDefault();
        onTarget({ x: target.x + delta.x, y: target.y + delta.y });
    } }}>
      <circle cx={tx} cy={ty} r="23" fill="transparent" stroke="none"/><circle cx={tx} cy={ty} r="14"/><path d={`M ${tx - 21} ${ty} h 10 M ${tx + 11} ${ty} h 10 M ${tx} ${ty - 21} v 10 M ${tx} ${ty + 11} v 10`}/><circle cx={tx} cy={ty} r="2" className="target-center"/>
      <text x={clamp(tx + 26, 24, 548)} y={clamp(ty - 22, 25, 551)}>{offView ? 'TARGET OFF VIEW' : 'TARGET'}</text>
    </g>
  </svg>;
}
