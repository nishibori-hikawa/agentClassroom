import React from 'react';
import { List, ListItem, ListItemText, Box, Typography } from '@mui/material';

const TAMessages: React.FC = () => {
  const messages = [
    'TA Message 1: Please consider the following points...',
    'TA Message 2: Another important aspect to discuss is...',
    'TA Message 3: Additionally, you might want to think about...'
  ];

  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        TA Messages
      </Typography>
      <List>
        {messages.map((message, index) => (
          <ListItem key={index}>
            <ListItemText primary={message} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default TAMessages;
