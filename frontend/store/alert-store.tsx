'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createContext, useContext, ReactNode } from 'react';
import apiClient from '@/lib/api/client';

interface CarAlert {
  id: string;
  name: string;
  isActive: boolean;
  filters: {
    make?: string;
    model?: string;
    category?: string;
    priceMin?: number;
    priceMax?: number;
    yearMin?: number;
    yearMax?: number;
    mileageMax?: number;
    fuel?: string;
    transmission?: string;
    features?: string[];
    location?: {
      zipcode: string;
      radius: number;
    };
  };
  notifications: {
    email: boolean;
    voice: boolean;
    phoneNumber?: string;
  };
  stats: {
    totalMatches: number;
    newToday: number;
    lastMatch?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface AlertState {
  alerts: CarAlert[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadAlerts: () => Promise<void>;
  createAlert: (alertData: Partial<CarAlert>) => Promise<boolean>;
  updateAlert: (id: string, updates: Partial<CarAlert>) => Promise<boolean>;
  deleteAlert: (id: string) => Promise<boolean>;
  toggleAlert: (id: string) => Promise<boolean>;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const useAlertStore = create<AlertState>()(
  persist(
    (set, get) => ({
      alerts: [],
      isLoading: false,
      error: null,

      loadAlerts: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiClient.get('/api/alerts');
          
          if (response.success) {
            set({ alerts: response.data, isLoading: false });
          } else {
            set({ error: 'Failed to load alerts', isLoading: false });
          }
        } catch (error: any) {
          console.error('Load alerts error:', error);
          set({ 
            error: error.message || 'Failed to load alerts', 
            isLoading: false 
          });
        }
      },

      createAlert: async (alertData: Partial<CarAlert>) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiClient.post('/api/alerts', alertData);
          
          if (response.success) {
            set((state) => ({
              alerts: [...state.alerts, response.data],
              isLoading: false,
            }));
            
            return true;
          }
          
          set({ 
            error: response.message || 'Failed to create alert', 
            isLoading: false 
          });
          return false;
        } catch (error: any) {
          console.error('Create alert error:', error);
          set({ 
            error: error.message || 'Failed to create alert', 
            isLoading: false 
          });
          return false;
        }
      },

      updateAlert: async (id: string, updates: Partial<CarAlert>) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiClient.put(`/api/alerts/${id}`, updates);
          
          if (response.success) {
            set((state) => ({
              alerts: state.alerts.map(alert => 
                alert.id === id ? { ...alert, ...updates } : alert
              ),
              isLoading: false,
            }));
            
            return true;
          }
          
          set({ 
            error: response.message || 'Failed to update alert', 
            isLoading: false 
          });
          return false;
        } catch (error: any) {
          console.error('Update alert error:', error);
          set({ 
            error: error.message || 'Failed to update alert', 
            isLoading: false 
          });
          return false;
        }
      },

      deleteAlert: async (id: string) => {
        try {
          set({ isLoading: true, error: null });
          
          const response = await apiClient.delete(`/api/alerts/${id}`);
          
          if (response.success) {
            set((state) => ({
              alerts: state.alerts.filter(alert => alert.id !== id),
              isLoading: false,
            }));
            
            return true;
          }
          
          set({ 
            error: response.message || 'Failed to delete alert', 
            isLoading: false 
          });
          return false;
        } catch (error: any) {
          console.error('Delete alert error:', error);
          set({ 
            error: error.message || 'Failed to delete alert', 
            isLoading: false 
          });
          return false;
        }
      },

      toggleAlert: async (id: string) => {
        const alert = get().alerts.find(a => a.id === id);
        if (!alert) return false;

        return get().updateAlert(id, { isActive: !alert.isActive });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'alert-store',
      partialize: (state) => ({
        alerts: state.alerts,
      }),
    }
  )
);

const AlertContext = createContext<AlertState | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const alertStore = useAlertStore();

  return (
    <AlertContext.Provider value={alertStore}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return context;
}