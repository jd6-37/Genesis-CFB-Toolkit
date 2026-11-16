import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import './season.css';
import { SimSettingsBox } from './SimSettingsBox';
import { StatSettingsBox } from './StatSettingsBox';
import { STATS_DEFAULTS, type SimStats } from '../../core/simStats';
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
export const Changed: Story = { render: () => <Live start={{ weight: 12, chances: 9, roll: 1300 }} /> };

function LiveStats({ start }: { start: SimStats }) {
  const [v, setV] = useState(start);
  return <StatSettingsBox value={v} loaded={start} onChange={setV} />;
}
/** The sim stat multipliers as a ROM ships them (×1). */
export const StatsDefaults: Story = { render: () => <LiveStats start={STATS_DEFAULTS} /> };
/** Raised for long games, sacks back down. */
export const StatsChanged: Story = { render: () => <LiveStats start={{ passing: 150, rushing: 150, interceptions: 150, sacks: 80, tackles: 150 }} /> };
