//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { Rect } from "../../libs/vanilla.js/src/base/rect.js";
import { Color } from "../../libs/vanilla.js/src/base/color.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Component } from "../../libs/vanilla.js/src/core/component.js";
import { Text, TextAlign, TextBaseline } from "../../libs/vanilla.js/src/core/component/text.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { ParticleSystem, ParticleEmitterShape } from "../../libs/vanilla.js/src/effect/particlesystem.js";
import { Colors, FontFamily, FontSize, GAME_TITLE, GAME_SUBTITLE, REFERENCE_RESOLUTION_WIDTH } from "../game/constants.js";
import { getFont } from "../game/fonts.js";
import { getCardDefinitions } from "../game/cards.js";
import { getTexture, TextureKey, ButtonStyle } from "../game/textures.js";
import { ButtonView } from "../ui/buttonview.js";
import { CardView } from "../ui/cardview.js";
import { BaseScreen } from "./basescreen.js";


//==============================================================================
// 둥실 컴포넌트. (제자리에서 천천히 위아래로 떠 있다 — 타이틀 장식 카드)
//==============================================================================
class FloatMotion extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #elapsedSeconds;
	/** @private @type { number } */ #phase; // 카드마다 박자를 어긋나게 한다.
	/** @private @type { number } */ #restY; // 떠 있는 기준 높이.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("FloatMotion");
		this.#elapsedSeconds = 0;
		this.#phase = 0;
		this.#restY = 0;
	}

	//==============================================================================
	// 박자 설정.
	//==============================================================================
	/**
	 * @param { number } phase
	 */
	setPhase(phase) {
		this.#phase = phase;
	}

	//==============================================================================
	// 박자 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPhase() {
		return this.#phase;
	}

	//==============================================================================
	// 기준 높이 설정.
	//==============================================================================
	/**
	 * @param { number } restY
	 */
	setRestY(restY) {
		this.#restY = restY;
	}

	//==============================================================================
	// 기준 높이 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRestY() {
		return this.#restY;
	}

	//==============================================================================
	// 경과 시간 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getElapsedSeconds() {
		return this.#elapsedSeconds;
	}

	//==============================================================================
	// 갱신.
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		this.#elapsedSeconds += timeDelta;
		const elapsedSeconds = this.getElapsedSeconds();
		const phase = this.getPhase();
		const restY = this.getRestY();
		const node = this.getNode();
		const localPosition = node.getLocalPosition();
		const floatY = restY + System.Math.sin(elapsedSeconds * 1.3 + phase) * 9;
		const floatPosition = Vector2.create(localPosition.x, floatY);
		node.setLocalPosition(floatPosition);
	}
}


//==============================================================================
// 장식 카드 배치. (가운데 기준 가로 간격·회전)
//==============================================================================
const SHOWCASE_CARD_OFFSETS = System.Object.freeze([
	System.Object.freeze({ x: -170, y: 30, rotation: -14 }),
	System.Object.freeze({ x: 170, y: 30, rotation: 14 }),
	System.Object.freeze({ x: 0, y: 0, rotation: 0 }),
]);


//==============================================================================
// 타이틀 화면.
// - 로고 + 펼친 장식 카드 + 1:1 듀얼 버튼 + 버전 표기.
//==============================================================================
export class TitleScreen extends BaseScreen {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #logoNode;
	/** @private @type { WorldNode } */ #subtitleNode;
	/** @private @type { CardView[] } */ #showcaseCardViews;
	/** @private @type { ButtonView } */ #duelButton;
	/** @private @type { WorldNode } */ #versionNode;
	/** @private @type { WorldNode } */ #sparkleNode;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } scene
	 */
	constructor(scene) {
		const backgroundImage = getTexture(TextureKey.background);
		super(scene, "titleScreen", backgroundImage);
		this.#showcaseCardViews = [];
		const stageNode = this.getStageNode();
		const displayFont = getFont(FontFamily.display);
		const bodyFont = getFont(FontFamily.body);
		const sparkleStartColor = Color.createFromHEX(Colors.goldLight);
		const sparkleEndColor = Color.createFromHEX(Colors.gold);
		sparkleEndColor.alpha = 0;
		const sparkleFadeColor = Color.createFromHEX(Colors.goldLight);
		sparkleFadeColor.alpha = 0;

		this.#sparkleNode = NodeLayout.create(WorldNode)
			.name("sparkle")
			.pivot(Pivot.middleCenter)
			.component(ParticleSystem, (particleSystem) => {
				particleSystem.setEmitterShape(ParticleEmitterShape.box);
				particleSystem.setEmissionRate(7);
				particleSystem.setStartLifetime(3.5, 6.5);
				particleSystem.setStartSpeed(14, 42);
				particleSystem.setStartSize(3, 8);
				particleSystem.setStartColor(sparkleStartColor, sparkleEndColor);
				particleSystem.setColorOverLifetime([
					{ time: 0, color: sparkleFadeColor },
					{ time: 0.25, color: sparkleStartColor },
					{ time: 1, color: sparkleFadeColor },
				]);
				particleSystem.setWobble(10, 1.4);
				particleSystem.setAdditive(true);
			})
			.build(stageNode);

		// 장식 카드. (카드 표 앞쪽 카드 몇 장을 펼친다 — 카드가 모자라면 있는 만큼만)
		const cards = getCardDefinitions();
		const showcaseCount = System.Math.min(SHOWCASE_CARD_OFFSETS.length, cards.length);
		for (let index = 0; index < showcaseCount; ++index) {
			const showcaseOffset = SHOWCASE_CARD_OFFSETS[index];
			const card = cards[cards.length - 1 - index];
			const cardView = new CardView("detail", card, true);
			const cardNode = cardView.getNode();
			cardNode.setLocalRotation(showcaseOffset.rotation);
			const floatMotion = cardNode.addComponent(FloatMotion);
			floatMotion.setPhase(index * 1.7);
			stageNode.addChild(cardNode);
			const showcaseCardViews = this.getShowcaseCardViews();
			showcaseCardViews.push(cardView);
		}

		this.#logoNode = NodeLayout.create(WorldNode)
			.name("logo")
			.pivot(Pivot.middleCenter)
			.contentSize(REFERENCE_RESOLUTION_WIDTH, FontSize.title * 1.3)
			.component(Text, (text) => {
				text.setFont(displayFont);
				text.setFontSize(FontSize.title);
				text.setText(GAME_TITLE);
				text.setTextColor(Colors.goldLight);
				text.setStrokeColor(Colors.goldDark);
				text.setStrokeWidth(10);
			})
			.build(stageNode);

		this.#subtitleNode = NodeLayout.create(WorldNode)
			.name("subtitle")
			.pivot(Pivot.middleCenter)
			.contentSize(REFERENCE_RESOLUTION_WIDTH, FontSize.body * 1.4)
			.component(Text, (text) => {
				text.setFont(bodyFont);
				text.setFontSize(FontSize.body);
				text.setText(GAME_SUBTITLE);
				text.setTextColor(Colors.textLight);
				text.setStrokeColor(Colors.textDark);
				text.setStrokeWidth(5);
			})
			.build(stageNode);

		this.#duelButton = new ButtonView("duelButton", ButtonStyle.primary, "large", "1:1 듀얼", () => {
			const currentScene = this.getScene();
			currentScene.startDuel();
		});
		const duelButton = this.getDuelButton();
		const duelButtonNode = duelButton.getNode();
		stageNode.addChild(duelButtonNode);

		this.#versionNode = NodeLayout.create(WorldNode)
			.name("version")
			.pivot(Pivot.bottomRight)
			.contentSize(REFERENCE_RESOLUTION_WIDTH, FontSize.caption * 1.4)
			.component(Text, (text) => {
				text.setFont(bodyFont);
				text.setFontSize(FontSize.caption);
				text.setTextAlign(TextAlign.right);
				text.setTextBaseline(TextBaseline.bottom);
				text.setTextColor(Colors.textMuted);
			})
			.build(stageNode);
	}

	//==============================================================================
	// 부품 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getLogoNode() {
		return this.#logoNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getSubtitleNode() {
		return this.#subtitleNode;
	}

	/**
	 * @returns { CardView[] }
	 */
	getShowcaseCardViews() {
		return this.#showcaseCardViews;
	}

	/**
	 * @returns { ButtonView }
	 */
	getDuelButton() {
		return this.#duelButton;
	}

	/**
	 * @returns { WorldNode }
	 */
	getVersionNode() {
		return this.#versionNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getSparkleNode() {
		return this.#sparkleNode;
	}

	//==============================================================================
	// 버전 표기 바꾸기. (배포 빌드의 version.json — 없으면 빈 글자)
	//==============================================================================
	/**
	 * @param { string } versionLabel
	 */
	setVersionLabel(versionLabel) {
		const versionNode = this.getVersionNode();
		const versionText = versionNode.getComponent(Text);
		versionText.setText(versionLabel);
	}

	//==============================================================================
	// 배치. (세로 길이에 비례해 로고·카드·버튼 높이를 나눈다)
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewSize
	 * @param { Rect } safeAreaRect
	 */
	layout(viewSize, safeAreaRect) {
		super.layout(viewSize, safeAreaRect);
		const top = safeAreaRect.position.y;
		const height = safeAreaRect.size.y;
		const centerX = REFERENCE_RESOLUTION_WIDTH * 0.5;

		const sparkleNode = this.getSparkleNode();
		const sparklePosition = Vector2.create(centerX, viewSize.y * 0.5);
		sparkleNode.setLocalPosition(sparklePosition);
		const sparkleSystem = sparkleNode.getComponent(ParticleSystem);
		sparkleSystem.setBoxSize(REFERENCE_RESOLUTION_WIDTH, viewSize.y);

		const logoNode = this.getLogoNode();
		const logoPosition = Vector2.create(centerX, top + height * 0.2);
		logoNode.setLocalPosition(logoPosition);
		const subtitleNode = this.getSubtitleNode();
		const subtitlePosition = Vector2.create(centerX, top + height * 0.2 + FontSize.title * 0.78);
		subtitleNode.setLocalPosition(subtitlePosition);

		const showcaseCardViews = this.getShowcaseCardViews();
		const showcaseCenterY = top + height * 0.5;
		for (let index = 0; index < showcaseCardViews.length; ++index) {
			const showcaseOffset = SHOWCASE_CARD_OFFSETS[index];
			const cardView = showcaseCardViews[index];
			const restY = showcaseCenterY + showcaseOffset.y;
			cardView.setPosition(centerX + showcaseOffset.x, restY);
			const cardNode = cardView.getNode();
			const floatMotion = cardNode.getComponent(FloatMotion);
			floatMotion.setRestY(restY);
		}

		const duelButton = this.getDuelButton();
		const duelButtonNode = duelButton.getNode();
		const duelButtonPosition = Vector2.create(centerX, top + height * 0.8);
		duelButtonNode.setLocalPosition(duelButtonPosition);

		const versionNode = this.getVersionNode();
		const versionPosition = Vector2.create(REFERENCE_RESOLUTION_WIDTH - 20, top + height - 12);
		versionNode.setLocalPosition(versionPosition);
	}
}
