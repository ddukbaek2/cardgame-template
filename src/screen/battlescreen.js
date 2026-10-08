//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { Rect } from "../../libs/vanilla.js/src/base/rect.js";
import { Color } from "../../libs/vanilla.js/src/base/color.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Tween } from "../../libs/vanilla.js/src/core/tween.js";
import { Paint } from "../../libs/vanilla.js/src/core/component/paint.js";
import { Sprite } from "../../libs/vanilla.js/src/core/component/sprite.js";
import { Text, TextAlign } from "../../libs/vanilla.js/src/core/component/text.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { Colors, CardSize, FontFamily, FontSize, Screen, REFERENCE_RESOLUTION_WIDTH } from "../game/constants.js";
import { getFont } from "../game/fonts.js";
import { createShuffledDeck } from "../game/cards.js";
import { getMatchSetting } from "../game/matchtable.js";
import { getTexture, getCardBackTextureKey, TextureKey, ButtonStyle } from "../game/textures.js";
import { animateNode, animateValue, waitSeconds, punchScale } from "../game/motion.js";
import { resolveRound } from "../game/rules.js";
import { chooseBotPlay } from "../game/bot.js";
import { ButtonView } from "../ui/buttonview.js";
import { CardView } from "../ui/cardview.js";
import { BannerView } from "../ui/bannerview.js";
import { CardListPopup } from "../ui/cardlistpopup.js";
import { ConfirmPopup } from "../ui/confirmpopup.js";
import { ResultPopup, ResultChoice } from "../ui/resultpopup.js";
import { BaseScreen } from "./basescreen.js";


//==============================================================================
// 자리 번호. (화면은 1:1 — 0 이 나, 1 이 상대)
//==============================================================================
const PLAYER_INDEX = 0;
const OPPONENT_INDEX = 1;
const PLAYER_COUNT = 2;


//==============================================================================
// 대전 화면 배치 값. (안전영역 위·아래 끝에서의 거리 — 가로는 무대 720 기준)
//==============================================================================
const TOP_BAR_OFFSET = 46;
const OPPONENT_PLATE_OFFSET = 112;
const OPPONENT_HAND_OFFSET = 252;
const PLAYER_HAND_OFFSET = 324;
const HINT_OFFSET = 164;
const HINT_WIDTH = 640;
const HINT_HEIGHT = 42;
const TIMER_OFFSET = 132;
const ACTION_BUTTON_OFFSET = 66;
const PLAYER_PLATE_GAP = 70;
const ARENA_MARGIN = 18;
const ARENA_ROW_GAP = 102;
const PLAYER_HAND_SPACING = 186;
const OPPONENT_HAND_SPACING = 124;
const PLAYED_SPACING = 146;
const SELECT_LIFT = 34;
const DECK_X = 74;
const POWER_X = 632;
const PLATE_WIDTH = 330;
const PLATE_HEIGHT = 58;
const TIMER_WIDTH = 420;
const TIMER_HEIGHT = 12;
const TIMER_WARNING_SECONDS = 5;


//==============================================================================
// 대전 화면.
//
// 한 매치 = 여러 판. 한 판 = 딜 → 고르기(제한 시간) → 동시 공개 → 판정 → 점수.
// 흐름은 async 함수로 위에서 아래로 읽히게 쓴다. 화면을 나가거나 새 매치를 시작하면
// 흐름 번호가 바뀌고, 이전 흐름은 다음 await 뒤에서 스스로 멈춘다.
// 규칙은 game/rules.js, 상대 수는 game/bot.js 가 정한다. (게임마다 갈아 끼운다)
//==============================================================================
export class BattleScreen extends BaseScreen {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { ButtonView } */ #exitButton;
	/** @private @type { ButtonView } */ #cardListButton;
	/** @private @type { WorldNode } */ #roundNode;
	/** @private @type { WorldNode[] } */ #plateNodes; // 자리별 이름·점수판.
	/** @private @type { WorldNode[] } */ #powerNodes; // 자리별 전투력 숫자.
	/** @private @type { WorldNode } */ #deckNode;
	/** @private @type { WorldNode } */ #cardLayerNode; // 카드가 붙는 층. (덱 위, 안내 아래)
	/** @private @type { WorldNode } */ #hintNode;
	/** @private @type { WorldNode } */ #timerNode;
	/** @private @type { WorldNode } */ #timerFillNode;
	/** @private @type { ButtonView } */ #actionButton;
	/** @private @type { BannerView } */ #bannerView;
	/** @private @type { CardListPopup } */ #cardListPopup;
	/** @private @type { ConfirmPopup } */ #confirmPopup;
	/** @private @type { ResultPopup } */ #resultPopup;
	/** @private @type { object } */ #layoutMetrics; // 마지막 배치에서 계산한 자리 값.
	/** @private @type { object } */ #match; // 매치 진행 상태.
	/** @private @type { object } */ #selection; // 고르기 중인 상태. (아니면 null)
	/** @private @type { Function } */ #actionEvent; // 행동 버튼이 눌리면 부를 함수. (없으면 null)
	/** @private @type { number } */ #flowSerial; // 흐름 번호. (바뀌면 이전 흐름은 멈춘다)

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } scene
	 */
	constructor(scene) {
		const backgroundImage = getTexture(TextureKey.background);
		super(scene, "battleScreen", backgroundImage);
		this.#plateNodes = [];
		this.#powerNodes = [];
		this.#layoutMetrics = null;
		this.#match = this.createEmptyMatch();
		this.#selection = null;
		this.#actionEvent = null;
		this.#flowSerial = 0;
		this.buildStage();
	}

	//==============================================================================
	// 무대 꾸미기. (덱 → 카드 층 → 판·숫자 → 안내·타이머·버튼 → 띠지 순서로 겹친다)
	//==============================================================================
	buildStage() {
		const stageNode = this.getStageNode();
		const screenNode = this.getNode();
		const scene = this.getScene();
		const displayFont = getFont(FontFamily.display);
		const bodyFont = getFont(FontFamily.body);
		const opponentCardSize = CardSize.opponent;
		const deckTextureKey = getCardBackTextureKey("opponent");
		const deckTexture = getTexture(deckTextureKey);
		const plateColor = Color.createFromHEX(Colors.panel);
		plateColor.alpha = 0.82;
		const timerBackColor = Color.createFromHEX(Colors.dim);
		timerBackColor.alpha = 0.55;
		const timerFillColor = Color.createFromHEX(Colors.timer);
		const hintColor = Color.createFromHEX(Colors.dim);
		hintColor.alpha = 0.6;

		// 덱. (뒷면 세 장을 살짝 어긋나게 쌓는다)
		this.#deckNode = NodeLayout.create(WorldNode)
			.name("deck")
			.pivot(Pivot.middleCenter)
			.contentSize(opponentCardSize.width, opponentCardSize.height)
			.children(
				NodeLayout.create(WorldNode)
					.name("deckBottom")
					.pivot(Pivot.middleCenter)
					.contentSize(opponentCardSize.width, opponentCardSize.height)
					.localPosition(opponentCardSize.width * 0.5 + 6, opponentCardSize.height * 0.5 + 8)
					.component(Sprite, (sprite) => {
						sprite.setImage(deckTexture);
					}),
				NodeLayout.create(WorldNode)
					.name("deckMiddle")
					.pivot(Pivot.middleCenter)
					.contentSize(opponentCardSize.width, opponentCardSize.height)
					.localPosition(opponentCardSize.width * 0.5 + 3, opponentCardSize.height * 0.5 + 4)
					.component(Sprite, (sprite) => {
						sprite.setImage(deckTexture);
					}),
				NodeLayout.create(WorldNode)
					.name("deckTop")
					.pivot(Pivot.middleCenter)
					.contentSize(opponentCardSize.width, opponentCardSize.height)
					.localPosition(opponentCardSize.width * 0.5, opponentCardSize.height * 0.5)
					.component(Sprite, (sprite) => {
						sprite.setImage(deckTexture);
					}),
			)
			.build(stageNode);

		// 이름·점수판. (자리 0 = 나, 1 = 상대)
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const accentColor = (playerIndex === PLAYER_INDEX) ? Colors.player : Colors.opponent;
			const plateNode = NodeLayout.create(WorldNode)
				.name(`plate${playerIndex}`)
				.pivot(Pivot.middleCenter)
				.contentSize(PLATE_WIDTH, PLATE_HEIGHT)
				.component(Paint, (paint) => {
					paint.setColor(plateColor);
					paint.setRoundSize(PLATE_HEIGHT * 0.5);
				})
				.children(
					NodeLayout.create(WorldNode)
						.name("accent")
						.pivot(Pivot.middleCenter)
						.contentSize(14, 14)
						.localPosition(30, PLATE_HEIGHT * 0.5)
						.component(Paint, (paint) => {
							paint.setColor(accentColor);
							paint.setRoundSize(7);
						}),
					NodeLayout.create(WorldNode)
						.name("name")
						.pivot(Pivot.middleLeft)
						.contentSize(PLATE_WIDTH * 0.55, PLATE_HEIGHT)
						.localPosition(48, PLATE_HEIGHT * 0.5)
						.component(Text, (text) => {
							text.setFont(bodyFont);
							text.setFontSize(FontSize.body);
							text.setTextAlign(TextAlign.left);
							text.setTextColor(Colors.textLight);
						}),
					NodeLayout.create(WorldNode)
						.name("score")
						.pivot(Pivot.middleRight)
						.contentSize(PLATE_WIDTH * 0.4, PLATE_HEIGHT)
						.localPosition(PLATE_WIDTH - 26, PLATE_HEIGHT * 0.53)
						.component(Text, (text) => {
							text.setFont(displayFont);
							text.setFontSize(FontSize.heading * 0.8);
							text.setTextAlign(TextAlign.right);
							text.setTextColor(Colors.gold);
						}),
				)
				.build(stageNode);
			const plateNodes = this.getPlateNodes();
			plateNodes.push(plateNode);
		}

		this.#cardLayerNode = NodeLayout.create(WorldNode)
			.name("cardLayer")
			.pivot(Pivot.topLeft)
			.localPosition(0, 0)
			.build(stageNode);

		// 전투력 숫자. (판정 때만 보인다)
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const powerNode = NodeLayout.create(WorldNode)
				.name(`power${playerIndex}`)
				.active(false)
				.pivot(Pivot.middleCenter)
				.contentSize(140, 100)
				.component(Text, (text) => {
					text.setFont(displayFont);
					text.setFontSize(FontSize.score * 1.2);
					text.setTextColor(Colors.textLight);
					text.setStrokeColor(Colors.textDark);
					text.setStrokeWidth(8);
				})
				.build(stageNode);
			const powerNodes = this.getPowerNodes();
			powerNodes.push(powerNode);
		}

		this.#roundNode = NodeLayout.create(WorldNode)
			.name("round")
			.pivot(Pivot.middleCenter)
			.contentSize(260, 60)
			.component(Text, (text) => {
				text.setFont(displayFont);
				text.setFontSize(FontSize.body);
				text.setTextColor(Colors.goldLight);
			})
			.build(stageNode);

		this.#exitButton = new ButtonView("exitButton", ButtonStyle.secondary, "small", "나가기", () => {
			this.confirmExit();
		});
		const exitButton = this.getExitButton();
		const exitButtonNode = exitButton.getNode();
		stageNode.addChild(exitButtonNode);

		this.#cardListButton = new ButtonView("cardListButton", ButtonStyle.secondary, "small", "카드 목록", () => {
			this.openCardList();
		});
		const cardListButton = this.getCardListButton();
		const cardListButtonNode = cardListButton.getNode();
		stageNode.addChild(cardListButtonNode);

		this.#hintNode = NodeLayout.create(WorldNode)
			.name("hint")
			.active(false)
			.pivot(Pivot.middleCenter)
			.contentSize(HINT_WIDTH, HINT_HEIGHT)
			.component(Paint, (paint) => {
				paint.setColor(hintColor);
				paint.setRoundSize(HINT_HEIGHT * 0.5);
			})
			.children(
				NodeLayout.create(WorldNode)
					.name("hintLabel")
					.pivot(Pivot.middleCenter)
					.contentSize(HINT_WIDTH, HINT_HEIGHT)
					.localPosition(HINT_WIDTH * 0.5, HINT_HEIGHT * 0.5)
					.component(Text, (text) => {
						text.setFont(bodyFont);
						text.setFontSize(FontSize.small);
						text.setTextColor(Colors.textLight);
					}),
			)
			.build(stageNode);

		this.#timerNode = NodeLayout.create(WorldNode)
			.name("timer")
			.active(false)
			.pivot(Pivot.middleCenter)
			.contentSize(TIMER_WIDTH, TIMER_HEIGHT)
			.component(Paint, (paint) => {
				paint.setColor(timerBackColor);
				paint.setRoundSize(TIMER_HEIGHT * 0.5);
			})
			.children(
				NodeLayout.create(WorldNode)
					.name("timerFill")
					.pivot(Pivot.middleLeft)
					.contentSize(TIMER_WIDTH, TIMER_HEIGHT)
					.localPosition(0, TIMER_HEIGHT * 0.5)
					.apply((node) => {
						this.#timerFillNode = node;
					})
					.component(Paint, (paint) => {
						paint.setColor(timerFillColor);
						paint.setRoundSize(TIMER_HEIGHT * 0.5);
					}),
			)
			.build(stageNode);

		this.#actionButton = new ButtonView("actionButton", ButtonStyle.primary, "medium", "카드 내기", () => {
			this.triggerAction();
		});
		const actionButton = this.getActionButton();
		actionButton.setEnabled(false);
		const actionButtonNode = actionButton.getNode();
		stageNode.addChild(actionButtonNode);

		this.#bannerView = new BannerView();
		const bannerView = this.getBannerView();
		const bannerNode = bannerView.getNode();
		stageNode.addChild(bannerNode);

		this.#cardListPopup = new CardListPopup(scene);
		const cardListPopup = this.getCardListPopup();
		const cardListPopupNode = cardListPopup.getNode();
		screenNode.addChild(cardListPopupNode);

		this.#resultPopup = new ResultPopup(scene);
		const resultPopup = this.getResultPopup();
		const resultPopupNode = resultPopup.getNode();
		screenNode.addChild(resultPopupNode);

		this.#confirmPopup = new ConfirmPopup(scene);
		const confirmPopup = this.getConfirmPopup();
		const confirmPopupNode = confirmPopup.getNode();
		screenNode.addChild(confirmPopupNode);
	}

	//==============================================================================
	// 부품 반환.
	//==============================================================================
	/**
	 * @returns { ButtonView }
	 */
	getExitButton() {
		return this.#exitButton;
	}

	/**
	 * @returns { ButtonView }
	 */
	getCardListButton() {
		return this.#cardListButton;
	}

	/**
	 * @returns { WorldNode }
	 */
	getRoundNode() {
		return this.#roundNode;
	}

	/**
	 * @returns { WorldNode[] }
	 */
	getPlateNodes() {
		return this.#plateNodes;
	}

	/**
	 * @returns { WorldNode[] }
	 */
	getPowerNodes() {
		return this.#powerNodes;
	}

	/**
	 * @returns { WorldNode }
	 */
	getDeckNode() {
		return this.#deckNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getCardLayerNode() {
		return this.#cardLayerNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getHintNode() {
		return this.#hintNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getTimerNode() {
		return this.#timerNode;
	}

	/**
	 * @returns { WorldNode }
	 */
	getTimerFillNode() {
		return this.#timerFillNode;
	}

	/**
	 * @returns { ButtonView }
	 */
	getActionButton() {
		return this.#actionButton;
	}

	/**
	 * @returns { BannerView }
	 */
	getBannerView() {
		return this.#bannerView;
	}

	/**
	 * @returns { CardListPopup }
	 */
	getCardListPopup() {
		return this.#cardListPopup;
	}

	/**
	 * @returns { ConfirmPopup }
	 */
	getConfirmPopup() {
		return this.#confirmPopup;
	}

	/**
	 * @returns { ResultPopup }
	 */
	getResultPopup() {
		return this.#resultPopup;
	}

	/**
	 * @returns { object }
	 */
	getLayoutMetrics() {
		return this.#layoutMetrics;
	}

	/**
	 * @returns { object }
	 */
	getMatch() {
		return this.#match;
	}

	/**
	 * @returns { object }
	 */
	getSelection() {
		return this.#selection;
	}

	/**
	 * @returns { Function }
	 */
	getActionEvent() {
		return this.#actionEvent;
	}

	/**
	 * @returns { number }
	 */
	getFlowSerial() {
		return this.#flowSerial;
	}

	//==============================================================================
	// 흐름이 아직 살아 있는지. (나갔거나 새 매치가 시작됐으면 false)
	//==============================================================================
	/**
	 * @param { number } flowSerial
	 * @returns { boolean }
	 */
	isFlowCurrent(flowSerial) {
		const currentFlowSerial = this.getFlowSerial();
		return flowSerial === currentFlowSerial;
	}

	//==============================================================================
	// 빈 매치 상태 만들기.
	//==============================================================================
	/**
	 * @returns { object }
	 */
	createEmptyMatch() {
		const roundCount = getMatchSetting("roundCount", 5);
		const playerName = getMatchSetting("playerName", "나");
		const opponentName = getMatchSetting("opponentName", "컴퓨터");
		return {
			roundIndex: 0,
			roundCount: roundCount,
			names: [playerName, opponentName],
			scores: [0, 0],
			deck: [],
			hands: [[], []],
			handViews: [[], []],
			playedIndices: [[], []],
			revealedCardIds: [],
		};
	}

	//==============================================================================
	// 배치.
	//==============================================================================
	/**
	 * @override
	 * @param { Vector2 } viewSize
	 * @param { Rect } safeAreaRect
	 */
	layout(viewSize, safeAreaRect) {
		super.layout(viewSize, safeAreaRect);
		const top = safeAreaRect.position.y;
		const bottom = safeAreaRect.position.y + safeAreaRect.size.y;
		const centerX = REFERENCE_RESOLUTION_WIDTH * 0.5;
		const opponentHandY = top + OPPONENT_HAND_OFFSET;
		const playerHandY = bottom - PLAYER_HAND_OFFSET;
		const playerPlateY = playerHandY - CardSize.hand.height * 0.5 - PLAYER_PLATE_GAP;
		const arenaTop = opponentHandY + CardSize.opponent.height * 0.5 + ARENA_MARGIN;
		const arenaBottom = playerPlateY - PLATE_HEIGHT * 0.5 - ARENA_MARGIN;
		const arenaCenterY = (arenaTop + arenaBottom) * 0.5;
		this.#layoutMetrics = {
			centerX: centerX,
			topBarY: top + TOP_BAR_OFFSET,
			opponentPlateY: top + OPPONENT_PLATE_OFFSET,
			playerPlateY: playerPlateY,
			handY: [playerHandY, opponentHandY],
			playedY: [arenaCenterY + ARENA_ROW_GAP, arenaCenterY - ARENA_ROW_GAP],
			arenaCenterY: arenaCenterY,
			hintY: bottom - HINT_OFFSET,
			timerY: bottom - TIMER_OFFSET,
			actionButtonY: bottom - ACTION_BUTTON_OFFSET,
		};
		const layoutMetrics = this.getLayoutMetrics();

		const exitButton = this.getExitButton();
		const exitButtonNode = exitButton.getNode();
		const exitButtonPosition = Vector2.create(88, layoutMetrics.topBarY);
		exitButtonNode.setLocalPosition(exitButtonPosition);
		const cardListButton = this.getCardListButton();
		const cardListButtonNode = cardListButton.getNode();
		const cardListButtonPosition = Vector2.create(REFERENCE_RESOLUTION_WIDTH - 88, layoutMetrics.topBarY);
		cardListButtonNode.setLocalPosition(cardListButtonPosition);
		const roundNode = this.getRoundNode();
		const roundPosition = Vector2.create(centerX, layoutMetrics.topBarY);
		roundNode.setLocalPosition(roundPosition);

		const plateNodes = this.getPlateNodes();
		const playerPlatePosition = Vector2.create(centerX, layoutMetrics.playerPlateY);
		plateNodes[PLAYER_INDEX].setLocalPosition(playerPlatePosition);
		const opponentPlatePosition = Vector2.create(centerX, layoutMetrics.opponentPlateY);
		plateNodes[OPPONENT_INDEX].setLocalPosition(opponentPlatePosition);

		const powerNodes = this.getPowerNodes();
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const powerPosition = Vector2.create(POWER_X, layoutMetrics.playedY[playerIndex]);
			powerNodes[playerIndex].setLocalPosition(powerPosition);
		}

		const deckNode = this.getDeckNode();
		const deckPosition = Vector2.create(DECK_X, arenaCenterY);
		deckNode.setLocalPosition(deckPosition);

		const hintNode = this.getHintNode();
		const hintPosition = Vector2.create(centerX, layoutMetrics.hintY);
		hintNode.setLocalPosition(hintPosition);
		const timerNode = this.getTimerNode();
		const timerPosition = Vector2.create(centerX, layoutMetrics.timerY);
		timerNode.setLocalPosition(timerPosition);
		const actionButton = this.getActionButton();
		const actionButtonNode = actionButton.getNode();
		const actionButtonPosition = Vector2.create(centerX, layoutMetrics.actionButtonY);
		actionButtonNode.setLocalPosition(actionButtonPosition);

		const bannerView = this.getBannerView();
		bannerView.layout(centerX, arenaCenterY);

		const cardListPopup = this.getCardListPopup();
		cardListPopup.layout(viewSize);
		const resultPopup = this.getResultPopup();
		resultPopup.layout(viewSize);
		const confirmPopup = this.getConfirmPopup();
		confirmPopup.layout(viewSize);

		this.placeAllCards();
	}

	//==============================================================================
	// 화면에 들어옴. (들어올 때마다 새 매치)
	//==============================================================================
	/**
	 * @override
	 */
	onEnter() {
		super.onEnter();
		this.startMatch();
	}

	//==============================================================================
	// 화면에서 나감. (진행 중인 흐름을 버린다)
	//==============================================================================
	/**
	 * @override
	 */
	onExit() {
		this.#flowSerial += 1;
		this.endSelection();
		this.#actionEvent = null;
		super.onExit();
	}

	//==============================================================================
	// 갱신. (고르기 제한 시간)
	//==============================================================================
	/**
	 * @override
	 * @param { number } timeDelta
	 */
	tick(timeDelta) {
		super.tick(timeDelta);
		const selection = this.getSelection();
		if (selection === null) {
			return;
		}
		selection.remainingSeconds -= timeDelta;
		this.updateTimer();
		if (selection.remainingSeconds <= 0) {
			this.completeSelectionByTimeout();
		}
	}

	//==============================================================================
	// 매치 시작.
	//==============================================================================
	startMatch() {
		this.#flowSerial += 1;
		const flowSerial = this.getFlowSerial();
		this.endSelection();
		this.#actionEvent = null;
		this.clearCardLayer();
		this.#match = this.createEmptyMatch();
		this.updatePlates();
		this.updateRoundLabel();
		this.setHint("");
		const actionButton = this.getActionButton();
		actionButton.setEnabled(false);
		this.runMatch(flowSerial);
	}

	//==============================================================================
	// 매치 흐름.
	//==============================================================================
	/**
	 * @param { number } flowSerial
	 * @returns { Promise<void> }
	 */
	async runMatch(flowSerial) {
		const match = this.getMatch();
		const scene = this.getScene();
		await waitSeconds(scene, 0.3);
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		await this.showBanner("대전 시작", `${match.roundCount}판 승부`, Colors.goldLight, 0.9);
		for (let roundIndex = 0; roundIndex < match.roundCount; ++roundIndex) {
			if (!this.isFlowCurrent(flowSerial)) {
				return;
			}
			match.roundIndex = roundIndex;
			this.updateRoundLabel();
			await this.playRound(flowSerial);
		}
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		await this.finishMatch(flowSerial);
	}

	//==============================================================================
	// 한 판. (게임마다 단계를 바꾸려면 이 함수를 고친다)
	//==============================================================================
	/**
	 * @param { number } flowSerial
	 * @returns { Promise<void> }
	 */
	async playRound(flowSerial) {
		const match = this.getMatch();
		const handSize = getMatchSetting("handSize", 3);
		const playCount = getMatchSetting("playCount", 2);
		match.deck = createShuffledDeck();
		match.hands = [[], []];
		match.handViews = [[], []];
		match.playedIndices = [[], []];
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			match.hands[playerIndex] = match.deck.splice(0, handSize);
		}
		this.setRevealedCardIds(match.hands[PLAYER_INDEX]);

		await this.showBanner(`${match.roundIndex + 1}판`, "", Colors.goldLight, 0.45);
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		await this.dealHands();
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}

		const playerChoice = await this.waitForPlayerSelection(playCount, "카드 내기", `낼 카드 ${playCount}장을 고르세요`);
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		const opponentChoice = chooseBotPlay(match.hands[OPPONENT_INDEX], playCount);
		match.playedIndices = [playerChoice, opponentChoice];
		await this.movePlayedCards();
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		await this.revealPlayedCards(OPPONENT_INDEX);
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}

		const plays = this.collectPlays();
		const result = resolveRound(plays);
		await this.presentRoundResult(result);
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		const isLastRound = match.roundIndex >= match.roundCount - 1;
		await this.waitForAction(isLastRound ? "결과 보기" : "다음 판");
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		await this.clearRound();
	}

	//==============================================================================
	// 매치 끝. (결과 팝업 → 다시 하기 / 타이틀로)
	//==============================================================================
	/**
	 * @param { number } flowSerial
	 * @returns { Promise<void> }
	 */
	async finishMatch(flowSerial) {
		const match = this.getMatch();
		const playerScore = match.scores[PLAYER_INDEX];
		const opponentScore = match.scores[OPPONENT_INDEX];
		let headline = "무승부";
		let headlineColor = Colors.draw;
		if (playerScore > opponentScore) {
			headline = "승리!";
			headlineColor = Colors.win;
		}
		else if (playerScore < opponentScore) {
			headline = "패배";
			headlineColor = Colors.lose;
		}
		const playerScoreLabel = this.formatScore(playerScore);
		const opponentScoreLabel = this.formatScore(opponentScore);
		const scoreLine = `${playerScoreLabel}  :  ${opponentScoreLabel}`;
		const detail = `${match.names[PLAYER_INDEX]} 대 ${match.names[OPPONENT_INDEX]} · ${match.roundCount}판`;
		const resultPopup = this.getResultPopup();
		const resultChoice = await resultPopup.show(headline, headlineColor, scoreLine, detail);
		if (!this.isFlowCurrent(flowSerial)) {
			return;
		}
		if (resultChoice === ResultChoice.retry) {
			this.startMatch();
			return;
		}
		const scene = this.getScene();
		scene.changeScreen(Screen.title);
	}

	//==============================================================================
	// 나가기 확인.
	//==============================================================================
	async confirmExit() {
		const confirmPopup = this.getConfirmPopup();
		const isConfirmed = await confirmPopup.ask("대전을 그만두고 타이틀로 갈까요?", "그만두기", "계속하기");
		if (!isConfirmed) {
			return;
		}
		const scene = this.getScene();
		scene.changeScreen(Screen.title);
	}

	//==============================================================================
	// 카드 목록 열기. (지금까지 드러난 카드를 어둡게)
	//==============================================================================
	openCardList() {
		const match = this.getMatch();
		const cardListPopup = this.getCardListPopup();
		cardListPopup.setRevealedCardIds(match.revealedCardIds);
		cardListPopup.open();
	}

	//==============================================================================
	// 드러난 카드 기록. (카드 목록이 어둡게 보인다 — 판이 바뀌면 덱을 다시 섞으므로 새로 쓴다)
	//==============================================================================
	/**
	 * @param { object[] } cards
	 */
	setRevealedCardIds(cards) {
		const match = this.getMatch();
		match.revealedCardIds = [];
		this.addRevealedCards(cards);
	}

	/**
	 * @param { object[] } cards
	 */
	addRevealedCards(cards) {
		const match = this.getMatch();
		for (let index = 0; index < cards.length; ++index) {
			const cardId = cards[index].id;
			if (!match.revealedCardIds.includes(cardId)) {
				match.revealedCardIds.push(cardId);
			}
		}
	}

	//==============================================================================
	// 띠지 띄우기.
	//==============================================================================
	/**
	 * @param { string } title
	 * @param { string } subtitle
	 * @param { string } titleColor
	 * @param { number } holdSeconds
	 * @returns { Promise<void> }
	 */
	showBanner(title, subtitle, titleColor, holdSeconds) {
		const scene = this.getScene();
		const bannerView = this.getBannerView();
		return bannerView.show(scene, title, subtitle, titleColor, holdSeconds);
	}

	//==============================================================================
	// 안내 글자 바꾸기.
	//==============================================================================
	/**
	 * @param { string } hint
	 */
	setHint(hint) {
		const hintNode = this.getHintNode();
		hintNode.setActive(hint !== "");
		const hintLabelNode = hintNode.findChildByName("hintLabel");
		const hintText = hintLabelNode.getComponent(Text);
		hintText.setText(hint);
	}

	//==============================================================================
	// 판 번호 표기.
	//==============================================================================
	updateRoundLabel() {
		const match = this.getMatch();
		const roundNode = this.getRoundNode();
		const roundText = roundNode.getComponent(Text);
		const roundLabel = `${match.roundIndex + 1} / ${match.roundCount}판`;
		roundText.setText(roundLabel);
	}

	//==============================================================================
	// 이름·점수판 표기.
	//==============================================================================
	updatePlates() {
		const match = this.getMatch();
		const plateNodes = this.getPlateNodes();
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const plateNode = plateNodes[playerIndex];
			const nameNode = plateNode.findChildByName("name");
			const nameText = nameNode.getComponent(Text);
			nameText.setText(match.names[playerIndex]);
			this.setPlateScore(playerIndex, match.scores[playerIndex]);
		}
	}

	//==============================================================================
	// 점수판 숫자 바꾸기.
	//==============================================================================
	/**
	 * @param { number } playerIndex
	 * @param { number } score
	 */
	setPlateScore(playerIndex, score) {
		const plateNodes = this.getPlateNodes();
		const scoreNode = plateNodes[playerIndex].findChildByName("score");
		const scoreText = scoreNode.getComponent(Text);
		const scoreLabel = `${this.formatScore(score)}점`;
		scoreText.setText(scoreLabel);
	}

	//==============================================================================
	// 점수 글자. (정수면 그대로, 아니면 소수 한 자리 — 3~4인의 나눠 잃는 점수)
	//==============================================================================
	/**
	 * @param { number } score
	 * @returns { string }
	 */
	formatScore(score) {
		if (System.Number.isInteger(score)) {
			return `${score}`;
		}
		return score.toFixed(1);
	}

	//==============================================================================
	// 손패 자리. (가운데 기준 부채꼴 — 가장자리 카드가 조금 낮고 기울어진다)
	//==============================================================================
	/**
	 * @param { number } playerIndex
	 * @param { number } cardIndex
	 * @param { number } cardCount
	 * @returns { object } { x, y, rotation }
	 */
	computeHandSlot(playerIndex, cardIndex, cardCount) {
		const layoutMetrics = this.getLayoutMetrics();
		const offset = cardIndex - (cardCount - 1) * 0.5;
		const spacing = (playerIndex === PLAYER_INDEX) ? PLAYER_HAND_SPACING : OPPONENT_HAND_SPACING;
		const direction = (playerIndex === PLAYER_INDEX) ? 1 : -1;
		const arcHeight = (playerIndex === PLAYER_INDEX) ? 10 : 5;
		return {
			x: layoutMetrics.centerX + offset * spacing,
			y: layoutMetrics.handY[playerIndex] + System.Math.abs(offset) * arcHeight * direction,
			rotation: offset * 5 * direction,
		};
	}

	//==============================================================================
	// 낸 카드 자리.
	//==============================================================================
	/**
	 * @param { number } playerIndex
	 * @param { number } slotIndex
	 * @param { number } slotCount
	 * @returns { object } { x, y, rotation }
	 */
	computePlayedSlot(playerIndex, slotIndex, slotCount) {
		const layoutMetrics = this.getLayoutMetrics();
		const offset = slotIndex - (slotCount - 1) * 0.5;
		return {
			x: layoutMetrics.centerX + offset * PLAYED_SPACING,
			y: layoutMetrics.playedY[playerIndex],
			rotation: 0,
		};
	}

	//==============================================================================
	// 카드 크기 키. (내 손패는 크게, 상대 손패는 작게)
	//==============================================================================
	/**
	 * @param { number } playerIndex
	 * @returns { string }
	 */
	getHandSizeKey(playerIndex) {
		return (playerIndex === PLAYER_INDEX) ? "hand" : "opponent";
	}

	//==============================================================================
	// 낸 카드 배율. (손패 크기에서 낸 카드 크기로)
	//==============================================================================
	/**
	 * @param { number } playerIndex
	 * @returns { number }
	 */
	getPlayedScale(playerIndex) {
		const sizeKey = this.getHandSizeKey(playerIndex);
		const cardSize = CardSize[sizeKey];
		return CardSize.played.width / cardSize.width;
	}

	//==============================================================================
	// 카드 전부 제자리에. (화면 크기가 바뀌었을 때 — 연출 중이 아닌 카드의 자리를 맞춘다)
	//==============================================================================
	placeAllCards() {
		const match = this.getMatch();
		const layoutMetrics = this.getLayoutMetrics();
		if (layoutMetrics === null) {
			return;
		}
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const handViews = match.handViews[playerIndex];
			const playedIndices = match.playedIndices[playerIndex];
			for (let cardIndex = 0; cardIndex < handViews.length; ++cardIndex) {
				const cardView = handViews[cardIndex];
				const playedSlotIndex = playedIndices.indexOf(cardIndex);
				if (playedSlotIndex >= 0) {
					const playedSlot = this.computePlayedSlot(playerIndex, playedSlotIndex, playedIndices.length);
					cardView.setPosition(playedSlot.x, playedSlot.y);
					continue;
				}
				const handSlot = this.computeHandSlot(playerIndex, cardIndex, handViews.length);
				const isSelected = cardView.isSelected();
				const liftY = isSelected ? -SELECT_LIFT : 0;
				cardView.setPosition(handSlot.x, handSlot.y + liftY);
			}
		}
	}

	//==============================================================================
	// 카드 층 비우기.
	//==============================================================================
	clearCardLayer() {
		const cardLayerNode = this.getCardLayerNode();
		cardLayerNode.removeChildren();
		const powerNodes = this.getPowerNodes();
		for (let playerIndex = 0; playerIndex < powerNodes.length; ++playerIndex) {
			powerNodes[playerIndex].setActive(false);
		}
	}

	//==============================================================================
	// 덱에서 카드 한 장 만들기. (덱 자리에서 뒷면으로 시작)
	//==============================================================================
	/**
	 * @param { number } playerIndex
	 * @param { object } card
	 * @returns { CardView }
	 */
	createCardAtDeck(playerIndex, card) {
		const sizeKey = this.getHandSizeKey(playerIndex);
		const cardView = new CardView(sizeKey, card, false);
		const deckNode = this.getDeckNode();
		const deckPosition = deckNode.getLocalPosition();
		cardView.setPosition(deckPosition.x, deckPosition.y);
		const cardNode = cardView.getNode();
		const deckScale = CardSize.opponent.width / CardSize[sizeKey].width;
		const startScale = Vector2.create(deckScale, deckScale);
		cardNode.setLocalScale(startScale);
		const cardLayerNode = this.getCardLayerNode();
		cardLayerNode.addChild(cardNode);
		return cardView;
	}

	//==============================================================================
	// 손패 나눠 주기. (한 장씩 번갈아 날아가고, 내 카드는 다 받은 뒤 앞면으로 뒤집힌다)
	//==============================================================================
	/**
	 * @returns { Promise<void> }
	 */
	async dealHands() {
		const scene = this.getScene();
		const match = this.getMatch();
		const handSize = match.hands[PLAYER_INDEX].length;
		const flights = [];
		let dealOrder = 0;
		for (let cardIndex = 0; cardIndex < handSize; ++cardIndex) {
			for (let playerIndex = PLAYER_COUNT - 1; playerIndex >= 0; --playerIndex) {
				const card = match.hands[playerIndex][cardIndex];
				const cardView = this.createCardAtDeck(playerIndex, card);
				match.handViews[playerIndex].push(cardView);
				const handSlot = this.computeHandSlot(playerIndex, cardIndex, handSize);
				const cardNode = cardView.getNode();
				const delay = dealOrder * 0.09;
				flights.push(animateNode(scene, cardNode, { x: handSlot.x, y: handSlot.y, rotation: handSlot.rotation, scaleX: 1, scaleY: 1 }, 0.42, Tween.easingFunction.cubic.out, delay));
				dealOrder += 1;
			}
		}
		await System.Promise.all(flights);
		const flips = [];
		const playerHandViews = match.handViews[PLAYER_INDEX];
		for (let cardIndex = 0; cardIndex < playerHandViews.length; ++cardIndex) {
			const cardView = playerHandViews[cardIndex];
			flips.push(this.flipCardAfter(cardView, true, cardIndex * 0.07));
		}
		await System.Promise.all(flips);
	}

	//==============================================================================
	// 잠시 뒤 뒤집기.
	//==============================================================================
	/**
	 * @param { CardView } cardView
	 * @param { boolean } isFaceUp
	 * @param { number } delay
	 * @returns { Promise<void> }
	 */
	async flipCardAfter(cardView, isFaceUp, delay) {
		const scene = this.getScene();
		if (delay > 0) {
			await waitSeconds(scene, delay);
		}
		await cardView.flip(scene, isFaceUp, 0.34);
	}

	//==============================================================================
	// 내 고르기 기다리기. (손패를 눌러 requiredCount 장을 고르고 행동 버튼으로 확정 — 시간이 다 되면 자동)
	//==============================================================================
	/**
	 * @param { number } requiredCount
	 * @param { string } actionLabel
	 * @param { string } hint
	 * @returns { Promise<number[]> } 고른 손패 자리 번호. (고른 순서가 아니라 작은 번호부터)
	 */
	waitForPlayerSelection(requiredCount, actionLabel, hint) {
		const match = this.getMatch();
		const choiceSeconds = getMatchSetting("choiceSeconds", 15);
		const selectionPromise = new System.Promise((resolve) => {
			this.#selection = {
				requiredCount: requiredCount,
				resolve: resolve,
				remainingSeconds: choiceSeconds,
				totalSeconds: choiceSeconds,
			};
		});
		const handViews = match.handViews[PLAYER_INDEX];
		for (let cardIndex = 0; cardIndex < handViews.length; ++cardIndex) {
			const cardView = handViews[cardIndex];
			cardView.setTappable(true, (tappedCardView) => {
				this.toggleCardSelection(tappedCardView);
			});
		}
		this.setHint(hint);
		const actionButton = this.getActionButton();
		actionButton.setLabel(actionLabel);
		actionButton.setEnabled(false);
		this.#actionEvent = () => {
			this.completeSelection();
		};
		const timerNode = this.getTimerNode();
		timerNode.setActive(true);
		this.updateTimer();
		return selectionPromise;
	}

	//==============================================================================
	// 손패 카드 고르기·풀기. (다 골랐으면 더 고르지 않는다 — 한 장만 고르는 단계는 바꿔 고른다)
	//==============================================================================
	/**
	 * @param { CardView } cardView
	 */
	toggleCardSelection(cardView) {
		const selection = this.getSelection();
		if (selection === null) {
			return;
		}
		const match = this.getMatch();
		const handViews = match.handViews[PLAYER_INDEX];
		const isSelected = cardView.isSelected();
		if (isSelected) {
			this.setCardSelected(cardView, false);
		}
		else {
			const selectedIndices = this.collectSelectedIndices();
			if (selectedIndices.length >= selection.requiredCount) {
				if (selection.requiredCount !== 1) {
					return;
				}
				const previousCardView = handViews[selectedIndices[0]];
				this.setCardSelected(previousCardView, false);
			}
			this.setCardSelected(cardView, true);
		}
		const selectedCount = this.collectSelectedIndices().length;
		const actionButton = this.getActionButton();
		actionButton.setEnabled(selectedCount === selection.requiredCount);
	}

	//==============================================================================
	// 카드 고름 표시. (빛무리 + 위로 들기)
	//==============================================================================
	/**
	 * @param { CardView } cardView
	 * @param { boolean } isSelected
	 */
	setCardSelected(cardView, isSelected) {
		const scene = this.getScene();
		const match = this.getMatch();
		const handViews = match.handViews[PLAYER_INDEX];
		const cardIndex = handViews.indexOf(cardView);
		const handSlot = this.computeHandSlot(PLAYER_INDEX, cardIndex, handViews.length);
		cardView.setSelected(isSelected);
		const cardNode = cardView.getNode();
		const targetY = isSelected ? handSlot.y - SELECT_LIFT : handSlot.y;
		animateNode(scene, cardNode, { y: targetY }, 0.16, Tween.easingFunction.cubic.out);
	}

	//==============================================================================
	// 고른 손패 자리 번호 모으기.
	//==============================================================================
	/**
	 * @returns { number[] }
	 */
	collectSelectedIndices() {
		const match = this.getMatch();
		const handViews = match.handViews[PLAYER_INDEX];
		const selectedIndices = [];
		for (let cardIndex = 0; cardIndex < handViews.length; ++cardIndex) {
			const isSelected = handViews[cardIndex].isSelected();
			if (isSelected) {
				selectedIndices.push(cardIndex);
			}
		}
		return selectedIndices;
	}

	//==============================================================================
	// 고르기 확정. (행동 버튼)
	//==============================================================================
	completeSelection() {
		const selection = this.getSelection();
		if (selection === null) {
			return;
		}
		const selectedIndices = this.collectSelectedIndices();
		if (selectedIndices.length !== selection.requiredCount) {
			return;
		}
		this.finishSelection(selectedIndices);
	}

	//==============================================================================
	// 시간 초과. (모자란 장 수는 봇 판단으로 채운다 — 이미 고른 카드는 살린다)
	//==============================================================================
	completeSelectionByTimeout() {
		const selection = this.getSelection();
		if (selection === null) {
			return;
		}
		const selectedIndices = this.collectSelectedIndices();
		if (selectedIndices.length === selection.requiredCount) {
			this.finishSelection(selectedIndices);
			return;
		}
		const autoIndices = this.chooseAutoSelection(selection.requiredCount);
		this.finishSelection(autoIndices);
	}

	//==============================================================================
	// 시간 초과 때 대신 고르기. (게임마다 단계별 기본 선택을 바꾸려면 이 함수를 고친다)
	//==============================================================================
	/**
	 * @param { number } requiredCount
	 * @returns { number[] }
	 */
	chooseAutoSelection(requiredCount) {
		const match = this.getMatch();
		const autoIndices = chooseBotPlay(match.hands[PLAYER_INDEX], requiredCount);
		return autoIndices.slice().sort((left, right) => left - right);
	}

	//==============================================================================
	// 고르기 끝. (카드 표시를 맞추고 기다리던 흐름에 자리 번호를 넘긴다)
	//==============================================================================
	/**
	 * @param { number[] } selectedIndices
	 */
	finishSelection(selectedIndices) {
		const selection = this.getSelection();
		const match = this.getMatch();
		const handViews = match.handViews[PLAYER_INDEX];
		for (let cardIndex = 0; cardIndex < handViews.length; ++cardIndex) {
			const cardView = handViews[cardIndex];
			const shouldSelect = selectedIndices.includes(cardIndex);
			const isSelected = cardView.isSelected();
			if (shouldSelect !== isSelected) {
				this.setCardSelected(cardView, shouldSelect);
			}
		}
		this.endSelection();
		selection.resolve(selectedIndices);
	}

	//==============================================================================
	// 고르기 상태 정리. (탭·타이머·버튼을 끈다)
	//==============================================================================
	endSelection() {
		this.#selection = null;
		this.#actionEvent = null;
		const match = this.getMatch();
		const handViews = match.handViews[PLAYER_INDEX];
		for (let cardIndex = 0; cardIndex < handViews.length; ++cardIndex) {
			handViews[cardIndex].setTappable(false, null);
		}
		const timerNode = this.getTimerNode();
		timerNode.setActive(false);
		const actionButton = this.getActionButton();
		actionButton.setEnabled(false);
		this.setHint("");
	}

	//==============================================================================
	// 타이머 막대 갱신. (남은 비율만큼 줄고, 끝이 가까우면 붉어진다)
	//==============================================================================
	updateTimer() {
		const selection = this.getSelection();
		if (selection === null) {
			return;
		}
		const remainingRatio = System.Math.max(0, selection.remainingSeconds / selection.totalSeconds);
		const timerFillNode = this.getTimerFillNode();
		const fillSize = Vector2.create(TIMER_WIDTH * remainingRatio, TIMER_HEIGHT);
		timerFillNode.setContentSize(fillSize);
		const timerFillPaint = timerFillNode.getComponent(Paint);
		const isWarning = selection.remainingSeconds <= TIMER_WARNING_SECONDS;
		const fillColor = Color.createFromHEX(isWarning ? Colors.timerWarning : Colors.timer);
		timerFillPaint.setColor(fillColor);
	}

	//==============================================================================
	// 행동 버튼 눌림.
	//==============================================================================
	triggerAction() {
		const actionEvent = this.getActionEvent();
		if (actionEvent === null) {
			return;
		}
		actionEvent();
	}

	//==============================================================================
	// 행동 버튼 한 번 기다리기. ("다음 판" 처럼 진행만 하는 버튼)
	//==============================================================================
	/**
	 * @param { string } actionLabel
	 * @returns { Promise<void> }
	 */
	waitForAction(actionLabel) {
		const actionButton = this.getActionButton();
		actionButton.setLabel(actionLabel);
		actionButton.setEnabled(true);
		return new System.Promise((resolve) => {
			this.#actionEvent = () => {
				this.#actionEvent = null;
				actionButton.setEnabled(false);
				resolve();
			};
		});
	}

	//==============================================================================
	// 낸 카드 앞으로. (고른 카드는 판 가운데로, 남은 카드는 어둡게 내려놓는다)
	//==============================================================================
	/**
	 * @returns { Promise<void> }
	 */
	async movePlayedCards() {
		const scene = this.getScene();
		const match = this.getMatch();
		const moves = [];
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const handViews = match.handViews[playerIndex];
			const playedIndices = match.playedIndices[playerIndex];
			const playedScale = this.getPlayedScale(playerIndex);
			for (let cardIndex = 0; cardIndex < handViews.length; ++cardIndex) {
				const cardView = handViews[cardIndex];
				const cardNode = cardView.getNode();
				cardView.setSelected(false);
				const playedSlotIndex = playedIndices.indexOf(cardIndex);
				if (playedSlotIndex < 0) {
					cardView.setDimmed(true);
					const handSlot = this.computeHandSlot(playerIndex, cardIndex, handViews.length);
					const sinkY = (playerIndex === PLAYER_INDEX) ? 30 : -20;
					moves.push(animateNode(scene, cardNode, { y: handSlot.y + sinkY, opacity: 0.6 }, 0.3, Tween.easingFunction.cubic.out));
					continue;
				}
				const playedSlot = this.computePlayedSlot(playerIndex, playedSlotIndex, playedIndices.length);
				const delay = playedSlotIndex * 0.06 + playerIndex * 0.12;
				moves.push(animateNode(scene, cardNode, { x: playedSlot.x, y: playedSlot.y, rotation: 0, scaleX: playedScale, scaleY: playedScale }, 0.4, Tween.easingFunction.back.out, delay));
			}
		}
		await System.Promise.all(moves);
	}

	//==============================================================================
	// 낸 카드 공개. (뒷면인 카드를 동시에 뒤집는다)
	//==============================================================================
	/**
	 * @param { number } playerIndex
	 * @returns { Promise<void> }
	 */
	async revealPlayedCards(playerIndex) {
		const match = this.getMatch();
		const handViews = match.handViews[playerIndex];
		const playedIndices = match.playedIndices[playerIndex];
		const flips = [];
		const revealedCards = [];
		for (let slotIndex = 0; slotIndex < playedIndices.length; ++slotIndex) {
			const cardView = handViews[playedIndices[slotIndex]];
			const isFaceUp = cardView.isFaceUp();
			revealedCards.push(cardView.getCard());
			if (isFaceUp) {
				continue;
			}
			flips.push(this.flipCardAfter(cardView, true, slotIndex * 0.08));
		}
		await System.Promise.all(flips);
		this.addRevealedCards(revealedCards);
	}

	//==============================================================================
	// 낸 카드 모으기. (규칙 판정 입력 — 자리마다 낸 카드 정의 목록)
	//==============================================================================
	/**
	 * @returns { object[][] }
	 */
	collectPlays() {
		const match = this.getMatch();
		const plays = [];
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const hand = match.hands[playerIndex];
			const playedIndices = match.playedIndices[playerIndex];
			const playedCards = [];
			for (let slotIndex = 0; slotIndex < playedIndices.length; ++slotIndex) {
				playedCards.push(hand[playedIndices[slotIndex]]);
			}
			plays.push(playedCards);
		}
		return plays;
	}

	//==============================================================================
	// 판 결과 보이기. (전투력 세기 → 승패 강조 → 점수 반영)
	//==============================================================================
	/**
	 * @param { object } result { powers, winnerIndex, scoreDeltas }
	 * @returns { Promise<void> }
	 */
	async presentRoundResult(result) {
		const scene = this.getScene();
		const match = this.getMatch();
		const powerNodes = this.getPowerNodes();
		const counts = [];
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const powerNode = powerNodes[playerIndex];
			const powerText = powerNode.getComponent(Text);
			powerText.setText("0");
			powerText.setTextColor(Colors.textLight);
			powerNode.setActive(true);
			const power = result.powers[playerIndex];
			counts.push(animateValue(scene, 0, power, 0.6, (value) => {
				const powerLabel = `${System.Math.round(value)}`;
				powerText.setText(powerLabel);
			}));
		}
		await System.Promise.all(counts);

		const winnerIndex = result.winnerIndex;
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const isWinner = playerIndex === winnerIndex;
			const powerNode = powerNodes[playerIndex];
			const powerText = powerNode.getComponent(Text);
			if (winnerIndex >= 0) {
				powerText.setTextColor(isWinner ? Colors.win : Colors.lose);
			}
			const handViews = match.handViews[playerIndex];
			const playedIndices = match.playedIndices[playerIndex];
			for (let slotIndex = 0; slotIndex < playedIndices.length; ++slotIndex) {
				const cardView = handViews[playedIndices[slotIndex]];
				if (winnerIndex < 0) {
					continue;
				}
				if (isWinner) {
					cardView.setGlow(true, Colors.win);
				}
				else {
					cardView.setDimmed(true);
				}
			}
			if (isWinner) {
				punchScale(scene, powerNode, 1.35, 0.45);
			}
		}

		let bannerTitle = "무승부";
		let bannerColor = Colors.draw;
		if (winnerIndex === PLAYER_INDEX) {
			bannerTitle = "승리!";
			bannerColor = Colors.win;
		}
		else if (winnerIndex === OPPONENT_INDEX) {
			bannerTitle = "패배";
			bannerColor = Colors.lose;
		}
		const playerDelta = result.scoreDeltas[PLAYER_INDEX];
		const bannerSubtitle = (playerDelta === 0) ? "점수 변동 없음" : `${playerDelta > 0 ? "+" : ""}${this.formatScore(playerDelta)}점`;
		const bannerPromise = this.showBanner(bannerTitle, bannerSubtitle, bannerColor, 0.8);
		await this.applyScoreDeltas(result.scoreDeltas);
		await bannerPromise;
	}

	//==============================================================================
	// 점수 반영. (점수판 숫자가 바뀌며 튀어오른다)
	//==============================================================================
	/**
	 * @param { number[] } scoreDeltas
	 * @returns { Promise<void> }
	 */
	async applyScoreDeltas(scoreDeltas) {
		const scene = this.getScene();
		const match = this.getMatch();
		const plateNodes = this.getPlateNodes();
		const counts = [];
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const scoreDelta = scoreDeltas[playerIndex];
			if (scoreDelta === 0) {
				continue;
			}
			const fromScore = match.scores[playerIndex];
			const toScore = fromScore + scoreDelta;
			match.scores[playerIndex] = toScore;
			counts.push(animateValue(scene, fromScore, toScore, 0.5, (value) => {
				const isFinished = value === toScore;
				const shownScore = isFinished ? toScore : System.Math.round(value);
				this.setPlateScore(playerIndex, shownScore);
			}));
			punchScale(scene, plateNodes[playerIndex], 1.12, 0.4);
		}
		await System.Promise.all(counts);
	}

	//==============================================================================
	// 판 정리. (카드가 흐려지며 사라지고 전투력 숫자를 감춘다)
	//==============================================================================
	/**
	 * @returns { Promise<void> }
	 */
	async clearRound() {
		const scene = this.getScene();
		const match = this.getMatch();
		const fades = [];
		for (let playerIndex = 0; playerIndex < PLAYER_COUNT; ++playerIndex) {
			const handViews = match.handViews[playerIndex];
			for (let cardIndex = 0; cardIndex < handViews.length; ++cardIndex) {
				const cardNode = handViews[cardIndex].getNode();
				const localPosition = cardNode.getLocalPosition();
				fades.push(animateNode(scene, cardNode, { opacity: 0, y: localPosition.y - 24 }, 0.28, Tween.easingFunction.quadratic.in, cardIndex * 0.03));
			}
		}
		const powerNodes = this.getPowerNodes();
		for (let playerIndex = 0; playerIndex < powerNodes.length; ++playerIndex) {
			fades.push(animateNode(scene, powerNodes[playerIndex], { opacity: 0 }, 0.2, Tween.easingFunction.quadratic.in));
		}
		await System.Promise.all(fades);
		match.handViews = [[], []];
		match.playedIndices = [[], []];
		this.clearCardLayer();
		for (let playerIndex = 0; playerIndex < powerNodes.length; ++playerIndex) {
			powerNodes[playerIndex].setLocalOpacity(1);
		}
	}
}
