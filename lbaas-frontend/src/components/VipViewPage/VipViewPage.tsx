import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, TextField, Paper } from '@material-ui/core';
import { ArrowBack } from '@material-ui/icons';
import {
  InfoCard,
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, Vip } from '../../api';

// Token storage key - must match the one in api.ts
const TOKEN_STORAGE_KEY = 'lbaas_auth_token';

export const VipViewPage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  
  const [vip, setVip] = useState<Vip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const fetchVipDetails = async () => {
      try {
        setLoading(true);
        
        // Get VIP ID from URL
        const pathParts = window.location.pathname.split('/');
        const vipId = pathParts[pathParts.length - 2]; // Format: /lbaas-frontend/:vipId/view
        
        if (!vipId) {
          throw new Error('VIP ID not found in URL');
        }
        
        console.log(`Fetching details for VIP ID: ${vipId}`);
        
        // Get token from localStorage
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!token) {
          setLoginOpen(true);
          throw new Error('Authentication required. Please login.');
        }
        
        // Fetch VIP details
        const vipData = await lbaasApi.getVip(vipId, token);
        setVip(vipData);
      } catch (e: any) {
        console.error('Error fetching VIP details:', e);
        setError(e);
        alertApi.post({ message: `Error: ${e.message}`, severity: 'error' });
        
        // If authentication error, redirect to main page for login
        if (e.message.includes('Authentication') || e.message.includes('login')) {
          navigateToMainPage();
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchVipDetails();
  }, []);

  const navigateToMainPage = () => {
    try {
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('/lbaas-frontend')[0];
      window.location.href = `${baseUrl}/lbaas-frontend`;
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  if (loginOpen) {
    return (
      <Page themeId="tool">
        <Header title="VIP Details" subtitle="View Load Balancer VIP Information" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12} sm={8} md={6} lg={4}>
              <InfoCard title="Authentication Required">
                <Typography>You need to login to view VIP details.</Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={navigateToMainPage}
                  style={{ marginTop: 16 }}
                >
                  Go to Login
                </Button>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="VIP Details" subtitle="View Load Balancer VIP Information" />
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
        <Header title="VIP Details" subtitle="View Load Balancer VIP Information" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12}>
              <InfoCard title="Error">
                <Typography color="error">Error loading VIP details: {error.message}</Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={navigateToMainPage}
                  style={{ marginTop: 16 }}
                >
                  Back to VIP List
                </Button>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  if (!vip) {
    return (
      <Page themeId="tool">
        <Header title="VIP Details" subtitle="View Load Balancer VIP Information" />
        <Content>
          <Grid container spacing={3} justifyContent="center">
            <Grid item xs={12}>
              <InfoCard title="Not Found">
                <Typography>VIP not found or has been deleted.</Typography>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={navigateToMainPage}
                  style={{ marginTop: 16 }}
                >
                  Back to VIP List
                </Button>
              </InfoCard>
            </Grid>
          </Grid>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="VIP Details" subtitle="View Load Balancer VIP Information" />
      <Content>
        <ContentHeader title={vip.vip_fqdn || 'VIP Details'}>
          <Button
            variant="contained"
            color="primary"
            onClick={navigateToMainPage}
            startIcon={<ArrowBack />}
          >
            Back to VIP List
          </Button>
          <SupportButton>View detailed information about this VIP.</SupportButton>
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <InfoCard title="Basic Information">
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="FQDN"
                    value={vip.vip_fqdn || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="IP Address"
                    value={vip.vip_ip || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Port"
                    value={vip.port || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Protocol"
                    value={vip.protocol || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>
          
          <Grid item xs={12}>
            <InfoCard title="Environment Information">
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Environment"
                    value={vip.environment || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Datacenter"
                    value={vip.datacenter || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="App ID"
                    value={vip.app_id || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Owner"
                    value={vip.owner || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Status"
                    value={vip.status || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>
          
          {vip.pool_members && vip.pool_members.length > 0 && (
            <Grid item xs={12}>
              <InfoCard title="Pool Members">
                <Grid container spacing={3}>
                  {vip.pool_members.map((member, index) => (
                    <Grid item xs={12} key={member.id || index}>
                      <Paper elevation={1} style={{ padding: 16 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              label="Server Name"
                              value={member.server_name || ''}
                              InputProps={{ readOnly: true }}
                              margin="normal"
                              variant="outlined"
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              label="Server IP"
                              value={member.server_ip || ''}
                              InputProps={{ readOnly: true }}
                              margin="normal"
                              variant="outlined"
                            />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <TextField
                              fullWidth
                              label="Server Port"
                              value={member.server_port || ''}
                              InputProps={{ readOnly: true }}
                              margin="normal"
                              variant="outlined"
                            />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <TextField
                              fullWidth
                              label="Weight"
                              value={member.weight || ''}
                              InputProps={{ readOnly: true }}
                              margin="normal"
                              variant="outlined"
                            />
                          </Grid>
                          <Grid item xs={12} md={2}>
                            <TextField
                              fullWidth
                              label="Status"
                              value={member.status || ''}
                              InputProps={{ readOnly: true }}
                              margin="normal"
                              variant="outlined"
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </InfoCard>
            </Grid>
          )}
          
          <Grid item xs={12}>
            <InfoCard title="Timestamps">
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Created At"
                    value={vip.created_at || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Updated At"
                    value={vip.updated_at || ''}
                    InputProps={{ readOnly: true }}
                    margin="normal"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
