const express = require('express');
var fs = require('fs');
const app = express();
var options = {
    key  : fs.readFileSync('./cert/2_xytcloud.ltd.key'),
    cert : fs.readFileSync('./cert/1_xytcloud.ltd_bundle.crt')
}
const server = require('https').createServer(options,app);
const path = require("path");

app.use(express.static(path.join(__dirname, 'blockly')));

app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Content-Type', 'application/json;charset=utf-8');
    next();
});


server.listen(4631, '0.0.0.0');


app.get('/', function (req, res) {
    res.sendfile(__dirname + '/blockly/index.html');
});