import React, { useState, useEffect } from 'react';
import { Typography, Grid, Button, CircularProgress, Paper, TextField, MenuItem, FormControl, InputLabel, Select, FormHelperText, Dialog, DialogTitle, DialogContent, DialogActions, Divider, Checkbox, FormControlLabel } from '@material-ui/core';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ArrowBack, LockOpen } from '@material-ui/icons';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  ErrorPanel
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';

// Interface for VIP creation data
interface VipCreateData {
  vip_fqdn: string;
  vip_ip: string;
  port: number;
  protocol: string;
  environment: string;
  datacenter: string;
  app_id: string;
  owner: string;
  pool_members: Array<{ ip: string; port: number; enabled: boolean }>;
  monitor: { type: string; port?: number; send_string?: string; receive_string?: string; interval?: number; timeout?: number };
  persistence: { type: string; timeout?: number };
}

export const VipCreatePage = () => {
  const alertApi = useApi(alertApiRef);
  const lbaasApi = useApi(lbaasFrontendApiRef);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [incidentId, setIncidentId] = useState('');
  const [incidentIdError, setIncidentIdError] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<string[]>(['Development', 'QA', 'Staging', 'Production']);
  const [datacenters, setDatacenters] = useState<Record<string, string[]>>({
    'Development': ['DevDC1', 'DevDC2'],
    'QA': ['QADC1', 'QADC2'],
    'Staging': ['StageDC1', 'StageDC2'],
    'Production': ['ProdDC1', 'ProdDC2', 'ProdDC3']
  });
  const [protocols, setProtocols] = useState<string[]>(['HTTP', 'HTTPS', 'TCP', 'UDP']);
  const [monitorTypes, setMonitorTypes] = useState<string[]>(['HTTP', 'HTTPS', 'TCP', 'ICMP', 'None']);
  const [persistenceTypes, setPersistenceTypes] = useState<string[]>(['None', 'Source IP', 'Cookie', 'SSL Session ID']);
  
  // Form state
  const [formData, setFormData] = useState<VipCreateData>({
    vip_fqdn: '',
    vip_ip: '',
    port: 80,
    protocol: 'HTTP',
    environment: 'Development',
    datacenter: 'DevDC1',
    app_id: '',
    owner: '',
    pool_members: [{ ip: '', port: 8080, enabled: true }],
    monitor: { type: 'HTTP', port: 8080, send_string: 'GET /health HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n', receive_string: '200 OK', interval: 5, timeout: 16 },
    persistence: { type: 'None', timeout: 3600 }
  });
  
  // Form validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
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
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Login failed. Please try again.');
    }
  };
  
  // Handle form changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (!name) return;
    
    // Clear validation error when field is edited
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // Handle nested properties
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof VipCreateData],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Update datacenter options when environment changes
    if (name === 'environment') {
      const env = value as string;
      if (datacenters[env] && !datacenters[env].includes(formData.datacenter)) {
        setFormData(prev => ({
          ...prev,
          datacenter: datacenters[env][0]
        }));
      }
    }
  };
  
  // Handle pool member changes
  const handlePoolMemberChange = (index: number, field: string, value: any) => {
    const updatedPoolMembers = [...formData.pool_members];
    updatedPoolMembers[index] = {
      ...updatedPoolMembers[index],
      [field]: value
    };
    
    setFormData(prev => ({
      ...prev,
      pool_members: updatedPoolMembers
    }));
    
    // Clear validation errors
    const errorKey = `pool_members[${index}].${field}`;
    if (formErrors[errorKey]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };
  
  // Add pool member
  const handleAddPoolMember = () => {
    setFormData(prev => ({
      ...prev,
      pool_members: [...prev.pool_members, { ip: '', port: 8080, enabled: true }]
    }));
  };
  
  // Remove pool member
  const handleRemovePoolMember = (index: number) => {
    if (formData.pool_members.length <= 1) {
      alertApi.post({ message: 'At least one pool member is required.', severity: 'warning' });
      return;
    }
    
    const updatedPoolMembers = [...formData.pool_members];
    updatedPoolMembers.splice(index, 1);
    
    setFormData(prev => ({
      ...prev,
      pool_members: updatedPoolMembers
    }));
    
    // Clear validation errors for removed member
    const newErrors = { ...formErrors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`pool_members[${index}]`)) {
        delete newErrors[key];
      }
    });
    setFormErrors(newErrors);
  };
  
  // Toggle advanced options
  const handleToggleAdvancedOptions = () => {
    setShowAdvancedOptions(!showAdvancedOptions);
  };
  
  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Basic validation
    if (!formData.vip_fqdn) {
      errors['vip_fqdn'] = 'FQDN is required';
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.vip_fqdn)) {
      errors['vip_fqdn'] = 'Invalid FQDN format';
    }
    
    if (!formData.vip_ip) {
      errors['vip_ip'] = 'IP Address is required';
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.vip_ip)) {
      errors['vip_ip'] = 'Invalid IP address format';
    }
    
    if (!formData.port) {
      errors['port'] = 'Port is required';
    } else if (formData.port < 1 || formData.port > 65535) {
      errors['port'] = 'Port must be between 1 and 65535';
    }
    
    if (!formData.app_id) {
      errors['app_id'] = 'Application ID is required';
    }
    
    if (!formData.owner) {
      errors['owner'] = 'Owner is required';
    }
    
    // Pool member validation
    formData.pool_members.forEach((member, index) => {
      if (!member.ip) {
        errors[`pool_members[${index}].ip`] = 'IP Address is required';
      } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(member.ip)) {
        errors[`pool_members[${index}].ip`] = 'Invalid IP address format';
      }
      
      if (!member.port) {
        errors[`pool_members[${index}].port`] = 'Port is required';
      } else if (member.port < 1 || member.port > 65535) {
        errors[`pool_members[${index}].port`] = 'Port must be between 1 and 65535';
      }
    });
    
    // Advanced validation
    if (showAdvancedOptions) {
      if (formData.monitor.type !== 'None') {
        if (formData.monitor.type === 'HTTP' || formData.monitor.type === 'HTTPS') {
          if (!formData.monitor.send_string) {
            errors['monitor.send_string'] = 'Send string is required for HTTP/HTTPS monitors';
          }
          if (!formData.monitor.receive_string) {
            errors['monitor.receive_string'] = 'Receive string is required for HTTP/HTTPS monitors';
          }
        }
        
        if (!formData.monitor.interval) {
          errors['monitor.interval'] = 'Interval is required';
        } else if (formData.monitor.interval < 1) {
          errors['monitor.interval'] = 'Interval must be positive';
        }
        
        if (!formData.monitor.timeout) {
          errors['monitor.timeout'] = 'Timeout is required';
        } else if (formData.monitor.timeout < 1) {
          errors['monitor.timeout'] = 'Timeout must be positive';
        }
      }
      
      if (formData.persistence.type !== 'None' && !formData.persistence.timeout) {
        errors['persistence.timeout'] = 'Timeout is required for persistence';
      }
    }
    
    // Incident ID validation
    if (!incidentId) {
      errors['incidentId'] = 'Incident ID is required';
    } else if (!incidentId.match(/^INC[0-9]{7}$/)) {
      errors['incidentId'] = 'Invalid Incident ID format (should be INC0000000)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check authentication
    if (!lbaasApi.isAuthenticated()) {
      alertApi.post({ message: 'Authentication required to create VIP.', severity: 'error' });
      handleLoginDialogOpen();
      return;
    }
    
    // Validate form
    if (!validateForm()) {
      alertApi.post({ message: 'Please fix the errors in the form.', severity: 'error' });
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Create VIP using API client
      const createdVip = await lbaasApi.createVip(formData, incidentId);
      
      alertApi.post({ message: 'VIP created successfully!', severity: 'success' });
      
      // Navigate to the VIP view page
      if (createdVip && createdVip.id) {
        navigate(`/lbaas-frontend/${createdVip.id}/view`);
      } else {
        // If no ID returned, go back to list
        navigate('/lbaas-frontend');
      }
    } catch (e: any) {
      console.error('Error creating VIP:', e);
      setError(e);
      alertApi.post({ message: `Error creating VIP: ${e.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page themeId="tool">
      <Header title="Create New VIP">
        <Button component={RouterLink} to="/lbaas-frontend" variant="outlined" startIcon={<ArrowBack />}>
          Back to VIP List
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
        <ContentHeader title="Create New Virtual IP Configuration">
          <SupportButton>Create a new load balancer VIP configuration.</SupportButton>
        </ContentHeader>
        
        {/* Authentication Warning */}
        {!lbaasApi.isAuthenticated() && (
          <InfoCard title="Authentication Required" severity="warning" style={{ marginBottom: '20px' }}>
            <Typography variant="body1">
              You need to be authenticated to create a VIP. Please log in to continue.
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
        
        {/* Error Display */}
        {error && (
          <ErrorPanel
            error={error}
            title="Error creating VIP"
            defaultExpanded
          />
        )}
        
        <form onSubmit={handleSubmit}>
          <Paper style={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>Basic Information</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="FQDN"
                  name="vip_fqdn"
                  value={formData.vip_fqdn}
                  onChange={handleInputChange}
                  error={!!formErrors['vip_fqdn']}
                  helperText={formErrors['vip_fqdn'] || 'e.g., app.example.com'}
                  disabled={loading || !lbaasApi.isAuthenticated()}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="IP Address"
                  name="vip_ip"
                  value={formData.vip_ip}
                  onChange={handleInputChange}
                  error={!!formErrors['vip_ip']}
                  helperText={formErrors['vip_ip'] || 'e.g., 192.168.1.10'}
                  disabled={loading || !lbaasApi.isAuthenticated()}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  required
                  fullWidth
                  label="Port"
                  name="port"
                  type="number"
                  value={formData.port}
                  onChange={handleInputChange}
                  error={!!formErrors['port']}
                  helperText={formErrors['port']}
                  InputProps={{ inputProps: { min: 1, max: 65535 } }}
                  disabled={loading || !lbaasApi.isAuthenticated()}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth disabled={loading || !lbaasApi.isAuthenticated()}>
                  <InputLabel id="protocol-label">Protocol</InputLabel>
                  <Select
                    labelId="protocol-label"
                    name="protocol"
                    value={formData.protocol}
                    onChange={handleInputChange}
                  >
                    {protocols.map(protocol => (
                      <MenuItem key={protocol} value={protocol}>{protocol}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  required
                  fullWidth
                  label="Application ID"
                  name="app_id"
                  value={formData.app_id}
                  onChange={handleInputChange}
                  error={!!formErrors['app_id']}
                  helperText={formErrors['app_id'] || 'e.g., APP001'}
                  disabled={loading || !lbaasApi.isAuthenticated()}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth disabled={loading || !lbaasApi.isAuthenticated()}>
                  <InputLabel id="environment-label">Environment</InputLabel>
                  <Select
                    labelId="environment-label"
                    name="environment"
                    value={formData.environment}
                    onChange={handleInputChange}
                  >
                    {environments.map(env => (
                      <MenuItem key={env} value={env}>{env}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth disabled={loading || !lbaasApi.isAuthenticated()}>
                  <InputLabel id="datacenter-label">Datacenter</InputLabel>
                  <Select
                    labelId="datacenter-label"
                    name="datacenter"
                    value={formData.datacenter}
                    onChange={handleInputChange}
                  >
                    {datacenters[formData.environment]?.map(dc => (
                      <MenuItem key={dc} value={dc}>{dc}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  required
                  fullWidth
                  label="Owner"
                  name="owner"
                  value={formData.owner}
                  onChange={handleInputChange}
                  error={!!formErrors['owner']}
                  helperText={formErrors['owner'] || 'e.g., John Doe'}
                  disabled={loading || !lbaasApi.isAuthenticated()}
                />
              </Grid>
            </Grid>
          </Paper>
          
          <Paper style={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>Pool Members</Typography>
            {formData.pool_members.map((member, index) => (
              <Grid container spacing={3} key={index} alignItems="center" style={{ marginBottom: '10px' }}>
                <Grid item xs={12} sm={5}>
                  <TextField
                    required
                    fullWidth
                    label="IP Address"
                    value={member.ip}
                    onChange={(e) => handlePoolMemberChange(index, 'ip', e.target.value)}
                    error={!!formErrors[`pool_members[${index}].ip`]}
                    helperText={formErrors[`pool_members[${index}].ip`] || 'e.g., 192.168.2.10'}
                    disabled={loading || !lbaasApi.isAuthenticated()}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    required
                    fullWidth
                    label="Port"
                    type="number"
                    value={member.port}
                    onChange={(e) => handlePoolMemberChange(index, 'port', parseInt(e.target.value))}
                    error={!!formErrors[`pool_members[${index}].port`]}
                    helperText={formErrors[`pool_members[${index}].port`]}
                    InputProps={{ inputProps: { min: 1, max: 65535 } }}
                    disabled={loading || !lbaasApi.isAuthenticated()}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={member.enabled}
                        onChange={(e) => handlePoolMemberChange(index, 'enabled', e.target.checked)}
                        disabled={loading || !lbaasApi.isAuthenticated()}
                      />
                    }
                    label="Enabled"
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => handleRemovePoolMember(index)}
                    disabled={formData.pool_members.length <= 1 || loading || !lbaasApi.isAuthenticated()}
                  >
                    Remove
                  </Button>
                </Grid>
              </Grid>
            ))}
            <Button
              variant="outlined"
              color="primary"
              onClick={handleAddPoolMember}
              style={{ marginTop: '10px' }}
              disabled={loading || !lbaasApi.isAuthenticated()}
            >
              Add Pool Member
            </Button>
          </Paper>
          
          <Button
            variant="outlined"
            color="primary"
            onClick={handleToggleAdvancedOptions}
            style={{ marginBottom: '20px' }}
            disabled={loading || !lbaasApi.isAuthenticated()}
          >
            {showAdvancedOptions ? 'Hide Advanced Options' : 'Show Advanced Options'}
          </Button>
          
          {showAdvancedOptions && (
            <>
              <Paper style={{ padding: '20px', marginBottom: '20px' }}>
                <Typography variant="h6" gutterBottom>Health Monitor</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth disabled={loading || !lbaasApi.isAuthenticated()}>
                      <InputLabel id="monitor-type-label">Monitor Type</InputLabel>
                      <Select
                        labelId="monitor-type-label"
                        name="monitor.type"
                        value={formData.monitor.type}
                        onChange={handleInputChange}
                      >
                        {monitorTypes.map(type => (
                          <MenuItem key={type} value={type}>{type}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  {formData.monitor.type !== 'None' && (
                    <>
                      {(formData.monitor.type === 'HTTP' || formData.monitor.type === 'HTTPS') && (
                        <>
                          <Grid item xs={12} sm={4}>
                            <TextField
                              fullWidth
                              label="Monitor Port"
                              name="monitor.port"
                              type="number"
                              value={formData.monitor.port || ''}
                              onChange={handleInputChange}
                              error={!!formErrors['monitor.port']}
                              helperText={formErrors['monitor.port']}
                              InputProps={{ inputProps: { min: 1, max: 65535 } }}
                              disabled={loading || !lbaasApi.isAuthenticated()}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="Send String"
                              name="monitor.send_string"
                              value={formData.monitor.send_string || ''}
                              onChange={handleInputChange}
                              error={!!formErrors['monitor.send_string']}
                              helperText={formErrors['monitor.send_string'] || 'e.g., GET /health HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n'}
                              multiline
                              rows={2}
                              disabled={loading || !lbaasApi.isAuthenticated()}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="Receive String"
                              name="monitor.receive_string"
                              value={formData.monitor.receive_string || ''}
                              onChange={handleInputChange}
                              error={!!formErrors['monitor.receive_string']}
                              helperText={formErrors['monitor.receive_string'] || 'e.g., 200 OK'}
                              disabled={loading || !lbaasApi.isAuthenticated()}
                            />
                          </Grid>
                        </>
                      )}
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Interval (seconds)"
                          name="monitor.interval"
                          type="number"
                          value={formData.monitor.interval || ''}
                          onChange={handleInputChange}
                          error={!!formErrors['monitor.interval']}
                          helperText={formErrors['monitor.interval']}
                          InputProps={{ inputProps: { min: 1 } }}
                          disabled={loading || !lbaasApi.isAuthenticated()}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Timeout (seconds)"
                          name="monitor.timeout"
                          type="number"
                          value={formData.monitor.timeout || ''}
                          onChange={handleInputChange}
                          error={!!formErrors['monitor.timeout']}
                          helperText={formErrors['monitor.timeout']}
                          InputProps={{ inputProps: { min: 1 } }}
                          disabled={loading || !lbaasApi.isAuthenticated()}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </Paper>
              
              <Paper style={{ padding: '20px', marginBottom: '20px' }}>
                <Typography variant="h6" gutterBottom>Persistence</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth disabled={loading || !lbaasApi.isAuthenticated()}>
                      <InputLabel id="persistence-type-label">Persistence Type</InputLabel>
                      <Select
                        labelId="persistence-type-label"
                        name="persistence.type"
                        value={formData.persistence.type}
                        onChange={handleInputChange}
                      >
                        {persistenceTypes.map(type => (
                          <MenuItem key={type} value={type}>{type}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  {formData.persistence.type !== 'None' && (
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Timeout (seconds)"
                        name="persistence.timeout"
                        type="number"
                        value={formData.persistence.timeout || ''}
                        onChange={handleInputChange}
                        error={!!formErrors['persistence.timeout']}
                        helperText={formErrors['persistence.timeout']}
                        InputProps={{ inputProps: { min: 1 } }}
                        disabled={loading || !lbaasApi.isAuthenticated()}
                      />
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </>
          )}
          
          <Paper style={{ padding: '20px', marginBottom: '20px' }}>
            <Typography variant="h6" gutterBottom>Change Management</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  label="ServiceNow Incident ID"
                  placeholder="INC0000000"
                  value={incidentId}
                  onChange={(e) => setIncidentId(e.target.value)}
                  error={!!formErrors['incidentId']}
                  helperText={formErrors['incidentId'] || 'Format: INC0000000'}
                  disabled={loading || !lbaasApi.isAuthenticated()}
                />
              </Grid>
            </Grid>
          </Paper>
          
          <Grid container justifyContent="flex-end" spacing={2}>
            <Grid item>
              <Button
                component={RouterLink}
                to="/lbaas-frontend"
                variant="outlined"
                disabled={loading}
              >
                Cancel
              </Button>
            </Grid>
            <Grid item>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading || !lbaasApi.isAuthenticated()}
              >
                {loading ? <CircularProgress size={24} /> : 'Create VIP'}
              </Button>
            </Grid>
          </Grid>
        </form>
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
