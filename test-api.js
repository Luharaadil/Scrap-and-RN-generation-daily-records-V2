const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwgP4jhdt0rom8RB3r3yvc42Xg-kgB4FgJ2DQTVOFHTir1g6mVFjCAMW5BB0dpbFbSARg/exec';

async function test() {
  const response = await fetch(`${WEB_APP_URL}?action=getData&date=2024-05-01`);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
