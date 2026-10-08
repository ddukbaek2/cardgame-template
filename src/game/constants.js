//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 게임 이름. (문서 제목과 타이틀 로고 글자)
//==============================================================================
export const GAME_TITLE = "CARD GAME";
export const GAME_SUBTITLE = "카드게임 템플릿";


//==============================================================================
// 기준 해상도. (모바일 세로 전용 — 가로 720 을 기준으로 맞추고 세로는 기기 비율대로 늘어난다)
//==============================================================================
export const REFERENCE_RESOLUTION_WIDTH = 720;
export const REFERENCE_RESOLUTION_HEIGHT = 1280;


//==============================================================================
// 화면 키.
//==============================================================================
export const Screen = System.Object.freeze({
	title: "title",
	battle: "battle",
});


//==============================================================================
// 글꼴. (본문 = 프리텐다드 세미볼드, 숫자·제목 = 프리텐다드 블랙)
//==============================================================================
export const FontFamily = System.Object.freeze({
	body: "GameBody",
	display: "GameDisplay",
});

export const FONT_PATHS = System.Object.freeze([
	{ family: FontFamily.body, path: "./assets/fonts/Pretendard-SemiBold.subset.woff2" },
	{ family: FontFamily.display, path: "./assets/fonts/Pretendard-Black.subset.woff2" },
]);


//==============================================================================
// 데이터 테이블 경로.
//==============================================================================
export const CARD_TABLE_PATH = "./assets/data/cards.json";
export const MATCH_TABLE_PATH = "./assets/data/match.json";


//==============================================================================
// 색. (어두운 밤하늘 바탕 + 금색 강조)
//==============================================================================
export const Colors = System.Object.freeze({
	backgroundTop: "#1a2150",
	backgroundBottom: "#05060f",
	backgroundGlow: "#3b2f7a",
	panel: "#141938",
	panelBorder: "#3d4a8c",
	dim: "#000000",
	textLight: "#f6f2ea",
	textMuted: "#9aa4cc",
	textDark: "#1b1206",
	gold: "#f5c451",
	goldDark: "#8a5a0e",
	goldLight: "#fff1b8",
	primaryTop: "#ffd36a",
	primaryBottom: "#e08a1e",
	primaryBorder: "#7a3f05",
	secondaryTop: "#4a5590",
	secondaryBottom: "#252c58",
	secondaryBorder: "#12163a",
	disabledTop: "#4a4d60",
	disabledBottom: "#2c2e3c",
	disabledBorder: "#16171f",
	player: "#56b4ff",
	opponent: "#ff6b7d",
	win: "#59f0b4",
	lose: "#ff5d73",
	draw: "#c6cbe6",
	timer: "#59f0b4",
	timerWarning: "#ff5d73",
	selectGlow: "#ffd36a",
	cardShadow: "#000000",
	cardBackTop: "#2d2f7c",
	cardBackBottom: "#120f3a",
	cardBackLine: "#f5c451",
});


//==============================================================================
// 글자 크기 단계. (화면 코드에 크기 숫자를 직접 쓰지 않는다)
//==============================================================================
export const FontSize = System.Object.freeze({
	caption: 22,
	small: 26,
	body: 30,
	button: 36,
	heading: 46,
	score: 64,
	banner: 64,
	title: 112,
});


//==============================================================================
// 카드 크기. (5:7 비율 — 손패 / 상대 손패 / 낸 카드 / 목록 / 상세)
//==============================================================================
export const CardSize = System.Object.freeze({
	hand: System.Object.freeze({ width: 170, height: 238 }),
	opponent: System.Object.freeze({ width: 110, height: 154 }),
	played: System.Object.freeze({ width: 130, height: 182 }),
	list: System.Object.freeze({ width: 116, height: 162 }),
	detail: System.Object.freeze({ width: 220, height: 308 }),
});


//==============================================================================
// 버튼 크기. (모양별로 미리 구워 둔다 — 나인슬라이스 없이 그대로 그린다)
//==============================================================================
export const ButtonSize = System.Object.freeze({
	large: System.Object.freeze({ width: 420, height: 116 }),
	medium: System.Object.freeze({ width: 300, height: 96 }),
	small: System.Object.freeze({ width: 136, height: 64 }),
});


//==============================================================================
// 패널 크기. (팝업 몸통 — 세로 최소 1280 화면에 들어가는 크기)
//==============================================================================
export const PanelSize = System.Object.freeze({
	cardList: System.Object.freeze({ width: 680, height: 1080 }),
	result: System.Object.freeze({ width: 580, height: 600 }),
	confirm: System.Object.freeze({ width: 580, height: 380 }),
});


//==============================================================================
// 배경 그림. (경로가 비어 있으면 그라데이션 배경을 굽는다 — 있으면 그 그림을 뷰를 덮도록 늘여 그린다)
//==============================================================================
export const BACKGROUND_IMAGE_PATH = "";
export const BACKGROUND_WIDTH = 720;
export const BACKGROUND_HEIGHT = 1600;


//==============================================================================
// 띠지 크기. (단계 안내 문구 뒤에 깔리는 가로 띠)
//==============================================================================
export const BANNER_WIDTH = 720;
export const BANNER_HEIGHT = 150;


//==============================================================================
// 텍스처를 굽는 배율. (기준 해상도 1 단위를 몇 픽셀로 구울지 — 고해상도 폰에서도 선명하게)
//==============================================================================
export const TEXTURE_BAKE_SCALE = 2;
