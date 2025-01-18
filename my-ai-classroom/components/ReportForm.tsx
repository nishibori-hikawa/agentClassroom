import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';

const ReportForm: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await response.json();
      setReport(data.report);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
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
        </Box>
      )}
    </Box>
  );
};

export default ReportForm;
