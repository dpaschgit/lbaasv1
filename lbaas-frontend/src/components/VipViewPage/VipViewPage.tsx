import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, List, ListItem, ListItemText } from '@material-ui/core';
import { Link as RouterLink, useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

// Interface for VIP details data
interface VipDetailsData {
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
  created_at?: string;
  updated_at?: string;
  pool_members?: Array<{ ip: string; port: number; enabled: boolean; status?: string }>;
  monitor?: { type: string; port?: number; send_string?: string; receive_string?: string; interval?: number; timeout?: number };
  persistence?: { type: string; timeout?: number };
}

// Added null/undefined check to prevent crashes
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

export const VipViewPage = () => {
  // Use vipId parameter consistently across all components
  const { vipId } = useParams<{ vipId: string }>();
  const location = useLocation();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  const [vipDetails, setVipDetails] = useState<VipDetailsData | null>(null);
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
        
        // Check if we have cached data in sessionStorage
        const cachedData = sessionStorage.getItem(`vip_${vipId}`);
        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData);
            setVipDetails(parsedData);
            console.log('Using cached VIP data from sessionStorage');
            // Continue fetching fresh data in the background
          } catch (parseError) {
            console.error('Error parsing cached VIP data:', parseError);
            // Continue with API fetch if parsing fails
          }
        }
        
        try {
          // Use the API client to fetch VIP details
          const data = await lbaasApi.getVip(vipId);
          
          if (data) {
            // Ensure VIP has a status property to prevent errors
            const safeData = {
              ...data,
              status: data.status || 'Unknown'
            };
            setVipDetails(safeData);
            
            // Cache the data in sessionStorage for future use
            try {
              sessionStorage.setItem(`vip_${vipId}`, JSON.stringify(safeData));
            } catch (storageError) {
              console.error('Error caching VIP data:', storageError);
              // Non-critical error, continue without caching
            }
          } else {
            // If no data returned but no error thrown, check if we already have cached data
            if (!cachedData) {
              setError(new Error(`VIP with ID ${vipId} not found.`));
              alertApi.post({ message: `VIP with ID ${vipId} not found.`, severity: 'error' });
            }
          }
        } catch (apiError: any) {
          console.error('API call failed:', apiError);
          
          // If we don't have cached data, show the error
          if (!cachedData) {
            setError(apiError);
            alertApi.post({ message: `Error fetching VIP details: ${apiError.message}`, severity: 'error' });
          }
          // Otherwise, we'll continue using the cached data
        }
      } catch (e: any) {
        setError(e);
        alertApi.post({ message: `Error fetching VIP details: ${e.message}`, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [vipId, alertApi, identityApi, lbaasApi]);

  if (loading && !vipDetails) {
    return <CircularProgress />;
  }

  if (error && !vipDetails) {
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
          to={`/lbaas-frontend/${vipId}/edit`} 
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
        
        {error && (
          <Paper style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#fff3e0' }}>
            <Typography variant="body2" color="error">
              Warning: Using cached data. Could not fetch latest VIP details: {error.message}
            </Typography>
          </Paper>
        )}
        
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
                  {vipDetails.pool_members.map((member, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={`IP: ${member.ip}, Port: ${member.port}, Enabled: ${member.enabled}`}
                        secondary={member.status ? `Status: ${member.status}` : ''}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}

            {vipDetails.monitor && (
              <Grid item xs={12}>
                <Divider style={{ margin: '20px 0' }} />
                <Typography variant="h6">Health Monitor</Typography>
                <Typography variant="body2"><strong>Type:</strong> {vipDetails.monitor.type}</Typography>
                {vipDetails.monitor.port && <Typography variant="body2"><strong>Port:</strong> {vipDetails.monitor.port}</Typography>}
                {vipDetails.monitor.send_string && <Typography variant="body2"><strong>Send String:</strong> {vipDetails.monitor.send_string}</Typography>}
                {vipDetails.monitor.receive_string && <Typography variant="body2"><strong>Receive String:</strong> {vipDetails.monitor.receive_string}</Typography>}
                {vipDetails.monitor.interval && <Typography variant="body2"><strong>Interval:</strong> {vipDetails.monitor.interval}s</Typography>}
                {vipDetails.monitor.timeout && <Typography variant="body2"><strong>Timeout:</strong> {vipDetails.monitor.timeout}s</Typography>}
              </Grid>
            )}
            
            {vipDetails.persistence && (
              <Grid item xs={12}>
                <Divider style={{ margin: '20px 0' }} />
                <Typography variant="h6">Persistence</Typography>
                <Typography variant="body2"><strong>Type:</strong> {vipDetails.persistence.type}</Typography>
                {vipDetails.persistence.timeout && <Typography variant="body2"><strong>Timeout:</strong> {vipDetails.persistence.timeout}s</Typography>}
              </Grid>
            )}
          </Grid>
        </Paper>
        
        {/* Navigation buttons with consistent route structure */}
        <Grid container spacing={2} style={{ marginTop: '20px' }}>
          <Grid item>
            <Button
              component={RouterLink}
              to={`/lbaas-frontend/${vipId}/output`}
              variant="outlined"
              color="primary"
            >
              View Configuration Output
            </Button>
          </Grid>
          <Grid item>
            <Button
              component={RouterLink}
              to={`/lbaas-frontend/${vipId}/promote`}
              variant="outlined"
              color="primary"
            >
              Promote to New Environment
            </Button>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
