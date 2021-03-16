let WebSocketServer = require('ws').Server;
let UUID = require('node-uuid');
let events = require('events');
let util = require('util');

let errorCb = function (rtc) {
    return function (error) {
        if (error) {
            rtc.emit("error", error);
        }
    };
};





//************************************//
//client对象，用于构建用户对象的构造函数，参数为socket对象和string字符
function WebRtcClient(socket,username,name){
    this.socket = socket;
    this.username = username;
    this.name = name;
    this.id = socket.id;
    this.room_id = null;
}

//设置用户所在房间的房间id，参数为纯数字
WebRtcClient.prototype.setRoomId = function (room_id){
    const reg = new RegExp("^[0-9]*$");
    if(!reg.test(room_id)){
        console.log("设置用户 " + this.name + "的房间id失败，原因是房间号不为纯数字");
        return false;
    }else {
        this.room_id = room_id;
        return true;
    }
}



//************************************//
//Room对象，用于构建房间对象的构造函数，参数为纯数字房间id
function Room(room_id){
    this.id = room_id;
    this.client_list = [];
}

//为房间添加用户，参数为webrtcclient对象
Room.prototype.addClient = function (client) {
    if(client instanceof WebRtcClient){
        this.client_list.push(client);
        return true;
    } else{
        return false;
    }
}

//从房间中删除用户，参数为webrtcclient对象
Room.prototype.deleteClient = function (client) {
    if(client instanceof WebRtcClient){
        for(var i = 0 ; i < this.client_list.length ; i++){
            if(this.client_list[i].id === client.id){
                this.client_list.splice(i,1);
                //删除成功
                return 0;
            }
        }
        //console.log("无法在指定房间里删除该client对象")
        return 1;
    } else{
        //console.log("无法删除一个非client对象")
        return 2;
    }
}




//*********************************************************//
//skyrtc对象
function SkyRTC() {
    //旧的两个参数，可以删除或者不删除，都可
    this.sockets = [];
    this.rooms = {};


    //原创的两个参数，名字代表含义
    this.clientList = [];
    this.roomList = [];

    this.remoteControlList = [];//远程连接的list,格式是{controller:client,controlled:client,state:connecting/connected,track}


    // 加入房间
    this.on('__join', function (data, socket) {
        //检查用户名是否已经存在于服务器当中
        if(!this.checkClientName(data.username)){
            socket.send(JSON.stringify({
                "eventName": "_repeatedName"
            }), errorCb);
            return;
        }

        //创建webrtc用户并将它添加到服务器的clientList列表当中
        const newWebRtcClient = new WebRtcClient(socket, data.username,data.name);
        this.clientList.push(newWebRtcClient);

        //获得用户想进入的房间，新建或者获取已经存在的某个房间
        let ids = [],names={},usernames={},clientRoom = this.createOrChooseARoom(data.room_id);

        //将创建的webrtc对象添加到对应的房间中，如果添加错误报错
        if(!clientRoom.addClient(newWebRtcClient)){
            console.log("无法添加一个非client对象")
            return;
        }

        //设置创建的webrtc对象所在的房间号
        newWebRtcClient.setRoomId(clientRoom.id)

        //通知房间中的其他人该用户已经加入了房间中
        for(let client of clientRoom.client_list){
            if(client.id === newWebRtcClient.id)
                continue;
            ids.push(client.id);
            names[client.id]=client.name;
            usernames[client.id] = client.username;
            client.socket.send(JSON.stringify({
                        "eventName": "_new_peer",
                        "data": {
                            "socketId": newWebRtcClient.socket.id,
                            "name": newWebRtcClient.name,
                            "username": newWebRtcClient.username,
                        }
                    }), errorCb);
        }

        //告诉client和他相连接的用户有哪些
        newWebRtcClient.socket.send(JSON.stringify({
                "eventName": "_peers",
                "data": {
                    "connections": ids,
                    "names": names,
                    "usernames": usernames,
                    "you": socket.id
                }
            }), errorCb);


        //通知服务器有新用户加入房间，用于console.log，意义不明显
        this.emit('new_peer', newWebRtcClient.name, clientRoom.id);
        // let ids = [],
        //     i, m,
        //     room = data.id || "__default",
        //     curSocket,
        //     curRoom;

        // curRoom = this.rooms[room] = this.rooms[room] || [];
        //
        // for (i = 0, m = curRoom.length; i < m; i++) {
        //     curSocket = curRoom[i];
        //     if (curSocket.id === socket.id) {
        //         continue;
        //     }
        //     ids.push(curSocket.id);
        //     curSocket.send(JSON.stringify({
        //         "eventName": "_new_peer",
        //         "data": {
        //             "socketId": socket.id
        //         }
        //     }), errorCb);
        // }
        //
        // curRoom.push(socket);
        // socket.room = room;
        //
        // socket.send(JSON.stringify({
        //     "eventName": "_peers",
        //     "data": {
        //         "connections": ids,
        //         "you": socket.id
        //     }
        // }), errorCb);
        //
        // this.emit('new_peer', socket, room);
    });

    this.on('__ice_candidate', function (data, socket) {
        var soc = this.getSocket(data.socketId);

        if (soc) {
            soc.send(JSON.stringify({
                "eventName": "_ice_candidate",
                "data": {
                    "id": data.id,
                    "label": data.label,
                    "sdpMLineIndex" :data.label,
                    "candidate": data.candidate,
                    "socketId": socket.id
                }
            }), errorCb);

            this.emit('ice_candidate', socket, data);
        }
    });

    this.on('__offer', function (data, socket) {
        var soc = this.getSocket(data.socketId);

        if (soc) {
            soc.send(JSON.stringify({
                "eventName": "_offer",
                "data": {
                    "sdp": data.sdp,
                    "socketId": socket.id
                }
            }), errorCb);
        }
        this.emit('offer', socket, data);
    });

    this.on('__answer', function (data, socket) {
        var soc = this.getSocket(data.socketId);
        if (soc) {
            soc.send(JSON.stringify({
                "eventName": "_answer",
                "data": {
                    "sdp": data.sdp,
                    "socketId": socket.id
                }
            }), errorCb);
            this.emit('answer', socket, data);
        }
    });

    this.on('__remoteControlAsk', function (data, socket) {
        let controller = this.getClientByUsername(data.controller);
        let controlled = this.getClientByUsername(data.controlled);

        if(controller && controlled){
            if(this.checkRemoteControl(data.controlled)){
                this.remoteControlList.push({controller: controller,controlled: controlled,state: 'ask',track: null});
                controlled.socket.send(JSON.stringify({
                    "eventName": "_receiveRemoteControlAsk",
                    "data": {
                        "name": controller.name,
                        "username": controller.username,
                    }
                }), errorCb);
            }else {
                controller.socket.send(JSON.stringify({
                    "eventName": "_remoteControlFail",
                    "data": {
                        "name": controlled.name,
                        "error": "目标用户正在连接中或已经和他人建立了连接",
                    }
                }), errorCb);
            }
        }
    });

    this.on('__remoteControlRespond', function (data, socket) {
        let controller = this.getClientByUsername(data.controller);
        let controlled = this.getClientByUsername(data.controlled);

        if(controller && controlled){
            if(data.state === "accept"){
                let remote = this.getRemoteControlByAll(data.controller,data.controlled);
                remote['track'] = data.track;
                remote['state'] = "connected";

                controller.socket.send(JSON.stringify({
                    "eventName": "_remoteControlSuccess",
                    "data": {
                        "name": controlled.name,
                        "track": data.track,
                    }
                }), errorCb);
            }else if(data.state === "refuse"){
                controller.socket.send(JSON.stringify({
                    "eventName": "_remoteControlFail",
                    "data": {
                        "name": controlled.name,
                        "error": data.info,
                    }
                }), errorCb);
            }
            // if(this.checkRemoteControl(data.controlled)){
            //     this.remoteControlList.push({controller: controller,controlled: controlled,state: 'ask'});
            //     controlled.socket.send(JSON.stringify({
            //         "eventName": "_receiveRemoteControlAsk",
            //         "data": {
            //             "name": controller.name,
            //             "username": controller.username,
            //         }
            //     }), errorCb);
            // }else {
            //     controller.socket.send(JSON.stringify({
            //         "eventName": "_waitRemoteControl",
            //         "data": {
            //             "name": controlled.name
            //         }
            //     }), errorCb);
            // }
        }
    });



    // 发起邀请
    this.on('__invite', function (data) {

    });
    // 回应数据
    this.on('__ack', function (data) {

    });
}

util.inherits(SkyRTC, events.EventEmitter);

//检查新加入的用户的用户名是否已经存在，true为不存在
SkyRTC.prototype.checkClientName = function (username){
    for(let client of this.clientList){
        if(username === client.username){
            return false;
        }
    }
    return true;
}

//创建一个房间或者选择一个已经存在的房间
SkyRTC.prototype.createOrChooseARoom = function (room_id){
    for(let room of this.roomList){
        if(room.id === room_id)
            return room;
    }
    let room = new Room(room_id);
    this.roomList.push(room);

    console.log("房间"+room_id+"已创建"+"。 且当前服务器当中共有" + this.roomList.length + "个房间");
    return room;
}

SkyRTC.prototype.addSocket = function (socket) {
    this.sockets.push(socket);
};

SkyRTC.prototype.removeSocket = function (socket) {
    var i = this.sockets.indexOf(socket);
    this.sockets.splice(i, 1);
};

SkyRTC.prototype.broadcast = function (data, errorCb) {
    var i;
    for (i = this.sockets.length; i--;) {
        this.sockets[i].send(data, errorCb);
    }
};


SkyRTC.prototype.broadcastInRoom = function (room, data, errorCb) {
    var curRoom = this.rooms[room], i;
    if (curRoom) {
        for (i = curRoom.length; i--;) {
            curRoom[i].send(data, errorCb);
        }
    }
};

//根据room id获得指定的房间
SkyRTC.prototype.getRoom = function (room_id) {
    for(let room of this.roomList){
        if(room.id === room_id)
            return room;
    }
    return null;
};

//根据room id删除指定的房间
SkyRTC.prototype.deleteRoom = function (room_id) {
    for(let i = 0 ; i < this.roomList.length; i++){
        if(this.roomList[i].id === room_id) {
            this.roomList.splice(i, 1);
            console.log("房间"+room_id+"从服务器中被删除。 现在服务器中还有"+this.roomList.length+"个房间")
            return true;
        }
    }
    return false;
};

//根据socketid获得指定的用户
SkyRTC.prototype.getClient = function (socket_id) {
    for(let client of this.clientList){
        if(client.id === socket_id)
            return client;
    }
    return null;
};

//根据username获得指定的用户
SkyRTC.prototype.getClientByUsername = function (username) {
    for(let client of this.clientList){
        if(client.username === username)
            return client;
    }
    return null;
};

//异步检查是否一个用户只能被一个用户远程控制
SkyRTC.prototype.checkRemoteControl = function (username) {
    for(let remote of this.remoteControlList){
        if(remote.controlled.username === username){
            return false;
        }
    }
    return true;
};

//异步检查是否一个用户只能被一个用户远程控制
SkyRTC.prototype.getRemoteControlByAll = function (controller,controlled) {
    for(let remote of this.remoteControlList){
        if(remote['controller'].username === controller && remote['controlled'].username === controlled){
            return remote;
        }
    }
    return null;
};

//根据socketid删除指定的用户
SkyRTC.prototype.deleteClient = function (socket_id) {
    for(let i = 0 ; i < this.clientList.length; i++){
        if(this.clientList[i].id === socket_id){
            var name = this.clientList[i].name;
            this.clientList.splice(i,1);
            console.log("用户（socketId为"+socket_id+"）"+name+"从服务器中离开。 现在服务器中还有"+this.clientList.length+"个人")
            return true;
        }
    }
    return false;
};

//根据socketid获得socket对象
SkyRTC.prototype.getSocket = function (socketId) {
    // let i, curSocket;
    // if (!this.sockets) {
    //     return;
    // }
    // for (i = this.sockets.length; i--;) {
    //     curSocket = this.sockets[i];
    //     if (socketId === curSocket.id) {
    //         return curSocket;
    //     }
    // }
    if (!this.clientList) {
        return;
    }
    for (let client of this.clientList) {
        if(socketId === client.id)
            return client.socket
    }
};

SkyRTC.prototype.init = function (socket) {
    let that = this;
    socket.id = UUID.v4();
    console.log("socket id为： "+socket.id + "的socket加入了服务器.");
    that.addSocket(socket);
    console.log("现在服务器共有" + this.sockets.length + "个socket")
    //为新连接绑定事件处理器
    socket.on('message', function (data) {
        // console.log(data);
        let json = JSON.parse(data);
        if (json.eventName) {
            that.emit(json.eventName, json.data, socket);
        } else {
            that.emit("socket_message", socket, data);
        }
    });
    //连接关闭后从SkyRTC实例中移除连接，并通知其他连接
    socket.on('close', function () {
        let client = that.getClient(socket.id);
        if(client === null){
            let preNum = that.sockets.length;
            that.removeSocket(socket);
            let restNum = preNum-that.sockets.length
            console.log("从服务器中删除了"+restNum+"个socket。 现在服务器中还有"+that.sockets.length+"个socket");
            return;
        }
        let room_id = client.room_id;
        let room = that.getRoom(room_id);


        //三个删除，从房间中删除，从服务器中删除，从服务器中删除socket
        let res = room.deleteClient(client);
        that.removeSocket(socket);
        that.deleteClient(socket.id);

        if(res === 0){
            for(let restClient of room.client_list){
                restClient.socket.send(JSON.stringify({
                                "eventName": "_remove_peer",
                                "data": {
                                    "socketId": socket.id,
                                    "name": client.name
                                }
                            }), errorCb);
            }
            //如果房间内的用户数量为0，删除该房间
            if(room.client_list.length === 0)
                that.deleteRoom(room_id);
            that.emit('remove_peer', socket.id, that.sockets.length);

        }else if(res === 1){
            console.log("无法在指定房间里删除该client对象")
        }else if(res === 2){
            console.log("无法删除一个非client对象")
        }else {
            console.log("在skyrtc.js的293行出现了未知错误")
        }


        // let i, m,
        //     room = socket.room,
        //     curRoom;
        // if (room) {
        //     curRoom = that.rooms[room];
        //     for (i = curRoom.length; i--;) {
        //         if (curRoom[i].id === socket.id) {
        //             continue;
        //         }
        //         curRoom[i].send(JSON.stringify({
        //             "eventName": "_remove_peer",
        //             "data": {
        //                 "socketId": socket.id
        //             }
        //         }), errorCb);
        //     }
        // }
        //
        // that.emit('remove_peer', socket.id, that);
    });
    that.emit('new_connect', socket);
};

module.exports.listen = function (server,path) {
    let SkyRTCServer;
    if (typeof server === 'number') {
        SkyRTCServer = new WebSocketServer({
            port: server,
            path: path
        });
    } else {
        SkyRTCServer = new WebSocketServer({
            server: server,
            path: path
        });
    }

    SkyRTCServer.rtc = new SkyRTC();
    errorCb = errorCb(SkyRTCServer.rtc);
    SkyRTCServer.on('connection', function (socket) {
        this.rtc.init(socket);
    });


    return SkyRTCServer;
};