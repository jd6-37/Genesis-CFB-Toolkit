import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  // Screen sizes in the toolbar: the handhelds the Dynasty app is made for (preview.tsx).
  addons: ['@storybook/addon-viewport'],
  core: { disableTelemetry: true },
  // The site's screenshots and clips, for the Screen stories.
  staticDirs: [{ from: '../public/media', to: '/media' }],
};
export default config;
