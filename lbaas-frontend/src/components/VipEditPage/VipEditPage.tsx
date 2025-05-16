import React, { useEffect, useState, FormEvent } from 'react';
import { Typography, Grid, Button, CircularProgress, TextField, MenuItem, Paper } from '@material-ui/core';
import { ArrowBack, Save } from '@material-ui/icons';
import {
  InfoCard,
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, Vip } from '../../api';

// Token storage key - must match the one in api.ts
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

export const VipEditPage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  
  const [vip, setVip] = useState<Vip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Form fields
  const [vipFqdn, setVipFqdn] = useState('');
  const [vipIp, setVipIp] = useState('');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState('');
  const [environment, setEnvironment] = useState('');
  const [datacenter, setDatacenter] = useState('');
  const [appId, setAppId] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchVipDetails = async () => {
      try {
        setLoading(true);
        
        // Get VIP ID from URL
        const pathParts = window.location.pathname.split('/');
        const vipId = pathParts[pathParts.length - 2]; // Format: /lbaas-frontend/:vipId/edit
        
        if (!vipId) {
          throw new Error('VIP ID not found in URL');
        }
        
        console.log(`Fetching details for VIP ID: ${vipId}`);
        
        // Get token from localStorage
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!token) {
          setLoginOpen(true);
          throw new Error('Authentication required. Please login.');
        }
        
        // Fetch VIP details
        const vipData = await lbaasApi.getVip(vipId, token);
        setVip(vipData);
        
        // Populate form fields
        setVipFqdn(vipData.vip_fqdn || '');
        setVipIp(vipData.vip_ip || '');
        setPort(vipData.port?.toString() || '');
        setProtocol(vipData.protocol || '');
        setEnvironment(vipData.environment || '');
        setDatacenter(vipData.datacenter || '');
        setAppId(vipData.app_id || '');
        setOwner(vipData.owner || '');
        setStatus(vipData.status || '');
      } catch (e: any) {
        console.error('Error fetching VIP details:', e);
        setError(e);
        alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
        
        // If authentication error, redirect to main page for login
        if (e.message.includes('Authentication') || e.message.includes('login')) {
          navigateToMainPage();
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchVipDetails();
  }, []);

  const navigateToMainPage = () => {
    try {
      window.location.href = '/lbaas-frontend';
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!vipFqdn) {
      errors.vipFqdn = 'FQDN is required';
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(vipFqdn)) {
      errors.vipFqdn = 'Invalid FQDN format';
    }
    
    if (!vipIp) {
      errors.vipIp = 'IP Address is required';
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(vipIp)) {
      errors.vipIp = 'Invalid IP Address format';
    }
    
    if (!port) {
      errors.port = 'Port is required';
    } else {
      const portNum = parseInt(port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        errors.port = 'Port must be between 1 and 65535';
      }
    }
    
    if (!protocol) {
      errors.protocol = 'Protocol is required';
    }
    
    if (!environment) {
      errors.environment = 'Environment is required';
    }
    
    if (!datacenter) {
      errors.datacenter = 'Datacenter is required';
    }
    
    if (!appId) {
      errors.appId = 'App ID is required';
    }
    
    if (!owner) {
      errors.owner = 'Owner is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alertApi.post({ message: 'Please fix the form errors before submitting', severity: 'error' });
      return;
    }
    
    if (!vip) {
      alertApi.post({ message: 'VIP data not loaded', severity: 'error' });
      return;
    }
    
    try {
      setSaving(true);
      
      // Get token from localStorage
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setLoginOpen(true);
        throw new Error('Authentication required. Please login.');
      }
      
      // Prepare updated VIP data
      const updatedVip: Partial<Vip> = {
        vip_fqdn: vipFqdn,
        vip_ip: vipIp,
        port: parseInt(port, 10),
        protocol,
        environment,
        datacenter,
        app_id: appId,
        owner,
        status,
      };
      
      // Update VIP
      await lbaasApi.updateVip(vip.id, updatedVip, token);
      
      alertApi.post({ message: 'VIP updated successfully', severity: 'success' });
      
      // Navigate back to VIP list
      navigateToMainPage();
    } catch (e: any) {
      console.error('Error updating VIP:', e);
      alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
      
      // If authentication error, redirect to main page for login
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        navigateToMainPage();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loginOpen) {
    return (
      <Page themeId="tool">
        <Header title="Edit VIP" subtitle="Modify Load Balancer VIP Information" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={8} md={6} lg={4}>
              <InfoCard title="Authentication Required">
                <Typography>You need to login to edit VIP details.</Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={navigateToMainPage}
                  style={{ marginTop: 16 }}
                >
                  Go to Login
                </Button>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Edit VIP" subtitle="Modify Load Balancer VIP Information" />
        <Content>
          <Grid container spacing={3} justifyContent="center" alignItems="center" style={{ height: '50vh' }}>
            <Grid item>
              <CircularProgress />
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Edit VIP" subtitle="Modify Load Balancer VIP Information" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12}>
              <InfoCard title="Error">
                <Typography color="error">Error loading VIP details: {error.message}</Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={navigateToMainPage}
                  style={{ marginTop: 16 }}
                >
                  Back to VIP List
                </Button>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  if (!vip) {
    return (
      <Page themeId="tool">
        <Header title="Edit VIP" subtitle="Modify Load Balancer VIP Information" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12}>
              <InfoCard title="Not Found">
                <Typography>VIP not found or has been deleted.</Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={navigateToMainPage}
                  style={{ marginTop: 16 }}
                >
                  Back to VIP List
                </Button>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="Edit VIP" subtitle="Modify Load Balancer VIP Information" />
      <Content>
        <ContentHeader title={`Editing: ${vip.vip_fqdn || 'VIP'}`}>
          <Button
            variant="contained"
            color="default"
            onClick={navigateToMainPage}
            startIcon={<ArrowBack />}
          >
            Cancel
          </Button>
          <SupportButton>Edit information about this VIP.</SupportButton>
        </ContentHeader>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <InfoCard title="Basic Information">
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="FQDN"
                      value={vipFqdn}
                      onChange={(e) => setVipFqdn(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.vipFqdn}
                      helperText={formErrors.vipFqdn}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="IP Address"
                      value={vipIp}
                      onChange={(e) => setVipIp(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.vipIp}
                      helperText={formErrors.vipIp}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Port"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.port}
                      helperText={formErrors.port}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Protocol"
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.protocol}
                      helperText={formErrors.protocol}
                    >
                      <MenuItem value="HTTP">HTTP</MenuItem>
                      <MenuItem value="HTTPS">HTTPS</MenuItem>
                      <MenuItem value="TCP">TCP</MenuItem>
                      <MenuItem value="UDP">UDP</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </InfoCard>
            </Grid>
            
            <Grid item xs={12}>
              <InfoCard title="Environment Information">
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Environment"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.environment}
                      helperText={formErrors.environment}
                    >
                      <MenuItem value="production">Production</MenuItem>
                      <MenuItem value="staging">Staging</MenuItem>
                      <MenuItem value="development">Development</MenuItem>
                      <MenuItem value="test">Test</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Datacenter"
                      value={datacenter}
                      onChange={(e) => setDatacenter(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.datacenter}
                      helperText={formErrors.datacenter}
                    >
                      <MenuItem value="dc1">DC1</MenuItem>
                      <MenuItem value="dc2">DC2</MenuItem>
                      <MenuItem value="dc3">DC3</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="App ID"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.appId}
                      helperText={formErrors.appId}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Owner"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.owner}
                      helperText={formErrors.owner}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      margin="normal"
                      variant="outlined"
                      required
                      error={!!formErrors.status}
                      helperText={formErrors.status}
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="building">Building</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="error">Error</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </InfoCard>
            </Grid>
            
            <Grid item xs={12}>
              <Grid container justifyContent="flex-end" spacing={2}>
                <Grid item>
                  <Button
                    variant="contained"
                    color="default"
                    onClick={navigateToMainPage}
                  >
                    Cancel
                  </Button>
                </Grid>
                <Grid item>
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </form>
      </Content>
    </Page>
  );
};
