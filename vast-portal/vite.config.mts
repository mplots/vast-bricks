import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_URL = `${env.VITE_APP_BASE_NAME}`;
  const API_PROXY = process.env.VITE_APP_API_PROXY || env.VITE_APP_API_PROXY || 'http://127.0.0.1:6161';
  const managedByVast = process.env.VAST_MANAGED === 'true';
  const PORT = 3200;

  return {
    server: {
      // this ensures that the browser opens upon server start
      open: !managedByVast,
      // IntelliJ portal development port; ./vast uses 3100 instead.
      port: PORT,
      strictPort: true,
      host: true,
      proxy: {
        '/api': {
          target: API_PROXY,
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      open: true,
      host: true
    },
    define: {
      global: 'window'
    },
    resolve: {
      alias: [
        // { find: '', replacement: path.resolve(__dirname, 'src') },
        // {
        //   find: /^~(.+)/,
        //   replacement: path.join(process.cwd(), 'node_modules/$1')
        // },
        // {
        //   find: /^src(.+)/,
        //   replacement: path.join(process.cwd(), 'src/$1')
        // }
        // {
        //   find: 'assets',
        //   replacement: path.join(process.cwd(), 'src/assets')
        // },
      ]
    },
    base: API_URL,
    // The pickers keep their localization in a context that both the provider and the calendars close over, so the
    // whole family has to be pre-bundled in one pass. Discovering one of these on demand re-optimizes mid-session and
    // leaves the page holding two copies of that context, which reads as a missing LocalizationProvider.
    optimizeDeps: {
      include: [
        '@mui/x-date-pickers/AdapterDateFns',
        '@mui/x-date-pickers/LocalizationProvider',
        '@mui/x-date-pickers/MonthCalendar',
        '@mui/x-date-pickers/YearCalendar'
      ]
    },
    plugins: [react(), tsconfigPaths()]
  };
});
