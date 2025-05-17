import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, List, ListItem, ListItemText } from '@material-ui/core';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
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

// Placeholder for actual VipData structure from your models.py
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
  created_at?: string; // Assuming these might be in your VipDB model
  updated_at?: string;
  pool_members?: Array<{ ip: string; port: number; enabled: boolean; status?: string }>;
  monitor?: { type: string; port?: number; send_string?: string; receive_string?: string; interval?: number; timeout?: number };
  persistence?: { type: string; timeout?: number };
  // Add all other fields from VipDB model
}

// Mocked API call to fetch a single VIP's details
const mockFetchVipDetails = async (vipId: string, authToken: string): Promise<VipDetailsData | null> => {
  console.log(`Fetching details for VIP: ${vipId} with token: ${authToken ? 'Token Present' : 'No Token'}`);
  await new Promise(resolve => setTimeout(resolve, 700));
  // Find the VIP from a mock dataset or return a detailed mock object
  const mockVips: VipDetailsData[] = [
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
      created_at: '2023-03-15T10:00:00Z',
      updated_at: '2023-03-16T11:30:00Z',
      pool_members: [{ ip: '192.168.10.1', port: 8443, enabled: true, status: 'Up' }, { ip: '192.168.10.2', port: 8443, enabled: true, status: 'Up' }],
      monitor: { type: 'HTTPS', port: 8443, send_string: 'GET /health', receive_string: '200 OK', interval: 10, timeout: 3 },
      persistence: { type: 'SOURCE_IP', timeout: 1800 },
    },
    // Add other mock VIPs if needed for testing different IDs
  ];
  const foundVip = mockVips.find(vip => vip.id === vipId);
  return foundVip || null;
};

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

export const VipViewPage = () => {
  const { vipId } = useParams<{ vipId: string }>();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
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
        const token = await identityApi.getCredentials();
        const data = await mockFetchVipDetails(vipId, token?.token || '');
        if (data) {
          setVipDetails(data);
        } else {
          setError(new Error(`VIP with ID ${vipId} not found.`));
          alertApi.post({ message: `VIP with ID ${vipId} not found.`, severity: 'error' });
        }
      } catch (e: any) {
        setError(e);
        alertApi.post({ message: `Error fetching VIP details: ${e.message}`, severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [vipId, alertApi, identityApi]);

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
        
        {/* New section for additional navigation buttons */}
        <Grid container spacing={2} style={{ marginTop: '20px' }}>
          <Grid item>
            <Button
              component={RouterLink}
              to={`/lbaas-frontend/vips/${vipId}/output`}
              variant="outlined"
              color="primary"
            >
              View Configuration Output
            </Button>
          </Grid>
          <Grid item>
            <Button
              component={RouterLink}
              to={`/lbaas-frontend/vips/${vipId}/promote`}
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
