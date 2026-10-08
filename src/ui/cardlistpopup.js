//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Pivot } from "../../libs/vanilla.js/src/base/pivot.js";
import { WorldNode } from "../../libs/vanilla.js/src/core/node/worldnode.js";
import { Text, TextAlign, TextBaseline } from "../../libs/vanilla.js/src/core/component/text.js";
import { NodeLayout } from "../../libs/vanilla.js/src/misc/nodelayout.js";
import { Colors, CardSize, PanelSize, FontFamily, FontSize } from "../game/constants.js";
import { getFont } from "../game/fonts.js";
import { getCardDefinitions, getCardKind } from "../game/cards.js";
import { ButtonStyle } from "../game/textures.js";
import { PopupView } from "./popupview.js";
import { ButtonView } from "./buttonview.js";
import { CardView } from "./cardview.js";


//==============================================================================
// 카드 목록 팝업 배치 값. (패널 좌상단 기준)
//==============================================================================
const TITLE_CENTER_Y = 62;
const GRID_TOP = 112;
const GRID_BOTTOM = 800;
const GRID_COLUMN_COUNT = 5;
const GRID_GAP = 10;
const DETAIL_TOP = 822;
const DETAIL_SIDE_MARGIN = 44;
const CLOSE_BUTTON_CENTER_Y = 1008;


//==============================================================================
// 카드 목록 팝업.
// - 카드 표의 카드 전부를 격자로 보여 주고, 누른 카드의 효과 설명을 아래에 띄운다.
// - 대전 중이면 이미 드러난 카드를 어둡게 해서 "아직 안 보인 카드" 를 셀 수 있게 한다.
//==============================================================================
export class CardListPopup extends PopupView {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { CardView[] } */ #cardViews;
	/** @private @type { Text } */ #detailTitleText;
	/** @private @type { Text } */ #detailDescriptionText;
	/** @private @type { CardView } */ #selectedCardView;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @param { object } scene
	 */
	constructor(scene) {
		super(scene, "cardListPopup", "cardList");
		this.#cardViews = [];
		this.#selectedCardView = null;
		const panelSize = PanelSize.cardList;
		const panelNode = this.getPanelNode();
		const displayFont = getFont(FontFamily.display);
		const bodyFont = getFont(FontFamily.body);
		const detailWidth = panelSize.width - DETAIL_SIDE_MARGIN * 2;

		NodeLayout.create(WorldNode)
			.name("title")
			.pivot(Pivot.middleCenter)
			.contentSize(panelSize.width, 60)
			.localPosition(panelSize.width * 0.5, TITLE_CENTER_Y)
			.component(Text, (text) => {
				text.setFont(displayFont);
				text.setFontSize(FontSize.heading);
				text.setText("카드 목록");
				text.setTextColor(Colors.goldLight);
				text.setStrokeColor(Colors.textDark);
				text.setStrokeWidth(5);
			})
			.build(panelNode);

		NodeLayout.create(WorldNode)
			.name("detailTitle")
			.pivot(Pivot.topLeft)
			.contentSize(detailWidth, 40)
			.localPosition(DETAIL_SIDE_MARGIN, DETAIL_TOP)
			.component(Text, (text) => {
				text.setFont(bodyFont);
				text.setFontSize(FontSize.body);
				text.setTextAlign(TextAlign.left);
				text.setTextBaseline(TextBaseline.top);
				text.setTextColor(Colors.gold);
				text.setText("카드를 누르면 설명이 보입니다");
				this.#detailTitleText = text;
			})
			.build(panelNode);

		NodeLayout.create(WorldNode)
			.name("detailDescription")
			.pivot(Pivot.topLeft)
			.contentSize(detailWidth, 100)
			.localPosition(DETAIL_SIDE_MARGIN, DETAIL_TOP + 46)
			.component(Text, (text) => {
				text.setFont(bodyFont);
				text.setFontSize(FontSize.small);
				text.setTextAlign(TextAlign.left);
				text.setTextBaseline(TextBaseline.top);
				text.setTextColor(Colors.textLight);
				text.setWordWrapWidth(detailWidth);
				this.#detailDescriptionText = text;
			})
			.build(panelNode);

		const closeButton = new ButtonView("closeButton", ButtonStyle.secondary, "medium", "닫기", () => {
			this.close();
		});
		const closeButtonNode = closeButton.getNode();
		const closeButtonPosition = Vector2.create(panelSize.width * 0.5, CLOSE_BUTTON_CENTER_Y);
		closeButtonNode.setLocalPosition(closeButtonPosition);
		panelNode.addChild(closeButtonNode);

		this.buildGrid();
	}

	//==============================================================================
	// 카드 칸 목록 반환.
	//==============================================================================
	/**
	 * @returns { CardView[] }
	 */
	getCardViews() {
		return this.#cardViews;
	}

	//==============================================================================
	// 설명 글자 반환.
	//==============================================================================
	/**
	 * @returns { Text }
	 */
	getDetailTitleText() {
		return this.#detailTitleText;
	}

	/**
	 * @returns { Text }
	 */
	getDetailDescriptionText() {
		return this.#detailDescriptionText;
	}

	//==============================================================================
	// 고른 카드 칸 반환. (없으면 null)
	//==============================================================================
	/**
	 * @returns { CardView }
	 */
	getSelectedCardView() {
		return this.#selectedCardView;
	}

	//==============================================================================
	// 격자 만들기. (카드 수에 맞춰 줄 수를 정하고, 넘치면 칸을 줄여 영역 안에 넣는다)
	//==============================================================================
	buildGrid() {
		const panelSize = PanelSize.cardList;
		const panelNode = this.getPanelNode();
		const cards = getCardDefinitions();
		const cardCount = cards.length;
		if (cardCount === 0) {
			return;
		}
		const rowCount = System.Math.ceil(cardCount / GRID_COLUMN_COUNT);
		const columnCount = System.Math.min(GRID_COLUMN_COUNT, cardCount);
		const cardSize = CardSize.list;
		const naturalWidth = columnCount * cardSize.width + (columnCount - 1) * GRID_GAP;
		const naturalHeight = rowCount * cardSize.height + (rowCount - 1) * GRID_GAP;
		const availableWidth = panelSize.width - 40;
		const availableHeight = GRID_BOTTOM - GRID_TOP;
		const gridScale = System.Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
		const cellWidth = (cardSize.width + GRID_GAP) * gridScale;
		const cellHeight = (cardSize.height + GRID_GAP) * gridScale;
		const gridWidth = naturalWidth * gridScale;
		const gridLeft = (panelSize.width - gridWidth) * 0.5;
		const cardScale = Vector2.create(gridScale, gridScale);

		for (let cardIndex = 0; cardIndex < cardCount; ++cardIndex) {
			const card = cards[cardIndex];
			const columnIndex = cardIndex % GRID_COLUMN_COUNT;
			const rowIndex = System.Math.floor(cardIndex / GRID_COLUMN_COUNT);
			const cardView = new CardView("list", card, true);
			const centerX = gridLeft + columnIndex * cellWidth + cardSize.width * gridScale * 0.5;
			const centerY = GRID_TOP + rowIndex * cellHeight + cardSize.height * gridScale * 0.5;
			cardView.setPosition(centerX, centerY);
			const cardNode = cardView.getNode();
			cardNode.setLocalScale(cardScale);
			cardView.setTappable(true, (tappedCardView) => {
				this.selectCardView(tappedCardView);
			});
			panelNode.addChild(cardNode);
			const cardViews = this.getCardViews();
			cardViews.push(cardView);
		}
	}

	//==============================================================================
	// 카드 칸 고르기. (빛무리 + 아래에 이름·종류·숫자·설명)
	//==============================================================================
	/**
	 * @param { CardView } cardView
	 */
	selectCardView(cardView) {
		const selectedCardView = this.getSelectedCardView();
		if (selectedCardView !== null) {
			selectedCardView.setSelected(false);
		}
		this.#selectedCardView = cardView;
		cardView.setSelected(true);
		const card = cardView.getCard();
		const kind = getCardKind(card.kind);
		const kindName = (kind !== null) ? kind.name : "";
		const detailTitleText = this.getDetailTitleText();
		const detailTitle = `${card.name}  ·  ${kindName} ${card.value}`;
		detailTitleText.setText(detailTitle);
		const detailDescriptionText = this.getDetailDescriptionText();
		const description = (card.description !== undefined && card.description !== null) ? card.description : "";
		detailDescriptionText.setText(description);
	}

	//==============================================================================
	// 드러난 카드 어둡게. (대전 중 상대에게 보인 카드·내 손의 카드를 지워 가며 셀 때)
	//==============================================================================
	/**
	 * @param { string[] } cardIds 어둡게 할 카드 아이디 목록. (빈 배열이면 모두 밝게)
	 */
	setRevealedCardIds(cardIds) {
		const cardViews = this.getCardViews();
		for (let index = 0; index < cardViews.length; ++index) {
			const cardView = cardViews[index];
			const card = cardView.getCard();
			const isRevealed = cardIds.includes(card.id);
			cardView.setDimmed(isRevealed);
		}
	}
}
