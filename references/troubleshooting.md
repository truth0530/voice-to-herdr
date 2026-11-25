# 문제 해결

증상 → 확인 → 해결 순서다. 먼저 어느 구간이 끊겼는지 가른다. 단계 번호는 SKILL.md의 단계다.
`windows-service.ps1 -Action …`은 SKILL.md 5단계(윈도우) 3번의 전체 명령 형식으로 실행한다.

```
[A] herdr  ← [B] 로컬 서버(127.0.0.1:<포트>)  ← [C] Funnel(https://...ts.net)  ← [D] Claude 커넥터
```

| 시험 | 통과하면 | 실패하면 |
|---|---|---|
| `herdr agent list` | A 정상 | "herdr 문제" |
| `node check.mjs` | A·B 정상 | "서버 문제" |
| `tailscale funnel status`에 `(Funnel on)`과 `proxy http://127.0.0.1:<포트>` | C 설정 정상 | "Funnel 문제" |
| 휴대폰(Wi-Fi·Tailscale 끔, LTE)에서 `<Funnel 주소>/healthz` → `ok` | C 정상(인터넷에서 들어옴) | "Funnel 문제" |
| 위가 다 통과인데 앱에서 안 됨 | — | "커넥터 문제" |

`node check.mjs <Funnel 주소>`는 같은 컴퓨터에서 tailnet 안쪽으로 지나갈 수 있어 C를 증명하지 못한다. 실패 문구 뒤의 `->` 줄은 가장 흔한 원인이다.

---

## 설치 직후 명령이 없음 (`node`, `npm`, `tailscale`, `herdr`를 못 찾음)
- 설치한 터미널·Claude Code는 설치 전 PATH를 갖고 있다. Claude Code를 다시 시작하는 것이 가장 확실하다.
- 윈도우에서 다시 시작하지 않고 쓰려면 PowerShell에서:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
  또는 전체 경로: `& "C:\Program Files\nodejs\node.exe"`, `& "C:\Program Files\nodejs\npm.cmd" install`.
- 맥 Tailscale 앱만 있고 `tailscale` 명령이 없으면 `/Applications/Tailscale.app/Contents/MacOS/Tailscale`을 전체 경로로 쓴다.
  (앱 설정의 CLI 항목에서 명령을 설치할 수도 있다. 위치는 판마다 다르다.)
- Homebrew의 `tailscale` 포뮬러(앱 없이 데몬만)는 `sudo brew services start tailscale`, `sudo tailscale up`이 필요하다. 보통은 앱이 쉽다.

---

## herdr 문제

### herdr가 꺼져 있음 / `herdr returned no JSON`
- herdr는 서버와 화면이 따로다. 화면을 닫아도 서버는 남지만, 재부팅·업데이트 뒤에는 꺼져 있다.
- [사용자 직접] 터미널에서 `herdr`를 열고, pane에서 에이전트(`claude` 등)도 다시 띄운다. 휴대폰만으로는 고칠 수 없다.
- 그래도 같으면 같은 사용자로 `herdr agent list`를 실행해 오류 문장을 본다. 오래된 herdr면 `herdr update`.

### standup이 "0 agents"
- herdr 안에 에이전트를 띄운 pane이 없거나 감지되지 않았다. `herdr agent explain <pane>`으로 본다.
- `herdr --session <이름>`처럼 이름 붙은 세션을 쓰면 서버는 기본 세션만 본다. 기본 세션에서 에이전트를 띄운다.

### `herdr not found at "..."`
- 서비스는 로그인 셸의 PATH를 모른다. `node setup-config.mjs --herdr "<herdr 경로>"`로 전체 경로를 넣고 서비스를 재시작한다.
- 윈도우는 `where.exe herdr`의 `C:\...\herdr.exe` 형식이어야 한다. Git Bash의 `/c/...`나 `.cmd`·`.ps1` 경로는 안 된다.

### 원격 머신(`remotes`)만 "no answer"
- 터미널에서 `herdr --machine <이름> agent list`가 되는지 본다.
- SSH 인증이 브라우저 승인 같은 대화형이면 시간 초과된다. 대화 없이 되는 SSH 키 방식으로 맞춘다. 로컬 결과는 그대로 나온다.
- 서버 시작 로그에 `ignored remotes entry`가 있으면 prefix 형식이 틀렸다(소문자·숫자·`-`, `w`+숫자로 시작 금지).

---

## 서버 문제

### `ECONNREFUSED` — 서버가 안 떠 있음
- 맥: `launchctl print gui/$(id -u)/<서비스 이름> | grep -E "state|last exit"`, `tail -n 40 <로그 경로>`.
- 윈도우: `windows-service.ps1 -Action status`, `Get-Content $env:LOCALAPPDATA\voice-to-herdr\server.log -Tail 40`.
- 로그에 `config not found` → 설정 파일 위치가 틀렸다. `node setup-config.mjs`가 출력한 경로를 쓴다.
- 로그에 `config.token must be 32+` → 토큰이 깨졌다. `node setup-config.mjs --new-token`(그 뒤 커넥터 재등록).
- 로그에 `Cannot find package '@modelcontextprotocol/...'` → 서버 폴더에서 `npm install`(윈도우 `npm.cmd install`).
- 맥 로그가 아예 없음 → plist의 node 경로가 틀렸다(nvm 버전 변경이 흔한 원인). 고친 뒤 bootout → `sleep 2` → bootstrap.
- 맥 로그에 `EPERM: operation not permitted` → 저장소가 `~/Documents`·`~/Desktop`·`~/Downloads`·iCloud 아래다.
  `~/voice-to-herdr`로 옮기고 plist 경로를 고친다.
- 맥 state가 계속 not running이고 로그도 없음(macOS 13+) → 시스템 설정 → 일반 → 로그인 항목 → "백그라운드에서 허용"에서 node를 켠다.

### `Bootstrap failed: 5: Input/output error` (맥)
- 이미 등록돼 있거나, bootout 직후 너무 빨리 bootstrap했거나, plist가 잘못됐다.
- `plutil -lint <plist>` → `launchctl bootout gui/$(id -u)/<서비스 이름>` → `sleep 2` → `launchctl bootstrap gui/$(id -u) <plist>`.
- plist의 Label과 파일 이름(`<서비스 이름>.plist`)이 같은지 본다.

### `port <포트> is already in use`
- 누가 쓰는지: 맥 `lsof -nP -iTCP:<포트> -sTCP:LISTEN` → `ps -p <PID> -o command=`,
  윈도우 `Get-NetTCPConnection -LocalPort <포트> -State Listen` → `Get-Process -Id <OwningProcess> | Select Path`.
- 4단계 시험 서버가 남아 있으면 그 백그라운드 작업을 끈다.
- 옛 서비스(KeepAlive LaunchAgent, 윈도우 실행 루프)가 잡고 있으면 kill해도 다시 뜬다. 사용자 동의를 받아 그 서비스를 끄거나
  (맥 `launchctl bootout gui/$(id -u)/<그 Label>`, 윈도우 `windows-service.ps1 -Action stop`), 다른 포트를 쓴다.
- 포트를 바꾸면: `node setup-config.mjs --port <새 포트>` → 서비스 재시작 → **Funnel도 새 포트로**(기존 매핑이 바뀐다고 먼저 말한다).
- 옛 서버가 같은 포트에서 돌고 있으면 `check.mjs`가 그 옛 서버를 상대로 OK를 낼 수 있다. `2/3 tools` 줄의 서버 이름이
  `voice-to-herdr`인지 본다.

### 설정 파일을 못 읽음 (`Unexpected token`, `Bad escaped character`, 서버가 바로 죽음)
- 손으로 고칠 때 윈도우 경로의 역슬래시를 하나만 썼다: `"C:\Users\..."` → `"C:\\Users\\..."` 또는 `"C:/Users/..."`.
- PowerShell 5.1의 `>`·`Out-File`·`Set-Content`로 써서 UTF-16이 됐다. `node setup-config.mjs`로 다시 만든다.

### 윈도우: 실행·재시작
- 로그온할 때 검은 창이 뜨고 닫으면 꺼짐 → 작업이 `run-hidden.vbs`를 거치지 않는다. 5단계대로 다시 등록한다.
- 작업은 등록됐는데 로그가 없음 → `where.exe wscript`. 없으면 설정 → 시스템 → 선택적 기능 → 기능 추가 → VBSCRIPT를 설치한다
  (윈도우 11에서 VBScript가 선택 기능으로 바뀌는 중이다).
- 로그에 starting이 계속 찍힘 → node가 바로 죽는다. 바로 위 줄의 오류를 본다. `run-server.cmd`에 한글·BOM이 들어갔으면
  템플릿을 다시 복사한다.
- 로그에 `port busy, runner stops` → 다른 실행 루프나 프로그램이 포트를 쓴다. `windows-service.ps1 -Action status`로 루프 개수를 본다.
- 설정을 바꾼 뒤 재시작은 `windows-service.ps1 -Action restart`(node만 끄면 루프가 5초 뒤 새 설정으로 띄운다).
  `Stop-ScheduledTask`는 루프를 끄지 못하고, `Start-ScheduledTask`를 또 하면 루프가 두 개가 된다.

### 윈도우: `npm`이 "running scripts is disabled"로 막힘
- PowerShell 실행 정책이 `npm.ps1`을 막았다. `npm.cmd install`로 실행한다.

### `npm install` 실패
- `EACCES`: 다른 사용자 소유 폴더다. 홈 폴더 아래로 옮긴다. `sudo npm`은 쓰지 않는다.
- 회사망 프록시: `npm config get proxy`를 확인하거나 다른 망에서 설치한다.
- Node v18 이하: Node 20 LTS 이상으로 올린다.

### 가끔 `502 Bad Gateway`
- 서버는 Tailscale 프록시보다 연결을 오래 유지하게(keepAlive 120초) 해 두었다. 그래도 나면 로그에 그 시각 요청이 있는지 본다.
  없으면 Funnel 구간(잠자기, 네트워크 전환) 문제다.

---

## Funnel 문제

### `funnel` 명령이 없거나 `--bg`를 모름
- `tailscale version`이 1.52 미만이다. 앱을 업데이트한다.

### Funnel 권한 없음 — "Funnel not available", "requires nodeAttrs", 허용 링크에 버튼이 없음
- Funnel은 tailnet 정책에서 그 기기에 `funnel` 속성이 있어야 하고, MagicDNS와 HTTPS 인증서가 켜져 있어야 한다.
- 내가 tailnet 소유자면 [사용자 직접]:
  1. https://login.tailscale.com/admin/dns → MagicDNS 켜기, HTTPS Certificates "Enable".
  2. https://login.tailscale.com/admin/acls → 정책 파일의 `nodeAttrs`에 **나에게만** 허용하는 항목을 넣고 Save.
     ```json
     "nodeAttrs": [
       { "target": ["<내 Tailscale 로그인 이메일>"], "attr": ["funnel"] }
     ]
     ```
     `autogroup:member`처럼 tailnet 전체에 여는 값은 쓰지 않는다.
  3. Funnel 명령을 다시 실행.
- 회사 tailnet(내가 관리자 아님): 먼저 회사 정책을 확인한다. Funnel은 기기 이름과 tailnet 이름을 인터넷에 드러낸다.
  허용되면 관리자에게 위 두 가지를 요청한다. 회사 관리(MDM) 기기는 개인 계정으로 바꾸면 회사 자원 연결이 끊길 수 있으니 바꾸지 않는다.
- 시험용 대안(한 번만): Cloudflare Quick Tunnel `cloudflared tunnel --url http://127.0.0.1:<포트>`의 `https://...trycloudflare.com`
  주소로도 커넥터가 동작한다. 실행할 때마다 주소가 바뀌어 커넥터를 다시 등록해야 하므로 상시용이 아니다.

### 443에 이미 다른 서비스가 있음
- 지우지 말고 `--https=8443`(또는 10000)으로 따로 연다. 주소는 `https://<기기>.<tailnet>.ts.net:8443`이 되고 커넥터에도 `:8443`을 넣는다.

### 윈도우에서 `Access denied` / 설정이 저장 안 됨
- 윈도우에서는 Funnel 명령이 관리자 PowerShell을 요구하는 경우가 많다. [사용자 직접] 관리자 PowerShell에서 실행한다.
- 서버는 127.0.0.1만 쓰므로 윈도우 방화벽 포트를 열 필요가 없다.

### 회사망에서 `check.mjs`가 인증서 오류(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` 등)
- 회사 프록시·SSL 검사 때문이다. 휴대폰 LTE에서 `/healthz` 시험으로 대신한다.

### `ENOTFOUND` / 인증서 오류 — 방금 켰음
- 새 Funnel 주소는 DNS·인증서 준비에 몇 분(길면 10분) 걸린다. 기다렸다 다시 시험한다.
- 계속이면 주소의 기기 이름이 실제와 다르다 → "기기 이름이 바뀜".

### 바깥에서 `404`
- Funnel이 다른 포트를 가리킨다(`proxy http://127.0.0.1:<포트>`가 설정의 port와 같은지).
- 커넥터 주소 끝의 `/mcp/<토큰>`이 빠졌거나, 토큰을 바꾼 뒤 커넥터를 다시 등록하지 않았다.

### 바깥에서 `502`가 계속
- Funnel은 켜졌지만 그 포트에서 서버가 안 듣는다 → "서버 문제"의 ECONNREFUSED.

---

## 커넥터 문제

### 추가할 때 "연결할 수 없음", "서버가 응답하지 않음"
- 휴대폰 LTE `/healthz`가 `ok`인지부터. 아니면 위 구간을 고친다.
- 주소를 다시 넣는다(7단계 클립보드 명령). 흔한 실수: `/mcp/` 빠짐, 공백, `http://`, 8443인데 `:8443` 빠짐.
- Serve(tailnet 내부)만 켜고 Funnel을 안 켰다. Claude는 인터넷에서 들어오므로 `(Funnel on)`이어야 한다.
- 인증은 No sign in. OAuth 칸에는 아무것도 넣지 않는다.

### "커스텀 커넥터 추가"가 안 보임 / 플랜
- 메뉴 이름은 판마다 다르다. Customize → Connectors, Settings → Connectors, "Browse connectors" 안을 차례로 본다.
- Free: 커스텀 커넥터 개수 제한(도움말 기준 1개). 이미 쓰고 있으면 하나를 지워야 한다.
- Team/Enterprise: 조직 Owner가 Organization settings → Connectors → Add → Custom → Web으로 추가하고, 멤버가 Connect를 누른다.
  **조직 커넥터는 조직의 모든 멤버가 Connect해서 내 에이전트를 읽을 수 있고, allowPrompt가 켜져 있으면 지시도 보낼 수 있다.**
  개인 용도라면 조직 커넥터로 쓰지 말고 개인 계정(Free/Pro/Max)에 등록한다. 꼭 조직에 둬야 하면 allowPrompt=false로만 쓴다.
- 휴대폰 앱은 커넥터를 추가한 바로 그 계정(개인/조직 전환 확인)으로 로그인돼 있어야 한다.
- 휴대폰 앱에서는 새로 추가할 수 없다. 컴퓨터 브라우저 claude.ai에서 추가한다.

### 추가는 됐는데 대화에서 "herdr 도구가 없다"
- 그 대화의 ＋ → Connectors에서 herdr가 켜져 있는지 본다. 새 대화를 연다.
- 커넥터를 열어 도구 3개가 보이는지 본다. 안 보이면 지우고 다시 추가한다.
- 음성 중에 도구 승인 창이 뜨면 대화가 멈출 수 있다. 글자 대화에서 먼저 한 번 허용해 둔다.

### 지시가 "꺼져 있다"고 나옴
- `allowPrompt`가 false다. 동의 후 `node setup-config.mjs --allow-prompt true` → 서비스 재시작.

### "no agent ..."
- standup에 나온 좌표(`w1:p2`)로 부른다. 대소문자·띄어쓰기는 상관없다. 다른 머신은 `pc:w1:p2`처럼 접두어를 붙인다.

### 지시 뒤 "Could not confirm delivery"
- herdr가 늦어 결과를 못 받았을 뿐 지시는 이미 갔을 수 있다. 다시 보내기 전에 read_agent로 화면을 확인한다.

---

## 잠자기
컴퓨터가 잠들면 Tailscale도 서버도 멈춰 커넥터가 응답하지 않는다.
- 맥: 시스템 설정 → 배터리(또는 에너지) → 전원 연결 시 "디스플레이가 꺼져 있을 때 자동으로 잠자지 않기".
  [사용자 직접] 터미널 `sudo pmset -c sleep 0`(전원 연결 시만, 비밀번호 필요). 잠깐만이면 `caffeinate -dims`(창을 닫으면 해제).
  뚜껑을 닫으면 외부 모니터 없이는 대부분 잠든다.
- 윈도우 11: 설정 → 시스템 → 전원 및 배터리 → 화면, 절전 및 최대 절전 시간 제한 → 전원 연결 시 절전 = 안 함.
  윈도우 10: 설정 → 시스템 → 전원 및 절전. 명령 `powercfg /change standby-timeout-ac 0`.
  노트북 덮개: 제어판 → 전원 옵션 → "덮개를 닫으면" = 아무 것도 안 함(전원 연결 시).
  `powercfg /a`에 "최신 대기(S0)"가 있으면 Modern Standby 기기라 화면이 꺼질 때 네트워크가 끊길 수 있다.
- 윈도우에서 로그아웃·사용자 전환 때도 Tailscale을 유지하려면 트레이 메뉴의 "Run unattended"를 켠다.
- 자동 업데이트·재부팅 예약도 외출 전에 미룬다. 재부팅되면 herdr와 에이전트를 다시 열어야 한다.

---

## 기기 이름이 바뀜 (`macbook-pro-1`, `desktop-abc123` 등)
- Funnel 주소의 앞부분은 Tailscale 기기 이름이다. 이름이 바뀌면 커넥터는 옛 주소를 계속 부른다.
- 확인: `tailscale status --self=true --peers=false`, `tailscale funnel status`.
- 해결 둘 중 하나:
  1. 이름을 되돌린다. 같은 이름의 옛 기기가 관리 콘솔에 남아 있으면 먼저 지운다(안 그러면 `-1`이 붙는다).
     `tailscale set --hostname=<원래 이름>` 또는 관리 콘솔 ⋯ → Edit machine name("Auto-generate from OS hostname"은 끈다).
  2. 커넥터를 새 주소로 다시 등록한다(SKILL.md 7단계).

## 컴퓨터 이전 — 원인
순서는 SKILL.md "다른 컴퓨터로 옮겼을 때". 실제로 겪은 원인들:
- **옛 컴퓨터가 아직 켜져 있음**: 같은 설정의 herdr·서버·백그라운드 서비스가 두 곳에서 돈다. 서비스는 한쪽에서만 돌게 한다.
- **같은 기기 키**: 마이그레이션 도구가 Tailscale 상태까지 복사해, 새 컴퓨터가 옛 기기와 같은 기기로 접속한다.
  두 컴퓨터가 번갈아 잡히거나 "로그인됨"인데 연결이 이상하다. 새 컴퓨터에서 logout → 다시 로그인해 새 기기로 만든다.
- **기기 이름 변경**: 새 기기는 OS 기본 이름이나 `-1`이 붙은 이름이 된다 → "기기 이름이 바뀜".
- **Funnel 설정 없음**: Serve/Funnel 설정은 기기별이다.
- **경로 변경**: 복사된 plist/작업의 node·herdr 경로가 새 컴퓨터와 다르다(nvm 버전, 사용자 이름, `/usr/local` → `/opt/homebrew`).
- 설정 파일(토큰)은 함께 복사되므로, 호스트 이름만 같게 맞추면 커넥터는 고치지 않아도 된다.
