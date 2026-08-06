import { saveAuthSession } from './storage';

export type AuthProvider = 'local' | 'google';

export interface AuthUser {
  id: string;
  name: string;
  lastName?: string | null;
  fullName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  email: string;
  emailVerified: boolean;
  authProvider: AuthProvider;
  premium?: {
    active: boolean;
    plan: string | null;
    until: string | null;
  } | null;
}

export interface AuthFlowData {
  message?: string;
  token?: string;
  user?: AuthUser;
  email?: string;
  requiresVerification?: boolean;
  delivery?: string;
  devCode?: string;
  authProvider?: AuthProvider;
}

function hasDataProperty<T>(value: T | { data: T }): value is { data: T } {
  return typeof value === 'object' && value !== null && 'data' in value;
}

export function extractApiData<T>(response: T | { data: T }): T {
  return hasDataProperty(response) ? response.data : response;
}

export async function persistAuthPayload(data: AuthFlowData): Promise<boolean> {
  if (!data.token || !data.user) {
    return false;
  }

  await saveAuthSession(data.token, data.user);
  return true;
}

export function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export function getUserDisplayName(user: Pick<AuthUser, 'name' | 'lastName' | 'fullName'> | null | undefined): string {
  if (!user) {
    return 'Mehmon';
  }

  const fullName = [user.name, user.lastName].filter(Boolean).join(' ').trim();
  return user.fullName || fullName || user.name || 'Mehmon';
}

export function getUserInitials(user: Pick<AuthUser, 'name' | 'lastName' | 'fullName'> | null | undefined): string {
  return getUserDisplayName(user)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
