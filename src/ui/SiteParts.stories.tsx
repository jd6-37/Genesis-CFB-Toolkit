import type { Meta, StoryObj } from '@storybook/react';
import { Button, Glyph, Keys, Row, Screen, SetupList, Tag } from './index';

const meta: Meta = { title: 'Components/Site parts' };
export default meta;
type Story = StoryObj;

/** The site's one loud action (Mod Toolkit brand), beside a quiet one. */
export const ChromeButton: Story = {
  render: () => (
    <Row>
      <Button variant="chrome" href="#patch">Patch your ROM</Button>
      <Button variant="quiet" href="#features">See what's new</Button>
    </Row>
  ),
};

/** Controller buttons in a sentence and in a row. */
export const Glyphs: Story = {
  render: () => (
    <>
      <p>Press <Glyph k="A" />, then <Glyph k="X" /> to flip the play at the line. <Glyph k="START" /> pauses.</p>
      <Row>{(['A', 'B', 'C', 'X', 'Y', 'Z', 'START', 'MODE', 'dpad', 'up', 'down', 'left', 'right'] as const).map((k) => <Glyph key={k} k={k} />)}</Row>
    </>
  ),
};

/** A control's buttons: a comma between presses one after another, a slash between choices. */
export const KeysInARow: Story = {
  render: () => (
    <>
      <p><Keys keys={['A', ',', 'X']} /> Flip the play at the line</p>
      <p><Keys keys={['X', '/', 'Z', '/', 'Y']} /> Pick the line, linebackers or safeties to shift</p>
      <p><Keys keys={['up', '/', 'down']} /> Pick a motion man</p>
    </>
  ),
};

export const Tags: Story = {
  render: () => (
    <Row>
      <Tag tone="accent">Elevated</Tag>
      <Tag tone="ink">6-button</Tag>
      <Tag>Game logic</Tag>
    </Row>
  ),
};

/** A screenshot, a clip (it plays once it's on screen), and a wide picture that isn't the game's 4:3. */
export const Screens: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 32, maxWidth: 640 }}>
      <Screen src="/media/title-2026.png" alt="The 2026 Season Edition title screen" caption="The 2026 Season Edition title screen." />
      <Screen src="/media/swap.png" video="/media/swap.mp4" alt="SWAP HBS turns yellow" />
      <Screen wide src="/media/share.png" alt="Both title screens" />
    </div>
  ),
};

/** Game Setup rows: a label and a value, every other row on a bar. */
export const Setup: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <SetupList label="2026 Season Edition" rows={[['Teams', '138: every FBS team of 2026'], ['Conferences', 'The 2026 conferences'], ['Postseason', 'Title games, then CFP 12, CFP 24, CFP 4 or BCS 2']]} />
    </div>
  ),
};
