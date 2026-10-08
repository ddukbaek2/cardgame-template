#!/usr/bin/env node
//==============================================================================
// NAS 웹 배포.
// build/web 에 version.json(푸시된 커밋 해시 + 날짜)을 쓰고 NAS 배포 폴더와 미러링한다.
//
// 배포 구조. (NAS 웹 루트 = \\DS216PLUSII\web\ddukbaek2)
//   dev  → \\DS216PLUSII\web\ddukbaek2\dev\<프로젝트>  → https://dev.ddukbaek2.com/<프로젝트>/
//   test → \\DS216PLUSII\web\ddukbaek2\test\<프로젝트> → https://test.ddukbaek2.com/<프로젝트>/
//   <프로젝트> = package.json 의 name.
//   live 는 앱스토어·플레이스토어 빌드용 브랜치라 웹 배포 대상이 아니다.
//
// 미러링은 바뀐 파일만 교체한다. 배포 폴더를 통째로 비운 뒤 다시 복사하면
// SMB 삭제 중 서버측 잠금으로 폴더가 접근 불가가 된 사고가 있었다. (파이프매니아, 2026-07-27)
//
// 사용법:
//   npm run build && node tools/deploy.cjs dev
//==============================================================================
"use strict";
const fileSystem = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");


const projectRoot = path.resolve(__dirname, "..");
const buildDirectory = path.join(projectRoot, "build", "web");
const NAS_WINDOWS_ROOT = "\\\\DS216PLUSII\\web\\ddukbaek2";
const NAS_MACOS_ROOT = "/Volumes/web/ddukbaek2";
const DEPLOY_STAGES = ["dev", "test"];


//==============================================================================
// 메인.
//==============================================================================
function main() {
	const stage = process.argv[2];
	if (!DEPLOY_STAGES.includes(stage)) {
		console.error(`사용법: node tools/deploy.cjs <${DEPLOY_STAGES.join("|")}>`);
		process.exit(1);
	}
	const indexPath = path.join(buildDirectory, "index.html");
	if (!fileSystem.existsSync(indexPath)) {
		console.error(`[deploy] ${indexPath} 가 없습니다. 먼저 npm run build 를 실행하세요.`);
		process.exit(1);
	}

	// 버전 표기. (게임 타이틀 오른쪽 아래에 보인다 — 실행 중인 번들이 최신인지 확인하는 지표)
	const commitHash = execSync("git log -1 --format=%h", { cwd: projectRoot }).toString().trim();
	const commitDate = execSync("git log -1 --format=%cd --date=format:\"%Y-%m-%d %H:%M\"", { cwd: projectRoot }).toString().trim();
	const versionText = JSON.stringify({ hash: commitHash, date: commitDate });
	fileSystem.writeFileSync(path.join(buildDirectory, "version.json"), versionText + "\n", "utf8");
	console.log(`[deploy] version.json ${versionText}`);

	const packageText = fileSystem.readFileSync(path.join(projectRoot, "package.json"), "utf8");
	const projectName = JSON.parse(packageText).name;

	if (process.platform === "win32") {
		const destination = `${NAS_WINDOWS_ROOT}\\${stage}\\${projectName}`;
		console.log(`[deploy] ${buildDirectory} → ${destination}`);
		const result = spawnSync("robocopy", [buildDirectory, destination, "/MIR", "/R:3", "/W:2", "/NP", "/NDL", "/NFL"], { stdio: "inherit" });
		// robocopy 종료 코드 0~7 = 정상, 8 이상 = 실패.
		if (result.status === null || result.status >= 8) {
			console.error(`[deploy] robocopy 실패 (종료 코드 ${result.status})`);
			process.exit(1);
		}
	}
	else {
		const destination = `${NAS_MACOS_ROOT}/${stage}/${projectName}`;
		console.log(`[deploy] ${buildDirectory} → ${destination}`);
		fileSystem.mkdirSync(destination, { recursive: true });
		const result = spawnSync("rsync", ["-a", "--delete", `${buildDirectory}/`, `${destination}/`], { stdio: "inherit" });
		if (result.status !== 0) {
			console.error(`[deploy] rsync 실패 (종료 코드 ${result.status}) — NAS 가 마운트됐는지 확인하세요. (Finder ⌘K → smb://DS216PLUSII/web)`);
			process.exit(1);
		}
	}
	console.log(`[deploy] 완료 → https://${stage}.ddukbaek2.com/${projectName}/`);
}


main();
