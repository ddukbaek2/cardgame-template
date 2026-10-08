#!/usr/bin/env node
//==============================================================================
// 구글 플레이 제출용 AAB 빌드.
// 준비(stage → cap add/sync → 세로 고정·버전 패치) → gradle :app:bundleRelease 순차 실행.
//
// 사용법:
//   node tools/buildaab.cjs
//
// 결과물:
//   android/app/build/outputs/bundle/release/app-release.aab
//
// keystore.properties 가 없으면 서명 없는 AAB 가 나온다. (플레이 콘솔은 업로드 키로 서명된 AAB 만 받는다)
//==============================================================================
"use strict";
const path = require("path");
const { prepareAndroid, readSigningArguments, runGradle, androidDirectory } = require("./prepareandroid.cjs");

const logPrefix = "[buildaab]";

let exitCode = 0;
try {
	prepareAndroid(logPrefix);

	const signingArguments = readSigningArguments(logPrefix);
	if (signingArguments.length === 0) {
		console.warn(`${logPrefix} keystore.properties 가 없어 서명 없이 빌드합니다. (플레이 콘솔 제출 불가)`);
	}
	runGradle([":app:bundleRelease", ...signingArguments], logPrefix);

	const bundlePath = path.join(androidDirectory, "app", "build", "outputs", "bundle", "release", "app-release.aab");
	console.log(`${logPrefix} 완료: ${bundlePath}`);
}
catch (error) {
	exitCode = 1;
	console.error(error.message);
}

process.exit(exitCode);
