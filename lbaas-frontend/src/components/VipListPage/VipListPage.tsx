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

// Placeholder for API client - this will be defined in a separate api.ts file
// For now, we'll mock the data fetching

// Mocked API call to fetch VIPs (replace with actual API client later)
const mockFetchVips = async (authToken: string) => {
  console.log('Fetching VIPs with token:', authToken ? 'Token Present' : 'No Token');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  // This data should align with your seed_mongo.py and backend models
  return [
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
};

// Mocked API call to delete a VIP
const mockDeleteVip = async (vipId: string, incidentId: string, authToken: string) => {
  console.log(`Attempting to delete VIP: ${vipId} with Incident: ${incidentId} and token: ${authToken ? 'Token Present' : 'No Token'}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Simulate success/failure
  if (incidentId === 'valid_incident_for_delete') {
    return { success: true, message: `VIP ${vipId} deleted successfully.` };
  }
  return { success: false, message: 'Failed to delete VIP. Invalid incident ID or other error.' };
};


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

const getStatusComponent = (status: string) => {
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
  const [vips, setVips] = useState<VipRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedVipId, setSelectedVipId] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await identityApi.getCredentials(); // Get auth token
        const data = await mockFetchVips(token?.token || ''); // Pass token to API call
        setVips(data);
      } catch (e: any) {
        setError(e);
        alertApi.post({ message: `Error fetching VIPs: ${e.message}`, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [alertApi, identityApi]);

  const handleDeleteClick = (vipId: string) => {
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
          <Button
            variant="contained"
            color="primary"
            component={RouterLink}
            to="/lbaas-frontend/create"
            startIcon={<AddCircleOutline />}
          >
            Create New VIP
          </Button>
          <SupportButton>Manage and request load balancer VIPs.</SupportButton>
        </ContentHeader>
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
                            {/* Modify will eventually prompt for incident ID before navigating */}
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
