import type { Meta, StoryObj } from '@storybook/react';
import '../site/site.css';
import { SiteFooter, SiteHeader } from './Site';
import { mdxComponents } from './mdx';

// The site is the Mod Toolkit brand; pick it in the toolbar. The manual parts sit on the Dynasty brand's paper.
const meta: Meta = { title: 'Site', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

export const Header: Story = { render: () => <SiteHeader section="manual" /> };
export const Footer: Story = { render: () => <SiteFooter /> };

const { Controls, Tip, Shot, Edition, Fixed } = mdxComponents as Record<string, (p: any) => JSX.Element>;

/** The manual's parts (src/site/mdx.tsx), on the booklet's paper. */
export const ManualParts: Story = {
  render: () => (
    <div className="manual" data-brand="dynasty" data-theme="light" data-edition="2026" style={{ padding: 24 }}>
      <div className="manual-text">
        <Controls rows={[[['C'], 'Snap the ball'], [['A', 'X'], 'Flip the play at the line', 'new six'], [['up', 'down'], 'Pick a motion man', 'new']]} />
        <Tip>Two long runs in a row will slow your best back down.</Tip>
        <Fixed>In both Elevated editions.</Fixed>
        <Edition only="2026"><p>Text for the 2026 Season Edition only.</p></Edition>
        <Shot src="/media/manual/swap-on.png" alt="A play page" points={[[27, 13, 'SWAP HBS'], [68, 13, 'FLIP PLAY']]} />
      </div>
    </div>
  ),
};
