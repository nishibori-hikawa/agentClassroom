import React from 'react';
import { List, ListItem, ListItemText, Box, Typography } from '@mui/material';

const CriticPoints: React.FC = () => {
  const points = [
    'Point 1: Policy issues and political system challenges',
    'Point 2: Factors of international conflict and cooperation',
    'Point 3: Perspectives likely omitted in the report'
  ];

  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        Critic Points
      </Typography>
      <List>
        {points.map((point, index) => (
          <ListItem key={index}>
            <ListItemText primary={point} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default CriticPoints;
