// A team's uniforms on its team page (user, 2026-11-18: "full uniform editing", "all teams's unis editable"): the
// home jersey rule and the extra helmets, jerseys and pants for the picker on the controller screen, any team, any
// time (mid-season too: the save keeps no uniform). The editor is the Toolkit's (KitParts); kit.ts keeps the changes.
import { useMemo, useState } from 'react';
import { SpriteCanvas, UniformChip } from '../../components';
import { renderSprites } from '../../core/render';
import { kitSpriteOf, ownOf, setKit, setOwn, setWhiteHome, kitLock, kitOf, romUniformsOf } from '../../core/dynasty/kit';
import { pieceCutout, withPiece, type KitPart } from '../../core/kits';
import { Button, Note, Row, Select, SubHead } from '../../ui';
import { KitParts } from '../styles/KitParts';
import { useDyn } from './ui';

const ORDER: KitPart[] = ['helmets', 'dark', 'white', 'pants'];

/** A uniform on the game's player sprite (the picker's), or the drawn chip without it. */
function Player({ u, label }: { u: number[]; label: string }) {
  const { d } = useDyn();
  const sprite = useMemo(() => kitSpriteOf(d), [d.romUniforms]); // eslint-disable-line react-hooks/exhaustive-deps
  const pic = useMemo(() => (sprite ? renderSprites(sprite.tiles, u, [sprite.sprites]) : null), [sprite, u.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return pic ? <SpriteCanvas pic={pic} scale={3} label={label} /> : <UniformChip u={u} label={label} />;
}

/** One alternate piece on its own, cut out of the player. */
function Cutout({ pal, part, label }: { pal: number[]; part: KitPart; label: string }) {
  const { d } = useDyn();
  const sprite = useMemo(() => kitSpriteOf(d), [d.romUniforms]); // eslint-disable-line react-hooks/exhaustive-deps
  const pic = useMemo(() => (sprite ? pieceCutout(sprite, pal, part) : null), [sprite, pal.join(), part]); // eslint-disable-line react-hooks/exhaustive-deps
  return pic ? <SpriteCanvas pic={pic} scale={3} label={label} /> : <UniformChip u={pal} label={label} />;
}

export function UniformsBox({ team }: { team: number }) {
  const { d, commit, readOnly, getRom, downloadRom } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!d.whiteHome || kitLock(d)) return null;
  const name = d.teams[team].school;
  const kit = kitOf(d, team);
  const own = ownOf(d, team);
  const names = d.teams.map((t) => t.school);
  const extras = kit ? ORDER.reduce((n, p) => n + kit[p].length, 0) : 0;
  const run = (f: () => Promise<void>) => { setError(null); f().catch((e: Error) => setError(e.message)); };

  // Older dynasties: the ROM's uniforms are read the first time the editor opens.
  const start = () => run(async () => {
    if (!d.romUniforms || !d.romUniforms.sprite) {
      const rom = await getRom?.();
      if (!rom) return;
      const ru = romUniformsOf(rom, d.teams.length);
      if (!ru) throw new Error('This ROM has no alternate uniforms.');
      await commit({ ...d, romUniforms: d.romUniforms ? { ...d.romUniforms, sprite: ru.sprite, room: ru.room } : ru });
    }
    setOpen(true);
  });

  return (
    <section className="dy-uniforms" aria-labelledby={`dy-uni-${team}`}>
      <SubHead id={`dy-uni-${team}`}>Uniforms</SubHead>
      {kit && own && (
        // Home and away as full uniforms, then the alternate pieces on their own by type (user, 2026-11-18, from his
        // sketch: "show the home and away uniforms ... as full kits on a player model. Then show the extra uniform
        // PIECES").
        <div className="dy-uni-sum">
          <figure><figcaption>Home</figcaption><Player u={own.home} label={`${name} home uniform`} /></figure>
          <figure><figcaption>Away</figcaption><Player u={own.away} label={`${name} away uniform`} /></figure>
          {extras > 0 && (
            <div className="dy-uni-alts">
              <span className="dy-uni-altlab" aria-hidden="true">Alternates</span>
              {([['Helmets', ['helmets']], ['Jerseys', ['dark', 'white']], ['Pants', ['pants']]] as [string, KitPart[]][]).map(([title, parts]) => {
                const list = parts.flatMap((p) => kit[p].map((c, i) => ({ p, c, i })));
                return (
                  <figure key={title}>
                    <figcaption>{title}</figcaption>
                    <div className="dy-uni-stack">
                      {list.length ? list.map(({ p, c, i }) => (
                        <Cutout key={`${p}${i}`} pal={withPiece(p === 'white' ? own.away : own.home, p, c)} part={p} label={`${name} extra ${p === 'pants' ? 'pants' : p === 'helmets' ? 'helmet' : `${p} jersey`} ${i + 1}`} />
                      )) : <span className="dy-dim dy-small">None</span>}
                    </div>
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      )}
      <p className="dy-small dy-dim">
        {d.whiteHome[team] ? 'White at home.' : 'Dark at home.'} {extras ? `${extras} extra ${extras === 1 ? 'piece' : 'pieces'} to pick on the controller screen (Y on a 6-button pad).` : 'No extra pieces.'}
        {d.kitEdits?.[team] || d.ownEdits?.[team] ? ' Changed in this dynasty.' : ''}
      </p>
      {!readOnly && !open && <Row><Button variant="quiet" onClick={start}>Edit uniforms</Button></Row>}
      {error && <Note kind="error">{error}</Note>}
      {!readOnly && season.kitsEdited && !d.offseason && (
        <Note>
          {season.index === 0 ? `Your ${season.year} ROM doesn't have these uniforms yet.` : `You changed uniforms after downloading the ${season.year} ROM.`} Download it again to see them in the game; your season goes on.{' '}
          <Button variant="quiet" onClick={() => downloadRom(season.year)}>Download the {season.year} ROM</Button>
        </Note>
      )}
      {!readOnly && open && kit && own && (
        <div className="dy-uni-edit">
          <p className="dy-small">Changes are saved as you make them and go into every ROM you download from now on, mid-season too: the save keeps no uniform, so your season goes on. In the offseason they go into the next season's ROM.</p>
          <Row>
            <Select
              label="Home jersey" value={d.whiteHome[team] ? 'white' : 'dark'}
              options={[{ value: 'dark', label: 'Dark at home' }, { value: 'white', label: 'White at home' }]}
              onChange={(x) => run(() => commit(setWhiteHome(d, team, x === 'white')))}
            />
          </Row>
          <KitParts kit={kit} own={own} sprite={kitSpriteOf(d)} name={name} put={(k) => run(() => commit(setKit(d, team, k, names)))} putOwn={(o) => run(() => commit(setOwn(d, team, o)))} />
          <Row>
            {(d.kitEdits?.[team] || d.ownEdits?.[team]) && <Button variant="quiet" onClick={() => run(() => commit(setKit(setOwn(d, team, d.romUniforms!.own[team]), team, d.romUniforms!.kits[team], names)))}>Back to the ROM's uniforms</Button>}
            <Button variant="quiet" onClick={() => setOpen(false)}>Done</Button>
          </Row>
        </div>
      )}
    </section>
  );
}
