import { useEffect, useMemo, ReactNode } from 'react';

// material-ui
import { CacheProvider } from '@emotion/react';
import createCache, { StylisPlugin } from '@emotion/cache';

// third-party
import rtlPlugin from 'stylis-plugin-rtl';

// project-imports
import { ThemeDirection } from 'config';
import useConfig from 'hooks/useConfig';

interface Props {
  children: ReactNode;
}

// ==============================|| RTL LAYOUT ||============================== //

export default function RTLLayout({ children }: Props) {
  const { themeDirection } = useConfig();

  useEffect(() => {
    document.dir = themeDirection;
  }, [themeDirection]);

  // The cache is where every style the app has already written is remembered, so it is made once per direction and
  // not once per render. A fresh one remembers nothing: every `sx` and every styled component in the app has to be
  // serialized and written into the document again, while the style tags the old cache wrote stay in the head for
  // good. Rebuilding it on each render of this component — which is each time anything in the config changes, the
  // language among it — therefore slows the app down a little more every time, until it stops answering.
  const cacheRtl = useMemo(
    () =>
      createCache({
        key: themeDirection === ThemeDirection.RTL ? 'rtl' : 'css',
        prepend: true,
        stylisPlugins: themeDirection === ThemeDirection.RTL ? [rtlPlugin as StylisPlugin] : []
      }),
    [themeDirection]
  );

  return <CacheProvider value={cacheRtl}>{children}</CacheProvider>;
}
