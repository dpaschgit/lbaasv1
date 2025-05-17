import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, List, ListItem, ListItemText } from '@material-ui/core';
import { Link as RouterLink, useParams } from 'react-router-dom';
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
  const { vipId } = useParams<{ vipId: string }>();
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  
  const [vipDetails, setVipDetails] = useState<Vip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!vipId) {
        setError(new Error('VIP ID not found in URL.'));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Fetching details for VIP: ${vipId}`);
        const data = await lbaasApi.getVip(vipId);
        console.log('Fetched VIP details:', data);
        
        setVipDetails(data);
      } catch (e: any) {
        console.error('Error fetching VIP details:', e);
        setError(e);
        
        // If authentication error, redirect to list page
        if (e.message.includes('Authentication') || e.message.includes('login')) {
          alertApi.post({ message: 'Authentication required. Please login again.', severity: 'error' });
          window.location.href = '/lbaas-frontend';
        } else {
          alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [vipId, alertApi, lbaasApi]);

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
          <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" style={{ marginTop: '20px' }}>
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
          <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" style={{ marginTop: '20px' }}>
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
        <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP List
        </Button>
        <Button 
          component={RouterLink} 
          to={`/lbaas-frontend/${vipDetails.id}/edit`} 
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
