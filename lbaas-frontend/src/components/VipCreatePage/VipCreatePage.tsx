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

export const VipCreatePage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Form fields
  const [vipFqdn, setVipFqdn] = useState('');
  const [vipIp, setVipIp] = useState('');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState('HTTP');
  const [environment, setEnvironment] = useState('production');
  const [datacenter, setDatacenter] = useState('dc1');
  const [appId, setAppId] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    // Check for authentication token
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setLoginOpen(true);
      alertApi.post({ message: 'Authentication required. Please login.', severity: 'warning' });
    }
  }, []);

  const navigateToMainPage = () => {
    try {
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('/lbaas-frontend')[0];
      window.location.href = `${baseUrl}/lbaas-frontend`;
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
    
    try {
      setSaving(true);
      
      // Get token from localStorage
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setLoginOpen(true);
        throw new Error('Authentication required. Please login.');
      }
      
      // Prepare VIP data
      const newVip: Partial<Vip> = {
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
      
      // Create VIP
      await lbaasApi.createVip(newVip, token);
      
      alertApi.post({ message: 'VIP created successfully', severity: 'success' });
      
      // Navigate back to VIP list
      navigateToMainPage();
    } catch (e: any) {
      console.error('Error creating VIP:', e);
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
        <Header title="Create VIP" subtitle="Create a New Load Balancer VIP" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={8} md={6} lg={4}>
              <InfoCard title="Authentication Required">
                <Typography>You need to login to create a VIP.</Typography>
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

  return (
    <Page themeId="tool">
      <Header title="Create VIP" subtitle="Create a New Load Balancer VIP" />
      <Content>
        <ContentHeader title="Create New VIP">
          <Button
            variant="contained"
            color="default"
            onClick={navigateToMainPage}
            startIcon={<ArrowBack />}
          >
            Cancel
          </Button>
          <SupportButton>Create a new Virtual IP Address for your load balancer.</SupportButton>
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
                      helperText={formErrors.vipFqdn || "e.g., app.example.com"}
                      placeholder="app.example.com"
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
                      helperText={formErrors.vipIp || "e.g., 192.168.1.10"}
                      placeholder="192.168.1.10"
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
                      helperText={formErrors.port || "Valid range: 1-65535"}
                      placeholder="80"
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
                      helperText={formErrors.appId || "Application identifier"}
                      placeholder="app-123"
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
                      helperText={formErrors.owner || "Team or individual responsible"}
                      placeholder="platform-team"
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
                      helperText={formErrors.status || "Initial status for the VIP"}
                    >
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="building">Building</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
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
                    {saving ? 'Creating...' : 'Create VIP'}
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
