import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = { title: 'Tokens' };
export default meta;

const COLORS = ['surface', 'surface-raised', 'surface-sunken', 'text', 'text-muted', 'rule', 'rule-strong', 'accent', 'on-accent', 'field', 'highlight', 'good', 'good-wash', 'bad', 'bad-wash'];
const SIZES = [1, 2, 3, 4, 5, 6, 7];

export const Colors: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {COLORS.map((c) => (
        <div key={c}>
          <div style={{ height: 56, background: `var(--${c})`, border: '1px solid var(--rule)' }} />
          <code style={{ fontSize: 12 }}>--{c}</code>
        </div>
      ))}
    </div>
  ),
};

export const Type: StoryObj = {
  render: () => (
    <div>
      {SIZES.slice().reverse().map((n) => (
        <p key={n} style={{ margin: '0 0 12px', font: n >= 5 ? `700 var(--fs-${n})/1.1 var(--font-display)` : `400 var(--fs-${n})/1.4 var(--font-body)` }}>
          --fs-{n}: Texas State beats UTSA 42-14
        </p>
      ))}
    </div>
  ),
};

export const Spacing: StoryObj = {
  render: () => (
    <div>
      {SIZES.map((n) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: `var(--sp-${n})`, height: 16, background: 'var(--accent)' }} />
          <code style={{ fontSize: 12 }}>--sp-{n}</code>
        </div>
      ))}
    </div>
  ),
};
