import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, TextField, Paper, Select, MenuItem, FormControl, InputLabel, Dialog, DialogActions, DialogContent, DialogContentText } from '@material-ui/core';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import { ArrowBack } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';

// Placeholder for actual VipData structure from your models.py
interface VipEditData {
  id: string;
  vip_fqdn: string;
  vip_ip?: string; // IP might not be editable, or fetched from IPAM
  port: number;
  protocol: string;
  environment: string;
  datacenter: string;
  app_id: string;
  // Add all other editable fields from VipDB model
  // e.g., pool_members, monitor, persistence
}

// Mocked API call to fetch a single VIP's details for editing
const mockFetchVipForEdit = async (vipId: string, authToken: string): Promise<VipEditData | null> => {
  console.log(`Fetching VIP for edit: ${vipId} with token: ${authToken ? 'Token Present' : 'No Token'}`);
  await new Promise(resolve => setTimeout(resolve, 700));
  // Return a mock object similar to what VipViewPage fetches, but perhaps only editable fields
  const mockVip: VipEditData = {
    id: vipId,
    vip_fqdn: 'app1.prod.ladc.davelab.net',
    vip_ip: '10.1.1.101', // May or may not be editable
    port: 443,
    protocol: 'HTTPS',
    environment: 'Prod',
    datacenter: 'LADC',
    app_id: 'APP001',
    // ... other fields
  };
  if (vipId === '65f1c3b3e4b0f8a7b0a3b3e1') return mockVip;
  return null;
};

// Mocked API call to update a VIP
const mockUpdateVip = async (vipId: string, vipData: any, incidentId: string, authToken: string) => {
  console.log('Updating VIP:', vipId, 'with data:', vipData, 'Incident:', incidentId, 'Token:', authToken ? 'Present' : 'No Token');
  await new Promise(resolve => setTimeout(resolve, 1000));
  if (incidentId === 'valid_incident_for_update' && vipData.vip_fqdn) {
    return { success: true, message: `VIP ${vipData.vip_fqdn} updated successfully.` };
  }
  return { success: false, message: 'Failed to update VIP. Invalid incident ID or missing FQDN.' };
};

export const VipEditPage = () => {
  const { vipId } = useParams<{ vipId: string }>();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [formData, setFormData] = useState<Partial<VipEditData>>({});
  const [incidentId, setIncidentId] = useState('');
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!vipId) {
        setError(new Error('VIP ID not found in URL.'));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const token = await identityApi.getCredentials();
        const data = await mockFetchVipForEdit(vipId, token?.token || '');
        if (data) {
          setFormData(data);
        } else {
          setError(new Error(`VIP with ID ${vipId} not found for editing.`));
          alertApi.post({ message: `VIP with ID ${vipId} not found.`, severity: 'error' });
        }
      } catch (e: any) {
        setError(e);
        alertApi.post({ message: `Error fetching VIP details for edit: ${e.message}`, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [vipId, alertApi, identityApi]);

  const handleChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof VipEditData;
    setFormData({
      ...formData,
      [name]: event.target.value,
    });
  };
  
  const handleNumericChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof VipEditData;
    const value = event.target.value as string;
    setFormData({
      ...formData,
      [name]: value === '' ? '' : Number(value),
    });
  };

  const handleSubmitPrompt = () => {
    if (!formData.vip_fqdn || !formData.app_id) {
      alertApi.post({ message: 'VIP FQDN and App ID are required.', severity: 'error' });
      return;
    }
    setShowIncidentDialog(true);
  };

  const handleUpdateVip = async () => {
    if (!vipId || !incidentId.trim()) {
      alertApi.post({ message: 'ServiceNow Incident ID is required.', severity: 'error' });
      return;
    }
    setSaving(true);
    try {
      const token = await identityApi.getCredentials();
      const vipPayload = {
        ...formData,
        servicenow_incident_id: incidentId.trim(),
      };
      const result = await mockUpdateVip(vipId, vipPayload, incidentId.trim(), token?.token || '');
      if (result.success) {
        alertApi.post({ message: result.message, severity: 'success' });
        navigate(`/lbaas-frontend/${vipId}/view`); // Navigate to view page after edit
      } else {
        alertApi.post({ message: result.message, severity: 'error' });
      }
    } catch (e: any) {
      alertApi.post({ message: `Error updating VIP: ${e.message}`, severity: 'error' });
    }
    setSaving(false);
    setShowIncidentDialog(false);
    setIncidentId('');
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Error" />
        <Content>
          <Typography color="error">{error.message}</Typography>
          <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" style={{ marginTop: '20px' }}>
            Back to VIP List
          </Button>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={`Edit VIP: ${formData.vip_fqdn || ''}`} subtitle={`Application ID: ${formData.app_id || ''}`}>
        <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined" startIcon={<ArrowBack />}>
          Back to View VIP
        </Button>
      </Header>
      <Content>
        <ContentHeader title="Modify VIP Configuration">
          <SupportButton>Update the details for this VIP.</SupportButton>
        </ContentHeader>
        <Grid container spacing={3} component={Paper} style={{ padding: '20px' }}>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              name="vip_fqdn"
              label="VIP FQDN"
              fullWidth
              value={formData.vip_fqdn || ''}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              name="app_id"
              label="Application ID"
              fullWidth
              value={formData.app_id || ''}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth required>
              <InputLabel id="environment-label">Environment</InputLabel>
              <Select
                labelId="environment-label"
                name="environment"
                value={formData.environment || 'DEV'}
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
                value={formData.datacenter || 'LADC'}
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
              value={formData.port || 0}
              onChange={handleNumericChange}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth required>
              <InputLabel id="protocol-label">Protocol</InputLabel>
              <Select
                labelId="protocol-label"
                name="protocol"
                value={formData.protocol || 'TCP'}
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
          {/* These would be pre-filled from formData and allow modification */}

          <Grid item xs={12} style={{ marginTop: '20px' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmitPrompt}
              disabled={saving || loading}
            >
              {saving ? <CircularProgress size={24} /> : 'Save Changes'}
            </Button>
          </Grid>
        </Grid>

        {/* Incident ID Dialog */}
        <Dialog open={showIncidentDialog} onClose={() => setShowIncidentDialog(false)}>
          <DialogTitle>Confirm VIP Update</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Please provide a valid ServiceNow Incident ID to proceed with updating this VIP.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              id="incidentIdUpdate"
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
            <Button onClick={handleUpdateVip} color="primary" disabled={!incidentId.trim() || saving}>
              {saving ? <CircularProgress size={24} /> : 'Update VIP'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};

