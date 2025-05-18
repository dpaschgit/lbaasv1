import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Divider, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tab, Tabs, Box } from '@material-ui/core';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import { ArrowBack, LockOpen, Refresh, Code } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  ErrorPanel,
  CodeSnippet
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

// Interface for translator output data
interface TranslatorOutput {
  id: string;
  vip_id: string;
  standard_config: any;
  environment: string;
  datacenter: string;
  lb_type: string;
  created_at?: string;
  last_updated?: string;
  created_by?: string;
  updated_by?: string;
}

// Interface for tab panel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: any;
  value: any;
}

// Tab Panel component
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`translator-tabpanel-${index}`}
      aria-labelledby={`translator-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={3}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Helper function for tab accessibility
function a11yProps(index: any) {
  return {
    id: `translator-tab-${index}`,
    'aria-controls': `translator-tabpanel-${index}`,
  };
}

export const TranslatorOutputPage = () => {
  // Use vipId parameter consistently across all components
  const { vipId } = useParams<{ vipId: string }>();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  const [translatorOutput, setTranslatorOutput] = useState<TranslatorOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Handle tab change
  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

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
      fetchTranslatorOutput();
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Login failed. Please try again.');
    }
  };

  const fetchTranslatorOutput = async () => {
    if (!vipId) {
      setError(new Error('VIP ID not found in URL.'));
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if we have cached data in sessionStorage
      const cachedData = sessionStorage.getItem(`translator_output_${vipId}`);
      if (cachedData) {
        try {
          const parsedData = JSON.parse(cachedData);
          setTranslatorOutput(parsedData);
          setUsingCachedData(true);
          console.log('Using cached translator output from sessionStorage');
          // Continue fetching fresh data in the background
        } catch (parseError) {
          console.error('Error parsing cached translator output data:', parseError);
          // Continue with API fetch if parsing fails
        }
      }
      
      // Check if authenticated
      if (!lbaasApi.isAuthenticated()) {
        console.log('Not authenticated, using cached data if available');
        if (!cachedData) {
          setError(new Error('Authentication required to fetch translator output.'));
        }
        setLoading(false);
        return;
      }
      
      try {
        // Use the API client to fetch translator output
        // Note: This is a mock implementation as the actual API endpoint is not yet available
        // In a real implementation, this would call lbaasApi.getTranslatorOutput(vipId)
        
        // Simulate API call with a timeout
        setTimeout(async () => {
          try {
            // First try to get the VIP details to ensure it exists
            const vipDetails = await lbaasApi.getVip(vipId);
            
            if (!vipDetails) {
              throw new Error(`VIP with ID ${vipId} not found.`);
            }
            
            // Mock translator output data based on VIP details
            // In a real implementation, this would come from the backend API
            const mockOutput: TranslatorOutput = {
              id: `config-${vipId}`,
              vip_id: vipId,
              standard_config: {
                metadata: {
                  environment: vipDetails.environment,
                  datacenter: vipDetails.datacenter || 'LADC',
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
                    name: member.server_name || `server-${member.server_ip}`,
                    ip_address: member.server_ip,
                    port: member.server_port,
                    weight: member.weight || 1,
                    enabled: true,
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
              environment: vipDetails.environment,
              datacenter: vipDetails.datacenter || 'LADC',
              lb_type: 'NGINX', // Mock value
              created_at: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              created_by: 'system',
              updated_by: 'system',
            };
            
            setTranslatorOutput(mockOutput);
            setUsingCachedData(false);
            
            // Cache the data in sessionStorage for future use
            try {
              sessionStorage.setItem(`translator_output_${vipId}`, JSON.stringify(mockOutput));
            } catch (storageError) {
              console.error('Error caching translator output data:', storageError);
              // Non-critical error, continue without caching
            }
          } catch (apiError: any) {
            console.error('API call failed:', apiError);
            
            // If we don't have cached data, show the error
            if (!cachedData) {
              setError(apiError);
              alertApi.post({ message: `Error fetching translator output: ${apiError.message}`, severity: 'error' });
            }
            // Otherwise, we'll continue using the cached data
          } finally {
            setLoading(false);
          }
        }, 1000); // Simulate network delay
        
      } catch (apiError: any) {
        console.error('API call failed:', apiError);
        
        // If we don't have cached data, show the error
        if (!cachedData) {
          setError(apiError);
          alertApi.post({ message: `Error fetching translator output: ${apiError.message}`, severity: 'error' });
        }
        // Otherwise, we'll continue using the cached data
        setLoading(false);
      }
    } catch (e: any) {
      setError(e);
      alertApi.post({ message: `Error fetching translator output: ${e.message}`, severity: 'error' });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranslatorOutput();
  }, [vipId, alertApi, identityApi, lbaasApi]);

  if (loading && !translatorOutput) {
    return (
      <Page themeId="tool">
        <Header title="Loading Translator Output" />
        <Content>
          <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '400px' }}>
            <CircularProgress />
          </Grid>
        </Content>
      </Page>
    );
  }

  if (error && !translatorOutput) {
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

  if (!translatorOutput) {
    return (
      <Page themeId="tool">
        <Header title="Translator Output Not Found" />
        <Content>
          <Typography>The requested translator output could not be found.</Typography>
          <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined" style={{ marginTop: '20px' }}>
            Back to VIP Details
          </Button>
        </Content>
      </Page>
    );
  }

  // Format the standard config as JSON string for display
  const standardConfigJson = JSON.stringify(translatorOutput.standard_config, null, 2);
  
  // Generate vendor-specific configuration (mock implementation)
  const generateVendorConfig = (lbType: string, standardConfig: any): string => {
    // In a real implementation, this would use the translator module to generate vendor-specific config
    // For now, we'll just return a formatted version of the standard config with some vendor-specific comments
    
    if (lbType === 'NGINX') {
      return `# NGINX Configuration for ${standardConfig.virtual_server?.name}
server {
    listen ${standardConfig.virtual_server?.port};
    server_name ${standardConfig.virtual_server?.name};
    
    location / {
        proxy_pass http://${standardConfig.pool?.name};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        ${standardConfig.persistence ? `# Persistence enabled: ${standardConfig.persistence.type}` : ''}
    }
}

upstream ${standardConfig.pool?.name} {
    ${standardConfig.pool?.lb_method === 'round_robin' ? 'least_conn;' : '# Using default round robin'}
    ${standardConfig.pool?.members?.map((member: any) => 
      `    server ${member.ip_address}:${member.port} weight=${member.weight};`
    ).join('\n')}
}

${standardConfig.health_monitor ? `# Health monitor configuration:
# Type: ${standardConfig.health_monitor.type}
# Interval: ${standardConfig.health_monitor.interval}s
# Timeout: ${standardConfig.health_monitor.timeout}s` : ''}`;
    } else if (lbType === 'F5') {
      return `# F5 Configuration for ${standardConfig.virtual_server?.name}
ltm virtual ${standardConfig.virtual_server?.name} {
    destination ${standardConfig.virtual_server?.ip_address}:${standardConfig.virtual_server?.port}
    ip-protocol tcp
    mask 255.255.255.255
    pool ${standardConfig.pool?.name}
    profiles {
        http { }
        tcp { }
    }
    ${standardConfig.persistence ? `persist {
        ${standardConfig.persistence.type} {
            default yes
            timeout ${standardConfig.persistence.timeout}
        }
    }` : ''}
    source-address-translation {
        type automap
    }
}

ltm pool ${standardConfig.pool?.name} {
    members {
        ${standardConfig.pool?.members?.map((member: any) => 
          `${member.ip_address}:${member.port} {
            address ${member.ip_address}
            session ${member.enabled ? 'user-enabled' : 'user-disabled'}
            ratio ${member.weight}
        }`
        ).join('\n        ')}
    }
    monitor ${standardConfig.health_monitor?.type || 'http'}
    ${standardConfig.pool?.lb_method === 'round_robin' ? 'load-balancing-mode round-robin' : ''}
}

${standardConfig.health_monitor ? `ltm monitor ${standardConfig.health_monitor.type} ${standardConfig.virtual_server?.name}_monitor {
    interval ${standardConfig.health_monitor.interval}
    timeout ${standardConfig.health_monitor.timeout}
    send "${standardConfig.health_monitor.send_string}"
    recv "${standardConfig.health_monitor.receive_string}"
}` : ''}`;
    } else if (lbType === 'AVI') {
      return `# AVI Configuration for ${standardConfig.virtual_server?.name}
{
  "virtualservice": {
    "name": "${standardConfig.virtual_server?.name}",
    "ip_address": "${standardConfig.virtual_server?.ip_address}",
    "services": [
      {
        "port": ${standardConfig.virtual_server?.port},
        "protocol": "${standardConfig.virtual_server?.protocol}"
      }
    ],
    "pool_ref": "${standardConfig.pool?.name}",
    ${standardConfig.persistence ? `"persistence_profile": {
      "type": "${standardConfig.persistence.type.toUpperCase()}",
      "timeout": ${standardConfig.persistence.timeout}
    },` : ''}
    "analytics_profile": {
      "name": "System-Analytics-Profile"
    }
  },
  "pool": {
    "name": "${standardConfig.pool?.name}",
    "lb_algorithm": "${standardConfig.pool?.lb_method.toUpperCase().replace('-', '_')}",
    "servers": [
      ${standardConfig.pool?.members?.map((member: any) => 
        `{
        "ip": "${member.ip_address}",
        "port": ${member.port},
        "ratio": ${member.weight},
        "enabled": ${member.enabled}
      }`
      ).join(',\n      ')}
    ],
    ${standardConfig.health_monitor ? `"health_monitor_refs": [
      "${standardConfig.virtual_server?.name}_monitor"
    ]` : ''}
  }${standardConfig.health_monitor ? `,
  "healthmonitor": {
    "name": "${standardConfig.virtual_server?.name}_monitor",
    "type": "${standardConfig.health_monitor.type.toUpperCase()}",
    "interval": ${standardConfig.health_monitor.interval},
    "timeout": ${standardConfig.health_monitor.timeout},
    "send": "${standardConfig.health_monitor.send_string.replace(/\r\n/g, '\\r\\n')}",
    "receive": "${standardConfig.health_monitor.receive_string}"
  }` : ''}
}`;
    } else {
      return `# Configuration for ${standardConfig.virtual_server?.name} (${lbType})
# This is a placeholder for ${lbType} configuration
# The actual implementation would use the translator module to generate vendor-specific config

${JSON.stringify(standardConfig, null, 2)}`;
    }
  };

  // Generate vendor-specific configurations
  const nginxConfig = generateVendorConfig('NGINX', translatorOutput.standard_config);
  const f5Config = generateVendorConfig('F5', translatorOutput.standard_config);
  const aviConfig = generateVendorConfig('AVI', translatorOutput.standard_config);

  return (
    <Page themeId="tool">
      <Header 
        title={`Translator Output: ${translatorOutput.standard_config.virtual_server?.name || 'Unknown VIP'}`}
        subtitle={`Environment: ${translatorOutput.environment}, Datacenter: ${translatorOutput.datacenter}`}>
        <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP Details
        </Button>
        <Button 
          variant="outlined" 
          color="primary" 
          startIcon={<Refresh />}
          onClick={fetchTranslatorOutput}
          style={{ marginLeft: '10px' }}
        >
          Refresh
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
        <ContentHeader title="Load Balancer Configuration">
          <SupportButton>View the vendor-agnostic and vendor-specific configurations for this VIP.</SupportButton>
        </ContentHeader>
        
        {/* Authentication Warning */}
        {!lbaasApi.isAuthenticated() && (
          <InfoCard title="Authentication Required" severity="warning" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              You are viewing cached data. Please log in to fetch the latest translator output.
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
        
        {/* Cached Data Warning */}
        {usingCachedData && lbaasApi.isAuthenticated() && (
          <InfoCard title="Using Cached Data" severity="info" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              Showing cached translator output. The latest data could not be fetched from the server.
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={fetchTranslatorOutput}
              style={{ marginTop: '10px' }}
            >
              Retry
            </Button>
          </InfoCard>
        )}
        
        {/* Error Warning */}
        {error && translatorOutput && (
          <InfoCard title="Warning" severity="error" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              Error fetching latest data: {error.message}
            </Typography>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={fetchTranslatorOutput}
              style={{ marginTop: '10px' }}
            >
              Retry
            </Button>
          </InfoCard>
        )}
        
        <Paper style={{ padding: '20px' }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>VIP ID:</strong> {translatorOutput.vip_id}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>Load Balancer Type:</strong> {translatorOutput.lb_type}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>Environment:</strong> {translatorOutput.environment}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle1"><strong>Datacenter:</strong> {translatorOutput.datacenter}</Typography>
            </Grid>
            {translatorOutput.created_at && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Created At:</strong> {new Date(translatorOutput.created_at).toLocaleString()}</Typography>
              </Grid>
            )}
            {translatorOutput.last_updated && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Last Updated:</strong> {new Date(translatorOutput.last_updated).toLocaleString()}</Typography>
              </Grid>
            )}
            {translatorOutput.created_by && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Created By:</strong> {translatorOutput.created_by}</Typography>
              </Grid>
            )}
            {translatorOutput.updated_by && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle1"><strong>Updated By:</strong> {translatorOutput.updated_by}</Typography>
              </Grid>
            )}
          </Grid>
          
          <Divider style={{ margin: '20px 0' }} />
          
          <Typography variant="h6" style={{ marginBottom: '16px' }}>Configuration Output</Typography>
          
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            aria-label="translator output tabs"
          >
            <Tab label="Standard Config" icon={<Code />} {...a11yProps(0)} />
            <Tab label="NGINX" icon={<Code />} {...a11yProps(1)} />
            <Tab label="F5" icon={<Code />} {...a11yProps(2)} />
            <Tab label="AVI" icon={<Code />} {...a11yProps(3)} />
          </Tabs>
          
          <TabPanel value={tabValue} index={0}>
            <Typography variant="subtitle1" style={{ marginBottom: '8px' }}>Vendor-Agnostic Configuration</Typography>
            <CodeSnippet
              text={standardConfigJson}
              language="json"
              showLineNumbers
              highlightedNumbers={[]}
              customStyle={{ maxHeight: '500px', overflow: 'auto' }}
            />
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <Typography variant="subtitle1" style={{ marginBottom: '8px' }}>NGINX Configuration</Typography>
            <CodeSnippet
              text={nginxConfig}
              language="nginx"
              showLineNumbers
              highlightedNumbers={[]}
              customStyle={{ maxHeight: '500px', overflow: 'auto' }}
            />
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            <Typography variant="subtitle1" style={{ marginBottom: '8px' }}>F5 Configuration</Typography>
            <CodeSnippet
              text={f5Config}
              language="bash"
              showLineNumbers
              highlightedNumbers={[]}
              customStyle={{ maxHeight: '500px', overflow: 'auto' }}
            />
          </TabPanel>
          
          <TabPanel value={tabValue} index={3}>
            <Typography variant="subtitle1" style={{ marginBottom: '8px' }}>AVI Configuration</Typography>
            <CodeSnippet
              text={aviConfig}
              language="json"
              showLineNumbers
              highlightedNumbers={[]}
              customStyle={{ maxHeight: '500px', overflow: 'auto' }}
            />
          </TabPanel>
        </Paper>
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
