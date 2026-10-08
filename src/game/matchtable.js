//==============================================================================
// 대전 설정 테이블. (assets/data/match.json — 런타임은 로드만 한다)
//
// { roundCount, handSize, playCount, choiceSeconds, playerName, opponentName }
//   roundCount    — 한 매치의 판 수.
//   handSize      — 한 판에 각자 받는 카드 수.
//   playCount     — 손패에서 골라 내는 카드 수.
//   choiceSeconds — 고르기 제한 시간. (초 — 넘기면 자동으로 고른다)
//   playerName / opponentName — 화면에 보이는 이름.
//==============================================================================
let matchTable = null;


//==============================================================================
// 대전 설정 테이블 주입.
//==============================================================================
/**
 * @param { object } table
 */
export function setMatchTable(table) {
	matchTable = table;
}


//==============================================================================
// 대전 설정 값 반환. (테이블이 없거나 키가 없으면 기본값)
//==============================================================================
/**
 * @param { string } key
 * @param { * } defaultValue
 * @returns { * }
 */
export function getMatchSetting(key, defaultValue) {
	if (matchTable === null || matchTable === undefined) {
		return defaultValue;
	}
	const value = matchTable[key];
	if (value === undefined || value === null) {
		return defaultValue;
	}
	return value;
}
