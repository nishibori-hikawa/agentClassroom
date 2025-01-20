import React from 'react';
import { List, ListItem, ListItemText, Box, Typography } from '@mui/material';

interface TAMessagesProps {
  messages: string[];
}

const TAMessages: React.FC<TAMessagesProps> = ({ messages }) => {
  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        TA Messages
      </Typography>
      <List>
        {messages?.map((message, index) => (
          <ListItem key={index}>
            <ListItemText primary={message} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default TAMessages;
