import React, { useState, useEffect } from 'react';
import { Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip } from '@material-ui/core';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Add, Visibility, Edit, Delete, LockOpen } from '@material-ui/icons';
import { Table, TableColumn, InfoCard } from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { CircularProgress } from '@material-ui/core';
import { StatusOK, StatusError, StatusPending, StatusAborted, StatusRunning } from '@backstage/core-components';
import { lbaasFrontendApiRef, Vip } from '../../api';
import { LoginPage } from '../LoginPage/LoginPage';

// Define the VIP data structure for the table
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

// Helper function to render status component
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

// VIP List Page Component
export const VipListPage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  
  const [vips, setVips] = useState<VipRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVipId, setSelectedVipId] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  useEffect(() => {
    const initializeAndFetchVips = async () => {
      try {
        setLoading(true);
        
        // Try to initialize authentication
        await lbaasApi.initializeAuth();
        
        // If authenticated, fetch VIPs
        if (lbaasApi.isAuthenticated()) {
          await fetchVips();
        } else {
          // Not authenticated, show login dialog
          setIsLoginDialogOpen(true);
          setLoading(false);
        }
      } catch (e: any) {
        setError(e);
        alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
        setLoading(false);
      }
    };

    initializeAndFetchVips();
  }, [alertApi, lbaasApi]);

  const fetchVips = async () => {
    try {
      setLoading(true);
      
      // Use the real API client to fetch VIPs
      const data = await lbaasApi.getVips();
      setVips(data as VipRowData[]);
      setError(null);
    } catch (e: any) {
      setError(e);
      alertApi.post({ message: `Error fetching VIPs: ${e.message}`, severity: 'error' });
      
      // If authentication error, show login dialog
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        setIsLoginDialogOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (vipId: string) => {
    setSelectedVipId(vipId);
    setIncidentId('');
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedVipId(null);
    setIncidentId('');
  };

  const handleConfirmDelete = async () => {
    if (!selectedVipId || !incidentId) {
      alertApi.post({ message: 'Incident ID is required for deletion.', severity: 'error' });
      return;
    }
    
    try {
      // Use the real API client to delete VIP
      await lbaasApi.deleteVip(selectedVipId, incidentId);
      
      // Show success message
      alertApi.post({ message: `VIP ${selectedVipId} deleted successfully.`, severity: 'success' });
      
      // Refresh VIP list by removing the deleted VIP from state
      setVips(vips.filter(vip => vip.id !== selectedVipId));
    } catch (e: any) {
      alertApi.post({ message: `Error deleting VIP: ${e.message}`, severity: 'error' });
      
      // If authentication error, show login dialog
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        setIsLoginDialogOpen(true);
      }
    }
    
    handleCloseDeleteDialog();
  };

  const handleLoginSuccess = () => {
    setIsLoginDialogOpen(false);
    fetchVips();
  };

  const handleLoginDialogClose = () => {
    setIsLoginDialogOpen(false);
    
    // If not authenticated, redirect to login page
    if (!lbaasApi.isAuthenticated()) {
      navigate('/lbaas-frontend/login');
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (!lbaasApi.isAuthenticated() && !isLoginDialogOpen) {
    return (
      <div>
        <InfoCard title="Authentication Required">
          <Typography variant="body1" style={{ marginBottom: '16px' }}>
            You need to be authenticated to view and manage VIPs.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setIsLoginDialogOpen(true)}
            startIcon={<LockOpen />}
          >
            Login
          </Button>
        </InfoCard>
        
        <Dialog open={isLoginDialogOpen} onClose={handleLoginDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>Login to LBaaS</DialogTitle>
          <DialogContent>
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (error && !isLoginDialogOpen) {
    return (
      <div>
        <Typography color="error">Error loading VIPs: {error.message}</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={fetchVips}
          style={{ marginTop: '16px', marginRight: '8px' }}
        >
          Retry
        </Button>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => setIsLoginDialogOpen(true)}
          startIcon={<LockOpen />}
          style={{ marginTop: '16px' }}
        >
          Login
        </Button>
        
        <Dialog open={isLoginDialogOpen} onClose={handleLoginDialogClose} maxWidth="sm" fullWidth>
          <DialogTitle>Login to LBaaS</DialogTitle>
          <DialogContent>
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const columns: TableColumn<VipRowData>[] = [
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Typography variant="h4">Load Balancer VIPs</Typography>
        <div>
          <Button
            variant="outlined"
            color="primary"
            onClick={fetchVips}
            style={{ marginRight: '8px' }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setIsLoginDialogOpen(true)}
            startIcon={<LockOpen />}
            style={{ marginRight: '8px' }}
          >
            {lbaasApi.isAuthenticated() ? 'Switch User' : 'Login'}
          </Button>
          <Button
            component={RouterLink}
            to="/lbaas-frontend/create"
            variant="contained"
            color="primary"
            startIcon={<Add />}
          >
            Create VIP
          </Button>
        </div>
      </div>

      <Table
        options={{ search: true, paging: true, pageSize: 10 }}
        data={vips}
        columns={columns}
        title="Virtual IP Configurations"
      />

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete VIP</DialogTitle>
        <DialogContent>
          <Typography variant="body1" style={{ marginBottom: '16px' }}>
            Are you sure you want to delete this VIP? This action cannot be undone.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            id="incident-id"
            label="ServiceNow Incident ID"
            type="text"
            fullWidth
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            helperText="A valid ServiceNow Incident ID is required for deletion."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="secondary">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={isLoginDialogOpen} onClose={handleLoginDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Login to LBaaS</DialogTitle>
        <DialogContent>
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
