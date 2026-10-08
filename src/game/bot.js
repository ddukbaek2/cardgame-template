//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { listCombinations, computePower } from "./rules.js";


//==============================================================================
// 예제 봇. (템플릿용 — 혼자 계산한 전투력이 가장 높은 조합을 낸다)
//
// 시간 초과로 사람 대신 고를 때도 같은 함수를 쓴다.
//==============================================================================


//==============================================================================
// 낼 카드 고르기. (손패 자리 번호 배열)
//==============================================================================
/**
 * @param { object[] } hand
 * @param { number } playCount
 * @returns { number[] }
 */
export function chooseBotPlay(hand, playCount) {
	const combinations = listCombinations(hand.length, playCount);
	let bestCombination = combinations[0];
	let bestPower = -1;
	for (let index = 0; index < combinations.length; ++index) {
		const combination = combinations[index];
		const playedCards = [];
		for (let cardIndex = 0; cardIndex < combination.length; ++cardIndex) {
			playedCards.push(hand[combination[cardIndex]]);
		}
		const power = computePower(playedCards);
		if (power > bestPower) {
			bestPower = power;
			bestCombination = combination;
		}
	}
	return bestCombination;
}
