//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { Rect } from "../../libs/vanilla.js/src/base/rect.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Sprite } from "../../libs/vanilla.js/src/core/component/sprite.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { REFERENCE_RESOLUTION_WIDTH } from "../game/constants.js";


//==============================================================================
// 화면 바탕.
//
// 노드 구성.
//   화면(뷰 전체) ─ 배경(뷰를 덮도록 늘림) / 무대(가로 720 고정, 가운데 정렬) / 팝업들
// - 세로 전용 게임이라 내용은 가로 720 무대에 놓는다. 화면이 더 넓으면 무대가 가운데에 서고
//   양옆은 배경만 보인다. 세로는 기기마다 달라서 배치는 layout() 에서 실제 크기를 읽어 정한다.
// - 안전영역(노치·홈 표시줄)은 layout() 이 받는 영역으로 피한다.
//==============================================================================
export class BaseScreen {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #scene;
	/** @private @type { WorldNode } */ #node;
	/** @private @type { WorldNode } */ #backgroundNode;
	/** @private @type { WorldNode } */ #stageNode;
	/** @private @type { Vector2 } */ #viewSize;
	/** @private @type { Rect } */ #safeAreaRect;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } scene
	 * @param { string } name 노드 이름.
	 * @param { HTMLImageElement } backgroundImage
	 */
	constructor(scene, name, backgroundImage) {
		this.#scene = scene;
		this.#viewSize = Vector2.zero();
		this.#safeAreaRect = Rect.zero();
		this.#node = NodeLayout.create(WorldNode)
			.name(name)
			.active(false)
			.pivot(Pivot.topLeft)
			.children(
				NodeLayout.create(WorldNode)
					.name("background")
					.pivot(Pivot.middleCenter)
					.apply((node) => {
						this.#backgroundNode = node;
					})
					.component(Sprite, (sprite) => {
						sprite.setImage(backgroundImage);
					}),
				NodeLayout.create(WorldNode)
					.name("stage")
					.pivot(Pivot.topLeft)
					.apply((node) => {
						this.#stageNode = node;
					}),
			)
			.build();
	}

	//==============================================================================
	// 씬 반환.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	getScene() {
		return this.#scene;
	}

	//==============================================================================
	// 화면 노드 반환. (팝업은 여기에 붙인다 — 뷰 전체를 덮어야 하므로)
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getNode() {
		return this.#node;
	}

	//==============================================================================
	// 배경 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getBackgroundNode() {
		return this.#backgroundNode;
	}

	//==============================================================================
	// 무대 노드 반환. (내용은 여기에 붙인다 — 가로 720 기준 좌표)
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getStageNode() {
		return this.#stageNode;
	}

	//==============================================================================
	// 마지막 배치의 뷰 크기 반환.
	//==============================================================================
	/**
	 * @returns { Vector2 }
	 */
	getViewSize() {
		return this.#viewSize;
	}

	//==============================================================================
	// 마지막 배치의 안전영역 반환. (뷰 좌표)
	//==============================================================================
	/**
	 * @returns { Rect }
	 */
	getSafeAreaRect() {
		return this.#safeAreaRect;
	}

	//==============================================================================
	// 배치. (파생 클래스는 super.layout 뒤에 자기 내용을 놓는다)
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 * @param { Rect } safeAreaRect
	 */
	layout(viewSize, safeAreaRect) {
		this.#viewSize = viewSize.clone();
		this.#safeAreaRect = safeAreaRect;
		const node = this.getNode();
		const nodeSize = Vector2.create(viewSize.x, viewSize.y);
		node.setContentSize(nodeSize);
		node.setLocalPosition(Vector2.zero());

		// 배경은 비율을 지키며 뷰를 빈틈없이 덮는다.
		const backgroundNode = this.getBackgroundNode();
		const backgroundSprite = backgroundNode.getComponent(Sprite);
		const backgroundImage = backgroundSprite.getImage();
		if (backgroundImage !== null && backgroundImage !== undefined) {
			const coverScale = System.Math.max(viewSize.x / backgroundImage.width, viewSize.y / backgroundImage.height);
			const backgroundSize = Vector2.create(backgroundImage.width * coverScale, backgroundImage.height * coverScale);
			backgroundNode.setContentSize(backgroundSize);
		}
		const backgroundPosition = Vector2.create(viewSize.x * 0.5, viewSize.y * 0.5);
		backgroundNode.setLocalPosition(backgroundPosition);

		// 무대는 가로 720 을 가운데에 세운다.
		const stageNode = this.getStageNode();
		const stageSize = Vector2.create(REFERENCE_RESOLUTION_WIDTH, viewSize.y);
		stageNode.setContentSize(stageSize);
		const stagePosition = Vector2.create((viewSize.x - REFERENCE_RESOLUTION_WIDTH) * 0.5, 0);
		stageNode.setLocalPosition(stagePosition);
	}

	//==============================================================================
	// 화면에 들어옴.
	//==============================================================================
	onEnter() {
		const node = this.getNode();
		node.setActive(true);
	}

	//==============================================================================
	// 화면에서 나감.
	//==============================================================================
	onExit() {
		const node = this.getNode();
		node.setActive(false);
	}

	//==============================================================================
	// 갱신. (켜진 화면만 매 프레임 받는다)
	//==============================================================================
	/**
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
	}
}
