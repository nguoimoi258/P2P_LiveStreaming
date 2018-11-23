var P2PLoader = P2PPlugin.default.P2PLoader
var Settings = P2PPlugin.default.Settings
var P2PManager = P2PPlugin.default.P2PManager
var AdaptiveTimeout = P2PPlugin.default.AdaptiveTimeout
var Storage = P2PPlugin.default.Storage
var platform = P2PPlugin.default.platform
var lodash = P2PPlugin.default.lodash

var p2pManager
var storage = Storage.getInstance()
var controlTimeout = AdaptiveTimeout.getInstance()

var prevReport;
var timeP2P = [],timeCDN = []
var speedP2P = [], speedCDN = []
var dataMsg = {};
var customerID
var link, peerID, peers = [], currentLevel,mediaEngine, swarmID, tokenExit


var streamPage = document.querySelector('#linkstreamPage');
//var streamlink = document.querySelector('#linkstream'); 
var streamBtn = document.querySelector('#streamBtn'); 
var mainPage = document.querySelector('#mainPage');
var select = document.getElementById("links");
var inputLink = document.querySelector("#linkInput")
var infoArea = document.querySelector('#infoarea')
var chatArea = document.querySelector('#chatarea'); 
mainPage.style.display = "none";


streamBtn.addEventListener('click',function(event){
  if(inputLink.value !== ""){
    link = inputLink.value
  } else{
    link = select.value;
  }

  streamPage.style.display = "none";
  mainPage.style.display = "block";

  start()
})

infoArea.innerHTML = platform.description + "<br />" + "HLS.js " + Clappr.HLS.HLSJS.version + "<br />"

function start(){

  peerID = createP2P('test', '', Settings.ice) // create p2pManager with room test and get a random ice server
  
  // Send Report
  sendReport() // first send 
  setInterval(sendReport.bind(this),Settings.updateReportTime) // re-send after interval

  var player = new Clappr.Player({
    source: link, // CDN URL
    parentId: '#player',
    autoPlay:true,
    plugins: [LevelSelector],
    levelSelectorConfig: {
      title: 'Quality',
      labelCallback: function(playbackLevel, customLabel) {
          return playbackLevel.level.height+'p'; // High 720p
      }
    },
    hlsjsConfig: {
      pLoader: function (config) { // playlist loader
        let loader = new P2PLoader(config);
        this.abort = () => loader.abort();
        this.destroy = () => loader.destroy();
        this.load = (context, config, callbacks) => {
          let {type, url} = context;
          if (type === 'manifest') {
            console.log(`Manifest ${url} will be loaded.`);
          }
          loader.load(context, config, 'list', p2pManager, storage, controlTimeout , callbacks);
        };
      },
      fLoader: function (config) { //fragment loader
        let loader = new P2PLoader(config);
        this.abort = () => loader.abort();
        this.destroy = () => loader.destroy();
        this.load = (context, config, callbacks) => {
          let {url} = context;
          console.log(`loader ${url} will be loaded.`);
          loader.load(context, config, 'chunk', p2pManager, storage, controlTimeout , callbacks);
        };
      }
    },
  });


  // get media engine: html5 on iOS and version HLS on platform supported hls
  mediaEngine = "hlsjs "+ Clappr.HLS.HLSJS.version

  var osString = String(platform.os);
  if(osString.includes("iOS")){
    mediaEngine = "html5"
  }

  // Handle fragment loaded calculate information of chunk to interval report
  player.core.getCurrentPlayback().on(Clappr.Events.PLAYBACK_FRAGMENT_LOADED,function(data){
    
    let chunkTime = Math.round(data.frag.duration); // get chunk time
    controlTimeout.setChunkTime(chunkTime);  // set to controller

    var senderInfo,speed;

    // get sender and speed CDN/P2P
    if(data.networkDetails.sender === undefined){
      senderInfo = " CDN"
      speed = Math.round(data.networkDetails.size*8/1024/(data.networkDetails.timeCDN)*1000)
    } else {
      speed = Math.round(data.networkDetails.size*8/1024/(data.networkDetails.timeP2P)*1000)
      senderInfo = data.networkDetails.sender
    }

    if(p2pManager === undefined){
      peers = []
    } else {
      peers = p2pManager.swarm.utils.peers
    }


    dataAnalysis(data) // calculate fragment data: time, size, ...

    // View in client
    chatArea.innerHTML = "P2P ID: "+ peerID + ".<br />Swarm ID: test<br />" 
                      + "CDN chunk number:" + dataMsg.myCDN + "<br />" 
                      + "P2P chunk number:" + dataMsg.myP2P + "<br />"
                    //  + JSON.stringify(p2pstats) + "<br />"
                      + "Level: " + data.frag.level + ". TimeP2P: " + data.networkDetails.timeP2P + ". Time CDN: " + data.networkDetails.timeCDN + "<br />"
                      + "Chunk:" + data.networkDetails.chunk + ". Size: " + Math.round(data.networkDetails.size /1024) + "kB" +"<br />"
                      +"Sender: "+ senderInfo +"<br />Speed: " + speed + " kbps<br />"
                      + "------------------"+ dataMsg.numPeer +" peers----------------<br />"
                      + "CDN chunk number:" + dataMsg.allCDN + " : " + Math.round(dataMsg.allCDN*100/(dataMsg.allCDN + dataMsg.allP2P)) + "%<br />" 
                      + "P2P chunk number:" + dataMsg.allP2P + " : " + Math.round(dataMsg.allP2P*100/(dataMsg.allCDN + dataMsg.allP2P)) + "%<br />";
  })

  /*player.core.getCurrentPlayback().on(Clappr.Events.PLAYBACK_LEVEL_SWITCH,function(data){
    data = Object.assign({}, data, {url:player.core.getCurrentPlayback()._hls.url})
    console.log("Level switching: ",data)
    currentLevel = data.level
    if (tokenExit !== undefined){
      // Change level: Exit room then rejoining
      var xhrLevelChange = new XMLHttpRequest();  
      xhrLevelChange.open('POST', Settings.httpServerExit, true);
      xhrLevelChange.responseType = "text"
      xhrLevelChange.onreadystatechange = function(){
        if(xhrLevelChange.readyState == 4 && xhrLevelChange.status == 200) {
          console.log(xhrLevelChange.responseText)
          if(xhrLevelChange.responseText === 'OK'){
            closeDataChannel()
            sendJoining(data)
          }
        }
      }
      xhrLevelChange.send(JSON.stringify({
        customerid:customerID,
	      swarmid:swarmID,
	      token:tokenExit,
	      clientid:peerID
      }))
    }
    else{
      // Start stream: Create customer ID and joining room
      customerID =  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      sendJoining(data)
    }
  })

*/

}

/*
  Send interval report 
 */
function sendReport(ext = null){
  var report = storage.showReport()
  var data

  // get data between 2 report times
  if(prevReport !== undefined){
    data = {
      cdn_num:report.numCDN - prevReport.numCDN,
      p2p_num:report.numP2P - prevReport.numP2P,
      // cdn:report.sizeCDN - prevReport.sizeCDN,
      // p2p:report.sizeP2P - prevReport.sizeP2P,
      // upload_num:report.numUpload - prevReport.numUpload,
      // upload:report.sizeUpload - prevReport.sizeUpload,
      // p2p_fail:report.failP2P - prevReport.failP2P,
      // cdn_fail:report.failCDN - prevReport.failCDN
    }
  }
  else{
    data = {
      cdn_num:report.numCDN,
      p2p_num:report.numP2P,
      // cdn:report.sizeCDN,
      // p2p:report.sizeP2P,
      // upload_num:report.numUpload,
      // upload:report.sizeUpload,
      // p2p_fail:report.failP2P,
      // cdn_fail:report.failCDN 
    }
  }
  prevReport = report;

  // // average time = 0 when no chunk downloaded
  // if (timeCDN.length === 0){
  //   timeCDN.push(0)
  //   speedCDN.push(0)
  // }

  // if (timeP2P.length === 0){
  //   timeP2P.push(0)
  //   speedP2P.push(0)
  // }

  // data = Object.assign({}, data, {p2p_time:Math.round(lodash.mean(timeP2P)), cdn_time:Math.round(lodash.mean(timeCDN))});
  // data = Object.assign({}, data, {p2p_speed:Math.round(lodash.mean(speedP2P)), cdn_speed:Math.round(lodash.mean(speedCDN))});
  // data = Object.assign({}, data, {peers:peers, customer_id:customerID});
  // data = Object.assign({}, data, {clientid:peerID, cur_level:currentLevel});
  // data = Object.assign({}, data, {mediaEngine:mediaEngine, platform:platform.description});
  // timeP2P = []
  // timeCDN = []
  // speedCDN = []
  // speedP2P = []
  // var xhr = new XMLHttpRequest();  
  // xhr.open('POST', Settings.httpServerReport1, true);
  // xhr.responseType = "text"
  // xhr.onreadystatechange = function(){
  //   // Handle when server offer client change room
  // 	if(xhr.readyState == 4 && xhr.status == 200) {
      
  //     if(xhr.responseText !== 'OK'){
  //       var reJoinInfo = JSON.parse(xhr.responseText)
  //       // Send exit
  //       var xhrExit = new XMLHttpRequest()
  //       xhrExit.open('POST',Settings.httpServerExit,true)
  //       xhrExit.responseType = 'text'

  //       xhrExit.onreadystatechange = function(e){
  //         if(xhrExit.readyState == 4 && xhrExit.status == 200) {
  //           if(xhrExit.responseText == 'OK'){
  //             closeDataChannel()
  //             // update swarm and peer ID
  //             swarmID = reJoinInfo.swarmid 
  //             peerID = createP2P(reJoinInfo.swarmid,reJoinInfo.signalingurl, Settings.ice)
  //             sendReportJoining(reJoinInfo)

  //           }
  //         }
  //       }

  //       xhrExit.send(JSON.stringify({
  //         customerid:customerID,
  //         swarmid:swarmID,
  //         token:tokenExit,
  //         clientid:peerID
  //       }))
  //     }
  //   }
  // }
  // // console.log(data)
  // //xhr.send(JSON.stringify(data))

  // Send report to show on client browser
  var xhr2 = new XMLHttpRequest();  
  xhr2.open('POST', Settings.httpServerReport2, true);
  
  xhr2.responseType = "text"
  xhr2.onreadystatechange = function(){
    // console.log(xhr)
  	if(xhr2.readyState == 4 && xhr2.status == 200) {
        dataMsg = JSON.parse(xhr2.responseText)
    }
  }
  var data2 = {peer_id: peerID, cdn_num: data.cdn_num, p2p_num: data.p2p_num}
  // console.log(data2)
  xhr2.send(JSON.stringify(data2))
 }


 // Push time and speed to calculate average 
function dataAnalysis(data){
  currentLevel = data.frag.level
  if (data.networkDetails.timeCDN === 0){
    storage.P2PChunk(Math.round(data.networkDetails.size/1024))
    timeP2P.push(data.networkDetails.timeP2P) // ms
    speedP2P.push(data.networkDetails.size/1024/data.networkDetails.timeP2P*1000)  // kBps
  }
  else if (data.networkDetails.timeCDN > 0){
    storage.CDNChunk(Math.round(data.networkDetails.size/1024))
    timeCDN.push(data.networkDetails.timeCDN)
    speedCDN.push(data.networkDetails.size/1024/data.networkDetails.timeCDN*1000)  // kBps
  }
}

// Send joining request
function sendJoining(data){  // not use
  /*console.log({
    streamurl:data.url,
    customerid:customerID,
    protocolversion:"v0.1",
    href:"4",
    mediaengine:mediaEngine,
    platform:platform.description,
    level:String(data.level),
    
  })*/
  var xhrJoining = new XMLHttpRequest();  
  xhrJoining.open('POST', Settings.joiningServer, true);
  xhrJoining.responseType = "text"
  xhrJoining.onreadystatechange = function(){
    // Handle response of joining request
    if(xhrJoining.readyState == 4 && xhrJoining.status == 200) {
        // console.log(xhr.responseText)
        var joiningInfo = JSON.parse(xhrJoining.responseText)
        // console.log(joiningInfo)
        if(mediaEngine !== "html5"){
          peerID = createP2P(joiningInfo.swarmid, joiningInfo.signalingurl,Settings.ice)
          swarmID = joiningInfo.swarmid
          sendReportJoining(joiningInfo)
        }
        else{
          console.log("Not create P2P")
        }
    }
  
  }
  
  // send request joining
  xhrJoining.send(JSON.stringify({
    streamurl:data.url,
    customerid:customerID,
    protocolversion:"v0.1",
    href:"4",
    mediaengine:mediaEngine,
    platform:platform.description,
    level:String(data.level),
    
  }))
}



// Send exit signal when leave page (close tab, back or reload) (not use)
$(window).on('beforeunload', function (event){

  var xhrExit = new XMLHttpRequest()
  xhrExit.open('POST',Settings.httpServerExit,true)
  xhrExit.responseType = 'text'
  xhrExit.send(JSON.stringify({
    customerid:customerID,
    swarmid:swarmID,
    token:tokenExit,
    clientid:peerID
  }))
  event.stopPropagation()
  sleep(100)
  return undefined
});


// Create data channel with room
// iceServers: 
function createP2P(id_room, signaling, iceServers){
  // create p2pManager
  p2pManager = new P2PManager({room:id_room, iceServers:iceServers, signaling:Settings.signalingServer})
  return p2pManager.getmyID()
}

// Close datachannel
function closeDataChannel(){
  if(p2pManager !== undefined){
    p2pManager.removeDataChannel()
  }
}

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

// not use
function sendReportJoining(joiningInfo){
  var xhrJoiningReport = new XMLHttpRequest();  
  xhrJoiningReport.open('POST', Settings.joiningReportServer, true);
  xhrJoiningReport.responseType = "text"
  xhrJoiningReport.onreadystatechange = function(){

    // Report joining successful or fail
    if(xhrJoiningReport.readyState == 4 && xhrJoiningReport.status == 200){
      let resJoinReport = JSON.parse(xhrJoiningReport.responseText)
      console.log(resJoinReport)
      // Update token to exit
      tokenExit = resJoinReport.token
      sendReport()
    }
  }
  // send report joining
  xhrJoiningReport.send(JSON.stringify({
    customerid:customerID,
    swarmid:swarmID,
    token:joiningInfo.token, // send joining token to report then receive exit token
    clientid:peerID
  }))
}
