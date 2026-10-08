#!/usr/bin/env node
//==============================================================================
// 안드로이드 네이티브 프로젝트 준비. (buildaab / buildapk / sync 공용)
// stage → (android/ 가 없으면) cap add android → cap sync android → 로컬 설정 → 패치.
//
// 네이티브 android/ 는 커밋하지 않고 첫 실행 때 만든다. 그래서 세로 고정·버전처럼
// 생성된 파일을 고쳐야 하는 값은 매 실행마다 다시 적용한다. (여러 번 실행해도 결과가 같다)
//
// 사용법:
//   node tools/prepareandroid.cjs                          — 준비만 한다. (npm run sync)
//   require("./prepareandroid.cjs").prepareAndroid(...)    — 빌드 도구가 gradle 실행 전에 부른다.
//
// 서명:
//   platforms/playstore/keystore.properties 가 있으면 그 업로드 키로 서명한다.
//   (storeFile / storePassword / keyAlias / keyPassword — storeFile 은 이 폴더 기준 경로)
//   gradle 에 -Pandroid.injected.signing.* 로 넘기므로 생성된 build.gradle 은 고치지 않는다.
//==============================================================================
"use strict";
const fileSystem = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const platformRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(platformRoot, "..", "..");
const androidDirectory = path.join(platformRoot, "android");
const keystorePropertiesPath = path.join(platformRoot, "keystore.properties");
const projectManifestPath = path.join(projectRoot, "project-manifest.json");
const { stage } = require(path.join(projectRoot, "libs", "vanilla.js", "tools", "project.cjs"));

const isWindows = process.platform === "win32";
const capacitorCommand = isWindows ? "npx.cmd" : "npx";

// 컴파일·대상 SDK. 캐패시터 6 템플릿은 34 로 만들지만 플레이 콘솔은 그보다 낮은 대상 SDK 를 받지 않는다.
// (playablegame-template 원스토어 래퍼도 35 로 올려 썼다. 플레이의 최소 대상 SDK 가 오르면 이 값만 올린다)
const ANDROID_SDK_VERSION = 35;


//==============================================================================
// 캐패시터 명령 실행. (실패하면 예외)
//==============================================================================
/**
 * @param { string[] } commandArguments
 * @param { string } logPrefix
 */
function runCapacitor(commandArguments, logPrefix) {
	const result = spawnSync(capacitorCommand, commandArguments, {
		stdio: "inherit",
		cwd: platformRoot,
		shell: isWindows,
	});
	if (result.status !== 0) {
		throw new Error(`${logPrefix} 'npx ${commandArguments.join(" ")}' 실패.`);
	}
}


//==============================================================================
// android/ 가 없으면 최초 1회 'cap add android' 로 스캐폴드 생성.
//==============================================================================
/**
 * @param { string } logPrefix
 */
function ensureAndroidProject(logPrefix) {
	if (fileSystem.existsSync(androidDirectory)) {
		return;
	}

	// cap add 는 내부에서 cap copy(www -> android 자산) 를 수행하므로 index.html 이 필요.
	const wwwIndexPath = path.join(platformRoot, "www", "index.html");
	if (!fileSystem.existsSync(wwwIndexPath)) {
		console.error(`${logPrefix} ${wwwIndexPath} 가 없습니다.`);
		console.error(`${logPrefix} 루트에서 'npm run build' 를 먼저 실행해 build/web 에 index.html 포함된 산출물을 준비하세요.`);
		throw new Error(`${logPrefix} www/index.html 미존재.`);
	}

	console.log(`${logPrefix} android/ 디렉토리가 없어 'npx cap add android' 를 실행합니다.`);
	try {
		runCapacitor(["cap", "add", "android"], logPrefix);
	}
	catch (error) {
		// 부분 생성된 android/ 제거 (다음 실행에서 다시 시도 가능하도록).
		if (fileSystem.existsSync(androidDirectory)) {
			fileSystem.rmSync(androidDirectory, { recursive: true, force: true });
			console.warn(`${logPrefix} cap add android 부분 실패로 android/ 를 제거했습니다.`);
		}
		throw new Error(`${logPrefix} cap add android 실패. Android SDK / JDK 설치 상태를 확인하세요.`);
	}
}


//==============================================================================
// local.properties 가 없으면 생성. (Android SDK 경로 지정)
//==============================================================================
/**
 * @param { string } logPrefix
 */
function writeLocalProperties(logPrefix) {
	const localPropertiesPath = path.join(androidDirectory, "local.properties");
	if (fileSystem.existsSync(localPropertiesPath)) {
		return;
	}
	let sdkDirectory = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null;
	if (!sdkDirectory && isWindows && process.env.LOCALAPPDATA) {
		const candidateDirectory = path.join(process.env.LOCALAPPDATA, "Android", "Sdk");
		if (fileSystem.existsSync(candidateDirectory)) {
			sdkDirectory = candidateDirectory;
		}
	}
	if (sdkDirectory) {
		const normalizedSdkDirectory = sdkDirectory.replace(/\\/g, "/");
		fileSystem.writeFileSync(localPropertiesPath, `# Auto-generated. Android SDK 위치.\nsdk.dir=${normalizedSdkDirectory}\n`, "utf8");
		console.log(`${logPrefix} local.properties 생성: sdk.dir=${normalizedSdkDirectory}`);
	}
	else {
		console.warn(`${logPrefix} Android SDK 경로를 자동 감지하지 못했습니다.`);
		console.warn("  다음 중 하나로 해결하세요:");
		console.warn("    1) ANDROID_HOME 환경변수 설정 후 재시도");
		console.warn(`    2) ${localPropertiesPath} 에 'sdk.dir=<SDK 경로>' 수동 추가`);
	}
}


//==============================================================================
// gradle.properties 에 Android Studio 번들 JBR(JDK 17) 경로 지정.
// 시스템 JAVA_HOME 이 구버전(예: JDK 11)이더라도 Gradle 빌드는 JDK 17 로 수행되도록 강제.
//==============================================================================
/**
 * @param { string } logPrefix
 */
function writeGradleJavaHome(logPrefix) {
	const gradlePropertiesPath = path.join(androidDirectory, "gradle.properties");
	let jbrPath = "";
	if (process.platform === "win32") {
		jbrPath = "C:/Program Files/Android/Android Studio/jbr";
	}
	else if (process.platform === "darwin") {
		jbrPath = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
	}
	if (!fileSystem.existsSync(gradlePropertiesPath)) {
		return;
	}
	const gradleProperties = fileSystem.readFileSync(gradlePropertiesPath, "utf8");
	if (gradleProperties.includes("org.gradle.java.home")) {
		return;
	}
	if (!fileSystem.existsSync(jbrPath)) {
		console.warn(`${logPrefix} Android Studio 번들 JBR 경로가 없습니다: ${jbrPath}`);
		console.warn(`${logPrefix} Android Studio 를 설치했거나, gradle.properties 에 올바른 'org.gradle.java.home' 경로를 수동으로 지정하세요.`);
		return;
	}
	const patchedText = gradleProperties.replace(/\s+$/, "")
		+ "\n\n# Android Studio 번들 JBR (JDK 17) 사용. Gradle 빌드 전용.\n"
		+ `org.gradle.java.home=${jbrPath}\n`;
	fileSystem.writeFileSync(gradlePropertiesPath, patchedText, "utf8");
	console.log(`${logPrefix} gradle.properties 에 org.gradle.java.home=${jbrPath} 를 추가했습니다.`);
}


//==============================================================================
// 세로 고정. (메인 액티비티에 android:screenOrientation="portrait" — 이미 있으면 건너뜀)
//==============================================================================
/**
 * @param { string } logPrefix
 */
function applyPortraitOrientation(logPrefix) {
	const androidManifestPath = path.join(androidDirectory, "app", "src", "main", "AndroidManifest.xml");
	const androidManifestText = fileSystem.readFileSync(androidManifestPath, "utf8");
	const mainActivityPattern = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/;
	const mainActivityMatch = androidManifestText.match(mainActivityPattern);
	if (mainActivityMatch === null) {
		throw new Error(`${logPrefix} AndroidManifest.xml 에서 MainActivity 를 찾지 못했습니다: ${androidManifestPath}`);
	}
	const mainActivityTag = mainActivityMatch[0];
	if (mainActivityTag.includes("android:screenOrientation=")) {
		return;
	}
	const patchedActivityTag = mainActivityTag.replace("android:name=\".MainActivity\"", "android:name=\".MainActivity\"\n            android:screenOrientation=\"portrait\"");
	const patchedText = androidManifestText.replace(mainActivityTag, patchedActivityTag);
	fileSystem.writeFileSync(androidManifestPath, patchedText, "utf8");
	console.log(`${logPrefix} AndroidManifest.xml 메인 액티비티를 세로 고정했습니다.`);
}


//==============================================================================
// 컴파일·대상 SDK 반영. (variables.gradle 의 compileSdkVersion / targetSdkVersion)
//==============================================================================
/**
 * @param { string } logPrefix
 */
function applySdkVersion(logPrefix) {
	const variablesGradlePath = path.join(androidDirectory, "variables.gradle");
	const variablesGradleText = fileSystem.readFileSync(variablesGradlePath, "utf8");
	let patchedText = variablesGradleText.replace(/compileSdkVersion\s*=\s*\d+/, `compileSdkVersion = ${ANDROID_SDK_VERSION}`);
	patchedText = patchedText.replace(/targetSdkVersion\s*=\s*\d+/, `targetSdkVersion = ${ANDROID_SDK_VERSION}`);
	if (patchedText === variablesGradleText) {
		return;
	}
	fileSystem.writeFileSync(variablesGradlePath, patchedText, "utf8");
	console.log(`${logPrefix} 컴파일·대상 SDK 를 ${ANDROID_SDK_VERSION} 으로 맞췄습니다.`);
}


//==============================================================================
// 버전 반영. (project-manifest.json 의 playstore.versionCode / versionName → app/build.gradle)
// 생성된 build.gradle 의 'versionCode 1' / 'versionName "1.0"' 줄만 치환한다.
// (android/ 를 커밋하지 않으므로 gradle 이 매니페스트를 직접 읽게 고치는 것보다 줄 치환이 단순하다)
//==============================================================================
/**
 * @param { string } logPrefix
 */
function applyVersion(logPrefix) {
	const projectManifest = JSON.parse(fileSystem.readFileSync(projectManifestPath, "utf8"));
	const playstoreManifest = projectManifest.playstore;
	const versionCode = Number.parseInt(playstoreManifest.versionCode, 10);
	const versionName = String(playstoreManifest.versionName);
	if (!Number.isInteger(versionCode) || versionCode <= 0) {
		throw new Error(`${logPrefix} project-manifest.json 의 playstore.versionCode 가 양의 정수가 아닙니다: ${playstoreManifest.versionCode}`);
	}
	const buildGradlePath = path.join(androidDirectory, "app", "build.gradle");
	const buildGradleText = fileSystem.readFileSync(buildGradlePath, "utf8");
	let patchedText = buildGradleText.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
	patchedText = patchedText.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
	if (patchedText !== buildGradleText) {
		fileSystem.writeFileSync(buildGradlePath, patchedText, "utf8");
	}
	console.log(`${logPrefix} 버전 반영: versionCode ${versionCode}, versionName "${versionName}"`);
}


//==============================================================================
// 서명 인자 반환. (keystore.properties 가 없으면 빈 배열 — 서명 없는 산출물)
//==============================================================================
/**
 * @param { string } logPrefix
 * @returns { string[] } gradle 에 그대로 붙일 -P 인자 목록.
 */
function readSigningArguments(logPrefix) {
	if (!fileSystem.existsSync(keystorePropertiesPath)) {
		return [];
	}
	const keystoreProperties = {};
	const propertyLines = fileSystem.readFileSync(keystorePropertiesPath, "utf8").split(/\r?\n/);
	for (const propertyLine of propertyLines) {
		const trimmedLine = propertyLine.trim();
		if (trimmedLine === "" || trimmedLine.startsWith("#")) {
			continue;
		}
		const separatorIndex = trimmedLine.indexOf("=");
		if (separatorIndex < 0) {
			continue;
		}
		const propertyKey = trimmedLine.slice(0, separatorIndex).trim();
		const propertyValue = trimmedLine.slice(separatorIndex + 1).trim();
		keystoreProperties[propertyKey] = propertyValue;
	}
	const requiredKeys = ["storeFile", "storePassword", "keyAlias", "keyPassword"];
	const missingKeys = requiredKeys.filter((requiredKey) => {
		return !keystoreProperties[requiredKey];
	});
	if (missingKeys.length > 0) {
		throw new Error(`${logPrefix} keystore.properties 에 다음 값이 없습니다: ${missingKeys.join(", ")}`);
	}
	const storeFilePath = path.resolve(platformRoot, keystoreProperties.storeFile);
	if (!fileSystem.existsSync(storeFilePath)) {
		throw new Error(`${logPrefix} 키스토어 파일이 없습니다: ${storeFilePath}`);
	}
	console.log(`${logPrefix} 업로드 키로 서명합니다: ${storeFilePath} (${keystoreProperties.keyAlias})`);
	return [
		`-Pandroid.injected.signing.store.file=${storeFilePath}`,
		`-Pandroid.injected.signing.store.password=${keystoreProperties.storePassword}`,
		`-Pandroid.injected.signing.key.alias=${keystoreProperties.keyAlias}`,
		`-Pandroid.injected.signing.key.password=${keystoreProperties.keyPassword}`,
	];
}


//==============================================================================
// 준비 전체. (실패하면 예외)
//==============================================================================
/**
 * @param { string } logPrefix
 */
function prepareAndroid(logPrefix) {
	stage(path.join(projectRoot, "build", "web"), path.join(platformRoot, "www"), null);
	ensureAndroidProject(logPrefix);
	runCapacitor(["cap", "sync", "android"], logPrefix);
	writeLocalProperties(logPrefix);
	writeGradleJavaHome(logPrefix);
	applyPortraitOrientation(logPrefix);
	applySdkVersion(logPrefix);
	applyVersion(logPrefix);
}


//==============================================================================
// gradle 실행. (실패하면 예외)
//==============================================================================
/**
 * @param { string[] } gradleArguments
 * @param { string } logPrefix
 */
function runGradle(gradleArguments, logPrefix) {
	// 절대 경로로 부른다. (NoDefaultCurrentDirectoryInExePath 가 켜진 셸은 현재 폴더의 gradlew.bat 을 찾지 않는다)
	const gradleScriptPath = path.join(androidDirectory, isWindows ? "gradlew.bat" : "gradlew");
	const gradleCommand = isWindows ? `"${gradleScriptPath}"` : gradleScriptPath;
	// 윈도우는 셸(cmd)을 거치므로 경로·비밀번호의 공백이나 특수문자가 갈라지지 않게 인자마다 따옴표로 감싼다.
	const quotedArguments = gradleArguments.map((gradleArgument) => {
		return isWindows ? `"${gradleArgument}"` : gradleArgument;
	});
	const gradleResult = spawnSync(gradleCommand, quotedArguments, {
		stdio: "inherit",
		cwd: androidDirectory,
		shell: isWindows,
	});
	if (gradleResult.status !== 0) {
		throw new Error(`${logPrefix} gradle ${gradleArguments[0]} 실패.`);
	}
}


module.exports = { prepareAndroid, readSigningArguments, runGradle, androidDirectory };


//==============================================================================
// CLI 진입점. (npm run sync)
//==============================================================================
if (require.main === module) {
	try {
		prepareAndroid("[prepareandroid]");
	}
	catch (error) {
		console.error(error.message);
		process.exit(1);
	}
}
