// ===== 全局配置 =====
var ROW_HEIGHT = 23;                // 每行高度（像素）
var WAIT_THRESHOLD = 300000;        // 欢迎语阈值：5分钟（毫秒）
var WELCOME_MESSAGES = [            // 欢迎语列表（{车站名} 会被替换）
    "{车站名}欢迎您",
    "祝您旅途愉快",
    "安全出行 温馨相伴",
    "诚信友善 文明出行"
];

// ===== 安全的站名拆分函数（不使用正则，避免 Rhino 歧义）=====
function splitStationName(fullName) {
    if (!fullName || fullName === "") return "未知";
    // 查找半角竖线
    var idx = fullName.indexOf('|');
    // 若未找到，查找全角竖线
    if (idx === -1) idx = fullName.indexOf('｜');
    if (idx !== -1) {
        var firstPart = fullName.substring(0, idx);
        return firstPart !== "" ? firstPart : "未知";
    }
    return fullName;
}

// ===== 获取始发站（已拆分）=====
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

// ===== 获取随机欢迎语（自动替换 {车站名}，不使用正则）=====
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
        available = WELCOME_MESSAGES.slice(); // 复制全部
    }
    var randomIndex = Math.floor(Math.random() * available.length);
    var template = available[randomIndex];
    // 手动替换 {车站名}（不使用正则）
    var result = "";
    var parts = template.split("{车站名}");
    for (var i = 0; i < parts.length; i++) {
        result += parts[i];
        if (i < parts.length - 1) result += shortStation;
    }
    return result;
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
    var rows = pids.rows;   // PIDS 支持的实际行数

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

    // 判断是否显示欢迎语：无列车 或 等待时间超过阈值
    var shouldShowWelcome = (!hasTrain) || (hasTrain && waitTime > WAIT_THRESHOLD);

    if (shouldShowWelcome) {
        // 显示红色欢迎语（第二行位置）
        var yPos = (rows >= 2) ? ROW_HEIGHT : screenHeight / 2;
        Text.create("Welcome message")
            .text(state.welcomeText)
            .color(0xFF0000)
            .bold()
            .centerAlign()
            .pos(screenWidth / 2, yPos)
            .scale(1.5)
            .draw(ctx);
    } else {
        // 正常显示三行

        // --- 第一行：车次和开点 ---
        if (hasTrain) {
            var trainNumber = firstArrival.routeNumber() || "??";
            var depTime = firstArrival.departureTime() || firstArrival.arrivalTime();
            var timeStr = formatTime(depTime);
            var firstLineText = trainNumber + " 次    " + timeStr + " 开";
            Text.create("First line")
                .text(firstLineText)
                .color(0x00FF00)
                .centerAlign()
                .pos(screenWidth / 2, 5)
                .scale(1.5)
                .draw(ctx);
        } else {
            Text.create("First line")
                .text("暂无列车信息")
                .color(0x666666)
                .centerAlign()
                .pos(screenWidth / 2, 5)
                .draw(ctx);
        }

        // --- 第二行：始发站 → 终点站（均拆分后中文）---
        if (hasTrain) {
            var origin = getOriginStation(firstArrival);          // 已拆分
            var destRaw = firstArrival.destination();
            var dest = destRaw ? splitStationName(destRaw) : "未知";
            var secondLineText = origin + "  -  " + dest;
            Text.create("Second line")
                .text(secondLineText)
                .color(0xFFFF00)
                .centerAlign()
                .pos(screenWidth / 2, ROW_HEIGHT)
                .scale(1.3)
                .draw(ctx);
        }

        // --- 第三行：自定义消息（仅当 PIDS 支持至少 3 行时绘制）---
        if (rows >= 3) {
            var customMsg = pids.getCustomMessage(2);
            var thirdLineContent = "";
            if (customMsg && customMsg.trim() !== "") {
                thirdLineContent = processCustomMessage(customMsg, pids);
            } else {
                thirdLineContent = "欢迎使用本线路";
            }
            Text.create("Third line")
                .text(thirdLineContent)
                .color(0xFFFF00)
                .centerAlign()
                .pos(screenWidth / 2, ROW_HEIGHT * 2)
                .size(screenWidth - 20, ROW_HEIGHT)
                .marquee()
                .draw(ctx);
        }
    }

    // 可选调试信息（需在 JCM 设置中启用 Script Debug Overlay）
    // ctx.setDebugInfo("Station", stationName);
    // ctx.setDebugInfo("WaitTime", (waitTime/1000).toFixed(0) + "s");
    // ctx.setDebugInfo("Rows", rows);
}

// ===== 生命周期函数 =====
function create(ctx, state, pids) {
    print("国铁站台PIDS已创建");
    var station = pids.station();
    var stationName = station ? station.getName() : "本站";
    state.welcomeText = getRandomWelcome(stationName);
    print("生成的欢迎语: " + state.welcomeText);
}

function dispose(ctx, state, pids) {
    print("国铁站台PIDS已销毁");
}