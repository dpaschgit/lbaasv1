import React, { useEffect, useState, FormEvent } from 'react';
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
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, Vip, AuthToken } from '../../api';

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
  const [token, setToken] = useState<string>('');
  const [loginOpen, setLoginOpen] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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
    } finally {
      setLoading(false);
    }
  };

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
    if (!selectedVipId || !incidentId || !token) {
      alertApi.post({ message: 'Incident ID is required for deletion.', severity: 'error' });
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
                        placeholder="Enter username (e.g., user1)"
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
                        placeholder="Enter password (e.g., user1)"
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
                    <Grid item>
                      <Typography variant="caption">
                        Hint: Try user1/user1 or admin/admin
                      </Typography>
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

  const columns: TableProps<Vip>['columns'] = [
    { title: 'FQDN', field: 'vip_fqdn' },
    { title: 'IP Address', field: 'vip_ip' },
    { title: 'Port', field: 'port', type: 'numeric' },
    { title: 'Protocol', field: 'protocol' },
    { title: 'Environment', field: 'environment' },
    { title: 'Datacenter', field: 'datacenter' },
    { title: 'App ID', field: 'app_id' },
    { title: 'Owner', field: 'owner' },
    { title: 'Status', field: 'status', render: rowData => getStatusComponent(rowData.status || '') },
    {
      title: 'Actions',
      render: (rowData: Vip) => (
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
                        <TableCell>{getStatusComponent(row.status || '')}</TableCell>
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
