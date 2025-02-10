import React from 'react';
import { Box, Card, CardContent, Typography, List, ListItem, ListItemText, CircularProgress } from '@mui/material';

interface CriticPointsProps {
  points: Array<{
    title: string;
    content: string;
  }> | null;
  loading: boolean;
}

export const CriticPoints: React.FC<CriticPointsProps> = ({ points, loading }) => {
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
    <Card>
      <CardContent>
        <Typography variant="h6" component="h3" gutterBottom>
          抽出された論点
        </Typography>
        <List>
          {points.map((point, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={point.title}
                secondary={point.content}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};
