import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Link,
  Grid,
  Radio,
  Button,
  IconButton,
  Collapse
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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
}

export const ReportPoints: React.FC<ReportPointsProps> = ({ points, onPointSelect }) => {
  const [showSelection, setShowSelection] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);

  const handleInvestigate = (pointId: string) => {
    if (selectedPoint === pointId) {
      onPointSelect(pointId);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">トピック一覧</Typography>
        <Button
          variant="outlined"
          startIcon={<ExpandMoreIcon />}
          onClick={() => setShowSelection(!showSelection)}
        >
          深掘るトピックを選択
        </Button>
      </Box>

      <Collapse in={showSelection}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          深掘りしたいトピックを選択してください
        </Typography>
      </Collapse>

      <Grid container spacing={2}>
        {points.map((point) => (
          <Grid item xs={12} key={point.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {showSelection && (
                    <Radio
                      checked={selectedPoint === point.id}
                      onChange={() => setSelectedPoint(point.id)}
                      value={point.id}
                      name="point-radio"
                      sx={{ mr: 1 }}
                    />
                  )}
                  <Typography variant="h6" sx={{ flex: 1 }}>
                    {point.title}
                  </Typography>
                  <IconButton
                    onClick={() => handleInvestigate(point.id)}
                    disabled={!showSelection || selectedPoint !== point.id}
                    color="primary"
                    title="このトピックを深掘りする"
                  >
                    <SearchIcon />
                  </IconButton>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {point.content}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Link
                    href={point.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    underline="hover"
                    color="primary"
                    sx={{ fontSize: '0.875rem' }}
                  >
                    出典: {point.source.name}
                  </Link>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}; 