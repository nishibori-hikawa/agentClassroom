import React from 'react';
import { Box, Card, CardContent, Typography, Grid, CircularProgress, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';

interface CriticPointsProps {
  points: Array<{
    title: string;
    content: string;
  }> | null;
  loading: boolean;
  onInvestigateCase?: (point: { title: string; content: string }, isYesCase: boolean) => void;
  loadingInvestigation: Set<string>;
  investigatedCases: Set<string>;
  onViewInvestigation?: () => void;
}

export const CriticPoints: React.FC<CriticPointsProps> = ({ 
  points, 
  loading, 
  onInvestigateCase,
  loadingInvestigation,
  investigatedCases,
  onViewInvestigation
}) => {
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

  const getButtonState = (point: { title: string; content: string }, isYes: boolean) => {
    const caseKey = `${point.title}_${isYes ? 'yes' : 'no'}`;
    if (loadingInvestigation.has(caseKey)) {
      return {
        content: <CircularProgress size={20} color="inherit" />,
        disabled: true,
        onClick: () => {}
      };
    }
    if (investigatedCases.has(caseKey)) {
      return {
        content: (
          <>
            <FormatListBulletedIcon />
            調査済み 3件
          </>
        ),
        disabled: false,
        onClick: () => onViewInvestigation?.()
      };
    }
    return {
      content: (
        <>
          <SearchIcon />
          {isYes ? 'Yesの事例調査' : 'Noの事例調査'}
        </>
      ),
      disabled: false,
      onClick: () => onInvestigateCase?.(point, isYes)
    };
  };

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
                  {[true, false].map((isYes) => {
                    const buttonState = getButtonState(point, isYes);
                    return (
                      <Button
                        key={isYes ? 'yes' : 'no'}
                        variant="outlined"
                        color={isYes ? "primary" : "secondary"}
                        size="small"
                        onClick={buttonState.onClick}
                        disabled={buttonState.disabled}
                        sx={{ 
                          minWidth: '140px',
                          display: 'flex',
                          gap: 1,
                          alignItems: 'center'
                        }}
                      >
                        {buttonState.content}
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
