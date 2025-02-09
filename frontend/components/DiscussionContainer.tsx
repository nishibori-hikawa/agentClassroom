import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Button, TextField, Typography, Card, CardContent, Grid, Alert } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReportPoints } from './ReportPoints';

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

interface ReportContent {
  id: string;
  topic: string;
  points: {
    id: string;
    title: string;
    content: string;
    source: {
      name: string;
      url: string;
    };
  }[];
}

interface Source {
  name: string;
  url: string;
}

const DiscussionContainer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<State>({ query: '' });
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportContent | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_call: true,
          state: { query: state.query },
          thread_id: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      let accumulated_output = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.reporter_content) {
              accumulated_output = data.reporter_content;
              setState(prev => ({
                ...prev,
                reporter_content: accumulated_output
              }));
            }
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        }
      }

      // レポート内容をパースしてReportContentに変換
      if (accumulated_output) {
        const reportData = {
          id: new Date().getTime().toString(),
          topic: state.query,
          points: parseReportContent(accumulated_output)
        };
        setReport(reportData);
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePointSelect = async (pointId: string) => {
    if (!report) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_call: false,
          state: {
            ...state,
            reporter_content: state.reporter_content,
            current_role: 'reporter',
            human_selection: {
              point_num: parseInt(pointId),
              case_num: 0
            }
          },
          thread_id: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // ストリームの処理
      const reader = response.body?.getReader();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            setState(prev => ({
              ...prev,
              ...data
            }));
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        }
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // レポート内容をパースする関数
  const parseReportContent = (text: string): any[] => {
    const lines = text.split('\n');
    const points = [];
    let currentPoint: {
      id: string;
      title: string;
      content: string;
      source: Source | null;
    } | null = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.match(/^\d+\.\s+\*\*/)) {
        // 前のポイントがあれば追加
        if (currentPoint) {
          points.push(currentPoint);
        }
        // タイトルの抽出を修正 - **[タイトル]** から **タイトル** の形式に変更
        const titleMatch = line.match(/\*\*(.*?)\*\*/);
        currentPoint = {
          id: (points.length + 1).toString(),
          title: titleMatch ? titleMatch[1].trim() : '',
          content: '',
          source: null
        };
      } else if (currentPoint && line.includes('[出典:')) {
        const sourceMatch = line.match(/\[出典:\s*(.*?)\]\((.*?)\)/);
        if (sourceMatch) {
          currentPoint.source = {
            name: sourceMatch[1].trim(),
            url: sourceMatch[2].trim()
          };
        }
      } else if (currentPoint && !line.includes('[出典:')) {
        // 出典行以外の場合はコンテンツとして追加
        currentPoint.content += line.trim() + ' ';
      }
    }

    // 最後のポイントを追加
    if (currentPoint) {
      points.push(currentPoint);
    }

    return points;
  };

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto', p: 3 }}>
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              value={state.query}
              onChange={(e) => setState({ ...state, query: e.target.value })}
              placeholder="質問を入力してください"
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                  生成中...
                </Box>
              ) : (
                '送信'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {report && (
        <Box>
          <Typography variant="h5" sx={{ mb: 3 }}>
            {report.topic}
          </Typography>
          <ReportPoints points={report.points} onPointSelect={handlePointSelect} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default DiscussionContainer; 