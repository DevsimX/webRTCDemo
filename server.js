var koa = require('koa')
var bodyParser = require('koa-bodyparser');
var router = require('koa-router')()
var cors = require('koa2-cors') //跨域中间件
var app = new koa()
var fs = require('fs');
var options = {
    key  : fs.readFileSync('./cert/2_xytcloud.ltd.key'),
    cert : fs.readFileSync('./cert/1_xytcloud.ltd_bundle.crt')
}
const server = require('https').createServer(options);
const path = require("path");
const SkyRTC = require('./public/dist/js/SkyRTC.js').listen(server,"/xyt");



server.listen(4433, '0.0.0.0');

//设置允许跨域访问该服务.
app.use(cors());

app.use(bodyParser());

// log request URL:
app.use(async (ctx, next) => {
    console.log(`Process ${ctx.request.method} ${ctx.request.url}...`);
    await next();
});

// add url-route:
router.get('/hello/:name', async (ctx, next) => {
    var name = ctx.params.name;
    ctx.response.body = `<h1>Hello, ${name}!</h1>`;
});

router.get('/', async (ctx, next) => {
    ctx.response.body = '<h1>Index</h1>';
});

router.post('/remoteControl',async (ctx,next) => {
    let controller = ctx.request.body['controller'];
    let controlled = ctx.request.body['controlled'];

    if(controller && controlled){
        for(let i of SkyRTC.rtc.remoteControlList){
            if(i['controlled'].username === controlled && i['controller'].username === controller){
                if(i['track']){
                    ctx.response.status = 200;
                    ctx.response.message = 'ok'
                }else {
                    ctx.response.status = 404;
                    ctx.response.message = 'track not found'
                }
                return;
            }
        }
    }
    ctx.response.status = 404;
})

router.post('/remoteControlGetTrack',async (ctx,next) => {
    let controller = ctx.request.body['controller'];
    let controlled = ctx.request.body['controlled'];

    if(controller && controlled){
        for(let i of SkyRTC.rtc.remoteControlList){
            if(i['controlled'].username === controlled && i['controller'].username === controller){
                if(i['track']){
                    ctx.response.status = 200;
                    ctx.response.body = i['track'];
                    ctx.response.message = 'ok'
                }else {
                    ctx.response.status = 404;
                    ctx.response.message = 'track not found'
                }
                return;
            }
        }
    }
    ctx.response.status = 404;
})

router.get('/testConnect',async (ctx,next) => {
    ctx.response.status = 200;
    ctx.response.message = 'ok'
    ctx.response.ok = true;
})

router.get('/testUsernameDuplicated',async (ctx,next) => {
    let username = ctx.query.username;
    let clientList = SkyRTC.rtc.clientList;
    for(let i of clientList){
        if(i.username === username){
            ctx.response.status = 200;
            ctx.response.message = 'username duplicated'
            ctx.response.ok = true;
            return;
        }
    }
    ctx.response.status = 200;
    ctx.response.message = 'ok'
    ctx.response.ok = true;
})
// add router middleware:
app.use(router.routes());

require('https').createServer(options,app.callback()).listen(8001);

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
