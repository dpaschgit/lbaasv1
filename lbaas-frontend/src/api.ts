import { createApiRef, DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';

export interface Vip {
  id?: string;
  vip_fqdn: string;
  vip_ip: string;
  port: number;
  protocol: string;
  environment: string;
  datacenter?: string;
  app_id: string;
  owner?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  pool_members?: PoolMember[];
}

export interface PoolMember {
  id?: string;
  server_name: string;
  server_ip: string;
  server_port: number;
  weight: number;
  status?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface LbaasFrontendApi {
  getHealth(): Promise<{ status: string }>;
  login(username: string, password: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  getVips(): Promise<Vip[]>;
  getVip(id: string): Promise<Vip>;
  createVip(vip: Partial<Vip>, incidentId?: string): Promise<Vip>;
  updateVip(id: string, vip: Partial<Vip>, incidentId?: string): Promise<Vip>;
  deleteVip(id: string, incidentId?: string): Promise<void>;
  isAuthenticated(): boolean;
  getAuthToken(): string | null;
  initializeAuth(): Promise<boolean>;
}

export const lbaasFrontendApiRef = createApiRef<LbaasFrontendApi>({
  id: 'plugin.lbaas-frontend.api',
});

export class LbaasFrontendApiClient implements LbaasFrontendApi {
  private backendBaseUrl: string = 'http://localhost:8000/api/v1';
  private token: string | null = null;
  private tokenStorageKey: string = 'lbaas_auth_token';
  private userStorageKey: string = 'lbaas_user';
  private identityApi?: IdentityApi;

  constructor(options?: { 
    discoveryApi?: DiscoveryApi; 
    identityApi?: IdentityApi;
    backendBaseUrl?: string 
  }) {
    if (options?.backendBaseUrl) {
      this.backendBaseUrl = options.backendBaseUrl;
    }
    
    if (options?.identityApi) {
      this.identityApi = options?.identityApi;
    }
    
    // Initialize authentication state from storage
    this.loadAuthState();
  }

  private loadAuthState(): void {
    try {
      // Check for stored token
      const storedToken = localStorage.getItem(this.tokenStorageKey);
      if (storedToken) {
        console.log('Existing token found in localStorage');
        this.token = storedToken;
      } else {
        console.log('No token found in localStorage');
        this.token = null;
      }
    } catch (e) {
      console.error('Error loading auth state:', e);
      this.clearAuthState();
    }
  }

  private clearAuthState(): void {
    console.log('Clearing authentication state');
    this.token = null;
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.userStorageKey);
  }

  async initializeAuth(): Promise<boolean> {
    // If we already have a token, consider auth initialized
    if (this.token) {
      return true;
    }

    // If we have identityApi, try to use it for authentication
    if (this.identityApi) {
      try {
        const identity = await this.identityApi.getCredentials();
        
        // If we have a token from identity API, use it
        if (identity && identity.token) {
          console.log('Using token from Backstage identity API');
          
          // Store the token
          this.token = identity.token;
          localStorage.setItem(this.tokenStorageKey, identity.token);
          
          // Store user info if available
          if (identity.userEntityRef) {
            localStorage.setItem(this.userStorageKey, identity.userEntityRef);
          }
          
          return true;
        }
      } catch (e) {
        console.error('Error getting credentials from identity API:', e);
      }
    }
    
    return false;
  }

  async getHealth(): Promise<{ status: string }> {
    const response = await fetch(`${this.backendBaseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    return await response.json();
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    console.log(`Attempting login with username: ${username}`);
    
    // Clear any existing auth state before attempting login
    this.clearAuthState();
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    console.log(`Making POST request to ${this.backendBaseUrl}/auth/token`);
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        credentials: 'include',
      });
      
      console.log(`Login response status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = `Login failed with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        console.error('Login failed:', errorMessage);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Login successful, received token');
      
      // Store token in memory and localStorage
      this.token = data.access_token;
      localStorage.setItem(this.tokenStorageKey, data.access_token);
      localStorage.setItem(this.userStorageKey, username);
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    console.log('Logging out, clearing authentication state');
    this.clearAuthState();
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getAuthToken(): string | null {
    return this.token;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    // Try to initialize auth if not authenticated
    if (!this.isAuthenticated()) {
      const initialized = await this.initializeAuth();
      if (!initialized) {
        console.error('No authentication token available');
        throw new Error('Authentication required. Please login.');
      }
    }
    
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.token}`,
    };
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
      
      if (response.status === 401) {
        console.error('Authentication token expired or invalid');
        this.clearAuthState();
        throw new Error('Authentication expired. Please login again.');
      }
      
      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  async getVips(): Promise<Vip[]> {
    console.log('Fetching all VIPs');
    
    const response = await this.fetchWithAuth(`${this.backendBaseUrl}/vips`);
    
    if (!response.ok) {
      const errorMessage = `Failed to fetch VIPs with status: ${response.status}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log(`Fetched ${data.length} VIPs`);
    return data;
  }

  async getVip(id: string): Promise<Vip> {
    console.log(`Fetching VIP with ID: ${id}`);
    
    const response = await this.fetchWithAuth(`${this.backendBaseUrl}/vips/${id}`);
    
    if (!response.ok) {
      const errorMessage = `Failed to fetch VIP with status: ${response.status}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('Fetched VIP details:', data);
    return data;
  }

  async createVip(vip: Partial<Vip>, incidentId?: string): Promise<Vip> {
    console.log('Creating new VIP:', vip);
    
    let url = `${this.backendBaseUrl}/vips`;
    if (incidentId) {
      url += `?incident_id=${encodeURIComponent(incidentId)}`;
    }
    
    const response = await this.fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vip),
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to create VIP with status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('Created new VIP:', data);
    return data;
  }

  async updateVip(id: string, vip: Partial<Vip>, incidentId?: string): Promise<Vip> {
    console.log(`Updating VIP with ID: ${id}`, vip);
    
    let url = `${this.backendBaseUrl}/vips/${id}`;
    if (incidentId) {
      url += `?incident_id=${encodeURIComponent(incidentId)}`;
    }
    
    const response = await this.fetchWithAuth(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vip),
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to update VIP with status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('Updated VIP:', data);
    return data;
  }

  async deleteVip(id: string, incidentId?: string): Promise<void> {
    console.log(`Deleting VIP with ID: ${id}, Incident ID: ${incidentId}`);
    
    let url = `${this.backendBaseUrl}/vips/${id}`;
    if (incidentId) {
      url += `?incident_id=${encodeURIComponent(incidentId)}`;
    }
    
    const response = await this.fetchWithAuth(url, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to delete VIP with status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    
    console.log('VIP deleted successfully');
  }
}
