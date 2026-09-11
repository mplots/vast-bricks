import { ReactElement } from 'react';

// ==============================|| TYPES - AUTH  ||============================== //

export type GuardProps = {
  children: ReactElement | null;
};

type UserProfile = {
  id?: string;
  email?: string;
  avatar?: string;
  image?: string;
  name?: string;
  role?: string;
  tier?: string;
};

/** The tenant a login serves, or one of the others the same account may switch to. */
export type TenantSummary = {
  id: number;
  code: string;
  name: string;
};

export interface AuthProps {
  isLoggedIn: boolean;
  isInitialized?: boolean;
  user?: UserProfile | null;
  token?: string | null;
  /** The tenant the current session serves. */
  tenant?: TenantSummary | null;
  /** Every tenant this account may serve, so a later switch does not need to be typed out again. */
  tenants?: TenantSummary[];
  /** True right after a fresh login when the account has more than one tenant and none has been picked yet. */
  needsTenantSelection?: boolean;
}

export interface AuthActionProps {
  type: string;
  payload?: AuthProps;
}

export type JWTContextType = {
  isLoggedIn: boolean;
  isInitialized?: boolean;
  user?: UserProfile | null | undefined;
  tenant?: TenantSummary | null;
  tenants?: TenantSummary[];
  needsTenantSelection?: boolean;
  logout: () => void;
  login: (email: string, password: string) => Promise<void>;
  /** Moves the current session to another of the account's tenants, without asking for the password again. */
  switchTenant: (tenantCode: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: VoidFunction;
};
