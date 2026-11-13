// Walsh Report editor: a modal with the team's offense and defense paragraphs, a counter, the checks
// from src/core/walshReports.ts and a preview of the report box as the game wraps it (20 characters
// per line). Used by the Team Swap edit screen and the Teams tab.
import { Button } from '../../ui';
import { useEffect, useId, useRef, useState } from 'react';
import {
  REPORT_CHARS, REPORT_LIMIT, REPORT_WORD, cleanText, reportLength, reportProblems, trimReport, wrapLines, type Report,
} from '../../core/walshReports';
import './walsh.css';

export function WalshEditor({
  team,
  value,
  original,
  originalLabel,
  trims,
  onSave,
  onClose,
}: {
  team: string;
  /** The text to start from (shown form, at most REPORT_LIMIT characters). */
  value: Report;
  /** What Reset puts back (shown form, at most REPORT_LIMIT characters). */
  original: Report;
  originalLabel: string;
  /** Other teams whose longer reports saving will trim (empty: none). */
  trims: string[];
  onSave: (r: Report) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [offense, setOffense] = useState(value.offense);
  const [defense, setDefense] = useState(value.defense);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const r = { offense: offense.trim(), defense: defense.trim() };
  const n = reportLength({ offense, defense });
  const problems = reportProblems(r);
  const isOriginal = r.offense === original.offense.trim() && r.defense === original.defense.trim();
  const lines = [...wrapLines(r.offense), '', ...wrapLines(r.defense)];

  const field = (label: string, v: string, set: (s: string) => void, other: string) => (
    <label className="wr-field">
      <span>{label}</span>
      <textarea
        value={v}
        rows={6}
        maxLength={Math.max(REPORT_LIMIT - other.length, v.length)}
        spellCheck
        onChange={(e) => set(cleanText(e.target.value))}
        aria-invalid={problems.length > 0}
        aria-describedby={`${id}-count`}
      />
    </label>
  );

  return (
    <dialog ref={ref} className="wr" aria-labelledby={`${id}-h`} onClose={onClose} onCancel={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (problems.length) return;
          onSave(r);
          ref.current?.close();
        }}
      >
        <header className="wr-head">
          <h2 id={`${id}-h`}>
            Walsh Report <span>{team}</span>
          </h2>
          <p className="hint">
            Bill Walsh's scouting report before the team's games: up to {REPORT_LIMIT} characters for the offense and the
            defense together, shown {REPORT_WORD} characters to a line.
          </p>
        </header>

        <div className="wr-body">
          <div className="wr-edit">
            {field('Offense', offense, setOffense, defense)}
            {field('Defense', defense, setDefense, offense)}
            <p id={`${id}-count`} className={`wr-count${n > REPORT_LIMIT ? ' wr-over' : ''}`} aria-live="polite">
              {n} of {REPORT_LIMIT} characters
            </p>
            <p className="hint wr-chars">Use {REPORT_CHARS}. Words can be up to {REPORT_WORD} characters.</p>
          </div>
          <figure className="wr-preview">
            <figcaption>In the game</figcaption>
            <div className="wr-box" role="img" aria-label={`Report box preview, ${lines.length} lines`}>
              {lines.map((l, i) => (
                <span key={i} className="wr-line">
                  {l || ' '}
                </span>
              ))}
            </div>
            <p className="hint">The box shows six lines at a time and scrolls.</p>
          </figure>
        </div>

        {problems.length > 0 && (
          <ul className="wr-problems" role="alert">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {trims.length > 0 && (
          <p className="wr-trims" role="note">
            Saving also trims the {trims.length} report{trims.length === 1 ? '' : 's'} longer than {REPORT_LIMIT} characters
            to {REPORT_LIMIT}, dropping their last sentences, so every report fits in the game: {trims.join(', ')}. This
            happens once.
          </p>
        )}

        <footer className="wr-actions">
          <Button variant="quiet"
            disabled={isOriginal}
            onClick={() => {
              setOffense(original.offense);
              setDefense(original.defense);
            }}
          >
            {originalLabel}
          </Button>
          <span className="wr-gap" />
          <Button variant="quiet" onClick={() => ref.current?.close()}>
            Cancel
          </Button>
          <Button type="submit" disabled={problems.length > 0}>
            Save report
          </Button>
        </footer>
      </form>
    </dialog>
  );
}

/** The Walsh Report block in Team Swap's edit screen: the start of the report and an Edit button. */
export function WalshField({
  team,
  value,
  original,
  edited,
  trims,
  onSave,
}: {
  team: string;
  /** The report the build will write (shown form; may be longer than REPORT_LIMIT if not edited). */
  value: Report;
  /** The original team's report with the new names (shown form). */
  original: Report;
  edited: boolean;
  trims: string[];
  onSave: (r: Report) => void;
}) {
  const [open, setOpen] = useState(false);
  const n = reportLength(value);
  return (
    <div className="wr-fieldset">
      <span className="wr-title">
        Walsh Report <small>{edited ? 'edited' : `${n} characters`}</small>
      </span>
      <p className="wr-snippet">{value.offense}</p>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Edit Walsh Report
      </Button>
      {!edited && <p className="hint">The original team's report with the new names.</p>}
      {open && (
        <WalshEditor
          team={team}
          value={n > REPORT_LIMIT ? trimReport(value) : value}
          original={reportLength(original) > REPORT_LIMIT ? trimReport(original) : original}
          originalLabel="Back to the original text"
          trims={trims}
          onSave={onSave}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
