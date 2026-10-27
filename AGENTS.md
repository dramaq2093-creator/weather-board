# AGENTS.md – 현장 일정 날씨판 작업 규칙

> Codex용 규칙 파일입니다. CLAUDE.md와 내용이 같습니다. 한쪽을 고치면 다른 쪽도 같이 고칩니다.

## 프로젝트 개요
- 교육용 프로토타입이다. 무엇을 만들지는 PRD.md를 따른다.
- PRD.md에 없는 기능은 먼저 제안하고, 내가 승인한 뒤에만 구현한다.

## 기술 스택 (변경 금지)
- HTML + CSS + 순수 JavaScript만 사용한다. (React 등 프레임워크, 빌드 도구 사용 금지)
- index.html 을 더블클릭해서 열 수 있어야 한다.

## 폴더 구조
- index.html : 화면 구조
- style.css  : 디자인
- logic.js   : 판단 규칙만 (화면을 다루는 코드 금지)
- app.js     : 화면 동작 (Supabase 일정 읽기·추가, 목록 그리기)
- config.js  : Supabase 주소와 공개용 키 두 줄
- setup.sql  : Supabase wx_tasks 표와 제약·정책 설정
- PRD.md · AGENTS.md · CLAUDE.md · README.md : 문서

## 작업 방식
1. 코드를 고치기 전에 계획(수정할 파일과 이유)을 먼저 보여 주고 승인을 받는다.
2. 한 번에 한 가지만 고친다.
3. 끝나면 바꾼 파일, 내가 확인할 방법(T-번호), 남은 문제를 보고한다.

## 보안 · 데이터 규칙
- 가상 데이터만 사용한다. 실제 이름 · 연락처 · 기관 내부 자료를 넣지 않는다.
- 사용자가 입력한 글자는 textContent 로 표시한다.
- 비밀 키는 코드 · 채팅 · GitHub 에 넣지 않는다.
- 일정은 Supabase wx_tasks 표에서 읽고 추가한다. 브라우저 저장소를 일정 저장소로 사용하지 않는다.
- config.js에는 Supabase 주소와 공개용 키만 둔다. 비밀 키(service_role)는 절대 사용하지 않는다.
- Supabase 공개용 키는 브라우저에 노출되므로 권한은 RLS 정책으로 제한하고, 구분·지역 규칙은 DB 제약으로도 검사한다.
- CLAUDE.md를 고치면 AGENTS.md도 함께 고친다.
