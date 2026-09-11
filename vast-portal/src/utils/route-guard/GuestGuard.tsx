import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// project-imports
import { APP_DEFAULT_PATH } from 'config';
import useAuth from 'hooks/useAuth';

// types
import { GuardProps } from 'types/auth';

// ==============================|| GUEST GUARD ||============================== //

export default function GuestGuard({ children }: GuardProps) {
  const { isLoggedIn, needsTenantSelection } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoggedIn) {
      // An account with more than one tenant picks one before landing anywhere it asked to go.
      const destination = needsTenantSelection ? '/select-tenant' : location?.state?.from ? location?.state?.from : APP_DEFAULT_PATH;
      navigate(destination, {
        state: { from: '' },
        replace: true
      });
    }
  }, [isLoggedIn, needsTenantSelection, navigate, location]);

  return children;
}
