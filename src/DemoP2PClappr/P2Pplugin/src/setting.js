var freeice = require('freeice')

module.exports = {
    maxSwarmSize:100,
    ice:freeice(),
    maxContributors:10,
    timeOutForInterest:300, 
    timeoutForRequest:1500,
    numberChunkCache: 15,
    updateReportTime: 10000,
    ratioMinRequestTimeout:0.3333,


    // httpServerReport2: "http://192.168.6.109:8090/report/interval",
    httpServerReport2: "http://192.168.6.109:8090/report/interval",
    signalingServer: "ws://192.168.6.109:8997"
   
}