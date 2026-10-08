#!/usr/bin/env node
//==============================================================================
// 그림 생성 도구. (제미나이 이미지 생성 API)
//
// assets/data/artwork.json 의 그림 목록을 읽어 제미나이로 그리고,
// 지정한 크기로 줄여 JPEG 로 저장한다. (카드 일러스트·배경 등 — 투명 배경이 필요 없는 그림)
// 원본(1024px PNG)은 tools/.artwork-raw/ 에 남겨 다시 줄이거나 비교할 때 쓴다. (커밋하지 않는다)
//
// artwork.json 형식.
//   {
//     "model": "gemini-3-pro-image",          // 생략하면 아래 DEFAULT_MODEL_NAME
//     "style": "모든 그림에 공통으로 붙는 화풍 설명",
//     "items": [
//       { "path": "assets/sprites/cards/hero1.jpg", "prompt": "그림 설명", "aspectRatio": "1:1", "width": 512, "height": 512 }
//     ]
//   }
//
// API 키는 .env 의 GOOGLE_GEMINI_V3_KEY 를 쓴다.
//
// 사용법.
//   node tools/generate-artwork.cjs                 — 아직 없는 그림만 생성.
//   node tools/generate-artwork.cjs --force         — 전부 다시 생성.
//   node tools/generate-artwork.cjs --only hero1,bg — 경로에 이 글자가 들어간 그림만 생성. (있어도 다시)
//   node tools/generate-artwork.cjs --resize        — 생성 없이 원본에서 다시 줄이기만.
//==============================================================================
"use strict";
const fileSystem = require("fs");
const path = require("path");
const sharp = require("sharp");


const projectRoot = path.resolve(__dirname, "..");
const artworkTablePath = path.join(projectRoot, "assets", "data", "artwork.json");
const rawDirectory = path.join(__dirname, ".artwork-raw");
const DEFAULT_MODEL_NAME = "gemini-3-pro-image";
const API_KEY_NAME = "GOOGLE_GEMINI_V3_KEY";
const JPEG_QUALITY = 86;
const PARALLEL_REQUEST_COUNT = 3;


//==============================================================================
// .env 파일에서 키 읽기. (KEY=VALUE 형식 — 따옴표는 벗겨 낸다)
//==============================================================================
function readEnvironmentKey(keyName) {
	const environmentValue = process.env[keyName];
	if (environmentValue !== undefined && environmentValue !== "") {
		return environmentValue;
	}
	const envFilePath = path.join(projectRoot, ".env");
	if (!fileSystem.existsSync(envFilePath)) {
		return "";
	}
	const envLines = fileSystem.readFileSync(envFilePath, "utf8").split(/\r?\n/);
	for (let index = 0; index < envLines.length; ++index) {
		const envLine = envLines[index].trim();
		if (envLine === "" || envLine.startsWith("#")) {
			continue;
		}
		const separatorIndex = envLine.indexOf("=");
		if (separatorIndex < 0) {
			continue;
		}
		const lineKeyName = envLine.slice(0, separatorIndex).trim();
		if (lineKeyName !== keyName) {
			continue;
		}
		let lineValue = envLine.slice(separatorIndex + 1).trim();
		if (lineValue.length >= 2 && lineValue.startsWith("\"") && lineValue.endsWith("\"")) {
			lineValue = lineValue.slice(1, -1);
		}
		return lineValue;
	}
	return "";
}


//==============================================================================
// 제미나이 호출. (프롬프트 → PNG 버퍼, 실패 시 예외)
//==============================================================================
async function requestImageGeneration(apiKey, modelName, promptText, aspectRatio) {
	const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
	const requestBody = {
		contents: [{ parts: [{ text: promptText }] }],
		generationConfig: {
			responseModalities: ["IMAGE"],
			imageConfig: { aspectRatio: aspectRatio },
		},
	};
	const maximumAttemptCount = 3;
	for (let attemptIndex = 0; attemptIndex < maximumAttemptCount; ++attemptIndex) {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
			body: JSON.stringify(requestBody),
		});
		if (response.status === 429 || response.status >= 500) {
			const waitSeconds = (attemptIndex + 1) * 10;
			console.log(`  응답 ${response.status} — ${waitSeconds}초 뒤 재시도`);
			await new Promise((resolve) => {
				setTimeout(resolve, waitSeconds * 1000);
			});
			continue;
		}
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`제미나이 응답 오류 ${response.status}: ${errorText.slice(0, 400)}`);
		}
		const responseData = await response.json();
		const candidates = responseData.candidates;
		if (candidates === undefined || candidates.length === 0) {
			throw new Error(`제미나이 응답에 후보가 없음: ${JSON.stringify(responseData).slice(0, 400)}`);
		}
		const responseParts = candidates[0].content.parts;
		for (let index = 0; index < responseParts.length; ++index) {
			const responsePart = responseParts[index];
			const inlineData = (responsePart.inlineData !== undefined) ? responsePart.inlineData : responsePart.inline_data;
			if (inlineData !== undefined && inlineData !== null) {
				return Buffer.from(inlineData.data, "base64");
			}
		}
		throw new Error(`제미나이 응답에 그림이 없음: ${JSON.stringify(responseParts).slice(0, 400)}`);
	}
	throw new Error("제미나이 재시도 횟수 초과");
}


//==============================================================================
// 원본을 줄여 저장. (가운데를 기준으로 비율을 맞춰 자른다)
//==============================================================================
async function writeResizedImage(rawImagePath, item) {
	const outputPath = path.join(projectRoot, item.path);
	fileSystem.mkdirSync(path.dirname(outputPath), { recursive: true });
	await sharp(rawImagePath)
		.resize(item.width, item.height, { fit: "cover", position: "centre" })
		.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
		.toFile(outputPath);
	const outputSize = fileSystem.statSync(outputPath).size;
	console.log(`  저장 ${item.path} (${item.width}x${item.height}, ${Math.round(outputSize / 1024)}KB)`);
}


//==============================================================================
// 원본 경로. (출력 경로를 평평한 파일 이름으로)
//==============================================================================
function getRawImagePath(item) {
	const flatName = item.path.replace(/[\\/]/g, "_").replace(/\.[a-z]+$/i, "") + ".png";
	return path.join(rawDirectory, flatName);
}


//==============================================================================
// 메인.
//==============================================================================
async function main() {
	const argumentList = process.argv.slice(2);
	const isForce = argumentList.includes("--force");
	const isResizeOnly = argumentList.includes("--resize");
	const onlyIndex = argumentList.indexOf("--only");
	const onlyKeywords = (onlyIndex >= 0 && argumentList[onlyIndex + 1] !== undefined) ? argumentList[onlyIndex + 1].split(",") : [];

	if (!fileSystem.existsSync(artworkTablePath)) {
		console.error(`[artwork] ${artworkTablePath} 가 없습니다.`);
		process.exit(1);
	}
	const artworkTable = JSON.parse(fileSystem.readFileSync(artworkTablePath, "utf8"));
	const modelName = (artworkTable.model !== undefined && artworkTable.model !== "") ? artworkTable.model : DEFAULT_MODEL_NAME;
	const style = (artworkTable.style !== undefined) ? artworkTable.style : "";
	const items = (artworkTable.items !== undefined) ? artworkTable.items : [];
	fileSystem.mkdirSync(rawDirectory, { recursive: true });

	const targetItems = items.filter((item) => {
		if (onlyKeywords.length > 0) {
			return onlyKeywords.some((keyword) => item.path.includes(keyword));
		}
		if (isForce || isResizeOnly) {
			return true;
		}
		const outputPath = path.join(projectRoot, item.path);
		return !fileSystem.existsSync(outputPath);
	});
	if (targetItems.length === 0) {
		console.log("[artwork] 만들 그림이 없습니다.");
		return;
	}

	if (isResizeOnly) {
		for (let index = 0; index < targetItems.length; ++index) {
			const item = targetItems[index];
			const rawImagePath = getRawImagePath(item);
			if (!fileSystem.existsSync(rawImagePath)) {
				console.log(`  원본 없음 — 건너뜀 ${item.path}`);
				continue;
			}
			await writeResizedImage(rawImagePath, item);
		}
		return;
	}

	const apiKey = readEnvironmentKey(API_KEY_NAME);
	if (apiKey === "") {
		console.error(`[artwork] .env 에 ${API_KEY_NAME} 가 없습니다.`);
		process.exit(1);
	}
	console.log(`[artwork] ${modelName} 로 ${targetItems.length}장 생성`);

	const failures = [];
	let nextIndex = 0;
	const runWorker = async () => {
		while (nextIndex < targetItems.length) {
			const item = targetItems[nextIndex];
			nextIndex += 1;
			const promptText = `${item.prompt}\n\n${style}`;
			try {
				console.log(`  생성 중 ${item.path}`);
				const imageBuffer = await requestImageGeneration(apiKey, modelName, promptText, item.aspectRatio);
				const rawImagePath = getRawImagePath(item);
				fileSystem.writeFileSync(rawImagePath, imageBuffer);
				await writeResizedImage(rawImagePath, item);
			}
			catch (error) {
				console.error(`  실패 ${item.path}: ${error.message}`);
				failures.push(item.path);
			}
		}
	};
	const workers = [];
	for (let workerIndex = 0; workerIndex < PARALLEL_REQUEST_COUNT; ++workerIndex) {
		workers.push(runWorker());
	}
	await Promise.all(workers);
	if (failures.length > 0) {
		console.error(`[artwork] 실패 ${failures.length}장: ${failures.join(", ")}`);
		process.exit(1);
	}
	console.log("[artwork] 완료");
}


main();
