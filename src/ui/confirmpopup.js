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
import { PopupView } from "./popupview.js";
import { ButtonView } from "./buttonview.js";


//==============================================================================
// 확인 팝업.
// - 물음 글자 + 두 버튼. (오른쪽 = 확정, 왼쪽 = 취소)
// - ask() 가 돌려주는 약속은 확정이면 true, 취소면 false 로 풀린다.
//==============================================================================
export class ConfirmPopup extends PopupView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Text } */ #messageText;
	/** @private @type { ButtonView } */ #confirmButton;
	/** @private @type { ButtonView } */ #cancelButton;
	/** @private @type { Function } */ #answerEvent; // (isConfirmed) => void

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } scene
	 */
	constructor(scene) {
		super(scene, "confirmPopup", "confirm");
		this.#answerEvent = null;
		const panelSize = PanelSize.confirm;
		const panelNode = this.getPanelNode();
		const bodyFont = getFont(FontFamily.body);
		const messageWidth = panelSize.width - 80;

		NodeLayout.create(WorldNode)
			.name("message")
			.pivot(Pivot.middleCenter)
			.contentSize(messageWidth, 160)
			.localPosition(panelSize.width * 0.5, panelSize.height * 0.36)
			.component(Text, (text) => {
				text.setFont(bodyFont);
				text.setFontSize(FontSize.body);
				text.setTextColor(Colors.textLight);
				text.setWordWrapWidth(messageWidth);
				this.#messageText = text;
			})
			.build(panelNode);

		const buttonCenterY = panelSize.height - 86;
		this.#cancelButton = new ButtonView("cancelButton", ButtonStyle.secondary, "medium", "", () => {
			this.answer(false);
		});
		const cancelButton = this.getCancelButton();
		const cancelButtonNode = cancelButton.getNode();
		const cancelButtonScale = Vector2.create(0.82, 0.82);
		cancelButtonNode.setLocalScale(cancelButtonScale);
		const cancelButtonPosition = Vector2.create(panelSize.width * 0.5 - 130, buttonCenterY);
		cancelButtonNode.setLocalPosition(cancelButtonPosition);
		panelNode.addChild(cancelButtonNode);

		this.#confirmButton = new ButtonView("confirmButton", ButtonStyle.primary, "medium", "", () => {
			this.answer(true);
		});
		const confirmButton = this.getConfirmButton();
		const confirmButtonNode = confirmButton.getNode();
		const confirmButtonScale = Vector2.create(0.82, 0.82);
		confirmButtonNode.setLocalScale(confirmButtonScale);
		const confirmButtonPosition = Vector2.create(panelSize.width * 0.5 + 130, buttonCenterY);
		confirmButtonNode.setLocalPosition(confirmButtonPosition);
		panelNode.addChild(confirmButtonNode);
	}

	//==============================================================================
	// 부품 반환.
	//==============================================================================
	/**
	 * @returns { Text }
	 */
	getMessageText() {
		return this.#messageText;
	}

	/**
	 * @returns { ButtonView }
	 */
	getConfirmButton() {
		return this.#confirmButton;
	}

	/**
	 * @returns { ButtonView }
	 */
	getCancelButton() {
		return this.#cancelButton;
	}

	/**
	 * @returns { Function }
	 */
	getAnswerEvent() {
		return this.#answerEvent;
	}

	//==============================================================================
	// 묻기. (팝업을 열고 답을 약속으로 돌려준다)
	//==============================================================================
	/**
	 * @param { string } message
	 * @param { string } confirmLabel
	 * @param { string } cancelLabel
	 * @returns { Promise<boolean> }
	 */
	ask(message, confirmLabel, cancelLabel) {
		const messageText = this.getMessageText();
		messageText.setText(message);
		const confirmButton = this.getConfirmButton();
		confirmButton.setLabel(confirmLabel);
		const cancelButton = this.getCancelButton();
		cancelButton.setLabel(cancelLabel);
		const answerPromise = new System.Promise((resolve) => {
			this.#answerEvent = resolve;
		});
		this.open();
		return answerPromise;
	}

	//==============================================================================
	// 답하기. (팝업을 닫고 기다리던 쪽에 답을 넘긴다)
	//==============================================================================
	/**
	 * @param { boolean } isConfirmed
	 */
	answer(isConfirmed) {
		const answerEvent = this.getAnswerEvent();
		this.#answerEvent = null;
		this.close();
		if (answerEvent !== null) {
			answerEvent(isConfirmed);
		}
	}
}
