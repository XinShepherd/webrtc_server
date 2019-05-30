const express = require('express');
const app = express();
const server = require('http').createServer(app);
const path = require("path");
const SkyRTC = require('./SkyRTC.js').listen(server);
const port = process.env.PORT || 3000;
const hostname = "0.0.0.0";
const logger = require('./logger').getLogger('server');

app.use(express.static(path.join(__dirname, 'public')), null);


server.listen(port, hostname, function () {
    logger.info(`Server running at http://${hostname}:${port}/`);
});


app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

SkyRTC.rtc.on('new_connect', function (socket) {
    logger.info('创建新连接');
});

SkyRTC.rtc.on('remove_peer', function (socketId) {
    logger.info(socketId + "用户离开");
});

SkyRTC.rtc.on('new_peer', function (socket, room) {
    logger.info("新用户" + socket.id + "加入房间" + room);
});

SkyRTC.rtc.on('socket_message', function (socket, msg) {
    logger.info("接收到来自" + socket.id + "的新消息：" + msg);
});

SkyRTC.rtc.on('ice_candidate', function (socket, ice_candidate) {
    logger.info("接收到来自" + socket.id + "的ICE Candidate");
});

SkyRTC.rtc.on('offer', function (socket, offer) {
    logger.info("接收到来自" + socket.id + "的Offer");
});

SkyRTC.rtc.on('answer', function (socket, answer) {
    logger.info("接收到来自" + socket.id + "的Answer");
});

SkyRTC.rtc.on('error', function (error) {
    logger.info("发生错误：" + error.message);
});