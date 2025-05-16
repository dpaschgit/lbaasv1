import React, { useState, FormEvent } from 'react';
import { 
  Typography, 
  Grid, 
  Button, 
  TextField, 
  MenuItem, 
  Paper, 
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  FormHelperText
} from '@material-ui/core';
import { Add as AddIcon, Remove as RemoveIcon } from '@material-ui/icons';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  InfoCard,
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, VipCreate, Monitor, Persistence, PoolMember } from '../../api';

// Default values for new VIP
const defaultMonitor: Monitor = {
  type: 'http',
  port: 80,
  send: '/',
  receive: '200 OK'
};

const defaultPersistence: Persistence = {
  type: 'cookie',
  timeout: 3600
};

const defaultPoolMember: PoolMember = {
  ip: '',
  port: 80
};

const environments = ['dev', 'test', 'staging', 'prod'];
const datacenters = ['dc1', 'dc2', 'dc3'];
const protocols = ['http', 'https', 'tcp'];
const monitorTypes = ['http', 'https', 'tcp', 'icmp'];
const persistenceTypes = ['cookie', 'source_ip', 'none'];
const lbMethods = ['round_robin', 'least_connections', 'fastest_response_time'];

export const VipCreatePage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState<VipCreate>({
    vip_fqdn: '',
    vip_ip: '',
    app_id: '',
    environment: 'dev',
    datacenter: 'dc1',
    primary_contact_email: '',
    secondary_contact_email: '',
    team_distribution_email: '',
    monitor: { ...defaultMonitor },
    persistence: { ...defaultPersistence },
    ssl_cert_name: '',
    mtls_ca_cert_name: '',
    pool: [{ ...defaultPoolMember }],
    owner: '',
    port: 80,
    protocol: 'http',
    lb_method: 'round_robin'
  });
  
  // Form validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [incidentId, setIncidentId] = useState('');
  const [incidentIdError, setIncidentIdError] = useState('');
  
  // Handle form field changes
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field if it exists
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  // Handle nested object changes (monitor, persistence)
  const handleNestedChange = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent as keyof VipCreate],
        [field]: value
      }
    }));
    
    // Clear error for this field if it exists
    const errorKey = `${parent}.${field}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };
  
  // Handle pool member changes
  const handlePoolMemberChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newPool = [...prev.pool];
      newPool[index] = {
        ...newPool[index],
        [field]: value
      };
      return {
        ...prev,
        pool: newPool
      };
    });
    
    // Clear error for this field if it exists
    const errorKey = `pool[${index}].${field}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };
  
  // Add a new pool member
  const addPoolMember = () => {
    setFormData(prev => ({
      ...prev,
      pool: [...prev.pool, { ...defaultPoolMember }]
    }));
  };
  
  // Remove a pool member
  const removePoolMember = (index: number) => {
    if (formData.pool.length <= 1) {
      alertApi.post({
        message: 'At least one pool member is required',
        severity: 'warning'
      });
      return;
    }
    
    setFormData(prev => {
      const newPool = [...prev.pool];
      newPool.splice(index, 1);
      return {
        ...prev,
        pool: newPool
      };
    });
    
    // Clear any errors for this pool member
    setErrors(prev => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`pool[${index}]`)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  };
  
  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.vip_fqdn) newErrors['vip_fqdn'] = 'FQDN is required';
    if (!formData.app_id) newErrors['app_id'] = 'App ID is required';
    if (!formData.primary_contact_email) newErrors['primary_contact_email'] = 'Primary contact email is required';
    if (!formData.owner) newErrors['owner'] = 'Owner is required';
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.primary_contact_email && !emailRegex.test(formData.primary_contact_email)) {
      newErrors['primary_contact_email'] = 'Invalid email format';
    }
    if (formData.secondary_contact_email && !emailRegex.test(formData.secondary_contact_email)) {
      newErrors['secondary_contact_email'] = 'Invalid email format';
    }
    if (formData.team_distribution_email && !emailRegex.test(formData.team_distribution_email)) {
      newErrors['team_distribution_email'] = 'Invalid email format';
    }
    
    // FQDN validation
    const fqdnRegex = /^(?=.{1,253}$)((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$/;
    if (formData.vip_fqdn && !fqdnRegex.test(formData.vip_fqdn)) {
      newErrors['vip_fqdn'] = 'Invalid FQDN format';
    }
    
    // IP validation (optional)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (formData.vip_ip && !ipRegex.test(formData.vip_ip)) {
      newErrors['vip_ip'] = 'Invalid IP format';
    }
    
    // Port validation
    if (formData.port <= 0 || formData.port > 65535) {
      newErrors['port'] = 'Port must be between 1 and 65535';
    }
    
    // Monitor validation
    if (formData.monitor.port <= 0 || formData.monitor.port > 65535) {
      newErrors['monitor.port'] = 'Monitor port must be between 1 and 65535';
    }
    
    // Persistence timeout validation
    if (formData.persistence && formData.persistence.timeout < 0) {
      newErrors['persistence.timeout'] = 'Timeout must be a positive number';
    }
    
    // Pool members validation
    formData.pool.forEach((member, index) => {
      if (!member.ip) {
        newErrors[`pool[${index}].ip`] = 'IP is required';
      } else if (!ipRegex.test(member.ip)) {
        newErrors[`pool[${index}].ip`] = 'Invalid IP format';
      }
      
      if (member.port <= 0 || member.port > 65535) {
        newErrors[`pool[${index}].port`] = 'Port must be between 1 and 65535';
      }
    });
    
    // ServiceNow Incident ID validation
    if (!incidentId) {
      setIncidentIdError('ServiceNow Incident ID is required');
      return false;
    } else {
      setIncidentIdError('');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alertApi.post({
        message: 'Please fix the errors in the form',
        severity: 'error'
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // Get the token from localStorage (set during login)
      const token = localStorage.getItem('auth_token');
      if (!token) {
        alertApi.post({
          message: 'Authentication token not found. Please log in again.',
          severity: 'error'
        });
        navigate('/');
        return;
      }
      
      // Create the VIP
      const result = await lbaasApi.createVip(formData, incidentId, token);
      
      if (result.success) {
        alertApi.post({
          message: result.message || 'VIP created successfully',
          severity: 'success'
        });
        navigate('/');
      } else {
        alertApi.post({
          message: result.message || 'Failed to create VIP',
          severity: 'error'
        });
      }
    } catch (e: any) {
      alertApi.post({
        message: `Error creating VIP: ${e.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Page themeId="tool">
      <Header title="Create New VIP" subtitle="Add a new Load Balancer Virtual IP Address" />
      <Content>
        <ContentHeader title="VIP Details">
          <Button
            variant="text"
            color="primary"
            component={RouterLink}
            to="/"
          >
            Back to VIP List
          </Button>
          <SupportButton>Fill out this form to create a new VIP.</SupportButton>
        </ContentHeader>
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={3} padding={3}>
                  {/* Basic Information */}
                  <Grid item xs={12}>
                    <Typography variant="h6">Basic Information</Typography>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="VIP FQDN"
                      value={formData.vip_fqdn}
                      onChange={(e) => handleChange('vip_fqdn', e.target.value)}
                      error={!!errors.vip_fqdn}
                      helperText={errors.vip_fqdn}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="VIP IP Address (Optional)"
                      value={formData.vip_ip || ''}
                      onChange={(e) => handleChange('vip_ip', e.target.value)}
                      error={!!errors.vip_ip}
                      helperText={errors.vip_ip}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => handleChange('port', parseInt(e.target.value))}
                      error={!!errors.port}
                      helperText={errors.port}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth error={!!errors.protocol}>
                      <InputLabel>Protocol</InputLabel>
                      <Select
                        value={formData.protocol}
                        onChange={(e) => handleChange('protocol', e.target.value)}
                        label="Protocol"
                        required
                      >
                        {protocols.map(protocol => (
                          <MenuItem key={protocol} value={protocol}>
                            {protocol.toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.protocol && <FormHelperText>{errors.protocol}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth error={!!errors.lb_method}>
                      <InputLabel>Load Balancing Method</InputLabel>
                      <Select
                        value={formData.lb_method}
                        onChange={(e) => handleChange('lb_method', e.target.value)}
                        label="Load Balancing Method"
                        required
                      >
                        {lbMethods.map(method => (
                          <MenuItem key={method} value={method}>
                            {method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.lb_method && <FormHelperText>{errors.lb_method}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="App ID"
                      value={formData.app_id}
                      onChange={(e) => handleChange('app_id', e.target.value)}
                      error={!!errors.app_id}
                      helperText={errors.app_id}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth error={!!errors.environment}>
                      <InputLabel>Environment</InputLabel>
                      <Select
                        value={formData.environment}
                        onChange={(e) => handleChange('environment', e.target.value)}
                        label="Environment"
                        required
                      >
                        {environments.map(env => (
                          <MenuItem key={env} value={env}>
                            {env.charAt(0).toUpperCase() + env.slice(1)}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.environment && <FormHelperText>{errors.environment}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth error={!!errors.datacenter}>
                      <InputLabel>Datacenter</InputLabel>
                      <Select
                        value={formData.datacenter}
                        onChange={(e) => handleChange('datacenter', e.target.value)}
                        label="Datacenter"
                        required
                      >
                        {datacenters.map(dc => (
                          <MenuItem key={dc} value={dc}>
                            {dc.toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.datacenter && <FormHelperText>{errors.datacenter}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Owner"
                      value={formData.owner}
                      onChange={(e) => handleChange('owner', e.target.value)}
                      error={!!errors.owner}
                      helperText={errors.owner}
                      required
                    />
                  </Grid>
                  
                  {/* Contact Information */}
                  <Grid item xs={12}>
                    <Typography variant="h6" style={{ marginTop: 16 }}>Contact Information</Typography>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Primary Contact Email"
                      value={formData.primary_contact_email}
                      onChange={(e) => handleChange('primary_contact_email', e.target.value)}
                      error={!!errors.primary_contact_email}
                      helperText={errors.primary_contact_email}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Secondary Contact Email (Optional)"
                      value={formData.secondary_contact_email || ''}
                      onChange={(e) => handleChange('secondary_contact_email', e.target.value)}
                      error={!!errors.secondary_contact_email}
                      helperText={errors.secondary_contact_email}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Team Distribution Email (Optional)"
                      value={formData.team_distribution_email || ''}
                      onChange={(e) => handleChange('team_distribution_email', e.target.value)}
                      error={!!errors.team_distribution_email}
                      helperText={errors.team_distribution_email}
                    />
                  </Grid>
                  
                  {/* SSL Configuration */}
                  <Grid item xs={12}>
                    <Typography variant="h6" style={{ marginTop: 16 }}>SSL Configuration (Optional)</Typography>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="SSL Certificate Name"
                      value={formData.ssl_cert_name || ''}
                      onChange={(e) => handleChange('ssl_cert_name', e.target.value)}
                      error={!!errors.ssl_cert_name}
                      helperText={errors.ssl_cert_name}
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="mTLS CA Certificate Name"
                      value={formData.mtls_ca_cert_name || ''}
                      onChange={(e) => handleChange('mtls_ca_cert_name', e.target.value)}
                      error={!!errors.mtls_ca_cert_name}
                      helperText={errors.mtls_ca_cert_name}
                    />
                  </Grid>
                  
                  {/* Health Monitor */}
                  <Grid item xs={12}>
                    <Typography variant="h6" style={{ marginTop: 16 }}>Health Monitor</Typography>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth error={!!errors['monitor.type']}>
                      <InputLabel>Monitor Type</InputLabel>
                      <Select
                        value={formData.monitor.type}
                        onChange={(e) => handleNestedChange('monitor', 'type', e.target.value)}
                        label="Monitor Type"
                        required
                      >
                        {monitorTypes.map(type => (
                          <MenuItem key={type} value={type}>
                            {type.toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors['monitor.type'] && <FormHelperText>{errors['monitor.type']}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Monitor Port"
                      type="number"
                      value={formData.monitor.port}
                      onChange={(e) => handleNestedChange('monitor', 'port', parseInt(e.target.value))}
                      error={!!errors['monitor.port']}
                      helperText={errors['monitor.port']}
                      required
                    />
                  </Grid>
                  
                  {(formData.monitor.type === 'http' || formData.monitor.type === 'https') && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Send String"
                          value={formData.monitor.send || ''}
                          onChange={(e) => handleNestedChange('monitor', 'send', e.target.value)}
                          error={!!errors['monitor.send']}
                          helperText={errors['monitor.send'] || 'e.g., GET /health HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n'}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Receive String"
                          value={formData.monitor.receive || ''}
                          onChange={(e) => handleNestedChange('monitor', 'receive', e.target.value)}
                          error={!!errors['monitor.receive']}
                          helperText={errors['monitor.receive'] || 'e.g., 200 OK or HTTP/1.1 200'}
                        />
                      </Grid>
                    </>
                  )}
                  
                  {/* Persistence */}
                  <Grid item xs={12}>
                    <Typography variant="h6" style={{ marginTop: 16 }}>Persistence (Optional)</Typography>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors['persistence.type']}>
                      <InputLabel>Persistence Type</InputLabel>
                      <Select
                        value={formData.persistence?.type || 'none'}
                        onChange={(e) => {
                          if (e.target.value === 'none') {
                            handleChange('persistence', undefined);
                          } else {
                            handleNestedChange('persistence', 'type', e.target.value);
                          }
                        }}
                        label="Persistence Type"
                      >
                        {persistenceTypes.map(type => (
                          <MenuItem key={type} value={type}>
                            {type === 'none' ? 'None' : type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors['persistence.type'] && <FormHelperText>{errors['persistence.type']}</FormHelperText>}
                    </FormControl>
                  </Grid>
                  
                  {formData.persistence && formData.persistence.type !== 'none' && (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Timeout (seconds)"
                        type="number"
                        value={formData.persistence.timeout}
                        onChange={(e) => handleNestedChange('persistence', 'timeout', parseInt(e.target.value))}
                        error={!!errors['persistence.timeout']}
                        helperText={errors['persistence.timeout']}
                      />
                    </Grid>
                  )}
                  
                  {/* Pool Members */}
                  <Grid item xs={12}>
                    <Typography variant="h6" style={{ marginTop: 16 }}>Pool Members</Typography>
                    <Divider />
                  </Grid>
                  
                  {formData.pool.map((member, index) => (
                    <React.Fragment key={index}>
                      <Grid item xs={12}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} md={5}>
                            <TextField
                              fullWidth
                              label={`Pool Member ${index + 1} IP`}
                              value={member.ip}
                              onChange={(e) => handlePoolMemberChange(index, 'ip', e.target.value)}
                              error={!!errors[`pool[${index}].ip`]}
                              helperText={errors[`pool[${index}].ip`]}
                              required
                            />
                          </Grid>
                          
                          <Grid item xs={12} md={5}>
                            <TextField
                              fullWidth
                              label={`Pool Member ${index + 1} Port`}
                              type="number"
                              value={member.port}
                              onChange={(e) => handlePoolMemberChange(index, 'port', parseInt(e.target.value))}
                              error={!!errors[`pool[${index}].port`]}
                              helperText={errors[`pool[${index}].port`]}
                              required
                            />
                          </Grid>
                          
                          <Grid item xs={12} md={2}>
                            <Tooltip title="Remove Pool Member">
                              <IconButton 
                                color="secondary" 
                                onClick={() => removePoolMember(index)}
                                disabled={formData.pool.length <= 1}
                              >
                                <RemoveIcon />
                              </IconButton>
                            </Tooltip>
                          </Grid>
                        </Grid>
                      </Grid>
                    </React.Fragment>
                  ))}
                  
                  <Grid item xs={12}>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={addPoolMember}
                      color="primary"
                    >
                      Add Pool Member
                    </Button>
                  </Grid>
                  
                  {/* ServiceNow Incident ID */}
                  <Grid item xs={12}>
                    <Typography variant="h6" style={{ marginTop: 16 }}>ServiceNow Information</Typography>
                    <Divider />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="ServiceNow Incident ID"
                      value={incidentId}
                      onChange={(e) => setIncidentId(e.target.value)}
                      error={!!incidentIdError}
                      helperText={incidentIdError || 'Required for tracking and approval purposes'}
                      required
                    />
                  </Grid>
                  
                  {/* Submit Button */}
                  <Grid item xs={12} style={{ marginTop: 16 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={loading}
                      size="large"
                    >
                      {loading ? <CircularProgress size={24} /> : 'Create VIP'}
                    </Button>
                    <Button
                      variant="text"
                      component={RouterLink}
                      to="/"
                      style={{ marginLeft: 16 }}
                    >
                      Cancel
                    </Button>
                  </Grid>
                </Grid>
              </form>
            </Paper>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
