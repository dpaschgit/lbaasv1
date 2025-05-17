import React, { useEffect, useState } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, Tabs, Tab, Box } from '@material-ui/core';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ArrowBack, Refresh } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
} from '@backstage/core-components';
import { useApi, alertApiRef, identityApiRef } from '@backstage/core-plugin-api';
import { fetchTranslatorOutput, fetchLatestVipConfig } from '../../mongodb_query_helper';

interface TabPanelProps {
  children?: React.ReactNode;
  index: any;
  value: any;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
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

export const TranslatorOutputPage = () => {
  const { vipId } = useParams<{ vipId: string }>();
  const alertApi = useApi(alertApiRef);
  const identityApi = useApi(identityApiRef);
  const [loading, setLoading] = useState(true);
  const [outputFiles, setOutputFiles] = useState<any>(null);
  const [mongoConfig, setMongoConfig] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.ChangeEvent<{}>, newValue: number) => {
    setTabValue(newValue);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const token = await identityApi.getCredentials();
      if (!vipId) {
        throw new Error('VIP ID is required');
      }
      
      // Fetch both translator output and MongoDB config in parallel
      const [output, config] = await Promise.all([
        fetchTranslatorOutput(vipId, token?.token || ''),
        fetchLatestVipConfig(vipId, token?.token || '')
      ]);
      
      if (output) {
        setOutputFiles(output);
      }
      
      if (config) {
        setMongoConfig(config);
      }
      
      if (!output && !config) {
        throw new Error('Failed to fetch data');
      }
    } catch (e: any) {
      alertApi.post({ message: `Error loading data: ${e.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [vipId, alertApi, identityApi]);

  return (
    <Page themeId="tool">
      <Header title="Configuration Output" subtitle={`Configuration for VIP ID: ${vipId}`}>
        <Button component={RouterLink} to={`/lbaas-frontend/vips/${vipId}`} variant="outlined" startIcon={<ArrowBack />} style={{ marginRight: '8px' }}>
          Back to VIP Details
        </Button>
        <Button variant="outlined" startIcon={<Refresh />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </Header>
      <Content>
        <ContentHeader title="Generated Configurations">
          <SupportButton>View the standardized configuration in MongoDB and the translated output files.</SupportButton>
        </ContentHeader>
        
        {loading ? (
          <CircularProgress />
        ) : (!outputFiles && !mongoConfig) ? (
          <Typography variant="h6">No configuration data found for this VIP.</Typography>
        ) : (
          <>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              indicatorColor="primary"
              textColor="primary"
              variant="fullWidth"
              aria-label="configuration tabs"
            >
              <Tab label="MongoDB Configuration" />
              <Tab label="Translator Output Files" />
            </Tabs>
            
            <TabPanel value={tabValue} index={0}>
              {!mongoConfig ? (
                <Typography variant="h6">No MongoDB configuration found.</Typography>
              ) : (
                <InfoCard title="Standardized Configuration in MongoDB">
                  <Paper style={{ padding: '16px', maxHeight: '600px', overflow: 'auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(mongoConfig, null, 2)}
                    </pre>
                  </Paper>
                </InfoCard>
              )}
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              {!outputFiles ? (
                <Typography variant="h6">No translator output files found.</Typography>
              ) : (
                <Grid container spacing={3}>
                  {Object.entries(outputFiles).map(([fileName, content]) => (
                    <Grid item xs={12} key={fileName}>
                      <InfoCard title={fileName}>
                        <Paper style={{ padding: '16px', maxHeight: '400px', overflow: 'auto' }}>
                          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {content as string}
                          </pre>
                        </Paper>
                      </InfoCard>
                    </Grid>
                  ))}
                </Grid>
              )}
            </TabPanel>
          </>
        )}
      </Content>
    </Page>
  );
};
