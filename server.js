const express = require('express');
var fs = require('fs');
const app = express();
var options = {
    key  : fs.readFileSync('./cert/2_xytcloud.ltd.key'),
    cert : fs.readFileSync('./cert/1_xytcloud.ltd_bundle.crt')
}
const server = require('https').createServer(options,app);
const path = require("path");
const SkyRTC = require('./public/dist/js/SkyRTC.js').listen(server,"/xyt");

app.use(express.static(path.join(__dirname, 'public')), null);


server.listen(4433, '0.0.0.0');


app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

SkyRTC.rtc.on('new_connect', function (socket) {
    console.log('创建新连接');
});

SkyRTC.rtc.on('remove_peer', function (socketId,restNum) {
    console.log("socketId为："+socketId + "的socket与服务器断开了连接。 现在服务器中还有"+restNum+"个socket。");
});

SkyRTC.rtc.on('new_peer', function (name, room) {
    console.log("用户 " + name + "加入了房间" + room);
});

SkyRTC.rtc.on('socket_message', function (socket, msg) {
    console.log("接收到来自" + socket.id + "的新消息：" + msg);
});

SkyRTC.rtc.on('ice_candidate', function (socket, ice_candidate) {
    console.log("接收到来自" + socket.id + "的ICE Candidate");
});

SkyRTC.rtc.on('offer', function (socket, offer) {
    console.log("接收到来自" + socket.id + "的Offer");
});

SkyRTC.rtc.on('answer', function (socket, answer) {
    console.log("接收到来自" + socket.id + "的Answer");
});

SkyRTC.rtc.on('error', function (error) {
    console.log("发生错误：" + error.message);
});