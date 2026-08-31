import { createContext, ReactNode } from 'react';

// project-imports
import config, { MenuOrientation, ThemeDirection, ThemeMode } from 'config';
import useLocalStorage from 'hooks/useLocalStorage';

// types
import { CustomizationProps, FontFamily, I18n, PresetColor } from 'types/config';

// initial state
const initialState: CustomizationProps = {
  ...config,
  onChangeContainer: () => {},
  onChangeLocalization: () => {},
  onChangeMode: () => {},
  onChangePresetColor: () => {},
  onChangeDirection: () => {},
  onChangeMiniDrawer: () => {},
  onChangeThemeLayout: () => {},
  onChangeMenuOrientation: () => {},
  onChangeMenuCaption: () => {},
  onChangeFontFamily: () => {},
  onChangeContrast: () => {}
};

// ==============================|| CONFIG CONTEXT & PROVIDER ||============================== //

const ConfigContext = createContext(initialState);

type ConfigProviderProps = {
  children: ReactNode;
};

function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useLocalStorage('able-pro-material-react-ts-config', initialState);
  const currentConfig = config.i18n === 'lv' ? config : { ...config, i18n: 'en' as const };

  const onChangeContainer = (container: string) => {
    let containerValue: boolean;

    if (container === 'fluid') {
      containerValue = false;
    } else {
      containerValue = true;
    }
    setConfig({
      ...currentConfig,
      container: containerValue
    });
  };

  const onChangeLocalization = (lang: I18n) => {
    setConfig({
      ...currentConfig,
      i18n: lang
    });
  };

  const onChangeMode = (mode: ThemeMode) => {
    setConfig({
      ...currentConfig,
      mode
    });
  };

  const onChangePresetColor = (theme: PresetColor) => {
    setConfig({
      ...currentConfig,
      presetColor: theme
    });
  };

  const onChangeDirection = (direction: ThemeDirection) => {
    setConfig({
      ...currentConfig,
      themeDirection: direction
    });
  };

  const onChangeMiniDrawer = (miniDrawer: boolean) => {
    setConfig({
      ...currentConfig,
      miniDrawer
    });
  };

  const onChangeThemeLayout = (direction: ThemeDirection, miniDrawer: boolean) => {
    setConfig({
      ...currentConfig,
      miniDrawer,
      themeDirection: direction
    });
  };

  const onChangeContrast = (themeContrast: string) => {
    let contrastValue: boolean;

    if (themeContrast === 'contrast') {
      contrastValue = true;
    } else {
      contrastValue = false;
    }
    setConfig({
      ...currentConfig,
      themeContrast: contrastValue
    });
  };

  const onChangeMenuCaption = (menuCaption: string) => {
    let captionValue: boolean;

    if (menuCaption === 'caption') {
      captionValue = true;
    } else {
      captionValue = false;
    }
    setConfig({
      ...currentConfig,
      menuCaption: captionValue
    });
  };

  const onChangeMenuOrientation = (layout: MenuOrientation) => {
    setConfig({
      ...currentConfig,
      menuOrientation: layout
    });
  };

  const onChangeFontFamily = (fontFamily: FontFamily) => {
    setConfig({
      ...currentConfig,
      fontFamily
    });
  };

  return (
    <ConfigContext
      value={{
        ...currentConfig,
        onChangeContainer,
        onChangeLocalization,
        onChangeMode,
        onChangePresetColor,
        onChangeDirection,
        onChangeMiniDrawer,
        onChangeThemeLayout,
        onChangeMenuOrientation,
        onChangeMenuCaption,
        onChangeFontFamily,
        onChangeContrast
      }}
    >
      {children}
    </ConfigContext>
  );
}

export { ConfigProvider, ConfigContext };
