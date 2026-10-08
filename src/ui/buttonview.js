//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Sprite } from "../../libs/vanilla.js/src/core/component/sprite.js";
import { Text } from "../../libs/vanilla.js/src/core/component/text.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { Colors, ButtonSize, FontFamily, FontSize } from "../game/constants.js";
import { getFont } from "../game/fonts.js";
import { getTexture, getButtonTextureKey, ButtonStyle } from "../game/textures.js";
import { TapHandler } from "./taphandler.js";


//==============================================================================
// 버튼.
// - 구워 둔 알약 그림 + 글자 + 탭 처리. (뗀 순간에 동작)
// - 끄면 회색 그림으로 바뀌고 눌리지 않는다.
//==============================================================================
export class ButtonView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #node;
	/** @private @type { Sprite } */ #sprite;
	/** @private @type { Text } */ #labelText;
	/** @private @type { TapHandler } */ #tapHandler;
	/** @private @type { string } */ #style; // 켜져 있을 때의 ButtonStyle.
	/** @private @type { string } */ #sizeKey; // ButtonSize 키.
	/** @private @type { boolean } */ #isEnabled;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { string } name 노드 이름.
	 * @param { string } style ButtonStyle 값.
	 * @param { string } sizeKey ButtonSize 키.
	 * @param { string } label 글자.
	 * @param { Function } tapEvent () => void
	 */
	constructor(name, style, sizeKey, label, tapEvent) {
		this.#style = style;
		this.#sizeKey = sizeKey;
		this.#isEnabled = true;
		const buttonSize = ButtonSize[sizeKey];
		const textureKey = getButtonTextureKey(style, sizeKey);
		const texture = getTexture(textureKey);
		const bodyHeight = buttonSize.height * 0.92;
		const bodyFont = getFont(FontFamily.body);
		const labelFontSize = (sizeKey === "small") ? FontSize.small : FontSize.button;
		const labelColor = this.getLabelColor(style);
		this.#node = NodeLayout.create(WorldNode)
			.name(name)
			.pivot(Pivot.middleCenter)
			.contentSize(buttonSize.width, buttonSize.height)
			.apply((node) => {
				node.setInteractable(true);
			})
			.component(Sprite, (sprite) => {
				sprite.setImage(texture);
				this.#sprite = sprite;
			})
			.component(TapHandler, (tapHandler) => {
				tapHandler.setTapEvent(() => {
					tapEvent();
				});
				this.#tapHandler = tapHandler;
			})
			.children(
				NodeLayout.create(WorldNode)
					.name("label")
					.pivot(Pivot.middleCenter)
					.contentSize(buttonSize.width, bodyHeight)
					.localPosition(buttonSize.width * 0.5, bodyHeight * 0.5)
					.component(Text, (text) => {
						text.setFont(bodyFont);
						text.setFontSize(labelFontSize);
						text.setText(label);
						text.setTextColor(labelColor);
						this.#labelText = text;
					}),
			)
			.build();
	}

	//==============================================================================
	// 모양별 글자 색 반환.
	//==============================================================================
	/**
	 * @param { string } style
	 * @returns { string }
	 */
	getLabelColor(style) {
		if (style === ButtonStyle.primary) {
			return Colors.textDark;
		}
		if (style === ButtonStyle.disabled) {
			return Colors.textMuted;
		}
		return Colors.textLight;
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
	// 그림 반환.
	//==============================================================================
	/**
	 * @returns { Sprite }
	 */
	getSprite() {
		return this.#sprite;
	}

	//==============================================================================
	// 글자 컴포넌트 반환.
	//==============================================================================
	/**
	 * @returns { Text }
	 */
	getLabelText() {
		return this.#labelText;
	}

	//==============================================================================
	// 탭 처리 반환.
	//==============================================================================
	/**
	 * @returns { TapHandler }
	 */
	getTapHandler() {
		return this.#tapHandler;
	}

	//==============================================================================
	// 켜져 있을 때의 모양 반환.
	//==============================================================================
	/**
	 * @returns { string }
	 */
	getStyle() {
		return this.#style;
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
	// 켜짐 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isEnabled() {
		return this.#isEnabled;
	}

	//==============================================================================
	// 글자 바꾸기.
	//==============================================================================
	/**
	 * @param { string } label
	 */
	setLabel(label) {
		const labelText = this.getLabelText();
		labelText.setText(label);
	}

	//==============================================================================
	// 켜고 끄기. (끄면 회색 그림 + 흐린 글자 + 탭 무시)
	//==============================================================================
	/**
	 * @param { boolean } isEnabled
	 */
	setEnabled(isEnabled) {
		this.#isEnabled = isEnabled;
		const enabledStyle = this.getStyle();
		const style = isEnabled ? enabledStyle : ButtonStyle.disabled;
		const sizeKey = this.getSizeKey();
		const textureKey = getButtonTextureKey(style, sizeKey);
		const texture = getTexture(textureKey);
		const sprite = this.getSprite();
		sprite.setImage(texture);
		const labelColor = this.getLabelColor(style);
		const labelText = this.getLabelText();
		labelText.setTextColor(labelColor);
		const tapHandler = this.getTapHandler();
		tapHandler.setTapEnabled(isEnabled);
	}
}
