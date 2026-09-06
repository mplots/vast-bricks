import { ReactNode, useMemo } from 'react';

// material-ui
import { createTheme, ThemeOptions, ThemeProvider, Theme, TypographyVariantsOptions, StyledEngineProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// project-imports
import Palette from './palette';
import Typography from './typography';
import CustomShadows from './shadows';
import componentsOverride from './overrides';

import { HEADER_HEIGHT, ThemeMode } from 'config';
import useConfig from 'hooks/useConfig';
import getWindowScheme from 'utils/getWindowScheme';

// types
import { CustomShadowProps } from 'types/theme';

type ThemeCustomizationProps = {
  children: ReactNode;
};

// ==============================|| DEFAULT THEME - MAIN  ||============================== //

export default function ThemeCustomization({ children }: ThemeCustomizationProps) {
  const { themeDirection, mode, presetColor, fontFamily, themeContrast } = useConfig();
  let themeMode = mode;
  if (themeMode === ThemeMode.AUTO) {
    const autoMode = getWindowScheme();
    if (autoMode) {
      themeMode = ThemeMode.DARK;
    } else {
      themeMode = ThemeMode.LIGHT;
    }
  }

  const theme: Theme = useMemo<Theme>(() => Palette(themeMode, presetColor, themeContrast), [themeMode, presetColor, themeContrast]);

  const themeTypography: TypographyVariantsOptions = useMemo<TypographyVariantsOptions>(
    () => Typography(fontFamily),

    [fontFamily]
  );
  const themeCustomShadows: CustomShadowProps = useMemo<CustomShadowProps>(() => CustomShadows(theme), [theme]);

  const themeOptions: ThemeOptions = useMemo(
    () => ({
      breakpoints: {
        values: {
          xs: 0,
          sm: 768,
          md: 1024,
          lg: 1266,
          xl: 1440
        }
      },
      direction: themeDirection,
      mixins: {
        toolbar: {
          minHeight: HEADER_HEIGHT,
          paddingTop: 8,
          paddingBottom: 8
        }
      },
      palette: theme.palette,
      shape: {
        borderRadius: 8
      },
      customShadows: themeCustomShadows,
      typography: themeTypography
    }),
    [themeDirection, theme, themeTypography, themeCustomShadows]
  );

  // Building the theme is a deep merge of every component override the app has, and the object it returns is what
  // the whole MUI tree reads its styling from: a new one re-renders and re-styles every component on screen. Both
  // are therefore done only when the options they are built from actually change, rather than on every render of
  // this component — which is every time anything in the config changes, the language among it.
  const themes: Theme = useMemo<Theme>(() => {
    const built = createTheme(themeOptions);
    built.components = componentsOverride(built);
    return built;
  }, [themeOptions]);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={themes}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
