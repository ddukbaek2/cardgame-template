//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Tween } from "../../libs/vanilla.js/src/core/tween.js";
import { Sprite } from "../../libs/vanilla.js/src/core/component/sprite.js";
import { Text } from "../../libs/vanilla.js/src/core/component/text.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { Colors, FontFamily, FontSize, BANNER_WIDTH, BANNER_HEIGHT } from "../game/constants.js";
import { getFont } from "../game/fonts.js";
import { getTexture, TextureKey } from "../game/textures.js";
import { animateNode, waitSeconds } from "../game/motion.js";


//==============================================================================
// 띠지.
// - 화면 가운데를 가로지르는 띠 위에 큰 글자와 작은 설명을 띄운다. (단계 안내·판 결과)
// - 옆에서 미끄러져 들어와 잠시 머물고 사라진다.
//==============================================================================
export class BannerView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #node;
	/** @private @type { Text } */ #titleText;
	/** @private @type { Text } */ #subtitleText;
	/** @private @type { number } */ #restX; // 머무는 자리의 가로 위치.

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		this.#restX = 0;
		const bannerTexture = getTexture(TextureKey.banner);
		const displayFont = getFont(FontFamily.display);
		const bodyFont = getFont(FontFamily.body);
		this.#node = NodeLayout.create(WorldNode)
			.name("banner")
			.active(false)
			.pivot(Pivot.middleCenter)
			.contentSize(BANNER_WIDTH, BANNER_HEIGHT)
			.component(Sprite, (sprite) => {
				sprite.setImage(bannerTexture);
			})
			.children(
				NodeLayout.create(WorldNode)
					.name("title")
					.pivot(Pivot.middleCenter)
					.contentSize(BANNER_WIDTH, BANNER_HEIGHT * 0.5)
					.localPosition(BANNER_WIDTH * 0.5, BANNER_HEIGHT * 0.42)
					.component(Text, (text) => {
						text.setFont(displayFont);
						text.setFontSize(FontSize.banner);
						text.setTextColor(Colors.goldLight);
						text.setStrokeColor(Colors.textDark);
						text.setStrokeWidth(6);
						this.#titleText = text;
					}),
				NodeLayout.create(WorldNode)
					.name("subtitle")
					.pivot(Pivot.middleCenter)
					.contentSize(BANNER_WIDTH, BANNER_HEIGHT * 0.25)
					.localPosition(BANNER_WIDTH * 0.5, BANNER_HEIGHT * 0.72)
					.component(Text, (text) => {
						text.setFont(bodyFont);
						text.setFontSize(FontSize.small);
						text.setTextColor(Colors.textLight);
						this.#subtitleText = text;
					}),
			)
			.build();
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
	// 글자 컴포넌트 반환.
	//==============================================================================
	/**
	 * @returns { Text }
	 */
	getTitleText() {
		return this.#titleText;
	}

	/**
	 * @returns { Text }
	 */
	getSubtitleText() {
		return this.#subtitleText;
	}

	//==============================================================================
	// 머무는 자리의 가로 위치 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getRestX() {
		return this.#restX;
	}

	//==============================================================================
	// 배치. (가운데 자리)
	//==============================================================================
	/**
	 * @param { number } centerX
	 * @param { number } centerY
	 */
	layout(centerX, centerY) {
		this.#restX = centerX;
		const node = this.getNode();
		const position = Vector2.create(centerX, centerY);
		node.setLocalPosition(position);
	}

	//==============================================================================
	// 띄우기. (들어와서 holdSeconds 동안 머물고 사라진다)
	//==============================================================================
	/**
	 * @param { object } scene
	 * @param { string } title
	 * @param { string } subtitle 없으면 빈 글자.
	 * @param { string } titleColor
	 * @param { number } holdSeconds
	 * @returns { Promise<void> }
	 */
	async show(scene, title, subtitle, titleColor, holdSeconds) {
		const node = this.getNode();
		const titleText = this.getTitleText();
		titleText.setText(title);
		titleText.setTextColor(titleColor);
		const subtitleText = this.getSubtitleText();
		subtitleText.setText(subtitle);
		const restX = this.getRestX();
		const localPosition = node.getLocalPosition();
		const enterPosition = Vector2.create(restX - 60, localPosition.y);
		node.setLocalPosition(enterPosition);
		node.setLocalOpacity(0);
		node.setActive(true);
		await System.Promise.all([
			animateNode(scene, node, { x: restX }, 0.3, Tween.easingFunction.cubic.out),
			animateNode(scene, node, { opacity: 1 }, 0.2, Tween.easingFunction.quadratic.out),
		]);
		await waitSeconds(scene, holdSeconds);
		await System.Promise.all([
			animateNode(scene, node, { x: restX + 60 }, 0.25, Tween.easingFunction.cubic.in),
			animateNode(scene, node, { opacity: 0 }, 0.25, Tween.easingFunction.quadratic.in),
		]);
		node.setActive(false);
	}
}
