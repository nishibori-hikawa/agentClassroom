import React, { useState } from 'react';
import { List, ListItem, ListItemText, Box, Typography, TextField, Button } from '@mui/material';

const TAMessages: React.FC = () => {
  const [messages, setMessages] = useState([
    'TA Message 1: Please consider the following points...',
    'TA Message 2: Another important aspect to discuss is...',
    'TA Message 3: Additionally, you might want to think about...'
  ]);

  const [feedback, setFeedback] = useState('');

  const handleFeedbackSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/user_speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messages.join('\n'), feedback }),
      });
      const data = await response.json();
      console.log('Feedback response:', data);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

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
      <Box component="form" onSubmit={handleFeedbackSubmit} noValidate>
        <TextField
          label="Feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          fullWidth
          margin="normal"
          required
        />
        <Button type="submit" variant="contained" color="secondary">
          Submit Feedback
        </Button>
      </Box>
    </Box>
  );
};

export default TAMessages;
