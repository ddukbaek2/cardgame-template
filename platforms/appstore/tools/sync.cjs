#!/usr/bin/env node
//==============================================================================
// iOS 네이티브 프로젝트 준비. (앱스토어 제출용 — macOS + Xcode 에서만 빌드 가능)
// stage → (ios/ 가 없으면) cap add ios → cap sync ios → 세로 고정·버전 패치.
//
// 네이티브 ios/ 는 커밋하지 않고 첫 sync 때 만든다. 그래서 세로 고정·버전처럼
// 생성된 파일을 고쳐야 하는 값은 매 실행마다 다시 적용한다. (여러 번 실행해도 결과가 같다)
// macOS 가 아니면 www 스테이징까지만 하고 정상 종료한다.
//
// 사용법:
//   node tools/sync.cjs
//
// 이후:
//   npm run open:appstore → Xcode 에서 서명 팀 지정 → Product > Archive → App Store Connect 업로드.
//==============================================================================
"use strict";
const fileSystem = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const platformRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(platformRoot, "..", "..");
const iosDirectory = path.join(platformRoot, "ios");
const infoPlistPath = path.join(iosDirectory, "App", "App", "Info.plist");
const projectFilePath = path.join(iosDirectory, "App", "App.xcodeproj", "project.pbxproj");
const projectManifestPath = path.join(projectRoot, "project-manifest.json");

const logPrefix = "[sync]";
const PORTRAIT_ORIENTATION = "UIInterfaceOrientationPortrait";


//==============================================================================
// 캐패시터 명령 실행. (실패하면 예외)
//==============================================================================
/**
 * @param { string[] } commandArguments
 */
function runCapacitor(commandArguments) {
	const result = spawnSync("npx", commandArguments, {
		stdio: "inherit",
		cwd: platformRoot,
	});
	if (result.status !== 0) {
		throw new Error(`${logPrefix} 'npx ${commandArguments.join(" ")}' 실패.`);
	}
}


//==============================================================================
// Info.plist 의 방향 배열 하나를 세로 하나만 남기도록 치환. (키가 없으면 루트 dict 끝에 추가)
//==============================================================================
/**
 * @param { string } infoPlistText
 * @param { string } orientationKey
 * @returns { string }
 */
function replaceOrientationArray(infoPlistText, orientationKey) {
	const portraitArray = `<array>\n\t\t<string>${PORTRAIT_ORIENTATION}</string>\n\t</array>`;
	const keyPattern = new RegExp(`(<key>${orientationKey}</key>\\s*)<array>[\\s\\S]*?</array>`);
	if (keyPattern.test(infoPlistText)) {
		return infoPlistText.replace(keyPattern, `$1${portraitArray}`);
	}
	const lastDictionaryIndex = infoPlistText.lastIndexOf("</dict>");
	const insertedText = `\t<key>${orientationKey}</key>\n\t${portraitArray}\n`;
	return infoPlistText.slice(0, lastDictionaryIndex) + insertedText + infoPlistText.slice(lastDictionaryIndex);
}


//==============================================================================
// 세로 고정. (아이폰·아이패드 방향 배열을 UIInterfaceOrientationPortrait 하나로)
//==============================================================================
/**
 * @param { string } infoPlistText
 * @returns { string }
 */
function applyPortraitOrientation(infoPlistText) {
	let patchedText = replaceOrientationArray(infoPlistText, "UISupportedInterfaceOrientations");
	patchedText = replaceOrientationArray(patchedText, "UISupportedInterfaceOrientations~ipad");
	return patchedText;
}


//==============================================================================
// Info.plist 의 문자열 값 하나 반환. (키가 없으면 null)
//==============================================================================
/**
 * @param { string } infoPlistText
 * @param { string } plistKey
 * @returns { string | null }
 */
function readPlistString(infoPlistText, plistKey) {
	const valuePattern = new RegExp(`<key>${plistKey}</key>\\s*<string>([^<]*)</string>`);
	const valueMatch = infoPlistText.match(valuePattern);
	if (valueMatch === null) {
		return null;
	}
	return valueMatch[1];
}


//==============================================================================
// 버전 반영. (project-manifest.json 의 appstore.versionName / buildNumber)
// Info.plist 값이 글자 그대로면 Info.plist 를 고치고, $(MARKETING_VERSION) 처럼 빌드 설정을
// 가리키면 project.pbxproj 의 그 빌드 설정을 고친다. (캐패시터 6 템플릿은 후자)
//==============================================================================
/**
 * @param { string } infoPlistText
 * @param { string } projectFileText
 * @param { object } appstoreManifest
 * @returns { object } { infoPlistText, projectFileText }
 */
function applyVersion(infoPlistText, projectFileText, appstoreManifest) {
	const versionName = String(appstoreManifest.versionName);
	const buildNumber = String(appstoreManifest.buildNumber);
	const versionEntries = [
		{ plistKey: "CFBundleShortVersionString", buildSettingKey: "MARKETING_VERSION", value: versionName },
		{ plistKey: "CFBundleVersion", buildSettingKey: "CURRENT_PROJECT_VERSION", value: buildNumber },
	];
	let patchedInfoPlistText = infoPlistText;
	let patchedProjectFileText = projectFileText;
	for (const versionEntry of versionEntries) {
		const currentValue = readPlistString(patchedInfoPlistText, versionEntry.plistKey);
		if (currentValue === null) {
			console.warn(`${logPrefix} Info.plist 에 ${versionEntry.plistKey} 가 없어 버전을 반영하지 못했습니다.`);
			continue;
		}
		if (currentValue.startsWith("$(")) {
			const buildSettingPattern = new RegExp(`${versionEntry.buildSettingKey} = [^;]*;`, "g");
			patchedProjectFileText = patchedProjectFileText.replace(buildSettingPattern, `${versionEntry.buildSettingKey} = ${versionEntry.value};`);
		}
		else {
			const valuePattern = new RegExp(`(<key>${versionEntry.plistKey}</key>\\s*<string>)[^<]*(</string>)`);
			patchedInfoPlistText = patchedInfoPlistText.replace(valuePattern, `$1${versionEntry.value}$2`);
		}
	}
	return { infoPlistText: patchedInfoPlistText, projectFileText: patchedProjectFileText };
}


//==============================================================================
// 동기화 전체.
//==============================================================================
function main() {
	const { stage } = require(path.join(projectRoot, "libs", "vanilla.js", "tools", "project.cjs"));
	stage(path.join(projectRoot, "build", "web"), path.join(platformRoot, "www"), null);

	if (process.platform !== "darwin") {
		console.log(`${logPrefix} iOS 빌드는 macOS(Xcode) 에서만 가능합니다. www 스테이징까지만 하고 마칩니다.`);
		return;
	}

	// ios/ 가 없으면 최초 1회 'cap add ios' 로 스캐폴드 생성.
	if (!fileSystem.existsSync(iosDirectory)) {
		console.log(`${logPrefix} ios/ 디렉토리가 없어 'npx cap add ios' 를 실행합니다.`);
		try {
			runCapacitor(["cap", "add", "ios"]);
		}
		catch (error) {
			// 부분 생성된 ios/ 제거 (다음 실행에서 다시 시도 가능하도록).
			if (fileSystem.existsSync(iosDirectory)) {
				fileSystem.rmSync(iosDirectory, { recursive: true, force: true });
				console.warn(`${logPrefix} cap add ios 부분 실패로 ios/ 를 제거했습니다.`);
			}
			throw new Error(`${logPrefix} cap add ios 실패. Xcode / CocoaPods 설치 상태를 확인하세요.`);
		}
	}
	runCapacitor(["cap", "sync", "ios"]);

	const projectManifest = JSON.parse(fileSystem.readFileSync(projectManifestPath, "utf8"));
	const infoPlistText = fileSystem.readFileSync(infoPlistPath, "utf8");
	const projectFileText = fileSystem.readFileSync(projectFilePath, "utf8");
	const portraitInfoPlistText = applyPortraitOrientation(infoPlistText);
	const versionResult = applyVersion(portraitInfoPlistText, projectFileText, projectManifest.appstore);
	fileSystem.writeFileSync(infoPlistPath, versionResult.infoPlistText, "utf8");
	fileSystem.writeFileSync(projectFilePath, versionResult.projectFileText, "utf8");
	console.log(`${logPrefix} 세로 고정과 버전(${projectManifest.appstore.versionName} / ${projectManifest.appstore.buildNumber}) 을 반영했습니다.`);
}


module.exports = { applyPortraitOrientation, applyVersion };


//==============================================================================
// CLI 진입점.
//==============================================================================
if (require.main === module) {
	try {
		main();
	}
	catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
