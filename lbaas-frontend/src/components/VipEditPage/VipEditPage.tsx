import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, TextField, MenuItem, FormControl, InputLabel, Select, FormHelperText, Dialog, DialogTitle, DialogContent, DialogActions } from '@material-ui/core';
import { ArrowBack, Save, LockOpen } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  ErrorPanel
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';
import { Link as RouterLink, useParams, useNavigate, useLocation } from 'react-router-dom';


// Interface for VIP data
interface VipData {
  id?: string;
  vip_fqdn: string;
  vip_ip: string;
  port: number;
  protocol: string;
  environment: string;
  datacenter: string;
  app_id: string;
  owner?: string;
  status?: string;
  pool_members?: Array<{ server_name: string; server_ip: string; server_port: number; weight: number; status?: string }>;
  monitor?: { type: string; port?: number; send_string?: string; receive_string?: string; interval?: number; timeout?: number };
  persistence?: { type: string; timeout?: number };
}

// Interface for form validation
interface FormErrors {
  vip_fqdn?: string;
  vip_ip?: string;
  port?: string;
  protocol?: string;
  environment?: string;
  datacenter?: string;
  app_id?: string;
}

export const VipEditPage = () => {
  // Extract vipId from URL parameters using robust approach
  const params = useParams<{ vipId?: string }>();
  const location = useLocation();
  const pathSegments = location.pathname.split('/');
  
  // Extract vipId from either params or URL path
  const vipId = params.vipId || 
                (pathSegments.length > 2 ? pathSegments[pathSegments.length - 2] : undefined);
  
  console.log('Path segments:', pathSegments);
  console.log('Extracted vipId:', vipId);
  
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState<VipData>({
    vip_fqdn: '',
    vip_ip: '',
    port: 80,
    protocol: 'HTTP',
    environment: '',
    datacenter: '',
    app_id: '',
  });
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  
  // Environment options
  const environments = ['Development', 'Testing', 'Staging', 'Production'];
  
  // Datacenter options based on environment
  const datacenters: Record<string, string[]> = {
    Development: ['DevDC1', 'DevDC2'],
    Testing: ['TestDC1', 'TestDC2'],
    Staging: ['StageDC1', 'StageDC2'],
    Production: ['ProdDC1', 'ProdDC2', 'ProdDC3'],
  };
  
  // Protocol options
  const protocols = ['HTTP', 'HTTPS', 'TCP', 'UDP'];

  // Handle login dialog
  const handleLoginDialogOpen = () => {
    setIsLoginDialogOpen(true);
    setLoginError(null);
  };

  const handleLoginDialogClose = () => {
    setIsLoginDialogOpen(false);
    setLoginError(null);
  };

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await lbaasApi.login(username, password);
      handleLoginDialogClose();
      // Reload data after successful login
      fetchVipDetails();
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Login failed. Please try again.');
    }
  };

  // Fetch VIP details
  const fetchVipDetails = async () => {
    if (!vipId) {
      setError(new Error('VIP ID not found in URL.'));
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
          setFormData(parsedData);
          setUsingCachedData(true);
          console.log('Using cached VIP data from sessionStorage');
          setLoading(false);
          // Continue fetching fresh data in the background
        } catch (parseError) {
          console.error('Error parsing cached VIP data:', parseError);
          // Continue with API fetch if parsing fails
        }
      }
      
      // Check if authenticated
      if (!lbaasApi.isAuthenticated()) {
        console.log('Not authenticated, using cached data if available');
        if (!cachedData) {
          setError(new Error('Authentication required to fetch VIP details.'));
        }
        setLoading(false);
        return;
      }
      
      try {
        // Use the API client to fetch VIP details
        const data = await lbaasApi.getVip(vipId);
        
        if (data) {
          setFormData(data);
          setUsingCachedData(false);
          
          // Cache the data in sessionStorage for future use
          try {
            sessionStorage.setItem(`vip_${vipId}`, JSON.stringify(data));
          } catch (storageError) {
            console.error('Error caching VIP data:', storageError);
            // Non-critical error, continue without caching
          }
        } else {
          // If no data returned but no error thrown, check if we already have cached data
          if (!cachedData) {
            setError(new Error(`VIP with ID ${vipId} not found.`));
            alertApi.post({ message: `VIP with ID ${vipId} not found.`, severity: 'error' });
          }
        }
      } catch (apiError: any) {
        console.error('API call failed:', apiError);
        
        // If we don't have cached data, show the error
        if (!cachedData) {
          setError(apiError);
          alertApi.post({ message: `Error fetching VIP details: ${apiError.message}`, severity: 'error' });
        }
        // Otherwise, we'll continue using the cached data
      }
    } catch (e: any) {
      setError(e);
      alertApi.post({ message: `Error fetching VIP details: ${e.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Load VIP details on component mount
  useEffect(() => {
    fetchVipDetails();
  }, [vipId, alertApi, lbaasApi]);

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (!name) return;
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear validation error when field is changed
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
    
    // Reset datacenter if environment changes
    if (name === 'environment') {
      setFormData(prev => ({
        ...prev,
        datacenter: '',
      }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    if (!formData.vip_fqdn) {
      errors.vip_fqdn = 'FQDN is required';
    } else if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.vip_fqdn)) {
      errors.vip_fqdn = 'Invalid FQDN format';
    }
    
    if (!formData.vip_ip) {
      errors.vip_ip = 'IP Address is required';
    } else if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(formData.vip_ip)) {
      errors.vip_ip = 'Invalid IP address format';
    }
    
    if (!formData.port) {
      errors.port = 'Port is required';
    } else if (formData.port < 1 || formData.port > 65535) {
      errors.port = 'Port must be between 1 and 65535';
    }
    
    if (!formData.protocol) {
      errors.protocol = 'Protocol is required';
    }
    
    if (!formData.environment) {
      errors.environment = 'Environment is required';
    }
    
    if (!formData.datacenter) {
      errors.datacenter = 'Datacenter is required';
    }
    
    if (!formData.app_id) {
      errors.app_id = 'Application ID is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lbaasApi.isAuthenticated()) {
      alertApi.post({ message: 'Authentication required to update VIP.', severity: 'error' });
      handleLoginDialogOpen();
      return;
    }
    
    if (!validateForm()) {
      alertApi.post({ message: 'Please fix the errors in the form.', severity: 'error' });
      return;
    }
    
    try {
      setSaving(true);
      
      if (!vipId) {
        throw new Error('VIP ID not found in URL.');
      }
      
      const updatedVip = await lbaasApi.updateVip(vipId, formData);
      
      alertApi.post({ message: 'VIP updated successfully!', severity: 'success' });
      
      // Update cache
      try {
        sessionStorage.setItem(`vip_${vipId}`, JSON.stringify(updatedVip));
      } catch (storageError) {
        console.error('Error updating cached VIP data:', storageError);
      }
      
      // Navigate back to VIP details page
      navigate(`/lbaas-frontend/${vipId}/view`);
    } catch (error: any) {
      console.error('Error updating VIP:', error);
      alertApi.post({ message: `Error updating VIP: ${error.message}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Show loading state
  if (loading && !formData.vip_fqdn) {
    return (
      <Page themeId="tool">
        <Header title="Loading VIP Details" />
        <Content>
          <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '400px' }}>
            <CircularProgress />
          </Grid>
        </Content>
      </Page>
    );
  }

  // Show error state if no cached data
  if (error && !formData.vip_fqdn) {
    return (
      <Page themeId="tool">
        <Header title="Error" />
        <Content>
          <ErrorPanel error={error} />
          <Grid container spacing={2} style={{ marginTop: '20px' }}>
            <Grid item>
              <Button component={RouterLink} to="/lbaas-frontend" variant="outlined">
                Back to VIP List
              </Button>
            </Grid>
            {error.message.includes('Authentication') && (
              <Grid item>
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<LockOpen />}
                  onClick={handleLoginDialogOpen}
                >
                  Login
                </Button>
              </Grid>
            )}
          </Grid>
          
          {/* Login Dialog */}
          <Dialog open={isLoginDialogOpen} onClose={handleLoginDialogClose}>
            <DialogTitle>Login to LBaaS</DialogTitle>
            <DialogContent>
              {loginError && (
                <Typography color="error" style={{ marginBottom: '16px' }}>
                  {loginError}
                </Typography>
              )}
              <TextField
                autoFocus
                margin="dense"
                label="Username"
                type="text"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                margin="dense"
                label="Password"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleLoginDialogClose} color="primary">
                Cancel
              </Button>
              <Button onClick={handleLogin} color="primary" variant="contained">
                Login
              </Button>
            </DialogActions>
          </Dialog>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header 
        title={`Edit VIP: ${formData.vip_fqdn}`}
        subtitle={`Application ID: ${formData.app_id}`}>
        <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP List
        </Button>
        {!lbaasApi.isAuthenticated() && (
          <Button 
            variant="outlined" 
            color="primary" 
            startIcon={<LockOpen />}
            onClick={handleLoginDialogOpen}
            style={{ marginLeft: '10px' }}
          >
            Login
          </Button>
        )}
      </Header>
      <Content>
        <ContentHeader title="Edit VIP Configuration">
          <SupportButton>Edit the configuration for this VIP.</SupportButton>
        </ContentHeader>
        
        {/* Authentication Warning */}
        {!lbaasApi.isAuthenticated() && (
          <InfoCard title="Authentication Required" severity="warning" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              You are viewing cached data. Please log in to fetch the latest VIP details and make changes.
            </Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<LockOpen />}
              onClick={handleLoginDialogOpen}
              style={{ marginTop: '10px' }}
            >
              Login
            </Button>
          </InfoCard>
        )}
        
        {/* Cached Data Warning */}
        {usingCachedData && lbaasApi.isAuthenticated() && (
          <InfoCard title="Using Cached Data" severity="info" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              Showing cached data. The latest data could not be fetched from the server.
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={fetchVipDetails}
              style={{ marginTop: '10px' }}
            >
              Retry
            </Button>
          </InfoCard>
        )}
        
        {/* Error Warning */}
        {error && formData.vip_fqdn && (
          <InfoCard title="Warning" severity="error" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              Error fetching latest data: {error.message}
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={fetchVipDetails}
              style={{ marginTop: '10px' }}
            >
              Retry
            </Button>
          </InfoCard>
        )}
        
        <Paper style={{ padding: '20px' }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6">Basic Information</Typography>
                <Divider style={{ marginTop: '8px', marginBottom: '16px' }} />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="FQDN"
                  name="vip_fqdn"
                  value={formData.vip_fqdn}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={!!formErrors.vip_fqdn}
                  helperText={formErrors.vip_fqdn}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="IP Address"
                  name="vip_ip"
                  value={formData.vip_ip}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={!!formErrors.vip_ip}
                  helperText={formErrors.vip_ip}
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Port"
                  name="port"
                  type="number"
                  value={formData.port}
                  onChange={handleChange}
                  fullWidth
                  required
                  inputProps={{ min: 1, max: 65535 }}
                  error={!!formErrors.port}
                  helperText={formErrors.port}
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required error={!!formErrors.protocol}>
                  <InputLabel id="protocol-label">Protocol</InputLabel>
                  <Select
                    labelId="protocol-label"
                    name="protocol"
                    value={formData.protocol}
                    onChange={handleChange}
                  >
                    {protocols.map((protocol) => (
                      <MenuItem key={protocol} value={protocol}>
                        {protocol}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.protocol && <FormHelperText>{formErrors.protocol}</FormHelperText>}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Application ID"
                  name="app_id"
                  value={formData.app_id}
                  onChange={handleChange}
                  fullWidth
                  required
                  error={!!formErrors.app_id}
                  helperText={formErrors.app_id}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.environment}>
                  <InputLabel id="environment-label">Environment</InputLabel>
                  <Select
                    labelId="environment-label"
                    name="environment"
                    value={formData.environment}
                    onChange={handleChange}
                  >
                    {environments.map((env) => (
                      <MenuItem key={env} value={env}>
                        {env}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.environment && <FormHelperText>{formErrors.environment}</FormHelperText>}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!formErrors.datacenter} disabled={!formData.environment}>
                  <InputLabel id="datacenter-label">Datacenter</InputLabel>
                  <Select
                    labelId="datacenter-label"
                    name="datacenter"
                    value={formData.datacenter}
                    onChange={handleChange}
                  >
                    {formData.environment && datacenters[formData.environment]?.map((dc) => (
                      <MenuItem key={dc} value={dc}>
                        {dc}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.datacenter && <FormHelperText>{formErrors.datacenter}</FormHelperText>}
                </FormControl>
              </Grid>
              
              {/* Submit Button */}
              <Grid item xs={12} style={{ marginTop: '20px' }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  startIcon={<Save />}
                  disabled={saving || !lbaasApi.isAuthenticated()}
                >
                  {saving ? <CircularProgress size={24} /> : 'Save Changes'}
                </Button>
                <Button
                  component={RouterLink}
                  to={`/lbaas-frontend/${vipId}/view`}
                  variant="outlined"
                  style={{ marginLeft: '10px' }}
                >
                  Cancel
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Content>
      
      {/* Login Dialog */}
      <Dialog open={isLoginDialogOpen} onClose={handleLoginDialogClose}>
        <DialogTitle>Login to LBaaS</DialogTitle>
        <DialogContent>
          {loginError && (
            <Typography color="error" style={{ marginBottom: '16px' }}>
              {loginError}
            </Typography>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            type="text"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLoginDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleLogin} color="primary" variant="contained">
            Login
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};
