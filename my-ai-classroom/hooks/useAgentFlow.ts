import { useState } from 'react';

type Agent = 'writer' | 'reporter' | 'critic' | 'ta';

interface AgentStep {
  agent: Agent;
  action: () => Promise<string>;
}

const useAgentFlow = () => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [results, setResults] = useState<Record<Agent, string>>({});

  const initializeSteps = (topic: string) => {
    const agentSteps: AgentStep[] = [
      {
        agent: 'writer',
        action: async () => {
          const response = await fetch('/api/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic }),
          });
          const data = await response.json();
          return data.blog;
        },
      },
      {
        agent: 'reporter',
        action: async () => {
          const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic }),
          });
          const data = await response.json();
          return data.report;
        },
      },
      {
        agent: 'critic',
        action: async () => {
          const report = results['reporter'];
          const response = await fetch('/api/critic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report_text: report }),
          });
          const data = await response.json();
          return data.points.join('; ');
        },
      },
      {
        agent: 'ta',
        action: async () => {
          const report = results['reporter'];
          const points = results['critic'].split('; ');
          const response = await fetch('/api/ta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report_text: report, points, additional_note: '' }),
          });
          const data = await response.json();
          return data.ta_message;
        },
      },
    ];
    setSteps(agentSteps);
    setCurrentStep(0);
    setResults({});
  };

  const executeCurrentStep = async () => {
    if (currentStep >= steps.length) return;
    const step = steps[currentStep];
    const result = await step.action();
    setResults((prev) => ({ ...prev, [step.agent]: result }));
    setCurrentStep((prev) => prev + 1);
  };

  return {
    initializeSteps,
    executeCurrentStep,
    currentStep,
    steps,
    results,
  };
};

export default useAgentFlow;
