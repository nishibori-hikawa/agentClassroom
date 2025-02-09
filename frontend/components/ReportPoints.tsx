import React from 'react';
import { Box, Card, CardContent, Typography, Button, Grid, Pagination, Divider, CircularProgress } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Source {
  name: string;
  url: string;
}

interface Point {
  id: string;
  title: string;
  content: string;
  source: Source;
}

interface ReportPointsProps {
  points: Point[];
  onPointSelect: (pointId: string) => void;
  selectedPointId?: string;
  initialPage?: number;
  investigatedPoints: Set<string>;
  showPaginationInCard?: string;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  loadingPointId?: string;
}

export const ReportPoints: React.FC<ReportPointsProps> = ({
  points,
  onPointSelect,
  selectedPointId,
  initialPage = 1,
  investigatedPoints,
  showPaginationInCard,
  onPageChange,
  loading = false,
  loadingPointId
}) => {
  const [page, setPage] = React.useState(initialPage);
  const pointsPerPage = 3;
  const totalPages = Math.ceil(points.length / pointsPerPage);

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    onPageChange?.(value);
  };

  // ページが変更されたときにonPageChangeを呼び出す
  React.useEffect(() => {
    onPageChange?.(page);
  }, [page, onPageChange]);

  const startIndex = (page - 1) * pointsPerPage;
  const displayedPoints = points.slice(startIndex, startIndex + pointsPerPage);

  const renderPagination = () => (
    <Box display="flex" justifyContent="center" mt={2} mb={2}>
      <Pagination
        count={totalPages}
        page={page}
        onChange={handlePageChange}
        color="primary"
        size="small"
      />
    </Box>
  );

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          {displayedPoints.map((point) => (
            <Card
              key={point.id}
              sx={{
                mb: 2,
                border: selectedPointId === point.id ? '2px solid #1976d2' : 'none',
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
                    variant={selectedPointId === point.id ? "contained" : "outlined"}
                    onClick={() => onPointSelect(point.id)}
                    disabled={investigatedPoints.has(point.id) || (loading && loadingPointId === point.id)}
                    sx={{ mt: 1, minWidth: '140px' }}
                  >
                    {loading && loadingPointId === point.id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} color="inherit" />
                        調査中...
                      </Box>
                    ) : investigatedPoints.has(point.id) ? (
                      '調査済み'
                    ) : (
                      '詳細を調査'
                    )}
                  </Button>
                  {showPaginationInCard === point.id && totalPages > 1 && renderPagination()}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>
    </Box>
  );
}; 