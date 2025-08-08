/**
 * API Client for Auto Alert SaaS
 * Handles all HTTP requests with error handling, loading states, and auth
 */

class ApiError extends Error {
  constructor(message: string, public status: number, public response?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private loadingStates = new Map<string, number>();
  private eventListeners = new Map<string, Set<Function>>();
  private cache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();

  constructor(baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://auto-alert-saas-production.up.railway.app') {
    this.baseURL = baseURL;
    
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  // Authentication methods
  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
    this.emit('tokenChanged', token);
  }

  getToken() {
    return this.token;
  }

  clearAuth() {
    this.setToken(null);
    this.emit('authCleared', null);
  }

  isAuthenticated() {
    return !!this.token;
  }

  // HTTP request methods
  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const requestId = `${options.method || 'GET'}_${endpoint}`;
    
    // Set loading state
    this.setLoading(requestId, true);
    
    try {
      const config: RequestInit = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      // Add auth token if available
      if (this.token) {
        (config.headers as any).Authorization = `Bearer ${this.token}`;
      }

      // Handle request body
      if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
      }

      const response = await fetch(url, config);
      
      // Handle token refresh on 401
      if (response.status === 401 && this.token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request with new token
          (config.headers as any).Authorization = `Bearer ${this.token}`;
          const retryResponse = await fetch(url, config);
          return await this.handleResponse(retryResponse, requestId);
        } else {
          this.clearAuth();
          throw new ApiError('Authentication expired', 401, response);
        }
      }

      return await this.handleResponse(response, requestId);
    } catch (error) {
      this.setLoading(requestId, false);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network errors
      if (typeof window !== 'undefined' && !navigator.onLine) {
        throw new ApiError('No internet connection', 0, null);
      }
      
      throw new ApiError('Request failed', 0, error);
    }
  }

  private async handleResponse(response: Response, requestId: string) {
    this.setLoading(requestId, false);
    
    const contentType = response.headers.get('content-type');
    
    try {
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const message = data.error || data.message || `HTTP ${response.status}`;
        throw new ApiError(message, response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        'Invalid response format',
        response.status,
        { status: response.status, statusText: response.statusText }
      );
    }
  }

  async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.request('/api/auth/refresh', {
      method: 'POST'
    })
      .then((response: any) => {
        this.setToken(response.token);
        this.refreshPromise = null;
        return true;
      })
      .catch(() => {
        this.refreshPromise = null;
        return false;
      });

    return this.refreshPromise;
  }

  // HTTP helper methods
  async get(endpoint: string, params: Record<string, any> = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url);
  }

  async post(endpoint: string, data: any = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  async put(endpoint: string, data: any = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  // Loading state management
  private setLoading(key: string, loading: boolean) {
    if (loading) {
      this.loadingStates.set(key, Date.now());
    } else {
      this.loadingStates.delete(key);
    }
    this.emit('loadingChanged', { key, loading, states: this.getLoadingStates() });
  }

  isLoading(key: string) {
    return this.loadingStates.has(key);
  }

  getLoadingStates() {
    return Object.fromEntries(this.loadingStates.entries());
  }

  // Event system
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  // Utility methods
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return response.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  getAPIStatus() {
    return {
      baseURL: this.baseURL,
      authenticated: this.isAuthenticated(),
      loadingOperations: this.loadingStates.size,
      token: this.token ? 'Set' : 'Not set'
    };
  }
}

// Create and export singleton instance
const apiClient = new ApiClient();

export default apiClient;
export { ApiError, ApiClient };