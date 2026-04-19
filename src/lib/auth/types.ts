export interface AuthUser {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string | null;
  isAdmin: boolean;
  isActive: boolean;
}

export interface AccessibleUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthSession {
  sessionId: string;
  user: AuthUser;
  originalUser: AuthUser | null;
  isImpersonating: boolean;
}

export interface AuthView {
  user: AuthUser;
  originalUser: AuthUser | null;
  isImpersonating: boolean;
  accessibleUsers: AccessibleUser[];
}

export interface ManagedUser extends AuthUser {
  createdAt: string;
  updatedAt: string;
  linkedUserIds: string[];
}
