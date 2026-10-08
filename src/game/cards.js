//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ImageAsset } from "../../libs/vanilla.js/src/resource/imageasset.js";


//==============================================================================
// 카드 테이블. (assets/data/cards.json — 런타임은 로드만 한다)
//
// 종류 하나 = { key, name, frameTop, frameBottom, frameBorder, accent }
//   frameTop / frameBottom — 카드 몸통 세로 그라데이션의 위·아래 색.
//   frameBorder            — 테두리와 이름판 테두리 색.
//   accent                 — 숫자 보석과 강조 글자 색.
//
// 카드 하나 = { id, kind, value, name, description, art }
//   id          — 고유 아이디. (덱 안에서 카드를 가리킨다 — 한 번 정하면 바꾸지 않는다)
//   kind        — 종류 키.
//   value       — 숫자.
//   description — 카드 목록에 보이는 효과 설명. (없으면 빈 글자)
//   art         — 일러스트 경로. (없으면 빈 글자 — 그림 대신 큰 숫자를 그린다)
//
// 덱은 카드 표에 적힌 카드 전부다. (같은 카드는 한 장씩)
// 밸런스 수정은 코드가 아니라 이 테이블 편집으로 한다.
//==============================================================================
let cardTable = null;
let cardById = {};
let kindByKey = {};
let artImageById = {};


//==============================================================================
// 카드 테이블 주입. (씬 load 에서 cards.json 을 읽어 넣는다)
//==============================================================================
/**
 * @param { object } table
 */
export function setCardTable(table) {
	cardTable = table;
	cardById = {};
	kindByKey = {};
	if (table === null || table === undefined) {
		return;
	}
	const cards = getCardDefinitions();
	for (let index = 0; index < cards.length; ++index) {
		const card = cards[index];
		cardById[card.id] = card;
	}
	const kinds = getCardKinds();
	for (let index = 0; index < kinds.length; ++index) {
		const kind = kinds[index];
		kindByKey[kind.key] = kind;
	}
}


//==============================================================================
// 카드 정의 목록 반환. (표에 적힌 순서 — 카드 목록 화면도 이 순서로 보인다)
//==============================================================================
/**
 * @returns { object[] }
 */
export function getCardDefinitions() {
	if (cardTable === null || cardTable.cards === undefined) {
		return [];
	}
	return cardTable.cards;
}


//==============================================================================
// 카드 정의 반환. (없으면 null)
//==============================================================================
/**
 * @param { string } cardId
 * @returns { object }
 */
export function getCardDefinition(cardId) {
	const card = cardById[cardId];
	if (card === undefined) {
		return null;
	}
	return card;
}


//==============================================================================
// 카드 종류 목록 반환.
//==============================================================================
/**
 * @returns { object[] }
 */
export function getCardKinds() {
	if (cardTable === null || cardTable.kinds === undefined) {
		return [];
	}
	return cardTable.kinds;
}


//==============================================================================
// 카드 종류 반환. (없으면 null)
//==============================================================================
/**
 * @param { string } kindKey
 * @returns { object }
 */
export function getCardKind(kindKey) {
	const kind = kindByKey[kindKey];
	if (kind === undefined) {
		return null;
	}
	return kind;
}


//==============================================================================
// 섞은 덱 만들기. (카드 정의를 복사하지 않고 그대로 담는다 — 카드는 아이디로 구분한다)
//==============================================================================
/**
 * @returns { object[] }
 */
export function createShuffledDeck() {
	const cards = getCardDefinitions();
	const deck = cards.slice();
	for (let index = deck.length - 1; index > 0; --index) {
		const swapIndex = System.Math.floor(System.Math.random() * (index + 1));
		const temporary = deck[index];
		deck[index] = deck[swapIndex];
		deck[swapIndex] = temporary;
	}
	return deck;
}


//==============================================================================
// 카드 일러스트 로드. (art 가 있는 카드만 — 실패한 카드는 그림 없이 그린다)
//==============================================================================
/**
 * @returns { Promise<void> }
 */
export async function loadCardArtImages() {
	artImageById = {};
	const cards = getCardDefinitions();
	for (let index = 0; index < cards.length; ++index) {
		const card = cards[index];
		if (card.art === undefined || card.art === null || card.art === "") {
			continue;
		}
		try {
			const imageAsset = new ImageAsset();
			await imageAsset.load(card.art);
			artImageById[card.id] = imageAsset.getImage();
		}
		catch (error) {
			console.error(error);
		}
	}
}


//==============================================================================
// 카드 일러스트 반환. (없으면 null)
//==============================================================================
/**
 * @param { string } cardId
 * @returns { HTMLImageElement }
 */
export function getCardArtImage(cardId) {
	const artImage = artImageById[cardId];
	if (artImage === undefined) {
		return null;
	}
	return artImage;
}
