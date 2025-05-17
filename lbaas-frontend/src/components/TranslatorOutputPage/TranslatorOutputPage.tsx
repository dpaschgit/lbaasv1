import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Tabs, Tab, Box } from '@material-ui/core';
import { Link as RouterLink, useParams, useLocation } from 'react-router-dom';
import { ArrowBack, Refresh } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  CodeSnippet
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

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

function a11yProps(index: number) {
  return {
    id: `translator-tab-${index}`,
    'aria-controls': `translator-tabpanel-${index}`,
  };
}

// Mock interfaces for MongoDB configuration and translator output
interface MongoDBConfig {
  id: string;
  vip_id: string;
  vip_fqdn: string;
  environment: string;
  datacenter: string;
  lb_type: string;
  config: any;
  created_at: string;
  updated_at: string;
}

interface TranslatorOutput {
  f5_output: string;
  nginx_output: string;
  avi_output: string;
}

export const TranslatorOutputPage = () => {
  // Use vipId parameter consistently across all components
  const { vipId } = useParams<{ vipId: string }>();
  const location = useLocation();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const [tabValue, setTabValue] = useState(0);
  const [mongoDBConfig, setMongoDBConfig] = useState<MongoDBConfig | null>(null);
  const [translatorOutput, setTranslatorOutput] = useState<TranslatorOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  const fetchData = async () => {
    if (!vipId) {
      setError(new Error('VIP ID not found in URL.'));
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // In a real implementation, these would be actual API calls to your backend
      // For now, we'll use mock data to demonstrate the UI
      
      // Mock MongoDB configuration
      const configData: MongoDBConfig = {
        id: "config_" + vipId,
        vip_id: vipId,
        vip_fqdn: "app1.prod.ladc.davelab.net",
        environment: "PROD",
        datacenter: "LADC",
        lb_type: "F5",
        config: {
          virtual_server: {
            name: "vs_app1_prod_443",
            ip_address: "10.1.1.101",
            port: 443,
            protocol: "HTTPS"
          },
          pool: {
            name: "pool_app1_prod",
            lb_method: "ROUND_ROBIN",
            members: [
              { ip: "192.168.10.1", port: 8443, enabled: true },
              { ip: "192.168.10.2", port: 8443, enabled: true }
            ]
          },
          monitor: {
            type: "HTTPS",
            interval: 10,
            timeout: 3,
            send_string: "GET /health",
            receive_string: "200 OK"
          },
          persistence: {
            type: "SOURCE_IP",
            timeout: 1800
          },
          ssl_profile: {
            cert_name: "cert_app1_prod",
            key_name: "key_app1_prod"
          }
        },
        created_at: "2023-03-15T10:00:00Z",
        updated_at: "2023-03-16T11:30:00Z"
      };
      
      setMongoDBConfig(configData);
      
      // Mock translator output files
      const outputData: TranslatorOutput = {
        f5_output: `{
  "class": "Application",
  "template": "https",
  "serviceMain": {
    "class": "Service_HTTPS",
    "virtualAddresses": ["10.1.1.101"],
    "virtualPort": 443,
    "pool": "pool_app1_prod",
    "serverTLS": "tls_server",
    "persistenceMethods": ["source-address"],
    "profileHTTP": { "use": "basic" }
  },
  "pool_app1_prod": {
    "class": "Pool",
    "monitors": [
      "https_monitor"
    ],
    "members": [
      {
        "servicePort": 8443,
        "serverAddresses": [
          "192.168.10.1",
          "192.168.10.2"
        ]
      }
    ]
  },
  "https_monitor": {
    "class": "Monitor",
    "monitorType": "https",
    "send": "GET /health\\r\\n",
    "receive": "200 OK"
  },
  "tls_server": {
    "class": "TLS_Server",
    "certificates": [
      {
        "certificate": "cert_app1_prod"
      }
    ]
  },
  "cert_app1_prod": {
    "class": "Certificate",
    "certificate": "-----BEGIN CERTIFICATE-----\\nMIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiIMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\\n-----END CERTIFICATE-----",
    "privateKey": "-----BEGIN PRIVATE KEY-----\\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDFkPCXNJAILgFs\\n-----END PRIVATE KEY-----"
  }
}`,
        nginx_output: `server {
    listen 443 ssl;
    server_name app1.prod.ladc.davelab.net;
    
    ssl_certificate /etc/nginx/certs/app1_prod.crt;
    ssl_certificate_key /etc/nginx/certs/app1_prod.key;
    
    location / {
        proxy_pass https://pool_app1_prod;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Source IP persistence
        proxy_cookie_path / "/; HttpOnly; SameSite=strict";
    }
}

upstream pool_app1_prod {
    ip_hash;  # Source IP persistence
    server 192.168.10.1:8443;
    server 192.168.10.2:8443;
    
    # Health check
    health_check uri=/health interval=10s match=status_ok;
}

match status_ok {
    status 200;
}`,
        avi_output: `{
  "virtualservice": {
    "name": "vs_app1_prod_443",
    "ip_address": "10.1.1.101",
    "services": [
      {
        "port": 443,
        "enable_ssl": true
      }
    ],
    "pool_ref": "/api/pool/pool_app1_prod",
    "ssl_key_and_certificate_refs": [
      "/api/sslkeyandcertificate/cert_app1_prod"
    ],
    "application_profile_ref": "/api/applicationprofile/system-https",
    "network_profile_ref": "/api/networkprofile/system-tcp-proxy"
  },
  "pool": {
    "name": "pool_app1_prod",
    "servers": [
      {
        "ip": {
          "addr": "192.168.10.1",
          "type": "V4"
        },
        "port": 8443,
        "enabled": true
      },
      {
        "ip": {
          "addr": "192.168.10.2",
          "type": "V4"
        },
        "port": 8443,
        "enabled": true
      }
    ],
    "health_monitor_refs": [
      "/api/healthmonitor/https_monitor"
    ],
    "lb_algorithm": "LB_ALGORITHM_ROUND_ROBIN"
  },
  "healthmonitor": {
    "name": "https_monitor",
    "type": "HEALTH_MONITOR_HTTPS",
    "https_monitor": {
      "http_request": "GET /health",
      "http_response_code": [
        "HTTP_2XX"
      ]
    },
    "monitor_port": 8443,
    "receive_timeout": 3,
    "interval": 10
  }
}`
      };
      
      setTranslatorOutput(outputData);
      
    } catch (e: any) {
      setError(e);
      alertApi.post({ message: `Error fetching configuration data: ${e.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [vipId, alertApi, identityApi, lbaasApi]);

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Loading Configuration Output" />
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

  if (!mongoDBConfig || !translatorOutput) {
    return (
      <Page themeId="tool">
        <Header title="Configuration Not Found" />
        <Content>
          <Typography>The requested configuration could not be found.</Typography>
          <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined" style={{ marginTop: '20px' }}>
            Back to VIP Details
          </Button>
        </Content>
      </Page>
    );
  }

  const lbType = mongoDBConfig.lb_type || 'Unknown';
  const outputKey = lbType.toLowerCase() + '_output' as keyof TranslatorOutput;
  const currentOutput = translatorOutput[outputKey] || 'No output available for this load balancer type.';

  return (
    <Page themeId="tool">
      <Header 
        title={`Configuration Output: ${mongoDBConfig.vip_fqdn}`}
        subtitle={`Environment: ${mongoDBConfig.environment}, Datacenter: ${mongoDBConfig.datacenter}`}>
        <Button component={RouterLink} to={`/lbaas-frontend/${vipId}/view`} variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP Details
        </Button>
        <Button 
          variant="outlined" 
          color="primary" 
          startIcon={<Refresh />} 
          onClick={handleRefresh}
          style={{ marginLeft: '10px' }}
        >
          Refresh
        </Button>
      </Header>
      <Content>
        <ContentHeader title={`Load Balancer Type: ${lbType}`}>
          <SupportButton>View the standardized configuration and translator output files.</SupportButton>
        </ContentHeader>
        
        <Paper>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="MongoDB Configuration" {...a11yProps(0)} />
            <Tab label="Translator Output Files" {...a11yProps(1)} />
          </Tabs>
          
          <TabPanel value={tabValue} index={0}>
            <InfoCard title="Standardized Configuration (MongoDB)">
              <CodeSnippet
                text={JSON.stringify(mongoDBConfig, null, 2)}
                language="json"
                showLineNumbers
              />
            </InfoCard>
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <InfoCard title={`${lbType} Configuration Output`}>
              <CodeSnippet
                text={currentOutput}
                language={lbType === 'NGINX' ? 'nginx' : 'json'}
                showLineNumbers
              />
            </InfoCard>
          </TabPanel>
        </Paper>
      </Content>
    </Page>
  );
};
