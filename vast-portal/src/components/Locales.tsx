import { ReactNode, useEffect, useState } from 'react';

// third-party
import { IntlProvider, MessageFormatElement } from 'react-intl';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { enUS, lv } from 'date-fns/locale';

// project-imports
import useConfig from 'hooks/useConfig';

// types
import { I18n } from 'types/config';

// load locales files
const loadLocaleData = (locale: I18n) => {
  switch (locale) {
    case 'lv':
      return import('utils/locales/lv.json');
    case 'en':
    default:
      return import('utils/locales/en.json');
  }
};

// The month and day names a picker writes are the app's own words in another form, so they answer to the same
// setting the messages do rather than to whatever the browser happens to be set to.
const dateLocales = { en: enUS, lv };

interface Props {
  children: ReactNode;
}

// ==============================|| LOCALIZATION ||============================== //

export default function Locales({ children }: Props) {
  const { i18n } = useConfig();

  const [messages, setMessages] = useState<Record<string, string> | Record<string, MessageFormatElement[]> | undefined>();

  useEffect(() => {
    loadLocaleData(i18n).then((d: { default: Record<string, string> | Record<string, MessageFormatElement[]> | undefined }) => {
      setMessages(d.default);
    });
  }, [i18n]);

  return (
    <>
      {messages && (
        <IntlProvider locale={i18n} defaultLocale="en" messages={messages}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={dateLocales[i18n]}>
            {children}
          </LocalizationProvider>
        </IntlProvider>
      )}
    </>
  );
}
