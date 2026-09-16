import { useEffect, useRef, useState } from 'react';
import { parseFiniteInput } from '../core/kinematics';
type Props = {
    label: string;
    value: number;
    onValue: (value: number) => void;
    onValidity?: (valid: boolean) => void;
    min: number;
    max: number;
    unit?: string;
    step?: number;
    disabled?: boolean;
    precision?: number;
};
export function NumberField({ label, value, onValue, onValidity, min, max, unit = '', step = 0.1, disabled, precision = 2 }: Props) {
    const [text, setText] = useState(value.toFixed(precision)), [edited, setEdited] = useState(false);
    const focus = useRef(false);
    const validityCallback = useRef(onValidity);
    validityCallback.current = onValidity;
    useEffect(() => { if (!focus.current) {
        setText(value.toFixed(precision));
        setEdited(false);
        validityCallback.current?.(true);
    } }, [value, precision]);
    const n = parseFiniteInput(text), invalid = edited && (n === null || n < min || n > max);
    return <label className="number-field"><span>{label}</span><div className={`input-unit ${invalid ? 'input-error' : ''}`}><input aria-label={label} aria-invalid={invalid} type="number" step={step} min={min} max={max} disabled={disabled} value={text} onFocus={() => { focus.current = true; }} onBlur={() => { focus.current = false; }} onChange={e => { const next = e.target.value; setText(next); setEdited(true); const numeric = parseFiniteInput(next); const valid = numeric !== null && numeric >= min && numeric <= max; onValidity?.(valid); if (valid)
        onValue(numeric!); }}/><span>{unit}</span></div>{invalid && <small className="field-error">Enter {min} to {max}.</small>}</label>;
}
