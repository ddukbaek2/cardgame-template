//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { ImageAsset } from "../../libs/vanilla.js/src/resource/imageasset.js";
import {
	Colors, CardSize, ButtonSize, PanelSize, TEXTURE_BAKE_SCALE,
	BACKGROUND_IMAGE_PATH, BACKGROUND_WIDTH, BACKGROUND_HEIGHT, BANNER_WIDTH, BANNER_HEIGHT,
} from "./constants.js";
import { getCardKinds } from "./cards.js";


//==============================================================================
// 구운 텍스처 보관소.
//
// 이미지 킷 없이 Canvas2D 그라데이션으로 그린 그림을 이미지로 구워 스프라이트에 쓴다.
// (엔진의 Paint 는 단색만 칠하므로 입체감 있는 카드 틀·버튼·패널은 여기서 굽는다)
// 구운 이미지는 디코드가 끝난 뒤에만 쓴다. — 디코드 전 이미지를 GPU 에 올리면 빈 텍스처가 캐시에 남는다.
// 그래서 쓰일 크기를 상수(CardSize·ButtonSize·PanelSize)에서 읽어 로드 단계에서 전부 굽는다.
//==============================================================================
let textureByKey = {};


//==============================================================================
// 버튼 모양.
//==============================================================================
export const ButtonStyle = System.Object.freeze({
	primary: "primary",
	secondary: "secondary",
	disabled: "disabled",
});


//==============================================================================
// 카드 그림 층. (몸통 → 일러스트 → 덮개 순서로 겹친다)
//==============================================================================
export const CardLayer = System.Object.freeze({
	base: "base",
	overlay: "overlay",
});


//==============================================================================
// 텍스처 키 목록.
//==============================================================================
export const TextureKey = System.Object.freeze({
	background: "background",
	banner: "banner",
	softCircle: "softCircle",
});


//==============================================================================
// 카드 앞면 텍스처 키 합성.
//==============================================================================
/**
 * @param { string } layer CardLayer 값.
 * @param { string } kindKey 카드 종류 키.
 * @param { string } sizeKey CardSize 키.
 * @returns { string }
 */
export function getCardTextureKey(layer, kindKey, sizeKey) {
	return `card:${layer}:${kindKey}:${sizeKey}`;
}


//==============================================================================
// 카드 뒷면 텍스처 키 합성.
//==============================================================================
/**
 * @param { string } sizeKey CardSize 키.
 * @returns { string }
 */
export function getCardBackTextureKey(sizeKey) {
	return `cardBack:${sizeKey}`;
}


//==============================================================================
// 카드 빛무리 텍스처 키 합성. (선택 강조 / 그림자 — 흰색으로 구워 틴트해서 쓴다)
//==============================================================================
/**
 * @param { string } sizeKey CardSize 키.
 * @returns { string }
 */
export function getCardGlowTextureKey(sizeKey) {
	return `cardGlow:${sizeKey}`;
}


//==============================================================================
// 버튼 텍스처 키 합성.
//==============================================================================
/**
 * @param { string } style ButtonStyle 값.
 * @param { string } sizeKey ButtonSize 키.
 * @returns { string }
 */
export function getButtonTextureKey(style, sizeKey) {
	return `button:${style}:${sizeKey}`;
}


//==============================================================================
// 패널 텍스처 키 합성.
//==============================================================================
/**
 * @param { string } sizeKey PanelSize 키.
 * @returns { string }
 */
export function getPanelTextureKey(sizeKey) {
	return `panel:${sizeKey}`;
}


//==============================================================================
// 카드 빛무리 여백. (카드 크기에 대한 비율 — 빛무리 그림은 카드보다 이만큼 크다)
//==============================================================================
/**
 * @param { number } cardWidth
 * @returns { number }
 */
export function getCardGlowMargin(cardWidth) {
	return System.Math.round(cardWidth * 0.16);
}


//==============================================================================
// 카드 앞면의 일러스트 창 영역. (몸통·덮개를 굽는 쪽과 일러스트를 얹는 쪽이 같은 값을 쓴다)
//==============================================================================
/**
 * @param { number } cardWidth
 * @param { number } cardHeight
 * @returns { object } { x, y, width, height, radius }
 */
export function getCardArtWindow(cardWidth, cardHeight) {
	const margin = cardWidth * 0.07;
	return {
		x: margin,
		y: margin,
		width: cardWidth - margin * 2,
		height: cardHeight * 0.62,
		radius: cardWidth * 0.05,
	};
}


//==============================================================================
// 카드 앞면의 이름판 영역.
//==============================================================================
/**
 * @param { number } cardWidth
 * @param { number } cardHeight
 * @returns { object } { x, y, width, height, radius }
 */
export function getCardNamePlate(cardWidth, cardHeight) {
	const margin = cardWidth * 0.06;
	const top = cardHeight * 0.715;
	return {
		x: margin,
		y: top,
		width: cardWidth - margin * 2,
		height: cardHeight - top - margin,
		radius: cardWidth * 0.05,
	};
}


//==============================================================================
// 카드 앞면의 숫자 보석 영역. (중심과 반지름)
//==============================================================================
/**
 * @param { number } cardWidth
 * @returns { object } { centerX, centerY, radius }
 */
export function getCardValueGem(cardWidth) {
	return {
		centerX: cardWidth * 0.17,
		centerY: cardWidth * 0.17,
		radius: cardWidth * 0.15,
	};
}


//==============================================================================
// 텍스처 반환. (없으면 null)
//==============================================================================
/**
 * @param { string } textureKey
 * @returns { HTMLImageElement }
 */
export function getTexture(textureKey) {
	const texture = textureByKey[textureKey];
	if (texture === undefined) {
		return null;
	}
	return texture;
}


//==============================================================================
// 텍스처 전부 굽기. (카드 표를 넣은 뒤에 부른다 — 카드 종류마다 틀 색이 다르다)
//==============================================================================
/**
 * @returns { Promise<void> }
 */
export async function bakeTextures() {
	textureByKey = {};

	// 그리기는 순서대로 하고 디코드는 한꺼번에 기다린다. (한 장씩 기다리면 장 수만큼 프레임이 밀린다)
	const bakeJobs = [];
	const backgroundBake = (BACKGROUND_IMAGE_PATH !== "") ? loadBackgroundImage() : bakeImage(BACKGROUND_WIDTH, BACKGROUND_HEIGHT, 1, drawBackground);
	bakeJobs.push(storeBakedTexture(TextureKey.background, backgroundBake));
	const bannerBake = bakeImage(BANNER_WIDTH, BANNER_HEIGHT, TEXTURE_BAKE_SCALE, drawBanner);
	bakeJobs.push(storeBakedTexture(TextureKey.banner, bannerBake));
	const softCircleBake = bakeImage(64, 64, TEXTURE_BAKE_SCALE, drawSoftCircle);
	bakeJobs.push(storeBakedTexture(TextureKey.softCircle, softCircleBake));

	const kinds = getCardKinds();
	const cardSizeKeys = System.Object.keys(CardSize);
	for (let sizeIndex = 0; sizeIndex < cardSizeKeys.length; ++sizeIndex) {
		const sizeKey = cardSizeKeys[sizeIndex];
		const cardSize = CardSize[sizeKey];
		for (let kindIndex = 0; kindIndex < kinds.length; ++kindIndex) {
			const kind = kinds[kindIndex];
			const baseTextureKey = getCardTextureKey(CardLayer.base, kind.key, sizeKey);
			const baseBake = bakeImage(cardSize.width, cardSize.height, TEXTURE_BAKE_SCALE, (canvasRenderingContext, width, height, scale) => {
				drawCardBase(canvasRenderingContext, width, height, kind);
			});
			bakeJobs.push(storeBakedTexture(baseTextureKey, baseBake));
			const overlayTextureKey = getCardTextureKey(CardLayer.overlay, kind.key, sizeKey);
			const overlayBake = bakeImage(cardSize.width, cardSize.height, TEXTURE_BAKE_SCALE, (canvasRenderingContext, width, height, scale) => {
				drawCardOverlay(canvasRenderingContext, width, height, kind);
			});
			bakeJobs.push(storeBakedTexture(overlayTextureKey, overlayBake));
		}
		const backTextureKey = getCardBackTextureKey(sizeKey);
		const backBake = bakeImage(cardSize.width, cardSize.height, TEXTURE_BAKE_SCALE, drawCardBack);
		bakeJobs.push(storeBakedTexture(backTextureKey, backBake));
		const glowMargin = getCardGlowMargin(cardSize.width);
		const glowTextureKey = getCardGlowTextureKey(sizeKey);
		const glowBake = bakeImage(cardSize.width + glowMargin * 2, cardSize.height + glowMargin * 2, 1, (canvasRenderingContext, width, height, scale) => {
			drawCardGlow(canvasRenderingContext, width, height, glowMargin, scale);
		});
		bakeJobs.push(storeBakedTexture(glowTextureKey, glowBake));
	}

	const buttonStyles = System.Object.values(ButtonStyle);
	const buttonSizeKeys = System.Object.keys(ButtonSize);
	for (let sizeIndex = 0; sizeIndex < buttonSizeKeys.length; ++sizeIndex) {
		const sizeKey = buttonSizeKeys[sizeIndex];
		const buttonSize = ButtonSize[sizeKey];
		for (let styleIndex = 0; styleIndex < buttonStyles.length; ++styleIndex) {
			const style = buttonStyles[styleIndex];
			const buttonTextureKey = getButtonTextureKey(style, sizeKey);
			const buttonBake = bakeImage(buttonSize.width, buttonSize.height, TEXTURE_BAKE_SCALE, (canvasRenderingContext, width, height, scale) => {
				drawButton(canvasRenderingContext, width, height, style);
			});
			bakeJobs.push(storeBakedTexture(buttonTextureKey, buttonBake));
		}
	}

	const panelSizeKeys = System.Object.keys(PanelSize);
	for (let sizeIndex = 0; sizeIndex < panelSizeKeys.length; ++sizeIndex) {
		const sizeKey = panelSizeKeys[sizeIndex];
		const panelSize = PanelSize[sizeKey];
		const panelTextureKey = getPanelTextureKey(sizeKey);
		const panelBake = bakeImage(panelSize.width, panelSize.height, TEXTURE_BAKE_SCALE, drawPanel);
		bakeJobs.push(storeBakedTexture(panelTextureKey, panelBake));
	}

	await System.Promise.all(bakeJobs);
}


//==============================================================================
// 배경 그림 로드. (실패하면 그라데이션 배경을 굽는다)
//==============================================================================
/**
 * @returns { Promise<HTMLImageElement> }
 */
async function loadBackgroundImage() {
	try {
		const imageAsset = new ImageAsset();
		await imageAsset.load(BACKGROUND_IMAGE_PATH);
		return imageAsset.getImage();
	}
	catch (error) {
		console.error(error);
		return bakeImage(BACKGROUND_WIDTH, BACKGROUND_HEIGHT, 1, drawBackground);
	}
}


//==============================================================================
// 구운 텍스처 보관. (디코드가 끝나면 키에 넣는다)
//==============================================================================
/**
 * @param { string } textureKey
 * @param { Promise<HTMLImageElement> } bakePromise
 * @returns { Promise<void> }
 */
async function storeBakedTexture(textureKey, bakePromise) {
	const image = await bakePromise;
	textureByKey[textureKey] = image;
}


//==============================================================================
// 이미지 굽기. (오프스크린 캔버스에 그린 뒤 디코드까지 끝낸 이미지를 돌려준다)
//==============================================================================
/**
 * @param { number } width 기준 해상도 단위 너비.
 * @param { number } height 기준 해상도 단위 높이.
 * @param { number } scale 굽는 배율.
 * @param { Function } drawCallback (canvasRenderingContext, width, height, scale) => void
 * @returns { Promise<HTMLImageElement> }
 */
export async function bakeImage(width, height, scale, drawCallback) {
	const canvas = System.document.createElement("canvas");
	canvas.width = System.Math.ceil(width * scale);
	canvas.height = System.Math.ceil(height * scale);
	const canvasRenderingContext = canvas.getContext("2d");
	canvasRenderingContext.scale(scale, scale);
	drawCallback(canvasRenderingContext, width, height, scale);
	const image = new System.Image();
	image.src = canvas.toDataURL("image/png");
	await image.decode();
	return image;
}


//==============================================================================
// 둥근 사각형 경로.
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } x
 * @param { number } y
 * @param { number } width
 * @param { number } height
 * @param { number } radius
 */
export function traceRoundRect(canvasRenderingContext, x, y, width, height, radius) {
	const clampedRadius = System.Math.max(0, System.Math.min(radius, width * 0.5, height * 0.5));
	canvasRenderingContext.beginPath();
	canvasRenderingContext.moveTo(x + clampedRadius, y);
	canvasRenderingContext.arcTo(x + width, y, x + width, y + height, clampedRadius);
	canvasRenderingContext.arcTo(x + width, y + height, x, y + height, clampedRadius);
	canvasRenderingContext.arcTo(x, y + height, x, y, clampedRadius);
	canvasRenderingContext.arcTo(x, y, x + width, y, clampedRadius);
	canvasRenderingContext.closePath();
}


//==============================================================================
// 배경. (세로 그라데이션 + 중앙 빛 + 별 + 가장자리 어둡게)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 */
function drawBackground(canvasRenderingContext, width, height) {
	const verticalGradient = canvasRenderingContext.createLinearGradient(0, 0, 0, height);
	verticalGradient.addColorStop(0, Colors.backgroundTop);
	verticalGradient.addColorStop(1, Colors.backgroundBottom);
	canvasRenderingContext.fillStyle = verticalGradient;
	canvasRenderingContext.fillRect(0, 0, width, height);

	const glowGradient = canvasRenderingContext.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, width * 0.95);
	glowGradient.addColorStop(0, Colors.backgroundGlow);
	glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
	canvasRenderingContext.globalAlpha = 0.7;
	canvasRenderingContext.fillStyle = glowGradient;
	canvasRenderingContext.fillRect(0, 0, width, height);
	canvasRenderingContext.globalAlpha = 1;

	// 별. (같은 자리에 찍히도록 고정 씨앗의 선형 합동 난수를 쓴다)
	let seed = 20261009;
	const nextRandom = () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
	for (let starIndex = 0; starIndex < 140; ++starIndex) {
		const starX = nextRandom() * width;
		const starY = nextRandom() * height;
		const starRadius = 0.6 + nextRandom() * 1.6;
		canvasRenderingContext.globalAlpha = 0.15 + nextRandom() * 0.55;
		canvasRenderingContext.fillStyle = Colors.textLight;
		canvasRenderingContext.beginPath();
		canvasRenderingContext.arc(starX, starY, starRadius, 0, System.Math.PI * 2);
		canvasRenderingContext.fill();
	}
	canvasRenderingContext.globalAlpha = 1;

	const vignetteGradient = canvasRenderingContext.createRadialGradient(width * 0.5, height * 0.5, width * 0.35, width * 0.5, height * 0.5, height * 0.62);
	vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
	vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.6)");
	canvasRenderingContext.fillStyle = vignetteGradient;
	canvasRenderingContext.fillRect(0, 0, width, height);
}


//==============================================================================
// 띠지. (가운데가 짙고 양 끝이 사라지는 가로 띠 + 위아래 금색 선)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 */
function drawBanner(canvasRenderingContext, width, height) {
	const bandGradient = canvasRenderingContext.createLinearGradient(0, 0, width, 0);
	bandGradient.addColorStop(0, "rgba(8, 10, 28, 0)");
	bandGradient.addColorStop(0.18, "rgba(8, 10, 28, 0.92)");
	bandGradient.addColorStop(0.82, "rgba(8, 10, 28, 0.92)");
	bandGradient.addColorStop(1, "rgba(8, 10, 28, 0)");
	canvasRenderingContext.fillStyle = bandGradient;
	canvasRenderingContext.fillRect(0, height * 0.12, width, height * 0.76);

	const lineGradient = canvasRenderingContext.createLinearGradient(0, 0, width, 0);
	lineGradient.addColorStop(0, "rgba(245, 196, 81, 0)");
	lineGradient.addColorStop(0.5, "rgba(245, 196, 81, 1)");
	lineGradient.addColorStop(1, "rgba(245, 196, 81, 0)");
	canvasRenderingContext.fillStyle = lineGradient;
	canvasRenderingContext.fillRect(0, height * 0.12, width, 3);
	canvasRenderingContext.fillRect(0, height * 0.88 - 3, width, 3);
}


//==============================================================================
// 부드러운 원. (빛 알갱이 — 흰색으로 구워 틴트해서 쓴다)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 */
function drawSoftCircle(canvasRenderingContext, width, height) {
	const circleGradient = canvasRenderingContext.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.5);
	circleGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
	circleGradient.addColorStop(0.35, "rgba(255, 255, 255, 0.55)");
	circleGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
	canvasRenderingContext.fillStyle = circleGradient;
	canvasRenderingContext.fillRect(0, 0, width, height);
}


//==============================================================================
// 카드 몸통. (종류 색 그라데이션 + 테두리 + 일러스트 창 바탕 + 이름판)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 * @param { object } kind
 */
function drawCardBase(canvasRenderingContext, width, height, kind) {
	const cornerRadius = width * 0.08;
	const borderWidth = System.Math.max(2, width * 0.02);

	const bodyGradient = canvasRenderingContext.createLinearGradient(0, 0, width * 0.35, height);
	bodyGradient.addColorStop(0, kind.frameTop);
	bodyGradient.addColorStop(1, kind.frameBottom);
	traceRoundRect(canvasRenderingContext, 0, 0, width, height, cornerRadius);
	canvasRenderingContext.fillStyle = bodyGradient;
	canvasRenderingContext.fill();

	traceRoundRect(canvasRenderingContext, borderWidth * 0.5, borderWidth * 0.5, width - borderWidth, height - borderWidth, cornerRadius);
	canvasRenderingContext.lineWidth = borderWidth;
	canvasRenderingContext.strokeStyle = kind.frameBorder;
	canvasRenderingContext.stroke();

	const highlightInset = width * 0.032;
	traceRoundRect(canvasRenderingContext, highlightInset, highlightInset, width - highlightInset * 2, height - highlightInset * 2, cornerRadius * 0.7);
	canvasRenderingContext.lineWidth = System.Math.max(1, width * 0.008);
	canvasRenderingContext.strokeStyle = "rgba(255, 255, 255, 0.35)";
	canvasRenderingContext.stroke();

	const artWindow = getCardArtWindow(width, height);
	const windowGradient = canvasRenderingContext.createRadialGradient(
		artWindow.x + artWindow.width * 0.5, artWindow.y + artWindow.height * 0.45, 0,
		artWindow.x + artWindow.width * 0.5, artWindow.y + artWindow.height * 0.45, artWindow.height * 0.75,
	);
	windowGradient.addColorStop(0, kind.frameBottom);
	windowGradient.addColorStop(1, "#090b1c");
	traceRoundRect(canvasRenderingContext, artWindow.x, artWindow.y, artWindow.width, artWindow.height, artWindow.radius);
	canvasRenderingContext.fillStyle = windowGradient;
	canvasRenderingContext.fill();

	const namePlate = getCardNamePlate(width, height);
	const plateGradient = canvasRenderingContext.createLinearGradient(0, namePlate.y, 0, namePlate.y + namePlate.height);
	plateGradient.addColorStop(0, "#262c52");
	plateGradient.addColorStop(1, "#0c0f24");
	traceRoundRect(canvasRenderingContext, namePlate.x, namePlate.y, namePlate.width, namePlate.height, namePlate.radius);
	canvasRenderingContext.fillStyle = plateGradient;
	canvasRenderingContext.fill();
	canvasRenderingContext.lineWidth = System.Math.max(1, width * 0.012);
	canvasRenderingContext.strokeStyle = kind.frameBorder;
	canvasRenderingContext.stroke();
}


//==============================================================================
// 카드 덮개. (일러스트 위에 얹는 창 테두리 + 창 안쪽 그늘 + 숫자 보석)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 * @param { object } kind
 */
function drawCardOverlay(canvasRenderingContext, width, height, kind) {
	const artWindow = getCardArtWindow(width, height);

	// 창 안쪽 그늘. (일러스트 가장자리를 틀에 묻는다)
	canvasRenderingContext.save();
	traceRoundRect(canvasRenderingContext, artWindow.x, artWindow.y, artWindow.width, artWindow.height, artWindow.radius);
	canvasRenderingContext.clip();
	const shadeGradient = canvasRenderingContext.createRadialGradient(
		artWindow.x + artWindow.width * 0.5, artWindow.y + artWindow.height * 0.5, artWindow.height * 0.3,
		artWindow.x + artWindow.width * 0.5, artWindow.y + artWindow.height * 0.5, artWindow.height * 0.75,
	);
	shadeGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
	shadeGradient.addColorStop(1, "rgba(0, 0, 0, 0.45)");
	canvasRenderingContext.fillStyle = shadeGradient;
	canvasRenderingContext.fillRect(artWindow.x, artWindow.y, artWindow.width, artWindow.height);
	canvasRenderingContext.restore();

	// 창 테두리.
	traceRoundRect(canvasRenderingContext, artWindow.x, artWindow.y, artWindow.width, artWindow.height, artWindow.radius);
	canvasRenderingContext.lineWidth = System.Math.max(2, width * 0.022);
	canvasRenderingContext.strokeStyle = kind.frameBorder;
	canvasRenderingContext.stroke();
	const innerInset = width * 0.014;
	traceRoundRect(canvasRenderingContext, artWindow.x + innerInset, artWindow.y + innerInset, artWindow.width - innerInset * 2, artWindow.height - innerInset * 2, artWindow.radius * 0.7);
	canvasRenderingContext.lineWidth = System.Math.max(1, width * 0.006);
	canvasRenderingContext.strokeStyle = "rgba(255, 255, 255, 0.25)";
	canvasRenderingContext.stroke();

	// 숫자 보석.
	const valueGem = getCardValueGem(width);
	canvasRenderingContext.beginPath();
	canvasRenderingContext.arc(valueGem.centerX, valueGem.centerY + width * 0.012, valueGem.radius, 0, System.Math.PI * 2);
	canvasRenderingContext.fillStyle = "rgba(0, 0, 0, 0.5)";
	canvasRenderingContext.fill();

	const gemGradient = canvasRenderingContext.createRadialGradient(
		valueGem.centerX - valueGem.radius * 0.35, valueGem.centerY - valueGem.radius * 0.35, valueGem.radius * 0.1,
		valueGem.centerX, valueGem.centerY, valueGem.radius,
	);
	gemGradient.addColorStop(0, kind.accent);
	gemGradient.addColorStop(1, kind.frameBottom);
	canvasRenderingContext.beginPath();
	canvasRenderingContext.arc(valueGem.centerX, valueGem.centerY, valueGem.radius, 0, System.Math.PI * 2);
	canvasRenderingContext.fillStyle = gemGradient;
	canvasRenderingContext.fill();
	canvasRenderingContext.lineWidth = System.Math.max(2, width * 0.02);
	canvasRenderingContext.strokeStyle = kind.frameBorder;
	canvasRenderingContext.stroke();

	canvasRenderingContext.beginPath();
	canvasRenderingContext.ellipse(valueGem.centerX - valueGem.radius * 0.25, valueGem.centerY - valueGem.radius * 0.45, valueGem.radius * 0.45, valueGem.radius * 0.22, -0.5, 0, System.Math.PI * 2);
	canvasRenderingContext.fillStyle = "rgba(255, 255, 255, 0.4)";
	canvasRenderingContext.fill();
}


//==============================================================================
// 카드 뒷면. (짙은 남색 + 금 테두리 + 마름모 격자 + 가운데 문장)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 */
function drawCardBack(canvasRenderingContext, width, height) {
	const cornerRadius = width * 0.08;
	const backGradient = canvasRenderingContext.createLinearGradient(0, 0, width * 0.4, height);
	backGradient.addColorStop(0, Colors.cardBackTop);
	backGradient.addColorStop(1, Colors.cardBackBottom);
	traceRoundRect(canvasRenderingContext, 0, 0, width, height, cornerRadius);
	canvasRenderingContext.fillStyle = backGradient;
	canvasRenderingContext.fill();

	const borderWidth = System.Math.max(2, width * 0.03);
	traceRoundRect(canvasRenderingContext, borderWidth * 0.5, borderWidth * 0.5, width - borderWidth, height - borderWidth, cornerRadius);
	canvasRenderingContext.lineWidth = borderWidth;
	canvasRenderingContext.strokeStyle = Colors.goldDark;
	canvasRenderingContext.stroke();

	const innerInset = width * 0.075;
	canvasRenderingContext.save();
	traceRoundRect(canvasRenderingContext, innerInset, innerInset, width - innerInset * 2, height - innerInset * 2, cornerRadius * 0.6);
	canvasRenderingContext.clip();
	canvasRenderingContext.strokeStyle = "rgba(245, 196, 81, 0.16)";
	canvasRenderingContext.lineWidth = System.Math.max(1, width * 0.008);
	const latticeSpacing = width * 0.13;
	for (let offset = -height; offset < width + height; offset += latticeSpacing) {
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(offset, 0);
		canvasRenderingContext.lineTo(offset + height, height);
		canvasRenderingContext.stroke();
		canvasRenderingContext.beginPath();
		canvasRenderingContext.moveTo(offset, height);
		canvasRenderingContext.lineTo(offset + height, 0);
		canvasRenderingContext.stroke();
	}
	canvasRenderingContext.restore();
	traceRoundRect(canvasRenderingContext, innerInset, innerInset, width - innerInset * 2, height - innerInset * 2, cornerRadius * 0.6);
	canvasRenderingContext.lineWidth = System.Math.max(1, width * 0.012);
	canvasRenderingContext.strokeStyle = "rgba(245, 196, 81, 0.6)";
	canvasRenderingContext.stroke();

	// 가운데 문장. (금빛 원 + 네 갈래 별)
	const emblemRadius = width * 0.2;
	const centerX = width * 0.5;
	const centerY = height * 0.5;
	const emblemGradient = canvasRenderingContext.createRadialGradient(centerX - emblemRadius * 0.3, centerY - emblemRadius * 0.3, 0, centerX, centerY, emblemRadius);
	emblemGradient.addColorStop(0, Colors.goldLight);
	emblemGradient.addColorStop(1, Colors.goldDark);
	canvasRenderingContext.beginPath();
	canvasRenderingContext.arc(centerX, centerY, emblemRadius, 0, System.Math.PI * 2);
	canvasRenderingContext.fillStyle = emblemGradient;
	canvasRenderingContext.fill();
	canvasRenderingContext.lineWidth = System.Math.max(1, width * 0.015);
	canvasRenderingContext.strokeStyle = "#3a2405";
	canvasRenderingContext.stroke();

	const starOuter = emblemRadius * 0.78;
	const starInner = emblemRadius * 0.22;
	canvasRenderingContext.beginPath();
	for (let pointIndex = 0; pointIndex < 8; ++pointIndex) {
		const angle = -System.Math.PI * 0.5 + pointIndex * System.Math.PI * 0.25;
		const pointRadius = (pointIndex % 2 === 0) ? starOuter : starInner;
		const pointX = centerX + System.Math.cos(angle) * pointRadius;
		const pointY = centerY + System.Math.sin(angle) * pointRadius;
		if (pointIndex === 0) {
			canvasRenderingContext.moveTo(pointX, pointY);
		}
		else {
			canvasRenderingContext.lineTo(pointX, pointY);
		}
	}
	canvasRenderingContext.closePath();
	canvasRenderingContext.fillStyle = Colors.cardBackBottom;
	canvasRenderingContext.fill();
}


//==============================================================================
// 카드 빛무리. (카드 모양을 흐리게 번진 흰 빛 — 틴트해서 선택 강조나 그림자로 쓴다)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 * @param { number } glowMargin
 * @param { number } scale 굽는 배율. (그림자 흐림은 변환의 영향을 받지 않아 직접 곱한다)
 */
function drawCardGlow(canvasRenderingContext, width, height, glowMargin, scale) {
	const cardWidth = width - glowMargin * 2;
	const cardHeight = height - glowMargin * 2;
	canvasRenderingContext.shadowColor = "rgba(255, 255, 255, 1)";
	canvasRenderingContext.shadowBlur = glowMargin * 0.7 * scale;
	traceRoundRect(canvasRenderingContext, glowMargin, glowMargin, cardWidth, cardHeight, cardWidth * 0.08);
	canvasRenderingContext.fillStyle = "rgba(255, 255, 255, 1)";
	canvasRenderingContext.fill();
	canvasRenderingContext.fill();
}


//==============================================================================
// 버튼. (알약 모양 + 아래 그림자 + 위쪽 광택)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 * @param { string } style ButtonStyle 값.
 */
function drawButton(canvasRenderingContext, width, height, style) {
	let topColor = Colors.primaryTop;
	let bottomColor = Colors.primaryBottom;
	let borderColor = Colors.primaryBorder;
	if (style === ButtonStyle.secondary) {
		topColor = Colors.secondaryTop;
		bottomColor = Colors.secondaryBottom;
		borderColor = Colors.secondaryBorder;
	}
	else if (style === ButtonStyle.disabled) {
		topColor = Colors.disabledTop;
		bottomColor = Colors.disabledBottom;
		borderColor = Colors.disabledBorder;
	}

	const shadowOffset = height * 0.08;
	const bodyHeight = height - shadowOffset;
	const cornerRadius = bodyHeight * 0.36;
	const borderWidth = 3;

	traceRoundRect(canvasRenderingContext, 0, shadowOffset, width, bodyHeight, cornerRadius);
	canvasRenderingContext.fillStyle = "rgba(0, 0, 0, 0.45)";
	canvasRenderingContext.fill();

	const bodyGradient = canvasRenderingContext.createLinearGradient(0, 0, 0, bodyHeight);
	bodyGradient.addColorStop(0, topColor);
	bodyGradient.addColorStop(1, bottomColor);
	traceRoundRect(canvasRenderingContext, borderWidth * 0.5, borderWidth * 0.5, width - borderWidth, bodyHeight - borderWidth, cornerRadius);
	canvasRenderingContext.fillStyle = bodyGradient;
	canvasRenderingContext.fill();
	canvasRenderingContext.lineWidth = borderWidth;
	canvasRenderingContext.strokeStyle = borderColor;
	canvasRenderingContext.stroke();

	const glossInset = borderWidth + 3;
	const glossGradient = canvasRenderingContext.createLinearGradient(0, glossInset, 0, bodyHeight * 0.5);
	glossGradient.addColorStop(0, "rgba(255, 255, 255, 0.5)");
	glossGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
	traceRoundRect(canvasRenderingContext, glossInset, glossInset, width - glossInset * 2, bodyHeight * 0.46, cornerRadius * 0.8);
	canvasRenderingContext.fillStyle = glossGradient;
	canvasRenderingContext.fill();
}


//==============================================================================
// 패널. (팝업 몸통 — 짙은 남색 그라데이션 + 이중 테두리)
//==============================================================================
/**
 * @param { CanvasRenderingContext2D } canvasRenderingContext
 * @param { number } width
 * @param { number } height
 */
function drawPanel(canvasRenderingContext, width, height) {
	const cornerRadius = 30;
	const bodyGradient = canvasRenderingContext.createLinearGradient(0, 0, 0, height);
	bodyGradient.addColorStop(0, "#232a5c");
	bodyGradient.addColorStop(1, Colors.panel);
	traceRoundRect(canvasRenderingContext, 2, 2, width - 4, height - 4, cornerRadius);
	canvasRenderingContext.fillStyle = bodyGradient;
	canvasRenderingContext.fill();
	canvasRenderingContext.lineWidth = 4;
	canvasRenderingContext.strokeStyle = Colors.panelBorder;
	canvasRenderingContext.stroke();

	const innerInset = 12;
	traceRoundRect(canvasRenderingContext, innerInset, innerInset, width - innerInset * 2, height - innerInset * 2, cornerRadius - 8);
	canvasRenderingContext.lineWidth = 2;
	canvasRenderingContext.strokeStyle = "rgba(245, 196, 81, 0.4)";
	canvasRenderingContext.stroke();

	const glossGradient = canvasRenderingContext.createLinearGradient(0, 0, 0, height * 0.25);
	glossGradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
	glossGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
	traceRoundRect(canvasRenderingContext, innerInset, innerInset, width - innerInset * 2, height * 0.25, cornerRadius - 8);
	canvasRenderingContext.fillStyle = glossGradient;
	canvasRenderingContext.fill();
}
