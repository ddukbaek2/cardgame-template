//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;


//==============================================================================
// 예제 규칙. (템플릿용 — 게임마다 이 파일을 갈아 끼운다)
//
// 각자 받은 손패에서 정해진 장 수를 골라 동시에 낸다.
// 낸 카드 숫자의 합이 전투력이고, 가장 높은 사람이 이긴다. (최고가 둘 이상이면 무승부)
// 점수는 전투력 차이다.
//   2인: 승자 +차이, 패자 -차이.
//   3~4인: 승자는 2위와의 차이만큼 얻고, 패자들은 그 값을 (인원-1)로 나눠 잃는다.
//==============================================================================


//==============================================================================
// 조합 목록. (items 에서 count 개를 고르는 모든 경우 — 고른 자리 번호 배열의 배열)
//==============================================================================
/**
 * @param { number } itemCount
 * @param { number } count
 * @returns { number[][] }
 */
export function listCombinations(itemCount, count) {
	const combinations = [];
	const current = [];
	const visit = (startIndex) => {
		if (current.length === count) {
			combinations.push(current.slice());
			return;
		}
		for (let index = startIndex; index < itemCount; ++index) {
			current.push(index);
			visit(index + 1);
			current.pop();
		}
	};
	visit(0);
	return combinations;
}


//==============================================================================
// 전투력 계산. (낸 카드 숫자의 합)
//==============================================================================
/**
 * @param { object[] } playedCards
 * @returns { number }
 */
export function computePower(playedCards) {
	let power = 0;
	for (let index = 0; index < playedCards.length; ++index) {
		power += playedCards[index].value;
	}
	return power;
}


//==============================================================================
// 승자 찾기. (가장 높은 전투력 — 같은 최고가 둘 이상이면 -1)
//==============================================================================
/**
 * @param { number[] } powers
 * @returns { number }
 */
export function findWinnerIndex(powers) {
	let winnerIndex = -1;
	let bestPower = -System.Infinity;
	let isTied = false;
	for (let playerIndex = 0; playerIndex < powers.length; ++playerIndex) {
		const power = powers[playerIndex];
		if (power > bestPower) {
			bestPower = power;
			winnerIndex = playerIndex;
			isTied = false;
		}
		else if (power === bestPower) {
			isTied = true;
		}
	}
	if (isTied) {
		return -1;
	}
	return winnerIndex;
}


//==============================================================================
// 점수 계산. (전투력 차이 — 무승부면 모두 0)
//==============================================================================
/**
 * @param { number[] } powers
 * @param { number } winnerIndex
 * @returns { number[] }
 */
export function computeScoreDeltas(powers, winnerIndex) {
	const playerCount = powers.length;
	const scoreDeltas = [];
	for (let playerIndex = 0; playerIndex < playerCount; ++playerIndex) {
		scoreDeltas.push(0);
	}
	if (winnerIndex < 0 || playerCount < 2) {
		return scoreDeltas;
	}
	let secondPower = -System.Infinity;
	for (let playerIndex = 0; playerIndex < playerCount; ++playerIndex) {
		if (playerIndex === winnerIndex) {
			continue;
		}
		secondPower = System.Math.max(secondPower, powers[playerIndex]);
	}
	const margin = powers[winnerIndex] - secondPower;
	const lossPerPlayer = margin / (playerCount - 1);
	for (let playerIndex = 0; playerIndex < playerCount; ++playerIndex) {
		scoreDeltas[playerIndex] = (playerIndex === winnerIndex) ? margin : -lossPerPlayer;
	}
	return scoreDeltas;
}


//==============================================================================
// 한 판 판정.
//==============================================================================
/**
 * @param { object[][] } plays 사람마다 낸 카드 목록.
 * @returns { object } { powers, winnerIndex, scoreDeltas }
 */
export function resolveRound(plays) {
	const powers = [];
	for (let playerIndex = 0; playerIndex < plays.length; ++playerIndex) {
		const power = computePower(plays[playerIndex]);
		powers.push(power);
	}
	const winnerIndex = findWinnerIndex(powers);
	const scoreDeltas = computeScoreDeltas(powers, winnerIndex);
	return {
		powers: powers,
		winnerIndex: winnerIndex,
		scoreDeltas: scoreDeltas,
	};
}
