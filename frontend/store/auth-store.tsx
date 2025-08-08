'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createContext, useContext, ReactNode } from 'react';
import apiClient from '@/lib/api/client';

interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  isVerified: boolean;
  subscription?: {
    plan: 'free' | 'pro' | 'premium';
    status: 'active' | 'cancelled' | 'expired';
    expiresAt?: string;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
  setLoading: (loading: boolean) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true });
          
          const response = await apiClient.post('/api/auth/login', {
            email,
            password,
          });

          if (response.success && response.token) {
            apiClient.setToken(response.token);
            
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
            });
            
            return true;
          }
          
          set({ isLoading: false });
          return false;
        } catch (error) {
          console.error('Login error:', error);
          set({ isLoading: false });
          return false;
        }
      },

      register: async (email: string, password: string, name?: string) => {
        try {
          set({ isLoading: true });
          
          const response = await apiClient.post('/api/auth/register', {
            email,
            password,
            name,
          });

          if (response.success && response.token) {
            apiClient.setToken(response.token);
            
            set({
              user: response.user,
              token: response.token,
              isAuthenticated: true,
              isLoading: false,
            });
            
            return true;
          }
          
          set({ isLoading: false });
          return false;
        } catch (error) {
          console.error('Registration error:', error);
          set({ isLoading: false });
          return false;
        }
      },

      logout: () => {
        apiClient.clearAuth();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      updateProfile: async (updates: Partial<User>) => {
        try {
          set({ isLoading: true });
          
          const response = await apiClient.put('/api/auth/profile', updates);
          
          if (response.success) {
            set((state) => ({
              user: state.user ? { ...state.user, ...updates } : null,
              isLoading: false,
            }));
            
            return true;
          }
          
          set({ isLoading: false });
          return false;
        } catch (error) {
          console.error('Profile update error:', error);
          set({ isLoading: false });
          return false;
        }
      },

      refreshToken: async () => {
        try {
          const refreshed = await apiClient.refreshToken();
          
          if (!refreshed) {
            get().logout();
          }
          
          return refreshed;
        } catch (error) {
          console.error('Token refresh error:', error);
          get().logout();
          return false;
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authStore = useAuthStore();

  return (
    <AuthContext.Provider value={authStore}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}