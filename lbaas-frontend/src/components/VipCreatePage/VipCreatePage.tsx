import React from 'react';
import { Typography, Grid, Button, CircularProgress, TextField, Paper, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel } from '@material-ui/core';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ArrowBack } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';

// Placeholder for API client
const mockCreateVip = async (vipData: any, incidentId: string, authToken: string) => {
  console.log('Creating VIP with data:', vipData, 'Incident:', incidentId, 'Token:', authToken ? 'Present' : 'No Token');
  await new Promise(resolve => setTimeout(resolve, 1000));
  // Simulate success/failure based on incidentId or other data
  if (incidentId === 'valid_incident_for_create' && vipData.vip_fqdn) {
    return { success: true, message: `VIP ${vipData.vip_fqdn} created successfully.`, vip_id: 'new_vip_id_from_api' };
  }
  return { success: false, message: 'Failed to create VIP. Invalid incident ID or missing FQDN.' };
};

export const VipCreatePage = () => {
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [incidentId, setIncidentId] = useState('');
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);

  // Form state - expand with all fields from VipCreate model
  const [formData, setFormData] = useState({
    vip_fqdn: '',
    app_id: '',
    environment: 'DEV', // Default value
    datacenter: 'LADC', // Default value
    port: 80,
    protocol: 'TCP',
    // Add other fields like pool_members, monitor, persistence, etc.
  });

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

  const handleSubmitPrompt = () => {
    // Basic validation before showing incident dialog
    if (!formData.vip_fqdn || !formData.app_id) {
      alertApi.post({ message: 'VIP FQDN and App ID are required.', severity: 'error' });
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
      // Construct the full VIP data payload from formData
      const vipPayload = {
        ...formData,
        // Ensure pool_members, monitor, etc. are structured correctly for the API
        servicenow_incident_id: incidentId.trim(), // Add incident ID to payload
      };
      const result = await mockCreateVip(vipPayload, incidentId.trim(), token?.token || '');
      if (result.success) {
        alertApi.post({ message: result.message, severity: 'success' });
        navigate('/lbaas-frontend'); // Navigate back to the list page or to the new VIP's view page
      } else {
        alertApi.post({ message: result.message, severity: 'error' });
      }
    } catch (e: any) {
      alertApi.post({ message: `Error creating VIP: ${e.message}`, severity: 'error' });
    }
    setLoading(false);
    setShowIncidentDialog(false);
    setIncidentId('');
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
        <Grid container spacing={3} component={Paper} style={{ padding: '20px' }}>
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
          {/* Add more form fields here for pool_members, monitor, persistence etc. */}
          {/* Example for pool members - this would need more complex state management */}
          {/* <Grid item xs={12}>
            <Typography variant="h6">Pool Members</Typography>
             ... UI for adding/removing pool members ... 
          </Grid> */}

          <Grid item xs={12} style={{ marginTop: '20px' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmitPrompt}
              disabled={loading}
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

