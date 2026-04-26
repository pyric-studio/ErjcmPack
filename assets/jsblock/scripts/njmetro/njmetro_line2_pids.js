// ---------- 全局配置 ----------
var LANG_SWITCH_INTERVAL = 15000;   // 15秒切换
var lastSwitchTime = Date.now();
var globalLang = 0;                 // 0: 中文, 1: 英文

// 配色常量 (南京地铁二号线风格)
var COLORS = {
    yellow: 0xFFD700,
    red: 0xFF0000,
    green: 0x32CD32
};

// 布局常量 (基于Minecraft世界坐标，可根据实际效果微调)
var ROW1_Y = 0.15;          // 第一行Y坐标
var ROW2_Y = 0.35;          // 第二行Y坐标
var ROW3_Y = 0.55;          // 第三行Y坐标
var LEFT_MARGIN = 0.08;     // 左侧起始X
var FONT_LARGE = 0.12;      // 前两行字体大小
var FONT_SMALL = 0.09;      // 第三行字体大小
var SPACING_WIDE = 0.25;    // "本次列车" 与 时间 之间的间距
var SPACING_NARROW = 0.05;  // 第三行各元素间距

// ---------- 安全的站名拆分函数 (支持 | 和 ｜) ----------
function splitStationName(fullName, lang) {
    if (!fullName || fullName === "") return "未知";
    var idx = fullName.indexOf('|');
    if (idx === -1) idx = fullName.indexOf('｜');
    if (idx !== -1) {
        // 前半部分为中文，后半部分为英文
        var parts = fullName.split(idx === -1 ? '｜' : '|');
        if (lang === 0) {
            return parts[0] !== "" ? parts[0] : "未知";
        } else {
            return parts.length > 1 ? parts[1] : parts[0]; // 无英文时回退中文
        }
    }
    return fullName; // 无竖线则原样返回
}

// ---------- 获取终到站名 (自动拆分) ----------
function getDestinationName(arrival, lang) {
    if (!arrival) return "";
    var destRaw = arrival.destination();
    return splitStationName(destRaw, lang);
}

// ---------- 获取始发站名 (用于下次列车信息，可选) ----------
function getOriginStationName(arrival, lang) {
    if (!arrival) return "";
    try {
        var route = arrival.route();
        if (route == null) return "";
        var platforms = route.getPlatforms();
        if (platforms == null || platforms.size() == 0) return "";
        var firstPlatform = platforms.get(0);
        var rawName = firstPlatform.getStationName() || "";
        return splitStationName(rawName, lang);
    } catch (e) {
        return "";
    }
}

// ---------- 格式化到达时间文本 ----------
function formatArrivalText(arrival, lang) {
    if (!arrival) return "--";
    var arrivalTime = arrival.arrivalTime();
    if (!arrivalTime) return "--";

    var diffMs = arrivalTime - Date.now();

    // 进站中 (10秒内)
    if (diffMs <= 10000) {
        return lang === 0 ? "列车进站" : "Arrive";
    }

    var minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) {
        return lang === 0 ? "1分钟内到" : "1 min";
    }

    if (lang === 0) {
        return minutes + "分钟到达";
    } else {
        return minutes + " min";
    }
}

// ---------- JCM核心函数: create ----------
function create(ctx, state, pids) {
    state.lang = 0; // 独立语言状态，与全局同步
    state.lastSwitch = Date.now();
}

// ---------- JCM核心函数: render ----------
function render(ctx, state, pids) {
    var now = Date.now();

    // 1. 全局语言切换 (15秒周期)
    if (now - lastSwitchTime > LANG_SWITCH_INTERVAL) {
        globalLang = 1 - globalLang;
        lastSwitchTime = now;
    }
    var lang = globalLang;
    state.lang = lang;

    // 2. 获取列车到达数据
    var arrivals = pids.arrivals();
    var firstTrain = arrivals.size() > 0 ? arrivals.get(0) : null;
    var secondTrain = arrivals.size() > 1 ? arrivals.get(1) : null;

    var screenWidth = pids.width;
    var screenHeight = pids.height;

    // 3. 第一行："本次列车" + 到达状态
    var firstLineLeft = lang === 0 ? "本次列车" : "Arrival";
    var firstLineRight = formatArrivalText(firstTrain, lang);
    drawText(ctx, firstLineLeft, LEFT_MARGIN, ROW1_Y, FONT_LARGE, COLORS.yellow, 'left');
    drawText(ctx, firstLineRight, LEFT_MARGIN + SPACING_WIDE, ROW1_Y, FONT_LARGE, COLORS.red, 'left');

    // 4. 第二行："开往" + 终到站 (注意对齐："往" 与第一行 "车" 对齐)
    if (firstTrain) {
        var destPrefix = lang === 0 ? "开往" : "Dest.";
        var destName = getDestinationName(firstTrain, lang);
        // 对齐：第一行中 "车" 位于 "本次列车" 的第三个字符（索引2），
        // 这里通过调整 "开往" 的绘制位置来模拟对齐。简单做法是让 "开往" 与 "本次列车" 左对齐，
        // 然后通过空格微调。更精确的方式是计算字符宽度，此处采用偏移量近似。
        var prefixX = LEFT_MARGIN;  // 与第一行左对齐
        var destX = LEFT_MARGIN + SPACING_WIDE;
        drawText(ctx, destPrefix, prefixX, ROW2_Y, FONT_LARGE, COLORS.yellow, 'left');
        drawText(ctx, destName, destX, ROW2_Y, FONT_LARGE, COLORS.red, 'left');
    }

    // 5. 第三行："下次列车" + 到达时间 + "开往" + 终到站
    if (secondTrain) {
        var nextPrefix = lang === 0 ? "下次列车" : "Next";
        var nextTime = formatArrivalText(secondTrain, lang);
        var nextDestPrefix = lang === 0 ? "开往" : "Dest.";
        var nextDestName = getDestinationName(secondTrain, lang);

        // 计算第三行各段的位置
        var col1X = LEFT_MARGIN;
        var col2X = col1X + 0.25;
        var col3X = col2X + 0.20;
        var col4X = col3X + 0.12;

        drawText(ctx, nextPrefix, col1X, ROW3_Y, FONT_SMALL, COLORS.green, 'left');
        drawText(ctx, nextTime, col2X, ROW3_Y, FONT_SMALL, COLORS.red, 'left');
        drawText(ctx, nextDestPrefix, col3X, ROW3_Y, FONT_SMALL, COLORS.yellow, 'left');
        drawText(ctx, nextDestName, col4X, ROW3_Y, FONT_SMALL, COLORS.red, 'left');
    } else {
        // 无下次列车时可显示占位符或留空
    }
}

// ---------- 辅助函数：绘制文本 (封装JCM Text API) ----------
function drawText(ctx, text, x, y, size, color, align) {
    var textObj = Text.create()
        .text(text)
        .pos(x, y)
        .size(size, size)
        .color(color)
        .font("mtr:mtr")
        .shadowed();

    if (align === 'center') {
        textObj.centerAlign();
    } else if (align === 'right') {
        textObj.rightAlign();
    } else {
        textObj.leftAlign();
    }

    textObj.draw(ctx);
}

// ---------- JCM核心函数: dispose ----------
function dispose(ctx, state, pids) {
    // 无需清理资源
}