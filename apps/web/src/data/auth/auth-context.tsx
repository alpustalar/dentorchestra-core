'use client';

import React, { createContext, ReactNode, useContext, useState } from 'react';

export interface UserClaims {
  role: 'SYSTEM_ADMIN' | 'ORG_ADMIN' | 'DOCTOR' | 'STAFF';
  organizationId: string;
  clinicId: string;
  capabilities: string[];
}

export interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthContextType {
  user: MockUser | null;
  claims: UserClaims;
  loading: boolean;
  hasCapability: (capability: string) => boolean;
  refreshToken: () => Promise<string>;
  logout: () => Promise<void>;
  setMockRole: (role: UserClaims['role'], capabilities: string[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// FULL ADMIN - Bütün katmanlara ve modüllere erişim sağlayan yetki seti
const adminClaims: UserClaims = {
  role: 'SYSTEM_ADMIN',
  organizationId: 'org_master_1',
  clinicId: 'clinic_master_1',
  capabilities: [],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>({
    uid: 'mock_admin_uid_999',
    email: 'admin@asazilim.com',
    displayName: 'Alp Ustalar (Admin)',
  });

  const [claims, setClaims] = useState<UserClaims>(adminClaims);
  const [loading, setLoading] = useState<boolean>(false);

  // SYSTEM_ADMIN her zaman her şeye erişebilsin diye kısa devre (short-circuit) ekleyebiliriz
  const hasCapability = (capability: string): boolean => {
    if (claims.role === 'SYSTEM_ADMIN') return true;
    return claims.capabilities.includes(capability);
  };

  const refreshToken = async (): Promise<string> => {
    console.log('[MockAuth] Admin token yenilendi.');
    return 'mock_admin_token_xyz';
  };

  const logout = async (): Promise<void> => {
    setUser(null);
    console.log('[MockAuth] Çıkış yapıldı.');
  };

  const setMockRole = (role: UserClaims['role'], capabilities: string[]) => {
    setClaims((prev) => ({ ...prev, role, capabilities }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        claims,
        loading,
        hasCapability,
        refreshToken,
        logout,
        setMockRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
