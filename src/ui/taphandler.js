//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Component } from "../../libs/vanilla.js/src/core/component.js";


//==============================================================================
// 탭 처리 컴포넌트.
// - 누르는 동안 노드를 살짝 줄여 눌린 느낌을 주고, 누른 노드 위에서 뗐을 때만 동작한다.
//   (밖으로 끌고 나가 떼면 취소 — 버튼과 카드가 같은 규칙을 쓴다)
// - 노드는 setInteractable(true) 여야 터치를 받는다.
//==============================================================================
export class TapHandler extends Component {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { Function } */ #tapEvent; // (node) => void
	/** @private @type { boolean } */ #isTapEnabled;
	/** @private @type { boolean } */ #isPressed;
	/** @private @type { number } */ #pressScale; // 누른 동안의 배율. (원래 크기 대비)
	/** @private @type { Vector2 } */ #releaseScale; // 누르기 직전의 크기. (떼면 되돌린다)

	//==============================================================================
	// 생성.
	//==============================================================================
	constructor() {
		super();
		this.setComponentType("TapHandler");
		this.#tapEvent = null;
		this.#isTapEnabled = true;
		this.#isPressed = false;
		this.#pressScale = 0.94;
		this.#releaseScale = Vector2.one();
	}

	//==============================================================================
	// 탭 동작 설정.
	//==============================================================================
	/**
	 * @param { Function } tapEvent (node) => void
	 */
	setTapEvent(tapEvent) {
		this.#tapEvent = tapEvent;
	}

	//==============================================================================
	// 탭 동작 반환.
	//==============================================================================
	/**
	 * @returns { Function }
	 */
	getTapEvent() {
		return this.#tapEvent;
	}

	//==============================================================================
	// 탭 가능 여부 설정. (끄면 눌림 표시도 하지 않는다)
	//==============================================================================
	/**
	 * @param { boolean } isTapEnabled
	 */
	setTapEnabled(isTapEnabled) {
		this.#isTapEnabled = isTapEnabled;
		if (!isTapEnabled) {
			this.cancelPress();
		}
	}

	//==============================================================================
	// 탭 가능 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isTapEnabled() {
		return this.#isTapEnabled;
	}

	//==============================================================================
	// 눌린 동안의 배율 설정.
	//==============================================================================
	/**
	 * @param { number } pressScale
	 */
	setPressScale(pressScale) {
		this.#pressScale = pressScale;
	}

	//==============================================================================
	// 눌린 동안의 배율 반환.
	//==============================================================================
	/**
	 * @returns { number }
	 */
	getPressScale() {
		return this.#pressScale;
	}

	//==============================================================================
	// 눌려 있는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isPressed() {
		return this.#isPressed;
	}

	//==============================================================================
	// 누르기 직전의 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getReleaseScale() {
		return this.#releaseScale;
	}

	//==============================================================================
	// 터치 누름. (TouchRaycaster → WorldNode → 컴포넌트)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchPress(viewInputPosition) {
		const isTapEnabled = this.isTapEnabled();
		if (!isTapEnabled) {
			return;
		}
		const node = this.getNode();
		const localScale = node.getLocalScale();
		this.#releaseScale = localScale.clone();
		this.#isPressed = true;
		const pressScale = this.getPressScale();
		const pressedScale = Vector2.create(localScale.x * pressScale, localScale.y * pressScale);
		node.setLocalScale(pressedScale);
	}

	//==============================================================================
	// 터치 뗌. (누른 노드 위에서 뗐을 때만 동작)
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchRelease(viewInputPosition) {
		const isPressed = this.isPressed();
		if (!isPressed) {
			return;
		}
		this.cancelPress();
		const node = this.getNode();
		const isInside = node.contains(viewInputPosition);
		const isTapEnabled = this.isTapEnabled();
		const tapEvent = this.getTapEvent();
		if (isInside && isTapEnabled && tapEvent !== null) {
			tapEvent(node);
		}
	}

	//==============================================================================
	// 터치 취소.
	//==============================================================================
	/**
	 * @param { Vector2 } viewInputPosition
	 */
	touchCancel(viewInputPosition) {
		this.cancelPress();
	}

	//==============================================================================
	// 눌림 해제. (크기를 누르기 전으로 되돌린다)
	//==============================================================================
	cancelPress() {
		const isPressed = this.isPressed();
		if (!isPressed) {
			return;
		}
		this.#isPressed = false;
		const node = this.getNode();
		const releaseScale = this.getReleaseScale();
		node.setLocalScale(releaseScale);
	}
}
