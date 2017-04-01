/**
* 用于记录用户是否登录
*/
var net = require('net');
var netKeepAlive = require('net-keepalive');
var redis = require('redis'); 
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var crypto = require('crypto');
var log4js = require("log4js");
var log4js_config = require("./log4js.json");
    log4js.configure(log4js_config);
var logger = log4js.getLogger('log_file');

//长连接服务配置
var HOST = '101.201.209.132';
var PORT = 6969;

// 测试环境 Redis 配置
var REDIS_HSOT = '101.201.209.132';
var REDIS_PORT = 6379;
var REDIS_PASSWORD = 'zhst08651wnjhyxtdgsAwqsxx212';
var REDIS_DB = 7;

var SALT = "abcjzb_salt";


if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', function(worker, code, signal) {
    logger.info('worker ' + worker.process.pid + ' died');
  });
} else {
    // In this case its a socket server
    net.createServer(function (sock) {

        //IMPORTANT: KeepAlive must be enabled for this to work
        sock.setKeepAlive(true, 10*1000);
        // Set TCP_KEEPINTVL for this specific socket 
        netKeepAlive.setKeepAliveInterval(sock, 10*1000);
        // and TCP_KEEPCNT 
        netKeepAlive.setKeepAliveProbes(sock, 3);

        sock.on('timeout',function(){
            logger.info(sock.remoteAddress + ':' + sock.remotePort +' timeout');
        });

        var aliveKey;
        var tokenKey;
        logger.info('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);

        var client = redis.createClient(REDIS_PORT, REDIS_HSOT,{});
        client.auth(REDIS_PASSWORD, function(){
            logger.info(sock.remoteAddress + ':' + sock.remotePort +' login redis pass!');
        });
        //指定Redis数据库
        client.select(REDIS_DB, function(){});

        // 为这个socket实例添加一个"data"事件处理函数
        sock.on('data', function (data) {
            logger.info(sock.remoteAddress + ':' + sock.remotePort +' send to server data: ' + data );

            try{
                if(data.toString()=='1'){
                    logger.info(sock.remoteAddress + ':' + sock.remotePort +' heartbeat: ' + data );
                }else{
                    var obj = JSON.parse(data.toString());
                    aliveKey = obj.user_id + obj.role_code;
                    tokenKey = aliveKey + md5(aliveKey + SALT);
                    client.set(aliveKey, "on", function(err, reply) {
                        logger.info(sock.remoteAddress + ':' + sock.remotePort +': ' + aliveKey + ": login successfully ");
                        sock.write('{ "msg": "成功", "code": "200" }');
                    });
                 }
            } catch (err){
                logger.warn(sock.remoteAddress + ':' + sock.remotePort +': ' + aliveKey + ": login failure ");
                sock.write('{ "msg": "参数不合法", "code": "001" }');
            }
        });

        // 为这个socket实例添加一个"close"事件处理函数
        sock.on('close', function (data) {
            client.DEL(aliveKey, function(err, reply) {
                logger.info(sock.remoteAddress + ':' + sock.remotePort + ': ' + aliveKey + ": removed successfully ");
            });
            client.DEL(tokenKey, function(err, reply) {
                logger.info(sock.remoteAddress + ':' + sock.remotePort + ': ' + tokenKey + ": removed successfully ");
            });
            logger.info('CLOSED By: ' + sock.remoteAddress + ' ' + sock.remotePort);
        });

        // 为这个socket实例添加一个"error"事件处理函数, 结束后会触发 close
        sock.on('error', function (data) {
            logger.error('ERROR: ' + sock.remoteAddress + ' ' + sock.remotePort);
        });

        // 为这个socket实例添加一个"end"事件处理函数, 结束后会触发 close
        sock.on('end', function (data) {
            logger.info('END: ' + sock.remoteAddress + ' ' + sock.remotePort);
        });

    }).listen(PORT, HOST);
}

logger.info('Server listening on ' + HOST + ':' + PORT);

//md5加密
function md5 (text) {
  return crypto.createHash('md5').update(text).digest('hex');
};