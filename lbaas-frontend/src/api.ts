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
  expiry?: Date;
}

// Define the interface for your plugin's API
export interface LbaasApi {
  // Authentication
  login(username: string, password: string): Promise<AuthToken>;
  
  // Health check
  getHealth(): Promise<{ status: string }>;
  
  // VIP CRUD operations
  listVips(token?: string): Promise<Vip[]>;
  getVip(id: string, token?: string): Promise<Vip>;
  createVip(vip: VipCreate, servicenowIncidentId: string, token?: string): Promise<ApiResponse<Vip>>;
  updateVip(id: string, vip: VipUpdate, servicenowIncidentId: string, token?: string): Promise<ApiResponse<Vip>>;
  deleteVip(id: string, servicenowIncidentId: string, token?: string): Promise<ApiResponse<void>>;
}

// Create an API reference for your plugin's API
export const lbaasFrontendApiRef = createApiRef<LbaasApi>({
  id: 'plugin.lbaas.service',
});

// Implementation of the LbaasFrontendApiClient
export class LbaasFrontendApiClient implements LbaasApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private token: AuthToken | null = null;
  private readonly baseUrl: string = 'http://localhost:8000'; // Base URL for direct API calls

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  // Implement the login method that was missing
  async login(username: string, password: string): Promise<AuthToken> {
    try {
      console.log('Authenticating with backend API...');
      
      // Create form data for OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await this.fetchApi.fetch(`${this.baseUrl}/api/v1/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${response.statusText} - ${errorText}`);
      }
      
      this.token = await response.json();
      console.log('Authentication successful');
      return this.token;
    } catch (error) {
      console.error('Authentication error:', error);
      throw new Error(`Failed to authenticate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper method to make authenticated API calls
  private async callApi<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
    try {
      // Use provided token or stored token
      const authToken = token || this.token?.access_token;
      
      if (!authToken) {
        throw new Error('No authentication token available. Please login first.');
      }
      
      // Make the API call with the token
      const response = await this.fetchApi.fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          ...options?.headers,
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      // Handle non-OK responses
      if (!response.ok) {
        // For errors, extract error message from response
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `API call failed: ${response.statusText}`);
      }
      
      // Return successful response
      return response.json();
    } catch (error) {
      console.error(`Error calling API ${path}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async getHealth(): Promise<{ status: string }> {
    return this.callApi<{ status: string }>('/health');
  }

  async listVips(token?: string): Promise<Vip[]> {
    return this.callApi<Vip[]>('/api/v1/vips', token);
  }

  async getVip(id: string, token?: string): Promise<Vip> {
    return this.callApi<Vip>(`/api/v1/vips/${id}`, token);
  }

  async createVip(vip: VipCreate, servicenowIncidentId: string, token?: string): Promise<ApiResponse<Vip>> {
    return this.callApi<ApiResponse<Vip>>(`/api/v1/vips?servicenow_incident_id=${servicenowIncidentId}`, token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vip),
    });
  }

  async updateVip(id: string, vip: VipUpdate, servicenowIncidentId: string, token?: string): Promise<ApiResponse<Vip>> {
    return this.callApi<ApiResponse<Vip>>(`/api/v1/vips/${id}?servicenow_incident_id=${servicenowIncidentId}`, token, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vip),
    });
  }

  async deleteVip(id: string, servicenowIncidentId: string, token?: string): Promise<ApiResponse<void>> {
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
