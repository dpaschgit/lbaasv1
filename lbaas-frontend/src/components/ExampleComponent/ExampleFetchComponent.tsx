import React, { useState } from 'react';
import { Typography, Grid, Button, CircularProgress, List, ListItem, ListItemText } from '@material-ui/core';
import { useAsync } from 'react-use';

// This is a placeholder for where your API client would be configured
// For a real plugin, you would use the Backstage API utility or fetch directly
const fetchTestData = async (): Promise<{ message: string; items: string[] }> => {
  // Simulate an API call
  await new Promise(resolve => setTimeout(resolve, 1000)); 
  return {
    message: 'Hello from a mock API call!',
    items: ['Item 1 from API', 'Item 2 from API', 'Item 3 from API'],
  };
};

export const ExampleFetchComponent = () => {
  const [buttonClicked, setButtonClicked] = useState(false);

  const { value, loading, error } = useAsync(async () => {
    if (!buttonClicked) {
      return undefined; // Don't fetch until button is clicked
    }
    const result = await fetchTestData();
    return result;
  }, [buttonClicked]);

  return (
    <Grid container spacing={3} direction="column">
      <Grid item>
        <Typography variant="h6">Example Data Fetching</Typography>
      </Grid>
      <Grid item>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => setButtonClicked(true)}
          disabled={loading || buttonClicked}
        >
          {loading ? <CircularProgress size={24} /> : 'Fetch Data from Mock API'}
        </Button>
      </Grid>
      {value && (
        <Grid item>
          <Typography variant="body1">{value.message}</Typography>
          <List>
            {value.items.map((item, index) => (
              <ListItem key={index}>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
        </Grid>
      )}
      {error && (
        <Grid item>
          <Typography color="error">
            Error fetching data: {error.message}
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

