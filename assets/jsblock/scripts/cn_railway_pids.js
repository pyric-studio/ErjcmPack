// ===== 全局配置 =====
var ROW_HEIGHT = 20;                // 每行高度（像素），用于垂直定位
var WAIT_THRESHOLD = 300000;         // 欢迎语阈值：5分钟（300000毫秒）
var WELCOME_MESSAGES = [             // 你指定的欢迎语列表
    "{车站名}站欢迎您",
    "祝您旅途愉快",
    "安全出行 温馨相伴",
    "诚信友善 文明出行"
];

// ===== 辅助函数：获取始发站名称 =====
function getOriginStation(arrival) {
    try {
        var route = arrival.route();
        if (route == null) return "未知";
        
        var platforms = route.getPlatforms();
        if (platforms == null || platforms.size() == 0) return "未知";
        
        var firstPlatform = platforms.get(0);
        return firstPlatform.getStationName() || "未知";
    } catch (e) {
        print("获取始发站失败: " + e);
        return "未知";
    }
}

// ===== 辅助函数：格式化时间 =====
function formatTime(timestamp) {
    if (!timestamp) return "--:--";
    var date = new Date(timestamp);
    var hours = date.getHours().toString().padStart(2, '0');
    var minutes = date.getMinutes().toString().padStart(2, '0');
    return hours + ":" + minutes;
}

// ===== 辅助函数：获取随机欢迎语（自动替换 {车站名} 占位符）=====
function getRandomWelcome(stationName) {
    var randomIndex = Math.floor(Math.random() * WELCOME_MESSAGES.length);
    var template = WELCOME_MESSAGES[randomIndex];
    // 使用 JavaScript 正则表达式字面量，大括号需要转义
    return template.replace(/\{车站名\}/g, stationName || "本站");
}

// ===== 辅助函数：处理自定义消息中的变量 =====
function processCustomMessage(msg, pids) {
    if (!msg) return "";
    
    var station = pids.station();

    // 同样使用 JavaScript 正则，{station} 中的大括号转义
    msg = msg.replace(/\{station\}/g, stationName);
    return msg;
}



// ===== 主渲染函数 =====
function render(ctx, state, pids) {
    var screenWidth = pids.width;
    var screenHeight = pids.height;
    
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
    
    // ===== 分支逻辑 =====
    if (hasTrain && waitTime > WAIT_THRESHOLD) {
        // 情况A：等待时间 > 阈值，只显示红色欢迎语（第二行）
        
        Text.create("Welcome message")
            .text(state.welcomeText)
            .color(0xFF0000)                 // 红色
            .bold()
            .centerAlign()
            .pos(screenWidth / 2, ROW_HEIGHT) // 第二行
            .scale(1.5)
            .draw(ctx);
        
        // 第一行和第三行不绘制，实现清除
    } else {
        // 情况B：正常显示三行
        
        // --- 第一行 ---
        if (hasTrain) {
            var trainNumber = firstArrival.routeNumber() || "??";
            var depTime = firstArrival.departureTime() || firstArrival.arrivalTime();
            var timeStr = formatTime(depTime);
            var firstLineText = trainNumber + " 次 " + timeStr + " 开";
            
            Text.create("First line")
                .text(firstLineText)
                .color(0x00FF00)
                .centerAlign()
                .pos(screenWidth / 2, 1)
                .scale(1.5)
                .draw(ctx);
        } else {
            Text.create("First line")
                .text("暂无列车信息")
                .color(0x666666)
                .centerAlign()
                .pos(screenWidth / 2, 0)
                .draw(ctx);
        }
        
        // --- 第二行 ---
        if (hasTrain) {
            var origin = getOriginStation(firstArrival).split('|')[0];
            var dest = firstArrival.destination().split('|')[0] || "未知";
            var secondLineText = origin + " - " + dest;
            
            Text.create("Second line")
                .text(secondLineText)
                .color(0xFFFF00)
                .centerAlign()
                .pos(screenWidth / 2, ROW_HEIGHT)
                .scale(1.3)
                .draw(ctx);
        }
        
        // --- 第三行 ---
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
    
    // 可选调试信息
    // ctx.setDebugInfo("Station", stationName);
    // ctx.setDebugInfo("WaitTime", (waitTime/1000).toFixed(0) + "s");
}

// ===== 生命周期函数（可选）=====
function create(ctx, state, pids) {
    print("国铁站台PIDS已创建");
    var station = pids.station();
    var stationName = station ? station.getName() : "本站";
    state.welcomeText = getRandomWelcome(stationName);
}

function dispose(ctx, state, pids) {
    print("国铁站台PIDS已销毁");
}