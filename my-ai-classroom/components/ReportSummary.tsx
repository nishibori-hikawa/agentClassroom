import React from 'react';
import { Box, Typography } from '@mui/material';
import CriticPoints from './CriticPoints';
import TAMessages from './TAMessages';

interface ReportSummaryProps {
  results: {
    writer: string;
    reporter: string;
    critic: string;
    ta: string;
  };
}

const ReportSummary: React.FC<ReportSummaryProps> = ({ results }) => {
  const criticPoints = results.critic.split('; ');
  const taMessages = results.ta.split('; ');

  return (
    <Box mt={4}>
      <Typography variant="h5">Report Summary</Typography>
      
      <Typography variant="h6">Blog:</Typography>
      <Typography>{results.writer}</Typography>
      
      <Typography variant="h6">Report:</Typography>
      <Typography>{results.reporter}</Typography>

      <CriticPoints points={criticPoints} />
      <TAMessages messages={taMessages} />
    </Box>
  );
};

export default ReportSummary;
