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
  expires_in: number;
}

export interface DeleteResponse {
  success: boolean;
  message?: string;
}

export interface LbaasApi {
  login(username: string, password: string): Promise<AuthToken>;
  listVips(token?: string): Promise<Vip[]>;
  getVip(id: string, token?: string): Promise<Vip>;
  createVip(vip: Partial<Vip>, token?: string): Promise<Vip>;
  updateVip(id: string, vip: Partial<Vip>, token?: string): Promise<Vip>;
  deleteVip(id: string, incidentId: string, token?: string): Promise<DeleteResponse>;
}

// Create an API reference
export const lbaasFrontendApiRef = createApiRef<LbaasApi>({
  id: 'plugin.lbaas-frontend.api',
});

// Token storage keys
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

// API implementation
export class LbaasFrontendApiClient implements LbaasApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

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

  // Login method
  async login(username: string, password: string): Promise<AuthToken> {
    const baseUrl = await this.discoveryApi.getBaseUrl('lbaas');
    const response = await this.fetchApi.fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to login');
    }

    const data = await response.json();
    // Store the token for future use
    this.storeToken(data.access_token);
    return data;
  }

  // List VIPs
  async listVips(token?: string): Promise<Vip[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('lbaas');
    const authToken = token || this.getStoredToken();
    
    if (!authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/vips`, {
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
  }

  // Get a specific VIP
  async getVip(id: string, token?: string): Promise<Vip> {
    const baseUrl = await this.discoveryApi.getBaseUrl('lbaas');
    const authToken = token || this.getStoredToken();
    
    if (!authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/vips/${id}`, {
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
  }

  // Create a new VIP
  async createVip(vip: Partial<Vip>, token?: string): Promise<Vip> {
    const baseUrl = await this.discoveryApi.getBaseUrl('lbaas');
    const authToken = token || this.getStoredToken();
    
    if (!authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/vips`, {
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
  }

  // Update an existing VIP
  async updateVip(id: string, vip: Partial<Vip>, token?: string): Promise<Vip> {
    const baseUrl = await this.discoveryApi.getBaseUrl('lbaas');
    const authToken = token || this.getStoredToken();
    
    if (!authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/vips/${id}`, {
      method: 'PUT',
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
      throw new Error(`Failed to update VIP: ${response.statusText}`);
    }

    return await response.json();
  }

  // Delete a VIP
  async deleteVip(id: string, incidentId: string, token?: string): Promise<DeleteResponse> {
    const baseUrl = await this.discoveryApi.getBaseUrl('lbaas');
    const authToken = token || this.getStoredToken();
    
    if (!authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/vips/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ incident_id: incidentId }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken(); // Clear invalid token
        throw new Error('Authentication expired. Please login again.');
      }
      throw new Error(`Failed to delete VIP: ${response.statusText}`);
    }

    return await response.json();
  }
}
