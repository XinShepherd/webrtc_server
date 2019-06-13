'use strict';
var WebSocketServer = require('ws').Server;
var UUID = require('node-uuid');
var events = require('events');
var util = require('util');
const logger = require('./logger').getLogger('skyRTC');

var errorCb = function (rtc) {
    return function (error) {
        if (error) {
            rtc.emit("error", error);
        }
    };
};

/**
 * 用于维护一个房间数据
 **/
class Room {

    constructor(roomId) {
        this.roomId = roomId;
        this.sockets = [];
        this.owerId = null;
    }

}

function SkyRTC() {
    this.wholeSockets = [];
    this.rooms = {};
    // 加入房间
    this.on('__join', function (data, socket) {

        var ids = [],
            i, m,
            room = data.room || "__default",
            curSocket,
            curRoom;

        curRoom = this.rooms[room] = this.rooms[room] || new Room(room);

        // 确认房主
        if (curRoom.sockets.length === 0) {
            socket.owner = true;
            curRoom.owerId = socket.id;
        }
        for (i = 0, m = curRoom.sockets.length; i < m; i++) {
            curSocket = curRoom.sockets[i];
            if (curSocket.id === socket.id) {
                continue;
            }
            ids.push(curSocket.id);
            curSocket.send(JSON.stringify({
                "eventName": "_new_peer",
                "data": {
                    "socketId": socket.id,
                    "ownerId": curRoom.owerId
                }
            }), errorCb);
        }

        curRoom.sockets.push(socket);
        socket.room = room;
        logger.info("房间" + room + "里有" + curRoom.sockets.length + "人");

        socket.send(JSON.stringify({
            "eventName": "_peers",
            "data": {
                "connections": ids,
                "you": socket.id,
                "ownerId": curRoom.owerId
            }
        }), errorCb);

        this.emit('new_peer', socket, room);
    });

    this.on('__ice_candidate', function (data, socket) {
        var soc = this.getSocket(data.socketId);

        if (soc) {
            soc.send(JSON.stringify({
                "eventName": "_ice_candidate",
                "data": {
                    "id":data.id,
                    "label": data.label,
                    "candidate": data.candidate,
                    "sdpMid": data.sdpMid,
                    "sdpMLineIndex": data.sdpMLineIndex,
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

    // 发起邀请
    this.on('__invite', function (data) {

    });
    // 回应数据
    this.on('__ack', function (data) {

    });
}

util.inherits(SkyRTC, events.EventEmitter);

SkyRTC.prototype.addSocket = function (socket) {
    this.wholeSockets.push(socket);
};

SkyRTC.prototype.removeSocket = function (socket) {
    var i = this.wholeSockets.indexOf(socket),
        roomId = socket.room;
    this.wholeSockets.splice(i, 1);
    if (roomId) {
        let room = this.rooms[roomId];
        let roomSockets = room.sockets;
        i = roomSockets.indexOf(socket);
        roomSockets.splice(i, 1);
        if (roomSockets.length === 0) {
            delete this.rooms[room];
        } else if (room.owerId === socket.id) {
            room.owerId = room.sockets[0].id;
            this.broadcastInRoom(room.roomId, JSON.stringify({
                "eventName": "_new_owner",
                "data": {
                    "ownerId": room.owerId
                }
            }), errorCb)
        }
    }
};

SkyRTC.prototype.broadcast = function (data, errorCb) {
    var i;
    for (i = this.wholeSockets.length; i--;) {
        this.wholeSockets[i].send(data, errorCb);
    }
};

SkyRTC.prototype.broadcastInRoom = function (room, data, errorCb) {
    var sockets = this.rooms[room].sockets, i;
    if (sockets) {
        for (i = sockets.length; i--;) {
            sockets[i].send(data, errorCb);
        }
    }
};

SkyRTC.prototype.getRooms = function () {
    var rooms = [],
        room;
    for (room in this.rooms) {
        rooms.push(room);
    }
    return rooms;
};

SkyRTC.prototype.getSocket = function (socketId) {
    var i, curSocket;
    if (!this.wholeSockets) {
        return;
    }
    for (i = this.wholeSockets.length; i--;) {
        curSocket = this.wholeSockets[i];
        if (socketId === curSocket.id) {
            return curSocket;
        }
    }

};

SkyRTC.prototype.init = function (socket) {
    var that = this;
    socket.id = UUID.v4();
    that.addSocket(socket);
    //为新连接绑定事件处理器
    socket.on('message', function (data) {
        logger.info(data);
        var json = JSON.parse(data);
        if (json.eventName) {
            that.emit(json.eventName, json.data, socket);
        } else {
            that.emit("socket_message", socket, data);
        }
    });
    //连接关闭后从SkyRTC实例中移除连接，并通知其他连接
    socket.on('close', function () {
        var i, m,
            room = socket.room,
            curRoom;
        if (room) {
            curRoom = that.rooms[room];
            for (i = curRoom.sockets.length; i--;) {
                if (curRoom.sockets[i].id === socket.id) {
                    continue;
                }
                curRoom.sockets[i].send(JSON.stringify({
                    "eventName": "_remove_peer",
                    "data": {
                        "socketId": socket.id
                    }
                }), errorCb);
            }
        }

        that.removeSocket(socket);
        that.emit('remove_peer', socket.id, that);
    });
    that.emit('new_connect', socket);
};

module.exports.listen = function (server) {
    var SkyRTCServer;
    if (typeof server === 'number') {
        SkyRTCServer = new WebSocketServer({
            port: server
        });
    } else {
        SkyRTCServer = new WebSocketServer({
            server: server
        });
    }

    SkyRTCServer.rtc = new SkyRTC();
    errorCb = errorCb(SkyRTCServer.rtc);
    SkyRTCServer.on('connection', function (socket) {
        this.rtc.init(socket);
    });


    return SkyRTCServer;
};