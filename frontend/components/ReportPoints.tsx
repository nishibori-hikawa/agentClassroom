import React from 'react';
import { Box, Card, CardContent, Typography, Button, Grid, CircularProgress } from '@mui/material';
import { Point } from '../types/report';

interface ReportPointsProps {
  points: Point[];
  onPointSelect: (pointId: string) => void;
  selectedPointId?: string;
  investigatedPoints: Set<string>;
  loading?: boolean;
  loadingPointId?: string;
  level?: number;
  parentPointId?: string;
}

export const ReportPoints: React.FC<ReportPointsProps> = ({
  points,
  onPointSelect,
  selectedPointId,
  investigatedPoints,
  loading = false,
  loadingPointId,
  level = 0,
  parentPointId = 'root'
}) => {
  // 現在のレベルとparentPointIdのポイントIDのみをチェックするヘルパー関数
  const isInvestigated = (pointId: string) => {
    const fullId = `${level}_${parentPointId}_${pointId}`;
    return investigatedPoints.has(fullId);
  };

  const renderButtonContent = (point: Point) => {
    if (loadingPointId === point.id) {
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

  return (
    <Box>
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
                    disabled={loading || loadingPointId === point.id}
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
                      loadingPointId={loadingPointId}
                      level={level + 1}
                      parentPointId={point.id}
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