import React from 'react';
import { Box, Card, CardContent, Typography, Grid, CircularProgress, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface CriticPointsProps {
  points: Array<{
    title: string;
    content: string;
  }> | null;
  loading: boolean;
  onInvestigateCase?: (point: { title: string; content: string }, isYesCase: boolean) => void;
}

export const CriticPoints: React.FC<CriticPointsProps> = ({ points, loading, onInvestigateCase }) => {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!points || points.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            論点が抽出されていません
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={2}>
      {points.map((point, index) => (
        <Grid item xs={12} key={index}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {point.title}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {point.content}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<SearchIcon />}
                    onClick={() => onInvestigateCase?.(point, true)}
                  >
                    Yesの事例調査
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    startIcon={<SearchIcon />}
                    onClick={() => onInvestigateCase?.(point, false)}
                  >
                    Noの事例調査
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
