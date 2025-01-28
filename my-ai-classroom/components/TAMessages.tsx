import React from 'react';
import { List, ListItem, ListItemText, Box, Typography } from '@mui/material';

interface TAMessagesProps {
  summary: string;
  criticPoints: string[];
}

const TAMessages: React.FC<TAMessagesProps> = ({ summary, criticPoints }) => {
  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        Discussion Summary
      </Typography>
      <Typography paragraph>{summary}</Typography>

      <Typography variant="h6" component="h3" gutterBottom>
        Critic Points
      </Typography>
      <List>
        {criticPoints?.map((point, index) => (
          <ListItem key={index}>
            <ListItemText primary={point} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default TAMessages;
