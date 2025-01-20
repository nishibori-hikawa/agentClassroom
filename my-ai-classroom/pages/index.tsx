import React from 'react';
import { Container, Box, Typography, Grid, Card, CardContent } from '@mui/material';
import ReportForm from '../components/ReportForm';
import CriticPoints from '../components/CriticPoints';
import TAMessages from '../components/TAMessages';

const IndexPage: React.FC = () => {
  return (
    <Container>
      <Box my={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          AI Classroom
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2">
                  Report Form
                </Typography>
                <ReportForm />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2">
                  Critic Points
                </Typography>
                <CriticPoints />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2">
                  TA Messages
                </Typography>
                <TAMessages />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default IndexPage;
