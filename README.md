# 취준 도우미

취업 준비 전 과정을 한 곳에서 처리하는 로컬 웹앱. 자기소개서·이력서 작성부터 모의면접,
인적성 오답노트까지 AI 지원을 받으면서, **데이터는 외부 서버로 보내지 않고 브라우저에만** 둔다.

내 PC에서 실행되고, AI 호출만 Anthropic / Google API로 나간다. 회원가입이나 백엔드 서버가 없다.

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| **스펙 관리** | 기본정보·경험·목표를 한 번 입력해두고 모든 기능에서 재사용 |
| **경험 자동 정리** | 두서없이 적은 경험을 구조화해 재구성 |
| **이력서 / 자기소개서** | 공고별 맞춤 생성, 스트리밍 출력, 이력 5건까지 보관 |
| **기업 정보 조사** | 공고 기반으로 기업 정보를 정리 |
| **면접 예상 질문** | 공고·스펙 기반 질문 생성 |
| **모의면접 (텍스트)** | 1차/2차 면접을 구분해 실시간 대화로 진행, 종료 후 피드백 |
| **모의면접 (음성)** | 질문을 음성으로 듣고 말로 답변. 답변 내용과 **발화 품질**(속도·명확도)을 함께 분석 |
| **인적성 오답노트** | 문제를 이미지/텍스트로 저장, AI 풀이, 기업 → 영역 2단계 폴더로 관리 |
| **교차 검증** | Claude 결과를 Gemini로 한 번 더 검토 |
| **데이터 백업** | 전체 데이터를 JSON 파일로 내보내기 / 되돌리기 |

---

## 시작하기

### Windows — 바로가기 실행 (권장)

`start.bat`을 더블클릭하면 끝난다.

```
start.bat            업데이트 확인 후 실행
start.bat rebuild    강제 재빌드
start.bat noupdate   업데이트 확인 생략
```

이 스크립트가 알아서 하는 일:

- 처음이면 `npm install` + `npm run build`
- GitHub에 새 커밋이 있으면 **변경 내용을 보여주고 적용할지 물어본다**
- 소스가 마지막 빌드보다 새로우면 자동 재빌드
- 포트 3000을 쓰던 이전 프로세스 정리
- 서버를 띄우고 브라우저를 자동으로 연다

cmd 창이 곧 서버다. **창을 닫으면 서버가 멈춘다.**

바탕화면 바로가기를 만들려면 `start.bat` 우클릭 → 바로 가기 만들기.

### 그 외 환경 / 수동 실행

```bash
npm install
npm run build
npm run start      # http://localhost:3000
```

개발 중에는 `npm run dev`.

---

## API 키

앱 화면 하단 **API 키 설정**에서 입력한다. 브라우저 localStorage에만 저장되며 서버로 보관되지 않는다.

| 키 | 용도 | 발급 |
|---|---|---|
| Anthropic | 대부분의 기능 | https://console.anthropic.com/settings/keys |
| Gemini | 교차검증, 음성 분석, 인적성 2차 풀이 | https://aistudio.google.com/apikey |

Gemini 키는 없어도 되고, 그 경우 관련 기능만 비활성화된다.

환경변수 `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`가 설정돼 있으면 화면 입력을 생략할 수 있다.

> 키를 붙여넣을 때 딸려오는 공백·개행은 자동으로 제거된다. 그래도 `401 authentication_error`가
> 나면 키 자체가 무효인 경우이므로 콘솔에서 상태를 확인할 것.

---

## 데이터 저장과 백업

**모든 데이터는 브라우저 localStorage에만 저장된다.** 서버도 DB도 없다.

이 때문에 다음 상황에서 데이터가 보이지 않거나 사라진다.

- 브라우저의 **"쿠키 및 기타 사이트 데이터 삭제"** → **전부 소실된다**
- 다른 브라우저 / 다른 프로필(구글 계정)로 접속 → 별개의 저장 공간
- `localhost:3000`과 `127.0.0.1:3000` → 서로 다른 출처로 취급되어 데이터가 갈린다

그래서 **💾 데이터 백업** 섹션에서 주기적으로 내보내 두는 것을 권장한다.
`불러오기`로 다른 브라우저·PC로 옮길 수도 있다.

- API 키는 기본적으로 백업에 포함되지 않는다 (체크박스로 포함 선택 가능)
- 잘못된 파일을 넣으면 거부되고 기존 데이터는 보존된다
- localStorage 한계는 약 5MB. 인적성 문제 이미지가 용량 대부분을 차지하므로
  섹션 우측의 사용량 표시를 참고할 것

---

## 기술 스택

- **Next.js 16** (App Router) — UI와 API 라우트를 한 프로젝트에서 운용
- **React 19** / **TypeScript 5**
- **Tailwind CSS 4** (+ typography 플러그인)
- **@anthropic-ai/sdk**, **@google/generative-ai**
- **react-markdown** — AI 응답의 마크다운 렌더링
- 브라우저 내장 **Web Speech API**(음성 출력) / **MediaRecorder**(녹음)

AI 응답은 전부 스트리밍으로 받아 생성 중에도 화면에 표시된다.

### 기능별 사용 모델

| 라우트 | 모델 |
|---|---|
| `generate-company-info`, `generate-question-bank`, `interview-feedback` | `claude-opus-4-7` |
| `generate-resume`, `generate-cover-letter`, `organize-experience`, `revise`, `interview-questions`, `interview-session`, `solve-aptitude` | `claude-sonnet-4-6` |
| `verify-with-gemini`, `analyze-voice`, `solve-aptitude-gemini` | `gemini-2.5-flash` |

품질이 결과를 좌우하는 곳(기업 조사, 질문 은행, 최종 피드백)에만 Opus를 쓰고,
분량이 많거나 반복 호출되는 곳은 Sonnet으로 비용을 낮췄다.

---

## 프로젝트 구조

```
app/
  api/               AI 호출 라우트 (스트리밍 응답)
  page.tsx           온보딩 완료 여부로 온보딩/대시보드 분기
components/          화면 단위 컴포넌트
  steps/             온보딩 4단계
lib/
  store.ts           스펙·공고 저장 (localStorage)
  aptitude-store.ts  인적성 폴더·노트 저장
  backup.ts          전체 백업 / 복원
  claude.ts          Anthropic 클라이언트, 프롬프트 컨텍스트 조립
  api-key.ts         API 키 공백 정규화
types/user.ts        공용 타입
start.bat            Windows 실행 스크립트
```

---

## 알려진 제약

- 데이터가 기기 하나에 묶인다. 다른 PC에서 이어서 쓰려면 백업 파일로 옮겨야 한다
- 모의면접은 대화가 길어질수록 이전 내용을 매번 함께 보내므로 토큰 비용이 누적된다
- 음성 면접의 음질은 브라우저 내장 TTS에 의존해 환경마다 편차가 있다 (Chrome 권장)
- `start.bat`의 자동 업데이트는 저장소에 푸시된 코드를 그대로 실행한다.
  GitHub 계정에 2단계 인증을 걸어둘 것
