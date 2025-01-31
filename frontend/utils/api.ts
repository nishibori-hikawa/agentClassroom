const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export const fetchReport = async (topic: string) => {
  const res = await fetch(`${BACKEND_URL}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch report');
  }
  return res.json();
};

export const fetchCritic = async (reportText: string) => {
  const res = await fetch(`${BACKEND_URL}/critic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_text: reportText }),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch critic points');
  }
  return res.json();
};

export const fetchTA = async (reportText: string, points: string[], additionalNote: string = '') => {
  const res = await fetch(`${BACKEND_URL}/ta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_text: reportText, points, additional_note: additionalNote }),
  });
  if (!res.ok) {
    throw new Error('Failed to fetch TA messages');
  }
  return res.json();
};
