import React, { useState, useEffect } from 'react';
import { Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip } from '@material-ui/core';
import { Link as RouterLink } from 'react-router-dom';
import { Add, Visibility, Edit, Delete } from '@material-ui/icons';
import { Table, TableColumn } from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { CircularProgress } from '@material-ui/core';
import { StatusOK, StatusError, StatusPending, StatusAborted, StatusRunning } from '@backstage/core-components';

// Define the VIP data structure
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

// Mock API call to fetch VIPs
const mockFetchVips = async (authToken: string): Promise<VipRowData[]> => {
  console.log(`Fetching VIPs with token: ${authToken ? 'Token Present' : 'No Token'}`);
  await new Promise(resolve => setTimeout(resolve, 700));
  return [
    {
      id: '65f1c3b3e4b0f8a7b0a3b3e1',
      vip_fqdn: 'app1.prod.ladc.davelab.net',
      vip_ip: '10.1.1.101',
      port: 443,
      protocol: 'HTTPS',
      environment: 'PROD',
      datacenter: 'LADC',
      app_id: 'APP001',
      owner: 'team-a',
      status: 'active',
    },
    {
      id: '65f1c3b3e4b0f8a7b0a3b3e2',
      vip_fqdn: 'app2.dev.nydc.davelab.net',
      vip_ip: '10.2.1.102',
      port: 80,
      protocol: 'HTTP',
      environment: 'DEV',
      datacenter: 'NYDC',
      app_id: 'APP002',
      owner: 'team-b',
      status: 'pending',
    },
    {
      id: '65f1c3b3e4b0f8a7b0a3b3e3',
      vip_fqdn: 'app3.uat.ukdc.davelab.net',
      vip_ip: '10.3.1.103',
      port: 8443,
      protocol: 'HTTPS',
      environment: 'UAT',
      datacenter: 'UKDC',
      app_id: 'APP003',
      owner: 'team-c',
      status: 'error',
    },
  ];
};

// Mock API call to delete a VIP
const mockDeleteVip = async (vipId: string, incidentId: string, authToken: string): Promise<{ success: boolean; message: string }> => {
  console.log(`Deleting VIP: ${vipId} with incident ID: ${incidentId} and token: ${authToken ? 'Token Present' : 'No Token'}`);
  await new Promise(resolve => setTimeout(resolve, 700));
  if (!incidentId) {
    return { success: false, message: 'Incident ID is required for deletion.' };
  }
  return { success: true, message: `VIP ${vipId} deleted successfully.` };
};

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
  const identityApi = useApi(identityApiRef);
  const [vips, setVips] = useState<VipRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVipId, setSelectedVipId] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');

  useEffect(() => {
    const fetchVips = async () => {
      try {
        setLoading(true);
        const token = await identityApi.getCredentials();
        const data = await mockFetchVips(token?.token || '');
        setVips(data);
      } catch (e: any) {
        setError(e);
        alertApi.post({ message: `Error fetching VIPs: ${e.message}`, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchVips();
  }, [alertApi, identityApi]);

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
      const token = await identityApi.getCredentials();
      const result = await mockDeleteVip(selectedVipId, incidentId, token?.token || '');
      if (result.success) {
        alertApi.post({ message: result.message, severity: 'success' });
        // Refresh VIP list
        setVips(vips.filter(vip => vip.id !== selectedVipId));
      } else {
        alertApi.post({ message: result.message, severity: 'error' });
      }
    } catch (e: any) {
      alertApi.post({ message: `Error deleting VIP: ${e.message}`, severity: 'error' });
    }
    handleCloseDeleteDialog();
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Typography color="error">Error loading VIPs: {error.message}</Typography>;
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
            {/* FIXED: Use consistent route pattern with /view suffix */}
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
    </div>
  );
};
