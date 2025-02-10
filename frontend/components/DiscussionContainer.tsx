import React, { useState } from 'react';
import { Box, CircularProgress, Button, TextField, Typography, Card, CardContent, Alert, Grid, Tabs, Tab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import { ReportPoints } from './ReportPoints';
import { CriticPoints } from './CriticPoints';
import { ReportContent, Point } from '../types/report';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface State {
  query: string;
  current_role?: string;
  reporter_content?: string;
  explored_content?: string;
  point_selection_for_critic?: {
    report_id: string;
    point_id: string;
    title?: string;
    content?: string;
  };
  thread_id?: string;
  report_id?: string;
}

const DiscussionContainer: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState<Set<string>>(new Set());
  const [state, setState] = useState<State>({ query: '' });
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportContent | null>(null);
  const [investigatedPoints, setInvestigatedPoints] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(true);
  const [criticPoints, setCriticPoints] = useState<Array<{ title: string; content: string }> | null>(null);
  const [loadingCriticPoints, setLoadingCriticPoints] = useState<Set<string>>(new Set());
  const [extractedPoints, setExtractedPoints] = useState<Set<string>>(new Set());
  const [investigationReport, setInvestigationReport] = useState<ReportContent | null>(null);
  const [loadingInvestigation, setLoadingInvestigation] = useState<Set<string>>(new Set());
  const [investigatedCases, setInvestigatedCases] = useState<Set<string>>(new Set());

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

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
    setExtractedPoints(new Set());
    setLoadingCriticPoints(new Set());
    setCriticPoints(null);
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
        point_selection_for_critic: {
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

  const handleExtractPoints = async (point: { title: string; content: string; id?: string }) => {
    if (!point.id) return;
    
    // fullIdから実際のpoint_idを抽出（形式: `${level}_${parentPointId}_${pointId}`）
    const [_, __, pointId] = point.id.split('_');
    
    setLoadingCriticPoints(prev => new Set(prev).add(point.id!));
    try {
      const requestPayload = {
        state: {
          query: state.query,
          current_role: state.current_role,
          reporter_content: state.reporter_content,
          explored_content: state.explored_content,
          report_id: state.report_id
        },
        point_selection_for_critic: {
          report_id: state.report_id,
          point_id: pointId,
          title: point.title,
          content: point.content
        },
        thread_id: 1,
        title: point.title,
        content: point.content
      };
      
      console.log('Debug - Critic request payload:', {
        ...requestPayload,
        state: {
          ...requestPayload.state,
          explored_content_length: requestPayload.state.explored_content?.length || 0
        }
      });

      const response = await fetch('http://localhost:8000/critic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.critic_content?.critic_points) {
        const formattedPoints = data.critic_content.critic_points.map((point: any) => ({
          title: point.title,
          content: point.content
        }));
        setCriticPoints(formattedPoints);
        setExtractedPoints(prev => new Set(prev).add(point.id!));
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoadingCriticPoints(prev => {
        const newSet = new Set(prev);
        newSet.delete(point.id!);
        return newSet;
      });
    }
  };

  const handleViewCriticPoints = () => {
    setCurrentTab(1);
  };

  const handleInvestigateCase = async (point: { title: string; content: string }, isYesCase: boolean) => {
    const caseKey = `${point.title}_${isYesCase ? 'yes' : 'no'}`;
    setLoadingInvestigation(prev => new Set(prev).add(caseKey));
    try {
      const requestPayload = {
        state: {
          query: state.query,
          current_role: state.current_role,
          reporter_content: state.reporter_content,
          report_id: state.report_id
        },
        point_selection_for_critic: {
          report_id: state.report_id,
          point_id: state.point_selection_for_critic?.point_id,
          title: point.title,
          content: point.content
        },
        thread_id: 1,
        is_yes_case: isYesCase
      };

      const response = await fetch('http://localhost:8000/investigate_case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.explored_content) {
        const investigationData = parseReportContent(
          data.explored_content,
          `investigation_${Date.now()}`,
          `${point.title}の${isYesCase ? 'Yes' : 'No'}事例`
        );
        setInvestigationReport(investigationData);
        setCurrentTab(2); // 調査事例タブに切り替え
        setInvestigatedCases(prev => new Set(prev).add(caseKey));
      }

    } catch (error) {
      console.error('Error:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
    } finally {
      setLoadingInvestigation(prev => {
        const newSet = new Set(prev);
        newSet.delete(caseKey);
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
                {loading ? <CircularProgress size={24} /> : '調査を開始'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="outlined"
              onClick={handleNewQuestion}
              startIcon={<ClearIcon />}
            >
              探究をクリア
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {report && (
            <>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={currentTab} onChange={handleTabChange} aria-label="discussion tabs">
                  <Tab label="レポート" />
                  <Tab label="論点" />
                  <Tab label="調査事例" />
                </Tabs>
              </Box>

              <TabPanel value={currentTab} index={0}>
                <ReportPoints
                  points={report.points}
                  onPointSelect={handlePointSelect}
                  onExtractPoints={handleExtractPoints}
                  selectedPointId={state.point_selection_for_critic?.point_id}
                  investigatedPoints={investigatedPoints}
                  loading={loading}
                  loadingPoints={loadingPoints}
                  level={0}
                  topic={report.topic}
                  pointPath={[]}
                  parentTitle={undefined}
                  loadingCriticPoints={loadingCriticPoints}
                  extractedPoints={extractedPoints}
                  onViewCriticPoints={handleViewCriticPoints}
                />
              </TabPanel>

              <TabPanel value={currentTab} index={1}>
                <CriticPoints
                  points={criticPoints}
                  loading={false}
                  onInvestigateCase={handleInvestigateCase}
                  loadingInvestigation={loadingInvestigation}
                  investigatedCases={investigatedCases}
                  onViewInvestigation={() => setCurrentTab(2)}
                />
              </TabPanel>

              <TabPanel value={currentTab} index={2}>
                {investigationReport && (
                  <ReportPoints
                    points={investigationReport.points}
                    onPointSelect={handlePointSelect}
                    selectedPointId={state.point_selection_for_critic?.point_id}
                    investigatedPoints={investigatedPoints}
                    loading={false}
                    loadingPoints={loadingPoints}
                    level={0}
                    topic={investigationReport.topic}
                    pointPath={[]}
                    parentTitle=""
                    loadingCriticPoints={new Set()}
                    extractedPoints={new Set()}
                  />
                )}
              </TabPanel>
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default DiscussionContainer; 