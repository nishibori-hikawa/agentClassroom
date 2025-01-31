import React, { useState } from 'react';
import { TextField, Button, Box, Typography } from '@mui/material';

interface ReportFormProps {
  onSubmit: (topic: string) => Promise<void>;
}

const ReportForm: React.FC<ReportFormProps> = ({ onSubmit }) => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit(topic);
    } catch (error) {
      console.error('Error in discussion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/user_speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: report, feedback }),
      });
      const data = await response.json();
      console.log('Feedback response:', data);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Topic"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        fullWidth
        margin="normal"
        required
      />
      <Button type="submit" variant="contained" color="primary" disabled={loading}>
        {loading ? 'Loading...' : 'Submit'}
      </Button>
      {report && (
        <Box mt={2}>
          <h3>Report:</h3>
          <p>{report}</p>
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
      )}
    </Box>
  );
};

export default ReportForm;
