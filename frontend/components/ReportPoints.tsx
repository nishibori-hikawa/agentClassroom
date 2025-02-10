import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Grid, CircularProgress, Breadcrumbs, Pagination } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import SearchIcon from '@mui/icons-material/Search';
import { Point } from '../types/report';

interface ReportPointsProps {
  points: Point[];
  onPointSelect: (pointId: string) => void;
  onExtractPoints?: (point: { title: string; content: string; id: string }) => void;
  selectedPointId?: string;
  investigatedPoints: Set<string>;
  loading?: boolean;
  loadingPoints: Set<string>;
  loadingCriticPoints: Set<string>;
  level?: number;
  parentPointId?: string;
  pointPath?: PointPath[];
  topic?: string;
  parentTitle?: string;
  onBack?: () => void;
  extractedPoints?: Set<string>;
  onViewCriticPoints?: () => void;
}

interface ExpandedPoint {
  pointId: string;
  parentId: string;
  level: number;
  fullId: string;
}

interface PointPath {
  id: string;
  parentId: string;
  level: number;
}

const DEBUG = true; // デバッグモードフラグ

export const ReportPoints: React.FC<ReportPointsProps> = ({
  points,
  onPointSelect,
  onExtractPoints,
  selectedPointId,
  investigatedPoints,
  loading = false,
  loadingPoints,
  loadingCriticPoints,
  level = 0,
  parentPointId = 'root',
  pointPath = [],
  topic,
  parentTitle,
  onBack,
  extractedPoints = new Set(),
  onViewCriticPoints
}) => {
  const POINTS_PER_PAGE = 3;
  const [page, setPage] = useState(1);
  const [expandedPoint, setExpandedPoint] = useState<ExpandedPoint | null>(null);

  // ページネーション用のポイント配列を取得
  const paginatedPoints = points.slice((page - 1) * POINTS_PER_PAGE, page * POINTS_PER_PAGE);
  const totalPages = Math.ceil(points.length / POINTS_PER_PAGE);

  const getFullId = (pointId: string) => {
    return `${level}_${parentPointId}_${pointId}`;
  };

  const getCurrentPath = (pointId: string) => {
    return [...pointPath, { id: pointId, parentId: parentPointId, level }];
  };

  const getParentPointId = (currentLevel: number) => {
    if (currentLevel <= 0) return 'root';
    const parentPoint = pointPath[currentLevel - 1];
    return parentPoint ? parentPoint.id : 'root';
  };

  const isInvestigated = (pointId: string) => {
    return investigatedPoints.has(getFullId(pointId));
  };

  const isLoading = (pointId: string) => {
    return loadingPoints.has(getFullId(pointId));
  };

  const isExpanded = (pointId: string) => {
    return expandedPoint?.fullId === getFullId(pointId);
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
      if (isExpanded(point.id)) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArrowBackIcon />
            戻る
          </Box>
        );
      }
      const detailedPoints = point.detailedReport?.points?.length || 0;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormatListBulletedIcon />
          調査済み {detailedPoints}件
        </Box>
      );
    }
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SearchIcon />
        詳細を調査
      </Box>
    );
  };

  const handlePointSelect = (pointId: string) => {
    const fullId = getFullId(pointId);
    if (isInvestigated(pointId)) {
      if (isExpanded(pointId)) {
        setExpandedPoint(null);
      } else {
        const selectedPoint = points.find(p => p.id === pointId);
        if (selectedPoint?.detailedReport) {
          setExpandedPoint({
            pointId,
            parentId: parentPointId,
            level,
            fullId
          });
        }
      }
    } else {
      onPointSelect(fullId);
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    setExpandedPoint(null);
  };

  const handleBack = () => {
    if (expandedPoint) {
      setExpandedPoint(null);
    } else if (onBack) {
      onBack();
    }
  };

  const renderPointPath = () => {
    if (level === 0) return null;
    return (
      <Breadcrumbs aria-label="point path" sx={{ ml: 2 }}>
        {pointPath.map((pathItem, index) => (
          <Typography key={index} color="text.secondary">
            {`${pathItem.level + 1}-${pathItem.id}`}
          </Typography>
        ))}
      </Breadcrumbs>
    );
  };

  // 親コンポーネントからの更新時に展開状態をリセット
  React.useEffect(() => {
    if (expandedPoint) {
      const currentPoint = points.find(p => p.id === expandedPoint.pointId);
      if (!currentPoint?.detailedReport) {
        setExpandedPoint(null);
      }
    }
  }, [level, parentPointId, points, investigatedPoints, expandedPoint, pointPath]);

  // 展開されたポイントの詳細レポートを表示
  const renderExpandedPoint = () => {
    if (!expandedPoint) return null;

    const [_, __, pointId] = expandedPoint.fullId.split('_');
    const expandedPointData = points.find(p => p.id === pointId);

    if (!expandedPointData?.detailedReport) return null;

    const nextLevel = level + 1;
    const nextParentId = pointId;

    return (
      <ReportPoints
        points={expandedPointData.detailedReport.points}
        onPointSelect={onPointSelect}
        onExtractPoints={onExtractPoints}
        selectedPointId={selectedPointId}
        investigatedPoints={investigatedPoints}
        loading={loading}
        loadingPoints={loadingPoints}
        loadingCriticPoints={loadingCriticPoints}
        level={nextLevel}
        parentPointId={nextParentId}
        pointPath={getCurrentPath(pointId)}
        topic={expandedPointData.detailedReport.topic}
        parentTitle={expandedPointData.title}
        onBack={handleBack}
        extractedPoints={extractedPoints}
        onViewCriticPoints={onViewCriticPoints}
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

  if (expandedPoint) {
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6">
                    {point.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      onClick={() => onExtractPoints?.({ 
                        title: point.title, 
                        content: point.content,
                        id: getFullId(point.id)
                      })}
                      disabled={loading || loadingCriticPoints.has(getFullId(point.id)) || extractedPoints.has(getFullId(point.id))}
                      sx={{ 
                        mt: 1,
                        position: 'relative',
                        minWidth: '100px'
                      }}
                    >
                      {loadingCriticPoints.has(getFullId(point.id)) ? (
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CircularProgress size={20} color="inherit" />
                        </Box>
                      ) : extractedPoints.has(getFullId(point.id)) ? (
                        '抽出済み 3件'
                      ) : (
                        '論点抽出'
                      )}
                    </Button>
                    {extractedPoints.has(getFullId(point.id)) && (
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        onClick={() => onViewCriticPoints?.()}
                        sx={{ mt: 1 }}
                      >
                        論点を確認
                      </Button>
                    )}
                  </Box>
                </Box>
                <Typography variant="body1" paragraph>
                  {point.content}
                </Typography>
                {point.source && (
                  <Typography variant="body2" color="text.secondary">
                    出典: <a href={point.source.url} target="_blank" rel="noopener noreferrer">{point.source.name}</a>
                  </Typography>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {level === 0 && (
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
                  )}
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