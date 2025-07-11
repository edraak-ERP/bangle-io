import { IS_STORYBOOK } from '@bangle.io/config';
import { COLOR_SCHEME, WIDESCREEN_WIDTH } from '@bangle.io/constants';

import { isMobile } from '@bangle.io/mini-js-utils';
import { rafSchedule } from './safe-js';

type ColorScheme =
  | (typeof COLOR_SCHEME)['DARK']
  | (typeof COLOR_SCHEME)['LIGHT'];

export function setRootWidescreenClass(
  widescreen: boolean = checkWidescreen(),
) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.getElementById('root');
  const body = document.body;

  if (widescreen) {
    root?.classList.add('BU_widescreen');
    body.classList.add('BU_widescreen');

    root?.classList.remove('BU_smallscreen');
    body.classList.remove('BU_smallscreen');
  } else {
    root?.classList.remove('BU_widescreen');
    body.classList.remove('BU_widescreen');

    root?.classList.add('BU_smallscreen');
    body.classList.add('BU_smallscreen');
  }
}

export function checkWidescreen(
  width = typeof window !== 'undefined' ? window.innerWidth : undefined,
) {
  if (isMobile) {
    return false;
  }

  return width ? WIDESCREEN_WIDTH <= width : false;
}

export function listenToResize(
  onResize: (obj: { width: number; height: number }) => void,
  abortSignal: AbortSignal,
) {
  if (typeof window === 'undefined') {
    return;
  }
  // Handler to call on window resize
  const handleResize = rafSchedule(() => {
    onResize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  });

  // Add event listener
  window.addEventListener('resize', () => {
    handleResize();
  });

  abortSignal.addEventListener(
    'abort',
    () => {
      handleResize.cancel();
      window.removeEventListener('resize', handleResize);
    },
    {
      once: true,
    },
  );
}

export function changeColorScheme(colorScheme: ColorScheme) {
  if (typeof document === 'undefined') {
    console.debug('applyTheme: document is undefined');

    return;
  }

  if (IS_STORYBOOK) {
    console.warn(
      'changeColorScheme: Cannot apply change color scheme in storybook. Please use the switcher in the toolbar.',
    );

    return;
  }

  if (!colorScheme) {
    console.debug('changeColorScheme: colorScheme is undefined');

    return;
  }

  const LIGHT_THEME = 'BU_light-scheme';
  const DARK_THEME = 'BU_dark-scheme';
  const newValue = colorScheme === COLOR_SCHEME.DARK ? DARK_THEME : LIGHT_THEME;
  console.debug('changeColorScheme:', colorScheme);

  document?.firstElementChild?.setAttribute('data-theme', newValue);
  document?.firstElementChild?.classList.remove(LIGHT_THEME, DARK_THEME);
  document?.firstElementChild?.classList.add(newValue);
}
