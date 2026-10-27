// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

const WEATHER_LOCATIONS = {
  '세종': { latitude: 36.4801, longitude: 127.2886 },
  '대전': { latitude: 36.3504, longitude: 127.3845 },
  '태안': { latitude: 36.7456, longitude: 126.298 },
  '보령': { latitude: 36.3333, longitude: 126.6128 },
};

function buildWeatherUrl(region) {
  const location = WEATHER_LOCATIONS[region];
  if (!location) throw new Error('지원하지 않는 지역입니다: ' + region);

  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    daily: 'temperature_2m_max,wind_speed_10m_max,precipitation_probability_max',
    forecast_days: '1',
    timezone: 'Asia/Seoul',
    wind_speed_unit: 'ms',
    temperature_unit: 'celsius',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + params;
}

function parseWeatherResponse(data) {
  const daily = data && data.daily;
  const values = daily && [
    daily.temperature_2m_max && daily.temperature_2m_max[0],
    daily.wind_speed_10m_max && daily.wind_speed_10m_max[0],
    daily.precipitation_probability_max && daily.precipitation_probability_max[0],
  ];
  if (!values || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('날씨 응답에 오늘의 최고 기온, 최대 풍속 또는 강수확률이 없습니다.');
  }
  return { tempMax: values[0], windMax: values[1], rainProb: values[2] };
}

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

function buildJudgmentMarkdown(rows, date) {
  const escapeCell = value => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
  const lines = [
    '# 오늘 판단 (' + escapeCell(date) + ')',
    '',
    '| 일정 | 지역 | 구분 | 담당 | 날씨 | 판단 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => '| ' + [
      row.title,
      row.region,
      row.kind,
      row.owner,
      row.weather,
      row.decision,
    ].map(escapeCell).join(' | ') + ' |'),
    '',
    '판단 기준: 실내는 영향 없음, 고소 풍속 10m/s 이상은 중지 검토, 최고 기온 33℃ 이상은 폭염 휴식, 강수확률 60% 이상은 우천 주의 (복수 조건 시 강풍 → 폭염 → 우천 순).',
  ];
  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = {
    RULES,
    WEATHER_LOCATIONS,
    buildWeatherUrl,
    parseWeatherResponse,
    judge,
    buildJudgmentMarkdown,
  };
}
