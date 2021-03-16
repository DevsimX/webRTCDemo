var videos = document.getElementById("videos");
var sendBtn = document.getElementById("sendBtn");
var msgs = document.getElementById("msgs");
var sendFileBtn = document.getElementById("sendFileBtn");
var room_id = document.getElementById("room_id");
var client_name = document.getElementById("client_name");
var connect_button = document.getElementById("connectButton")
var disconnect_button = document.getElementById("disconnectButton")
var change_video_muted_button = document.getElementById("changeVideoMutedButton")
var change_audio_muted_button = document.getElementById("changeAudioMutedButton")
let shareDesktop = document.getElementById("shareDesk");
var files = document.getElementById("files");
var robot = document.getElementById("robot")
var robot1 = require("robotjs");
var rtc = SkyRTC();

robot.onclick = function (){
    robot1.moveMouse(100,100)
}

//如果返回的是false说明当前操作系统是手机端，如果返回的是true则说明当前的操作系统是电脑端
function IsPC() {
    var userAgentInfo = navigator.userAgent;
    var Agents = ["Android", "iPhone","SymbianOS", "Windows Phone","iPad", "iPod"];
    var flag = true;

    for (var v = 0; v < Agents.length; v++) {
        if (userAgentInfo.indexOf(Agents[v]) > 0) {
            flag = false;
            break;
        }
    }

    return flag;
}

/**********************************************************/
shareDesktop.onchange = function (){
    let state = shareDesktop.checked;
    if(IsPC()){
        rtc.shareDesktop(state);
    }
}

sendBtn.onclick = function (event) {

    var msgIpt = document.getElementById("msgIpt"),
        msg = msgIpt.value,
        p = document.createElement("p");
    p.innerText = "me: " + msg;
    //广播消息
    rtc.broadcast(msg);
    msgIpt.value = "";
    msgs.appendChild(p);
};

sendFileBtn.onclick = function (event) {
    //分享文件
    rtc.shareFile("fileIpt");
};
/**********************************************************/

//输入房间号和名字，进入指定房间
connect_button.onclick = function (){
    const room_id_value = room_id.value;
    const name_value = client_name.value;

    if(room_id_value === "" || name_value === ""){ alert("有值为空");return;}

    const reg = new RegExp("^[0-9]*$");
    if(!reg.test(room_id_value)){ alert("请输入数字!"); return;}

    rtc.connect("wss://www.xytcloud.ltd:4433/xyt",parseInt(room_id_value),name_value)
}

change_audio_muted_button.onclick = function () {
    let content = change_audio_muted_button.innerText;
    let state = content === "打开麦克风";
    rtc.changeAudioTrackMuted(state);
    change_audio_muted_button.innerText = content === "打开麦克风" ? "关闭麦克风" : "打开麦克风"
}

change_video_muted_button.onclick = function () {
    let content = change_video_muted_button.innerText;
    let state = content === "打开摄像头";
    rtc.changeVideoTrackMuted(state);
    change_video_muted_button.innerText = content === "打开摄像头" ? "关闭摄像头" : "打开摄像头"
}

//离开服务器，关闭socket并停止stream当中所有的track
disconnect_button.onclick = function (){
    rtc.closeConnectionWithServer();
    videos.textContent = null;
    let newVideo = document.createElement("video")
    newVideo.setAttribute("id","me");
    newVideo.autoplay = true;
    videos.appendChild(newVideo)

    connect_button.disabled = false;
    change_video_muted_button.disabled = true;
    change_audio_muted_button.disabled = true;
    disconnect_button.disabled = true;
}

//用户名字重复
rtc.on("repeatedName", function (so) {
    alert("用户名重复，请重新输入用户名!"+so);
});
//对方同意接收文件
rtc.on("send_file_accepted", function (sendId, socketId, file) {
    var p = document.getElementById("sf-" + sendId);
    p.innerText = "对方接收" + file.name + "文件，等待发送";

});
//对方拒绝接收文件
rtc.on("send_file_refused", function (sendId, socketId, file) {
    var p = document.getElementById("sf-" + sendId);
    p.innerText = "对方拒绝接收" + file.name + "文件";
});
//请求发送文件
rtc.on('send_file', function (sendId, socketId, file) {
    var p = document.createElement("p");
    p.innerText = "请求发送" + file.name + "文件";
    p.id = "sf-" + sendId;
    files.appendChild(p);
});
//文件发送成功
rtc.on('sended_file', function (sendId, socketId, file) {
    var p = document.getElementById("sf-" + sendId);
    p.parentNode.removeChild(p);
});
//发送文件碎片
rtc.on('send_file_chunk', function (sendId, socketId, percent, file) {
    var p = document.getElementById("sf-" + sendId);
    p.innerText = file.name + "文件正在发送: " + Math.ceil(percent) + "%";
});
//接受文件碎片
rtc.on('receive_file_chunk', function (sendId, socketId, fileName, percent) {
    var p = document.getElementById("rf-" + sendId);
    p.innerText = "正在接收" + fileName + "文件：" + Math.ceil(percent) + "%";
});
//接收到文件
rtc.on('receive_file', function (sendId, socketId, name) {
    var p = document.getElementById("rf-" + sendId);
    p.parentNode.removeChild(p);
});
//发送文件时出现错误
rtc.on('send_file_error', function (error) {
    console.log(error);
});
//接收文件时出现错误
rtc.on('receive_file_error', function (error) {
    console.log(error);
});
//接受到文件发送请求
rtc.on('receive_file_ask', function (sendId, socketId, fileName, fileSize) {
    var p;
    if (window.confirm(socketId + "用户想要给你传送" + fileName + "文件，大小" + fileSize + "KB,是否接受？")) {
        rtc.sendFileAccept(sendId);
        p = document.createElement("p");
        p.innerText = "准备接收" + fileName + "文件";
        p.id = "rf-" + sendId;
        files.appendChild(p);
    } else {
        rtc.sendFileRefuse(sendId);
    }
});
//成功创建WebSocket连接
rtc.on("connected", function () {
    //创建本地视频流
    rtc.createStream({
        "video": true,
        "audio": true
    });
    // clientSocket = socket;
    console.log("成功进入房间!");
    connect_button.disabled = true;
    disconnect_button.disabled = false;
});
//创建本地视频流成功
rtc.on("stream_created", function (stream) {
    //创建视频流之后立刻静音
    rtc.changeVideoTrackMuted(false);
    rtc.changeAudioTrackMuted(false);
    shareDesktop.disabled = false;
    change_audio_muted_button.disabled = false;
    change_video_muted_button.disabled = false;
    document.getElementById('me').srcObject = stream;
    document.getElementById('me').play();
    // 设置本地不播放自己的声音
    document.getElementById('me').volume = 0.0;
});
//重设本地流成功
rtc.on("stream_reset", function (stream) {
    change_audio_muted_button.innerText = "打开麦克风";
    change_video_muted_button.innerText = "打开摄像头";
    //创建视频流之后立刻静音
    document.getElementById('me').srcObject = stream;
    document.getElementById('me').play();
    // 设置本地不播放自己的声音
    document.getElementById('me').volume = 0.0;
});
//创建本地视频流失败
rtc.on("stream_create_error", function (error) {
    alert("create stream failed!");
    alert(error);
    connect_button.disabled = false;
    disconnect_button.disabled = true;
    rtc = SkyRTC();
});
//接收到其他用户的视频流
rtc.on('pc_add_track', function (track, socketId) {
    var id = "other-" + socketId;
    if(document.getElementById(id) === null){
        var newVideo = document.createElement("video");
        newVideo.setAttribute("class", "other");
        newVideo.setAttribute("autoplay", "autoplay");
        newVideo.setAttribute("id", id);
        videos.appendChild(newVideo);
        let stream = new MediaStream();
        stream.addTrack(track);
        rtc.attachStream(stream, id);
    }else{
        document.getElementById(id).srcObject.addTrack(track);
        document.getElementById(id).play()
    }
});
//删除其他用户
rtc.on('remove_peer_video', function (socketId) {
    var video = document.getElementById('other-' + socketId);
    if (video) {
        video.parentNode.removeChild(video);
    }
});
//接收到文字信息
rtc.on('data_channel_message', function (channel, socketId, message) {
    var p = document.createElement("p");
    p.innerText = socketId + ": " + message;
    msgs.appendChild(p);
});

//提示有新用户加入到了房间中
rtc.on('alert_new_client_joined', function (socketId, name) {
    console.log("socketId为"+socketId+";name为"+name+"的用户加入到了本房间中。")
});

//成功断开连接
rtc.on('close_connection_successfully', function () {
    console.log("成功与服务器断开了连接。");
});