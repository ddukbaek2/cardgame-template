//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../libs/vanilla.js/src/base/vector2.js";
import { Rect } from "../libs/vanilla.js/src/base/rect.js";
import { Color } from "../libs/vanilla.js/src/base/color.js";
import { Engine, EngineConfiguration } from "../libs/vanilla.js/src/core/engine.js";
import { Graphic } from "../libs/vanilla.js/src/core/graphic.js";
import { GameScene } from "../libs/vanilla.js/src/game/gamescene.js";
import {
	GAME_TITLE, Colors, Screen, CARD_TABLE_PATH, MATCH_TABLE_PATH,
	REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT,
} from "./game/constants.js";
import { loadDataTable } from "./game/datatable.js";
import { setCardTable, loadCardArtImages } from "./game/cards.js";
import { setMatchTable } from "./game/matchtable.js";
import { loadFonts } from "./game/fonts.js";
import { bakeTextures } from "./game/textures.js";
import { TitleScreen } from "./screen/titlescreen.js";
import { BattleScreen } from "./screen/battlescreen.js";


//==============================================================================
// 카드게임 메인 씬. (자산 로드 + 화면 라우팅)
//
// 화면은 루트 아래의 노드이고 한 번에 하나만 켜져 있다.
//   타이틀 ─ 1:1 듀얼 ─→ 대전 ─ 나가기 / 타이틀로 ─→ 타이틀
// 자산 로드(loadAssets) → 텍스처 굽기 → 화면 생성(initialize) 순서로 돈다.
//==============================================================================
class CardGameScene extends GameScene {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #screens;
	/** @private @type { string } */ #currentScreenKey;
	/** @private @type { string } */ #versionLabel; // 배포 빌드의 version.json. (개발 실행에서는 빈 글자)
	/** @private @type { boolean } */ #isReady; // 화면을 다 만들었는지. (그 전의 크기 변경은 무시한다)
	/** @private @type { number } */ #loadProgress; // 로딩 화면 막대. (0 ~ 1)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.#screens = {};
		this.#currentScreenKey = "";
		this.#versionLabel = "";
		this.#isReady = false;
		this.#loadProgress = 0;
		this.setLoadingMinDurationMs(600);
		const backgroundColor = Color.createFromHEX(Colors.backgroundBottom);
		this.setSceneBackgroundColor(backgroundColor);
	}

	//==============================================================================
	// 화면 목록 반환.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getScreens() {
		return this.#screens;
	}

	//==============================================================================
	// 지금 화면 키 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getCurrentScreenKey() {
		return this.#currentScreenKey;
	}

	//==============================================================================
	// 버전 표기 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getVersionLabel() {
		return this.#versionLabel;
	}

	//==============================================================================
	// 화면 준비 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isReady() {
		return this.#isReady;
	}

	//==============================================================================
	// 로드 진행률 반환. (0 ~ 1)
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getLoadProgress() {
		return this.#loadProgress;
	}

	//==============================================================================
	// 로딩 화면. (짙은 바탕 + 금색 진행 막대 — 글꼴이 오기 전이라 글자는 쓰지 않는다)
	//==============================================================================
	/**
	 * @override
	 * @param { Graphic } graphic
	 */
	drawOnLoad(graphic) {
		const engine = this.getEngine();
		if (engine === null || engine === undefined) {
			return;
		}
		const viewManager = engine.getViewManager();
		const canvasNativeSize = viewManager.getCanvasNativeSize();
		const viewSize = viewManager.getViewSize();
		viewManager.applyCanvasNativeRect(graphic);
		graphic.setFillColor(Colors.backgroundBottom);
		const canvasRect = Rect.create(0, 0, canvasNativeSize.x, canvasNativeSize.y);
		graphic.drawRect(canvasRect);
		viewManager.applyViewRect(graphic);

		const barWidth = System.Math.min(viewSize.x * 0.6, 420);
		const barHeight = 12;
		const barX = (viewSize.x - barWidth) * 0.5;
		const barY = viewSize.y * 0.56;
		graphic.setFillColor(Colors.panel);
		const trackRect = Rect.create(barX, barY, barWidth, barHeight);
		graphic.drawRoundRect(trackRect, barHeight * 0.5);
		const loadProgress = this.getLoadProgress();
		const fillWidth = System.Math.max(barHeight, barWidth * loadProgress);
		graphic.setFillColor(Colors.gold);
		const fillRect = Rect.create(barX, barY, fillWidth, barHeight);
		graphic.drawRoundRect(fillRect, barHeight * 0.5);
	}

	//==============================================================================
	// 자산 로드. (버전 → 글꼴 → 데이터 테이블 → 카드 일러스트 → 텍스처 굽기)
	//==============================================================================
	/**
	 * @override
	 */
	async loadAssets() {
		await super.loadAssets();
		this.#loadProgress = 0;

		// 빌드 정보. (배포 때 만드는 version.json — 없으면 표기 생략)
		try {
			const response = await System.window.fetch("./version.json", { cache: "no-cache" });
			if (response.ok) {
				const versionData = await response.json();
				this.#versionLabel = `${versionData.hash} · ${versionData.date}`;
			}
		}
		catch (error) {
			console.error(error);
		}

		await loadFonts();
		this.#loadProgress = 0.25;

		const cardTable = await loadDataTable(CARD_TABLE_PATH);
		setCardTable(cardTable);
		const matchTable = await loadDataTable(MATCH_TABLE_PATH);
		setMatchTable(matchTable);
		this.#loadProgress = 0.35;

		await loadCardArtImages();
		this.#loadProgress = 0.7;
		await bakeTextures();
		this.#loadProgress = 1;
	}

	//==============================================================================
	// 초기화. (화면 생성 — 엔진이 로드 뒤에 부른다)
	//==============================================================================
	/**
	 * @override
	 * @param { Engine } engine
	 */
	initialize(engine) {
		super.initialize(engine);
		const viewManager = engine.getViewManager();
		viewManager.applyAspectViewScaleMode();

		const root = this.getRoot();
		const screens = this.getScreens();
		screens[Screen.title] = new TitleScreen(this);
		screens[Screen.battle] = new BattleScreen(this);
		const screenKeys = System.Object.keys(screens);
		for (let index = 0; index < screenKeys.length; ++index) {
			const screen = screens[screenKeys[index]];
			const screenNode = screen.getNode();
			root.addChild(screenNode);
		}
		const titleScreen = screens[Screen.title];
		const versionLabel = this.getVersionLabel();
		titleScreen.setVersionLabel(versionLabel);

		this.#isReady = true;
		this.layout();
		this.changeScreen(Screen.title);
	}

	//==============================================================================
	// 화면 크기 변경됨. (종횡비에 맞는 뷰 모드를 다시 고른다)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } canvasNativeSize
	 */
	resize(canvasNativeSize) {
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		viewManager.applyAspectViewScaleMode();
		const isReady = this.isReady();
		if (!isReady) {
			return;
		}
		super.resize(canvasNativeSize);
	}

	//==============================================================================
	// 배치. (뷰 크기·안전영역이 바뀌면 GameScene 이 부른다)
	//==============================================================================
	/**
	 * @override
	 */
	layout() {
		super.layout();
		const isReady = this.isReady();
		if (!isReady) {
			return;
		}
		const engine = this.getEngine();
		const viewManager = engine.getViewManager();
		const viewSize = viewManager.getViewSize();
		const root = this.getRoot();
		const rootSize = Vector2.create(viewSize.x, viewSize.y);
		root.setContentSize(rootSize);
		const safeAreaRect = this.getSafeAreaRect();
		const screens = this.getScreens();
		const screenKeys = System.Object.keys(screens);
		for (let index = 0; index < screenKeys.length; ++index) {
			const screen = screens[screenKeys[index]];
			screen.layout(viewSize, safeAreaRect);
		}
	}

	//==============================================================================
	// 갱신. (켜진 화면만)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const screens = this.getScreens();
		const currentScreenKey = this.getCurrentScreenKey();
		const currentScreen = screens[currentScreenKey];
		if (currentScreen === undefined) {
			return;
		}
		currentScreen.tick(timeDelta);
	}

	//==============================================================================
	// 화면 전환.
	//==============================================================================
	/**
	 * @param { string } screenKey
	 */
	changeScreen(screenKey) {
		const screens = this.getScreens();
		const currentScreenKey = this.getCurrentScreenKey();
		const currentScreen = screens[currentScreenKey];
		if (currentScreen !== undefined) {
			currentScreen.onExit();
		}
		this.#currentScreenKey = screenKey;
		const nextScreen = screens[screenKey];
		nextScreen.onEnter();
	}

	//==============================================================================
	// 1:1 듀얼 시작. (타이틀 버튼)
	//==============================================================================
	startDuel() {
		this.changeScreen(Screen.battle);
	}
}


//==============================================================================
// 엔진 기동.
//==============================================================================
const engineConfiguration = new EngineConfiguration();
engineConfiguration.referenceResolutionSize = Vector2.create(REFERENCE_RESOLUTION_WIDTH, REFERENCE_RESOLUTION_HEIGHT);
engineConfiguration.autoResizeOnWindowResize = true;
engineConfiguration.useStatistics = false;
engineConfiguration.title = GAME_TITLE;
engineConfiguration.defaultFontUrl = "";
engineConfiguration.maximumFramePerSecond = 60;
// 개발자 도구(F2)는 개발 실행(launcher.html)에서만 켠다.
const pathName = System.location.pathname;
engineConfiguration.useDevTools = pathName.endsWith("launcher.html");
const engine = new Engine(engineConfiguration);
const scene = new CardGameScene();
engine.run(scene);
