---
name: voice-to-herdr
description: herdr 안의 코딩 에이전트(Claude Code, Codex 등)를 Claude 앱 음성 통화로 확인하고 지시할 수 있게, 맥이나 윈도우 PC에 작은 MCP 서버를 띄우고 Tailscale Funnel로 공개 HTTPS 주소를 만든 뒤 Claude 앱 커스텀 커넥터로 등록한다. "herdr를 Claude 음성에 연결해 줘", "voice-to-herdr 설정", "새 컴퓨터로 옮겼더니 herdr 커넥터가 응답하지 않아"에 사용.
---

# voice-to-herdr: herdr를 Claude 음성에 연결하기

다 되면 휴대폰 Claude 앱 음성 통화에서 "진행 상황 알려 줘", "w1:p2 화면 읽어 줘",
"w1:p2에 테스트 돌리라고 해" 같은 말로 herdr 에이전트를 다룰 수 있다.

```
Claude 앱(음성) ──인터넷──> https://<Funnel 주소>/mcp/<토큰>
                               │ Tailscale Funnel (공개 HTTPS)
                               ▼
               내 컴퓨터 127.0.0.1:<포트>  ← 이 저장소의 server/server.mjs
                               │
                               ▼
                          herdr CLI → 에이전트 pane
```

막히면 `references/troubleshooting.md`에서 증상을 찾는다. 이 문서는 순서만 담고, 원인 설명은 그쪽에 있다.

## Claude가 지킬 규칙

- **[Claude 실행]** 은 직접 돌리고, **[사용자 직접]** 은 안내를 그대로 읽어 주고 끝났다는 답을 기다린다.
- 단계마다 끝의 **통과** 조건을 확인한 뒤 다음 단계로 간다. 실패하면 troubleshooting을 보고 같은 단계를 다시 한다.
- **토큰을 Claude의 출력이나 대화에 남기지 않는다.** 토큰은 `setup-config.mjs`가 파일에만 쓰고, 최종 주소는
  클립보드로만 옮긴다(7단계).
- 기존 설정(다른 서버, Tailscale Serve/Funnel, plist, 작업, 설정 파일)을 바꾸거나 지우기 전에 보여 주고 묻는다.
  `tailscale funnel reset`은 다른 서비스까지 끄므로 쓰지 않는다.
- `allowPrompt`(음성으로 지시 보내기)는 기본 꺼짐이다. 켜기 전에 위험(주소가 새면 남이 에이전트에 지시할 수 있음)을
  설명하고 동의를 받는다.
- 끝나지 않는 명령(`node server.mjs`, 승인을 기다리는 `tailscale funnel`)은 백그라운드로 실행한다.
- 맥과 윈도우 명령을 섞지 않는다. 경로에 공백이 있을 수 있으니 경로는 늘 따옴표로 감싼다.
- **윈도우**: `powershell` 블록은 PowerShell 도구로 실행한다(Claude Code의 Bash 도구는 윈도우에서 Git Bash라
  `$env:`, `&`, `\` 경로가 깨진다). PowerShell 도구가 없으면 `powershell -NoProfile -Command "..."`로 감싼다.
  `tailscale`은 `& "C:\Program Files\Tailscale\tailscale.exe"`로 쓴다. 관리자 권한이 필요한 명령은 Claude가 올릴 수 없으니
  붙여 넣을 명령을 주고 [사용자 직접]으로 한다.

## 자리 표시

| 자리 표시 | 뜻 | 맥 | 윈도우 (PowerShell) |
|---|---|---|---|
| `<저장소>` | 이 저장소 폴더 | 예 `/Users/<이름>/voice-to-herdr` | 예 `C:\Users\<이름>\voice-to-herdr` |
| `<서버 폴더>` | `<저장소>/server` | | |
| `<포트>` | 서버의 로컬 포트 | 기본 8765. 비었는지 `lsof -nP -iTCP:8765 -sTCP:LISTEN` (출력 없으면 빔) | `Get-NetTCPConnection -LocalPort 8765 -State Listen` (오류면 빔) |
| `<herdr 경로>` | herdr 실행 파일 | `command -v herdr` | `$env:LOCALAPPDATA\Programs\Herdr\bin\herdr.exe`가 있으면 **그것**(`herdr update`를 해도 경로가 안 바뀐다). 없으면 `where.exe herdr` 중 **`C:\...\herdr.exe`** 줄(`/c/...`·`.cmd`·`.ps1`은 안 됨). `where.exe`가 주는 `...\releases\<버전>\herdr.exe`는 업데이트 뒤 지워질 수 있다 |
| `<node 경로>` | Node.js | `command -v node` | `where.exe node` 첫 줄 |
| `<설정 파일>` | 서버 설정 | `~/.config/voice-to-herdr/config.json` | `$env:APPDATA\voice-to-herdr\config.json` |
| `<서비스 이름>` | 상시 실행 항목 | LaunchAgent Label, 예 `com.user.voice-to-herdr` | 작업 스케줄러 이름, 예 `voice-to-herdr` |
| `<로그 경로>` | 서버 로그 | 예 `/Users/<이름>/Library/Logs/voice-to-herdr.log` | `$env:LOCALAPPDATA\voice-to-herdr\server.log` (고정) |
| `<Funnel 주소>` | 바깥 https 주소 | `tailscale funnel status`에서 `proxy http://127.0.0.1:<포트>`가 붙은 블록의 https 주소(커넥터에는 포트가 없는 443 주소만 쓴다) | 같음 |

커넥터에 넣는 최종 주소 = `<Funnel 주소>/mcp/<토큰>`. 토큰은 설정 파일 안에만 있다.

## 0단계. 환경 점검 [Claude 실행]

맥:
```sh
sw_vers -productVersion; uname -m
command -v herdr && herdr --version && herdr status
command -v node && node --version
command -v tailscale || ls /Applications/Tailscale.app/Contents/MacOS/Tailscale
tailscale version; tailscale status --self=true --peers=false
```
윈도우:
```powershell
[Environment]::OSVersion.VersionString
where.exe herdr; Test-Path "$env:LOCALAPPDATA\Programs\Herdr\bin\herdr.exe"; herdr --version; herdr status
where.exe node; node --version
& "C:\Program Files\Tailscale\tailscale.exe" version
& "C:\Program Files\Tailscale\tailscale.exe" status --self=true --peers=false
```

| 항목 | 통과 | 안 되면 |
|---|---|---|
| herdr | 버전이 나오고 `herdr status`에 서버가 running | 미설치: 맥 `curl -fsSL https://herdr.dev/install.sh \| sh`, 윈도우 `powershell -ExecutionPolicy Bypass -c "irm https://herdr.dev/install.ps1 \| iex"`. 꺼짐: [사용자 직접] 터미널에서 `herdr`를 연다 |
| 에이전트 | herdr pane 하나에 Claude Code나 Codex가 떠 있음 | [사용자 직접] pane 하나에서 `claude`를 띄운다(없으면 4단계에서 0 agents) |
| Node.js | v20 이상 | 맥 `brew install node`(또는 nvm), 윈도우 `winget install OpenJS.NodeJS.LTS` → troubleshooting "설치 직후 명령이 없음" |
| Tailscale | 1.52 이상, 로그인됨 | 1단계. 명령이 없으면 맥은 앱 안 전체 경로를 쓴다 |

**이미 일부 설정돼 있는지도 본다** (있으면 보여 주고 어떻게 할지 묻는다):
- 포트를 누가 쓰는지: 맥 `lsof -nP -iTCP:<포트> -sTCP:LISTEN` → `ps -p <PID> -o command=`,
  윈도우 `Get-NetTCPConnection -LocalPort <포트> -State Listen` → `Get-Process -Id <OwningProcess> | Select Path`
- 기존 서비스: 맥 `ls ~/Library/LaunchAgents | grep -i herdr`, 윈도우 `Get-ScheduledTask -TaskName *herdr*`
- 기존 Funnel/Serve: `tailscale funnel status`, `tailscale serve status`
- 기존 설정 파일 `<설정 파일>` (있으면 setup-config가 토큰을 유지한다)
- Claude 앱에 이미 herdr 커넥터가 있는지 [사용자 직접]

이미 동작하던 커넥터가 갑자기 응답하지 않는 경우라면 새로 설치하지 말고 "다른 컴퓨터로 옮겼을 때"나 troubleshooting부터 본다.

## 1단계. Tailscale 설치·로그인 [사용자 직접]

이미 로그인돼 있으면 건너뛴다.
1. https://tailscale.com/download 에서 설치한다(맥은 `brew install --cask tailscale`도 된다).
2. 맥에서 처음 실행하면 "VPN 구성 추가" 허용 창이 뜬다 → 허용.
3. 메뉴 막대(맥)나 작업 표시줄 트레이(윈도우)의 Tailscale 아이콘 → Log in → 브라우저에서 로그인 → Connect.
4. 회사 tailnet이라 관리자가 아니면 Funnel을 못 쓸 수 있다(troubleshooting "Funnel 권한 없음").

**통과**: `tailscale status --self=true --peers=false`에 내 기기 이름과 100.x 주소가 나온다.

## 2단계. 서버 파일 준비 [Claude 실행]

이 SKILL.md 옆에 `server/` 폴더가 없으면(내용만 붙여 넣은 경우) 저장소를 받는다.
- 맥: `git clone https://github.com/truth0530/voice-to-herdr ~/voice-to-herdr`
- 윈도우(PowerShell): `git clone https://github.com/truth0530/voice-to-herdr "$HOME\voice-to-herdr"`
- git이 없으면 저장소 페이지 Code → Download ZIP을 같은 위치에 푼다.

둘 곳: 맥은 `~/Documents`·`~/Desktop`·`~/Downloads`·iCloud 아래를 피한다(서비스가 `EPERM`으로 죽는다).
윈도우는 OneDrive로 동기화되는 폴더를 피한다.

```sh
cd "<서버 폴더>"
npm install
```
윈도우 PowerShell에서는 `npm.cmd install`.

**통과**: `node_modules` 폴더가 생기고 오류가 없다.

## 3단계. 설정 파일 만들기 [Claude 실행]

```sh
cd "<서버 폴더>"
node setup-config.mjs --port <포트> --herdr "<herdr 경로>"
```
토큰은 이 스크립트가 만들어 `<설정 파일>`에만 넣는다(맥은 권한 600). 토큰을 `node -e`로 따로 출력하지 않는다.
- 출력에 `allowPrompt=true`가 남아 있으면 예전 설정이다. 유지할지 묻고, 아니면 `--allow-prompt false`.
- 다른 herdr 머신(`herdr machine list`)도 보려면 설정 파일의 `remotes`에 `[{"prefix":"pc","machine":"<머신 이름>"}]`를
  넣는다. `pc:w1:p2`처럼 부른다. prefix는 소문자이고 `w`+숫자로 시작하면 안 된다.
- 설정 파일을 손으로 고칠 때 주의(특히 윈도우 인코딩·역슬래시): troubleshooting "설정 파일을 못 읽음".

- 윈도우: 이 스크립트가 설정 파일 권한을 현재 계정만 읽고 쓰게 좁힌다(토큰이 든 파일이다. 윈도우는 맥의 `0o600`이
  효과가 없어 폴더의 상속 권한 그대로면 다른 계정에도 열려 있다). `WARNING: could not restrict permissions`가 나오면
  그 줄의 `icacls` 명령을 실행한다.

**통과**: 출력에 `config: <설정 파일>`과 `token=(set, hidden)`이 나온다. 윈도우는 `permissions: config file restricted to your Windows account`도 나온다.

## 4단계. 직접 띄워 시험 [Claude 실행]

1. `cd "<서버 폴더>"` 후 `node server.mjs`를 **백그라운드로** 실행한다.
2. 그 출력에 `on 127.0.0.1:<포트>` 줄이 보일 때까지 기다린다. `already in use`가 나오면 다른 프로그램이 포트를 쓴다
   (0단계 확인으로 누구인지 보고, 다른 포트로 3단계부터).
3. `node check.mjs`

**통과**: `1/3 initialize ok`, `2/3 tools: standup, read_agent, prompt_agent`, `3/3 standup: N agents (local N)`, `OK`.
`FAIL`이나 `WARN: 0 agents`면 그 줄의 안내를 따른다. 윈도우에서 standup 줄에
`For an elevated server, use an administrator terminal`이 나오면 herdr 서버가 관리자 권한으로 떠 있는 것이다
(troubleshooting "윈도우: herdr 서버가 관리자 권한").

시험이 끝나면 백그라운드 서버를 끈다(Claude Code의 백그라운드 작업 중지). 다음 단계 서비스가 같은 포트를 쓴다.

## 5단계. 상시 실행 서비스 [Claude 실행]

### 맥: LaunchAgent
1. 같은 이름의 plist가 이미 있으면 내용을 보여 주고 바꿀지 묻는다.
2. `templates/macos-launchagent.plist`를 채워 `~/Library/LaunchAgents/<서비스 이름>.plist`로 저장한다.
   - 모든 경로는 `/Users/<이름>/...` 전체 경로(plist는 `~`를 펼치지 않는다).
   - `<PATH 값>` = `<herdr 경로>`의 폴더`:`<node 경로>`의 폴더`:/usr/bin:/bin`.
   - node가 nvm에만 있으면 `nvm which default`의 전체 경로를 쓰고, nvm 기본 버전을 바꾸면 이 단계를 다시 한다.
     Homebrew node(`/opt/homebrew/bin/node`, 인텔 `/usr/local/bin/node`)가 있으면 그쪽이 덜 깨진다.
3. 검사·등록:
   ```sh
   plutil -lint ~/Library/LaunchAgents/<서비스 이름>.plist
   launchctl bootout gui/$(id -u)/<서비스 이름> 2>/dev/null; sleep 2
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<서비스 이름>.plist
   launchctl print gui/$(id -u)/<서비스 이름> | grep -E "state|pid|last exit"
   ```
4. [사용자 직접] macOS 13 이상: "백그라운드 항목 추가됨" 알림이 뜨면 시스템 설정 → 일반 → 로그인 항목 →
   "백그라운드에서 허용"에 node가 켜져 있는지 확인한다.

### 윈도우: 작업 스케줄러 (로그온 시, 현재 사용자, 창 없이)
1. 실행 파일 두 개를 서버 폴더로 복사한다(고칠 필요 없음):
   ```powershell
   Copy-Item "<저장소>\templates\windows-run-server.cmd" "<서버 폴더>\run-server.cmd"
   Copy-Item "<저장소>\templates\windows-run-hidden.vbs" "<서버 폴더>\run-hidden.vbs"
   ```
   로그온 사용자의 PATH에 node가 없을 때만 `run-server.cmd`의 `NODE_EXE`를 `<node 경로>`로 바꾼다(ASCII로만 저장).
2. 등록(일반 PowerShell):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "<저장소>\templates\windows-register-task.ps1" -TaskName "<서비스 이름>" -ServerDir "<서버 폴더>"
   ```
   "Access denied"면 [사용자 직접] **자기 계정**의 관리자 PowerShell에서 같은 명령(다른 관리자 계정이면 그 계정으로 등록돼 herdr를 못 본다).
3. 상태·재시작·중지·제거는 이 스크립트로 한다(아래에서 "`windows-service.ps1 -Action …`"은 모두 이 형식이다):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "<저장소>\templates\windows-service.ps1" -Action status -TaskName "<서비스 이름>"
   ```
   `-Action`은 `status`·`restart`·`stop`·`remove`. 포트는 설정 파일에서 읽고 node 프로세스만 끈다.
   `Stop-ScheduledTask`/`Start-ScheduledTask`를 직접 쓰지 않는다(실행 루프가 남거나 두 개가 된다).

**통과**: `node check.mjs`가 다시 `OK`. 로그(`<로그 경로>`)에 `on 127.0.0.1:<포트>` 줄이 있다.

## 6단계. Tailscale Funnel 켜기 [맥: Claude 실행 · 윈도우: 사용자 직접]

1. 기존 설정 확인: `tailscale funnel status`, `tailscale serve status`. **Claude 커스텀 커넥터는 표준 HTTPS 포트 443으로만
   연결된다. 포트가 붙은 URL(`:8443` 등)은 연결하지 못한다**(Anthropic 문서). 그래서 커넥터용 Funnel은 반드시 443이다.
   **443을 이미 다른 서비스가 쓰고 있으면 하나만 고를 수 있다**: 그 서비스를 다른 방법으로 옮기거나(다른 컴퓨터·다른
   Tailscale 기기의 443으로 열기), 그 서비스를 끄고 이 서버로 교체하거나, 이 서버를 켜지 않는다. 한 기기의 443에 두 서비스를 경로로 나눠
   싣는 방법(`--set-path`)은 이 문서에서 검증하지 않았으니 권하지 않는다. 덮어쓰기 전에 `tailscale funnel status`로 기존
   내용을 사용자에게 보여 주고 동의를 받는다.
   8443·10000은 휴대폰 `/healthz` 점검에는 쓸 수 있어도 커넥터에는 못 쓴다.
2. 켜기:
   - 맥 [Claude 실행, 백그라운드로]: `tailscale funnel --bg <포트>`
   - 윈도우 [사용자 직접]: 시작 메뉴 → PowerShell 우클릭 → "관리자 권한으로 실행" → 붙여 넣기:
     `& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg <포트>` → 출력을 Claude에게 붙여 준다.
   - 기존 설정을 바꾼다는 y/N 질문이 나오면 사용자 동의를 받은 뒤에만 `--yes`를 붙인다.
3. [사용자 직접] 처음 켜는 tailnet이면 명령이 `https://login.tailscale.com/...` 링크를 내고 기다린다. 그 링크를 열어
   Funnel(과 HTTPS 인증서) 허용 버튼을 누른다. 버튼이 없거나 관리자 문의가 나오면 troubleshooting "Funnel 권한 없음".
4. `tailscale funnel status`에 `(Funnel on)`과 `proxy http://127.0.0.1:<포트>`가 있어야 한다. `(Funnel on)`이 없으면
   tailnet 안에서만 열린 것이라 Claude 앱이 못 들어온다.
5. [사용자 직접] 바깥에서 확인: 휴대폰 Wi-Fi와 Tailscale 앱을 끄고 LTE/5G로 브라우저에서 `<Funnel 주소>/healthz`를 연다.
   처음 켠 직후에는 몇 분(길면 10분) 걸릴 수 있다. (같은 컴퓨터의 `node check.mjs <Funnel 주소>`는 tailnet 안쪽으로
   지나갈 수 있어 이 확인을 대신하지 못한다.)

**통과**: 휴대폰에 `ok`가 보인다.

## 7단계. Claude 앱에 커넥터 등록 [사용자 직접]

1. [Claude 실행] 최종 주소를 클립보드에만 넣는다(화면에 찍지 않는다):
   - 맥: `node "<서버 폴더>/show-url.mjs" <Funnel 주소> | pbcopy`
   - 윈도우: `node "<서버 폴더>\show-url.mjs" <Funnel 주소> | Set-Clipboard`
   사용자에게 "클립보드의 주소는 비밀번호처럼 다루세요. 붙여 넣은 뒤 다른 것을 복사해 덮어 두세요"라고 말한다.
2. 컴퓨터 브라우저로 https://claude.ai (휴대폰 앱에서는 커넥터를 새로 추가할 수 없다. 웹·데스크톱에서 추가하면 휴대폰에서도 쓴다.)
3. **Customize → Connectors → + Add → Add custom connector** (판에 따라 Settings → Connectors. 이름이 다르면 비슷한 메뉴).
4. 이름 `herdr`, 원격 MCP 서버 URL에 붙여 넣기. 인증은 **No sign in**(OAuth 칸은 비움) → Add.
5. 목록에서 herdr를 열어 도구 3개(standup, read_agent, prompt_agent)를 확인한다. 도구별 권한을 고를 수 있으면
   prompt_agent는 "매번 승인" 쪽으로 둔다.
6. Team/Enterprise 계정이나 Free 플랜이면 먼저 troubleshooting "커넥터 문제"의 플랜 항목을 읽는다.
   **조직 커넥터로 추가하면 조직의 다른 멤버도 내 에이전트를 읽고 지시할 수 있다.**

**통과**: 커넥터 목록에 herdr가 오류 없이 있다.

## 8단계. 써 보기 [사용자 직접]

1. 휴대폰 Claude 앱 새 대화 → ＋ → Connectors에서 herdr가 켜져 있는지 본다.
2. 먼저 **글자로** "herdr 진행 상황 알려 줘" → 도구 승인 창이 뜨면 허용. 에이전트 목록이 나오면 성공.
3. 같은 대화에서 음성 모드로 같은 말. 그다음 "w1:p2 화면 읽어 줘"(standup에 나온 좌표로).
4. 지시까지 쓰려면 동의 후 `node setup-config.mjs --allow-prompt true` → 서비스 재시작
   (맥 `launchctl kickstart -k gui/$(id -u)/<서비스 이름>`, 윈도우 `windows-service.ps1 -Action restart`).

외출 전 확인: 전원 연결, 잠자기 안 함(troubleshooting "잠자기"), herdr와 에이전트가 떠 있음, 휴대폰 LTE에서 `/healthz` ok.
재부팅·업데이트 뒤에는 서버는 저절로 뜨지만 herdr와 그 안의 에이전트는 다시 열어야 한다.

## 음성으로 쓸 때 팁 (사용자에게 알려 준다)

- pane은 좌표(`w1:p2`)로 부른다. herdr pane 이름 앞에 좌표를 붙여 두면 말하기 쉽다. 대소문자·띄어쓰기는 상관없다.
- 지시는 Claude가 보낼 문장을 읽어 주고 "응"이라고 해야 간다. "읽고 보고만 해"와 "실행해"를 분명히 말한다.
- 승인 대기(blocked) 에이전트에는 지시가 안 간다. 승인은 컴퓨터 앞에서 한다.
- 통화를 시작하면 먼저 규칙을 말해 둔다. 새 대화는 이전 대화의 규칙을 기억하지 못해서, 주변 소리나 끼어든 일상 대화
  (옆 사람과 "밥 먹었니?")에 답하다 맥락이 흐려지기 쉽다. 예:
  > 이번 통화는 herdr 에이전트 진행 상황을 확인하고 지시하는 대화야. 이 주제와 상관없는 말이나 주변 소리가 들리면
  > 무시하지 말고 "네"라고만 짧게 답하고, 내가 herdr 얘기를 다시 꺼내면 이어서 해 줘. 화면을 읽으면 세 문장 안으로 요약해 줘.
- 음성 통화는 한 번에 쓸 수 있는 시간에 제한이 있다. 끝나기 조금 전에 "통화가 2분 정도 남았다"는 안내가 나오면
  통화를 끊고 **같은 대화**에서 바로 다시 음성 통화를 연결한다. 앞의 대화를 이어서 쓸 수 있다.
- 주변 사람과 길게 얘기해야 하면 통화를 끊지 말고 마이크만 음소거한다. Claude는 기다리고, 음소거를 풀면 이어진다.

## 다른 컴퓨터로 옮겼을 때

새 컴퓨터로 옮긴 뒤 커넥터가 "서버가 응답하지 않음"이면 이 순서로 한다. 원인 설명은 troubleshooting "컴퓨터 이전".

1. troubleshooting 맨 위 구간 표로 어디가 끊겼는지 먼저 가른다.
2. 옛 컴퓨터: 더 안 쓰면 전원을 끈다. 계속 쓰면 옛 컴퓨터에서 Funnel을 끄고(`tailscale funnel --https=443 off`)
   서비스를 지우고 기기 이름을 바꾼다(예 `old-mac`). 그래야 새 컴퓨터가 원래 이름을 이어받는다.
3. 관리 콘솔 https://login.tailscale.com/admin/machines 에서 두 기기가 따로 보이는지 본다.
   새 컴퓨터가 옛 기기와 같은 기기로 잡히면(같은 기기 키) [사용자 직접] 새 컴퓨터에서 `tailscale logout` → 다시 로그인.
   원격 접속(Tailscale SSH 등)으로 그 컴퓨터를 쓰는 중이면 logout하지 않는다. 연결이 끊긴다.
4. [사용자 직접] 관리 콘솔에서 옛 기기를 ⋯ → Remove (옛 컴퓨터를 계속 쓰면 2에서 이름만 바꾼다).
5. 그다음 새 컴퓨터 이름을 원래대로: `tailscale set --hostname=<원래 이름>` (또는 관리 콘솔 ⋯ → Edit machine name).
   4보다 먼저 하면 `-1`이 붙는다.
6. 복사돼 온 plist/작업의 node·herdr 경로를 `command -v`(윈도우 `where.exe`)로 다시 확인하고 5단계를 다시 한다.
   인텔→애플 실리콘이면 Homebrew 경로가 `/usr/local` → `/opt/homebrew`로 바뀐다. 로그인 항목 허용도 다시 본다.
7. 6단계 Funnel을 다시 켠다(Funnel 설정은 기기마다 따로다).
8. `tailscale funnel status`의 호스트가 커넥터 주소의 호스트와 같은지 본다. 같으면 커넥터는 그대로 둔다(토큰은 복사돼 왔다).
   다르면 5번으로 이름을 되돌리거나 7단계로 커넥터를 다시 등록한다.

## 끄기·지우기·토큰 바꾸기

- Funnel만 끄기: `tailscale funnel --https=443 off` (8443이면 `--https=8443`).
- 맥 서비스 제거: `launchctl bootout gui/$(id -u)/<서비스 이름>` 후 plist 삭제.
- 윈도우 서비스 제거: `windows-service.ps1 -Action remove`.
- Claude 앱: Customize → Connectors → herdr → 제거.
- 토큰이 샜다고 의심되면: `node setup-config.mjs --new-token` → 서비스 재시작 → 7단계로 커넥터를 지우고 새 주소로 다시 등록.
