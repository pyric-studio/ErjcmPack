// ==================== 🎨 自定义配置区 ====================
var BG_COLOR = 0x1A1A2E;         // 背景色
var TEXT_COLOR = 0xE0E0E0;       // 主文字色
var HEADER_BG_COLOR = 0x2C2C3E;   // 表头背景色
var ROW_ALT_BG_COLOR = 0x232334;  // 交替行背景色
var FONT = "mtr:mtr";            // 字体

// 底部信息栏颜色
var FOOTER_INFO_COLOR = 0x55FF55; // 左下检票提示：绿色
var FOOTER_TIME_COLOR = 0xFF5555; // 右下时间：红色

// 名称处理开关
var REMOVE_STATION_SUFFIX = true; // 是否自动去除末尾的"站"字

// 显示过滤：发车后多少分钟内仍保留在列表中（0 = 发车后立即移除）
var KEEP_AFTER_DEPARTURE_MINUTES = 2;
// =======================================================

var STATUS_COLORS = {
    "on_time": 0x4CAF50,
    "delayed": 0xFF9800,
    "cancelled": 0xF44336,
    "departed": 0x888888,
    "default": TEXT_COLOR
};

// ========== 站名处理函数 ==========
function splitStationName(fullName) {
    if (!fullName || fullName === "") return "未知";
    var idx = fullName.indexOf('|');
    if (idx === -1) idx = fullName.indexOf('｜');
    var namePart = fullName;
    if (idx !== -1) {
        namePart = fullName.substring(0, idx);
        if (namePart === "") namePart = "未知";
    }
    if (REMOVE_STATION_SUFFIX && namePart.endsWith("站")) {
        namePart = namePart.substring(0, namePart.length - 1);
    }
    return namePart;
}

function getOriginStation(arrival) {
    try {
        var route = arrival.route();
        if (route == null) return "未知";
        var platforms = route.getPlatforms();
        if (platforms == null || platforms.size() === 0) return "未知";
        var firstPlatform = platforms.get(0);
        var rawName = firstPlatform.getStationName() || "未知";
        return splitStationName(rawName);
    } catch (e) {
        return "未知";
    }
}

function getDestinationStation(arrival) {
    try {
        var destRaw = arrival.destination();
        if (!destRaw) return "未知";
        return splitStationName(destRaw);
    } catch (e) {
        return "未知";
    }
}

function getStationDisplayName(station) {
    if (!station) return "本站";
    return splitStationName(station.getName());
}

function getPlatformDisplayName(platform) {
    if (!platform) return "?";
    var rawName = platform.getName();
    if (REMOVE_STATION_SUFFIX && rawName.endsWith("站")) {
        return rawName.substring(0, rawName.length - 1);
    }
    return rawName;
}

// ========== 格式化时间 ==========
function formatTime(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    if (hours < 10) hours = "0" + hours;
    if (minutes < 10) minutes = "0" + minutes;
    return hours + ":" + minutes;
}

// ========== 获取状态文本（增强版） ==========
function getStatusText(arrival) {
    var now = Date.now();
    var departureTime = arrival.departureTime();
    var diffMinutes = Math.floor((departureTime - now) / 60000);

    // 已发车检查（发车时间已过）
    if (departureTime < now) {
        var minutesAfter = Math.floor((now - departureTime) / 60000);
        if (minutesAfter <= KEEP_AFTER_DEPARTURE_MINUTES) {
            return { text: "已发车", color: STATUS_COLORS.departed };
        } else {
            // 超出保留时间，应被过滤，此处返回特殊标记
            return { text: "HIDDEN", color: STATUS_COLORS.departed };
        }
    }

    // 终到列车（本站为终点站）
    if (arrival.terminating()) {
        return { text: "终到", color: STATUS_COLORS.default };
    }

    // 实时列车
    if (arrival.realtime()) {
        var deviation = arrival.deviation();
        if (deviation > 60000) {
            var delayMinutes = Math.floor(deviation / 60000);
            return { text: "晚点" + delayMinutes + "分", color: STATUS_COLORS.delayed };
        }
        if (diffMinutes <= 1) {
            return { text: "正在检票", color: STATUS_COLORS.on_time };
        }
        return { text: "正点", color: STATUS_COLORS.on_time };
    }

    // 计划列车（尚未发车）
    return { text: "计划", color: STATUS_COLORS.on_time };
}

// ========== 生命周期 ==========
function create(ctx, state, pids) {
    print("[车站大屏] PIDS 已加载");
}

function render(ctx, state, pids) {
    ctx.drawRectangle(0, 0, pids.width, pids.height).color(BG_COLOR).draw(ctx);

    var station = pids.station();
    if (station == null) {
        drawEmptyTable(ctx, pids);
        drawFooter(ctx, pids);
        return;
    }

    var allPlatforms = station.getPlatforms();
    if (allPlatforms == null || allPlatforms.isEmpty()) {
        drawEmptyTable(ctx, pids);
        drawFooter(ctx, pids);
        return;
    }

    // ========== 收集所有列车（包括实时与计划） ==========
    var allArrivals = [];
    for (var i = 0; i < allPlatforms.size(); i++) {
        var platform = allPlatforms.get(i);
        var arrivalsWrapper = pids.arrivals(platform);
        if (arrivalsWrapper == null) continue;

        for (var j = 0; j < 10; j++) {
            var arrival = arrivalsWrapper.get(j);
            if (arrival == null) break;

            // 检查是否应该被过滤（已发车超过保留时间）
            var status = getStatusText(arrival);
            if (status.text === "HIDDEN") continue;

            allArrivals.push({
                arrival: arrival,
                platform: platform,
                status: status
            });
        }
    }

    // 按发车时间排序
    allArrivals.sort(function(a, b) {
        return a.arrival.departureTime() - b.arrival.departureTime();
    });

    if (allArrivals.length === 0) {
        drawEmptyTable(ctx, pids);
    } else {
        drawStationSummary(ctx, pids, station, allArrivals);
    }

    drawFooter(ctx, pids);
}

function dispose(ctx, state, pids) {
    print("[车站大屏] PIDS 已卸载");
}

// ========== 底部信息栏 ==========
function drawFooter(ctx, pids) {
    var footerY = pids.height - 20;
    var padding = 10;

    var leftText = "开车前10分钟开始检票，开车前3分钟停止检票。";
    ctx.drawText(leftText, padding, footerY)
       .font(FONT)
       .color(FOOTER_INFO_COLOR)
       .draw(ctx);

    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    var timeStr = year + "/" + month + "/" + day + " " + hours + ":" + minutes + ":" + seconds;

    var textWidth = timeStr.length * 8;
    var rightX = pids.width - textWidth - padding;

    ctx.drawText(timeStr, rightX, footerY)
       .font(FONT)
       .color(FOOTER_TIME_COLOR)
       .draw(ctx);
}

// ========== 绘制空表格（仅标题和表头） ==========
function drawEmptyTable(ctx, pids) {
    var columns = [
        { header: "车次", width: 80, x: 10 },
        { header: "始发站", width: 100, x: 100 },
        { header: "终到站", width: 100, x: 210 },
        { header: "开点", width: 80, x: 320 },
        { header: "站台", width: 60, x: 410 },
        { header: "状态", width: 80, x: 480 }
    ];

    var headerHeight = 25;
    var startY = 30;

    // 绘制标题
    ctx.drawText("车站大屏", 10, 10).font(FONT).color(TEXT_COLOR).draw(ctx);

    // 绘制表头
    for (var i = 0; i < columns.length; i++) {
        var col = columns[i];
        ctx.drawRectangle(col.x, startY, col.width, headerHeight).color(HEADER_BG_COLOR).draw(ctx);
        ctx.drawText(col.header, col.x + 5, startY + 5).font(FONT).color(TEXT_COLOR).draw(ctx);
    }
}

// ========== 绘制数据 ==========
function drawStationSummary(ctx, pids, station, arrivals) {
    var columns = [
        { header: "车次", width: 80, x: 10 },
        { header: "始发站", width: 100, x: 100 },
        { header: "终到站", width: 100, x: 210 },
        { header: "开点", width: 80, x: 320 },
        { header: "站台", width: 60, x: 410 },
        { header: "状态", width: 80, x: 480 }
    ];

    var rowHeight = 20;
    var headerHeight = 25;
    var startY = 30;

    var stationDisplay = getStationDisplayName(station);
    ctx.drawText("车站：" + stationDisplay, 10, 10).font(FONT).color(TEXT_COLOR).draw(ctx);

    for (var i = 0; i < columns.length; i++) {
        var col = columns[i];
        ctx.drawRectangle(col.x, startY, col.width, headerHeight).color(HEADER_BG_COLOR).draw(ctx);
        ctx.drawText(col.header, col.x + 5, startY + 5).font(FONT).color(TEXT_COLOR).draw(ctx);
    }

    var maxRows = Math.min(arrivals.length, 10);
    for (var row = 0; row < maxRows; row++) {
        var data = arrivals[row];
        var arrival = data.arrival;
        var platform = data.platform;
        var status = data.status;
        var y = startY + headerHeight + row * rowHeight;

        if (row % 2 === 1) {
            ctx.drawRectangle(columns[0].x, y, 570, rowHeight).color(ROW_ALT_BG_COLOR).draw(ctx);
        }

        var routeNumber = arrival.routeNumber();
        if (routeNumber == null || routeNumber === "") routeNumber = arrival.routeName();

        var originStation = getOriginStation(arrival);
        var destStation = getDestinationStation(arrival);
        var departureTime = new Date(arrival.departureTime());
        var timeStr = formatTime(departureTime);
        var platformName = getPlatformDisplayName(platform);

        var rowData = [routeNumber, originStation, destStation, timeStr, platformName, status.text];
        for (var c = 0; c < columns.length; c++) {
            var col = columns[c];
            var text = rowData[c] || "";
            if (text.length > 12) text = text.substring(0, 10) + "..";
            ctx.drawText(text, col.x + 5, y + 3).font(FONT).color(status.color || TEXT_COLOR).draw(ctx);
        }
    }
}