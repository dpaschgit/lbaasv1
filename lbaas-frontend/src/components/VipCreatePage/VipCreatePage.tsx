import React, { useState } from 'react';
import { Typography, Grid, Button, CircularProgress, TextField, Paper, FormControl, InputLabel, Select, MenuItem } from '@material-ui/core';
import { useNavigate } from 'react-router-dom';
import { ArrowBack } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, Vip, PoolMember } from '../../api';

export const VipCreatePage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Vip>>({
    vip_fqdn: '',
    vip_ip: '',
    port: 443,
    protocol: 'HTTPS',
    environment: 'DEV',
    datacenter: 'LADC',
    app_id: '',
    owner: '',
    pool_members: []
  });
  
  // Pool member management
  const [poolMembers, setPoolMembers] = useState<PoolMember[]>([]);
  const [currentPoolMember, setCurrentPoolMember] = useState<PoolMember>({
    server_name: '',
    server_ip: '',
    server_port: 8443,
    weight: 1
  });

  const handleChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof Vip;
    setFormData({
      ...formData,
      [name]: event.target.value,
    });
  };
  
  const handleNumericChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof Vip;
    const value = event.target.value as string;
    setFormData({
      ...formData,
      [name]: value === '' ? '' : Number(value),
    });
  };
  
  const handlePoolMemberChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    const name = event.target.name as keyof PoolMember;
    const value = event.target.value as string;
    
    setCurrentPoolMember({
      ...currentPoolMember,
      [name]: name === 'server_port' || name === 'weight' 
        ? (value === '' ? '' : Number(value)) 
        : value,
    });
  };
  
  const addPoolMember = () => {
    if (!currentPoolMember.server_name || !currentPoolMember.server_ip) {
      alertApi.post({ message: 'Server name and IP are required for pool members', severity: 'error' });
      return;
    }
    
    const updatedPoolMembers = [...poolMembers, currentPoolMember];
    setPoolMembers(updatedPoolMembers);
    setFormData({
      ...formData,
      pool_members: updatedPoolMembers
    });
    
    // Reset the form for the next pool member
    setCurrentPoolMember({
      server_name: '',
      server_ip: '',
      server_port: 8443,
      weight: 1
    });
  };
  
  const removePoolMember = (index: number) => {
    const updatedPoolMembers = poolMembers.filter((_, i) => i !== index);
    setPoolMembers(updatedPoolMembers);
    setFormData({
      ...formData,
      pool_members: updatedPoolMembers
    });
  };

  const validateForm = () => {
    if (!formData.vip_fqdn) {
      alertApi.post({ message: 'VIP FQDN is required', severity: 'error' });
      return false;
    }
    
    if (!formData.app_id) {
      alertApi.post({ message: 'Application ID is required', severity: 'error' });
      return false;
    }
    
    if (!formData.port || formData.port <= 0) {
      alertApi.post({ message: 'Valid port number is required', severity: 'error' });
      return false;
    }
    
    return true;
  };

  const handleBackToList = () => {
    navigate('/lbaas-frontend');
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('Creating new VIP with data:', formData);
      const result = await lbaasApi.createVip(formData);
      
      alertApi.post({ message: `VIP ${result.vip_fqdn} created successfully`, severity: 'success' });
      
      // Store the created VIP in sessionStorage for potential view/edit operations
      if (result) {
        sessionStorage.setItem('currentVip', JSON.stringify(result));
        
        // Navigate to the view page with the FQDN in the URL
        navigate(`/lbaas-frontend/view/${encodeURIComponent(result.vip_fqdn)}`);
      } else {
        // If no result, go back to list
        navigate('/lbaas-frontend');
      }
    } catch (e: any) {
      console.error('Error creating VIP:', e);
      
      // If authentication error, redirect to list page
      if (e.message.includes('Authentication') || e.message.includes('login')) {
        alertApi.post({ message: 'Authentication required. Please login again.', severity: 'error' });
        navigate('/lbaas-frontend');
      } else {
        alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page themeId="tool">
      <Header title="Create New VIP" subtitle="Configure a new Load Balancer VIP">
        <Button onClick={handleBackToList} variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP List
        </Button>
      </Header>
      <Content>
        <ContentHeader title="VIP Configuration">
          <SupportButton>Fill in the details to create a new VIP.</SupportButton>
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
              helperText="Fully Qualified Domain Name for the VIP"
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
              helperText="Unique identifier for the application"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="vip_ip"
              label="VIP IP Address"
              fullWidth
              value={formData.vip_ip || ''}
              onChange={handleChange}
              helperText="Optional: IP address will be assigned automatically if left blank"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="owner"
              label="Owner"
              fullWidth
              value={formData.owner || ''}
              onChange={handleChange}
              helperText="Owner or responsible team for this VIP"
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
              value={formData.port || ''}
              onChange={handleNumericChange}
              helperText="Port number for the VIP"
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
          
          {/* Pool Members Section */}
          <Grid item xs={12}>
            <Typography variant="h6" style={{ marginTop: '20px', marginBottom: '10px' }}>
              Pool Members
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Add servers to the load balancing pool
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  name="server_name"
                  label="Server Name"
                  fullWidth
                  value={currentPoolMember.server_name || ''}
                  onChange={handlePoolMemberChange}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  name="server_ip"
                  label="Server IP"
                  fullWidth
                  value={currentPoolMember.server_ip || ''}
                  onChange={handlePoolMemberChange}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  name="server_port"
                  label="Server Port"
                  type="number"
                  fullWidth
                  value={currentPoolMember.server_port || ''}
                  onChange={handlePoolMemberChange}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  name="weight"
                  label="Weight"
                  type="number"
                  fullWidth
                  value={currentPoolMember.weight || ''}
                  onChange={handlePoolMemberChange}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={addPoolMember}
                  style={{ marginTop: '16px' }}
                  fullWidth
                >
                  Add Member
                </Button>
              </Grid>
            </Grid>
            
            {/* Display added pool members */}
            {poolMembers.length > 0 && (
              <Paper style={{ marginTop: '20px', padding: '10px' }}>
                <Typography variant="subtitle1">Added Pool Members:</Typography>
                {poolMembers.map((member, index) => (
                  <Grid container spacing={1} key={index} style={{ marginTop: '8px' }}>
                    <Grid item xs={3}>
                      <Typography variant="body2">{member.server_name}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="body2">{member.server_ip}</Typography>
                    </Grid>
                    <Grid item xs={2}>
                      <Typography variant="body2">Port: {member.server_port}</Typography>
                    </Grid>
                    <Grid item xs={2}>
                      <Typography variant="body2">Weight: {member.weight}</Typography>
                    </Grid>
                    <Grid item xs={2}>
                      <Button
                        size="small"
                        color="secondary"
                        onClick={() => removePoolMember(index)}
                      >
                        Remove
                      </Button>
                    </Grid>
                  </Grid>
                ))}
              </Paper>
            )}
          </Grid>
          
          <Grid item xs={12} style={{ marginTop: '20px' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Create VIP'}
            </Button>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
