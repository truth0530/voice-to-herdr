# voice-to-herdr

[herdr](https://herdr.dev) 안에서 돌고 있는 코딩 에이전트(Claude Code, Codex 등)를 **Claude 앱 음성 통화**로
확인하고 지시할 수 있게 해 주는 Claude 스킬과 작은 MCP 서버입니다. 맥과 윈도우에서 동작합니다.

```
Claude 앱(음성) → Tailscale Funnel(https) → 내 컴퓨터 127.0.0.1 의 MCP 서버 → herdr CLI → 에이전트
```

음성으로 할 수 있는 것:
- `standup` — 모든 에이전트의 상태(승인 대기·작업 중·완료·대기) 요약
- `read_agent` — 한 에이전트의 최근 터미널 화면 읽기
- `prompt_agent` — 한 에이전트에 지시 보내기(기본 꺼짐, 설정으로 켬)

## 쓰는 법

Claude Code 같은 에이전트에게 이렇게 말하면 됩니다.

> 이 저장소의 SKILL.md를 읽고 그대로 따라 해서 내 컴퓨터의 herdr를 Claude 음성에 연결해 줘: https://github.com/truth0530/voice-to-herdr

또는 스킬로 설치:
```sh
git clone https://github.com/truth0530/voice-to-herdr ~/.claude/skills/voice-to-herdr
```
그 뒤 "herdr를 Claude 음성에 연결해 줘"라고 하면 Claude가 [SKILL.md](SKILL.md)를 따라 서버 설치, 서비스 등록,
Tailscale Funnel 설정까지 하고, 로그인·권한 허용·커넥터 등록처럼 사용자가 직접 눌러야 하는 단계는 자세히 안내합니다.

막히면 [references/troubleshooting.md](references/troubleshooting.md)를 보세요(컴퓨터 이전 후 주소 변경, Funnel 권한, 포트 충돌, 윈도우 등).

## 준비물
- herdr가 설치된 맥 또는 윈도우 PC
- Node.js 20 이상
- Tailscale 계정(무료 개인 플랜으로 충분)
- Claude 계정(Free는 커스텀 커넥터 1개까지, Pro·Max·Team·Enterprise 가능)
- **Funnel은 443으로 열어야 합니다.** claude.ai 커넥터는 포트가 붙은 주소(`:8443` 등)에 연결하지 못합니다(Anthropic 문서).
  443을 이미 다른 서비스가 쓰고 있으면 그 서비스를 다른 방법으로 옮기거나(다른 기기의 443 등) 하나만 선택해야 합니다.

## 보안
- 서버는 127.0.0.1에만 열리고, 바깥에서는 Funnel 주소 + 64자 토큰 경로로만 들어올 수 있습니다.
- 커넥터 주소(`.../mcp/<토큰>`)는 비밀번호처럼 다루세요. 새면 `node setup-config.mjs --new-token`으로 바꾸고 다시 등록합니다.
- 지시 보내기(`allowPrompt`)는 기본 꺼짐입니다. 셸 실행, 키 입력(제어 문자는 지움), 승인 응답, pane 닫기 기능은 일부러 넣지 않았습니다.
- Team/Enterprise의 조직 커넥터로 등록하면 조직의 다른 멤버도 내 에이전트를 볼 수 있습니다. 개인 계정에 등록하세요.
- 에이전트 화면과 제목은 신뢰할 수 없는 글로 표시해 Claude에 넘깁니다.
- 로그에는 토큰·지시 문장·터미널 출력을 남기지 않습니다.
- 윈도우에서는 설정 파일(`%APPDATA%\voice-to-herdr\config.json`, 토큰이 들어 있음)의 권한을 `setup-config.mjs`가
  현재 계정만 읽고 쓰게 좁힙니다(윈도우는 폴더 상속 권한이 기본이라 다른 계정에도 열려 있을 수 있습니다). 경고가 나오면 안내된 `icacls` 명령을 실행하세요.

## 검증 범위
- 확인함(맥): 서버 실행, 자체 시험(`check.mjs`), 설정·주소 스크립트, 잘못된 토큰·입력 처리.
- 확인함(윈도우 11 실제 PC): 서버 실행, 자체 시험(`check.mjs`), 작업 스케줄러 등록·상태·재시작, 설정 파일 권한 제한.
- 아직 안 함: 윈도우에서 443 Funnel 공개 이후 단계, Claude 앱 커넥터를 거친 끝까지 연결 시험(맥·윈도우 모두). 커넥터는 443 주소만 연결된다(8443 등 포트가 붙은 주소는 안 됨).
  커넥터 메뉴 이름은 문서를 바탕으로 작성했습니다. 막히면 이슈로 알려 주세요.

## 파일
| 경로 | 내용 |
|---|---|
| `SKILL.md` | Claude가 따라 하는 설정 절차 |
| `references/troubleshooting.md` | 증상별 해결법 |
| `server/server.mjs` | MCP 서버 |
| `server/setup-config.mjs` | 설정 파일 만들기(토큰을 화면에 찍지 않음) |
| `server/check.mjs` | 자체 시험 |
| `server/show-url.mjs` | 커넥터 주소 만들기(클립보드로 보냄) |
| `server/config.example.json` | 설정 형식 예시 |
| `templates/macos-launchagent.plist` | 맥 상시 실행 |
| `templates/windows-*.cmd/.vbs/.ps1` | 윈도우 상시 실행(창 없이), 등록, 상태·재시작·중지 |

## 라이선스
MIT
