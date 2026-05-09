const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwgP4jhdt0rom8RB3r3yvc42Xg-kgB4FgJ2DQTVOFHTir1g6mVFjCAMW5BB0dpbFbSARg/exec';

export const getWebAppUrl = () => WEB_APP_URL;

export const fetchSummaryAndScraps = async (date: string) => {
  try {
    const response = await fetch(`${WEB_APP_URL}?action=getData&date=${date}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fetch error:', response.status, errorText);
      throw new Error(`Network response was not ok: ${response.status} ${errorText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
};

export const fetchRangeData = async (startDate: string, endDate: string) => {
  try {
    const response = await fetch(`${WEB_APP_URL}?action=getRangeData&startDate=${startDate}&endDate=${endDate}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fetch error:', response.status, errorText);
      throw new Error(`Network response was not ok: ${response.status} ${errorText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
};

export const fetchTargets = async () => {
  try {
    const response = await fetch(`${WEB_APP_URL}?action=getTargets`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Network response was not ok: ${response.status} ${errorText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Fetch targets failed:', error);
    throw error;
  }
};

export const saveProductionSummary = async (data: any) => {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'saveSummary',
      ...data
    })
  });
  
  return response.json();
};

export const saveScrapDetails = async (data: any) => {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'saveScrap',
      ...data
    })
  });
  
  return response.json();
};

export const saveTargets = async (targets: any) => {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'saveTargets',
      targets: targets
    })
  });
  
  return response.json();
};

export const updateScrapReason = async (timestamp: string, newReason: string) => {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'updateScrapReason',
      timestamp,
      reason: newReason
    })
  });
  
  return response.json();
};
