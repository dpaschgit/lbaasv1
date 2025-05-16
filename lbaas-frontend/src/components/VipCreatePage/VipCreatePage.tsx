import React, { useState, FormEvent } from 'react';
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
  const [error, setError] = useState<Error | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Form fields
  const [vipFqdn, setVipFqdn] = useState('');
  const [vipIp, setVipIp] = useState('');
  const [port, setPort] = useState('');
  const [protocol, setProtocol] = useState('HTTP');
  const [environment, setEnvironment] = useState('production');
  const [datacenter, setDatacenter] = useState('dc1');
  const [appId, setAppId] = useState('');
  const [poolMembers, setPoolMembers] = useState([
    { server_name: '', server_ip: '', server_port: '', weight: '1', status: 'active' }
  ]);

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
    
    // Validate pool members
    const poolMemberErrors: Record<string, Record<string, string>> = {};
    let hasPoolMemberErrors = false;
    
    poolMembers.forEach((member, index) => {
      const memberErrors: Record<string, string> = {};
      
      if (!member.server_name) {
        memberErrors.server_name = 'Server name is required';
        hasPoolMemberErrors = true;
      }
      
      if (!member.server_ip) {
        memberErrors.server_ip = 'Server IP is required';
        hasPoolMemberErrors = true;
      } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(member.server_ip)) {
        memberErrors.server_ip = 'Invalid IP Address format';
        hasPoolMemberErrors = true;
      }
      
      if (!member.server_port) {
        memberErrors.server_port = 'Server port is required';
        hasPoolMemberErrors = true;
      } else {
        const portNum = parseInt(member.server_port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
          memberErrors.server_port = 'Port must be between 1 and 65535';
          hasPoolMemberErrors = true;
        }
      }
      
      if (Object.keys(memberErrors).length > 0) {
        poolMemberErrors[index] = memberErrors;
      }
    });
    
    if (hasPoolMemberErrors) {
      errors.poolMembers = JSON.stringify(poolMemberErrors);
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddPoolMember = () => {
    setPoolMembers([
      ...poolMembers,
      { server_name: '', server_ip: '', server_port: '', weight: '1', status: 'active' }
    ]);
  };

  const handleRemovePoolMember = (index: number) => {
    if (poolMembers.length > 1) {
      const updatedMembers = [...poolMembers];
      updatedMembers.splice(index, 1);
      setPoolMembers(updatedMembers);
    }
  };

  const handlePoolMemberChange = (index: number, field: string, value: string) => {
    const updatedMembers = [...poolMembers];
    updatedMembers[index] = { ...updatedMembers[index], [field]: value };
    setPoolMembers(updatedMembers);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alertApi.post({ message: 'Please fix the form errors before submitting', severity: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      
      // Get token from localStorage
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        throw new Error('Authentication required. Please login.');
      }
      
      // Prepare VIP data
      const vipData: Partial<Vip> = {
        vip_fqdn: vipFqdn,
        vip_ip: vipIp,
        port: parseInt(port, 10),
        protocol,
        environment,
        datacenter,
        app_id: appId,
        pool_members: poolMembers.map(member => ({
          server_name: member.server_name,
          server_ip: member.server_ip,
          server_port: parseInt(member.server_port, 10),
          weight: parseInt(member.weight, 10),
          status: member.status
        }))
      };
      
      // Create VIP
      await lbaasApi.createVip(vipData, token);
      
      alertApi.post({ message: 'VIP created successfully', severity: 'success' });
      
      // Navigate back to VIP list
      navigateToMainPage();
    } catch (e: any) {
      console.error('Error creating VIP:', e);
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

  // Parse pool member errors if they exist
  const getPoolMemberError = (index: number, field: string) => {
    if (!formErrors.poolMembers) return '';
    
    try {
      const poolMemberErrors = JSON.parse(formErrors.poolMembers);
      return poolMemberErrors[index]?.[field] || '';
    } catch (e) {
      return '';
    }
  };

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
          <SupportButton>Create a new Virtual IP Address (VIP) for your application.</SupportButton>
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
                      placeholder="e.g., app.example.com"
                      required
                      error={!!formErrors.vipFqdn}
                      helperText={formErrors.vipFqdn || "Fully qualified domain name for the VIP"}
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
                      placeholder="e.g., 192.168.1.10"
                      required
                      error={!!formErrors.vipIp}
                      helperText={formErrors.vipIp || "IP address for the VIP"}
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
                      placeholder="e.g., 80"
                      required
                      error={!!formErrors.port}
                      helperText={formErrors.port || "Port number (1-65535)"}
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
                      helperText={formErrors.protocol || "Protocol for the VIP"}
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
                      helperText={formErrors.environment || "Environment for the VIP"}
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
                      helperText={formErrors.datacenter || "Datacenter for the VIP"}
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
                      placeholder="e.g., APP001"
                      required
                      error={!!formErrors.appId}
                      helperText={formErrors.appId || "Application identifier"}
                    />
                  </Grid>
                </Grid>
              </InfoCard>
            </Grid>
            
            <Grid item xs={12}>
              <InfoCard title="Pool Members">
                <Typography variant="body2" paragraph>
                  Add one or more servers to the load balancing pool.
                </Typography>
                
                {poolMembers.map((member, index) => (
                  <Paper elevation={1} style={{ padding: 16, marginBottom: 16 }} key={index}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle1">
                          Pool Member #{index + 1}
                          {poolMembers.length > 1 && (
                            <Button
                              size="small"
                              color="secondary"
                              onClick={() => handleRemovePoolMember(index)}
                              style={{ float: 'right' }}
                            >
                              Remove
                            </Button>
                          )}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label="Server Name"
                          value={member.server_name}
                          onChange={(e) => handlePoolMemberChange(index, 'server_name', e.target.value)}
                          margin="normal"
                          variant="outlined"
                          placeholder="e.g., app-server-01"
                          required
                          error={!!getPoolMemberError(index, 'server_name')}
                          helperText={getPoolMemberError(index, 'server_name')}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label="Server IP"
                          value={member.server_ip}
                          onChange={(e) => handlePoolMemberChange(index, 'server_ip', e.target.value)}
                          margin="normal"
                          variant="outlined"
                          placeholder="e.g., 192.168.1.100"
                          required
                          error={!!getPoolMemberError(index, 'server_ip')}
                          helperText={getPoolMemberError(index, 'server_ip')}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label="Server Port"
                          value={member.server_port}
                          onChange={(e) => handlePoolMemberChange(index, 'server_port', e.target.value)}
                          margin="normal"
                          variant="outlined"
                          placeholder="e.g., 8080"
                          required
                          error={!!getPoolMemberError(index, 'server_port')}
                          helperText={getPoolMemberError(index, 'server_port')}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Weight"
                          value={member.weight}
                          onChange={(e) => handlePoolMemberChange(index, 'weight', e.target.value)}
                          margin="normal"
                          variant="outlined"
                          placeholder="e.g., 1"
                          type="number"
                          InputProps={{ inputProps: { min: 1, max: 100 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          select
                          label="Status"
                          value={member.status}
                          onChange={(e) => handlePoolMemberChange(index, 'status', e.target.value)}
                          margin="normal"
                          variant="outlined"
                        >
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="inactive">Inactive</MenuItem>
                          <MenuItem value="draining">Draining</MenuItem>
                        </TextField>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
                
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleAddPoolMember}
                  style={{ marginTop: 8 }}
                >
                  Add Pool Member
                </Button>
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
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                  >
                    {loading ? 'Creating...' : 'Create VIP'}
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
