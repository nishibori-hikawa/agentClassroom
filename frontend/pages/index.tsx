import React from 'react';
import { Container, Box, Typography, Card, CardContent, Grid } from '@mui/material';
import DiscussionContainer from '../components/DiscussionContainer';

const IndexPage: React.FC = () => {
  return (
    <Container maxWidth="xl">
      <Box my={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          エージェント教室
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Reporter
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  トピックについて調査し、レポートを作成します。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Critic
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  レポートの内容を分析し、重要な論点を抽出します。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Teaching Assistant
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  ディスカッションをファシリテートし、学習をサポートします。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  探究の場
                </Typography>
                <DiscussionContainer />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default IndexPage;
