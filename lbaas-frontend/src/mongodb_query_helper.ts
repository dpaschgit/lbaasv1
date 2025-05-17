import { api } from '../../api';

/**
 * MongoDB Query Helper for LBaaS Testing
 * 
 * This module provides helper functions to query the MongoDB database
 * for testing and monitoring purposes.
 */

/**
 * Fetches the latest VIP configuration from MongoDB
 * @param vipId The ID of the VIP to fetch
 * @param token Authentication token
 * @returns The latest configuration or null if not found
 */
export const fetchLatestVipConfig = async (vipId: string, token: string) => {
  try {
    const response = await api.get(`/admin/mongo/vip-config/${vipId}`, token);
    if (response.success) {
      return response.data;
    }
    console.error('Error fetching VIP config:', response.error);
    return null;
  } catch (error) {
    console.error('Exception fetching VIP config:', error);
    return null;
  }
};

/**
 * Monitors MongoDB for changes to a VIP configuration
 * @param vipId The ID of the VIP to monitor
 * @param token Authentication token
 * @param callback Function to call when changes are detected
 * @param interval Polling interval in milliseconds (default: 2000)
 * @returns A function to stop monitoring
 */
export const monitorVipConfigChanges = (
  vipId: string, 
  token: string, 
  callback: (config: any) => void,
  interval = 2000
) => {
  let lastConfig = null;
  const intervalId = setInterval(async () => {
    const config = await fetchLatestVipConfig(vipId, token);
    if (config && JSON.stringify(config) !== JSON.stringify(lastConfig)) {
      lastConfig = config;
      callback(config);
    }
  }, interval);
  
  return () => clearInterval(intervalId);
};

/**
 * Fetches all VIPs owned by the current user
 * @param token Authentication token
 * @returns Array of VIPs or empty array if none found
 */
export const fetchUserVips = async (token: string) => {
  try {
    const response = await api.get('/vips', token);
    if (response.success) {
      return response.data;
    }
    console.error('Error fetching user VIPs:', response.error);
    return [];
  } catch (error) {
    console.error('Exception fetching user VIPs:', error);
    return [];
  }
};

/**
 * Fetches all servers from CMDB filtered by environment and datacenter
 * @param environment Environment filter (DEV, UAT, PROD)
 * @param datacenter Datacenter filter (LADC, NYDC, UKDC)
 * @param token Authentication token
 * @returns Array of servers or empty array if none found
 */
export const fetchFilteredServers = async (
  environment: string,
  datacenter: string,
  token: string
) => {
  try {
    const response = await api.get(
      `/cmdb/servers?environment=${environment}&datacenter=${datacenter}`,
      token
    );
    if (response.success) {
      return response.data;
    }
    console.error('Error fetching servers:', response.error);
    return [];
  } catch (error) {
    console.error('Exception fetching servers:', error);
    return [];
  }
};

/**
 * Checks if a user has access to a specific VIP
 * @param vipId The ID of the VIP to check
 * @param token Authentication token
 * @returns Boolean indicating if user has access
 */
export const checkVipAccess = async (vipId: string, token: string) => {
  try {
    const response = await api.get(`/vips/${vipId}/access-check`, token);
    return response.success && response.data.hasAccess;
  } catch (error) {
    console.error('Exception checking VIP access:', error);
    return false;
  }
};

/**
 * Fetches the translator output files for a VIP
 * @param vipId The ID of the VIP
 * @param token Authentication token
 * @returns Object containing file paths and content
 */
export const fetchTranslatorOutput = async (vipId: string, token: string) => {
  try {
    const response = await api.get(`/admin/translator-output/${vipId}`, token);
    if (response.success) {
      return response.data;
    }
    console.error('Error fetching translator output:', response.error);
    return null;
  } catch (error) {
    console.error('Exception fetching translator output:', error);
    return null;
  }
};
