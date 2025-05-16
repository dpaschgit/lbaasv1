import { createApiRef } from '@backstage/core-plugin-api';

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
}

export interface PoolMember {
  id: string;
  server_name: string;
  server_ip: string;
  server_port: number;
  weight: number;
  status: string;
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
}

// Create an API reference
export const lbaasFrontendApiRef = createApiRef<LbaasApi>({
  id: 'plugin.lbaas-frontend.api',
});

// Token storage key
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

// API implementation
export class LbaasFrontendApiClient implements LbaasApi {
  // Store token in localStorage
  private storeToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  // Get token from localStorage
  private getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }

  // Clear token from localStorage
  private clearToken(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  // Login method - uses OAuth2 password flow
  async login(username: string, password: string): Promise<AuthToken> {
    try {
      console.log(`Attempting login with username: ${username}`);
      
      // Create form data for OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      // Use the direct Backstage proxy path that maps to /api/v1/auth/token
      const response = await fetch('/lbaas/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Login failed:', errorData);
        throw new Error(errorData.message || `Login failed with status: ${response.status}`);
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

      const response = await fetch('/lbaas/vips', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(`Failed to fetch VIPs: ${response.statusText}`);
      }

      return await response.json();
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

      const response = await fetch(`/lbaas/vips/${id}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(`Failed to fetch VIP: ${response.statusText}`);
      }

      return await response.json();
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

      const response = await fetch('/lbaas/vips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(vip),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(`Failed to create VIP: ${response.statusText}`);
      }

      return await response.json();
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

      const response = await fetch(`/lbaas/vips/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...vip,
          servicenow_incident_id: incidentId
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(`Failed to update VIP: ${response.statusText}`);
      }

      return await response.json();
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

      const response = await fetch(`/lbaas/vips/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ servicenow_incident_id: incidentId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken(); // Clear invalid token
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(`Failed to delete VIP: ${response.statusText}`);
      }

      return { success: true, message: 'VIP deleted successfully' };
    } catch (error) {
      console.error('Error deleting VIP:', error);
      throw error;
    }
  }
}
