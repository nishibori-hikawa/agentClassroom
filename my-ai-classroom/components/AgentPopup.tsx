import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, LinearProgress, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useHotkeys } from 'react-hotkeys-hook';

interface AgentPopupProps {
  open: boolean;
  agent: string;
  onUserChoice: (choice: 'user' | 'agent') => void;
  currentStep: number;
  totalSteps: number;
  rememberChoice: boolean;
  onRememberChoiceChange: (remember: boolean) => void;
}

const AgentPopup: React.FC<AgentPopupProps> = ({ open, agent, onUserChoice, currentStep, totalSteps, rememberChoice, onRememberChoiceChange }) => {
  const theme = useTheme();

  useHotkeys('u', () => onUserChoice('user'), { enabled: open });
  useHotkeys('a', () => onUserChoice('agent'), { enabled: open });
  useHotkeys('enter', () => onUserChoice(rememberChoice ? 'agent' : 'user'), { enabled: open });

  return (
    <Dialog open={open}>
      <DialogTitle>{`${agent}のアクション`}</DialogTitle>
      <DialogContent>
        <p>{`${agent}がタスクを実行しますか？`}</p>
        <LinearProgress variant="determinate" value={(currentStep / totalSteps) * 100} />
      </DialogContent>
      <DialogActions>
        <Tooltip title="ユーザーが発言する場合はこちらを選択">
          <Button onClick={() => onUserChoice('user')} color="primary">
            ユーザーが発言
          </Button>
        </Tooltip>
        <Tooltip title="エージェントが生成する場合はこちらを選択">
          <Button onClick={() => onUserChoice('agent')} color="secondary">
            エージェント生成
          </Button>
        </Tooltip>
        <Tooltip title="次回からこの選択を記憶します">
          <Button onClick={() => onRememberChoiceChange(!rememberChoice)} color="primary">
            {rememberChoice ? '選択を記憶しない' : '選択を記憶する'}
          </Button>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

export default AgentPopup;
