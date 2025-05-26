import React, { useState } from 'react';
import {
  Typography,
  Button,
  TextField,
  Paper,
  Grid,
  CircularProgress,
  makeStyles,
  Theme,
  createStyles,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef } from '../../api';
import { LockOpen } from '@material-ui/icons';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(4),
      maxWidth: '500px',
      margin: '0 auto',
    },
    title: {
      marginBottom: theme.spacing(3),
    },
    form: {
      width: '100%',
      marginTop: theme.spacing(1),
    },
    submit: {
      margin: theme.spacing(3, 0, 2),
    },
    alert: {
      marginBottom: theme.spacing(2),
    },
  }),
);

export interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const classes = useStyles();
  const lbaasApi = useApi(lbaasFrontendApiRef);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      await lbaasApi.login(username, password);
      
      // Clear form
      setUsername('');
      setPassword('');
      
      // Call success callback if provided
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Paper className={classes.root} elevation={3}>
      <Typography component="h1" variant="h5" className={classes.title}>
        LBaaS Login
      </Typography>
      
      {error && (
        <Alert severity="error" className={classes.alert}>
          {error}
        </Alert>
      )}
      
      {lbaasApi.isAuthenticated() ? (
        <div>
          <Alert severity="success" className={classes.alert}>
            You are already logged in.
          </Alert>
          <Button
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={() => lbaasApi.logout()}
          >
            Logout
          </Button>
        </div>
      ) : (
        <form className={classes.form} onSubmit={handleLogin}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            className={classes.submit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={24} /> : <LockOpen />}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
          <Grid container>
            <Grid item xs>
              <Typography variant="body2">
                Default credentials: admin/testpassword
              </Typography>
            </Grid>
          </Grid>
        </form>
      )}
    </Paper>
  );
};
