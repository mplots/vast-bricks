// action - state management
import { LOGIN, LOGOUT, REGISTER, SWITCH_TENANT } from './actions';

// types
import { AuthProps, AuthActionProps } from 'types/auth';

// initial state
const initialState: AuthProps = {
  isLoggedIn: false,
  isInitialized: false,
  user: null
};

// ==============================|| AUTH REDUCER ||============================== //

const auth = (state = initialState, action: AuthActionProps) => {
  switch (action.type) {
    case REGISTER: {
      const { user } = action.payload!;
      return {
        ...state,
        user
      };
    }
    case LOGIN: {
      // needsTenantSelection defaults to "more than one tenant to pick from" for a fresh login, but the init effect
      // resuming a stored token passes false explicitly: a page reload is not a new login and must not re-ask.
      const { user, tenant, tenants, needsTenantSelection } = action.payload!;
      return {
        ...state,
        isLoggedIn: true,
        isInitialized: true,
        user,
        tenant,
        tenants,
        needsTenantSelection: needsTenantSelection ?? (tenants?.length ?? 0) > 1
      };
    }
    case SWITCH_TENANT: {
      const { user, tenant, tenants } = action.payload!;
      return {
        ...state,
        isLoggedIn: true,
        user,
        tenant,
        tenants,
        needsTenantSelection: false
      };
    }
    case LOGOUT: {
      return {
        ...state,
        isInitialized: true,
        isLoggedIn: false,
        user: null,
        tenant: null,
        tenants: [],
        needsTenantSelection: false
      };
    }
    default: {
      return { ...state };
    }
  }
};

export default auth;
