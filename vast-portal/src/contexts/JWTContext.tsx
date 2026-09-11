import React, { createContext, useEffect, useReducer } from 'react';

// third-party
import { jwtDecode } from 'jwt-decode';
import { mutate } from 'swr';

// reducer - state management
import { LOGIN, LOGOUT, SWITCH_TENANT } from 'contexts/auth-reducer/actions';
import authReducer from 'contexts/auth-reducer/auth';

// project-imports
import Loader from 'components/Loader';
import axios from 'utils/axios';

// types
import { AuthProps, JWTContextType } from 'types/auth';
import { KeyedObject } from 'types/root';

// constant
const initialState: AuthProps = {
  isLoggedIn: false,
  isInitialized: false,
  user: null
};

const verifyToken: (st: string) => boolean = (serviceToken) => {
  if (!serviceToken) {
    return false;
  }
  const decoded: KeyedObject = jwtDecode(serviceToken);
  /**
   * Property 'exp' does not exist on type '<T = unknown>(token: string, options?: JwtDecodeOptions | undefined) => T'.
   */
  return decoded.exp > Date.now() / 1000;
};

/**
 * Drops every cached response for a private endpoint, keyed only by path with no tenant in it, so it survives across
 * logins as a shared slot. Without this, logging out and back in - or switching tenant - shows whatever the
 * previous tenant's session had cached under those same keys until something unrelated triggers a refetch.
 *
 * <p>{@code revalidate} is false for login/logout, whose callers navigate away and let the next mount fetch fresh,
 * and true for an in-place tenant switch, whose caller stays on the same page and needs its tables to update now.
 */
const clearPrivateCache = (revalidate: boolean) =>
  mutate((key) => typeof key === 'string' && key.startsWith('/api/private/'), undefined, { revalidate });

const setSession = (serviceToken?: string | null) => {
  if (serviceToken) {
    localStorage.setItem('serviceToken', serviceToken);
    axios.defaults.headers.common.Authorization = `Bearer ${serviceToken}`;
  } else {
    localStorage.removeItem('serviceToken');
    delete axios.defaults.headers.common.Authorization;
  }
};

// ==============================|| JWT CONTEXT & PROVIDER ||============================== //

const JWTContext = createContext<JWTContextType | null>(null);

export const JWTProvider = ({ children }: { children: React.ReactElement }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const init = async () => {
      try {
        const serviceToken = window.localStorage.getItem('serviceToken');
        if (serviceToken && verifyToken(serviceToken)) {
          setSession(serviceToken);
          const response = await axios.get('/api/private/account/me');
          const { user, tenant, tenants } = response.data;
          dispatch({
            type: LOGIN,
            payload: {
              isLoggedIn: true,
              user,
              tenant,
              tenants,
              // Resuming a stored session is not a fresh login, so it must never re-ask for a tenant already in use.
              needsTenantSelection: false
            }
          });
        } else {
          dispatch({
            type: LOGOUT
          });
        }
      } catch (err) {
        console.error(err);
        dispatch({
          type: LOGOUT
        });
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await axios.post('/api/account/login', { email, password });
    const { serviceToken, user, tenant, tenants } = response.data;
    setSession(serviceToken);
    await clearPrivateCache(false);
    dispatch({
      type: LOGIN,
      payload: {
        isLoggedIn: true,
        user,
        tenant,
        tenants
      }
    });
  };

  const switchTenant = async (tenantCode: string) => {
    const response = await axios.post('/api/private/account/switch-tenant', { tenantCode });
    const { serviceToken, user, tenant, tenants } = response.data;
    setSession(serviceToken);
    await clearPrivateCache(true);
    dispatch({
      type: SWITCH_TENANT,
      payload: {
        isLoggedIn: true,
        user,
        tenant,
        tenants
      }
    });
  };

  const logout = () => {
    setSession(null);
    clearPrivateCache(false);
    dispatch({ type: LOGOUT });
  };

  const resetPassword = async (email: string) => {
    console.log('email - ', email);
  };

  const updateProfile = () => {};

  if (state.isInitialized !== undefined && !state.isInitialized) {
    return <Loader />;
  }

  return <JWTContext value={{ ...state, login, logout, switchTenant, resetPassword, updateProfile }}>{children}</JWTContext>;
};

export default JWTContext;
