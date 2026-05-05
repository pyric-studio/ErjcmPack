// ===== 全局配置 =====
var ROW_HEIGHT = 23;                // 每行高度（像素，用于第二、三行）
var WAIT_THRESHOLD = 300000;        // 欢迎语阈值：5分钟（毫秒）
var HORIZONTAL_MARGIN = 15;         // 第一行左右边距（像素），可调
var WELCOME_MESSAGES = [            // 欢迎语列表，支持用 ; 分隔多行（每行会居中显示）
    "{车站名}欢迎您",
    "祝您旅途愉快",
    "安全出行 温馨相伴",
    "诚信友善 文明出行",
    "不忘初心 牢记使命;交通强国 铁路先行",   // 示例：两行标语
    "站台严禁;竖立高举杆状物品;骑行平衡车、滑板等"
];
var MAX_STATIC_CHARS = 16;  // 第三行静态显示时允许的最大字符数(含中英文)，超出则走马灯

// ===== 辅助函数：去除站名末尾的“站”字（仅用于第二行显示）=====
function removeTrailingStation(name) {
    // 防御：只处理合法字符串，否则原样返回安全值
    if (typeof name !== 'string' || name.length === 0) return name || "未知";
    if (name === "未知") return name;
    if (name.charAt(name.length - 1) === '站') {
        return name.substring(0, name.length - 1);
    }
    return name;
}

// ===== 安全的站名拆分函数（不使用正则，避免 Rhino 歧义）=====
function splitStationName(fullName) {
    if (!fullName || fullName === "") return "未知";
    fullName = String(fullName);   // 强制转为字符串（防御）
    var idx = fullName.indexOf('|');
    if (idx === -1) idx = fullName.indexOf('｜');
    if (idx !== -1) {
        var firstPart = fullName.substring(0, idx);
        return firstPart !== "" ? firstPart : "未知";
    }
    return fullName;
}

// ===== 获取始发站（已拆分，未去“站”）=====
function getOriginStation(arrival) {
    try {
        var route = arrival.route();
        if (route == null) return "未知";
        var platforms = route.getPlatforms();
        if (platforms == null || platforms.size() == 0) return "未知";
        var firstPlatform = platforms.get(0);
        var rawName = firstPlatform.getStationName() || "未知";
        return splitStationName(rawName);
    } catch (e) {
        print("获取始发站失败: " + e);
        return "未知";
    }
}

// ===== 格式化时间（现实时间）=====
function formatTime(timestamp) {
    if (!timestamp) return "--:--";
    var date = new Date(timestamp);
    var hours = date.getHours().toString().padStart(2, '0');
    var minutes = date.getMinutes().toString().padStart(2, '0');
    return hours + ":" + minutes;
}

// ===== 获取随机欢迎语（返回多行数组，自动替换 {车站名}）=====
function getRandomWelcome(stationName) {
    var shortStation = splitStationName(stationName);
    // 过滤掉包含 {车站名} 的模板（如果站名无效）
    var available = [];
    if (shortStation === "本站" || shortStation === "未知" || shortStation === "") {
        for (var i = 0; i < WELCOME_MESSAGES.length; i++) {
            if (WELCOME_MESSAGES[i].indexOf("{车站名}") === -1) {
                available.push(WELCOME_MESSAGES[i]);
            }
        }
        if (available.length === 0) available = ["祝您旅途愉快"];
    } else {
        available = WELCOME_MESSAGES.slice();
    }
    var randomIndex = Math.floor(Math.random() * available.length);
    var template = available[randomIndex];
    // 先按分号拆分多行
    var lines = template.split(';');
    var resultLines = [];
    for (var l = 0; l < lines.length; l++) {
        var line = lines[l];
        // 替换 {车站名}
        var parts = line.split("{车站名}");
        var replaced = "";
        for (var i = 0; i < parts.length; i++) {
            replaced += parts[i];
            if (i < parts.length - 1) replaced += shortStation;
        }
        resultLines.push(replaced);
    }
    return resultLines;  // 返回字符串数组
}

// ===== 处理自定义消息中的 {station}（完全不使用 split 和正则，手动查找替换）=====
function processCustomMessage(msg, pids) {
    if (!msg) return "";
    var station = pids.station();
    var stationName = station ? splitStationName(station.getName()) : "本站";
    var result = "";
    var lastIndex = 0;
    var searchStr = "{station}";
    var idx = msg.indexOf(searchStr);
    while (idx !== -1) {
        result += msg.substring(lastIndex, idx);
        result += stationName;
        lastIndex = idx + searchStr.length;
        idx = msg.indexOf(searchStr, lastIndex);
    }
    result += msg.substring(lastIndex);
    return result;
}

// ===== 主渲染函数 =====
function render(ctx, state, pids) {
    var screenWidth = pids.width;
    var screenHeight = pids.height;
    var rows = pids.rows;

    var stationObj = pids.station();
    var stationName = stationObj ? stationObj.getName() : "本站";

    var firstArrival = pids.arrivals().get(0);
    var hasTrain = (firstArrival != null);

    var waitTime = 0;
    if (hasTrain) {
        var arrivalTime = firstArrival.arrivalTime();
        if (arrivalTime) {
            waitTime = arrivalTime - Date.now();
        }
    }

    var shouldShowWelcome = (!hasTrain) || (hasTrain && waitTime > WAIT_THRESHOLD);

    if (shouldShowWelcome) {
        // 显示多行红色欢迎语（整体居中）
        var welcomeLines = state.welcomeLines;
        if (welcomeLines && welcomeLines.length > 0) {
            var lineSpacing = 20;           // 行间距（像素）
            var totalHeight = welcomeLines.length * lineSpacing;
            var startY = (screenHeight - totalHeight) / 2;
            for (var i = 0; i < welcomeLines.length; i++) {
                Text.create("Welcome line " + i)
                    .text(welcomeLines[i])
                    .color(0xFF0000)
                    .bold()
                    .centerAlign()
                    .pos(screenWidth / 2, startY + i * lineSpacing)
                    .scale(1.5)
                    .draw(ctx);
            }
        } else {
            // 兜底：单行欢迎语
            Text.create("fallback_welcome")
                .text("祝您旅途愉快！")
                .color(0xFF0000)
                .bold()
                .centerAlign()
                .pos(screenWidth / 2, screenHeight / 2)
                .draw(ctx);
        }
    } else {
        // 正常显示三行

        // --- 第一行：车次左对齐，时间右对齐 ---
        if (hasTrain) {
            var trainNumber = firstArrival.routeNumber() || "??";
            var depTime = firstArrival.departureTime() || firstArrival.arrivalTime();
            var timeStr = formatTime(depTime);
            var leftText = trainNumber + " 次";
            var rightText = timeStr + " 开";

            // 左对齐文本
            Text.create("First line left")
                .text(leftText)
                .color(0x00FF00)
                .leftAlign()
                .pos(HORIZONTAL_MARGIN, 5)
                .scale(1.5)
                .draw(ctx);
            // 右对齐文本
            Text.create("First line right")
                .text(rightText)
                .color(0x00FF00)
                .rightAlign()
                .pos(screenWidth - HORIZONTAL_MARGIN, 5)
                .scale(1.5)
                .draw(ctx);
        } else {
            // 正常情况下不会进入这里，因为 hasTrain=false 会走欢迎语分支
            Text.create("First line")
                .text("暂无列车信息")
                .color(0x666666)
                .centerAlign()
                .pos(screenWidth / 2, 5)
                .draw(ctx);
        }

        // --- 第二行：始发站 → 终点站（去掉末尾“站”字）---
        if (hasTrain) {
            var originRaw = getOriginStation(firstArrival);
            var destRaw = firstArrival.destination();
            var destRawSplit = destRaw ? splitStationName(destRaw) : "未知";
            var origin = removeTrailingStation(originRaw);
            var dest = removeTrailingStation(destRawSplit);
            var secondLineText = origin + "     -     " + dest;
            Text.create("Second line")
                .text(secondLineText)
                .color(0xFFFF00)
                .centerAlign()
                .pos(screenWidth / 2, ROW_HEIGHT)
                .scale(1.3)
                .draw(ctx);
        }

        // --- 第三行：自定义消息（智能判断走马灯）---
        if (rows >= 3) {
            var customMsg = pids.getCustomMessage(2);
            var thirdLineContent = "";
            if (customMsg && customMsg.trim() !== "") {
                thirdLineContent = processCustomMessage(customMsg, pids);
            } else {
                thirdLineContent = "欢迎使用本线路";
            }

            if (thirdLineContent.length <= MAX_STATIC_CHARS) {
                // 文字较短：居中静态显示
                Text.create("Third line")
                    .text(thirdLineContent)
                    .color(0xFFFF00)
                    .centerAlign()
                    .pos(screenWidth / 2, ROW_HEIGHT * 2)
                    .draw(ctx);
            } else {
                // 文字较长：左对齐 + 走马灯滚动
                Text.create("Third line marquee")
                    .text(thirdLineContent)
                    .color(0xFFFF00)
                    .leftAlign()
                    .pos(HORIZONTAL_MARGIN, ROW_HEIGHT * 2)
                    .size(screenWidth - HORIZONTAL_MARGIN * 2, ROW_HEIGHT)
                    .marquee()
                    .draw(ctx);
            }
        }
    }

    // 可选调试信息
    // ctx.setDebugInfo("Station", stationName);
    // ctx.setDebugInfo("WaitTime", (waitTime/1000).toFixed(0) + "s");
    // ctx.setDebugInfo("Rows", rows);
}

// ===== 生命周期函数 =====
function create(ctx, state, pids) {
    print("国铁站台PIDS已创建");
    var station = pids.station();
    var stationName = station ? station.getName() : "本站";
    // 随机选择欢迎语并存储为多行数组
    state.welcomeLines = getRandomWelcome(stationName);
    print("生成的欢迎语行数: " + state.welcomeLines.length);
    for (var i = 0; i < state.welcomeLines.length; i++) {
        print("  行" + i + ": " + state.welcomeLines[i]);
    }
}

function dispose(ctx, state, pids) {
    print("国铁站台PIDS已销毁");
}