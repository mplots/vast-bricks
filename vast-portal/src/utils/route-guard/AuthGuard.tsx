import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// project-imports
import useAuth from 'hooks/useAuth';

// types
import { GuardProps } from 'types/auth';

// ==============================|| AUTH GUARD ||============================== //

export default function AuthGuard({ children }: GuardProps) {
  const { isLoggedIn, needsTenantSelection } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('login', {
        state: {
          from: location.pathname
        },
        replace: true
      });
    } else if (needsTenantSelection) {
      // Reaching a dashboard URL directly, before a multi-tenant login has picked one, sends them to pick first.
      navigate('/select-tenant', { replace: true });
    }
  }, [isLoggedIn, needsTenantSelection, navigate, location]);

  return children;
}
