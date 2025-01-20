import React, { useState } from 'react';
import { TextField, Button, Box, Typography, CircularProgress } from '@mui/material';
import AgentPopup from './AgentPopup';
import useAgentFlow from '../hooks/useAgentFlow';

const ReportForm: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(false);
  const { initializeSteps, executeCurrentStep, currentStep, steps, results } = useAgentFlow();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    initializeSteps(topic);
    setPopupOpen(true);
    setCurrentAgent(steps[0]?.agent || null);
    setLoading(false);
  };

  const handleUserChoice = async (choice: 'user' | 'agent') => {
    setPopupOpen(false);
    if (choice === 'user') {
      const userResponse = prompt(`ユーザーとして${currentAgent}に対する入力をしてください:`);
      if (userResponse && currentAgent) {
        results[currentAgent] = userResponse;
      }
    } else {
      await executeCurrentStep();
    }

    if (currentStep < steps.length) {
      setCurrentAgent(steps[currentStep].agent);
      setPopupOpen(true);
    } else {
      setShowReport(true);
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
      <Button type="submit" variant="contained" color="primary" disabled={loading || !topic}>
        {loading ? <CircularProgress size={24} /> : 'Submit'}
      </Button>

      <AgentPopup
        open={popupOpen}
        agent={currentAgent || ''}
        onUserChoice={handleUserChoice}
        currentStep={currentStep}
        totalSteps={steps.length}
        rememberChoice={rememberChoice}
        onRememberChoiceChange={setRememberChoice}
      />

      {showReport && (
        <Box mt={4}>
          <Typography variant="h5">Report Summary</Typography>
          <Typography variant="h6">Blog:</Typography>
          <Typography>{results['writer']}</Typography>
          <Typography variant="h6">Report:</Typography>
          <Typography>{results['reporter']}</Typography>
          <Typography variant="h6">Critic Points:</Typography>
          <Typography>{results['critic']}</Typography>
          <Typography variant="h6">TA Messages:</Typography>
          <Typography>{results['ta']}</Typography>
        </Box>
      )}
    </Box>
  );
};

export default ReportForm;
