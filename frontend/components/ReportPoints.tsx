import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Grid, CircularProgress, Breadcrumbs, Pagination } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Point } from '../types/report';

interface ReportPointsProps {
  points: Point[];
  onPointSelect: (pointId: string) => void;
  selectedPointId?: string;
  investigatedPoints: Set<string>;
  loading?: boolean;
  loadingPoints: Set<string>;
  level?: number;
  parentPointId?: string;
  pointPath?: string[];
  topic?: string;
  parentTitle?: string;
  onBack?: () => void;
}

export const ReportPoints: React.FC<ReportPointsProps> = ({
  points,
  onPointSelect,
  selectedPointId,
  investigatedPoints,
  loading = false,
  loadingPoints,
  level = 0,
  parentPointId = 'root',
  pointPath = [],
  topic,
  parentTitle,
  onBack
}) => {
  const POINTS_PER_PAGE = 3;
  const [page, setPage] = useState(1);
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null);

  // ページネーション用のポイント配列を取得
  const paginatedPoints = points.slice((page - 1) * POINTS_PER_PAGE, page * POINTS_PER_PAGE);
  const totalPages = Math.ceil(points.length / POINTS_PER_PAGE);

  // 現在のレベルとparentPointIdのポイントIDのみをチェックするヘルパー関数
  const isInvestigated = (pointId: string) => {
    const fullId = `${level}_${parentPointId}_${pointId}`;
    return investigatedPoints.has(fullId);
  };

  const isLoading = (pointId: string) => {
    const fullId = `${level}_${parentPointId}_${pointId}`;
    return loadingPoints.has(fullId);
  };

  const renderButtonContent = (point: Point) => {
    if (isLoading(point.id)) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} color="inherit" />
          調査中...
        </Box>
      );
    }
    if (isInvestigated(point.id)) {
      return expandedPointId === point.id ? '戻る' : '詳細を見る';
    }
    return '詳細を調査';
  };

  const handlePointSelect = (pointId: string) => {
    const fullId = `${level}_${parentPointId}_${pointId}`;
    if (isInvestigated(pointId)) {
      setExpandedPointId(expandedPointId === pointId ? null : pointId);
    } else {
      onPointSelect(fullId);
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    setExpandedPointId(null);
  };

  const handleBack = () => {
    if (expandedPointId) {
      setExpandedPointId(null);
    } else if (onBack) {
      onBack();
    }
  };

  const renderPointPath = () => {
    if (level === 0) return null;
    return (
      <Breadcrumbs aria-label="point path" sx={{ ml: 2 }}>
        {pointPath.map((id, index) => (
          <Typography key={index} color="text.secondary">
            {id}
          </Typography>
        ))}
      </Breadcrumbs>
    );
  };

  // 展開されたポイントの詳細レポートを表示
  const renderExpandedPoint = () => {
    if (!expandedPointId) return null;

    const expandedPoint = points.find(p => p.id === expandedPointId);
    if (!expandedPoint?.detailedReport) return null;

    return (
      <ReportPoints
        points={expandedPoint.detailedReport.points}
        onPointSelect={onPointSelect}
        selectedPointId={selectedPointId}
        investigatedPoints={investigatedPoints}
        loading={loading}
        loadingPoints={loadingPoints}
        level={level + 1}
        parentPointId={expandedPoint.id}
        pointPath={[...pointPath, expandedPoint.id]}
        topic={expandedPoint.detailedReport.topic}
        parentTitle={expandedPoint.title}
        onBack={handleBack}
      />
    );
  };

  const renderHeader = () => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {level > 0 && (
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            sx={{ mr: 2 }}
          >
            戻る
          </Button>
        )}
        <Typography variant="h5">
          {level === 0 ? topic : parentTitle}
        </Typography>
        {renderPointPath()}
      </Box>
    );
  };

  if (expandedPointId) {
    return renderExpandedPoint();
  }

  return (
    <Box>
      {(level === 0 ? topic : parentTitle) && renderHeader()}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          {paginatedPoints.map((point) => (
            <Card
              key={point.id}
              sx={{
                mb: 2,
                border: selectedPointId === `${level}_${parentPointId}_${point.id}` ? '2px solid #1976d2' : 'none',
              }}
            >
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {point.title}
                </Typography>
                <Typography variant="body1" paragraph>
                  {point.content}
                </Typography>
                {point.source && (
                  <Typography variant="body2" color="text.secondary">
                    出典: <a href={point.source.url} target="_blank" rel="noopener noreferrer">{point.source.name}</a>
                  </Typography>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    variant={selectedPointId === `${level}_${parentPointId}_${point.id}` ? "contained" : "outlined"}
                    onClick={() => handlePointSelect(point.id)}
                    disabled={loading || isLoading(point.id)}
                    sx={{ 
                      mt: 1, 
                      minWidth: '140px',
                      '& .MuiCircularProgress-root': {
                        marginRight: 1
                      }
                    }}
                  >
                    {renderButtonContent(point)}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
}; 