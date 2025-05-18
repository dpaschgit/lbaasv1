import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, TextField, MenuItem, FormControl, InputLabel, Select, FormHelperText, Dialog, DialogTitle, DialogContent, DialogActions, Stepper, Step, StepLabel, StepContent, Checkbox, FormControlLabel } from '@material-ui/core';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import { ArrowBack, LockOpen, Send, Check, Warning } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  ErrorPanel,
  StructuredMetadataTable
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

// Interface for promotion plan
interface PromotionPlan {
  source_config: any;
  promoted_config: any;
  target_environment: string;
  target_datacenter: string;
  target_lb_type: string;
  fields_requiring_update: string[];
}

export const EnvironmentPromotionPage = () => {
  // Use vipId parameter consistently across all components
  const { vipId } = useParams<{ vipId: string }>();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  
  // State for VIP details and promotion
  const [vipDetails, setVipDetails] = useState<VipDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [promotionPlan, setPromotionPlan] = useState<PromotionPlan | null>(null);
  const [promotionExecuting, setPromotionExecuting] = useState(false);
  const [promotionSuccess, setPromotionSuccess] = useState(false);
  const [newVipId, setNewVipId] = useState<string | null>(null);
  
  // State for form fields
  const [targetEnvironment, setTargetEnvironment] = useState('');
  const [targetDatacenter, setTargetDatacenter] = useState('');
  const [targetLbType, setTargetLbType] = useState('');
  const [newVipIp, setNewVipIp] = useState('');
  const [certificateData, setCertificateData] = useState('');
  const [confirmPromotion, setConfirmPromotion] = useState(false);
  
  // State for available options
  const [environments, setEnvironments] = useState<string[]>([]);
  const [datacenters, setDatacenters] = useState<string[]>([]);
  const [lbTypes, setLbTypes] = useState<string[]>(['NGINX', 'F5', 'AVI']);
  
  // State for form validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // State for stepper
  const [activeStep, setActiveStep] = useState(0);
  
  // State for login dialog
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Handle login dialog
  const handleLoginDialogOpen = () => {
    setIsLoginDialogOpen(true);
    setLoginError(null);
  };

  const handleLoginDialogClose = () => {
    setIsLoginDialogOpen(false);
    setLoginError(null);
  };

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await lbaasApi.login(username, password);
      handleLoginDialogClose();
      // Reload data after successful login
      fetchVipDetails();
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Login failed. Please try again.');
    }
  };

  // Fetch VIP details
  const fetchVipDetails = async () => {
    if (!vipId) {
      setError(new Error('VIP ID not found in URL.'));
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if authenticated
      if (!lbaasApi.isAuthenticated()) {
        setError(new Error('Authentication required to promote VIP configurations.'));
        setLoading(false);
        return;
      }
      
      try {
        // Use the API client to fetch VIP details
        const data = await lbaasApi.getVip(vipId);
        
        if (data) {
          setVipDetails(data);
          
          // Fetch available environments
          fetchEnvironments();
        } else {
          setError(new Error(`VIP with ID ${vipId} not found.`));
          alertApi.post({ message: `VIP with ID ${vipId} not found.`, severity: 'error' });
        }
      } catch (apiError: any) {
        console.error('API call failed:', apiError);
        setError(apiError);
        alertApi.post({ message: `Error fetching VIP details: ${apiError.message}`, severity: 'error' });
      }
    } catch (e: any) {
      setError(e);
      alertApi.post({ message: `Error fetching VIP details: ${e.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch available environments
  const fetchEnvironments = async () => {
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll use mock data
      setEnvironments(['DEV', 'UAT', 'PROD']);
    } catch (error: any) {
      console.error('Error fetching environments:', error);
      alertApi.post({ message: `Error fetching environments: ${error.message}`, severity: 'warning' });
      // Fallback to default environments
      setEnvironments(['DEV', 'UAT', 'PROD']);
    }
  };

  // Fetch datacenters for selected environment
  const fetchDatacenters = async (environment: string) => {
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll use mock data
      setDatacenters(['LADC', 'NYDC', 'UKDC']);
    } catch (error: any) {
      console.error('Error fetching datacenters:', error);
      alertApi.post({ message: `Error fetching datacenters: ${error.message}`, severity: 'warning' });
      // Fallback to default datacenters
      setDatacenters(['LADC', 'NYDC', 'UKDC']);
    }
  };

  // Prepare promotion plan
  const preparePromotionPlan = async () => {
    if (!vipId || !targetEnvironment || !targetDatacenter || !targetLbType) {
      setFormErrors({
        ...formErrors,
        targetEnvironment: !targetEnvironment ? 'Target environment is required' : '',
        targetDatacenter: !targetDatacenter ? 'Target datacenter is required' : '',
        targetLbType: !targetLbType ? 'Target load balancer type is required' : '',
      });
      return;
    }
    
    setFormErrors({});
    setLoading(true);
    
    try {
      // In a real implementation, this would call an API endpoint
      // For now, we'll use mock data based on the current VIP details
      
      if (!vipDetails) {
        throw new Error('VIP details not available');
      }
      
      // Create a mock promotion plan
      const mockPromotionPlan: PromotionPlan = {
        source_config: {
          vip_id: vipId,
          environment: vipDetails.environment,
          datacenter: vipDetails.datacenter,
          standard_config: {
            metadata: {
              environment: vipDetails.environment,
              datacenter: vipDetails.datacenter,
              lb_type: 'NGINX', // Mock value
            },
            virtual_server: {
              name: vipDetails.vip_fqdn,
              ip_address: vipDetails.vip_ip,
              port: vipDetails.port,
              protocol: vipDetails.protocol,
            },
            pool: {
              name: `pool-${vipDetails.vip_fqdn}`,
              lb_method: 'round_robin',
              members: vipDetails.pool_members?.map(member => ({
                name: `server-${member.ip}`,
                ip_address: member.ip,
                port: member.port,
                weight: 1,
                enabled: member.enabled,
              })) || [],
            },
            health_monitor: vipDetails.monitor ? {
              type: vipDetails.monitor.type || 'http',
              interval: vipDetails.monitor.interval || 5,
              timeout: vipDetails.monitor.timeout || 16,
              send_string: vipDetails.monitor.send_string || 'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n',
              receive_string: vipDetails.monitor.receive_string || '200 OK',
            } : undefined,
            persistence: vipDetails.persistence ? {
              type: vipDetails.persistence.type || 'cookie',
              timeout: vipDetails.persistence.timeout || 3600,
            } : undefined,
          }
        },
        promoted_config: {
          metadata: {
            environment: targetEnvironment,
            datacenter: targetDatacenter,
            lb_type: targetLbType,
          },
          virtual_server: {
            name: vipDetails.vip_fqdn,
            ip_address: '', // This needs to be provided by the user
            port: vipDetails.port,
            protocol: vipDetails.protocol,
          },
          pool: {
            name: `pool-${vipDetails.vip_fqdn}`,
            lb_method: 'round_robin',
            members: vipDetails.pool_members?.map(member => ({
              name: `server-${member.ip}`,
              ip_address: member.ip,
              port: member.port,
              weight: 1,
              enabled: member.enabled,
            })) || [],
          },
          health_monitor: vipDetails.monitor ? {
            type: vipDetails.monitor.type || 'http',
            interval: vipDetails.monitor.interval || 5,
            timeout: vipDetails.monitor.timeout || 16,
            send_string: vipDetails.monitor.send_string || 'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n',
            receive_string: vipDetails.monitor.receive_string || '200 OK',
          } : undefined,
          persistence: vipDetails.persistence ? {
            type: vipDetails.persistence.type || 'cookie',
            timeout: vipDetails.persistence.timeout || 3600,
          } : undefined,
        },
        target_environment: targetEnvironment,
        target_datacenter: targetDatacenter,
        target_lb_type: targetLbType,
        fields_requiring_update: [
          'virtual_server.ip_address',
          'certificates'
        ]
      };
      
      setPromotionPlan(mockPromotionPlan);
      setActiveStep(1); // Move to the next step
    } catch (error: any) {
      console.error('Error preparing promotion plan:', error);
      setError(error);
      alertApi.post({ message: `Error preparing promotion plan: ${error.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Execute promotion
  const executePromotion = async () => {
    if (!promotionPlan) {
      setError(new Error('Promotion plan not available'));
      return;
    }
    
    if (!newVipIp) {
      setFormErrors({
        ...formErrors,
        newVipIp: 'New VIP IP address is required',
      });
      return;
    }
    
    if (!confirmPromotion) {
      setFormErrors({
        ...formErrors,
        confirmPromotion: 'You must confirm the promotion',
      });
      return;
    }
    
    setFormErrors({});
    setPromotionExecuting(true);
    
    try {
      // Update the promoted config with user-provided values
      const updatedConfig = {
        ...promotionPlan.promoted_config,
        virtual_server: {
          ...promotionPlan.promoted_config.virtual_server,
          ip_address: newVipIp,
        },
        certificates: certificateData ? { data: certificateData } : undefined,
      };
      
      // In a real implementation, this would call an API endpoint
      // For now, we'll simulate a successful promotion
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a new VIP ID for the promoted configuration
      const env_prefix = targetEnvironment.toLowerCase();
      const new_vip_id = `${env_prefix}-${vipId}`;
      
      setNewVipId(new_vip_id);
      setPromotionSuccess(true);
      setActiveStep(2); // Move to the final step
      
      alertApi.post({ message: 'VIP configuration promoted successfully!', severity: 'success' });
    } catch (error: any) {
      console.error('Error executing promotion:', error);
      setError(error);
      alertApi.post({ message: `Error executing promotion: ${error.message}`, severity: 'error' });
    } finally {
      setPromotionExecuting(false);
    }
  };

  // Handle environment change
  const handleEnvironmentChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string;
    setTargetEnvironment(value);
    fetchDatacenters(value);
    setTargetDatacenter(''); // Reset datacenter when environment changes
  };

  // Reset the form
  const resetForm = () => {
    setTargetEnvironment('');
    setTargetDatacenter('');
    setTargetLbType('');
    setNewVipIp('');
    setCertificateData('');
    setConfirmPromotion(false);
    setPromotionPlan(null);
    setPromotionSuccess(false);
    setNewVipId(null);
    setActiveStep(0);
    setFormErrors({});
  };

  // Navigate to the new VIP
  const navigateToNewVip = () => {
    if (newVipId) {
      navigate(`/lbaas-frontend/${newVipId}/view`);
    }
  };

  // Initialize component
  useEffect(() => {
    fetchVipDetails();
  }, [vipId, alertApi, identityApi, lbaasApi]);

  if (loading && !vipDetails && !promotionPlan) {
    return (
      <Page themeId="tool">
        <Header title="Loading VIP Details" />
        <Content>
          <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '400px' }}>
            <CircularProgress />
          </Grid>
        </Content>
      </Page>
    );
  }

  if (error && !vipDetails && !promotionPlan) {
    return (
      <Page themeId="tool">
        <Header title="Error" />
        <Content>
          <ErrorPanel error={error} />
          <Grid container spacing={2} style={{ marginTop: '20px' }}>
            <Grid item>
              <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined">
                Back to VIP Details
              </Button>
            </Grid>
            {error.message.includes('Authentication') && (
              <Grid item>
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<LockOpen />}
                  onClick={handleLoginDialogOpen}
                >
                  Login
                </Button>
              </Grid>
            )}
          </Grid>
          
          {/* Login Dialog */}
          <Dialog open={isLoginDialogOpen} onClose={handleLoginDialogClose}>
            <DialogTitle>Login to LBaaS</DialogTitle>
            <DialogContent>
              {loginError && (
                <Typography color="error" style={{ marginBottom: '16px' }}>
                  {loginError}
                </Typography>
              )}
              <TextField
                autoFocus
                margin="dense"
                label="Username"
                type="text"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                margin="dense"
                label="Password"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleLoginDialogClose} color="primary">
                Cancel
              </Button>
              <Button onClick={handleLogin} color="primary" variant="contained">
                Login
              </Button>
            </DialogActions>
          </Dialog>
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
        title={`Environment Promotion: ${vipDetails.vip_fqdn}`}
        subtitle={`Current Environment: ${vipDetails.environment}, Datacenter: ${vipDetails.datacenter || 'Unknown'}`}>
        <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP Details
        </Button>
        {!lbaasApi.isAuthenticated() && (
          <Button 
            variant="outlined" 
            color="primary" 
            startIcon={<LockOpen />}
            onClick={handleLoginDialogOpen}
            style={{ marginLeft: '10px' }}
          >
            Login
          </Button>
        )}
      </Header>
      <Content>
        <ContentHeader title="Promote VIP Configuration">
          <SupportButton>Promote a VIP configuration to a new environment with environment-specific customizations.</SupportButton>
        </ContentHeader>
        
        {/* Authentication Warning */}
        {!lbaasApi.isAuthenticated() && (
          <InfoCard title="Authentication Required" severity="warning" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              Authentication is required to promote VIP configurations. Please log in to continue.
            </Typography>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<LockOpen />}
              onClick={handleLoginDialogOpen}
              style={{ marginTop: '10px' }}
            >
              Login
            </Button>
          </InfoCard>
        )}
        
        {/* Promotion Process Stepper */}
        <Paper style={{ padding: '20px', marginBottom: '20px' }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {/* Step 1: Select Target Environment */}
            <Step>
              <StepLabel>Select Target Environment</StepLabel>
              <StepContent>
                <Typography variant="body2" style={{ marginBottom: '16px' }}>
                  Select the target environment, datacenter, and load balancer type for promotion.
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth error={!!formErrors.targetEnvironment}>
                      <InputLabel id="target-environment-label">Target Environment</InputLabel>
                      <Select
                        labelId="target-environment-label"
                        id="target-environment"
                        value={targetEnvironment}
                        onChange={handleEnvironmentChange}
                        disabled={!lbaasApi.isAuthenticated()}
                      >
                        {environments.map((env) => (
                          <MenuItem key={env} value={env} disabled={env === vipDetails.environment}>
                            {env} {env === vipDetails.environment && '(Current)'}
                          </MenuItem>
                        ))}
                      </Select>
                      {formErrors.targetEnvironment && (
                        <FormHelperText>{formErrors.targetEnvironment}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth error={!!formErrors.targetDatacenter}>
                      <InputLabel id="target-datacenter-label">Target Datacenter</InputLabel>
                      <Select
                        labelId="target-datacenter-label"
                        id="target-datacenter"
                        value={targetDatacenter}
                        onChange={(e) => setTargetDatacenter(e.target.value as string)}
                        disabled={!targetEnvironment || !lbaasApi.isAuthenticated()}
                      >
                        {datacenters.map((dc) => (
                          <MenuItem key={dc} value={dc}>
                            {dc}
                          </MenuItem>
                        ))}
                      </Select>
                      {formErrors.targetDatacenter && (
                        <FormHelperText>{formErrors.targetDatacenter}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth error={!!formErrors.targetLbType}>
                      <InputLabel id="target-lb-type-label">Target Load Balancer Type</InputLabel>
                      <Select
                        labelId="target-lb-type-label"
                        id="target-lb-type"
                        value={targetLbType}
                        onChange={(e) => setTargetLbType(e.target.value as string)}
                        disabled={!lbaasApi.isAuthenticated()}
                      >
                        {lbTypes.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                      {formErrors.targetLbType && (
                        <FormHelperText>{formErrors.targetLbType}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                </Grid>
                
                <div style={{ marginTop: '20px' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={preparePromotionPlan}
                    disabled={!targetEnvironment || !targetDatacenter || !targetLbType || !lbaasApi.isAuthenticated() || loading}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Prepare Promotion Plan'}
                  </Button>
                </div>
              </StepContent>
            </Step>
            
            {/* Step 2: Review and Customize */}
            <Step>
              <StepLabel>Review and Customize</StepLabel>
              <StepContent>
                {promotionPlan && (
                  <>
                    <Typography variant="body2" style={{ marginBottom: '16px' }}>
                      Review the promotion plan and provide required information for the new environment.
                    </Typography>
                    
                    <InfoCard title="Fields Requiring Update" severity="info" style={{ marginBottom: '20px' }}>
                      <Typography variant="body2">
                        The following fields need to be updated for the new environment:
                      </Typography>
                      <ul>
                        {promotionPlan.fields_requiring_update.map((field) => (
                          <li key={field}><Typography variant="body2">{field}</Typography></li>
                        ))}
                      </ul>
                    </InfoCard>
                    
                    <Paper style={{ padding: '16px', marginBottom: '20px' }}>
                      <Typography variant="subtitle1" style={{ marginBottom: '16px' }}>Source Configuration</Typography>
                      <StructuredMetadataTable
                        metadata={{
                          'VIP FQDN': vipDetails.vip_fqdn,
                          'Environment': promotionPlan.source_config.environment,
                          'Datacenter': promotionPlan.source_config.datacenter,
                          'IP Address': vipDetails.vip_ip,
                          'Port': vipDetails.port,
                          'Protocol': vipDetails.protocol,
                        }}
                      />
                    </Paper>
                    
                    <Paper style={{ padding: '16px', marginBottom: '20px' }}>
                      <Typography variant="subtitle1" style={{ marginBottom: '16px' }}>Target Configuration</Typography>
                      <StructuredMetadataTable
                        metadata={{
                          'VIP FQDN': vipDetails.vip_fqdn,
                          'Environment': promotionPlan.target_environment,
                          'Datacenter': promotionPlan.target_datacenter,
                          'Load Balancer Type': promotionPlan.target_lb_type,
                          'Port': vipDetails.port,
                          'Protocol': vipDetails.protocol,
                        }}
                      />
                    </Paper>
                    
                    <Typography variant="subtitle1" style={{ marginBottom: '16px' }}>Required Information</Typography>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="New VIP IP Address"
                          fullWidth
                          value={newVipIp}
                          onChange={(e) => setNewVipIp(e.target.value)}
                          error={!!formErrors.newVipIp}
                          helperText={formErrors.newVipIp || 'IP address for the VIP in the new environment'}
                          required
                        />
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Certificate Data (if applicable)"
                          fullWidth
                          value={certificateData}
                          onChange={(e) => setCertificateData(e.target.value)}
                          multiline
                          rows={4}
                          helperText="Certificate data for the new environment (if required)"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={confirmPromotion}
                              onChange={(e) => setConfirmPromotion(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="I confirm that I want to promote this VIP configuration to the new environment"
                        />
                        {formErrors.confirmPromotion && (
                          <Typography color="error" variant="caption">
                            {formErrors.confirmPromotion}
                          </Typography>
                        )}
                      </Grid>
                    </Grid>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={executePromotion}
                        disabled={!lbaasApi.isAuthenticated() || promotionExecuting}
                        style={{ marginRight: '10px' }}
                      >
                        {promotionExecuting ? <CircularProgress size={24} /> : 'Execute Promotion'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setActiveStep(0);
                          setPromotionPlan(null);
                        }}
                      >
                        Back
                      </Button>
                    </div>
                  </>
                )}
              </StepContent>
            </Step>
            
            {/* Step 3: Completion */}
            <Step>
              <StepLabel>Completion</StepLabel>
              <StepContent>
                {promotionSuccess && (
                  <>
                    <Typography variant="body1" style={{ marginBottom: '16px' }}>
                      <Check color="primary" style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                      VIP configuration has been successfully promoted to {targetEnvironment}!
                    </Typography>
                    
                    <Paper style={{ padding: '16px', marginBottom: '20px', backgroundColor: '#f5f5f5' }}>
                      <Typography variant="subtitle1" style={{ marginBottom: '8px' }}>New VIP Details</Typography>
                      <Typography variant="body2"><strong>VIP ID:</strong> {newVipId}</Typography>
                      <Typography variant="body2"><strong>Environment:</strong> {targetEnvironment}</Typography>
                      <Typography variant="body2"><strong>Datacenter:</strong> {targetDatacenter}</Typography>
                      <Typography variant="body2"><strong>Load Balancer Type:</strong> {targetLbType}</Typography>
                      <Typography variant="body2"><strong>IP Address:</strong> {newVipIp}</Typography>
                    </Paper>
                    
                    <div style={{ marginTop: '20px' }}>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={navigateToNewVip}
                        style={{ marginRight: '10px' }}
                      >
                        View New VIP
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={resetForm}
                      >
                        Promote Another VIP
                      </Button>
                    </div>
                  </>
                )}
              </StepContent>
            </Step>
          </Stepper>
        </Paper>
        
        {/* Warning about environment promotion */}
        <InfoCard title="Important Information" severity="warning">
          <Typography variant="body2" style={{ marginBottom: '8px' }}>
            <Warning style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Environment promotion creates a new VIP configuration in the target environment.
          </Typography>
          <Typography variant="body2">
            Certain data points like IP addresses, certificates, and environment-specific settings must be manually specified for the new environment.
          </Typography>
        </InfoCard>
      </Content>
      
      {/* Login Dialog */}
      <Dialog open={isLoginDialogOpen} onClose={handleLoginDialogClose}>
        <DialogTitle>Login to LBaaS</DialogTitle>
        <DialogContent>
          {loginError && (
            <Typography color="error" style={{ marginBottom: '16px' }}>
              {loginError}
            </Typography>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            type="text"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLoginDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleLogin} color="primary" variant="contained">
            Login
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};
