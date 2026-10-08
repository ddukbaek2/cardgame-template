# cardgame-template

[vanilla.js](https://github.com/ddukbaek2/vanilla.js) 엔진(`libs/vanilla.js` 서브모듈) 기반의 **모바일 세로형 카드 대전 게임 템플릿**.

타이틀(1:1 듀얼) → 대전(딜 · 고르기 · 동시 공개 · 판정 · 점수) → 결과까지 바로 돌아가는 골격과,
"3장 받아 2장 내서 숫자 합이 큰 쪽이 이긴다" 는 **예제 규칙 + 예제 봇**이 들어 있다.
새 카드게임은 이 템플릿으로 저장소를 만들고 규칙·봇·카드 표·대전 화면의 판 흐름만 갈아 끼운다.

| 항목 | 내용 |
|---|---|
| 화면 | 세로 전용. 기준 해상도 720×1280 — 가로 720 고정, 세로는 기기 비율대로 늘어난다 |
| 렌더 | vanilla.js WebGL2, UI 는 `NodeLayout` 빌더로 노드를 조립한다 |
| 그림 | 카드 틀·버튼·패널·배경은 로드 때 Canvas2D 그라데이션으로 구워 쓴다 (이미지 킷 불필요) |
| 글꼴 | Pretendard SemiBold(본문) / Black(숫자·제목) 서브셋 — OFL |
| 배포 | 웹(NAS dev/test) · 플레이스토어(AAB) · 앱스토어(Xcode) |


## 시작하기

```bash
# GitHub 에서 "Use this template" 로 새 저장소를 만든 뒤
git clone --recursive <새 저장소>
cd <새 저장소>
npm install                 # postinstall 이 서브모듈(libs/vanilla.js)을 체크아웃한다
npm run install:platforms   # 플레이스토어·앱스토어 래퍼 의존성 (스토어 빌드할 때만)
```

새 게임으로 바꿀 곳:

1. `package.json` 의 `name` — NAS 배포 폴더 이름이 된다.
2. `project-manifest.json` — 스토어 앱 아이디·이름·버전.
3. `src/game/constants.js` 의 `GAME_TITLE` / `GAME_SUBTITLE`, `webtemplate/index.html` 의 `<title>`, 파비콘.
4. `assets/data/cards.json`(카드 표), `assets/data/match.json`(판 수·손패·제한 시간).
5. `src/game/rules.js`(판정), `src/game/bot.js`(상대 수), `src/screen/battlescreen.js` 의 `playRound()`(판 흐름).


## 개발 실행

`launcher.html` 을 정적 서버로 연다. (VS Code Live Server — `Debug Local Live Server`, `http://127.0.0.1:6001/launcher.html`)
소스는 순수 ESM 이라 번들 없이 돈다. 개발 실행에서는 F2 로 엔진 개발자 도구가 열린다.


## 구조

```
src/
├── main.js                 # 씬: 자산 로드 → 텍스처 굽기 → 화면 생성·전환
├── game/
│   ├── constants.js        # 해상도·색·글자 크기·카드/버튼/패널 크기·경로
│   ├── cards.js            # 카드 표 (종류·카드·일러스트·덱 섞기)
│   ├── matchtable.js       # 대전 설정 표
│   ├── rules.js            # ★ 예제 규칙 (게임마다 교체)
│   ├── bot.js              # ★ 예제 봇 (게임마다 교체)
│   ├── textures.js         # Canvas2D 로 굽는 카드 틀·뒷면·빛무리·버튼·패널·배경
│   ├── motion.js           # 트윈을 Promise 로 감싼 연출 도우미 (await 로 순서를 잇는다)
│   ├── fonts.js / datatable.js
├── ui/
│   ├── cardview.js         # 카드 (앞뒷면·뒤집기·선택 빛무리·어둡게·바뀐 숫자 배지·도장)
│   ├── buttonview.js / taphandler.js   # 버튼 (뗀 순간 동작, 누름 축소)
│   ├── popupview.js        # 팝업 바탕 (딤 + 되튕김 등장)
│   ├── cardlistpopup.js    # 카드 목록 (드러난 카드 어둡게)
│   ├── confirmpopup.js / resultpopup.js / bannerview.js
└── screen/
    ├── basescreen.js       # 배경 + 가로 720 무대 + 안전영역 배치
    ├── titlescreen.js      # 로고 · 장식 카드 · 1:1 듀얼
    └── battlescreen.js     # ★ 대전 흐름 (playRound 를 게임에 맞게 고친다)
```

대전 흐름은 `async` 함수로 위에서 아래로 쓴다. 화면을 나가거나 새 매치를 시작하면 흐름 번호가 바뀌어
이전 흐름은 다음 `await` 뒤에서 스스로 멈춘다.


## 데이터

- `assets/data/cards.json` — `kinds`(종류별 틀 색: frameTop, frameBottom, frameBorder, accent) + `cards`(id, kind, value, name, description, art).
  `art` 가 비어 있으면 일러스트 대신 큰 숫자를 그린다.
- `assets/data/match.json` — roundCount, handSize, playCount, choiceSeconds, playerName, opponentName.
- `assets/data/artwork.json` — 그림 생성 목록 (아래).


## 그림 생성 (제미나이)

```bash
npm run artwork            # artwork.json 의 그림 중 아직 없는 것만
npm run artwork -- --force # 전부 다시
```

`.env` 의 `GOOGLE_GEMINI_V3_KEY` 로 제미나이 이미지 모델을 불러 그리고, 지정 크기로 줄여 JPEG 로 저장한다.
원본은 `tools/.artwork-raw/` 에 남는다 (커밋 안 함). 배경 그림을 쓰려면 `constants.js` 의 `BACKGROUND_IMAGE_PATH` 를 채운다.


## 웹 빌드 · NAS 배포

```bash
npm run build          # build/web (esbuild 번들 + assets + webtemplate)
npm run deploy:dev     # \\DS216PLUSII\web\ddukbaek2\dev\<name>  → https://dev.ddukbaek2.com/<name>/
npm run deploy:test    # \\DS216PLUSII\web\ddukbaek2\test\<name> → https://test.ddukbaek2.com/<name>/
```

`<name>` 은 `package.json` 의 `name`. 배포 때 `version.json`(커밋 해시·날짜)을 써서 타이틀 오른쪽 아래에 보인다.
미러링(robocopy /MIR, macOS 는 rsync --delete)이라 바뀐 파일만 교체한다.


## 스토어 빌드

먼저 `npm run build` 로 `build/web` 을 만든다. 버전은 `project-manifest.json` 에서 올린다.

| 명령 | 결과물 | 조건 |
|---|---|---|
| `npm run build:aab:playstore` | `platforms/playstore/android/app/build/outputs/bundle/release/app-release.aab` | Android SDK + Android Studio(JDK 17), 제출용은 `platforms/playstore/keystore.properties` |
| `npm run build:apk:playstore` | 키가 있으면 `.../apk/release/app-release.apk`, 없으면 `.../apk/debug/app-debug.apk` | 〃 |
| `npm run sync:appstore` → `npm run open:appstore` | Xcode 에서 서명 팀 지정 → Archive → App Store Connect | macOS + Xcode + CocoaPods |

- `android/`, `ios/` 네이티브 스캐폴드는 커밋하지 않는다. 첫 빌드 때 `npx cap add` 로 만들고, 매 빌드마다 **세로 고정**·버전·대상 SDK 를 패치한다.
- `keystore.properties` 형식: `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. (절대 커밋 금지)


## 브랜치

`dev`(기본, 개발) → `test`(검수, NAS test 배포) → `live`(출시, 스토어 빌드). 자세한 절차는 `docs/개발-프로세스.md`.


## 라이선스

코드 MIT. 글꼴 Pretendard 는 SIL OFL 1.1 (`assets/fonts/Pretendard-OFL.txt`).
