const { judge, WEATHER_LOCATIONS } = require('../logic.js');

const FORECAST_TIMES = ['0200', '0500', '0800', '1100', '1400', '1700', '2000', '2300'];

function koreaDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function getForecastBase(date) {
  const availableAt = new Date(date.getTime() - 10 * 60 * 1000);
  const parts = koreaDateParts(availableAt);
  const currentTime = parts.hour + parts.minute;
  const baseTime = [...FORECAST_TIMES].reverse().find(time => time <= currentTime);

  if (baseTime) {
    return { baseDate: parts.year + parts.month + parts.day, baseTime };
  }

  const previousDate = new Date(availableAt.getTime() - 24 * 60 * 60 * 1000);
  const previousParts = koreaDateParts(previousDate);
  return {
    baseDate: previousParts.year + previousParts.month + previousParts.day,
    baseTime: '2300',
  };
}

function toKmaGrid(latitude, longitude) {
  const earthRadius = 6371.00877;
  const gridSpacing = 5;
  const standardLatitude1 = 30 * Math.PI / 180;
  const standardLatitude2 = 60 * Math.PI / 180;
  const originLongitude = 126 * Math.PI / 180;
  const originLatitude = 38 * Math.PI / 180;
  const originX = 43;
  const originY = 136;
  const re = earthRadius / gridSpacing;
  const sn = Math.log(Math.cos(standardLatitude1) / Math.cos(standardLatitude2))
    / Math.log(Math.tan(Math.PI / 4 + standardLatitude2 / 2)
      / Math.tan(Math.PI / 4 + standardLatitude1 / 2));
  const sf = Math.tan(Math.PI / 4 + standardLatitude1 / 2) ** sn
    * Math.cos(standardLatitude1) / sn;
  const ro = re * sf / Math.tan(Math.PI / 4 + originLatitude / 2) ** sn;
  const ra = re * sf / Math.tan(Math.PI / 4 + latitude * Math.PI / 360) ** sn;
  let theta = longitude * Math.PI / 180 - originLongitude;

  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + originX + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + originY + 0.5),
  };
}

function parseForecast(items, date) {
  const todaysItems = items.filter(item => item.fcstDate === date);
  const maximumTemperature = todaysItems.find(item => item.category === 'TMX');
  const windSpeeds = todaysItems
    .filter(item => item.category === 'WSD')
    .map(item => Number(item.fcstValue))
    .filter(Number.isFinite);
  const rainProbabilities = todaysItems
    .filter(item => item.category === 'POP')
    .map(item => Number(item.fcstValue))
    .filter(Number.isFinite);

  if (!maximumTemperature || !Number.isFinite(Number(maximumTemperature.fcstValue))
    || !windSpeeds.length || !rainProbabilities.length) {
    throw new Error('오늘 예보에 필요한 최고기온, 풍속 또는 강수확률 자료가 없습니다.');
  }

  return {
    tempMax: Number(maximumTemperature.fcstValue),
    windMax: Math.max(...windSpeeds),
    rainProb: Math.max(...rainProbabilities),
  };
}

async function fetchKmaWeather(region, apiKey, today, now) {
  const location = WEATHER_LOCATIONS[region];
  const grid = toKmaGrid(location.latitude, location.longitude);
  const { baseDate, baseTime } = getForecastBase(now);
  const params = new URLSearchParams({
    serviceKey: decodeURIComponent(apiKey),
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  const response = await fetch(
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?' + params,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) throw new Error('KMA HTTP ' + response.status);

  const result = await response.json();
  const body = result.response && result.response.body;
  if (result.response && result.response.header
    && result.response.header.resultCode !== '00') {
    throw new Error('KMA API returned an error.');
  }
  if (!body || !body.items || !Array.isArray(body.items.item)) {
    throw new Error('KMA API returned an invalid forecast response.');
  }

  return parseForecast(body.items.item, today);
}

async function fetchRegionTasks(region, supabaseUrl, publishableKey) {
  const query = new URLSearchParams({
    select: 'id,title,region,kind,owner',
    region: 'eq.' + region,
    order: 'created_at.asc,id.asc',
  });
  const response = await fetch(
    supabaseUrl.replace(/\/$/, '') + '/rest/v1/wx_tasks?' + query,
    {
      headers: {
        apikey: publishableKey,
        Authorization: 'Bearer ' + publishableKey,
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!response.ok) throw new Error('Supabase HTTP ' + response.status);
  const tasks = await response.json();
  if (!Array.isArray(tasks)) throw new Error('Supabase returned an invalid task list.');
  return tasks;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const region = typeof req.query.region === 'string' ? req.query.region : '';
  if (!Object.hasOwn(WEATHER_LOCATIONS, region)) {
    return res.status(400).json({ error: 'invalid_region', allowed: Object.keys(WEATHER_LOCATIONS) });
  }

  const { KMA_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!KMA_KEY || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return res.status(500).json({ error: 'server_configuration_missing' });
  }

  try {
    const now = new Date();
    const todayParts = koreaDateParts(now);
    const today = todayParts.year + todayParts.month + todayParts.day;
    const [tasks, weather] = await Promise.all([
      fetchRegionTasks(region, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY),
      fetchKmaWeather(region, KMA_KEY, today, now),
    ]);
    const resultTasks = tasks.map(task => {
      const decision = judge(task.kind, weather);
      return {
        ...task,
        weather,
        decision: decision.text,
        level: decision.level,
      };
    });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300');
    return res.status(200).json({ region, weather, tasks: resultTasks });
  } catch (error) {
    console.error('KMA region API request failed:', error.message);
    return res.status(502).json({ error: 'weather_or_database_unavailable' });
  }
};
