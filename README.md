# 현장 일정 날씨판

오늘 현장 일정과 Open-Meteo에서 받은 지역별 날씨를 한 화면에서 보고, 날씨 때문에 주의 · 중지를 검토할 일정을 표시합니다. (교육용 가상 데이터)

## Supabase 설정 및 여는 법
1. Supabase SQL Editor에서 `setup.sql` 전체를 실행합니다. `public.wx_tasks` 표, 읽기·추가 RLS 정책, 허용 값 제약과 가상 일정 6건이 생성됩니다.
2. `config.js`의 두 줄에 프로젝트 URL과 공개용 publishable/anon 키를 입력합니다. `service_role` 비밀 키는 사용하지 마세요.
3. `index.html`을 더블클릭하거나 배포 주소에서 엽니다. Supabase에서 일정을 읽고, 추가 일정도 같은 표에 저장합니다.

공개용 키는 브라우저에 보입니다. SQL은 익명 방문자의 읽기와 일정 추가만 허용하고 수정·삭제는 허용하지 않습니다. 지역과 구분, 제목·담당 필수값은 DB 제약으로 확인합니다.
외부 스크립트는 Supabase의 `supabase-js` 하나만 사용합니다.

## 파일
| 파일 | 역할 |
|---|---|
| index.html | 화면 구조 |
| style.css | 디자인 |
| logic.js | 날씨 API 주소·응답 해석 및 판단 규칙 |
| app.js | 화면 동작 및 날씨 API 호출 |
| config.js | Supabase URL과 공개용 키 |
| setup.sql | wx_tasks 표·제약·RLS 정책·초기 일정 |
| api/kma.js | 지역별 DB 일정·KMA 날씨·판단 JSON API |
| PRD.md | 무엇을 · 왜 만드는지 |
| CLAUDE.md | AI가 지킬 작업 규칙 |
| .gitignore | GitHub에 올리지 않을 파일 목록 |

## 오늘 날씨
- Open-Meteo에서 세종 · 대전 · 태안 · 보령의 오늘 최고 기온, 최대 풍속(m/s), 강수확률을 불러옵니다.
- 날씨 API에 연결할 수 없어도 일정 목록은 표시되며, 실패한 지역의 일정은 '날씨 확인 전'으로 표시됩니다.
- `?test=wind`를 주소 끝에 붙이면 풍속을 12m/s로 적용해 고소 일정을 포함한 판단 규칙을 시험할 수 있습니다.
- '오늘 판단 md로 저장' 버튼을 누르면 현재 일정 표와 판단 기준을 `현장일정_판단_YYYY-MM-DD.md` 파일로 내려받습니다.

## 지역별 KMA API
- Vercel 환경변수 `kma_key`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 설정합니다. Supabase 키는 공개용 키만 사용하고 service role 키는 설정하지 마세요.
- `GET /api/kma?region=대전`처럼 호출하면 해당 지역의 Supabase 일정, KMA 오늘 최고기온·최대풍속·강수확률, 일정별 판단 결과를 JSON으로 반환합니다.
- 성공 응답은 `{ "region": "대전", "weather": { "tempMax": 0, "windMax": 0, "rainProb": 0 }, "tasks": [{ "id": "...", "title": "...", "region": "대전", "kind": "야외", "owner": "...", "weather": {}, "level": "ok", "decision": "진행" }] }` 형식입니다. 지역이 없거나 지원되지 않으면 400, upstream 연결에 실패하면 502를 반환합니다.
