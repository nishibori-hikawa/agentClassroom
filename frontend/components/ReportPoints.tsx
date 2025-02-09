import React from 'react';
import { Box, Card, CardContent, Typography, Button, Grid, CircularProgress, Breadcrumbs } from '@mui/material';
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
  parentTitle
}) => {
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
      return '詳細を見る';
    }
    return '詳細を調査';
  };

  const handlePointSelect = (pointId: string) => {
    const fullId = `${level}_${parentPointId}_${pointId}`;
    onPointSelect(fullId);
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

  return (
    <Box>
      {(level === 0 ? topic : parentTitle) && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            {level === 0 ? topic : parentTitle}
          </Typography>
          {renderPointPath()}
        </Box>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12}>
          {points.map((point) => (
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
                {isInvestigated(point.id) && point.detailedReport && (
                  <Box sx={{ mt: 2, ml: 2 }}>
                    <ReportPoints
                      points={point.detailedReport.points}
                      onPointSelect={onPointSelect}
                      selectedPointId={selectedPointId}
                      investigatedPoints={investigatedPoints}
                      loading={loading}
                      loadingPoints={loadingPoints}
                      level={level + 1}
                      parentPointId={point.id}
                      pointPath={[...pointPath, point.id]}
                      topic={point.detailedReport.topic}
                      parentTitle={point.title}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>
    </Box>
  );
}; 