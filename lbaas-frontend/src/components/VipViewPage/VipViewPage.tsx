// Replace the parameter extraction and fetchVipDetails function in VipViewPage.tsx
import { Link as RouterLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@material-ui/core';
import { ArrowBack, Edit, LockOpen } from '@material-ui/icons';


// Parameter extraction - place this near the beginning of your component
const params = useParams<{ vipId?: string, '*'?: string }>();
const location = useLocation();
const pathSegments = location.pathname.split('/');
const vipId = params.vipId || 
              (pathSegments.length > 2 ? pathSegments[pathSegments.length - 2] : undefined);

console.log('Path segments:', pathSegments);
console.log('Extracted vipId:', vipId);
console.log('Full location:', location);
console.log('Params from useParams:', params);

// Updated fetchVipDetails function with robust parameter handling
const fetchVipDetails = async () => {
  console.log('Attempting to fetch VIP details with ID:', vipId);
  
  if (!vipId) {
    console.error('VIP ID not found in URL. Path segments:', pathSegments);
    setError(new Error('VIP ID not found in URL. Please check the URL format.'));
    setLoading(false);
    return;
  }
  
  try {
    setLoading(true);
    
    // Check if we have cached data in sessionStorage
    const cachedData = sessionStorage.getItem(`vip_${vipId}`);
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        setVipDetails(parsedData);
        setUsingCachedData(true);
        setUsingMockData(false);
        console.log('Using cached VIP data from sessionStorage for ID:', vipId);
        // Continue fetching fresh data in the background
      } catch (parseError) {
        console.error('Error parsing cached VIP data:', parseError);
        // Continue with API fetch if parsing fails
      }
    }
    
    // Check if authenticated
    if (!lbaasApi.isAuthenticated()) {
      console.log('Not authenticated, using mock or cached data for ID:', vipId);
      if (!cachedData) {
        // Use mock data if no cached data available
        setVipDetails({
          ...mockVipDetails,
          id: vipId // Ensure the mock data uses the correct ID
        });
        setUsingMockData(true);
        setUsingCachedData(false);
      }
      setLoading(false);
      return;
    }
    
    try {
      // Use the API client to fetch VIP details
      console.log('Calling API to get VIP with ID:', vipId);
      const data = await lbaasApi.getVip(vipId);
      
      if (data) {
        console.log('Successfully retrieved VIP data:', data);
        // Ensure VIP has a status property to prevent errors
        const safeData = {
          ...data,
          status: data.status || 'Unknown'
        };
        setVipDetails(safeData);
        setUsingCachedData(false);
        setUsingMockData(false);
        
        // Cache the data in sessionStorage for future use
        try {
          sessionStorage.setItem(`vip_${vipId}`, JSON.stringify(safeData));
        } catch (storageError) {
          console.error('Error caching VIP data:', storageError);
          // Non-critical error, continue without caching
        }
      } else {
        console.warn('API returned no data for VIP ID:', vipId);
        // If no data returned but no error thrown, check if we already have cached data
        if (!cachedData) {
          // Use mock data if no cached data available
          setVipDetails({
            ...mockVipDetails,
            id: vipId // Ensure the mock data uses the correct ID
          });
          setUsingMockData(true);
          setUsingCachedData(false);
          setError(new Error(`VIP with ID ${vipId} not found.`));
          alertApi.post({ message: `VIP with ID ${vipId} not found.`, severity: 'warning' });
        }
      }
    } catch (apiError: any) {
      console.error('API call failed for VIP ID:', vipId, apiError);
      
      // If we don't have cached data, use mock data
      if (!cachedData) {
        setVipDetails({
          ...mockVipDetails,
          id: vipId // Ensure the mock data uses the correct ID
        });
        setUsingMockData(true);
        setUsingCachedData(false);
        setError(apiError);
        alertApi.post({ message: `Error fetching VIP details: ${apiError.message}`, severity: 'error' });
      }
      // Otherwise, we'll continue using the cached data
    }
  } catch (e: any) {
    console.error('General error in fetchVipDetails for ID:', vipId, e);
    setError(e);
    alertApi.post({ message: `Error fetching VIP details: ${e.message}`, severity: 'error' });
    
    // Use mock data if no cached data available
    if (!vipDetails) {
      setVipDetails({
        ...mockVipDetails,
        id: vipId // Ensure the mock data uses the correct ID
      });
      setUsingMockData(true);
    }
  } finally {
    setLoading(false);
  }
};
