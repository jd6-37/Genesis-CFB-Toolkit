// Every story is shown inside a brand and theme wrapper, switched from the toolbar, so each component can be
// checked as the Mod Toolkit and as Dynasty (light and dark).
import type { Preview } from '@storybook/react';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource/barlow-condensed/900.css';
import '@fontsource/jersey-15/400.css';
import '../src/ui/tokens.css';
import '../src/ui/ui.css';

const preview: Preview = {
  globalTypes: {
    brand: {
      description: 'Brand',
      toolbar: { title: 'Brand', icon: 'paintbrush', items: [{ value: 'dynasty', title: 'Dynasty' }, { value: 'toolkit', title: 'Mod Toolkit' }], dynamicTitle: true },
    },
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', icon: 'contrast', items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }], dynamicTitle: true },
    },
  },
  initialGlobals: { brand: 'dynasty', theme: 'light' },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, ctx) => (
      <div
        data-brand={ctx.globals.brand}
        data-theme={ctx.globals.theme}
        style={{ background: 'var(--surface)', color: 'var(--text)', font: '400 16px/1.5 var(--font-body)', padding: 24, minHeight: '100vh', boxSizing: 'border-box' }}
      >
        <Story />
      </div>
    ),
  ],
};
export default preview;
