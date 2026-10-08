//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Text } from "../../libs/vanilla.js/src/core/component/text.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { Colors, PanelSize, FontFamily, FontSize } from "../game/constants.js";
import { getFont } from "../game/fonts.js";
import { ButtonStyle } from "../game/textures.js";
import { punchScale } from "../game/motion.js";
import { PopupView } from "./popupview.js";
import { ButtonView } from "./buttonview.js";


//==============================================================================
// 결과 팝업의 선택.
//==============================================================================
export const ResultChoice = System.Object.freeze({
	retry: "retry",
	title: "title",
});


//==============================================================================
// 매치 결과 팝업.
// - 큰 결과 글자 + 최종 점수 + 설명 + [다시 하기] [타이틀로].
// - show() 가 돌려주는 약속은 고른 ResultChoice 로 풀린다.
//==============================================================================
export class ResultPopup extends PopupView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WorldNode } */ #headlineNode;
	/** @private @type { Text } */ #headlineText;
	/** @private @type { Text } */ #scoreText;
	/** @private @type { Text } */ #detailText;
	/** @private @type { Function } */ #choiceEvent; // (resultChoice) => void

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } scene
	 */
	constructor(scene) {
		super(scene, "resultPopup", "result");
		this.#choiceEvent = null;
		const panelSize = PanelSize.result;
		const panelNode = this.getPanelNode();
		const displayFont = getFont(FontFamily.display);
		const bodyFont = getFont(FontFamily.body);
		const textWidth = panelSize.width - 80;

		this.#headlineNode = NodeLayout.create(WorldNode)
			.name("headline")
			.pivot(Pivot.middleCenter)
			.contentSize(textWidth, FontSize.title)
			.localPosition(panelSize.width * 0.5, 120)
			.component(Text, (text) => {
				text.setFont(displayFont);
				text.setFontSize(FontSize.title * 0.9);
				text.setStrokeColor(Colors.textDark);
				text.setStrokeWidth(8);
				this.#headlineText = text;
			})
			.build(panelNode);

		NodeLayout.create(WorldNode)
			.name("score")
			.pivot(Pivot.middleCenter)
			.contentSize(textWidth, FontSize.score * 1.2)
			.localPosition(panelSize.width * 0.5, 252)
			.component(Text, (text) => {
				text.setFont(displayFont);
				text.setFontSize(FontSize.score * 0.8);
				text.setTextColor(Colors.textLight);
				this.#scoreText = text;
			})
			.build(panelNode);

		NodeLayout.create(WorldNode)
			.name("detail")
			.pivot(Pivot.middleCenter)
			.contentSize(textWidth, 80)
			.localPosition(panelSize.width * 0.5, 338)
			.component(Text, (text) => {
				text.setFont(bodyFont);
				text.setFontSize(FontSize.small);
				text.setTextColor(Colors.textMuted);
				text.setWordWrapWidth(textWidth);
				this.#detailText = text;
			})
			.build(panelNode);

		const retryButton = new ButtonView("retryButton", ButtonStyle.primary, "medium", "다시 하기", () => {
			this.choose(ResultChoice.retry);
		});
		const retryButtonNode = retryButton.getNode();
		const retryButtonPosition = Vector2.create(panelSize.width * 0.5, panelSize.height - 182);
		retryButtonNode.setLocalPosition(retryButtonPosition);
		panelNode.addChild(retryButtonNode);

		const titleButton = new ButtonView("titleButton", ButtonStyle.secondary, "medium", "타이틀로", () => {
			this.choose(ResultChoice.title);
		});
		const titleButtonNode = titleButton.getNode();
		const titleButtonPosition = Vector2.create(panelSize.width * 0.5, panelSize.height - 76);
		titleButtonNode.setLocalPosition(titleButtonPosition);
		panelNode.addChild(titleButtonNode);
	}

	//==============================================================================
	// 부품 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getHeadlineNode() {
		return this.#headlineNode;
	}

	/**
	 * @returns { Text }
	 */
	getHeadlineText() {
		return this.#headlineText;
	}

	/**
	 * @returns { Text }
	 */
	getScoreText() {
		return this.#scoreText;
	}

	/**
	 * @returns { Text }
	 */
	getDetailText() {
		return this.#detailText;
	}

	/**
	 * @returns { Function }
	 */
	getChoiceEvent() {
		return this.#choiceEvent;
	}

	//==============================================================================
	// 보이기. (열고 고른 선택을 약속으로 돌려준다)
	//==============================================================================
	/**
	 * @param { string } headline
	 * @param { string } headlineColor
	 * @param { string } scoreLine
	 * @param { string } detail
	 * @returns { Promise<string> }
	 */
	async show(headline, headlineColor, scoreLine, detail) {
		const headlineText = this.getHeadlineText();
		headlineText.setText(headline);
		headlineText.setTextColor(headlineColor);
		const scoreText = this.getScoreText();
		scoreText.setText(scoreLine);
		const detailText = this.getDetailText();
		detailText.setText(detail);
		const choicePromise = new System.Promise((resolve) => {
			this.#choiceEvent = resolve;
		});
		await this.open();
		const scene = this.getScene();
		const headlineNode = this.getHeadlineNode();
		punchScale(scene, headlineNode, 1.18, 0.5);
		return choicePromise;
	}

	//==============================================================================
	// 고르기. (팝업을 닫고 기다리던 쪽에 선택을 넘긴다)
	//==============================================================================
	/**
	 * @param { string } resultChoice
	 */
	async choose(resultChoice) {
		const choiceEvent = this.getChoiceEvent();
		if (choiceEvent === null) {
			return;
		}
		this.#choiceEvent = null;
		await this.close();
		choiceEvent(resultChoice);
	}
}
