import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Button, FileButton, DataTable, Empty, Meter, Modal, Note, PageHead, Row, Select, Stat, Steps, SubHead, Table, Tabs, ThemeToggle } from './index';

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

function TabsDemo() {
  const [tab, setTab] = useState<'board' | 'prospects' | 'portal' | 'school' | 'classes'>('board');
  return (
    <>
      <Tabs label="Recruiting sections" value={tab} onChange={setTab} tabs={[
        { value: 'board', label: 'Board', count: 12 }, { value: 'prospects', label: 'Prospects' }, { value: 'portal', label: 'Transfer portal' },
        { value: 'school', label: 'My school' }, { value: 'classes', label: 'Top classes' },
      ]} />
      <p>The open section: {tab}.</p>
    </>
  );
}
/** The sections of a hub page; a count is optional. */
export const TabsRow: Story = { render: () => <TabsDemo /> };

/** Shares from 0 to 1: a prospect's top schools, the user's school in its team color. */
export const Meters: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 32px', gap: '8px 12px', alignItems: 'center', maxWidth: 420 }}>
      <b>Texas State</b><Meter value={0.78} label="Interest in Texas State" color="#501214" /><span>78</span>
      <span>Houston</span><Meter value={0.66} label="Interest in Houston" /><span>66</span>
      <span>UTSA</span><Meter value={0.58} label="Interest in UTSA" /><span>58</span>
    </div>
  ),
};

/** A process in order: steps before the current one are done; a step with a link can be jumped to. On a phone only the current step shows. */
export const StepsBar: Story = {
  render: () => (
    <Steps label="Offseason steps" current={2} steps={[
      { label: 'Projected depth chart' }, { label: 'Players leaving' }, { label: 'Recruiting' }, { label: 'Signing day and cuts' },
      { label: 'Training results' }, { label: 'Depth chart', href: '#depth' }, { label: 'Schedule', href: '#schedule' }, { label: 'Download the ROM', href: '#rom' },
    ]} />
  ),
};
