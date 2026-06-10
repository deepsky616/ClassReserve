# 특별실 예약 웹앱 구현 계획

> 에이전트 작업자 안내: 필수 하위 기술은 `superpowers:subagent-driven-development` 권장 또는 `superpowers:executing-plans`입니다. 이 계획은 체크박스 문법으로 작업 진행을 추적합니다.

**목표:** 교시 단위 특별실 예약을 누구나 조회하고 간편하게 추가, 삭제할 수 있는 웹앱을 만든다.

**구조:** 한 저장소 안에 리액트 화면과 노드 서버를 함께 둔다. 서버는 예약 자료를 `data/reservations.json`에 저장하고, 화면은 주간 시간표와 예약 입력 폼을 제공한다.

**기술:** 리액트, 바이트, 노드, 익스프레스, 노드 기본 테스트 도구, 파일 기반 저장

---

## 파일 구조

- 생성: `package.json` - 실행 명령, 의존성, 테스트 명령
- 생성: `index.html` - 화면 진입점
- 생성: `src/main.jsx` - 리액트 진입점
- 생성: `src/App.jsx` - 주간 예약 화면, 입력 폼, 삭제 흐름
- 생성: `src/styles.css` - 학교 업무용 화면 스타일
- 생성: `src/constants.js` - 특별실, 교시, 학년, 반 설정
- 생성: `src/dateUtils.js` - 주 계산과 날짜 표시 도우미
- 생성: `src/api.js` - 화면에서 서버와 통신하는 함수
- 생성: `server/index.js` - 익스프레스 서버 시작점
- 생성: `server/reservationStore.js` - 파일 저장, 중복 검사, 비밀번호 확인
- 생성: `server/reservationRoutes.js` - 예약 조회, 생성, 삭제 요청 처리
- 생성: `server/password.js` - 삭제 비밀번호 확인값 생성과 비교
- 생성: `server/reservationStore.test.js` - 저장소 단위 테스트
- 생성: `server/reservationRoutes.test.js` - 요청 처리 테스트
- 생성: `data/reservations.json` - 초기 예약 자료
- 생성: `.gitignore` - 의존성, 빌드 결과, 환경 파일 제외
- 생성: `README.md` - 실행 방법과 기능 설명

## 작업 1: 프로젝트 기본 골격

- [ ] `package.json`, `index.html`, `.gitignore`, `data/reservations.json`을 만든다.
- [ ] `npm install`을 실행해 의존성을 설치한다.
- [ ] `npm test`가 테스트 파일 없음 상태에서 실패하지 않도록 테스트 파일을 작업 2에서 바로 추가한다.
- [ ] 커밋한다.

기본 `package.json`은 다음 스크립트를 포함한다.

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "vite --host 0.0.0.0",
    "dev:server": "node server/index.js",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "node --test server/*.test.js"
  }
}
```

## 작업 2: 서버 저장소 테스트와 구현

- [ ] `server/password.js`를 만든다. `createPasswordHash(password)`와 `verifyPassword(password, hash)`를 내보낸다.
- [ ] `server/reservationStore.test.js`에 예약 생성, 중복 거부, 조회에서 비밀번호 제외, 삭제 성공, 삭제 실패 테스트를 작성한다.
- [ ] `npm test`를 실행해 실패를 확인한다.
- [ ] `server/reservationStore.js`를 구현한다.
- [ ] `npm test`를 실행해 통과를 확인한다.
- [ ] 커밋한다.

핵심 저장소 인터페이스는 다음 이름을 사용한다.

```js
export function createReservationStore(options)
```

반환 객체는 다음 함수를 가진다.

```js
{
  listReservations,
  createReservation,
  deleteReservation
}
```

## 작업 3: 서버 요청 처리 테스트와 구현

- [ ] `server/reservationRoutes.test.js`에 예약 목록 조회, 예약 생성, 중복 예약, 삭제 비밀번호 실패 테스트를 작성한다.
- [ ] `npm test`를 실행해 실패를 확인한다.
- [ ] `server/reservationRoutes.js`를 구현한다.
- [ ] `server/index.js`를 구현한다.
- [ ] `npm test`를 실행해 통과를 확인한다.
- [ ] 커밋한다.

요청 경로는 다음을 사용한다.

```txt
GET /api/reservations
POST /api/reservations
DELETE /api/reservations/:id
```

## 작업 4: 화면 자료와 날짜 도우미

- [ ] `src/constants.js`에 특별실, 교시, 학년, 반 목록을 만든다.
- [ ] `src/dateUtils.js`에 이번 주 월요일 계산, 주 날짜 배열 생성, 날짜 문자열 생성 함수를 만든다.
- [ ] `src/api.js`에 예약 목록 조회, 예약 생성, 예약 삭제 함수를 만든다.
- [ ] `npm run build`를 실행해 모듈 문법 오류가 없는지 확인한다.
- [ ] 커밋한다.

## 작업 5: 주간 예약 화면 구현

- [ ] `src/main.jsx`와 `src/App.jsx`를 만든다.
- [ ] 이번 주 예약표, 이전 주, 이번 주, 다음 주, 특별실 필터를 구현한다.
- [ ] 예약 입력 폼을 구현한다.
- [ ] 예약 삭제 흐름을 구현한다.
- [ ] 성공, 중복, 입력 누락, 삭제 실패 메시지를 구현한다.
- [ ] `src/styles.css`를 작성한다.
- [ ] `npm run build`를 실행해 통과를 확인한다.
- [ ] 커밋한다.

## 작업 6: 통합 확인과 문서화

- [ ] `README.md`에 설치, 실행, 사용 방법을 작성한다.
- [ ] `npm test`를 실행한다.
- [ ] `npm run build`를 실행한다.
- [ ] 개발 서버를 실행하고 화면을 브라우저에서 확인한다.
- [ ] 예약 생성, 중복 방지, 삭제 성공, 삭제 실패, 필터, 주 이동을 확인한다.
- [ ] 커밋한다.

## 완료 기준

- `npm test`가 통과한다.
- `npm run build`가 통과한다.
- 앱 첫 화면에서 이번 주 예약표가 보인다.
- 예약 생성과 삭제가 서버 파일 저장을 통해 동작한다.
- 같은 날짜, 같은 교시, 같은 특별실 중복 예약이 거부된다.
- 목록 조회 응답에 삭제 비밀번호가 포함되지 않는다.
- 특별실 필터와 주 이동이 동작한다.
