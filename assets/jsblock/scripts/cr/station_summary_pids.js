// ==================== 🎨 自定义配置区 ====================
var BG_COLOR = 0x1A1A2E;         // 仅作为参考，实际背景请用 PIDS 背景图片
var TEXT_COLOR = 0xE0E0E0;       // 主文字色
var HEADER_BG_COLOR = 0x2C2C3E;   // 仅参考
var ROW_ALT_BG_COLOR = 0x232334;  // 仅参考
var FONT = "mtr:mtr";            // 字体（Text.create 中可能不用）

var FOOTER_INFO_COLOR = 0x55FF55;
var FOOTER_TIME_COLOR = 0xFF5555;
var REMOVE_STATION_SUFFIX = true;
var KEEP_AFTER_DEPARTURE_MINUTES = 2;
// =======================================================

var STATUS_COLORS = {
    "on_time": 0x4CAF50,
    "delayed": 0xFF9800,
    "cancelled": 0xF44336,
    "departed": 0x888888,
    "default": TEXT_COLOR
};

function padZero(num) {
    return num < 10 ? "0" + num : "" + num;
}

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

// ---- 始发站获取（与 cr_platform_pids_1.js 保持一致）----
function getOriginStation(arrival) {
    try {
        var route = arrival.route();
        if (route == null) return "未知";
        var platforms = route.getPlatforms();
        if (platforms == null || platforms.size() === 0) return "未知";
        var firstPlatform = platforms.get(0);
        // 使用 getStationName() 方法（原脚本也这样用）
        var rawName = firstPlatform.getStationName() || "未知";
        return splitStationName(rawName);
    } catch (e) {
        print("[错误] getOriginStation: " + e);
        return "未知";
    }
}

function getDestinationStation(arrival) {
    try {
        var dest = arrival.destination();
        if (!dest) return "未知";
        if (typeof dest === 'object' && dest.getName) {
            return splitStationName(dest.getName());
        } else if (typeof dest === 'string') {
            return splitStationName(dest);
        } else {
            return "未知";
        }
    } catch (e) {
        print("[错误] getDestinationStation: " + e);
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

function formatTime(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    return padZero(hours) + ":" + padZero(minutes);
}

function getStatusText(arrival) {
    var now = Date.now();
    var departureTime = arrival.departureTime();
    var diffMinutes = Math.floor((departureTime - now) / 60000);

    if (departureTime < now) {
        var minutesAfter = Math.floor((now - departureTime) / 60000);
        if (minutesAfter <= KEEP_AFTER_DEPARTURE_MINUTES) {
            return { text: "已发车", color: STATUS_COLORS.departed };
        } else {
            return { text: "HIDDEN", color: STATUS_COLORS.departed };
        }
    }

    if (arrival.terminating()) {
        return { text: "终到", color: STATUS_COLORS.default };
    }

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

    return { text: "计划", color: STATUS_COLORS.on_time };
}

// ========== 生命周期 ==========
function create(ctx, state, pids) {
    print("[车站大屏] 创建，pids ID: " + (pids.id || "undefined"));
}

function render(ctx, state, pids) {
    try {
        print("[调试] render 开始，尺寸: " + pids.width + "x" + pids.height);

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

        // 收集所有列车
        var allArrivals = [];
        for (var i = 0; i < allPlatforms.size(); i++) {
            var platform = allPlatforms.get(i);
            var arrivalsWrapper = pids.arrivals(platform);
            if (arrivalsWrapper == null) continue;

            for (var j = 0; j < 10; j++) {
                var arrival = arrivalsWrapper.get(j);
                if (arrival == null) break;
                var status = getStatusText(arrival);
                if (status.text === "HIDDEN") continue;
                allArrivals.push({
                    arrival: arrival,
                    platform: platform,
                    status: status
                });
            }
        }

        allArrivals.sort(function(a, b) {
            return a.arrival.departureTime() - b.arrival.departureTime();
        });

        if (allArrivals.length === 0) {
            drawEmptyTable(ctx, pids);
        } else {
            drawStationSummary(ctx, pids, station, allArrivals);
        }

        drawFooter(ctx, pids);
    } catch (e) {
        print("[错误] render 异常: " + e);
        Text.create("error_msg")
            .text("渲染错误: " + e)
            .color(0xFF0000)
            .pos(10, 50)
            .draw(ctx);
    }
}

function dispose(ctx, state, pids) {
    print("[车站大屏] 已卸载");
}

// ---------- 绘制空表格 ----------
function drawEmptyTable(ctx, pids) {
    var columns = [
        { header: "车次", x: 10 },
        { header: "始发站", x: 100 },
        { header: "终到站", x: 210 },
        { header: "开点", x: 320 },
        { header: "站台", x: 410 },
        { header: "状态", x: 480 }
    ];
    var startY = 30;

    Text.create("empty_title")
        .text("车站大屏（无数据）")
        .color(TEXT_COLOR)
        .pos(10, 10)
        .draw(ctx);

    for (var i = 0; i < columns.length; i++) {
        var col = columns[i];
        Text.create("empty_header_" + i)
            .text(col.header)
            .color(TEXT_COLOR)
            .pos(col.x + 5, startY + 5)
            .draw(ctx);
    }
}

// ---------- 绘制数据表格 ----------
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
    Text.create("station_title")
        .text("车站：" + stationDisplay)
        .color(TEXT_COLOR)
        .pos(10, 10)
        .draw(ctx);

    // 绘制表头
    for (var i = 0; i < columns.length; i++) {
        var col = columns[i];
        Text.create("header_" + i)
            .text(col.header)
            .color(TEXT_COLOR)
            .pos(col.x + 5, startY + 5)
            .draw(ctx);
    }

    var maxRows = Math.min(arrivals.length, 10);
    for (var row = 0; row < maxRows; row++) {
        var data = arrivals[row];
        var arrival = data.arrival;
        var platform = data.platform;
        var status = data.status;
        var y = startY + headerHeight + row * rowHeight;

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
            var color = (c === 5) ? status.color : TEXT_COLOR; // 状态列用状态颜色，其他用普通颜色
            Text.create("cell_" + row + "_" + c)
                .text(text)
                .color(color)
                .pos(col.x + 5, y + 3)
                .draw(ctx);
        }
    }
}

// ---------- 底部信息 ----------
function drawFooter(ctx, pids) {
    var footerY = pids.height - 20;
    var padding = 10;

    var leftText = "开车前10分钟开始检票，开车前3分钟停止检票。";
    Text.create("footer_left")
        .text(leftText)
        .color(FOOTER_INFO_COLOR)
        .pos(padding, footerY)
        .draw(ctx);

    var now = new Date();
    var year = now.getFullYear();
    var month = padZero(now.getMonth() + 1);
    var day = padZero(now.getDate());
    var hours = padZero(now.getHours());
    var minutes = padZero(now.getMinutes());
    var seconds = padZero(now.getSeconds());
    var timeStr = year + "/" + month + "/" + day + " " + hours + ":" + minutes + ":" + seconds;

    var textWidth = timeStr.length * 8;
    var rightX = pids.width - textWidth - padding;

    Text.create("footer_right")
        .text(timeStr)
        .color(FOOTER_TIME_COLOR)
        .pos(rightX, footerY)
        .draw(ctx);
}