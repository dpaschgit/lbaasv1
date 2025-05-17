import { createApiRef, DiscoveryApi } from '@backstage/core-plugin-api';

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
  status?: string;
  created_at?: string;
  updated_at?: string;
  pool_members?: PoolMember[];
}

export interface PoolMember {
  server_name: string;
  server_ip: string;
  server_port: number;
  weight: number;
  status?: string;
}

export interface LbaasFrontendApi {
  getHealth(): Promise<{ status: string }>;
  login(username: string, password: string): Promise<{ token: string }>;
  getVips(): Promise<Vip[]>;
  getVip(id: string): Promise<Vip>;
  createVip(vipData: Partial<Vip>): Promise<Vip>;
  updateVip(id: string, vipData: Partial<Vip>): Promise<Vip>;
  deleteVip(id: string, servicenowIncidentId: string): Promise<void>;
}

export const lbaasFrontendApiRef = createApiRef<LbaasFrontendApi>({
  id: 'plugin.lbaas-frontend.api',
});

// Token storage key
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

export class LbaasFrontendApiClient implements LbaasFrontendApi {
  private backendBaseUrl: string = 'http://localhost:8000/api/v1';
  
  constructor(options: { discoveryApi?: DiscoveryApi } = {}) {
    console.log('Initializing LbaasFrontendApiClient');
  }

  private async getAuthToken(): Promise<string | null> {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    return token;
  }

  private async saveAuthToken(token: string): Promise<void> {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  private async clearAuthToken(): Promise<void> {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  private async getHeaders(requireAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      const token = await this.getAuthToken();
      if (!token && requireAuth) {
        throw new Error('Authentication required. Please login.');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async getHealth(): Promise<{ status: string }> {
    console.log('Checking API health');
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/health`, {
        method: 'GET',
        headers: await this.getHeaders(false),
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  }

  async login(username: string, password: string): Promise<{ token: string }> {
    console.log(`Attempting login with username: ${username}`);
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
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
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Login successful, token received');
      
      // Save token to localStorage
      await this.saveAuthToken(data.access_token);
      
      return { token: data.access_token };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async getVips(): Promise<Vip[]> {
    console.log('Fetching all VIPs');
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/vips`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.clearAuthToken();
          throw new Error('Authentication required. Please login.');
        }
        throw new Error(`Failed to fetch VIPs with status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Fetched ${data.length} VIPs`);
      return data;
    } catch (error) {
      console.error('Error fetching VIPs:', error);
      throw error;
    }
  }

  async getVip(id: string): Promise<Vip> {
    console.log(`Fetching VIP with ID: ${id}`);
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/vips/${id}`, {
        method: 'GET',
        headers: await this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.clearAuthToken();
          throw new Error('Authentication required. Please login.');
        }
        if (response.status === 404) {
          throw new Error(`VIP with ID ${id} not found`);
        }
        throw new Error(`Failed to fetch VIP with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched VIP details:', data);
      return data;
    } catch (error) {
      console.error(`Error fetching VIP ${id}:`, error);
      throw error;
    }
  }

  async createVip(vipData: Partial<Vip>): Promise<Vip> {
    console.log('Creating new VIP:', vipData);
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/vips`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(vipData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.clearAuthToken();
          throw new Error('Authentication required. Please login.');
        }
        
        let errorMessage = `Failed to create VIP with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('VIP created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating VIP:', error);
      throw error;
    }
  }

  async updateVip(id: string, vipData: Partial<Vip>): Promise<Vip> {
    console.log(`Updating VIP ${id}:`, vipData);
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/vips/${id}`, {
        method: 'PUT',
        headers: await this.getHeaders(),
        body: JSON.stringify(vipData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.clearAuthToken();
          throw new Error('Authentication required. Please login.');
        }
        if (response.status === 404) {
          throw new Error(`VIP with ID ${id} not found`);
        }
        
        let errorMessage = `Failed to update VIP with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('VIP updated successfully:', data);
      return data;
    } catch (error) {
      console.error(`Error updating VIP ${id}:`, error);
      throw error;
    }
  }

  async deleteVip(id: string, servicenowIncidentId: string): Promise<void> {
    console.log(`Deleting VIP ${id} with incident ID: ${servicenowIncidentId}`);
    
    try {
      const response = await fetch(`${this.backendBaseUrl}/vips/${id}`, {
        method: 'DELETE',
        headers: await this.getHeaders(),
        body: JSON.stringify({ servicenow_incident_id: servicenowIncidentId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.clearAuthToken();
          throw new Error('Authentication required. Please login.');
        }
        if (response.status === 404) {
          throw new Error(`VIP with ID ${id} not found`);
        }
        
        let errorMessage = `Failed to delete VIP with status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      console.log(`VIP ${id} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting VIP ${id}:`, error);
      throw error;
    }
  }
}
