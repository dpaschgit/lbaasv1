import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableColumn,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Grid,
  Paper,
  IconButton,
  makeStyles,
} from '@material-ui/core';
import { AddCircleOutline, Edit, Delete, Visibility } from '@material-ui/icons';
import { InfoCard, Header, Page, Content, ContentHeader, SupportButton, StatusOK, StatusError, StatusPending, StatusAborted, StatusRunning } from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

// Token storage key - must match the one in api.ts
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

const useStyles = makeStyles((theme) => ({
  loginContainer: {
    padding: theme.spacing(3),
    maxWidth: 400,
    margin: '0 auto',
  },
  loginButton: {
    marginTop: theme.spacing(2),
  },
  statusCell: {
    display: 'flex',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: theme.spacing(1),
  },
  actionButton: {
    marginRight: theme.spacing(1),
  },
  deleteDialog: {
    minWidth: 400,
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
  },
  logoutButton: {
    marginLeft: theme.spacing(2),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
}));

export const VipListPage = () => {
  const classes = useStyles();
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [vips, setVips] = useState([]);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVip, setSelectedVip] = useState(null);
  const [incidentId, setIncidentId] = useState('');
  const [incidentIdError, setIncidentIdError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Check for existing authentication token on component mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      setIsAuthenticated(true);
      fetchVips(token);
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch VIPs from API
  const fetchVips = async (token) => {
    try {
      setLoading(true);
      const data = await lbaasApi.listVips(token);
      setVips(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching VIPs:', err);
      setError(err.message || 'Failed to fetch VIPs');
      
      // If authentication error, clear token and show login
      if (err.message.includes('Authentication') || err.message.includes('login')) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setIsAuthenticated(false);
      }
      
      alertApi.post({
        message: `Error: ${err.message}`,
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle login form submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (!username || !password) {
      setLoginError('Username and password are required');
      return;
    }
    
    try {
      setLoading(true);
      const authData = await lbaasApi.login(username, password);
      
      if (authData && authData.access_token) {
        setIsAuthenticated(true);
        fetchVips(authData.access_token);
      } else {
        throw new Error('Invalid response from authentication server');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setIsAuthenticated(false);
    setVips([]);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (vip) => {
    setSelectedVip(vip);
    setIncidentId('');
    setIncidentIdError('');
    setDeleteDialogOpen(true);
  };

  // Close delete confirmation dialog
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedVip(null);
    setIncidentId('');
    setIncidentIdError('');
  };

  // Handle VIP deletion
  const handleDeleteVip = async () => {
    // Validate ServiceNow incident ID
    if (!incidentId) {
      setIncidentIdError('Incident ID is required for deletion.');
      return;
    }
    
    try {
      setDeleteLoading(true);
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }
      
      await lbaasApi.deleteVip(selectedVip.id, incidentId, token);
      
      alertApi.post({
        message: 'VIP deleted successfully',
        severity: 'success',
      });
      
      // Refresh VIP list
      fetchVips(token);
      closeDeleteDialog();
    } catch (err) {
      console.error('Error deleting VIP:', err);
      setIncidentIdError(err.message || 'Failed to delete VIP');
      
      alertApi.post({
        message: `Error: ${err.message}`,
        severity: 'error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Navigate to view VIP details
  const navigateToViewVip = (vipId) => {
    try {
      navigate(`/lbaas-frontend/${vipId}/view`);
    } catch (error) {
      console.error('Navigation error:', error);
      alertApi.post({
        message: `Error navigating to VIP details: ${error.message}`,
        severity: 'error',
      });
    }
  };

  // Navigate to edit VIP
  const navigateToEditVip = (vipId) => {
    try {
      navigate(`/lbaas-frontend/${vipId}/edit`);
    } catch (error) {
      console.error('Navigation error:', error);
      alertApi.post({
        message: `Error navigating to edit VIP: ${error.message}`,
        severity: 'error',
      });
    }
  };

  // Navigate to create VIP
  const navigateToCreateVip = () => {
    try {
      navigate('/lbaas-frontend/create');
    } catch (error) {
      console.error('Navigation error:', error);
      alertApi.post({
        message: `Error navigating to create VIP: ${error.message}`,
        severity: 'error',
      });
    }
  };

  // Render status indicator based on VIP status
  const renderStatus = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return (
          <div className={classes.statusCell}>
            <StatusOK className={classes.statusIcon} />
            Active
          </div>
        );
      case 'pending':
        return (
          <div className={classes.statusCell}>
            <StatusPending className={classes.statusIcon} />
            Pending
          </div>
        );
      case 'building':
        return (
          <div className={classes.statusCell}>
            <StatusRunning className={classes.statusIcon} />
            Building
          </div>
        );
      case 'error':
        return (
          <div className={classes.statusCell}>
            <StatusError className={classes.statusIcon} />
            Error
          </div>
        );
      case 'inactive':
        return (
          <div className={classes.statusCell}>
            <StatusAborted className={classes.statusIcon} />
            Inactive
          </div>
        );
      default:
        return status || 'Unknown';
    }
  };

  // Table columns definition
  const columns: TableColumn[] = [
    { title: 'FQDN', field: 'vip_fqdn' },
    { title: 'IP Address', field: 'vip_ip' },
    { title: 'Port', field: 'port' },
    { title: 'Protocol', field: 'protocol' },
    { title: 'Environment', field: 'environment' },
    { title: 'Datacenter', field: 'datacenter' },
    { title: 'App ID', field: 'app_id' },
    { title: 'Owner', field: 'owner' },
    {
      title: 'Status',
      field: 'status',
      render: (rowData) => renderStatus(rowData.status),
    },
    {
      title: 'Actions',
      field: 'actions',
      render: (rowData) => (
        <>
          <IconButton
            className={classes.actionButton}
            aria-label="view"
            onClick={() => navigateToViewVip(rowData.id)}
          >
            <Visibility />
          </IconButton>
          <IconButton
            className={classes.actionButton}
            aria-label="edit"
            onClick={() => navigateToEditVip(rowData.id)}
          >
            <Edit />
          </IconButton>
          <IconButton
            className={classes.actionButton}
            aria-label="delete"
            onClick={() => openDeleteDialog(rowData)}
          >
            <Delete />
          </IconButton>
        </>
      ),
    },
  ];

  // Render login form
  if (!isAuthenticated) {
    return (
      <Page themeId="tool">
        <Header title="VIP Management" subtitle="Manage Load Balancer VIPs" />
        <Content>
          <ContentHeader title="Login Required">
            <SupportButton>Please login to access the VIP management system</SupportButton>
          </ContentHeader>
          <Grid container justifyContent="center">
            <Grid item xs={12} sm={8} md={6} lg={4}>
              <Paper className={classes.loginContainer}>
                <form onSubmit={handleLogin}>
                  <Typography variant="h6" gutterBottom>
                    Login
                  </Typography>
                  <TextField
                    label="Username"
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                  />
                  <TextField
                    label="Password"
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                  />
                  {loginError && (
                    <Typography className={classes.errorText}>
                      {loginError}
                    </Typography>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    className={classes.loginButton}
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </Paper>
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
            className={classes.logoutButton}
          >
            Logout
          </Button>
          <SupportButton>View and manage your Load Balancer VIPs</SupportButton>
        </ContentHeader>
        
        {loading && (
          <div className={classes.loadingContainer}>
            <CircularProgress />
          </div>
        )}
        
        {error && !loading && (
          <InfoCard title="Error" severity="error">
            {error}
          </InfoCard>
        )}
        
        {!loading && !error && (
          <InfoCard>
            <Table
              options={{
                search: true,
                paging: true,
                pageSize: 10,
                pageSizeOptions: [5, 10, 20, 50],
              }}
              title="Virtual IP Addresses"
              columns={columns}
              data={vips}
            />
          </InfoCard>
        )}
        
        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={closeDeleteDialog}
          aria-labelledby="delete-dialog-title"
        >
          <DialogTitle id="delete-dialog-title">Confirm Deletion</DialogTitle>
          <DialogContent className={classes.deleteDialog}>
            <Typography gutterBottom>
              Are you sure you want to delete the VIP{' '}
              <strong>{selectedVip?.vip_fqdn}</strong>?
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              This action cannot be undone. Please provide a ServiceNow incident ID for this change.
            </Typography>
            <TextField
              label="ServiceNow Incident ID"
              fullWidth
              margin="normal"
              variant="outlined"
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
              placeholder="e.g., CHG0012345 or INC0054321"
              error={!!incidentIdError}
              helperText={incidentIdError}
              required
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
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};
