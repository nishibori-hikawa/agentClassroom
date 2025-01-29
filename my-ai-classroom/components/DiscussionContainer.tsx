import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Button, TextField, Typography, List, ListItem, ListItemText } from '@mui/material';
import ReportForm from './ReportForm';
import TAMessages from './TAMessages';

interface NewsItem {
  title: string;
  description: string;
  link: string;
}

const DiscussionContainer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'auto' | 'interactive'>('auto');
  const [currentStep, setCurrentStep] = useState<'initial' | 'report' | 'critic' | 'completed'>('initial');
  const [report, setReport] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const [criticPoints, setCriticPoints] = useState<string[]>([]);
  const [criticFeedback, setCriticFeedback] = useState('');
  const [taMessage, setTaMessage] = useState('');
  const [newsSuggestions, setNewsSuggestions] = useState<NewsItem[]>([]);

  useEffect(() => {
    fetchNewsSuggestions();
  }, []);

  const fetchNewsSuggestions = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/news_suggestions`);
      const data = await response.json();
      setNewsSuggestions(data.news_items);
    } catch (error) {
      console.error('Error fetching news suggestions:', error);
    }
  };

  const handleNewsSelect = async (title: string) => {
    await handleDiscussionStart(title);
  };

  const handleDiscussionStart = async (topic: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/run_discussion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_topic: topic, mode }),
      });
      const data = await response.json();

      if (mode === 'auto') {
        setReport(data.report);
        setCriticPoints(data.critic_points);
        setTaMessage(data.ta_message);
        setCurrentStep('completed');
      } else {
        setReport(data.report);
        setCurrentStep('report');
      }
    } catch (error) {
      console.error('Error in discussion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReportFeedback = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/submit_report_feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_text: report, user_feedback: reportFeedback }),
      });
      const data = await response.json();
      setCriticPoints(data.points);
      setCurrentStep('critic');
    } catch (error) {
      console.error('Error submitting report feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCriticFeedback = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/submit_critic_feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: criticPoints, user_feedback: criticFeedback }),
      });
      const data = await response.json();
      setTaMessage(data.ta_message);
      setCurrentStep('completed');
    } catch (error) {
      console.error('Error submitting critic feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {currentStep === 'initial' && (
        <>
          <Button
            variant={mode === 'auto' ? 'contained' : 'outlined'}
            onClick={() => setMode('auto')}
            sx={{ mr: 2, mb: 2 }}
          >
            自動モード
          </Button>
          <Button
            variant={mode === 'interactive' ? 'contained' : 'outlined'}
            onClick={() => setMode('interactive')}
            sx={{ mb: 2 }}
          >
            インタラクティブモード
          </Button>

          <Typography variant="h6" gutterBottom>
            最新のニューストピック
          </Typography>
          <List>
            {newsSuggestions.map((news, index) => (
              <ListItem
                key={index}
                button
                onClick={() => handleNewsSelect(news.title)}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
              >
                <ListItemText
                  primary={news.title}
                  secondary={news.description}
                />
              </ListItem>
            ))}
          </List>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            または、自由にトピックを入力
          </Typography>
          <ReportForm onSubmit={handleDiscussionStart} />
        </>
      )}

      {loading && <CircularProgress />}

      {mode === 'interactive' && currentStep === 'report' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">レポート内容:</Typography>
          <Typography>{report}</Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={reportFeedback}
            onChange={(e) => setReportFeedback(e.target.value)}
            placeholder="レポートへのフィードバックを入力してください"
            sx={{ mt: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleReportFeedback}
            sx={{ mt: 2 }}
          >
            フィードバックを送信
          </Button>
        </Box>
      )}

      {mode === 'interactive' && currentStep === 'critic' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Critic Points:</Typography>
          {criticPoints.map((point, index) => (
            <Typography key={index}>• {point}</Typography>
          ))}
          <TextField
            fullWidth
            multiline
            rows={4}
            value={criticFeedback}
            onChange={(e) => setCriticFeedback(e.target.value)}
            placeholder="Critic pointsへのフィードバックを入力してください"
            sx={{ mt: 2 }}
          />
          <Button
            variant="contained"
            onClick={handleCriticFeedback}
            sx={{ mt: 2 }}
          >
            フィードバックを送信
          </Button>
        </Box>
      )}

      {currentStep === 'completed' && (
        <TAMessages summary={taMessage} criticPoints={criticPoints} />
      )}
    </Box>
  );
};

export default DiscussionContainer; 