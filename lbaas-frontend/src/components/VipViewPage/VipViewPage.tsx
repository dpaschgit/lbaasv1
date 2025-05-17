import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, List, ListItem, ListItemText } from '@material-ui/core';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowBack, Edit } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  StatusOK,
  StatusError,
  StatusPending,
  StatusAborted,
  StatusRunning
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, Vip, PoolMember } from '../../api';

const getStatusComponent = (status?: string) => {
  if (!status) return <StatusPending>Unknown</StatusPending>;
  
  switch (status.toLowerCase()) {
    case 'active':
      return <StatusOK>Active</StatusOK>;
    case 'pending':
      return <StatusPending>Pending</StatusPending>;
    case 'building':
      return <StatusRunning>Building</StatusRunning>;
    case 'inactive':
      return <StatusAborted>Inactive</StatusAborted>;
    case 'error':
      return <StatusError>Error</StatusError>;
    default:
      return <StatusPending>Unknown</StatusPending>;
  }
};

export const VipViewPage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  const { fqdn } = useParams<{ fqdn: string }>();
  
  const [vipDetails, setVipDetails] = useState<Vip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadVipDetails = async () => {
      try {
        setLoading(true);
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
          
          setVipDetails(vipData);
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
            setVipDetails(vipData);
          } else {
            // If no ID, use the VIP from the list
            console.log('Using VIP details from list (no ID available)');
            setVipDetails(matchingVip);
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
          setVipDetails(vipData);
        }
      } catch (e: any) {
        console.error('Error loading VIP details:', e);
        setError(e);
        alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    
    loadVipDetails();
  }, [alertApi, lbaasApi, fqdn]);

  const handleBackToList = () => {
    navigate('/lbaas-frontend');
  };

  const handleEditVip = () => {
    if (!vipDetails) {
      alertApi.post({ message: 'Cannot edit VIP: Missing details', severity: 'error' });
      return;
    }
    
    // Store the VIP data in sessionStorage as a backup
    sessionStorage.setItem('currentVip', JSON.stringify(vipDetails));
    
    // Navigate using the FQDN as the identifier in the URL
    navigate(`/lbaas-frontend/edit/${encodeURIComponent(vipDetails.vip_fqdn)}`);
  };

  if (loading) {
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

  if (!vipDetails) {
    return (
      <Page themeId="tool">
        <Header title="VIP Not Found" />
        <Content>
          <Typography>The requested VIP could not be found.</Typography>
          <Button onClick={handleBackToList} variant="outlined" style={{ marginTop: '20px' }}>
            Back to VIP List
          </Button>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header 
        title={`VIP Details: ${vipDetails.vip_fqdn}`}
        subtitle={`Application ID: ${vipDetails.app_id}`}>
        <Button onClick={handleBackToList} variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP List
        </Button>
        <Button 
          onClick={handleEditVip}
          variant="contained" 
          color="primary" 
          startIcon={<Edit />} 
          style={{ marginLeft: '10px' }}
        >
          Modify VIP
        </Button>
      </Header>
      <Content>
        <ContentHeader title="VIP Configuration">
          <SupportButton>Detailed information for the selected VIP.</SupportButton>
        </ContentHeader>
        <Paper style={{ padding: '20px' }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>FQDN:</strong> {vipDetails.vip_fqdn}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>IP Address:</strong> {vipDetails.vip_ip}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Port:</strong> {vipDetails.port}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Protocol:</strong> {vipDetails.protocol}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Environment:</strong> {vipDetails.environment}</Typography>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Typography variant="subtitle1"><strong>Datacenter:</strong> {vipDetails.datacenter}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>Owner:</strong> {vipDetails.owner}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>Status:</strong> {getStatusComponent(vipDetails.status)}</Typography>
            </Grid>
            {vipDetails.created_at && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Created At:</strong> {new Date(vipDetails.created_at).toLocaleString()}</Typography>
              </Grid>
            )}
            {vipDetails.updated_at && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Last Updated:</strong> {new Date(vipDetails.updated_at).toLocaleString()}</Typography>
              </Grid>
            )}

            {vipDetails.pool_members && vipDetails.pool_members.length > 0 && (
              <Grid item xs={12}>
                <Divider style={{ margin: '20px 0' }} />
                <Typography variant="h6">Pool Members</Typography>
                <List dense>
                  {vipDetails.pool_members.map((member: PoolMember, index: number) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={`Server: ${member.server_name} (${member.server_ip}:${member.server_port})`}
                        secondary={`Weight: ${member.weight}, Status: ${member.status || 'Unknown'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}
          </Grid>
        </Paper>
      </Content>
    </Page>
  );
};
