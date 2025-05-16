import React, { useEffect, useState } from 'react';
import { 
  Typography, 
  Grid, 
  Button, 
  CircularProgress, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip
} from '@material-ui/core';
import { AddCircleOutline, Edit, Delete, Visibility } from '@material-ui/icons';
import { InfoCard, Header, Page, Content, ContentHeader, SupportButton, StatusOK, StatusError, StatusPending, StatusAborted, StatusRunning } from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

// Token storage key - must match the one in api.ts
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

export const VipListPage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  
  const [vips, setVips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteVipId, setDeleteVipId] = useState(null);
  const [deleteVipName, setDeleteVipName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [servicenowIncidentId, setServicenowIncidentId] = useState('');
  const [servicenowIncidentIdError, setServicenowIncidentIdError] = useState('');

  useEffect(() => {
    // Check if we have a token in localStorage
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      console.log('Found authentication token in localStorage');
      setIsAuthenticated(true);
      fetchVips();
    } else {
      console.log('No authentication token found, showing login form');
      setIsAuthenticated(false);
    }
  }, []);

  const fetchVips = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching VIPs...');
      const data = await lbaasApi.getVips();
      console.log('Fetched VIPs:', data);
      
      setVips(data);
    } catch (e) {
      console.error('Error fetching VIPs:', e);
      setError(e);
      
      // If authentication error, show login form
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        setIsAuthenticated(false);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } else {
        alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setLoginError('Username and password are required');
      return;
    }
    
    try {
      setLoginLoading(true);
      setLoginError(null);
      
      console.log(`Attempting to login with username: ${username}`);
      const result = await lbaasApi.login(username, password);
      console.log('Login successful:', result);
      
      setIsAuthenticated(true);
      fetchVips();
      
      // Clear login form
      setUsername('');
      setPassword('');
    } catch (e) {
      console.error('Login error:', e);
      setLoginError(e.message);
      alertApi.post({ message: `Login failed: ${e.message}`, severity: 'error' });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setIsAuthenticated(false);
    setVips([]);
  };

  const openDeleteDialog = (vipId, vipName) => {
    setDeleteVipId(vipId);
    setDeleteVipName(vipName);
    setServicenowIncidentId('');
    setServicenowIncidentIdError('');
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteVipId(null);
    setDeleteVipName('');
    setServicenowIncidentId('');
    setServicenowIncidentIdError('');
  };

  const validateServicenowIncidentId = (id) => {
    if (!id) {
      setServicenowIncidentIdError('Incident ID is required for deletion.');
      return false;
    }
    
    // Simple validation for ServiceNow incident ID format
    // Adjust this regex based on your specific requirements
    const regex = /^(CHG|INC|PRB|TASK)\d{7}$/;
    if (!regex.test(id)) {
      setServicenowIncidentIdError('Invalid format. Use format: CHG0012345 or INC0054321');
      return false;
    }
    
    setServicenowIncidentIdError('');
    return true;
  };

  const handleDeleteVip = async () => {
    if (!validateServicenowIncidentId(servicenowIncidentId)) {
      return;
    }
    
    try {
      setDeleteLoading(true);
      
      console.log(`Deleting VIP ${deleteVipId} with incident ID: ${servicenowIncidentId}`);
      await lbaasApi.deleteVip(deleteVipId, servicenowIncidentId);
      
      alertApi.post({ message: 'VIP deleted successfully', severity: 'success' });
      closeDeleteDialog();
      fetchVips();
    } catch (e) {
      console.error('Error deleting VIP:', e);
      alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
      
      // If authentication error, show login form
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        setIsAuthenticated(false);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        closeDeleteDialog();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusComponent = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <StatusOK>Active</StatusOK>;
      case 'pending':
        return <StatusPending>Pending</StatusPending>;
      case 'building':
        return <StatusRunning>Building</StatusRunning>;
      case 'inactive':
        return <StatusAborted>Inactive</StatusAborted>;
      case 'error':
        return <StatusError>Error</StatusError>;
      default:
        return <StatusPending>Unknown</StatusPending>;
    }
  };

  // Helper function to navigate to VIP view page
  const navigateToViewVip = (vipId) => {
    try {
      window.location.href = `/lbaas-frontend/${vipId}/view`;
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // Helper function to navigate to VIP edit page
  const navigateToEditVip = (vipId) => {
    try {
      window.location.href = `/lbaas-frontend/${vipId}/edit`;
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // Helper function to navigate to VIP create page
  const navigateToCreateVip = () => {
    try {
      window.location.href = '/lbaas-frontend/create';
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <Page themeId="tool">
        <Header title="VIP Management" subtitle="Manage Load Balancer VIPs" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={8} md={6} lg={4}>
              <InfoCard title="Login Required">
                <Typography paragraph>
                  Please login to access the VIP management system
                </Typography>
                <form onSubmit={handleLogin}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    margin="normal"
                    variant="outlined"
                    placeholder="Username"
                    required
                  />
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    margin="normal"
                    variant="outlined"
                    placeholder="Password"
                    required
                  />
                  {loginError && (
                    <Typography color="error" paragraph>
                      {loginError}
                    </Typography>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    disabled={loginLoading}
                  >
                    {loginLoading ? <CircularProgress size={24} /> : 'Login'}
                  </Button>
                </form>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="VIP Management" subtitle="Manage Load Balancer VIPs" />
      <Content>
        <ContentHeader title="VIP List">
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutline />}
            onClick={navigateToCreateVip}
          >
            Create New VIP
          </Button>
          <Button
            variant="outlined"
            color="default"
            onClick={handleLogout}
            style={{ marginLeft: 8 }}
          >
            Logout
          </Button>
          <SupportButton>
            View and manage your Load Balancer Virtual IP Addresses (VIPs).
          </SupportButton>
        </ContentHeader>
        
        {error && (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper style={{ padding: 16, marginBottom: 16, backgroundColor: '#ffebee' }}>
                <Typography color="error">Error: {error.message}</Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={fetchVips}
                  style={{ marginTop: 8 }}
                >
                  Retry
                </Button>
              </Paper>
            </Grid>
          </Grid>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            {loading ? (
              <Paper style={{ padding: 16, textAlign: 'center' }}>
                <CircularProgress />
                <Typography style={{ marginTop: 16 }}>Loading VIPs...</Typography>
              </Paper>
            ) : vips.length === 0 ? (
              <Paper style={{ padding: 16, textAlign: 'center' }}>
                <Typography>No VIPs found.</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddCircleOutline />}
                  onClick={navigateToCreateVip}
                  style={{ marginTop: 16 }}
                >
                  Create New VIP
                </Button>
              </Paper>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>FQDN</TableCell>
                      <TableCell>IP Address</TableCell>
                      <TableCell>Port</TableCell>
                      <TableCell>Protocol</TableCell>
                      <TableCell>Environment</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vips.map((vip) => (
                      <TableRow key={vip.id}>
                        <TableCell>{vip.vip_fqdn}</TableCell>
                        <TableCell>{vip.vip_ip}</TableCell>
                        <TableCell>{vip.port}</TableCell>
                        <TableCell>{vip.protocol}</TableCell>
                        <TableCell>{vip.environment}</TableCell>
                        <TableCell>{getStatusComponent(vip.status)}</TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton onClick={() => navigateToViewVip(vip.id)}>
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton onClick={() => navigateToEditVip(vip.id)}>
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton onClick={() => openDeleteDialog(vip.id, vip.vip_fqdn)}>
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>
        </Grid>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogContent>
            <Typography paragraph>
              Are you sure you want to delete the VIP <strong>{deleteVipName}</strong>?
            </Typography>
            <Typography paragraph>
              This action cannot be undone. Please provide a ServiceNow incident ID for this change.
            </Typography>
            <TextField
              fullWidth
              label="ServiceNow Incident ID"
              value={servicenowIncidentId}
              onChange={(e) => setServicenowIncidentId(e.target.value)}
              margin="normal"
              variant="outlined"
              placeholder="e.g., CHG0012345 or INC0054321"
              required
              error={!!servicenowIncidentIdError}
              helperText={servicenowIncidentIdError || "Format: CHG0012345 or INC0054321"}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog} color="default">
              Cancel
            </Button>
            <Button
              onClick={handleDeleteVip}
              color="secondary"
              disabled={deleteLoading}
            >
              {deleteLoading ? <CircularProgress size={24} /> : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};
