//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { Color } from "../../libs/vanilla.js/src/base/color.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Tween } from "../../libs/vanilla.js/src/core/tween.js";
import { Paint } from "../../libs/vanilla.js/src/core/component/paint.js";
import { Sprite } from "../../libs/vanilla.js/src/core/component/sprite.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { Colors, PanelSize } from "../game/constants.js";
import { getTexture, getPanelTextureKey } from "../game/textures.js";
import { animateNode } from "../game/motion.js";


//==============================================================================
// 팝업 바탕.
// - 화면 전체를 덮는 어두운 막(뒤쪽 터치를 막는다) + 가운데 패널.
// - 열 때 막이 짙어지며 패널이 살짝 작은 크기에서 되튕기며 커진다. 닫을 때는 반대로.
// - 내용은 파생 클래스가 getPanelNode() 아래에 붙인다.
//==============================================================================
export class PopupView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { object } */ #scene;
	/** @private @type { WorldNode } */ #node;
	/** @private @type { WorldNode } */ #dimNode;
	/** @private @type { WorldNode } */ #panelNode;
	/** @private @type { boolean } */ #isOpen;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } scene
	 * @param { string } name 노드 이름.
	 * @param { string } panelSizeKey PanelSize 키.
	 */
	constructor(scene, name, panelSizeKey) {
		this.#scene = scene;
		this.#isOpen = false;
		const panelSize = PanelSize[panelSizeKey];
		const panelTextureKey = getPanelTextureKey(panelSizeKey);
		const panelTexture = getTexture(panelTextureKey);
		const dimColor = Color.createFromHEX(Colors.dim);
		dimColor.alpha = 0.72;
		this.#node = NodeLayout.create(WorldNode)
			.name(name)
			.active(false)
			.pivot(Pivot.topLeft)
			.children(
				NodeLayout.create(WorldNode)
					.name("dim")
					.pivot(Pivot.topLeft)
					.localPosition(0, 0)
					.apply((node) => {
						node.setInteractable(true);
						this.#dimNode = node;
					})
					.component(Paint, (paint) => {
						paint.setColor(dimColor);
					}),
				NodeLayout.create(WorldNode)
					.name("panel")
					.pivot(Pivot.middleCenter)
					.contentSize(panelSize.width, panelSize.height)
					.apply((node) => {
						node.setInteractable(true);
						this.#panelNode = node;
					})
					.component(Sprite, (sprite) => {
						sprite.setImage(panelTexture);
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
	// 노드 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getNode() {
		return this.#node;
	}

	//==============================================================================
	// 어두운 막 반환.
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getDimNode() {
		return this.#dimNode;
	}

	//==============================================================================
	// 패널 반환. (내용을 붙이는 곳 — 좌상단이 패널의 (0, 0))
	//==============================================================================
	/**
	 * @returns { WorldNode }
	 */
	getPanelNode() {
		return this.#panelNode;
	}

	//==============================================================================
	// 열려 있는지 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isOpen() {
		return this.#isOpen;
	}

	//==============================================================================
	// 배치. (화면 크기가 바뀌면 막을 화면에 맞추고 패널을 가운데로)
	//==============================================================================
	/**
	 * @param { Vector2 } viewSize
	 */
	layout(viewSize) {
		const node = this.getNode();
		const nodeSize = Vector2.create(viewSize.x, viewSize.y);
		node.setContentSize(nodeSize);
		node.setLocalPosition(Vector2.zero());
		const dimNode = this.getDimNode();
		dimNode.setContentSize(nodeSize);
		const panelNode = this.getPanelNode();
		const panelPosition = Vector2.create(viewSize.x * 0.5, viewSize.y * 0.5);
		panelNode.setLocalPosition(panelPosition);
	}

	//==============================================================================
	// 열기.
	//==============================================================================
	/**
	 * @returns { Promise<void> }
	 */
	async open() {
		const isOpen = this.isOpen();
		if (isOpen) {
			return;
		}
		this.#isOpen = true;
		const scene = this.getScene();
		const node = this.getNode();
		const dimNode = this.getDimNode();
		const panelNode = this.getPanelNode();
		node.setActive(true);
		dimNode.setLocalOpacity(0);
		panelNode.setLocalOpacity(0);
		const startScale = Vector2.create(0.86, 0.86);
		panelNode.setLocalScale(startScale);
		await System.Promise.all([
			animateNode(scene, dimNode, { opacity: 1 }, 0.2, Tween.easingFunction.quadratic.out),
			animateNode(scene, panelNode, { opacity: 1 }, 0.16, Tween.easingFunction.quadratic.out),
			animateNode(scene, panelNode, { scaleX: 1, scaleY: 1 }, 0.32, Tween.easingFunction.back.out),
		]);
	}

	//==============================================================================
	// 닫기.
	//==============================================================================
	/**
	 * @returns { Promise<void> }
	 */
	async close() {
		const isOpen = this.isOpen();
		if (!isOpen) {
			return;
		}
		this.#isOpen = false;
		const scene = this.getScene();
		const node = this.getNode();
		const dimNode = this.getDimNode();
		const panelNode = this.getPanelNode();
		await System.Promise.all([
			animateNode(scene, dimNode, { opacity: 0 }, 0.18, Tween.easingFunction.quadratic.in),
			animateNode(scene, panelNode, { opacity: 0, scaleX: 0.9, scaleY: 0.9 }, 0.16, Tween.easingFunction.quadratic.in),
		]);
		node.setActive(false);
	}
}
