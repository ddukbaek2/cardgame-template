#!/usr/bin/env node
//==============================================================================
// 테스트 설치용 APK 빌드.
// 준비(stage → cap add/sync → 세로 고정·버전 패치) → gradle 순차 실행.
//
// 사용법:
//   node tools/buildapk.cjs
//
// 결과물:
//   keystore.properties 있음 — android/app/build/outputs/apk/release/app-release.apk (업로드 키 서명)
//   keystore.properties 없음 — android/app/build/outputs/apk/debug/app-debug.apk (디버그 키 서명)
//
// 서명 없는 릴리스 APK 는 기기에 설치되지 않으므로, 키가 없으면 디버그 빌드로 대신한다.
//==============================================================================
"use strict";
const path = require("path");
const { prepareAndroid, readSigningArguments, runGradle, androidDirectory } = require("./prepareandroid.cjs");

const logPrefix = "[buildapk]";

let exitCode = 0;
try {
	prepareAndroid(logPrefix);

	const signingArguments = readSigningArguments(logPrefix);
	const apkOutputDirectory = path.join(androidDirectory, "app", "build", "outputs", "apk");
	if (signingArguments.length > 0) {
		runGradle([":app:assembleRelease", ...signingArguments], logPrefix);
		const releaseApkPath = path.join(apkOutputDirectory, "release", "app-release.apk");
		console.log(`${logPrefix} 완료: ${releaseApkPath}`);
	}
	else {
		console.warn(`${logPrefix} keystore.properties 가 없어 디버그 키로 서명한 APK 를 만듭니다.`);
		runGradle([":app:assembleDebug"], logPrefix);
		const debugApkPath = path.join(apkOutputDirectory, "debug", "app-debug.apk");
		console.log(`${logPrefix} 완료: ${debugApkPath}`);
	}
}
catch (error) {
	exitCode = 1;
	console.error(error.message);
}

process.exit(exitCode);
