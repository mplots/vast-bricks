import { lazy } from 'react';

// project-imports
import Loadable from 'components/Loadable';
import TenantSelectionLayout from 'layout/TenantSelection';

// render - select tenant
const SelectTenant = Loadable(lazy(() => import('pages/auth/select-tenant')));

// ==============================|| TENANT ROUTES ||============================== //

const TenantRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <TenantSelectionLayout />,
      children: [
        {
          path: 'select-tenant',
          element: <SelectTenant />
        }
      ]
    }
  ]
};

export default TenantRoutes;
