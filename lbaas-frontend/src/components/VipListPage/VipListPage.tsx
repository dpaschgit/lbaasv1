import React, { useEffect, useState, FormEvent } from 'react';
import { Typography, Grid, Button, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@material-ui/core';
import { AddCircleOutline, Edit, Delete, Visibility } from '@material-ui/icons';
import {
  InfoCard,
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  StatusOK,
  StatusError,
  StatusPending,
  StatusAborted,
  StatusRunning
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, Vip, AuthToken } from '../../api';

// Token storage key - must match the one in api.ts
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

const getStatusComponent = (status: string) => {
  switch (status?.toLowerCase()) {
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
      return <Typography variant="body2">{status || 'Unknown'}</Typography>;
  }
};

export const VipListPage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  
  const [vips, setVips] = useState<Vip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedVipId, setSelectedVipId] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [incidentIdError, setIncidentIdError] = useState('');
  const [token, setToken] = useState<string>('');
  const [loginOpen, setLoginOpen] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Check for existing token on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      console.log('Found stored authentication token');
      setToken(storedToken);
      setLoginOpen(false);
      fetchVips(storedToken);
    }
  }, []);

  // Navigation functions using window.location for maximum compatibility
  const navigateToView = (vipId: string) => {
    try {
      // Get the current base URL up to /lbaas-frontend
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('/lbaas-frontend')[0];
      const viewUrl = `${baseUrl}/lbaas-frontend/${vipId}/view`;
      console.log(`Navigating to view: ${viewUrl}`);
      window.location.href = viewUrl;
    } catch (error) {
      console.error('Navigation error:', error);
      alertApi.post({ 
        message: `Error navigating to VIP details: ${error}`, 
        severity: 'error' 
      });
    }
  };

  const navigateToEdit = (vipId: string) => {
    try {
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('/lbaas-frontend')[0];
      const editUrl = `${baseUrl}/lbaas-frontend/${vipId}/edit`;
      console.log(`Navigating to edit: ${editUrl}`);
      window.location.href = editUrl;
    } catch (error) {
      console.error('Navigation error:', error);
      alertApi.post({ 
        message: `Error navigating to edit VIP: ${error}`, 
        severity: 'error' 
      });
    }
  };

  const navigateToCreate = () => {
    try {
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('/lbaas-frontend')[0];
      const createUrl = `${baseUrl}/lbaas-frontend/create`;
      console.log(`Navigating to create: ${createUrl}`);
      window.location.href = createUrl;
    } catch (error) {
      console.error('Navigation error:', error);
      alertApi.post({ 
        message: `Error navigating to create VIP: ${error}`, 
        severity: 'error' 
      });
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setLoginError('Username and password are required');
      return;
    }
    
    try {
      setLoginError('');
      setLoading(true);
      const authToken = await lbaasApi.login(username, password);
      setToken(authToken.access_token);
      setLoginOpen(false);
      fetchVips(authToken.access_token);
    } catch (e: any) {
      console.error('Login error:', e);
      setLoginError(e.message || 'Failed to login');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setLoginOpen(true);
    setVips([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLogin();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  const fetchVips = async (authToken: string) => {
    try {
      setLoading(true);
      // Use the API client to fetch VIPs with the token
      const data = await lbaasApi.listVips(authToken);
      setVips(data);
    } catch (e: any) {
      setError(e);
      alertApi.post({ message: `Error fetching VIPs: ${e.message}`, severity: 'error' });
      // If authentication error, show login form
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (vipId: string) => {
    setSelectedVipId(vipId);
    setOpenDeleteDialog(true);
    setIncidentId('');
    setIncidentIdError('');
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedVipId(null);
    setIncidentId('');
    setIncidentIdError('');
  };

  const validateIncidentId = (id: string) => {
    // Accept any non-empty string for now
    if (!id.trim()) {
      setIncidentIdError('ServiceNow Incident ID is required');
      return false;
    }
    setIncidentIdError('');
    return true;
  };

  const handleIncidentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIncidentId(value);
    if (value.trim()) {
      setIncidentIdError('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedVipId || !validateIncidentId(incidentId) || !token) {
      return;
    }
    
    try {
      // Use the API client to delete the VIP
      const result = await lbaasApi.deleteVip(selectedVipId, incidentId, token);
      if (result.success) {
        alertApi.post({ message: result.message || 'VIP deleted successfully', severity: 'success' });
        // Refresh VIP list
        setVips(vips.filter(vip => vip.id !== selectedVipId));
      } else {
        alertApi.post({ message: result.message || 'Failed to delete VIP', severity: 'error' });
      }
    } catch (e: any) {
      alertApi.post({ message: `Error deleting VIP: ${e.message}`, severity: 'error' });
      // If authentication error, show login form
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        handleLogout();
      }
    }
    handleCloseDeleteDialog();
  };

  if (loginOpen) {
    return (
      <Page themeId="tool">
        <Header title="Load Balancer VIPs" subtitle="Manage your Load Balancer Virtual IP Addresses" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={8} md={6} lg={4}>
              <InfoCard title="Login Required">
                <form onSubmit={handleSubmit}>
                  <Grid container spacing={2} direction="column" padding={2}>
                    <Grid item>
                      <Typography>Please login to access the VIP management system</Typography>
                    </Grid>
                    {loginError && (
                      <Grid item>
                        <Typography color="error">{loginError}</Typography>
                      </Grid>
                    )}
                    <Grid item>
                      <TextField
                        fullWidth
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyPress={handleKeyPress}
                        margin="normal"
                        placeholder="Username"
                        autoFocus
                      />
                    </Grid>
                    <Grid item>
                      <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={handleKeyPress}
                        margin="normal"
                        placeholder="Password"
                      />
                    </Grid>
                    <Grid item>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleLogin}
                        disabled={loading}
                        fullWidth
                        type="submit"
                      >
                        {loading ? <CircularProgress size={24} /> : 'Login'}
                      </Button>
                    </Grid>
                  </Grid>
                </form>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  if (loading && vips.length === 0) {
    return (
      <Page themeId="tool">
        <Header title="Load Balancer VIPs" subtitle="Manage your Load Balancer Virtual IP Addresses" />
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
        <Header title="Load Balancer VIPs" subtitle="Manage your Load Balancer Virtual IP Addresses" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12}>
              <InfoCard title="Error">
                <Typography color="error">Error loading VIPs: {error.message}</Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={() => setLoginOpen(true)} 
                  style={{ marginTop: 16 }}
                >
                  Try Again
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
      <Header title="Load Balancer VIPs" subtitle="Manage your Load Balancer Virtual IP Addresses" />
      <Content>
        <ContentHeader title="VIP List">
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                onClick={navigateToCreate}
                startIcon={<AddCircleOutline />}
              >
                Create New VIP
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                color="default"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Grid>
            <Grid item>
              <SupportButton>Manage and request load balancer VIPs.</SupportButton>
            </Grid>
          </Grid>
        </ContentHeader>
        <Grid container spacing={3} direction="column">
          <Grid item>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>FQDN</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>Port</TableCell>
                    <TableCell>Protocol</TableCell>
                    <TableCell>Environment</TableCell>
                    <TableCell>Datacenter</TableCell>
                    <TableCell>App ID</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        No VIPs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    vips.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>{row.vip_fqdn}</TableCell>
                        <TableCell>{row.vip_ip}</TableCell>
                        <TableCell>{row.port}</TableCell>
                        <TableCell>{row.protocol}</TableCell>
                        <TableCell>{row.environment}</TableCell>
                        <TableCell>{row.datacenter}</TableCell>
                        <TableCell>{row.app_id}</TableCell>
                        <TableCell>{row.owner}</TableCell>
                        <TableCell>{getStatusComponent(row.status || '')}</TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton onClick={() => navigateToView(row.id)}>
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Modify VIP">
                            <IconButton onClick={() => navigateToEdit(row.id)}>
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete VIP">
                            <IconButton onClick={() => handleDeleteClick(row.id)}>
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </Content>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm VIP Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete VIP: {selectedVipId}? 
            This action cannot be undone. Please provide a valid ServiceNow Incident ID to proceed.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="incidentId"
            label="ServiceNow Incident ID"
            type="text"
            fullWidth
            variant="standard"
            value={incidentId}
            onChange={handleIncidentIdChange}
            error={!!incidentIdError}
            helperText={incidentIdError || "Example formats: CHG0012345, INC0054321, or any valid ServiceNow ID"}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="secondary" 
            disabled={!incidentId.trim()}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};
