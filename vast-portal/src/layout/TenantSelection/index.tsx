import { Outlet } from 'react-router-dom';

// project-imports
import TenantSelectionGuard from 'utils/route-guard/TenantSelectionGuard';

// ==============================|| LAYOUT - TENANT SELECTION ||============================== //

export default function TenantSelectionLayout() {
  return (
    <TenantSelectionGuard>
      <Outlet />
    </TenantSelectionGuard>
  );
}
