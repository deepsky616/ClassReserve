# 구글 시트 저장 전환 구현 계획

> **에이전트 작업자 안내:** 필수 하위 기술은 `superpowers:subagent-driven-development` 권장 또는 `superpowers:executing-plans`입니다. 단계는 체크박스 문법으로 진행 상태를 추적합니다.

**목표:** 노드 서버 없이 정적 웹앱이 구글 앱스 스크립트를 통해 구글 시트에 예약을 저장하도록 바꾼다.

**구조:** 리액트 앱은 `VITE_GOOGLE_SCRIPT_URL` 환경값을 읽고 JSONP 방식으로 앱스 스크립트 웹앱을 호출한다. 앱스 스크립트는 구글 시트를 읽고 쓰며, 예약 중복과 삭제 비밀번호를 처리한다. 기존 노드 파일 저장 서버는 로컬 예비 구현으로 남기되, 기본 README는 구글 시트 방식을 중심으로 안내한다.

**기술:** 리액트, 바이트, 구글 앱스 스크립트, 구글 시트, 노드 기본 테스트 도구

---

## 파일 구조

- 생성: `google-apps-script/Code.gs` - 구글 시트 저장 API 전체 코드
- 생성: `google-apps-script/README.md` - 구글 시트와 앱스 스크립트 설정 방법
- 생성: `.env.example` - `VITE_GOOGLE_SCRIPT_URL` 예시
- 수정: `src/api.js` - `/api/reservations` 대신 JSONP 앱스 스크립트 호출
- 수정: `src/api.test.js` - JSONP 성공, 설정 누락, 오류 응답 테스트
- 수정: `src/App.jsx` - 설정 누락과 구글 시트 연결 오류 메시지
- 수정: `README.md` - 노드 서버 중심 안내를 구글 시트 중심 안내로 변경
- 수정: `docs/superpowers/specs/2026-06-10-google-sheets-storage-design.md` - POST 설계를 JSONP GET 설계로 조정

## 작업 1: JSONP 클라이언트 테스트

- [ ] `src/api.test.js`에 JSONP 스크립트 삽입 성공 테스트를 작성한다.
- [ ] `src/api.test.js`에 `VITE_GOOGLE_SCRIPT_URL`이 없을 때 `CONFIG_MISSING` 오류가 나는 테스트를 작성한다.
- [ ] `src/api.test.js`에 앱스 스크립트가 `{ ok:false, code:"DUPLICATE_RESERVATION" }`를 반환할 때 같은 코드로 오류가 나는 테스트를 작성한다.
- [ ] `node --test src/api.test.js`를 실행해 실패를 확인한다.
- [ ] `src/api.js`를 JSONP 클라이언트로 구현한다.
- [ ] `node --test src/api.test.js`를 실행해 통과를 확인한다.

## 작업 2: 화면 메시지와 환경값

- [ ] `src/App.jsx`의 메시지 매핑에 `CONFIG_MISSING`, `GOOGLE_SCRIPT_UNAVAILABLE`을 추가한다.
- [ ] `.env.example`에 `VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/배포식별값/exec`를 추가한다.
- [ ] `npm test`를 실행한다.
- [ ] `npm run build`를 실행한다.

## 작업 3: 앱스 스크립트 코드

- [ ] `google-apps-script/Code.gs`를 만든다.
- [ ] `doGet(e)`에서 `payload`와 `callback`을 읽는다.
- [ ] `action` 값이 `list`, `create`, `delete`인지 분기한다.
- [ ] `reservations` 시트를 읽고 쓴다.
- [ ] 같은 날짜, 교시, 특별실 중복 예약을 거부한다.
- [ ] 삭제 비밀번호를 앱스 스크립트 기본 유틸리티로 해시해 저장한다.
- [ ] 응답은 항상 `callback(JSON)` 형태의 자바스크립트로 돌려준다.

## 작업 4: 설정 문서

- [ ] `google-apps-script/README.md`에 구글 시트 생성, 열 이름 입력, 스크립트 붙여넣기, 배포, 환경값 설정 절차를 작성한다.
- [ ] `README.md`를 구글 시트 방식 중심으로 바꾼다.
- [ ] 기존 노드 서버는 예비 로컬 실행 방식으로만 문서화한다.

## 작업 5: 최종 검증과 푸시

- [ ] `npm test`를 실행해 모든 테스트를 통과시킨다.
- [ ] `npm run build`를 실행해 정적 배포 빌드를 확인한다.
- [ ] `npm audit --audit-level=critical`을 실행한다.
- [ ] 변경 내용을 커밋한다.
- [ ] `main`에 푸시한다.

## 완료 기준

- `npm test`가 통과한다.
- `npm run build`가 통과한다.
- `VITE_GOOGLE_SCRIPT_URL`이 없을 때 사용자가 설정 문제를 알 수 있다.
- `src/api.js`가 JSONP로 앱스 스크립트 웹앱을 호출한다.
- `google-apps-script/Code.gs`가 구글 시트에 예약 생성, 조회, 삭제를 처리한다.
- README만 보고 구글 시트 저장소를 만들고 앱을 연결할 수 있다.
