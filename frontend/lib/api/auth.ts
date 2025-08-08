/**
 * Authentication API methods
 */

import apiClient from './client';

export const authAPI = {
  // Authentication
  async register(userData: { email: string; password: string; name?: string }) {
    const response = await apiClient.post('/api/auth/register', userData);
    
    if (response.success && response.token) {
      apiClient.setToken(response.token);
    }
    
    return response;
  },

  async login(credentials: { email: string; password: string }) {
    const response = await apiClient.post('/api/auth/login', credentials);
    
    if (response.success && response.token) {
      apiClient.setToken(response.token);
    }
    
    return response;
  },

  async logout() {
    apiClient.clearAuth();
    return { success: true };
  },

  async getProfile() {
    return apiClient.get('/api/auth/me');
  },

  async updateProfile(updates: any) {
    const response = await apiClient.put('/api/auth/profile', updates);
    return response;
  },

  async refreshToken() {
    return apiClient.refreshToken();
  },

  isAuthenticated() {
    return apiClient.isAuthenticated();
  },

  getToken() {
    return apiClient.getToken();
  }
};

export default authAPI;