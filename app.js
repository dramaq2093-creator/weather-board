// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};
let tasksLoaded = false;
let supabaseClient = null;

const today = new Date();
document.getElementById('todayDate').textContent = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');

async function loadTasks() {
  const message = document.getElementById('dataMessage');
  try {
    const { data, error } = await supabaseClient
      .from('wx_tasks')
      .select('id, title, region, kind, owner')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    tasks = data;
    tasksLoaded = true;
    renderTasks();
    return true;
  } catch (error) {
    console.error('Supabase에서 일정을 읽지 못했습니다.', error);
    tasks = [];
    renderTasks();
    message.hidden = false;
    message.textContent = 'Supabase 일정 조회에 실패했습니다. 설정과 setup.sql 실행 여부를 확인해 주세요.';
    document.getElementById('weatherBox').textContent = '일정 데이터를 읽지 못해 날씨를 불러오지 않았습니다.';
    return false;
  }
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function loadWeather() {
  const weatherBox = document.getElementById('weatherBox');
  const testWind = new URLSearchParams(window.location.search).get('test') === 'wind';
  weatherBox.textContent = '지역별 오늘 날씨를 불러오는 중입니다.';

  const results = await Promise.allSettled(
    Object.keys(WEATHER_LOCATIONS).map(async region => {
      const response = await fetch(buildWeatherUrl(region));
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const weather = parseWeatherResponse(await response.json());
      if (testWind) weather.windMax = 12;
      weatherByRegion[region] = weather;
    })
  );

  const failedRegions = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const region = Object.keys(WEATHER_LOCATIONS)[index];
      failedRegions.push(region);
      console.error(region + ' 날씨를 불러오지 못했습니다.', result.reason);
    }
  });

  renderTasks();
  if (failedRegions.length) {
    weatherBox.textContent = '날씨를 불러오지 못한 지역: ' + failedRegions.join(', ')
      + '. 해당 일정은 날씨 확인 전으로 표시됩니다.';
  } else {
    weatherBox.textContent = testWind
      ? '지역별 오늘 날씨를 불러왔습니다. 풍속 시험 모드(12m/s)가 적용되었습니다.'
      : '지역별 오늘 날씨를 불러왔습니다.';
  }
}

function addTask(e) {
  e.preventDefault();
  saveTask(e.currentTarget);
}

async function saveTask(form) {
  const message = document.getElementById('dataMessage');
  if (!tasksLoaded) {
    message.hidden = false;
    message.textContent = '일정 목록을 불러온 뒤 다시 시도해 주세요.';
    return;
  }

  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  try {
    const { data, error } = await supabaseClient
      .from('wx_tasks')
      .insert(t)
      .select('id, title, region, kind, owner')
      .single();
    if (error) throw error;
    tasks.push(data);
    form.reset();
    message.hidden = true;
    renderTasks();
  } catch (error) {
    console.error('Supabase에 일정을 저장하지 못했습니다.', error);
    message.hidden = false;
    message.textContent = '일정을 저장하지 못했습니다. Supabase 연결과 입력값을 확인해 주세요.';
  }
}

function saveJudgmentMarkdown() {
  if (!tasksLoaded) {
    const message = document.getElementById('dataMessage');
    message.hidden = false;
    message.textContent = '일정 데이터를 읽지 못해 판단 파일을 저장할 수 없습니다.';
    return;
  }

  const date = document.getElementById('todayDate').textContent;
  const rows = tasks.map(task => {
    const weather = weatherByRegion[task.region];
    return {
      title: task.title,
      region: task.region,
      kind: task.kind,
      owner: task.owner,
      weather: weatherText(weather),
      decision: judge(task.kind, weather).text,
    };
  });
  const markdown = buildJudgmentMarkdown(rows, date);
  const file = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = '현장일정_판단_' + date + '.md';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

document.getElementById('taskForm').addEventListener('submit', addTask);
document.getElementById('saveJudgmentButton').addEventListener('click', saveJudgmentMarkdown);

async function startApp() {
  const message = document.getElementById('dataMessage');
  if (!SUPABASE_URL.startsWith('https://') || SUPABASE_URL.includes('YOUR_PROJECT_ID')
    || SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE_')) {
    message.hidden = false;
    message.textContent = 'config.js에 Supabase 주소와 공개용 키를 설정해 주세요.';
    document.getElementById('weatherBox').textContent = 'Supabase 설정 후 일정을 불러올 수 있습니다.';
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    message.hidden = false;
    message.textContent = 'supabase-js를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.';
    document.getElementById('weatherBox').textContent = 'Supabase 연결 라이브러리를 불러오지 못했습니다.';
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  } catch (error) {
    console.error('Supabase 클라이언트를 초기화하지 못했습니다.', error);
    message.hidden = false;
    message.textContent = 'Supabase 설정을 확인해 주세요.';
    document.getElementById('weatherBox').textContent = 'Supabase 설정을 확인할 수 없습니다.';
    return;
  }
  if (await loadTasks()) loadWeather();
}

startApp();
