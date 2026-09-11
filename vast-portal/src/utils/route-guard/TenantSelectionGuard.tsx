import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// project-imports
import { APP_DEFAULT_PATH } from 'config';
import useAuth from 'hooks/useAuth';

// types
import { GuardProps } from 'types/auth';

// ==============================|| TENANT SELECTION GUARD ||============================== //

/**
 * Guards the post-login "choose a tenant" screen: reachable only mid-login, with nothing left to pick once a
 * tenant is confirmed. Anyone who isn't logged in at all still needs to log in first.
 */
export default function TenantSelectionGuard({ children }: GuardProps) {
  const { isLoggedIn, needsTenantSelection } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { replace: true });
    } else if (!needsTenantSelection) {
      navigate(APP_DEFAULT_PATH, { replace: true });
    }
  }, [isLoggedIn, needsTenantSelection, navigate]);

  return children;
}
