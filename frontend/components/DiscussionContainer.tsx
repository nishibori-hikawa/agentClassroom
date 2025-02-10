import React, { useState } from 'react';
import { Box, CircularProgress, Button, TextField, Typography, Card, CardContent, Alert, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import { ReportPoints } from './ReportPoints';
import { CriticPoints } from './CriticPoints';
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
  const [criticPoints, setCriticPoints] = useState<Array<{ title: string; content: string }> | null>(null);
  const [loadingCritic, setLoadingCritic] = useState(false);

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

  const updateReportPoints = (
    points: Point[],
    level: number,
    parentId: string,
    targetPointId: string,
    detailedReportData: ReportContent,
    selectedPoint: Point
  ): Point[] => {
    let result;
    // level === 0 の場合はトップレベルのポイントを直接更新
    if (level === 0) {
      result = points.map(point => {
        if (point.id === targetPointId) {
          return { ...point, detailedReport: detailedReportData };
        }
        return point;
      });
    } else {
      // level > 0 の場合は、まず対象の親ノードを探す
      result = points.map(point => {
        if (point.id === parentId) {
          // 対象親ノードの detailedReport がなければ初期化
          const currentDetailedReport = point.detailedReport || {
            id: `${level}_${parentId}`,
            topic: point.title,
            points: [] as Point[]
          };

          // 対象の子ノードが存在すれば更新、なければ追加
          const updatedChildren = currentDetailedReport.points.map(child => {
            if (child.id === targetPointId) {
              return { ...child, detailedReport: detailedReportData };
            }
            return child;
          });

          if (!currentDetailedReport.points.some(child => child.id === targetPointId)) {
            updatedChildren.push({ ...selectedPoint, detailedReport: detailedReportData });
          }

          return {
            ...point,
            detailedReport: { ...currentDetailedReport, points: updatedChildren }
          };
        } else if (point.detailedReport?.points) {
          return {
            ...point,
            detailedReport: {
              ...point.detailedReport,
              points: updateReportPoints(
                point.detailedReport.points,
                level,
                parentId,
                targetPointId,
                detailedReportData,
                selectedPoint
              )
            }
          };
        }
        return point;
      });
    }
    return result;
  };

  const handlePointSelect = async (fullPointId: string) => {
    if (!report) return;

    // fullPointId の形式は `${level}_${parentPointId}_${pointId}` なので分解する
    const [levelStr, parentPointId, pointId] = fullPointId.split('_');
    const level = parseInt(levelStr, 10);

    // 既に調査済みの場合は何もしない
    if (investigatedPoints.has(fullPointId)) {
      return;
    }

    // 対象のポイントを report 内から検索する（既存の処理）
    const findSelectedPoint = (
      points: Point[],
      targetId: string,
      targetLevel: number,
      currentLevel: number = 0,
      targetParentId?: string
    ): Point | null => {
      if (targetLevel === 0) {
        return points.find(p => p.id === targetId) || null;
      }
      if (targetLevel === 1) {
        const parentPoint = points.find(p => p.id === targetParentId);
        if (!parentPoint) return null;
        return parentPoint.detailedReport?.points.find(p => p.id === targetId) || null;
      }
      for (const point of points) {
        if (point.detailedReport?.points) {
          const found = findSelectedPoint(
            point.detailedReport.points,
            targetId,
            targetLevel - 1,
            currentLevel + 1,
            targetParentId
          );
          if (found) return found;
        }
      }
      return null;
    };

    const selectedPoint = findSelectedPoint(report.points, pointId, level, 0, parentPointId);
    if (!selectedPoint) {
      return;
    }

    setLoadingPoints(prev => new Set(prev).add(fullPointId));
    try {
      const requestData = {
        state: {
          query: selectedPoint.title,
          current_role: state.current_role,
          reporter_content: selectedPoint.content,
          report_id: state.report_id
        },
        point_selection: {
          report_id: state.report_id,
          point_id: pointId
        },
        thread_id: 1
      };

      const response = await fetch('http://localhost:8000/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
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
        // バックエンドから返された report_id を使用
        const newReportId = data.report_id || `${level}_${parentPointId}_${pointId}`;
        
        const detailedReportData = parseReportContent(
          data.explored_content,
          newReportId,
          selectedPoint.title
        );

        // ここで再帰的更新を実施
        setReport(prev => {
          if (!prev) return null;

          const updatedPoints = updateReportPoints(
            prev.points,
            level,
            parentPointId,
            pointId,
            detailedReportData,
            selectedPoint
          );

          return { 
            ...prev, 
            points: updatedPoints, 
            id: newReportId
          };
        });

        setState(prev => ({
          ...prev,
          report_id: newReportId
        }));

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

  const handleExtractPoints = async (point: { title: string; content: string }) => {
    setLoadingCritic(true);
    try {
      const response = await fetch('http://localhost:8000/critic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: point.title,
          content: point.content,
          thread_id: 1
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.critic_points) {
        setCriticPoints(data.critic_points);
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoadingCritic(false);
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
                label="トピックを入力してください"
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
            startIcon={<ClearIcon />}
          >
            調査をクリア
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {report && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <ReportPoints
              points={report.points}
              onPointSelect={handlePointSelect}
              onExtractPoints={handleExtractPoints}
              selectedPointId={state.point_selection?.point_id}
              investigatedPoints={investigatedPoints}
              loading={loading}
              loadingPoints={loadingPoints}
              level={0}
              topic={report.topic}
              pointPath={[]}
              parentTitle={undefined}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CriticPoints
              points={criticPoints}
              loading={loadingCritic}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default DiscussionContainer; 