import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, TextField, FormControl, InputLabel, Select, MenuItem, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Divider, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ArrowBack, Add, Delete } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { api } from '../../api';

interface ServerData {
  id: string;
  name: string;
  ip: string;
  owner: string;
  environment: string;
  datacenter: string;
}

interface PoolMember {
  server_id: string;
  server_name: string;
  server_ip: string;
  server_port: number;
  weight: number;
}

export const VipCreatePage = () => {
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [incidentId, setIncidentId] = useState('');
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [availableServers, setAvailableServers] = useState<ServerData[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    vip_fqdn: '',
    app_id: '',
    environment: 'DEV', // Default value
    datacenter: 'LADC', // Default value
    port: 80,
    protocol: 'TCP',
    lb_method: 'ROUND_ROBIN',
    pool_members: [] as PoolMember[],
  });

  // Fetch available servers when environment or datacenter changes
  useEffect(() => {
    const fetchServers = async () => {
      setLoadingServers(true);
      try {
        const token = await identityApi.getCredentials();
        // Call the CMDB API to get servers filtered by environment and datacenter
        const response = await api.get(
          `/cmdb/servers?environment=${formData.environment}&datacenter=${formData.datacenter}`,
          token?.token
        );
        
        if (response.success) {
          setAvailableServers(response.data);
        } else {
          throw new Error(response.error || 'Failed to fetch servers');
        }
      } catch (e: any) {
        alertApi.post({ message: `Error fetching servers: ${e.message}`, severity: 'error' });
        setAvailableServers([]);
      } finally {
        setLoadingServers(false);
      }
    };
    
    fetchServers();
  }, [formData.environment, formData.datacenter, alertApi, identityApi]);

  const handleChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof typeof formData;
    setFormData({
      ...formData,
      [name]: event.target.value,
    });
  };

  const handleNumericChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof typeof formData;
    const value = event.target.value as string;
    setFormData({
      ...formData,
      [name]: value === '' ? '' : Number(value),
    });
  };

  const handleAddServer = (server: ServerData) => {
    // Check if server is already added
    if (formData.pool_members.some(member => member.server_id === server.id)) {
      alertApi.post({ message: 'Server is already added to pool members', severity: 'warning' });
      return;
    }
    
    // Add server to pool members
    const newMember: PoolMember = {
      server_id: server.id,
      server_name: server.name,
      server_ip: server.ip,
      server_port: 8080, // Default port, can be changed later
      weight: 1, // Default weight
    };
    
    setFormData({
      ...formData,
      pool_members: [...formData.pool_members, newMember],
    });
  };

  const handleRemoveServer = (serverId: string) => {
    setFormData({
      ...formData,
      pool_members: formData.pool_members.filter(member => member.server_id !== serverId),
    });
  };

  const handleUpdatePoolMember = (index: number, field: keyof PoolMember, value: any) => {
    const updatedMembers = [...formData.pool_members];
    updatedMembers[index] = {
      ...updatedMembers[index],
      [field]: field === 'server_port' || field === 'weight' ? Number(value) : value,
    };
    
    setFormData({
      ...formData,
      pool_members: updatedMembers,
    });
  };

  const handleSubmitPrompt = () => {
    // Basic validation before showing incident dialog
    if (!formData.vip_fqdn || !formData.app_id) {
      alertApi.post({ message: 'VIP FQDN and App ID are required.', severity: 'error' });
      return;
    }
    
    if (formData.pool_members.length === 0) {
      alertApi.post({ message: 'At least one server must be added to the pool.', severity: 'error' });
      return;
    }
    
    setShowIncidentDialog(true);
  };

  const handleCreateVip = async () => {
    if (!incidentId.trim()) {
      alertApi.post({ message: 'ServiceNow Incident ID is required.', severity: 'error' });
      return;
    }
    setLoading(true);
    try {
      const token = await identityApi.getCredentials();
      
      // Call the API to create the VIP
      const response = await api.post('/vips', {
        ...formData,
        servicenow_incident_id: incidentId.trim(),
      }, token?.token);
      
      if (response.success) {
        alertApi.post({ message: `VIP ${formData.vip_fqdn} created successfully.`, severity: 'success' });
        navigate('/lbaas-frontend'); // Navigate back to the list page
      } else {
        throw new Error(response.error || 'Failed to create VIP');
      }
    } catch (e: any) {
      alertApi.post({ message: `Error creating VIP: ${e.message}`, severity: 'error' });
    } finally {
      setLoading(false);
      setShowIncidentDialog(false);
      setIncidentId('');
    }
  };

  return (
    <Page themeId="tool">
      <Header title="Create New VIP" subtitle="Request a new Load Balancer Virtual IP Address">
        <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP List
        </Button>
      </Header>
      <Content>
        <ContentHeader title="VIP Configuration Details">
          <SupportButton>Fill in the details below to request a new VIP.</SupportButton>
        </ContentHeader>
        
        <Grid container spacing={3}>
          {/* Basic VIP Information */}
          <Grid item xs={12}>
            <InfoCard title="Basic Information">
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    name="vip_fqdn"
                    label="VIP FQDN"
                    fullWidth
                    value={formData.vip_fqdn}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    name="app_id"
                    label="Application ID"
                    fullWidth
                    value={formData.app_id}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth required>
                    <InputLabel id="environment-label">Environment</InputLabel>
                    <Select
                      labelId="environment-label"
                      name="environment"
                      value={formData.environment}
                      onChange={handleChange}
                    >
                      <MenuItem value="DEV">DEV</MenuItem>
                      <MenuItem value="UAT">UAT</MenuItem>
                      <MenuItem value="PROD">PROD</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth required>
                    <InputLabel id="datacenter-label">Datacenter</InputLabel>
                    <Select
                      labelId="datacenter-label"
                      name="datacenter"
                      value={formData.datacenter}
                      onChange={handleChange}
                    >
                      <MenuItem value="LADC">LADC</MenuItem>
                      <MenuItem value="NYDC">NYDC</MenuItem>
                      <MenuItem value="UKDC">UKDC</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    required
                    name="port"
                    label="Port"
                    type="number"
                    fullWidth
                    value={formData.port}
                    onChange={handleNumericChange}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth required>
                    <InputLabel id="protocol-label">Protocol</InputLabel>
                    <Select
                      labelId="protocol-label"
                      name="protocol"
                      value={formData.protocol}
                      onChange={handleChange}
                    >
                      <MenuItem value="TCP">TCP</MenuItem>
                      <MenuItem value="UDP">UDP</MenuItem>
                      <MenuItem value="HTTP">HTTP</MenuItem>
                      <MenuItem value="HTTPS">HTTPS</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel id="lb-method-label">Load Balancing Method</InputLabel>
                    <Select
                      labelId="lb-method-label"
                      name="lb_method"
                      value={formData.lb_method}
                      onChange={handleChange}
                    >
                      <MenuItem value="ROUND_ROBIN">Round Robin</MenuItem>
                      <MenuItem value="LEAST_CONNECTIONS">Least Connections</MenuItem>
                      <MenuItem value="SOURCE_IP">Source IP</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>
          
          {/* Server Selection */}
          <Grid item xs={12}>
            <InfoCard title="Server Selection">
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6">Available Servers</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Showing servers for {formData.environment} in {formData.datacenter} that you have access to
                  </Typography>
                  {loadingServers ? (
                    <CircularProgress />
                  ) : availableServers.length === 0 ? (
                    <Typography>No servers available for the selected environment and datacenter.</Typography>
                  ) : (
                    <List>
                      {availableServers.map(server => (
                        <ListItem key={server.id}>
                          <ListItemText
                            primary={server.name}
                            secondary={`IP: ${server.ip} | Owner: ${server.owner}`}
                          />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" onClick={() => handleAddServer(server)}>
                              <Add />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6">Selected Pool Members</Typography>
                  {formData.pool_members.length === 0 ? (
                    <Typography>No servers selected. Add servers from the available list.</Typography>
                  ) : (
                    <List>
                      {formData.pool_members.map((member, index) => (
                        <React.Fragment key={member.server_id}>
                          <ListItem>
                            <ListItemText
                              primary={member.server_name}
                              secondary={`IP: ${member.server_ip}`}
                            />
                            <Grid container spacing={2} alignItems="center">
                              <Grid item>
                                <TextField
                                  label="Port"
                                  type="number"
                                  size="small"
                                  value={member.server_port}
                                  onChange={(e) => handleUpdatePoolMember(index, 'server_port', e.target.value)}
                                  style={{ width: '80px' }}
                                />
                              </Grid>
                              <Grid item>
                                <TextField
                                  label="Weight"
                                  type="number"
                                  size="small"
                                  value={member.weight}
                                  onChange={(e) => handleUpdatePoolMember(index, 'weight', e.target.value)}
                                  style={{ width: '80px' }}
                                />
                              </Grid>
                              <Grid item>
                                <IconButton edge="end" onClick={() => handleRemoveServer(member.server_id)}>
                                  <Delete />
                                </IconButton>
                              </Grid>
                            </Grid>
                          </ListItem>
                          <Divider />
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>
          
          {/* Submit Button */}
          <Grid item xs={12} style={{ marginTop: '20px', textAlign: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmitPrompt}
              disabled={loading}
              size="large"
            >
              {loading ? <CircularProgress size={24} /> : 'Submit VIP Request'}
            </Button>
          </Grid>
        </Grid>

        {/* Incident ID Dialog */}
        <Dialog open={showIncidentDialog} onClose={() => setShowIncidentDialog(false)}>
          <DialogTitle>Confirm VIP Creation</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please provide a valid ServiceNow Incident ID to proceed with creating this VIP.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              id="incidentIdCreate"
              label="ServiceNow Incident ID"
              type="text"
              fullWidth
              variant="standard"
              value={incidentId}
              onChange={(e) => setIncidentId(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowIncidentDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateVip} color="primary" disabled={!incidentId.trim() || loading}>
              {loading ? <CircularProgress size={24} /> : 'Create VIP'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};
