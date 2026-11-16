import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import './season.css';
import { SimSettingsBox } from './SimSettingsBox';
import { SIM_DEFAULTS, type SimSettings } from '../../core/simSettings';

const meta: Meta = { title: 'Season sim settings' };
export default meta;
type Story = StoryObj;

function Live({ start }: { start: SimSettings }) {
  const [v, setV] = useState(start);
  return <SimSettingsBox value={v} loaded={start} onChange={setV} />;
}

/** As loaded from a ROM (the defaults). Change a value to see its "changed" mark and the reset link. */
export const Defaults: Story = { render: () => <Live start={SIM_DEFAULTS} /> };
/** A dynasty with its own settings (the reset link shows). */
export const Changed: Story = { render: () => <Live start={{ weight: 12, chances: 9, roll: 900 }} /> };
