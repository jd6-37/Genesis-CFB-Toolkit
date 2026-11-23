import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { AppBar, Button, MenuDrawer, PageHead, StepNav, Tabs, ThemeToggle } from './index';

// The app shell for handhelds, tablets and phones (shell.tsx). Pick "Odin 2 Portal" or "Retroid Pocket Nova" in the
// toolbar's viewport menu: from 960 px the AppBar lists the pages, below it shows the open page's name; on a
// desktop (1200 × 700 and up) apps show their Masthead instead.
const meta: Meta = { title: 'Shell', parameters: { viewport: { defaultViewport: 'portal' } } };
export default meta;
type Story = StoryObj;

const PAGES = ['Home', 'Scores', 'Standings', 'Top 25', 'Teams', 'Rosters', 'Coaches', 'Stats', 'History', 'Offseason', 'Manage'];
const items = (cur: string) => PAGES.map((p) => ({ label: p, href: `#${p.toLowerCase()}`, current: p === cur }));
const Mark = () => <span style={{ display: 'inline-block', width: 28, height: 28, background: 'var(--accent)' }} aria-label="Your team" />;

/** The top row: menu button, the pages (or the open page's name below 960 px), the user's team. */
export const AppBarStory: Story = {
  name: 'AppBar',
  render: () => <div style={{ margin: -24 }}><AppBar label="Dynasty" items={items('Standings')} page="Standings" onMenu={() => {}} right={<Mark />} /></div>,
};

/** The app menu (the AppBar's button, or Start on a controller). */
export const Menu: Story = {
  render: () => {
    const [dark, setDark] = useState(false);
    return (
      <MenuDrawer
        title="Longhorn Years" sub="2027, week 9" onClose={() => {}}
        items={items('Home').map((x) => (x.label === 'Offseason' ? { ...x, note: 'After week 15' } : x))}
        footer={<><ThemeToggle dark={dark} onChange={setDark} /><a href="#toolkit">Mod Toolkit</a><a href="#site">BW95 Elevated</a></>}
      />
    );
  },
};

/** A process one step at a time: the steps before and after (L2 / R2), the open one, a pip per step. */
export const Steps: Story = {
  render: () => (
    <StepNav
      label="Offseason steps" current={3} sub="week 1 of 5"
      steps={['Coaching carousel', 'Projected depth chart', 'Players leaving', 'Recruiting', 'Signing day and cuts', 'Training', 'Training results', 'Edit players', 'Depth chart', 'Impact players', 'Conferences', 'Schedule', 'Walsh Reports', 'Download the ROM'].map((l) => ({ label: l, href: '#' }))}
    />
  ),
};

/** A page as it sits under the AppBar: the plain page heading (a framed title box on desktops), its tabs. */
export const PageWithTabs: Story = {
  render: () => {
    const [tab, setTab] = useState('sec');
    return (
      <div style={{ margin: -24 }}>
        <AppBar label="Dynasty" items={items('Standings')} page="Standings" onMenu={() => {}} right={<Mark />} />
        <div style={{ padding: '0 12px' }}>
          <PageHead title="Standings" actions={<Button variant="quiet">Sort</Button>} />
          <Tabs label="Conferences" value={tab} onChange={setTab} tabs={[{ value: 'sec', label: 'SEC' }, { value: 'b10', label: 'Big Ten' }, { value: 'acc', label: 'ACC' }, { value: 'b12', label: 'Big 12' }]} />
        </div>
      </div>
    );
  },
};
