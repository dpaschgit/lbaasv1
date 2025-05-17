import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import { AddCircleOutline, Edit, Delete, Visibility } from '@material-ui/icons';
import {
  InfoCard,
  Header,
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  SupportButton,
  TableProps,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusPending,
  StatusAborted,
  StatusRunning
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

interface VipRowData {
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
}

// Mock data for when authentication is not available
const mockVips: VipRowData[] = [
  {
    id: '65f1c3b3e4b0f8a7b0a3b3e1',
    vip_fqdn: 'app1.prod.ladc.davelab.net',
    vip_ip: '10.1.1.101',
    port: 443,
    protocol: 'HTTPS',
    environment: 'Prod',
    datacenter: 'LADC',
    app_id: 'APP001',
    owner: 'user1',
    status: 'Active',
  },
  {
    id: '65f1c3b3e4b0f8a7b0a3b3e2',
    vip_fqdn: 'app1.uat.nydc.davelab.net',
    vip_ip: '10.2.1.101',
    port: 80,
    protocol: 'HTTP',
    environment: 'UAT',
    datacenter: 'NYDC',
    app_id: 'APP001',
    owner: 'user1',
    status: 'Building',
  },
  {
    id: '65f1c3b3e4b0f8a7b0a3b3e3',
    vip_fqdn: 'app2.dev.ladc.davelab.net',
    vip_ip: '192.168.1.50',
    port: 8080,
    protocol: 'TCP',
    environment: 'DEV',
    datacenter: 'LADC',
    app_id: 'APP002',
    owner: 'user2',
    status: 'Error',
  },
];

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

export const VipListPage = () => {
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const [vips, setVips] = useState<VipRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedVipId, setSelectedVipId] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check authentication status and fetch VIPs
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Check if user is authenticated
        if (!lbaasApi.isAuthenticated()) {
          console.log('User is not authenticated, using mock data');
          // Use mock data when not authenticated
          setVips(mockVips);
          // Show login dialog
          setShowLoginDialog(true);
        } else {
          console.log('User is authenticated, fetching real data');
          // User is authenticated, fetch real data
          try {
            const data = await lbaasApi.getVips();
            // Ensure all VIPs have a status property to prevent errors
            const safeData = data.map(vip => ({
              ...vip,
              status: vip.status || 'Unknown'
            }));
            setVips(safeData);
          } catch (apiError: any) {
            console.error('API call failed:', apiError);
            // If authentication error, show login dialog and use mock data
            if (apiError.message === 'Authentication required. Please login.' || 
                apiError.message === 'Authentication expired. Please login again.') {
              setShowLoginDialog(true);
              setVips(mockVips);
            } else {
              // For other errors, propagate them
              throw apiError;
            }
          }
        }
      } catch (e: any) {
        setError(e);
        
        // If authentication error, show login dialog
        if (e.message === 'Authentication required. Please login.') {
          setShowLoginDialog(true);
        }
        
        alertApi.post({ message: `Error fetching VIPs: ${e.message}`, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [alertApi, identityApi, lbaasApi]);

  const handleLogin = async () => {
    if (!username || !password) {
      alertApi.post({ message: 'Username and password are required.', severity: 'error' });
      return;
    }
    
    try {
      setIsLoggingIn(true);
      
      // Attempt to login
      await lbaasApi.login(username, password);
      
      // If successful, close dialog and refresh data
      setShowLoginDialog(false);
      setUsername('');
      setPassword('');
      
      // Fetch real data after login
      setLoading(true);
      try {
        const data = await lbaasApi.getVips();
        // Ensure all VIPs have a status property to prevent errors
        const safeData = data.map(vip => ({
          ...vip,
          status: vip.status || 'Unknown'
        }));
        setVips(safeData);
      } catch (apiError: any) {
        console.error('API call failed after login:', apiError);
        // Use mock data as fallback
        setVips(mockVips);
        throw apiError;
      }
      
      alertApi.post({ message: 'Login successful.', severity: 'success' });
    } catch (e: any) {
      alertApi.post({ message: `Login failed: ${e.message}`, severity: 'error' });
    } finally {
      setIsLoggingIn(false);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await lbaasApi.logout();
      // Reset to mock data after logout
      setVips(mockVips);
      alertApi.post({ message: 'Logged out successfully.', severity: 'success' });
    } catch (e: any) {
      alertApi.post({ message: `Error during logout: ${e.message}`, severity: 'error' });
    }
  };

  const handleDeleteClick = (vipId: string) => {
    // Check authentication before allowing delete
    if (!lbaasApi.isAuthenticated()) {
      alertApi.post({ message: 'Authentication required to delete VIPs.', severity: 'error' });
      setShowLoginDialog(true);
      return;
    }
    
    setSelectedVipId(vipId);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedVipId(null);
    setIncidentId('');
  };

  const handleConfirmDelete = async () => {
    if (!selectedVipId || !incidentId) {
      alertApi.post({ message: 'Incident ID is required for deletion.', severity: 'error' });
      return;
    }
    
    // Check authentication before attempting delete
    if (!lbaasApi.isAuthenticated()) {
      alertApi.post({ message: 'Authentication required to delete VIPs.', severity: 'error' });
      setShowLoginDialog(true);
      handleCloseDeleteDialog();
      return;
    }
    
    try {
      // Use the API client to delete VIP
      await lbaasApi.deleteVip(selectedVipId, incidentId);
      alertApi.post({ message: `VIP ${selectedVipId} deleted successfully.`, severity: 'success' });
      // Refresh VIP list
      setVips(vips.filter(vip => vip.id !== selectedVipId));
    } catch (e: any) {
      alertApi.post({ message: `Error deleting VIP: ${e.message}`, severity: 'error' });
      
      // If authentication error, show login dialog
      if (e.message === 'Authentication required. Please login.' || 
          e.message === 'Authentication expired. Please login again.') {
        setShowLoginDialog(true);
      }
    }
    handleCloseDeleteDialog();
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error && !showLoginDialog) {
    return <Typography color="error">Error loading VIPs: {error.message}</Typography>;
  }

  const columns: TableProps<VipRowData>['columns'] = [
    { title: 'FQDN', field: 'vip_fqdn' },
    { title: 'IP Address', field: 'vip_ip' },
    { title: 'Port', field: 'port', type: 'numeric' },
    { title: 'Protocol', field: 'protocol' },
    { title: 'Environment', field: 'environment' },
    { title: 'Datacenter', field: 'datacenter' },
    { title: 'App ID', field: 'app_id' },
    { title: 'Owner', field: 'owner' },
    { title: 'Status', field: 'status', render: rowData => getStatusComponent(rowData.status) },
    {
      title: 'Actions',
      render: (rowData: VipRowData) => (
        <>
          <Tooltip title="View Details">
            <IconButton component={RouterLink} to={`/lbaas-frontend/${rowData.id}/view`}>
              <Visibility />
            </IconButton>
          </Tooltip>
          <Tooltip title="Modify VIP">
            <IconButton component={RouterLink} to={`/lbaas-frontend/${rowData.id}/edit`}>
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete VIP">
            <IconButton onClick={() => handleDeleteClick(rowData.id)}>
              <Delete />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Page themeId="tool">
      <Header title="Load Balancer VIPs" subtitle="Manage your Load Balancer Virtual IP Addresses">
        {/* <HeaderLabel label="Owner" value="Dynamic Owner" /> */}
        {/* <HeaderLabel label="Lifecycle" value="Alpha" /> */}
      </Header>
      <Content>
        <ContentHeader title="VIP List">
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Button
                variant="contained"
                color="primary"
                component={RouterLink}
                to="/lbaas-frontend/create"
                startIcon={<AddCircleOutline />}
              >
                Create New VIP
              </Button>
            </Grid>
            <Grid item>
              {lbaasApi.isAuthenticated() ? (
                <Button variant="outlined" color="secondary" onClick={handleLogout}>
                  Logout
                </Button>
              ) : (
                <Button variant="outlined" color="primary" onClick={() => setShowLoginDialog(true)}>
                  Login
                </Button>
              )}
            </Grid>
            <Grid item>
              <SupportButton>Manage and request load balancer VIPs.</SupportButton>
            </Grid>
          </Grid>
        </ContentHeader>
        
        {!lbaasApi.isAuthenticated() && (
          <Paper style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#fff3e0' }}>
            <Typography variant="body2" color="textSecondary">
              You are viewing mock data. Please login to access real VIP data and perform actions.
            </Typography>
          </Paper>
        )}
        
        <Grid container spacing={3} direction="column">
          <Grid item>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    {columns.map((col, index) => (
                      <TableCell key={index}>{col.title}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} align="center">
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
                        <TableCell>{getStatusComponent(row.status)}</TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton component={RouterLink} to={`/lbaas-frontend/${row.id}/view`}>
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Modify VIP">
                            <IconButton component={RouterLink} to={`/lbaas-frontend/${row.id}/edit`}>
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

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onClose={() => setShowLoginDialog(false)}>
        <DialogTitle>Login Required</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please login to access the LBaaS API and perform actions.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="username"
            label="Username"
            type="text"
            fullWidth
            variant="standard"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="dense"
            id="password"
            label="Password"
            type="password"
            fullWidth
            variant="standard"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLoginDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleLogin} 
            color="primary" 
            disabled={!username || !password || isLoggingIn}
          >
            {isLoggingIn ? <CircularProgress size={24} /> : 'Login'}
          </Button>
        </DialogActions>
      </Dialog>

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
            onChange={(e) => setIncidentId(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="secondary" disabled={!incidentId.trim()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};
