//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Vector2 } from "../../libs/vanilla.js/src/base/vector2.js";
import { Tween } from "../../libs/vanilla.js/src/core/tween.js";


//==============================================================================
// 연출 도우미.
//
// 씬 트윈(Scene.startTween)을 약속(Promise)으로 감싸 await 로 순서를 잇는다.
// 대전 흐름처럼 "카드가 날아간 뒤 → 뒤집고 → 숫자를 센다" 를 위에서 아래로 읽히게 쓰려고 쓴다.
// 씬 트윈은 엔진 시간으로 돌므로 탭이 숨겨져 멈추면 연출도 같이 멈춘다.
//==============================================================================


//==============================================================================
// 트윈이 0 초로 끝나지 않게 하는 최소 시간. (0 으로 나누면 진행률이 숫자가 아니게 되어 끝나지 않는다)
//==============================================================================
const MINIMUM_DURATION_SECONDS = 0.0001;


//==============================================================================
// 노드 상태 트윈. (위치·크기·투명도·회전 중 준 값만 바꾼다)
//==============================================================================
/**
 * @param { object } scene Scene.
 * @param { object } node WorldNode.
 * @param { object } target { x, y, scaleX, scaleY, opacity, rotation } 중 바꿀 값만.
 * @param { number } duration 초.
 * @param { Function } easingFunction 생략하면 cubic.out.
 * @param { number } delay 초. 생략하면 0.
 * @returns { Promise<void> }
 */
export function animateNode(scene, node, target, duration, easingFunction, delay) {
	const localPosition = node.getLocalPosition();
	const localScale = node.getLocalScale();
	const localOpacity = node.getLocalOpacity();
	const localRotation = node.getLocalRotation();
	const startValues = {
		x: localPosition.x,
		y: localPosition.y,
		scaleX: localScale.x,
		scaleY: localScale.y,
		opacity: localOpacity,
		rotation: localRotation,
	};
	const endValues = {};
	const targetKeys = System.Object.keys(target);
	for (let index = 0; index < targetKeys.length; ++index) {
		const targetKey = targetKeys[index];
		endValues[targetKey] = target[targetKey];
	}
	const resolvedEasingFunction = (easingFunction !== undefined && easingFunction !== null) ? easingFunction : Tween.easingFunction.cubic.out;
	const resolvedDelay = (delay !== undefined && delay !== null) ? delay : 0;
	const resolvedDuration = System.Math.max(duration, MINIMUM_DURATION_SECONDS);
	return new System.Promise((resolve) => {
		const tween = new Tween(startValues);
		tween.to(endValues, resolvedDuration);
		tween.delay(resolvedDelay);
		tween.easing(resolvedEasingFunction);
		tween.setUpdate((values) => {
			applyTweenValues(node, values);
		});
		tween.setComplete(() => {
			resolve();
		});
		scene.startTween(tween);
	});
}


//==============================================================================
// 트윈 값 적용. (없는 키는 지금 값을 그대로 둔다)
//==============================================================================
/**
 * @param { object } node
 * @param { object } values
 */
function applyTweenValues(node, values) {
	if (values.x !== undefined || values.y !== undefined) {
		const localPosition = node.getLocalPosition();
		const positionX = (values.x !== undefined) ? values.x : localPosition.x;
		const positionY = (values.y !== undefined) ? values.y : localPosition.y;
		const newLocalPosition = Vector2.create(positionX, positionY);
		node.setLocalPosition(newLocalPosition);
	}
	if (values.scaleX !== undefined || values.scaleY !== undefined) {
		const localScale = node.getLocalScale();
		const scaleX = (values.scaleX !== undefined) ? values.scaleX : localScale.x;
		const scaleY = (values.scaleY !== undefined) ? values.scaleY : localScale.y;
		const newLocalScale = Vector2.create(scaleX, scaleY);
		node.setLocalScale(newLocalScale);
	}
	if (values.opacity !== undefined) {
		node.setLocalOpacity(values.opacity);
	}
	if (values.rotation !== undefined) {
		node.setLocalRotation(values.rotation);
	}
}


//==============================================================================
// 숫자 트윈. (점수 세기처럼 값만 바뀌는 연출 — 매 갱신마다 콜백에 값을 넘긴다)
//==============================================================================
/**
 * @param { object } scene
 * @param { number } fromValue
 * @param { number } toValue
 * @param { number } duration
 * @param { Function } updateCallback (value) => void
 * @param { Function } easingFunction 생략하면 cubic.out.
 * @returns { Promise<void> }
 */
export function animateValue(scene, fromValue, toValue, duration, updateCallback, easingFunction) {
	const resolvedEasingFunction = (easingFunction !== undefined && easingFunction !== null) ? easingFunction : Tween.easingFunction.cubic.out;
	const resolvedDuration = System.Math.max(duration, MINIMUM_DURATION_SECONDS);
	return new System.Promise((resolve) => {
		const tween = new Tween({ value: fromValue });
		tween.to({ value: toValue }, resolvedDuration);
		tween.easing(resolvedEasingFunction);
		tween.setUpdate((values) => {
			updateCallback(values.value);
		});
		tween.setComplete(() => {
			updateCallback(toValue);
			resolve();
		});
		scene.startTween(tween);
	});
}


//==============================================================================
// 기다리기. (엔진 시간 기준)
//==============================================================================
/**
 * @param { object } scene
 * @param { number } seconds
 * @returns { Promise<void> }
 */
export function waitSeconds(scene, seconds) {
	const resolvedDuration = System.Math.max(seconds, MINIMUM_DURATION_SECONDS);
	return new System.Promise((resolve) => {
		const tween = new Tween({ value: 0 });
		tween.to({ value: 1 }, resolvedDuration);
		tween.setComplete(() => {
			resolve();
		});
		scene.startTween(tween);
	});
}


//==============================================================================
// 튀어오름. (잠깐 커졌다가 원래 크기로 — 강조용)
//==============================================================================
/**
 * @param { object } scene
 * @param { object } node
 * @param { number } peakScale 가장 커지는 배율. (원래 크기 대비)
 * @param { number } duration 전체 시간.
 * @returns { Promise<void> }
 */
export async function punchScale(scene, node, peakScale, duration) {
	const localScale = node.getLocalScale();
	const baseScaleX = localScale.x;
	const baseScaleY = localScale.y;
	await animateNode(scene, node, { scaleX: baseScaleX * peakScale, scaleY: baseScaleY * peakScale }, duration * 0.35, Tween.easingFunction.quadratic.out);
	await animateNode(scene, node, { scaleX: baseScaleX, scaleY: baseScaleY }, duration * 0.65, Tween.easingFunction.back.out);
}
