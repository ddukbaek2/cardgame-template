#!/usr/bin/env node
//==============================================================================
// 프로젝트 매니페스트 적용 래퍼.
// project-manifest.json 의 <platform> 섹션 값들을 대상 config 파일의
// <token> 플레이스홀더에 임시로 치환한 뒤, 지정된 명령을 실행한다.
// 실행 종료/중단 시 반드시 원본 config 파일을 복원한다.
//
// 사용법:
//   node tools/manifest.cjs <platform> <configFile> -- <command> [args...]
//
// 예시:
//   node tools/manifest.cjs appintoss platforms/appintoss/granite.config.ts -- npm run build --prefix platforms/appintoss
//==============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");


const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "project-manifest.json");


//==============================================================================
// 메인.
//==============================================================================
function main() {
	const args = process.argv.slice(2);
	const separatorIndex = args.indexOf("--");

	if (separatorIndex === -1 || separatorIndex < 2 || separatorIndex === args.length - 1) {
		console.error("사용법: node tools/manifest.cjs <platform> <configFile> -- <command> [args...]");
		process.exit(1);
	}

	const platform = args[0];
	const configRelative = args[1];
	const configFile = path.resolve(projectRoot, configRelative);
	const commandTokens = args.slice(separatorIndex + 1);

	if (!fs.existsSync(manifestPath)) {
		console.error(`[manifest] project-manifest.json 이 없습니다: ${manifestPath}`);
		process.exit(1);
	}
	if (!fs.existsSync(configFile)) {
		console.error(`[manifest] 대상 config 파일이 없습니다: ${configFile}`);
		process.exit(1);
	}

	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	const platformValues = manifest[platform];
	if (!platformValues || typeof platformValues !== "object") {
		console.error(`[manifest] project-manifest.json 에 '${platform}' 섹션이 없습니다.`);
		process.exit(1);
	}

	// 원본 저장.
	const originalText = fs.readFileSync(configFile, "utf8");

	// <token> 치환.
	let substitutedText = originalText;
	for (const key of Object.keys(platformValues)) {
		const token = `<${key}>`;
		const value = String(platformValues[key]);
		substitutedText = substitutedText.split(token).join(value);
	}

	// 치환 후에도 <...> 가 남아있으면 매니페스트가 덜 채워진 것.
	const remaining = substitutedText.match(/<[a-zA-Z][a-zA-Z0-9_]*>/g);
	if (remaining && remaining.length > 0) {
		const unique = Array.from(new Set(remaining));
		console.error(`[manifest] '${platform}' 매니페스트가 완전하지 않습니다. 다음 토큰이 치환되지 않았습니다:`);
		console.error(`  ${unique.join(", ")}`);
		console.error(`  project-manifest.json 의 '${platform}' 섹션을 확인하세요.`);
		process.exit(1);
	}

	// 치환된 내용을 config 에 기록.
	fs.writeFileSync(configFile, substitutedText, "utf8");
	console.log(`[manifest] ${configRelative} 에 '${platform}' 매니페스트 값을 적용했습니다.`);

	// 프로세스 종료/중단 시 원본 복원 보장.
	let restored = false;
	const restore = () => {
		if (restored) {
			return;
		}
		restored = true;
		try {
			fs.writeFileSync(configFile, originalText, "utf8");
			console.log(`[manifest] ${configRelative} 원본 복원 완료.`);
		}
		catch (error) {
			console.error(`[manifest] ${configRelative} 원본 복원 실패:`, error);
		}
	};
	process.on("exit", restore);
	process.on("SIGINT", () => { restore(); process.exit(130); });
	process.on("SIGTERM", () => { restore(); process.exit(143); });

	// 명령 실행.
	const [command, ...commandArgs] = commandTokens;
	const result = spawnSync(command, commandArgs, {
		stdio: "inherit",
		cwd: projectRoot,
		shell: true,
	});

	restore();
	process.exit(result.status === null ? 1 : result.status);
}


main();
