import React, { useState } from 'react';
import { Box, CircularProgress, Button, TextField, Typography, Card, CardContent, Grid, Alert } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CriticPoint {
  title: string;
  cases: [string, string];
}

interface CriticContent {
  points: CriticPoint[];
}

interface State {
  query: string;
  current_role?: string;
  reporter_content?: string;
  critic_content?: CriticContent;
  human_selection?: {
    point_num: number;
    case_num: number;
  };
  case_report?: string;
  check_content?: string;
  thread_id?: string;
}

const DiscussionContainer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<State>({ query: '' });
  const [currentStep, setCurrentStep] = useState<'initial' | 'report' | 'points' | 'final'>('initial');
  const [error, setError] = useState<string | null>(null);

  const processStream = async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      const lines = text.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const newState = JSON.parse(line);
          setState(prevState => ({
            ...prevState,
            ...newState
          }));
          
          if (newState.current_role === 'reporter') {
            setCurrentStep('report');
          } else if (newState.current_role === 'critic') {
            setCurrentStep('points');
          } else if (newState.current_role === 'check') {
            setCurrentStep('final');
          }
        } catch (e) {
          console.error('Error parsing stream data:', e);
        }
      }
    }
  };

  const handleTopicSubmit = async (topic: string) => {
    setLoading(true);
    setError(null);
    try {
      if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
        throw new Error('バックエンドURLが設定されていません。環境変数を確認してください。');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_call: true,
          state: { query: topic },
          thread_id: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
      }

      await processStream(response);
    } catch (error) {
      console.error('Error starting discussion:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCaseSelect = async (pointNum: number, caseNum: number) => {
    setLoading(true);
    setError(null);
    try {
      if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
        throw new Error('バックエンドURLが設定されていません。環境変数を確認してください。');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_call: false,
          state: {
            ...state,
            human_selection: {
              point_num: pointNum,
              case_num: caseNum
            }
          },
          thread_id: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
      }

      await processStream(response);
    } catch (error) {
      console.error('Error selecting case:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid container spacing={3}>
      {error && (
        <Grid item xs={12}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {/* Reporter Card */}
      <Grid item xs={12}>
        <Card sx={{ mb: 2, backgroundColor: currentStep === 'initial' ? '#f5f5f5' : 'white' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Reporter
            </Typography>
            {currentStep === 'initial' ? (
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  トピックを入力して、調査を開始します
                </Typography>
                <TextField
                  fullWidth
                  value={state.query}
                  onChange={(e) => setState({ ...state, query: e.target.value })}
                  placeholder="議論したいトピックを入力"
                  sx={{ mb: 2 }}
                />
                <Button
                  variant="contained"
                  onClick={() => handleTopicSubmit(state.query)}
                  disabled={!state.query || loading}
                >
                  調査を開始
                </Button>
              </Box>
            ) : (
              state.reporter_content && (
                <Box sx={{ mt: 2 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.reporter_content}</ReactMarkdown>
                </Box>
              )
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Critic Card */}
      {state.critic_content?.points && (
        <Grid item xs={12}>
          <Card sx={{ mb: 2, backgroundColor: '#f5f5f5' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Critic
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                以下の論点から、検討したい視点を選択してください
              </Typography>
              {state.critic_content.points.map((point, pointIndex) => (
                <Box key={pointIndex} sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {point.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {point.cases.map((caseText, caseIndex) => (
                      <Button
                        key={caseIndex}
                        variant="outlined"
                        onClick={() => handleCaseSelect(pointIndex, caseIndex)}
                        disabled={loading}
                        sx={{ 
                          flex: '1 1 auto',
                          backgroundColor: 
                            state.human_selection?.point_num === pointIndex && 
                            state.human_selection?.case_num === caseIndex 
                              ? '#e3f2fd' 
                              : 'inherit'
                        }}
                      >
                        {caseText}
                      </Button>
                    ))}
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Case Report Card */}
      {state.check_content && (
        <Grid item xs={12}>
          <Card sx={{ mb: 2, backgroundColor: '#fff' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                選択された視点の詳細分析
              </Typography>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.check_content}</ReactMarkdown>
            </CardContent>
          </Card>
        </Grid>
      )}

      {currentStep === 'final' && state.check_content && (
        <Grid item xs={12}>
          <Card sx={{ mb: 2, backgroundColor: '#f5f5f5' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Reporter
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                選択された視点に基づく分析結果
              </Typography>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.check_content}</ReactMarkdown>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Loading Indicator */}
      {loading && (
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Grid>
      )}
    </Grid>
  );
};

export default DiscussionContainer; 