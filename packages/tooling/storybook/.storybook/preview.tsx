import '@bangle.io/browser-entry/src/default-theme.processed.css';
import { t } from '@bangle.io/translations';
import type { Decorator, Preview } from '@storybook/react';
import React, { useLayoutEffect } from 'react';

(window as any).t = t;
// import { IS_STORYBOOK } from '@bangle.io/config';
// import { WIDESCREEN_WIDTH } from '@bangle.io/constants';

// if (! ) {
//   throw new Error('This file should only be used in storybook');
// }

const WIDESCREEN_WIDTH = 1024;

function checkWidescreen(): boolean {
  const currentWidth = window.innerWidth;
  return currentWidth >= WIDESCREEN_WIDTH;
}

const WithThemeProvider: Decorator = (Story, context) => {
  const theme = context.globals.themeSwitcher;

  useLayoutEffect(() => {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const el = document.firstElementChild!;
    el.classList.remove('BU_widescreen', 'BU_smallscreen');
    el.classList.add(checkWidescreen() ? 'BU_widescreen' : 'BU_smallscreen');
    if (theme === 'light') {
      el.classList.remove('BU_dark-scheme');
      el.classList.add('BU_light-scheme');
    } else {
      el.classList.add('BU_dark-scheme');
      el.classList.remove('BU_light-scheme');
    }
  }, [theme]);

  return <Story />;
};

const preview: Preview = {
  decorators: [WithThemeProvider],
  globalTypes: {
    themeSwitcher: {
      description: 'Global theme switcher',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    // see test-utils where this is used to set the NsmStore
    nsmContextKey: {
      nsmContextKey: 'used for getting the store from the context',
    },
    viewport: {
      viewports: {
        smallscreen: {
          name: 'smallscreen',
          styles: {
            height: '844px',
            width: '390px',
          },
          type: 'mobile',
        },
        ipad: {
          name: 'iPad',
          styles: {
            height: '1024px',
            width: '768px',
          },
          type: 'tablet',
        },
        responsive: {
          name: 'responsive',
          type: 'desktop',
          styles: {
            width: '100%',
            height: '100%',
            border: 0,
            margin: 0,
            boxShadow: 'none',
            borderRadius: 0,
            position: 'absolute',
          },
        },
      },
      defaultViewport: 'responsive',
    },
  },
};

export default preview;
