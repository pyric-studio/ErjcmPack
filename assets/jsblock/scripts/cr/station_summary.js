// ============================================================
//  cr/station_summary.js - 国铁车站总览大屏 (JCM v2.0.0)
//  功能：汇总车站内所有站台的列车信息，按发车时间升序排列
//  开源项目：https://github.com/your-repo
// ============================================================

// ============================================================
//  【配置区】 - 可根据需要自由修改
// ============================================================

var CONFIG = {
    // ----- 颜色配置 -----
    backgroundColor: 0x1a1a3e,        // 背景色（深蓝紫色）
    primaryTextColor: 0xd0d0d0,       // 文字主色（浅灰色）
    headerBgColor: 0x0d0d2b,          // 表头背景色
    rowEvenColor: 0x1e1e4a,           // 偶数行背景色（斑马纹）
    rowOddColor: 0x2a2a5a,            // 奇数行背景色（斑马纹）
    bottomLeftColor: 0x00ff66,        // 左下角文字颜色（绿色）
    bottomRightColor: 0xff4444,       // 右下角文字颜色（红色）

    // ----- 功能开关 -----
    removeStationSuffix: true,        // 是否自动去掉站名末尾的"站"字

    // ----- 发车后保留时间（毫秒）-----
    departedRetentionMs: 120000,      // 默认 2 分钟，改为 0 则立即消失
};

// ============================================================
//  工具函数
// ============================================================

/** 拆分双语站名，只取中文部分（| 或 ｜ 分隔符之前） */
function parseStationName(name) {
    if (!name) return '';
    var parts = name.split(/[|｜]/);
    var chinese = parts[0].trim();
    if (CONFIG.removeStationSuffix && chinese.endsWith('站')) {
        chinese = chinese.slice(0, -1);
    }
    return chinese;
}

/** 获取始发站（通过 route 的第一个站台） */
function getOriginStation(arrival) {
    try {
        var route = arrival.route();
        if (!route) return '未知';
        var platforms = route.getPlatforms();
        if (!platforms || platforms.size() === 0) return '未知';
        var firstPlatform = platforms.get(0);
        var rawName = firstPlatform.getStationName() || '未知';
        return parseStationName(rawName);
    } catch (e) {
        print('获取始发站失败: ' + e);
        return '未知';
    }
}

/** 格式化当前时间为 yyyy/mm/dd hh:mm:ss */
function getFormattedTime() {
    var now = new Date();
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) +
        ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

/** 计算延误分钟数（向上取整） */
function getDelayMinutes(deviationMs) {
    if (deviationMs <= 0) return 0;
    return Math.ceil(deviationMs / 60000);
}

/** 判断是否已发车 */
function isDeparted(departureTimeMs, currentTimeMs) {
    return currentTimeMs > departureTimeMs;
}

/** 判断是否在发车后保留期内 */
function isWithinRetention(departureTimeMs, currentTimeMs) {
    return currentTimeMs <= departureTimeMs + CONFIG.departedRetentionMs;
}

/** 判断是否即将发车（不足1分钟） */
function isAboutToDepart(departureTimeMs, currentTimeMs) {
    return departureTimeMs - currentTimeMs <= 60000 && departureTimeMs > currentTimeMs;
}

// ============================================================
//  核心渲染函数
// ============================================================

function render(ctx, state, pids) {
    var currentTime = Date.now();

    // ----- 获取屏幕尺寸 (v2 API: pids.width / pids.height) -----
    var screenWidth = pids.width;      // v2: 直接属性[reference:2]
    var screenHeight = pids.height;    // v2: 直接属性[reference:3]

    // ----- 1. 绘制背景（使用 Texture 绘制纯色矩形）-----
    // v2 没有 Shape 对象，用 Texture 绘制背景
    // 注意：需要创建一个纯色纹理，或者用 Text 覆盖整个区域
    // 最简单的方式是用 Text 绘制一个巨大的色块（但 Text 不支持纯色填充）
    // 更可靠的方式：使用 Texture 引用一张纯色图片
    // 由于我们不能在脚本中创建动态纹理，这里使用 Text 配合空格 + 背景色无法实现
    // 改用 Texture 方式：需要先准备一张纯色纹理图片
    // 临时方案：用 Text 绘制背景色块（利用空格填充）
    // 更好的方案：在资源包中准备一张纯色图片
    
    // 由于 v2 没有直接绘制矩形的 API，我们使用 Texture 来绘制背景
    // 需要在资源包中准备一张纯色纹理，或者使用现有的纹理
    // 这里我们使用 Text 来模拟背景（通过大量空格）
    // 注意：这不是最优方案，但可以在没有额外纹理的情况下工作
    
    // 更干净的方式：使用 Texture 引用一张纯色图片
    // 假设资源包中有一张 1x1 的纯色图片
    // 这里我们使用 Text 方式绘制背景（利用空格）
    // 注意：Text 的 .size() 和 .stretchXY() 可以拉伸文本
    
    // 由于 Text 无法直接填充颜色背景，我们使用一个技巧：
    // 创建一个包含空格的长文本，然后拉伸它
    // 或者使用 Texture 方式
    // 这里我们采用 Texture 方式，需要一张纯色纹理
    
    // 由于没有现成的纯色纹理，我们用 Text 绘制一个背景
    // 使用一个空格字符，然后拉伸到全屏
    // 但 .stretchXY() 需要配合 .size() 使用
    Text.create('background')
        .text(' ')  // 单个空格
        .pos(0, 0)
        .size(screenWidth, screenHeight)
        .color(CONFIG.backgroundColor)
        .stretchXY()  // 拉伸以填充整个区域[reference:4]
        .draw(ctx);

    // ----- 2. 获取车站名称 (v2 API: pids.station()) -----
    var stationObj = pids.station();  // v2: 返回 Station 对象[reference:5]
    var stationName = stationObj ? stationObj.getName() : '本站';
    stationName = parseStationName(stationName);

    // ----- 3. 收集所有列车信息 (v2 API: pids.arrivals()) -----
    var arrivals = pids.arrivals();   // v2: 返回 ArrivalsWrapper[reference:6]
    var allTrains = [];

    if (arrivals) {
        // v2: 最多获取 10 条[reference:7]
        for (var i = 0; i < 10; i++) {
            var entry = arrivals.get(i);  // v2: get(i) 返回 ArrivalWrapper[reference:8]
            if (!entry) continue;

            var destination = entry.destination() || '';      // v2[reference:9]
            var departureTime = entry.departureTime();        // v2[reference:10]
            var deviationMs = entry.deviation() || 0;         // v2[reference:11]
            var isRealtime = entry.realtime();                // v2[reference:12]
            var isTerminating = entry.terminating();          // v2[reference:13]

            // 站台 (v2: 通过 platforms() 获取)
            var platform = '';
            var platforms = arrivals.platforms();             // v2[reference:14]
            if (platforms && i < platforms.length) {
                platform = platforms[i] || '';
            }

            // 车次 (v2: routeNumber())[reference:15]
            var routeNumber = entry.routeNumber() || '';

            // 始发站 (v2: 通过 route().getPlatforms())
            var originRaw = getOriginStation(entry);
            var origin = parseStationName(originRaw);

            // 判断状态
            var status = '';
            var statusColor = CONFIG.primaryTextColor;

            if (isTerminating) {
                status = '终到';
                statusColor = 0xffffff;
            } else if (isDeparted(departureTime, currentTime)) {
                if (isWithinRetention(departureTime, currentTime)) {
                    status = '已发车';
                    statusColor = 0x888888;
                } else {
                    continue; // 超出保留期，不显示
                }
            } else if (isAboutToDepart(departureTime, currentTime)) {
                status = '正在检票';
                statusColor = 0x00ff44;
            } else if (isRealtime) {
                var delayMin = getDelayMinutes(deviationMs);
                if (delayMin >= 1) {
                    status = '晚点' + delayMin + '分';
                    statusColor = 0xff8800;
                } else {
                    status = '正点';
                    statusColor = 0x00ff44;
                }
            } else {
                status = '计划';
                statusColor = 0x00ff44;
            }

            var parsedDest = parseStationName(destination);
            var parsedPlatform = parseStationName(platform);

            allTrains.push({
                routeNumber: routeNumber,
                origin: origin,
                destination: parsedDest,
                departureTime: departureTime,
                platform: parsedPlatform,
                status: status,
                statusColor: statusColor,
            });
        }
    }

    // ----- 4. 按发车时间升序排列 -----
    allTrains.sort(function(a, b) {
        return a.departureTime - b.departureTime;
    });

    // ----- 5. 表格布局参数 -----
    var headerHeight = 22;
    var rowHeight = 18;
    var paddingTop = 4;
    var paddingLeft = 6;
    var bottomInfoHeight = 24;

    var colRoute = 50;
    var colOrigin = 80;
    var colDest = 80;
    var colTime = 60;
    var colPlatform = 45;
    var colStatus = 55;

    // ----- 6. 绘制标题 (v2: Text.create().text().pos().color().scale().draw(ctx)) -----
    var titleY = 2;
    Text.create('title')
        .text('【' + stationName + '】列车时刻表')
        .pos(paddingLeft, titleY)
        .color(CONFIG.primaryTextColor)
        .scale(1.0)
        .draw(ctx);

    // ----- 7. 绘制表头背景 (使用 Text 模拟矩形) -----
    var headerY = headerHeight;
    // 表头背景：用空格拉伸
    Text.create('header_bg')
        .text(' ')
        .pos(0, headerY - 2)
        .size(screenWidth, rowHeight + 2)
        .color(CONFIG.headerBgColor)
        .stretchXY()
        .draw(ctx);

    // 表头文字
    var xPos = paddingLeft;
    Text.create('header_route')
        .text('车次')
        .pos(xPos, headerY)
        .color(CONFIG.primaryTextColor)
        .scale(0.8)
        .draw(ctx);
    xPos += colRoute;
    Text.create('header_origin')
        .text('始发站')
        .pos(xPos, headerY)
        .color(CONFIG.primaryTextColor)
        .scale(0.8)
        .draw(ctx);
    xPos += colOrigin;
    Text.create('header_dest')
        .text('终到站')
        .pos(xPos, headerY)
        .color(CONFIG.primaryTextColor)
        .scale(0.8)
        .draw(ctx);
    xPos += colDest;
    Text.create('header_time')
        .text('开点')
        .pos(xPos, headerY)
        .color(CONFIG.primaryTextColor)
        .scale(0.8)
        .draw(ctx);
    xPos += colTime;
    Text.create('header_platform')
        .text('站台')
        .pos(xPos, headerY)
        .color(CONFIG.primaryTextColor)
        .scale(0.8)
        .draw(ctx);
    xPos += colPlatform;
    Text.create('header_status')
        .text('状态')
        .pos(xPos, headerY)
        .color(CONFIG.primaryTextColor)
        .scale(0.8)
        .draw(ctx);

    // ----- 8. 绘制数据行（斑马纹）-----
    var maxRows = Math.floor((screenHeight - headerHeight - bottomInfoHeight - paddingTop) / rowHeight);
    var displayTrains = allTrains.slice(0, maxRows);

    for (var idx = 0; idx < displayTrains.length; idx++) {
        var train = displayTrains[idx];
        var rowY = headerHeight + rowHeight + idx * rowHeight;

        // 斑马纹背景 (使用 Text 模拟矩形)
        var bgColor = (idx % 2 === 0) ? CONFIG.rowEvenColor : CONFIG.rowOddColor;
        Text.create('row_bg_' + idx)
            .text(' ')
            .pos(0, rowY - 1)
            .size(screenWidth, rowHeight + 1)
            .color(bgColor)
            .stretchXY()
            .draw(ctx);

        var x = paddingLeft;

        // 车次
        var routeText = train.routeNumber || '--';
        if (routeText.length > 6) routeText = routeText.slice(0, 6);
        Text.create('row_' + idx + '_route')
            .text(routeText)
            .pos(x, rowY)
            .color(CONFIG.primaryTextColor)
            .scale(0.75)
            .draw(ctx);
        x += colRoute;

        // 始发站
        var originText = train.origin || '--';
        if (originText.length > 8) originText = originText.slice(0, 8);
        Text.create('row_' + idx + '_origin')
            .text(originText)
            .pos(x, rowY)
            .color(CONFIG.primaryTextColor)
            .scale(0.75)
            .draw(ctx);
        x += colOrigin;

        // 终到站
        var destText = train.destination || '--';
        if (destText.length > 8) destText = destText.slice(0, 8);
        Text.create('row_' + idx + '_dest')
            .text(destText)
            .pos(x, rowY)
            .color(CONFIG.primaryTextColor)
            .scale(0.75)
            .draw(ctx);
        x += colDest;

        // 开点 (HH:mm)
        var depDate = new Date(train.departureTime);
        var timeStr = String(depDate.getHours()).padStart(2, '0') + ':' +
                      String(depDate.getMinutes()).padStart(2, '0');
        Text.create('row_' + idx + '_time')
            .text(timeStr)
            .pos(x, rowY)
            .color(CONFIG.primaryTextColor)
            .scale(0.75)
            .draw(ctx);
        x += colTime;

        // 站台
        var platformText = train.platform || '--';
        if (platformText.length > 4) platformText = platformText.slice(0, 4);
        Text.create('row_' + idx + '_platform')
            .text(platformText)
            .pos(x, rowY)
            .color(CONFIG.primaryTextColor)
            .scale(0.75)
            .draw(ctx);
        x += colPlatform;

        // 状态（使用对应颜色）
        Text.create('row_' + idx + '_status')
            .text(train.status)
            .pos(x, rowY)
            .color(train.statusColor)
            .scale(0.75)
            .draw(ctx);
    }

    // ----- 9. 绘制底部信息栏 (分割线使用 Text 模拟) -----
    var bottomY = screenHeight - bottomInfoHeight + 2;

    // 分割线
    Text.create('divider')
        .text(' ')
        .pos(0, bottomY - 3)
        .size(screenWidth, 2)
        .color(0x444466)
        .stretchXY()
        .draw(ctx);

    // 左下：检票提示（绿色）
    Text.create('bottom_left')
        .text('开车前10分钟开始检票，开车前3分钟停止检票。')
        .pos(paddingLeft, bottomY)
        .color(CONFIG.bottomLeftColor)
        .scale(0.7)
        .draw(ctx);

    // 右下：当前时间（红色）
    var timeStr = getFormattedTime();
    var timeWidth = timeStr.length * 3;
    Text.create('bottom_right')
        .text(timeStr)
        .pos(screenWidth - paddingLeft - timeWidth, bottomY)
        .color(CONFIG.bottomRightColor)
        .scale(0.7)
        .draw(ctx);
}

// ============================================================
//  生命周期函数
// ============================================================

function create(ctx, state, pids) {
    // 初始化（无特殊需要）
}

function dispose(ctx, state, pids) {
    // 清理（无特殊需要）
}