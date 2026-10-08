#!/usr/bin/env node
//==============================================================================
// 빌드 산출물 캐시 버스팅.
// build/web/index.html 의 css/js 참조에 ?v=<git 짧은 해시> 쿼리를 부여해
// 배포 후 브라우저가 이전 캐시 파일을 재사용하지 않게 한다.
// 이미 ?v= 쿼리가 붙어 있으면 새 해시로 갱신한다. (재실행 안전)
//
// 사용법:
//   node tools/cachebust.cjs
//==============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");


const projectRoot = path.resolve(__dirname, "..");
const indexPath = path.join(projectRoot, "build", "web", "index.html");


//==============================================================================
// 메인.
//==============================================================================
function main() {
	if (!fs.existsSync(indexPath)) {
		console.error(`[cachebust] index.html 이 없습니다: ${indexPath}`);
		process.exit(1);
	}

	const commitHash = execSync("git rev-parse --short HEAD", { cwd: projectRoot }).toString().trim();
	const originalText = fs.readFileSync(indexPath, "utf8");

	// 기존 ?v= 쿼리 제거 후 새 해시 부여.
	let substitutedText = originalText;
	substitutedText = substitutedText.replace(/\.css\?v=[0-9a-f]+/g, ".css");
	substitutedText = substitutedText.replace(/\.js\?v=[0-9a-f]+/g, ".js");
	substitutedText = substitutedText.split("./css/style.css").join(`./css/style.css?v=${commitHash}`);
	substitutedText = substitutedText.split("./js/bundle.min.js").join(`./js/bundle.min.js?v=${commitHash}`);

	fs.writeFileSync(indexPath, substitutedText, "utf8");
	console.log(`[cachebust] index.html 에 ?v=${commitHash} 적용 완료.`);
}


main();
