//==============================================================================
// 포함 모듈 목록.
//==============================================================================
import { FontAsset } from "../../libs/vanilla.js/src/resource/fontasset.js";
import { FONT_PATHS } from "./constants.js";


//==============================================================================
// 글꼴 보관소.
// - 패밀리마다 파일 하나를 굵기 서술자 없이 올린다. (Text 는 setFont 로 패밀리를 고른다)
//==============================================================================
let fontAssetByFamily = {};


//==============================================================================
// 글꼴 전부 로드. (실패한 글꼴은 시스템 글꼴로 대신 그린다)
//==============================================================================
/**
 * @returns { Promise<void> }
 */
export async function loadFonts() {
	fontAssetByFamily = {};
	for (let index = 0; index < FONT_PATHS.length; ++index) {
		const fontPath = FONT_PATHS[index];
		try {
			const fontAsset = new FontAsset();
			await fontAsset.loadFont(fontPath.family, fontPath.path);
			fontAssetByFamily[fontPath.family] = fontAsset;
		}
		catch (error) {
			console.error(error);
		}
	}
}


//==============================================================================
// 글꼴 반환. (없으면 null — Text 는 null 이면 시스템 글꼴을 쓴다)
//==============================================================================
/**
 * @param { string } family FontFamily 값.
 * @returns { FontAsset }
 */
export function getFont(family) {
	const fontAsset = fontAssetByFamily[family];
	if (fontAsset === undefined) {
		return null;
	}
	return fontAsset;
}
