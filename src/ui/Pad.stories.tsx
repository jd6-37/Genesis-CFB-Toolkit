import type { Meta, StoryObj } from '@storybook/react';
import { DEFAULT_MAP, defaultSettings, type PadLabels } from '../core/pad';
import { PadBar, PadKey } from './pad';
import { Button, Row } from './index';

const meta: Meta = { title: 'Controller' };
export default meta;
type Story = StoryObj;

/** The buttons as the hints draw them, in the three label sets. */
export const Keys: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {(['xbox', 'playstation', 'nintendo'] as PadLabels[]).map((l) => (
        <Row key={l}>{['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b9', 'b14', 'b15', 'a3+'].map((b) => <PadKey key={b} binding={b} labels={l} />)}</Row>
      ))}
    </div>
  ),
};

/** The user's own names (Manage › Controller): a Genesis pad whose Z, Y and X reach the app as L1, R1 and L2. */
export const OwnNames: Story = {
  render: () => {
    const names = { b4: 'Z', b5: 'Y', b6: 'X', b2: 'C' };
    return <Row>{['b0', 'b1', 'b2', 'b4', 'b5', 'b6'].map((b) => <PadKey key={b} binding={b} names={names} />)}</Row>;
  },
};

/** The hint bar (fixed to the bottom of the window). */
export const HintBar: Story = {
  render: () => (
    <PadBar
      map={DEFAULT_MAP} settings={defaultSettings()}
      hints={[{ action: 'confirm', text: 'Choose' }, { action: 'back', text: 'Back' }, { action: 'primary', text: 'Make the offer' }, { action: 'adjust', text: 'Change' }, { action: 'tabs', text: 'Tabs' }]}
    />
  ),
};

/** The focus frame while a controller is in use (the story sets data-input="pad" on the document). */
export const FocusFrame: Story = {
  render: () => {
    document.documentElement.dataset.input = 'pad';
    return <Row><Button>Import save</Button><Button variant="quiet">Later</Button></Row>;
  },
  play: async ({ canvasElement }) => { (canvasElement.querySelector('button') as HTMLButtonElement)?.focus(); },
};
