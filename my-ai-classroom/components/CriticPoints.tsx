import React from 'react';
import { List, ListItem, ListItemText, Box, Typography } from '@mui/material';

interface CriticPointsProps {
  points: string[];
}

const CriticPoints: React.FC<CriticPointsProps> = ({ points }) => {
  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        Critic Points
      </Typography>
      <List>
        {points?.map((point, index) => (
          <ListItem key={index}>
            <ListItemText primary={point} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default CriticPoints;
