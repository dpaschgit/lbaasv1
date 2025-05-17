import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

// Define the API interface
export interface Vip {
  id: string;
  vip_fqdn: string;
  vip_ip: string;
  port: number;
  protocol: string;
  environment: string;
  datacenter: string;
  app_id: string;
  owner: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  pool_members?: PoolMember[];
  secondary_contact_email?: string[];
}

export interface PoolMember {
  id?: string;
  server_name: string;
  server_ip: string;
  server_port: number;
  weight: number;
  status?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface DeleteResponse {
  success: boolean;
  message?: string;
}

export interface LbaasApi {
  login(username: string, password: string): Promise<AuthToken>;
  getVips(): Promise<Vip[]>;
  getVip(id: string): Promise<Vip>;
  createVip(vip: Partial<Vip>): Promise<Vip>;
  updateVip(id: string, vip: Partial<Vip>, incidentId: string): Promise<Vip>;
  deleteVip(id: string, incidentId: string): Promise<DeleteResponse>;
  getHealth(): Promise<{ status: string }>;
}

// Create an API reference with a properly formatted ID
export const lbaasFrontendApiRef = createApiRef<LbaasApi>({
  id: 'plugin.lbaas.service',
});

// Token storage key
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

// API implementation
export class LbaasFrontendApiClient implements LbaasApi {
  private readonly discoveryApi?: DiscoveryApi;
  private readonly fetchApi?: FetchApi;
  
  // Direct backend URL - change this if your backend is running on a different host or port
  private backendBaseUrl: string = 'http://localhost:8000/api/v1';

  constructor(options?: { discoveryApi?: DiscoveryApi; fetchApi?: FetchApi; backendUrl?: string }) {
    this.discoveryApi = options?.discoveryApi;
    this.fetchApi = options?.fetchApi;
    
    // Allow overriding the backend URL if provided
    if (options?.backendUrl) {
      this.backendBaseUrl = options.backendUrl;
    }
    
    console.log(`LbaasFrontendApiClient initialized with backend URL: ${this.backendBaseUrl}`);
  }

  // Store token in localStorage
  private storeToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    console.log('Token stored in localStorage');
  }

  // Get token from localStorage
  private getStoredToken(): string | null {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    console.log('Retrieved token from localStorage:', token ? 'Token exists' : 'No token found');
    return token;
  }

  // Clear token from localStorage
  private clearToken(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    console.log('Token cleared from localStorage');
  }

  // Login method - uses OAuth2 password flow
  async login(username: string, password: string): Promise<AuthToken> {
    try {
      console.log(`Attempting login with username: ${username}`);
      
      // Create form data for OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      // Use direct backend URL for authentication
      const url = `${this.backendBaseUrl}/auth/token`;
      console.log(`Making POST request to ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        // Enable credentials for CORS if needed
        credentials: 'include',
      });

      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = `Login failed with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        console.error('Login failed:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Login successful, received token');
      
      // Store the token for future use
      this.storeToken(data.access_token);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // List VIPs
  async getVips(): Promise<Vip[]> {
    try {
      const authToken = this.getStoredToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const url = `${this.backendBaseUrl}/vips`;
      console.log(`Making GET request to ${url}`);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        credentials: 'include',
      });

      console.log('getVips response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(`Failed to fetch VIPs: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Retrieved ${data.length} VIPs`);
      return data;
    } catch (error) {
      console.error('Error listing VIPs:', error);
      throw error;
    }
  }

  // Get a specific VIP
  async getVip(id: string): Promise<Vip> {
    try {
      const authToken = this.getStoredToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const url = `${this.backendBaseUrl}/vips/${id}`;
      console.log(`Making GET request to ${url}`);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        credentials: 'include',
      });

      console.log('getVip response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(`Failed to fetch VIP: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Retrieved VIP details:', data.id);
      return data;
    } catch (error) {
      console.error('Error getting VIP:', error);
      throw error;
    }
  }

  // Create a new VIP
  async createVip(vip: Partial<Vip>): Promise<Vip> {
    try {
      const authToken = this.getStoredToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const url = `${this.backendBaseUrl}/vips`;
      console.log(`Making POST request to ${url}`);
      console.log('VIP data:', vip);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(vip),
        credentials: 'include',
      });

      console.log('createVip response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        
        let errorMessage = `Failed to create VIP: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Created new VIP:', data.id);
      return data;
    } catch (error) {
      console.error('Error creating VIP:', error);
      throw error;
    }
  }

  // Update an existing VIP
  async updateVip(id: string, vip: Partial<Vip>, incidentId: string): Promise<Vip> {
    try {
      const authToken = this.getStoredToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const url = `${this.backendBaseUrl}/vips/${id}`;
      console.log(`Making PUT request to ${url}`);
      console.log('Update data:', { ...vip, servicenow_incident_id: incidentId });
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...vip,
          servicenow_incident_id: incidentId
        }),
        credentials: 'include',
      });

      console.log('updateVip response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        
        let errorMessage = `Failed to update VIP: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Updated VIP:', data.id);
      return data;
    } catch (error) {
      console.error('Error updating VIP:', error);
      throw error;
    }
  }

  // Delete a VIP
  async deleteVip(id: string, incidentId: string): Promise<DeleteResponse> {
    try {
      const authToken = this.getStoredToken();
      
      if (!authToken) {
        throw new Error('Authentication required');
      }

      const url = `${this.backendBaseUrl}/vips/${id}`;
      console.log(`Making DELETE request to ${url}`);
      console.log('Delete payload:', { servicenow_incident_id: incidentId });
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ servicenow_incident_id: incidentId }),
        credentials: 'include',
      });

      console.log('deleteVip response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        
        let errorMessage = `Failed to delete VIP: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        
        throw new Error(errorMessage);
      }

      console.log('VIP deleted successfully');
      return { success: true, message: 'VIP deleted successfully' };
    } catch (error) {
      console.error('Error deleting VIP:', error);
      throw error;
    }
  }

  // Health check
  async getHealth(): Promise<{ status: string }> {
    try {
      const url = `${this.backendBaseUrl}/health`;
      console.log(`Making GET request to ${url}`);
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      console.log('Health check response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch health: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Health check result:', data);
      return data;
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  }
}
