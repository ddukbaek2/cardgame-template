//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { Color } from "../../libs/vanilla.js/src/base/color.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Component } from "../../libs/vanilla.js/src/core/component.js";
import { Tween } from "../../libs/vanilla.js/src/core/tween.js";
import { Paint } from "../../libs/vanilla.js/src/core/component/paint.js";
import { Sprite } from "../../libs/vanilla.js/src/core/component/sprite.js";
import { Text } from "../../libs/vanilla.js/src/core/component/text.js";
import { Mask } from "../../libs/vanilla.js/src/core/component/mask.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { Colors, CardSize, FontFamily } from "../game/constants.js";
import { getFont } from "../game/fonts.js";
import { getCardKind, getCardArtImage } from "../game/cards.js";
import {
	getTexture, getCardTextureKey, getCardBackTextureKey, getCardGlowTextureKey, getCardGlowMargin,
	getCardArtWindow, getCardNamePlate, getCardValueGem, CardLayer,
} from "../game/textures.js";
import { animateNode } from "../game/motion.js";
import { TapHandler } from "./taphandler.js";


//==============================================================================
// 빛무리 맥동 컴포넌트. (선택된 카드의 빛이 천천히 숨 쉬듯 밝아졌다 어두워진다)
//==============================================================================
class GlowPulse extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { number } */ #elapsedSeconds;

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("GlowPulse");
		this.#elapsedSeconds = 0;
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
		const node = this.getNode();
		const opacity = 0.7 + System.Math.sin(elapsedSeconds * 4.2) * 0.3;
		node.setLocalOpacity(opacity);
	}
}


//==============================================================================
// 카드.
//
// 노드 구성. (위에서 아래 = 뒤에서 앞)
//   카드 ─ 그림자 / 빛무리 / 앞면(몸통·일러스트·덮개·숫자·이름) / 뒷면 / 어둡게 / 바뀐 숫자 / 도장
// - 카드 정의를 모르는 상태(상대의 숨긴 카드)로 만들 수 있고, 나중에 setCard 로 정체를 채운다.
// - 뒤집기는 가로 크기를 0 까지 줄였다가 면을 바꿔 다시 편다.
//==============================================================================
export class CardView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #node;
	/** @private @type { string } */ #sizeKey; // CardSize 키.
	/** @private @type { object } */ #card; // 카드 정의. (모르면 null)
	/** @private @type { boolean } */ #isFaceUp;
	/** @private @type { boolean } */ #isSelected;
	/** @private @type { WorldNode } */ #glowNode;
	/** @private @type { WorldNode } */ #faceNode;
	/** @private @type { WorldNode } */ #backNode;
	/** @private @type { WorldNode } */ #dimNode;
	/** @private @type { WorldNode } */ #artImageNode;
	/** @private @type { WorldNode } */ #placeholderNode;
	/** @private @type { WorldNode } */ #badgeNode;
	/** @private @type { WorldNode } */ #stampNode;
	/** @private @type { Sprite } */ #baseSprite;
	/** @private @type { Sprite } */ #overlaySprite;
	/** @private @type { Sprite } */ #artSprite;
	/** @private @type { Text } */ #placeholderText;
	/** @private @type { Text } */ #valueText;
	/** @private @type { Text } */ #nameText;
	/** @private @type { Paint } */ #badgePaint;
	/** @private @type { Text } */ #badgeText;
	/** @private @type { Paint } */ #stampPaint;
	/** @private @type { Text } */ #stampText;
	/** @private @type { TapHandler } */ #tapHandler;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } sizeKey CardSize 키.
	 * @param { object } card 카드 정의. (모르면 null)
	 * @param { boolean } isFaceUp
	 */
	constructor(sizeKey, card, isFaceUp) {
		this.#sizeKey = sizeKey;
		this.#card = null;
		this.#isFaceUp = isFaceUp;
		this.#isSelected = false;
		const cardSize = CardSize[sizeKey];
		const cardWidth = cardSize.width;
		const cardHeight = cardSize.height;
		const glowMargin = getCardGlowMargin(cardWidth);
		const glowTextureKey = getCardGlowTextureKey(sizeKey);
		const glowTexture = getTexture(glowTextureKey);
		const backTextureKey = getCardBackTextureKey(sizeKey);
		const backTexture = getTexture(backTextureKey);
		const artWindow = getCardArtWindow(cardWidth, cardHeight);
		const namePlate = getCardNamePlate(cardWidth, cardHeight);
		const valueGem = getCardValueGem(cardWidth);
		const bodyFont = getFont(FontFamily.body);
		const displayFont = getFont(FontFamily.display);
		const shadowColor = Color.createFromHEX(Colors.cardShadow);
		shadowColor.alpha = 1;
		const glowColor = Color.createFromHEX(Colors.selectGlow);
		const dimColor = Color.createFromHEX(Colors.dim);
		dimColor.alpha = 0.55;
		const stampColor = Color.createFromHEX(Colors.lose);
		stampColor.alpha = 0.85;

		this.#node = NodeLayout.create(WorldNode)
			.name("card")
			.pivot(Pivot.middleCenter)
			.contentSize(cardWidth, cardHeight)
			.component(TapHandler, (tapHandler) => {
				tapHandler.setPressScale(0.96);
				this.#tapHandler = tapHandler;
			})
			.children(
				NodeLayout.create(WorldNode)
					.name("shadow")
					.pivot(Pivot.middleCenter)
					.contentSize(cardWidth + glowMargin * 2, cardHeight + glowMargin * 2)
					.localPosition(cardWidth * 0.5, cardHeight * 0.5 + cardHeight * 0.035)
					.apply((node) => {
						node.setLocalOpacity(0.55);
					})
					.component(Sprite, (sprite) => {
						sprite.setImage(glowTexture);
						sprite.setColor(shadowColor);
					}),
				NodeLayout.create(WorldNode)
					.name("glow")
					.active(false)
					.pivot(Pivot.middleCenter)
					.contentSize(cardWidth + glowMargin * 2, cardHeight + glowMargin * 2)
					.localPosition(cardWidth * 0.5, cardHeight * 0.5)
					.apply((node) => {
						this.#glowNode = node;
					})
					.component(Sprite, (sprite) => {
						sprite.setImage(glowTexture);
						sprite.setColor(glowColor);
					})
					.component(GlowPulse),
				NodeLayout.create(WorldNode)
					.name("face")
					.pivot(Pivot.topLeft)
					.contentSize(cardWidth, cardHeight)
					.localPosition(0, 0)
					.apply((node) => {
						this.#faceNode = node;
					})
					.children(
						NodeLayout.create(WorldNode)
							.name("base")
							.pivot(Pivot.topLeft)
							.contentSize(cardWidth, cardHeight)
							.localPosition(0, 0)
							.component(Sprite, (sprite) => {
								this.#baseSprite = sprite;
							}),
						NodeLayout.create(WorldNode)
							.name("artWindow")
							.pivot(Pivot.topLeft)
							.contentSize(artWindow.width, artWindow.height)
							.localPosition(artWindow.x, artWindow.y)
							.component(Mask, (mask) => {
								mask.setRoundSize(artWindow.radius);
							})
							.children(
								NodeLayout.create(WorldNode)
									.name("artImage")
									.pivot(Pivot.topLeft)
									.contentSize(artWindow.width, artWindow.height)
									.localPosition(0, 0)
									.apply((node) => {
										this.#artImageNode = node;
									})
									.component(Sprite, (sprite) => {
										this.#artSprite = sprite;
									}),
								NodeLayout.create(WorldNode)
									.name("placeholder")
									.pivot(Pivot.middleCenter)
									.contentSize(artWindow.width, artWindow.height)
									.localPosition(artWindow.width * 0.5, artWindow.height * 0.56)
									.apply((node) => {
										this.#placeholderNode = node;
									})
									.component(Text, (text) => {
										text.setFont(displayFont);
										text.setFontSize(cardWidth * 0.46);
										this.#placeholderText = text;
									}),
							),
						NodeLayout.create(WorldNode)
							.name("overlay")
							.pivot(Pivot.topLeft)
							.contentSize(cardWidth, cardHeight)
							.localPosition(0, 0)
							.component(Sprite, (sprite) => {
								this.#overlaySprite = sprite;
							}),
						NodeLayout.create(WorldNode)
							.name("value")
							.pivot(Pivot.middleCenter)
							.contentSize(valueGem.radius * 2, valueGem.radius * 2)
							.localPosition(valueGem.centerX, valueGem.centerY + valueGem.radius * 0.06)
							.component(Text, (text) => {
								text.setFont(displayFont);
								text.setFontSize(valueGem.radius * 1.35);
								text.setTextColor(Colors.textLight);
								text.setStrokeColor(Colors.textDark);
								text.setStrokeWidth(System.Math.max(2, cardWidth * 0.03));
								this.#valueText = text;
							}),
						NodeLayout.create(WorldNode)
							.name("name")
							.pivot(Pivot.middleCenter)
							.contentSize(namePlate.width, namePlate.height)
							.localPosition(namePlate.x + namePlate.width * 0.5, namePlate.y + namePlate.height * 0.5)
							.component(Text, (text) => {
								text.setFont(bodyFont);
								text.setFontSize(cardWidth * 0.135);
								text.setTextColor(Colors.textLight);
								this.#nameText = text;
							}),
					),
				NodeLayout.create(WorldNode)
					.name("back")
					.pivot(Pivot.topLeft)
					.contentSize(cardWidth, cardHeight)
					.localPosition(0, 0)
					.apply((node) => {
						this.#backNode = node;
					})
					.component(Sprite, (sprite) => {
						sprite.setImage(backTexture);
					}),
				NodeLayout.create(WorldNode)
					.name("dim")
					.active(false)
					.pivot(Pivot.topLeft)
					.contentSize(cardWidth, cardHeight)
					.localPosition(0, 0)
					.apply((node) => {
						this.#dimNode = node;
					})
					.component(Paint, (paint) => {
						paint.setColor(dimColor);
						paint.setRoundSize(cardWidth * 0.08);
					}),
				NodeLayout.create(WorldNode)
					.name("badge")
					.active(false)
					.pivot(Pivot.middleCenter)
					.contentSize(valueGem.radius * 2.2, valueGem.radius * 2.2)
					.localPosition(valueGem.centerX, valueGem.centerY)
					.apply((node) => {
						this.#badgeNode = node;
					})
					.component(Paint, (paint) => {
						paint.setRoundSize(valueGem.radius * 1.1);
						this.#badgePaint = paint;
					})
					.children(
						NodeLayout.create(WorldNode)
							.name("badgeValue")
							.pivot(Pivot.middleCenter)
							.contentSize(valueGem.radius * 2.2, valueGem.radius * 2.2)
							.localPosition(valueGem.radius * 1.1, valueGem.radius * 1.16)
							.component(Text, (text) => {
								text.setFont(displayFont);
								text.setFontSize(valueGem.radius * 1.35);
								text.setTextColor(Colors.textLight);
								text.setStrokeColor(Colors.textDark);
								text.setStrokeWidth(System.Math.max(2, cardWidth * 0.03));
								this.#badgeText = text;
							}),
					),
				NodeLayout.create(WorldNode)
					.name("stamp")
					.active(false)
					.pivot(Pivot.middleCenter)
					.contentSize(cardWidth * 0.92, cardHeight * 0.2)
					.localPosition(cardWidth * 0.5, cardHeight * 0.42)
					.apply((node) => {
						node.setLocalRotation(-14);
						this.#stampNode = node;
					})
					.component(Paint, (paint) => {
						paint.setColor(stampColor);
						paint.setRoundSize(cardWidth * 0.04);
						this.#stampPaint = paint;
					})
					.children(
						NodeLayout.create(WorldNode)
							.name("stampLabel")
							.pivot(Pivot.middleCenter)
							.contentSize(cardWidth * 0.92, cardHeight * 0.2)
							.localPosition(cardWidth * 0.46, cardHeight * 0.1)
							.component(Text, (text) => {
								text.setFont(displayFont);
								text.setFontSize(cardWidth * 0.15);
								text.setTextColor(Colors.textLight);
								this.#stampText = text;
							}),
					),
			)
			.build();

		this.setCard(card);
		this.applyFace();
	}

	//==============================================================================
	// 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getNode() {
		return this.#node;
	}

	//==============================================================================
	// 크기 키 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getSizeKey() {
		return this.#sizeKey;
	}

	//==============================================================================
	// 카드 정의 반환. (모르면 null)
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getCard() {
		return this.#card;
	}

	//==============================================================================
	// 앞면이 보이는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isFaceUp() {
		return this.#isFaceUp;
	}

	//==============================================================================
	// 선택 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isSelected() {
		return this.#isSelected;
	}

	//==============================================================================
	// 부품 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getGlowNode() {
		return this.#glowNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getFaceNode() {
		return this.#faceNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getBackNode() {
		return this.#backNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getDimNode() {
		return this.#dimNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getArtImageNode() {
		return this.#artImageNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getPlaceholderNode() {
		return this.#placeholderNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getBadgeNode() {
		return this.#badgeNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getStampNode() {
		return this.#stampNode;
	}

	//==============================================================================
	// 부품 컴포넌트 반환.
	//==============================================================================
	/**
	 * @returns { Sprite }
	 */
	getBaseSprite() {
		return this.#baseSprite;
	}

	/**
	 * @returns { Sprite }
	 */
	getOverlaySprite() {
		return this.#overlaySprite;
	}

	/**
	 * @returns { Sprite }
	 */
	getArtSprite() {
		return this.#artSprite;
	}

	/**
	 * @returns { Text }
	 */
	getPlaceholderText() {
		return this.#placeholderText;
	}

	/**
	 * @returns { Text }
	 */
	getValueText() {
		return this.#valueText;
	}

	/**
	 * @returns { Text }
	 */
	getNameText() {
		return this.#nameText;
	}

	/**
	 * @returns { Paint }
	 */
	getBadgePaint() {
		return this.#badgePaint;
	}

	/**
	 * @returns { Text }
	 */
	getBadgeText() {
		return this.#badgeText;
	}

	/**
	 * @returns { Paint }
	 */
	getStampPaint() {
		return this.#stampPaint;
	}

	/**
	 * @returns { Text }
	 */
	getStampText() {
		return this.#stampText;
	}

	/**
	 * @returns { TapHandler }
	 */
	getTapHandler() {
		return this.#tapHandler;
	}

	//==============================================================================
	// 카드 정체 채우기. (종류 틀·일러스트·숫자·이름을 바꾼다 — null 이면 뒷면만 쓸 수 있다)
	//==============================================================================
	/**
	 * @param { object } card
	 */
	setCard(card) {
		this.#card = card;
		if (card === null || card === undefined) {
			return;
		}
		const sizeKey = this.getSizeKey();
		const baseTextureKey = getCardTextureKey(CardLayer.base, card.kind, sizeKey);
		const baseTexture = getTexture(baseTextureKey);
		const overlayTextureKey = getCardTextureKey(CardLayer.overlay, card.kind, sizeKey);
		const overlayTexture = getTexture(overlayTextureKey);
		const baseSprite = this.getBaseSprite();
		baseSprite.setImage(baseTexture);
		const overlaySprite = this.getOverlaySprite();
		overlaySprite.setImage(overlayTexture);

		const artImage = getCardArtImage(card.id);
		const artSprite = this.getArtSprite();
		artSprite.setImage(artImage);
		const hasArt = artImage !== null;
		const artImageNode = this.getArtImageNode();
		artImageNode.setActive(hasArt);
		const placeholderNode = this.getPlaceholderNode();
		placeholderNode.setActive(!hasArt);
		const kind = getCardKind(card.kind);
		const placeholderText = this.getPlaceholderText();
		const valueLabel = `${card.value}`;
		placeholderText.setText(valueLabel);
		if (kind !== null) {
			placeholderText.setTextColor(kind.accent);
		}

		const valueText = this.getValueText();
		valueText.setText(valueLabel);
		const nameText = this.getNameText();
		nameText.setText(card.name);
	}

	//==============================================================================
	// 앞뒷면 즉시 바꾸기.
	//==============================================================================
	/**
	 * @param { boolean } isFaceUp
	 */
	setFaceUp(isFaceUp) {
		this.#isFaceUp = isFaceUp;
		this.applyFace();
	}

	//==============================================================================
	// 앞뒷면 노드 반영. (정체를 모르면 앞면이어도 뒷면을 보인다)
	//==============================================================================
	applyFace() {
		const isFaceUp = this.isFaceUp();
		const card = this.getCard();
		const isFaceVisible = isFaceUp && card !== null;
		const faceNode = this.getFaceNode();
		faceNode.setActive(isFaceVisible);
		const backNode = this.getBackNode();
		backNode.setActive(!isFaceVisible);
	}

	//==============================================================================
	// 뒤집기 연출. (가로로 접었다 펴며 면을 바꾼다)
	//==============================================================================
	/**
	 * @param { object } scene
	 * @param { boolean } isFaceUp 뒤집은 뒤의 면.
	 * @param { number } duration 전체 시간.
	 * @returns { Promise<void> }
	 */
	async flip(scene, isFaceUp, duration) {
		const node = this.getNode();
		const localScale = node.getLocalScale();
		const restoreScaleX = localScale.x;
		await animateNode(scene, node, { scaleX: 0 }, duration * 0.5, Tween.easingFunction.quadratic.in);
		this.setFaceUp(isFaceUp);
		await animateNode(scene, node, { scaleX: restoreScaleX }, duration * 0.5, Tween.easingFunction.back.out);
	}

	//==============================================================================
	// 선택 표시. (금빛 빛무리)
	//==============================================================================
	/**
	 * @param { boolean } isSelected
	 */
	setSelected(isSelected) {
		this.#isSelected = isSelected;
		const glowNode = this.getGlowNode();
		glowNode.setActive(isSelected);
	}

	//==============================================================================
	// 빛무리 색 바꾸기. (선택 말고도 승리·패배 강조에 쓴다)
	//==============================================================================
	/**
	 * @param { boolean } isVisible
	 * @param { string } colorHex
	 */
	setGlow(isVisible, colorHex) {
		const glowNode = this.getGlowNode();
		glowNode.setActive(isVisible);
		if (!isVisible) {
			return;
		}
		const glowSprite = glowNode.getComponent(Sprite);
		const glowColor = Color.createFromHEX(colorHex);
		glowSprite.setColor(glowColor);
	}

	//==============================================================================
	// 어둡게. (효과가 꺼진 카드·고르지 않은 카드)
	//==============================================================================
	/**
	 * @param { boolean } isDimmed
	 */
	setDimmed(isDimmed) {
		const dimNode = this.getDimNode();
		dimNode.setActive(isDimmed);
	}

	//==============================================================================
	// 바뀐 숫자 표시. (판정 중 숫자가 바뀐 카드 — null 이면 감춘다)
	//==============================================================================
	/**
	 * @param { number } value
	 * @param { string } colorHex 배지 바탕색.
	 */
	setValueOverride(value, colorHex) {
		const badgeNode = this.getBadgeNode();
		if (value === null || value === undefined) {
			badgeNode.setActive(false);
			return;
		}
		badgeNode.setActive(true);
		const badgePaint = this.getBadgePaint();
		const badgeColor = Color.createFromHEX(colorHex);
		badgePaint.setColor(badgeColor);
		const badgeText = this.getBadgeText();
		const valueLabel = `${value}`;
		badgeText.setText(valueLabel);
	}

	//==============================================================================
	// 도장. (카드 위에 비스듬히 찍는 글자 — null 이면 감춘다)
	//==============================================================================
	/**
	 * @param { string } label
	 * @param { string } colorHex 도장 바탕색.
	 */
	setStamp(label, colorHex) {
		const stampNode = this.getStampNode();
		if (label === null || label === undefined || label === "") {
			stampNode.setActive(false);
			return;
		}
		stampNode.setActive(true);
		const stampPaint = this.getStampPaint();
		const stampColor = Color.createFromHEX(colorHex);
		stampColor.alpha = 0.88;
		stampPaint.setColor(stampColor);
		const stampText = this.getStampText();
		stampText.setText(label);
	}

	//==============================================================================
	// 탭 받기 설정. (켜면 노드가 터치를 받는다)
	//==============================================================================
	/**
	 * @param { boolean } isTappable
	 * @param { Function } tapEvent (cardView) => void — 끌 때는 null.
	 */
	setTappable(isTappable, tapEvent) {
		const node = this.getNode();
		node.setInteractable(isTappable);
		const tapHandler = this.getTapHandler();
		tapHandler.setTapEnabled(isTappable);
		if (tapEvent === null || tapEvent === undefined) {
			tapHandler.setTapEvent(null);
			return;
		}
		tapHandler.setTapEvent(() => {
			tapEvent(this);
		});
	}

	//==============================================================================
	// 노드 위치 바로 놓기.
	//==============================================================================
	/**
	 * @param { number } x
	 * @param { number } y
	 */
	setPosition(x, y) {
		const node = this.getNode();
		const position = Vector2.create(x, y);
		node.setLocalPosition(position);
	}
}
