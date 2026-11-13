import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button, FileButton, DataTable, Empty, Modal, Note, PageHead, Row, Select, Stat, SubHead, Table, ThemeToggle } from './index';

const meta: Meta = { title: 'Components' };
export default meta;
type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <Row>
      <Button>Download the 2027 ROM</Button>
      <Button variant="quiet">Later</Button>
      <Button variant="danger">Release him</Button>
      <Button disabled>Import a save</Button>
      <Button href="#records" variant="quiet">Records book</Button>
    </Row>
  ),
};

/** A file picker (it opens the computer's file window) and a message with a list inside. */
export const FilesAndBlocks: Story = {
  render: () => (
    <>
      <Row><FileButton label="Load season file" accept=".json" onFile={() => {}} /><FileButton variant="quiet" label="Use a .bps file" accept=".bps" multiple onFiles={() => {}} /></Row>
      <Note kind="error" block><p>Two rows can't be used:</p><ul><li>Row 4: no jersey number</li><li>Row 9: unknown team</li></ul></Note>
    </>
  ),
};

export const Notes: Story = {
  render: () => (
    <>
      <Note>The season has started: its schedule is set.</Note>
      <Note kind="ok">Week 2: Texas State plays Texas; Troy plays Rice instead.</Note>
      <Note kind="error">This save's season wasn't started with a ROM from this app.</Note>
    </>
  ),
};

export const PageHeads: Story = {
  render: () => (
    <>
      <PageHead title="Records book" actions={<Select label="School" hideLabel value="" options={[{ value: '', label: 'Whole league' }, { value: 1, label: 'Texas State' }]} onChange={() => {}} />}>
        League records since 2026.
      </PageHead>
      <SubHead>Passing yards in a season</SubHead>
    </>
  ),
};

const rows = [
  { team: 'Texas', conf: '0-0', all: '2-0', pf: 66, pa: 38 },
  { team: 'Texas State', conf: '0-0', all: '1-1', pf: 63, pa: 52 },
  { team: 'Ole Miss', conf: '0-0', all: '2-0', pf: 41, pa: 12 },
];
export const Tables: Story = {
  render: () => (
    <>
      <DataTable
        rows={rows}
        rowKey={(r) => r.team}
        mine={(r) => r.team === 'Texas State'}
        columns={[
          { key: 'team', label: 'Team', left: true, cell: (r) => r.team },
          { key: 'conf', num: true, label: 'Conf', cell: (r) => r.conf },
          { key: 'all', num: true, label: 'Overall', cell: (r) => r.all },
          { key: 'pf', num: true, label: 'PF', cell: (r) => r.pf },
          { key: 'pa', num: true, label: 'PA', cell: (r) => r.pa },
        ]}
      />
      <SubHead>No rows</SubHead>
      <DataTable rows={[]} rowKey={() => 0} columns={[]} empty="No stats yet." />
    </>
  ),
};

export const Stats: Story = {
  render: () => (
    <Row>
      <Stat label="Offense" value={72} />
      <Stat label="Defense" value={60} />
      <Stat label="Speed" value={85} note="50th of 276 HBs" />
    </Row>
  ),
};

function ThemeDemo() {
  const [dark, setDark] = useState(false);
  return <div style={{ background: 'var(--masthead)', padding: 'var(--sp-4)' }}><ThemeToggle dark={dark} onChange={setDark} /></div>;
}
/** The switch only; the Dynasty app sets data-theme from it. */
export const ThemeSwitch: Story = { render: () => <ThemeDemo /> };

/** A hand-written table: a caption, a word column inside figures, and a totals row. */
export const HandTable: Story = {
  render: () => (
    <Table figures>
      <caption>Rushing</caption>
      <thead><tr><th className="ui-left">Season</th><th>Class</th><th>Att</th><th>Yds</th><th>TD</th></tr></thead>
      <tbody>
        <tr><td className="ui-left">2026</td><td className="ui-text">SO</td><td>148</td><td>812</td><td>7</td></tr>
        <tr><td className="ui-left">2027</td><td className="ui-text">JR</td><td>201</td><td>1,204</td><td>12</td></tr>
        <tr className="ui-total"><td className="ui-left" colSpan={2}>Career</td><td>349</td><td>2,016</td><td>19</td></tr>
      </tbody>
    </Table>
  ),
};

export const EmptyState: Story = {
  render: () => <Empty><p>Awards are handed out once a season is over: import the save after the national championship game.</p></Empty>,
};

function ModalDemo() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the window</Button>
      {open && (
        <Modal title="Download the 2027 ROM" onClose={() => setOpen(false)} actions={<><Button onClick={() => setOpen(false)}>Download the 2027 ROM</Button><Button variant="quiet" onClick={() => setOpen(false)}>Later</Button></>}>
          <p>The 2027 season is set up. Download its ROM and start a New Season in the game with it.</p>
        </Modal>
      )}
    </>
  );
}
export const Modals: Story = { render: () => <ModalDemo /> };
