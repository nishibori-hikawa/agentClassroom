import React, { useState } from 'react';
import { Box, CircularProgress, Button, TextField, Typography, Card, CardContent, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { ReportPoints } from './ReportPoints';
import { ReportContent, Point } from '../types/report';

interface State {
  query: string;
  current_role?: string;
  reporter_content?: string;
  explored_content?: string;
  point_selection?: {
    report_id: string;
    point_id: string;
  };
  thread_id?: string;
  report_id?: string;
}

const DiscussionContainer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState<Set<string>>(new Set());
  const [state, setState] = useState<State>({ query: '' });
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportContent | null>(null);
  const [investigatedPoints, setInvestigatedPoints] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingPoints(new Set());
    setInvestigatedPoints(new Set());
    setReport(null);
    try {
      const response = await fetch('http://localhost:8000/reporter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: state.query,
          thread_id: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        ...data
      }));

      if (data.reporter_content) {
        const reportData = parseReportContent(data.reporter_content, data.report_id, state.query);
        setReport(reportData);
        setShowForm(false);
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setShowForm(true);
    setReport(null);
    setState({ query: '' });
    setError(null);
    setInvestigatedPoints(new Set());
  };

  const handlePointSelect = async (fullPointId: string) => {
    if (!report) return;

    // レベル、親ポイントID、ポイントIDを分離
    const [level, parentPointId, pointId] = fullPointId.split('_');

    // 既に調査済みの場合は何もしない
    if (investigatedPoints.has(fullPointId)) return;

    setLoadingPoints(prev => new Set(prev).add(fullPointId));
    try {
      const response = await fetch('http://localhost:8000/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            query: state.query,
            current_role: state.current_role,
            reporter_content: state.reporter_content,
            report_id: state.report_id
          },
          point_selection: {
            report_id: state.report_id,
            point_id: pointId
          },
          thread_id: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        ...data
      }));

      if (data.explored_content) {
        const detailedReportData = parseReportContent(
          data.explored_content,
          `${data.report_id}_${pointId}`,
          report.points.find(p => p.id === pointId)?.title || '詳細レポート'
        );

        // レポート構造を更新
        setReport(prev => {
          if (!prev) return null;

          // 親ポイントIDがrootの場合は最上位レベルのポイント
          if (parentPointId === 'root') {
            return {
              ...prev,
              points: prev.points.map(point => {
                if (point.id === pointId) {
                  return {
                    ...point,
                    detailedReport: detailedReportData
                  };
                }
                return point;
              })
            };
          }

          // 親ポイントIDが指定されている場合は、そのポイント配下の詳細レポートを更新
          return {
            ...prev,
            points: prev.points.map(point => {
              if (point.id === parentPointId && point.detailedReport) {
                return {
                  ...point,
                  detailedReport: {
                    ...point.detailedReport,
                    points: point.detailedReport.points.map(subPoint => {
                      if (subPoint.id === pointId) {
                        return {
                          ...subPoint,
                          detailedReport: detailedReportData
                        };
                      }
                      return subPoint;
                    })
                  }
                };
              }
              return point;
            })
          };
        });

        setInvestigatedPoints(prev => new Set(prev).add(fullPointId));
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoadingPoints(prev => {
        const newSet = new Set(prev);
        newSet.delete(fullPointId);
        return newSet;
      });
    }
  };

  const parseReportContent = (text: string, reportId: string, topic: string): ReportContent => {
    const lines = text.split('\n');
    const points: Point[] = [];
    let currentPoint: Partial<Point> | null = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.match(/^\d+\.\s+\*\*/)) {
        if (currentPoint) {
          points.push(currentPoint as Point);
        }
        const titleMatch = line.match(/\*\*(.*?)\*\*/);
        currentPoint = {
          id: (points.length + 1).toString(),
          title: titleMatch ? titleMatch[1].trim() : '',
          content: '',
          source: { name: '', url: '' },
          report_id: reportId
        };
      } else if (currentPoint && line.includes('[出典:')) {
        const sourceMatch = line.match(/\[出典:\s*(.*?)\]\((.*?)\)/);
        if (sourceMatch) {
          currentPoint.source = {
            name: sourceMatch[1].trim(),
            url: sourceMatch[2].trim()
          };
        }
      } else if (currentPoint) {
        currentPoint.content = (currentPoint.content || '') + line.trim() + ' ';
      }
    }

    if (currentPoint) {
      points.push(currentPoint as Point);
    }

    return {
      id: reportId,
      topic,
      points
    };
  };

  return (
    <Box sx={{ maxWidth: 'lg', mx: 'auto', p: 3 }}>
      {showForm ? (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="質問を入力してください"
                value={state.query}
                onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
                disabled={loading}
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !state.query.trim()}
                sx={{ minWidth: '120px' }}
              >
                {loading ? <CircularProgress size={24} /> : '質問する'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            onClick={handleNewQuestion}
            startIcon={<AddIcon />}
          >
            新しい質問
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {report && (
        <Box>
          <Typography variant="h5" gutterBottom>
            {report.topic}
          </Typography>
          <ReportPoints
            points={report.points}
            onPointSelect={handlePointSelect}
            selectedPointId={state.point_selection?.point_id}
            investigatedPoints={investigatedPoints}
            loading={loading}
            loadingPoints={loadingPoints}
            level={0}
          />
        </Box>
      )}
    </Box>
  );
};

export default DiscussionContainer; 