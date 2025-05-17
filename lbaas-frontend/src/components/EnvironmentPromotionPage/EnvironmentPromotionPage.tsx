import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, TextField, FormControl, InputLabel, Select, MenuItem, Divider } from '@material-ui/core';
import { Link as RouterLink, useParams, useLocation } from 'react-router-dom';
import { ArrowBack, ArrowForward } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  StructuredMetadataTable
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

// Mock interfaces for VIP details and environment promotion
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
}

interface EnvironmentOption {
  value: string;
  label: string;
  datacenters: DatacenterOption[];
}

interface DatacenterOption {
  value: string;
  label: string;
}

export const EnvironmentPromotionPage = () => {
  // Use vipId parameter consistently across all components
  const { vipId } = useParams<{ vipId: string }>();
  const location = useLocation();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const [vipDetails, setVipDetails] = useState<VipDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [targetEnvironment, setTargetEnvironment] = useState('');
  const [targetDatacenter, setTargetDatacenter] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);
  
  // Mock environment options
  const environmentOptions: EnvironmentOption[] = [
    { 
      value: 'DEV', 
      label: 'Development',
      datacenters: [
        { value: 'LADC', label: 'Los Angeles Datacenter' },
        { value: 'NYDC', label: 'New York Datacenter' }
      ]
    },
    { 
      value: 'UAT', 
      label: 'User Acceptance Testing',
      datacenters: [
        { value: 'LADC', label: 'Los Angeles Datacenter' },
        { value: 'NYDC', label: 'New York Datacenter' },
        { value: 'UKDC', label: 'London Datacenter' }
      ]
    },
    { 
      value: 'PROD', 
      label: 'Production',
      datacenters: [
        { value: 'LADC', label: 'Los Angeles Datacenter' },
        { value: 'NYDC', label: 'New York Datacenter' },
        { value: 'UKDC', label: 'London Datacenter' },
        { value: 'SGDC', label: 'Singapore Datacenter' }
      ]
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!vipId) {
        setError(new Error('VIP ID not found in URL.'));
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // In a real implementation, this would be an actual API call to your backend
        // For now, we'll use mock data to demonstrate the UI
        
        // Mock VIP details
        const data: VipDetailsData = {
          id: vipId,
          vip_fqdn: "app1.dev.ladc.davelab.net",
          vip_ip: "192.168.1.50",
          port: 8080,
          protocol: "TCP",
          environment: "DEV",
          datacenter: "LADC",
          app_id: "APP002",
          owner: "user2",
          status: "Active"
        };
        
        setVipDetails(data);
        
        // Set default target environment (next logical environment)
        if (data.environment === 'DEV') {
          setTargetEnvironment('UAT');
          setTargetDatacenter(data.datacenter); // Keep same datacenter by default
        } else if (data.environment === 'UAT') {
          setTargetEnvironment('PROD');
          setTargetDatacenter(data.datacenter);
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

  const handleEnvironmentChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newEnv = event.target.value as string;
    setTargetEnvironment(newEnv);
    
    // Reset datacenter when environment changes
    setTargetDatacenter('');
  };

  const handleDatacenterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setTargetDatacenter(event.target.value as string);
  };

  const handlePromote = async () => {
    if (!vipDetails || !targetEnvironment || !targetDatacenter || !incidentId) {
      alertApi.post({ message: 'Please fill in all required fields.', severity: 'error' });
      return;
    }
    
    try {
      setIsPromoting(true);
      
      // In a real implementation, this would be an actual API call to your backend
      // For now, we'll simulate a promotion with a timeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful promotion
      alertApi.post({ 
        message: `VIP ${vipDetails.vip_fqdn} successfully promoted to ${targetEnvironment} environment in ${targetDatacenter} datacenter.`, 
        severity: 'success' 
      });
      
      // In a real implementation, you might navigate to the new VIP's view page
      // navigate(`/lbaas-frontend/${newVipId}/view`);
      
    } catch (e: any) {
      alertApi.post({ message: `Error promoting VIP: ${e.message}`, severity: 'error' });
    } finally {
      setIsPromoting(false);
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Loading VIP Details" />
        <Content>
          <Grid container justifyContent="center" alignItems="center" style={{ height: '400px' }}>
            <CircularProgress />
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

  // Get available datacenters for selected environment
  const selectedEnv = environmentOptions.find(env => env.value === targetEnvironment);
  const availableDatacenters = selectedEnv?.datacenters || [];

  // Check if current environment is already production
  const isProduction = vipDetails.environment === 'PROD';

  // Prepare metadata for source VIP
  const sourceVipMetadata = {
    'VIP FQDN': vipDetails.vip_fqdn,
    'IP Address': vipDetails.vip_ip,
    'Port': vipDetails.port,
    'Protocol': vipDetails.protocol,
    'Environment': vipDetails.environment,
    'Datacenter': vipDetails.datacenter,
    'Application ID': vipDetails.app_id,
    'Owner': vipDetails.owner
  };

  // Prepare metadata for target VIP (if not production)
  const targetVipMetadata = !isProduction ? {
    'Target Environment': targetEnvironment || 'Not selected',
    'Target Datacenter': targetDatacenter || 'Not selected',
    'New FQDN': targetEnvironment && vipDetails.vip_fqdn.replace(
      `.${vipDetails.environment.toLowerCase()}.`, 
      `.${targetEnvironment.toLowerCase()}.`
    )
  } : {};

  return (
    <Page themeId="tool">
      <Header 
        title="Environment Promotion" 
        subtitle={`Promote VIP: ${vipDetails.vip_fqdn}`}>
        <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP Details
        </Button>
      </Header>
      <Content>
        <ContentHeader title="Promote VIP to New Environment">
          <SupportButton>Promote this VIP configuration to another environment.</SupportButton>
        </ContentHeader>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <InfoCard title="Source VIP Configuration">
              <StructuredMetadataTable metadata={sourceVipMetadata} />
            </InfoCard>
          </Grid>
          
          {!isProduction ? (
            <Grid item xs={12} md={6}>
              <Paper style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>Target Environment</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <FormControl fullWidth required>
                      <InputLabel id="environment-label">Environment</InputLabel>
                      <Select
                        labelId="environment-label"
                        value={targetEnvironment}
                        onChange={handleEnvironmentChange}
                        disabled={isProduction}
                      >
                        {environmentOptions
                          .filter(env => env.value !== vipDetails.environment) // Filter out current environment
                          .map(env => (
                            <MenuItem key={env.value} value={env.value}>{env.label}</MenuItem>
                          ))
                        }
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControl fullWidth required disabled={!targetEnvironment}>
                      <InputLabel id="datacenter-label">Datacenter</InputLabel>
                      <Select
                        labelId="datacenter-label"
                        value={targetDatacenter}
                        onChange={handleDatacenterChange}
                        disabled={!targetEnvironment || isProduction}
                      >
                        {availableDatacenters.map(dc => (
                          <MenuItem key={dc.value} value={dc.value}>{dc.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      required
                      label="ServiceNow Incident ID"
                      fullWidth
                      value={incidentId}
                      onChange={(e) => setIncidentId(e.target.value)}
                      disabled={isProduction}
                      helperText="Required for change tracking"
                    />
                  </Grid>
                </Grid>
                
                {targetEnvironment && targetDatacenter && (
                  <>
                    <Divider style={{ margin: '20px 0' }} />
                    <Typography variant="subtitle1" gutterBottom>New VIP Details</Typography>
                    <StructuredMetadataTable metadata={targetVipMetadata} />
                  </>
                )}
                
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<ArrowForward />}
                  style={{ marginTop: '20px' }}
                  disabled={!targetEnvironment || !targetDatacenter || !incidentId || isProduction || isPromoting}
                  onClick={handlePromote}
                >
                  {isPromoting ? <CircularProgress size={24} /> : 'Promote VIP'}
                </Button>
              </Paper>
            </Grid>
          ) : (
            <Grid item xs={12} md={6}>
              <Paper style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>Target Environment</Typography>
                <Typography variant="body1" color="error">
                  This VIP is already in Production environment and cannot be promoted further.
                </Typography>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Content>
    </Page>
  );
};
