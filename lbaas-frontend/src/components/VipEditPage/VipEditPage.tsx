import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@material-ui/core';
import { Link as RouterLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowBack, Edit, LockOpen } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  StatusOK,
  StatusError,
  StatusPending,
  StatusAborted,
  StatusRunning,
  InfoCard,
  ErrorPanel
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

// Interface for VIP details data
interface VipDetailsData {
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
  pool_members?: Array<{ ip: string; port: number; enabled: boolean; status?: string }>;
  monitor?: { type: string; port?: number; send_string?: string; receive_string?: string; interval?: number; timeout?: number };
  persistence?: { type: string; timeout?: number };
}

// Mock data for when not authenticated or API fails
const mockVipDetails: VipDetailsData = {
  id: 'mock-vip-1',
  vip_fqdn: 'app1.example.com',
  vip_ip: '192.168.1.10',
  port: 80,
  protocol: 'HTTP',
  environment: 'Development',
  datacenter: 'DevDC1',
  app_id: 'APP001',
  owner: 'John Doe',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  pool_members: [
    { ip: '192.168.2.10', port: 8080, enabled: true, status: 'active' },
    { ip: '192.168.2.11', port: 8080, enabled: true, status: 'active' }
  ],
  monitor: {
    type: 'HTTP',
    port: 8080,
    send_string: 'GET /health HTTP/1.1\r\nHost: example.com\r\n\r\n',
    receive_string: '200 OK',
    interval: 5,
    timeout: 16
  },
  persistence: {
    type: 'cookie',
    timeout: 3600
  }
};

// Added null/undefined check to prevent crashes
const getStatusComponent = (status: string | undefined) => {
  // Add null check to prevent errors when status is undefined
  if (!status) {
    return <Typography variant="body2">Unknown</Typography>;
  }
  
  switch (status.toLowerCase()) {
    case 'active':
      return <StatusOK>{status}</StatusOK>;
    case 'building':
      return <StatusRunning>{status}</StatusRunning>;
    case 'pending':
      return <StatusPending>{status}</StatusPending>;
    case 'error':
      return <StatusError>{status}</StatusError>;
    case 'inactive':
      return <StatusAborted>{status}</StatusAborted>;
    default:
      return <Typography variant="body2">{status}</Typography>;
  }
};

export const VipViewPage = () => {
  // All hooks must be called at the top level of the component
  const params = useParams<{ vipId?: string }>();
  const location = useLocation();
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  
  // State hooks
  const [vipDetails, setVipDetails] = useState<VipDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  
  // Extract parameters after all hooks are declared
  const pathSegments = location.pathname.split('/');
  const vipId = params.vipId || 
                (pathSegments.length > 2 ? pathSegments[pathSegments.length - 2] : undefined);
  
  console.log('Path segments:', pathSegments);
  console.log('Extracted vipId:', vipId);

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

  const fetchVipDetails = async () => {
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

  // Effect hook must be called at the top level after all other hooks
  useEffect(() => {
    fetchVipDetails();
  }, [vipId, alertApi, lbaasApi]);

  if (loading && !vipDetails) {
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

  if (error && !vipDetails) {
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

  if (!vipDetails) {
    return (
      <Page themeId="tool">
        <Header title="VIP Not Found" />
        <Content>
          <Typography>The requested VIP could not be found.</Typography>
          <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" style={{ marginTop: '20px' }}>
            Back to VIP List
          </Button>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header 
        title={`VIP Details: ${vipDetails.vip_fqdn}`}
        subtitle={`Application ID: ${vipDetails.app_id}`}>
        <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP List
        </Button>
        <Button 
          component={RouterLink} 
          to={`/lbaas-frontend/${vipId}/edit`} 
          variant="contained" 
          color="primary" 
          startIcon={<Edit />} 
          style={{ marginLeft: '10px' }}
        >
          Modify VIP
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
        <ContentHeader title="VIP Configuration">
          <SupportButton>Detailed information for the selected VIP.</SupportButton>
        </ContentHeader>
        
        {/* Authentication Warning */}
        {!lbaasApi.isAuthenticated() && (
          <InfoCard title="Authentication Required" severity="warning" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              You are viewing {usingCachedData ? 'cached' : 'mock'} data. Please log in to fetch the latest VIP details and make changes.
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
        
        {/* Mock Data Warning */}
        {usingMockData && (
          <InfoCard title="Using Mock Data" severity="info" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              Showing mock data. The actual VIP details could not be fetched from the server.
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
        {error && vipDetails && !usingMockData && (
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
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>FQDN:</strong> {vipDetails.vip_fqdn}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>IP Address:</strong> {vipDetails.vip_ip}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Port:</strong> {vipDetails.port}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Protocol:</strong> {vipDetails.protocol}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Environment:</strong> {vipDetails.environment}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Datacenter:</strong> {vipDetails.datacenter}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>Owner:</strong> {vipDetails.owner}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>Status:</strong> {getStatusComponent(vipDetails.status)}</Typography>
            </Grid>
            {vipDetails.created_at && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Created At:</strong> {new Date(vipDetails.created_at).toLocaleString()}</Typography>
              </Grid>
            )}
            {vipDetails.updated_at && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Last Updated:</strong> {new Date(vipDetails.updated_at).toLocaleString()}</Typography>
              </Grid>
            )}

            {vipDetails.pool_members && vipDetails.pool_members.length > 0 && (
              <Grid item xs={12}>
                <Divider style={{ margin: '20px 0' }} />
                <Typography variant="h6">Pool Members</Typography>
                <List dense>
                  {vipDetails.pool_members.map((member, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={`IP: ${member.ip}, Port: ${member.port}, Enabled: ${member.enabled}`}
                        secondary={member.status ? `Status: ${member.status}` : ''}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}

            {vipDetails.monitor && (
              <Grid item xs={12}>
                <Divider style={{ margin: '20px 0' }} />
                <Typography variant="h6">Health Monitor</Typography>
                <Typography variant="body2"><strong>Type:</strong> {vipDetails.monitor.type}</Typography>
                {vipDetails.monitor.port && <Typography variant="body2"><strong>Port:</strong> {vipDetails.monitor.port}</Typography>}
                {vipDetails.monitor.send_string && <Typography variant="body2"><strong>Send String:</strong> {vipDetails.monitor.send_string}</Typography>}
                {vipDetails.monitor.receive_string && <Typography variant="body2"><strong>Receive String:</strong> {vipDetails.monitor.receive_string}</Typography>}
                {vipDetails.monitor.interval && <Typography variant="body2"><strong>Interval:</strong> {vipDetails.monitor.interval}s</Typography>}
                {vipDetails.monitor.timeout && <Typography variant="body2"><strong>Timeout:</strong> {vipDetails.monitor.timeout}s</Typography>}
              </Grid>
            )}
            
            {vipDetails.persistence && (
              <Grid item xs={12}>
                <Divider style={{ margin: '20px 0' }} />
                <Typography variant="h6">Persistence</Typography>
                <Typography variant="body2"><strong>Type:</strong> {vipDetails.persistence.type}</Typography>
                {vipDetails.persistence.timeout && <Typography variant="body2"><strong>Timeout:</strong> {vipDetails.persistence.timeout}s</Typography>}
              </Grid>
            )}
          </Grid>
        </Paper>
        
        {/* Navigation buttons with consistent route structure */}
        <Grid container spacing={2} style={{ marginTop: '20px' }}>
          <Grid item>
            <Button
              component={RouterLink}
              to={`/lbaas-frontend/${vipId}/output`}
              variant="outlined"
              color="primary"
              disabled={!lbaasApi.isAuthenticated()}
            >
              View Configuration Output
            </Button>
          </Grid>
          <Grid item>
            <Button
              component={RouterLink}
              to={`/lbaas-frontend/${vipId}/promote`}
              variant="outlined"
              color="primary"
              disabled={!lbaasApi.isAuthenticated()}
            >
              Promote to New Environment
            </Button>
          </Grid>
        </Grid>
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
