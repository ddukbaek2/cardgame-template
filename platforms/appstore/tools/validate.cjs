#!/usr/bin/env node
//==============================================================================
// capacitor.config.json 에 남아있는 <...> 플레이스홀더를 감지하여 빌드를 중단.
// 정상 경로는 루트의 `node tools/manifest.cjs ...` 래퍼가 매니페스트 값을
// 임시 치환한 후 이 스크립트를 호출하는 것이며, 이 시점에는 플레이스홀더가
// 모두 채워져 있어야 한다. 플랫폼 디렉토리에서 직접 빌드를 시도한 경우에만
// 이 에러가 발생한다.
//==============================================================================
"use strict";
const fileSystem = require("fs");
const path = require("path");

const platformRoot = path.resolve(__dirname, "..");
const configPath = path.join(platformRoot, "capacitor.config.json");

if (!fileSystem.existsSync(configPath)) {
	console.error(`[validate] capacitor.config.json 을 찾을 수 없습니다: ${configPath}`);
	process.exit(1);
}

const configText = fileSystem.readFileSync(configPath, "utf8");
const placeholderTokens = ["<appId>", "<appName>"];
const remainingTokens = placeholderTokens.filter((token) => {
	return configText.includes(token);
});

if (remainingTokens.length > 0) {
	console.error("[validate] capacitor.config.json 에 미설정 플레이스홀더가 남아있습니다.");
	console.error(`  파일: ${configPath}`);
	console.error(`  남은 토큰: ${remainingTokens.join(", ")}`);
	console.error("  다음 중 하나로 해결하세요:");
	console.error("    1) 루트에서 'npm run stage:appstore / sync:appstore / open:appstore' 실행 (권장)");
	console.error("       → project-manifest.json 의 appstore 섹션 값이 자동 적용됨");
	console.error("    2) project-manifest.json 의 appstore 섹션을 실제 값으로 채우기");
	process.exit(1);
}
