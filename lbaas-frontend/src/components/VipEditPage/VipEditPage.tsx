import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, TextField, Paper, FormControl, InputLabel, Select, MenuItem } from '@material-ui/core';
import { useNavigate, useParams } from 'react-router-dom';
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

export const VipEditPage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  const { fqdn } = useParams<{ fqdn: string }>();
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [formData, setFormData] = useState<Partial<Vip>>({});
  
  // Pool member management
  const [poolMembers, setPoolMembers] = useState<PoolMember[]>([]);
  const [currentPoolMember, setCurrentPoolMember] = useState<PoolMember>({
    server_name: '',
    server_ip: '',
    server_port: 8443,
    weight: 1
  });

  useEffect(() => {
    const loadVipDetails = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        
        console.log(`Loading VIP details for FQDN: ${fqdn}`);
        
        if (!fqdn) {
          // If no FQDN in URL, try to get VIP from sessionStorage
          const storedVip = sessionStorage.getItem('currentVip');
          
          if (!storedVip) {
            throw new Error('VIP details not found. Please return to the VIP list and try again.');
          }
          
          const vipData = JSON.parse(storedVip) as Vip;
          console.log('Loaded VIP details from sessionStorage:', vipData);
          
          setFormData(vipData);
          setPoolMembers(vipData.pool_members || []);
          return;
        }
        
        // Try to fetch VIP details from backend using FQDN
        try {
          // First, get all VIPs
          const allVips = await lbaasApi.getVips();
          console.log('Fetched all VIPs to find matching FQDN:', allVips);
          
          // Find the VIP with matching FQDN
          const decodedFqdn = decodeURIComponent(fqdn);
          const matchingVip = allVips.find(vip => vip.vip_fqdn === decodedFqdn);
          
          if (!matchingVip) {
            throw new Error(`VIP with FQDN ${decodedFqdn} not found`);
          }
          
          console.log('Found matching VIP:', matchingVip);
          
          // If VIP has an ID, fetch full details
          if (matchingVip.id) {
            console.log(`Fetching full VIP details for ID: ${matchingVip.id}`);
            const vipData = await lbaasApi.getVip(matchingVip.id);
            console.log('Fetched VIP details from backend:', vipData);
            setFormData(vipData);
            setPoolMembers(vipData.pool_members || []);
          } else {
            // If no ID, use the VIP from the list
            console.log('Using VIP details from list (no ID available)');
            setFormData(matchingVip);
            setPoolMembers(matchingVip.pool_members || []);
          }
        } catch (e) {
          console.error('Error fetching VIP from backend:', e);
          
          // Fallback to sessionStorage if backend fetch fails
          const storedVip = sessionStorage.getItem('currentVip');
          
          if (!storedVip) {
            throw new Error('Failed to fetch VIP details from backend and no backup found in sessionStorage.');
          }
          
          console.log('Falling back to sessionStorage for VIP details');
          const vipData = JSON.parse(storedVip) as Vip;
          setFormData(vipData);
          setPoolMembers(vipData.pool_members || []);
        }
      } catch (e: any) {
        console.error('Error loading VIP details:', e);
        setError(e);
        alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadVipDetails();
  }, [alertApi, lbaasApi, fqdn]);

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

  const handleBackToView = () => {
    if (formData.vip_fqdn) {
      navigate(`/lbaas-frontend/view/${encodeURIComponent(formData.vip_fqdn)}`);
    } else {
      navigate('/lbaas-frontend');
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('Updating VIP with data:', formData);
      const result = await lbaasApi.updateVip(formData.id || '', formData);
      
      alertApi.post({ message: `VIP ${result.vip_fqdn} updated successfully`, severity: 'success' });
      
      // Update the VIP in sessionStorage
      if (result) {
        sessionStorage.setItem('currentVip', JSON.stringify(result));
        
        // Navigate to the view page with the FQDN in the URL
        navigate(`/lbaas-frontend/view/${encodeURIComponent(result.vip_fqdn)}`);
      } else {
        // If no result, go back to list
        navigate('/lbaas-frontend');
      }
    } catch (e: any) {
      console.error('Error updating VIP:', e);
      
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

  if (initialLoading) {
    return (
      <Page themeId="tool">
        <Header title="Loading VIP Details" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item>
              <CircularProgress />
              <Typography style={{ marginTop: 16 }}>Loading VIP details...</Typography>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Error" />
        <Content>
          <Typography color="error">{error.message}</Typography>
          <Button onClick={handleBackToList} variant="outlined" style={{ marginTop: '20px' }}>
            Back to VIP List
          </Button>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title={`Edit VIP: ${formData.vip_fqdn}`} subtitle={`Application ID: ${formData.app_id}`}>
        <Button onClick={handleBackToView} variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP Details
        </Button>
      </Header>
      <Content>
        <ContentHeader title="VIP Configuration">
          <SupportButton>Edit the details of this VIP.</SupportButton>
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
              helperText="IP address for the VIP"
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
              Add or remove servers in the load balancing pool
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
                <Typography variant="subtitle1">Pool Members:</Typography>
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
              {loading ? <CircularProgress size={24} /> : 'Update VIP'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleBackToView}
              style={{ marginLeft: '10px' }}
            >
              Cancel
            </Button>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
