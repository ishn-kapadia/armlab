import { useEffect, useRef, useState, type ReactNode } from 'react';
import { degrees, parseFiniteInput, radians, robotError, type Robot } from '../core/kinematics';
export function Dialog({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const d = ref.current!; if (!d.open)
        d.showModal(); }, []);
    return <dialog ref={ref} onCancel={onClose} onClose={onClose} aria-label={title}><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}>×</button></div>{children}</dialog>;
}
export function SettingsDialog({ robot, onSave, onClose, onReset }: {
    robot: Robot;
    onSave: (r: Robot) => void;
    onClose: () => void;
    onReset: () => void;
}) {
    const [values, setValues] = useState([String(robot.l1), String(robot.l2), ...robot.limits.flatMap(l => [String(degrees(l.min)), String(degrees(l.max))])]);
    const [error, setError] = useState('');
    const labels = ['Link 1 length', 'Link 2 length', 'Joint 1 minimum', 'Joint 1 maximum', 'Joint 2 minimum', 'Joint 2 maximum'];
    return <Dialog title="Robot settings" onClose={onClose}><form onSubmit={event => { event.preventDefault(); const n = values.map(parseFiniteInput); if (n.some(v => v === null)) {
        setError('Every setting needs a finite number. Empty fields are not zero.');
        return;
    } const [l1, l2, a, b, c, d] = n as number[]; const next: Robot = { l1, l2, limits: [{ min: radians(a), max: radians(b) }, { min: radians(c), max: radians(d) }] }; const message = robotError(next); if (message)
        setError(message);
    else {
        onSave(next);
        onClose();
    } }} noValidate>
    <p>Positive rigid link lengths and inclusive joint intervals. Angles are in degrees.</p><div className="settings-grid">{labels.map((label, i) => <label className="number-field" key={label}><span>{label}</span><div className="input-unit"><input aria-label={label} type="number" step="any" value={values[i]} onChange={e => setValues(v => v.map((x, index) => index === i ? e.target.value : x))}/><span>{i < 2 ? 'mm' : '°'}</span></div></label>)}</div>
    <p className="help-note">Lengths: 0.1–10,000 mm. Limits: −360° to +360°, minimum ≤ maximum. Equal limits lock a joint.</p><p className="help-note">Applying settings stops motion, keeps an equivalent allowed pose when possible, then clamps excluded joints. The target follows the new end effector. Trail and recording clear. Waypoints retain their joint angles; their Cartesian positions change with link lengths.</p>
    {error && <p role="alert" className="error-box">{error}</p>}<div className="dialog-actions"><button type="button" onClick={() => { onReset(); onClose(); }}>Reset all to defaults</button><button className="primary" type="submit">Apply settings</button></div><p className="micro">Reset also clears waypoints, trail, and recording.</p>
  </form></Dialog>;
}
export function HelpDialog({ onClose }: {
    onClose: () => void;
}) {
    return <Dialog title="A quick tour of ArmLab" onClose={onClose}><div className="help-content"><p><strong>Explore the arm.</strong> Move the joint sliders, drag the amber target, or use its x and y fields. Positive rotation is counterclockwise; joint 2 rotates relative to link 1. World y points upward.</p><p><strong>Try both configurations.</strong> The positive and negative elbow branches usually reach the same point. The dashed arm previews the alternative. At an extended or folded pose the branches merge.</p><p><strong>Move smoothly.</strong> Numeric target entry stages a destination. “Solve now” reaches it immediately; “Animate target” moves from the current pose. Dragging solves live. Joint edits, target edits, branch changes, and applied settings stop the current motion. Pause and resume preserve progress. Hiding this tab automatically pauses playback.</p><p><strong>Read the workspace.</strong> Shading shows the geometric annulus, without joint limits. Singularities reduce local Cartesian motion capability; they are not automatically invalid poses. Unreachable targets leave the arm at its last valid pose.</p><p><strong>Build a sequence.</strong> Save joint configurations or load the four-pose demo, then play the sequence. Changing link lengths changes where those configurations place the tip. Excluded waypoints are flagged and cannot play.</p><p><strong>Understand the model.</strong> This is kinematics and trajectory simulation: ideal rigid links, no dynamics, torque, collisions, gripping, payloads, or hardware validation. The pick-and-place preset demonstrates motion only. Cubic joint-space interpolation does not generally make a straight end-effector path.</p><p><strong>Keep your work.</strong> Export JSON for settings, current pose, target, and waypoints. Import replaces the current session. CSV contains actual sampled motion, with active elapsed time excluding pauses. Each run replaces the recording; the last 12,000 samples and 600 trail points are retained. Reloading the page starts fresh.</p><p className="help-note">Keyboard: tab to the target and use arrow keys for 5 mm steps, or Shift + arrow for 1 mm. All target and joint controls also have numeric inputs.</p></div></Dialog>;
}
export function ExportDialog({ content, filename, onClose }: {
    content: string;
    filename: string;
    onClose: () => void;
}) {
    const [url, setUrl] = useState(''), [message, setMessage] = useState('');
    const textArea = useRef<HTMLTextAreaElement>(null);
    const copyText = () => {
        // Keep the complete payload selectable without relying on clipboard permissions.
        textArea.current?.focus();
        textArea.current?.select();
        setMessage('The full text is selected. Press Ctrl+C (or Command+C) to copy it.');
    };
    useEffect(() => { const blob = URL.createObjectURL(new Blob([content], { type: filename.endsWith('.json') ? 'application/json' : 'text/csv' })); setUrl(blob); return () => { setTimeout(() => URL.revokeObjectURL(blob), 30000); }; }, [content, filename]);
    return <Dialog title={filename.endsWith('.json') ? 'Export session JSON' : 'Export motion CSV'} onClose={onClose}><p className="help-note">{filename} · Save the file, or select and copy the complete text if your browser does not support downloads.</p><textarea ref={textArea} className="export-preview" aria-label="Export file contents" readOnly value={content}/><div className="dialog-actions"><button onClick={copyText}>Select all text</button><a className="download-link" href={url} download={filename} onClick={() => setMessage('Download requested. If no file appears, select and copy the text, then save it with the filename above.')}>Download file</a></div>{message && <p className="help-note" role="status">{message}</p>}</Dialog>;
}
