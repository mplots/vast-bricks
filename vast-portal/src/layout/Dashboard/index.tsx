import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

// material-ui
import useMediaQuery from '@mui/material/useMediaQuery';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project-imports
import DebugDock from './DebugDock';
import DebugTrigger from './DebugDock/DebugTrigger';
import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import HorizontalBar from './Drawer/HorizontalBar';
import Breadcrumbs from 'components/@extended/Breadcrumbs';
import Loader from 'components/Loader';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH, MenuOrientation } from 'config';
import useConfig from 'hooks/useConfig';
import AuthGuard from 'utils/route-guard/AuthGuard';

// ==============================|| MAIN LAYOUT ||============================== //

export default function MainLayout() {
  const { menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const { container, miniDrawer, menuOrientation } = useConfig();

  const isHorizontal = menuOrientation === MenuOrientation.HORIZONTAL && !downLG;

  // set media wise responsive drawer
  useEffect(() => {
    if (!miniDrawer) {
      handlerDrawerOpen(!downXL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downXL]);

  if (menuMasterLoading) return <Loader />;

  return (
    <AuthGuard>
      <Box sx={{ display: 'flex', width: '100%' }}>
        <Header />
        {!isHorizontal ? <Drawer /> : <HorizontalBar />}

        <Box component="main" sx={{ width: `calc(100% - ${DRAWER_WIDTH}px)`, flexGrow: 1, p: { xs: 1, sm: 3 } }}>
          <Toolbar sx={{ mt: isHorizontal ? 8 : 'inherit', mb: isHorizontal ? 2 : 'inherit' }} />
          <Container
            maxWidth={container && !downXL ? 'xl' : false}
            sx={{
              ...(container && !downXL && { px: { xs: 0, sm: 3 } }),
              position: 'relative',
              minHeight: 'calc(100vh - 124px)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Breadcrumbs />
            <Outlet />
            <Footer />
          </Container>
          <DebugTrigger />
        </Box>

        <DebugDock />
      </Box>
    </AuthGuard>
  );
}
