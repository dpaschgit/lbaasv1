import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

// Define the interface for your plugin's API
export interface LbaasApi {
  getHealth(): Promise<{ status: string }>;
  // Add other methods your API will expose, for example:
  // listVips(): Promise<any[]>;
}

// Create an API reference for your plugin's API
// Renamed from lbaasApiRef to lbaasFrontendApiRef as per plugin.ts expectation
export const lbaasFrontendApiRef = createApiRef<LbaasApi>({
  id: 'plugin.lbaas.service',
});

// Basic implementation of the LbaasFrontendApiClient
export class LbaasFrontendApiClient implements LbaasApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  async getHealth(): Promise<{ status: string }> {
    const proxyUrl = await this.discoveryApi.getBaseUrl('proxy');
    // Assuming your backend health check is at /lbaas/health (proxied)
    // The '/lbaas' part matches the proxy config in app-config.yaml
    const response = await this.fetchApi.fetch(`${proxyUrl}/lbaas/health`);
    if (!response.ok) {
      throw new Error(`Failed to fetch health: ${response.statusText}`);
    }
    return response.json();
  }

  // Implement other methods here, for example:
  // async listVips(): Promise<any[]> {
  //   const proxyUrl = await this.discoveryApi.getBaseUrl('proxy');
  //   const response = await this.fetchApi.fetch(`${proxyUrl}/lbaas/vips`);
  //   if (!response.ok) {
  //     throw new Error(`Failed to list VIPs: ${response.statusText}`);
  //   }
  //   return response.json();
  // }
}

