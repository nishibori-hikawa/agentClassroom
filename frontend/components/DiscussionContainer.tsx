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
  explored_content?: string;
  point_selection?: {
    report_id: string;
    point_id: string;
  };
  case_report?: string;
  check_content?: string;
  thread_id?: string;
  report_id?: string;
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
  const [loadingPointId, setLoadingPointId] = useState<string | null>(null);
  const [state, setState] = useState<State>({ query: '' });
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportContent | null>(null);
  const [detailedReport, setDetailedReport] = useState<ReportContent | null>(null);
  const [investigatedPoints, setInvestigatedPoints] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // 現在のページに応じたトピックタイトルを取得
  const getCurrentTopicTitle = () => {
    if (!report) return '';
    
    // 詳細レポートが存在し、2ページ目以降の場合
    if (detailedReport && currentPage > 1) {
      return detailedReport.topic;
    }
    // それ以外の場合は初期トピック
    return report.topic;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingPointId(null);
    setInvestigatedPoints(new Set()); // リセット
    setDetailedReport(null); // リセット
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

      // レポート内容をパースしてReportContentに変換
      if (data.reporter_content) {
        const reportData = {
          id: data.report_id,  // バックエンドから受け取ったreport_idを使用
          topic: state.query,
          points: parseReportContent(data.reporter_content)
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
    setLoadingPointId(pointId);
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

      // 詳細レポートの内容をパースしてReportContentに変換
      if (data.explored_content) {
        const detailedReportData = {
          id: `${data.report_id}_detailed`,
          topic: report.points.find(p => p.id === pointId)?.title || '詳細レポート',
          points: parseReportContent(data.explored_content)
        };
        setDetailedReport(detailedReportData);
        setInvestigatedPoints(prev => new Set(Array.from(prev).concat(pointId)));
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoadingPointId(null);
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
      {!report && (
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
      )}

      {report && (
        <Box>
          <Typography variant="h5" sx={{ mb: 3 }}>
            {getCurrentTopicTitle()}
          </Typography>
          <ReportPoints 
            points={[...report.points, ...(detailedReport?.points || [])]}
            onPointSelect={handlePointSelect}
            selectedPointId={state.point_selection?.point_id}
            initialPage={detailedReport ? 2 : 1}
            investigatedPoints={investigatedPoints}
            showPaginationInCard={state.point_selection?.point_id}
            onPageChange={handlePageChange}
            loading={loadingPointId !== null}
            loadingPointId={loadingPointId || undefined}
          />
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