import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

// Define interfaces for VIP-related data structures based on backend models
export interface Monitor {
  type: string;
  port: number;
  send?: string;
  receive?: string;
}

export interface Persistence {
  type: string;
  timeout: number;
}

export interface PoolMember {
  ip: string;
  port: number;
}

export interface VipBase {
  vip_fqdn: string;
  vip_ip?: string;
  app_id: string;
  environment: string;
  datacenter: string;
  primary_contact_email: string;
  secondary_contact_email?: string;
  team_distribution_email?: string;
  monitor: Monitor;
  persistence?: Persistence;
  ssl_cert_name?: string;
  mtls_ca_cert_name?: string;
  pool: PoolMember[];
  owner: string;
  port: number;
  protocol: string;
  lb_method?: string;
}

export interface Vip extends VipBase {
  id: string;
  created_at: string;
  updated_at: string;
  status?: string; // Added for UI display purposes
}

export interface VipCreate extends VipBase {}

export interface VipUpdate {
  vip_fqdn?: string;
  vip_ip?: string;
  app_id?: string;
  environment?: string;
  datacenter?: string;
  primary_contact_email?: string;
  secondary_contact_email?: string;
  team_distribution_email?: string;
  monitor?: Monitor;
  persistence?: Persistence;
  ssl_cert_name?: string;
  mtls_ca_cert_name?: string;
  pool?: PoolMember[];
  port?: number;
  protocol?: string;
  lb_method?: string;
}

export interface VipDeletePayload {
  servicenow_incident_id: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

// Define the interface for your plugin's API
export interface LbaasApi {
  // Authentication method
  login(username: string, password: string): Promise<AuthToken>;
  
  // Health check
  getHealth(): Promise<{ status: string }>;
  
  // VIP CRUD operations
  listVips(token: string): Promise<Vip[]>;
  getVip(id: string, token: string): Promise<Vip>;
  createVip(vip: VipCreate, servicenowIncidentId: string, token: string): Promise<ApiResponse<Vip>>;
  updateVip(id: string, vip: VipUpdate, servicenowIncidentId: string, token: string): Promise<ApiResponse<Vip>>;
  deleteVip(id: string, servicenowIncidentId: string, token: string): Promise<ApiResponse<void>>;
}

// Create an API reference for your plugin's API
export const lbaasFrontendApiRef = createApiRef<LbaasApi>({
  id: 'plugin.lbaas.service',
});

// Implementation of the LbaasFrontendApiClient
export class LbaasFrontendApiClient implements LbaasApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly baseUrl: string = 'http://localhost:8000'; // Base URL for direct API calls

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  // Explicit login method to get a token
  async login(username: string, password: string): Promise<AuthToken> {
    console.log(`[DEBUG] Attempting to login with username: ${username}`);
    
    try {
      // Create form data for OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      console.log(`[DEBUG] Login request URL: ${this.baseUrl}/api/v1/auth/token`);
      console.log(`[DEBUG] Login request body: ${formData.toString()}`);
      
      const response = await this.fetchApi.fetch(`${this.baseUrl}/api/v1/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      
      console.log(`[DEBUG] Login response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] Login error response: ${errorText}`);
        throw new Error(`Authentication failed: ${response.statusText} - ${errorText}`);
      }
      
      const tokenData = await response.json();
      console.log(`[DEBUG] Login successful, received token: ${JSON.stringify(tokenData)}`);
      
      return tokenData;
    } catch (error) {
      console.error('[DEBUG] Login error:', error);
      throw new Error(`Failed to authenticate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper method to make API calls with explicit token
  private async callApi<T>(path: string, token: string, options?: RequestInit): Promise<T> {
    try {
      const url = `${this.baseUrl}${path}`;
      console.log(`[DEBUG] API call to: ${url}`);
      console.log(`[DEBUG] Using token: ${token.substring(0, 10)}...`);
      
      const headers = {
        ...options?.headers,
        'Authorization': `Bearer ${token}`,
      };
      
      console.log(`[DEBUG] Request headers: ${JSON.stringify(headers)}`);
      
      const response = await this.fetchApi.fetch(url, {
        ...options,
        headers,
      });
      
      console.log(`[DEBUG] API response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] API error response: ${errorText}`);
        throw new Error(`API call failed: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`[DEBUG] API response data: ${JSON.stringify(data).substring(0, 200)}...`);
      
      return data;
    } catch (error) {
      console.error(`[DEBUG] API call error:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async getHealth(): Promise<{ status: string }> {
    console.log(`[DEBUG] Getting health status`);
    try {
      const response = await this.fetchApi.fetch(`${this.baseUrl}/health`);
      console.log(`[DEBUG] Health response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DEBUG] Health error: ${errorText}`);
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`[DEBUG] Health data: ${JSON.stringify(data)}`);
      return data;
    } catch (error) {
      console.error(`[DEBUG] Health error:`, error);
      throw error;
    }
  }

  async listVips(token: string): Promise<Vip[]> {
    return this.callApi<Vip[]>('/api/v1/vips', token);
  }

  async getVip(id: string, token: string): Promise<Vip> {
    return this.callApi<Vip>(`/api/v1/vips/${id}`, token);
  }

  async createVip(vip: VipCreate, servicenowIncidentId: string, token: string): Promise<ApiResponse<Vip>> {
    return this.callApi<ApiResponse<Vip>>(`/api/v1/vips?servicenow_incident_id=${servicenowIncidentId}`, token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vip),
    });
  }

  async updateVip(id: string, vip: VipUpdate, servicenowIncidentId: string, token: string): Promise<ApiResponse<Vip>> {
    return this.callApi<ApiResponse<Vip>>(`/api/v1/vips/${id}?servicenow_incident_id=${servicenowIncidentId}`, token, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vip),
    });
  }

  async deleteVip(id: string, servicenowIncidentId: string, token: string): Promise<ApiResponse<void>> {
    const payload: VipDeletePayload = {
      servicenow_incident_id: servicenowIncidentId
    };
    
    return this.callApi<ApiResponse<void>>(`/api/v1/vips/${id}`, token, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
}
