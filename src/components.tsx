import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fromLevels, toCss, toHex4, toLevels, UNIFORM_FIELDS } from './core/colors';
import { Picture } from './core/render';

export function SpriteCanvas({ pic, scale = 2, label }: { pic: Picture | null; scale?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !pic) return;
    c.width = pic.width;
    c.height = pic.height;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pic.data), pic.width, pic.height), 0, 0);
  }, [pic]);
  if (!pic) return <span className="sprite sprite-empty" />;
  return (
    <canvas
      ref={ref}
      className="sprite"
      role="img"
      aria-label={label}
      style={{ width: pic.width * scale, height: pic.height * scale }}
    />
  );
}

/** A quick choice at the top of the picker (the team's own colors; user, 2026-11-18). */
export interface PickerColor { color: number; label: string; /** A heading of its own (e.g. the game's black and white); else "Team colors". */ group?: string }
/** A "none" choice (no stripe: user, 2026-11-18): picking it is the caller's to handle. */
export interface PickerNone { label: string; on: boolean; pick: () => void }

/** Genesis colors: the team's colors and a "none" choice first when given, then a blue level and red x green. 512 colors in all. */
export function ColorPicker({ value, onPick, onClose, top, none }: { value: number; onPick: (c: number) => void; onClose: () => void; top?: PickerColor[]; none?: PickerNone }) {
  const [r0, g0, b0] = toLevels(value);
  const [blue, setBlue] = useState(b0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return (
    <div className="picker" ref={ref} role="dialog" aria-label="Pick a Genesis color">
      {none && (
        <button type="button" className={`picker-none${none.on ? ' on' : ''}`} onClick={() => { none.pick(); onClose(); }} aria-pressed={none.on}>
          {none.label}
        </button>
      )}
      {top && top.length > 0 && (
        <div className="picker-top">
          {[...new Set(top.map((t) => t.group ?? 'Team colors'))].map((g) => (
            <div key={g}>
              <p className="picker-head">{g}</p>
              <div className="picker-team">
                {top.filter((t) => (t.group ?? 'Team colors') === g).map((t) => (
                  <button
                    key={t.color}
                    className={t.color === value && !none?.on ? 'on' : ''}
                    style={{ background: toCss(t.color) }}
                    onClick={() => { onPick(t.color); onClose(); }}
                    aria-label={`${t.label}: color ${toHex4(t.color)}`}
                    title={`${t.label} (${toHex4(t.color)})`}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="picker-head">All colors</p>
        </div>
      )}
      <div className="picker-blue" role="radiogroup" aria-label="Blue level">
        {Array.from({ length: 8 }, (_, b) => (
          <button
            key={b}
            role="radio"
            aria-checked={b === blue}
            className={b === blue ? 'on' : ''}
            style={{ background: toCss(fromLevels(0, 0, b)) }}
            onClick={() => setBlue(b)}
            title={`Blue ${b}`}
          />
        ))}
      </div>
      <div className="picker-grid">
        {Array.from({ length: 8 }, (_, g) =>
          Array.from({ length: 8 }, (_, r) => {
            const c = fromLevels(r, 7 - g, blue);
            const on = r === r0 && 7 - g === g0 && blue === b0;
            return (
              <button
                key={`${r}${g}`}
                className={on ? 'on' : ''}
                style={{ background: toCss(c) }}
                onClick={() => {
                  onPick(c);
                  onClose();
                }}
                aria-label={`Color ${toHex4(c)}`}
                title={toHex4(c)}
              />
            );
          }),
        )}
      </div>
      <p className="picker-note">
        Color {toHex4(value)}. Choose a blue level, then a color.
      </p>
    </div>
  );
}

export function Swatch({ color, label, onPick, startOpen = false, top, none }: {
  color: number; label: string; onPick: (c: number) => void; /** Opens with the picker showing. */ startOpen?: boolean;
  top?: PickerColor[]; none?: PickerNone;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <span className="swatch-wrap">
      <button
        className={`swatch${none?.on ? ' swatch-none' : ''}`}
        style={{ background: none?.on ? undefined : toCss(color) }}
        onClick={() => setOpen((o) => !o)}
        aria-label={`${label}: ${none?.on ? none.label : toHex4(color)}. Change color`}
        aria-expanded={open}
        title={`${label} ${toHex4(color)}`}
      />
      {open && <ColorPicker value={color} onPick={onPick} onClose={() => setOpen(false)} top={top} none={none} />}
    </span>
  );
}

/** A small player figure in the uniform's colors. */
export function UniformChip({ u, label }: { u: number[]; label: string }) {
  const c = (i: number) => toCss(u[i]);
  return (
    <svg className="chip" viewBox="0 0 40 64" role="img" aria-label={label}>
      <path d="M12 12a8 8 0 0 1 16 0v4H12z" fill={c(5)} />
      <rect x="12" y="13" width="16" height="2" fill={c(6)} />
      <path d="M6 20l8-4h12l8 4-3 10h-3v12H12V30H9z" fill={c(11)} />
      <path d="M6 20l8-4v14H9zM34 20l-8-4v14h5z" fill={c(10)} />
      <rect x="12" y="38" width="16" height="2" fill={c(7)} />
      <text x="20" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill={c(9)}>
        95
      </text>
      <path d="M12 42h16l-1 16h-6l-1-10-1 10h-6z" fill={c(14)} />
      <rect x="12" y="42" width="16" height="2" fill={c(13)} />
    </svg>
  );
}

export function UniformEditor({ title, u, onChange }: { title: string; u: number[]; onChange: (u: number[]) => void }) {
  return (
    <fieldset className="uniform">
      <legend>{title}</legend>
      <UniformChip u={u} label={`${title} uniform preview`} />
      <dl>
        {UNIFORM_FIELDS.map((f) => (
          <div key={f.key} className="field-row">
            <dt>{f.label}</dt>
            <dd>
              {f.idx.map((i, k) => (
                <Swatch
                  key={i}
                  color={u[i]}
                  label={`${title} ${f.label.toLowerCase()}${f.idx.length > 1 ? ` shade ${k + 1}` : ''}`}
                  onPick={(c) => {
                    const n = u.slice();
                    n[i] = c;
                    onChange(n);
                  }}
                />
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </fieldset>
  );
}
