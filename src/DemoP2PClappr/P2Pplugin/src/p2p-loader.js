/**
 * XHR (XMLHttpRequest) based logger
*/

var Base64 = require('./js/base64-binary')
var _ = require('underscore')
const { performance, XMLHttpRequest } = window;
var startCDN, startP2P, timeP2P;

// When has URL's chunk, generated P2P loader (custom loader config for HLSJS) 
// and call method load.
class P2PLoader {

  constructor (config) {
    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  destroy () {
    this.abort();
    this.loader = null;
  }

  abort () {
    let loader = this.loader;
    if (loader && loader.readyState !== 4) {
      this.stats.aborted = true;
      loader.abort();
    }

    window.clearTimeout(this.requestTimeout);
    this.requestTimeout = null;
    window.clearTimeout(this.retryTimeout);
    this.retryTimeout = null;
  }

  /**
   * Check p2p connection. If not has connection: downloadd from CDN, else download from P2P (if can)
   * @param {*} context URL of chunk
   * @param {*} config Config of timeout download CDN
   * @param {*} p2pManager P2P protocol
   * @param {*} storage Store downloaded chunk
   * @param {*} controlTimeout Update download time to update timeout
   * @param {*} callbacks 
   */
  load (context, config, type, p2pManager, storage, controlTimeout, callbacks) {
    this.type = type;
    if(p2pManager !== undefined) { // not p2p connection
      this.p2pManager = p2pManager;
    }
      
    this.context = context;
    this.controlTimeout = controlTimeout;
    this.config = config;
    this.callbacks = callbacks;
    this.storage = storage;
    this.stats = { trequest: performance.now(), retry: 0 };
    this.retryDelay = config.retryDelay;

    if (p2pManager === undefined || this.type === 'list') {
      // Using HLS protocol to request chunk from CDN
      this.loadInternal();
    }
    else {
      if(_.size(this.p2pManager.swarm.utils.contributors)===0){ // not has connected peers
        // Using HLS protocol to request chunk from CDN
        this.loadInternal();
      }
      else{ // start P2P
        startP2P = Date.now();
        let stats = this.stats;
        stats.tfirst = 0;
        stats.loaded = 0;
        //this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), this.config.timeout);
        
        this.resource = this.context.url.split('_').pop(); // Get URL trunk
        // p2pManager using swarm send message "interest" to peer partner
        // if sucess: callback this.receiveP2p, fail: callback receivedCDN 
        this.p2pManager.requestResource(this.resource, this.receiveP2P.bind(this), this.receiveCDN.bind(this));
      }
    }
    // console.log(this.context.url)
  }

  ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
  }

  /**
   * Fail callback of P2P requester. Then, request to CDN
   * @param {*} res URL of chunk
   * @param {*} methodFail Why p2p fail
   */
  receiveCDN(res, methodFail){
    if(methodFail === "requestTimeout"){
      this.storage.requestFailFunc()
    }
    console.log("Time:", Date.now(), '. Fail request P2P', res)
    
    timeP2P = Date.now()-startP2P;
    this.loadInternal(); // Request CDN
  }

  /**
   * Success callback of P2P requester, Then, callback success 
   * @param {*} chunk data of chunk
   * @param {*} method p2p
   * @param {*} resource URL of chunk
   * @param {*} sender Who sended chunk
   */
  receiveP2P(chunk, method, resource, sender){
    
    console.log("Time:", Date.now(), ". Method: ", method, ". Sender: ", sender, resource)
    
    let context = this.context;
    let data = Base64.decodeArrayBuffer(chunk)

    // store trunk
    this.storage.setItem('p2p', resource, chunk, data.byteLength);
    
    let response;

    if(this.type === 'chunk'){
      response = {url: context.url, data: data};
    } else{
      response = {url: context.url, data: this.ab2str(data)}
    }
    
    let stats = this.stats;

    if (stats.tfirst === 0) {
      stats.tfirst = Math.max(performance.now(), stats.trequest);
    }

    stats.tload = Math.max(stats.tfirst, performance.now());
    stats.loaded = stats.total = data.byteLength;

    timeP2P = Date.now() - startP2P;
    let detail = {chunk:resource, sender:sender, size:data.byteLength, timeP2P:timeP2P, timeCDN:0}
    let sleepTime = this.controlTimeout.getChunkTimeDelayP2P() - timeP2P
    
    setTimeout(
      function(){
        this.callbacks.onSuccess(response, stats, context,detail)
      }.bind(this),sleepTime);
    timeP2P = 0;
  }

  /**
   * Using HLS protocol to request chunk from CDN
   */
  loadInternal () {
    startCDN = Date.now();
    let xhr, context = this.context;
    xhr = this.loader = new XMLHttpRequest();
    
    let stats = this.stats;
    stats.tfirst = 0;
    stats.loaded = 0;
    const xhrSetup = this.xhrSetup;

    try {
      if (xhrSetup) {
        try {
          xhrSetup(xhr, context.url);
        } catch (e) {
          // fix xhrSetup: (xhr, url) => {xhr.setRequestHeader("Content-Language", "test");}
          // not working, as xhr.setRequestHeader expects xhr.readyState === OPEN
          xhr.open('GET', context.url, true);
          xhrSetup(xhr, context.url);
        }
      }

      if (!xhr.readyState) {
        xhr.open('GET', context.url, true);
      }
    } catch (e) {
      // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
      this.callbacks.onError({ code: xhr.status, text: e.message }, context, xhr);
      return;
    }

    if (context.rangeEnd) {
      xhr.setRequestHeader('Range', 'bytes=' + context.rangeStart + '-' + (context.rangeEnd - 1));
    }

    xhr.onreadystatechange = this.readystatechange.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.responseType = context.responseType;

    // setup timeout before we perform request
    this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), this.config.timeout);
    // send request
    xhr.send(); 
     
  }

  /**
   * Received request response: get chunk and callback success to server CDN
   * @param {*} event 
   */
  readystatechange (event) {
    let xhr = event.currentTarget,
      readyState = xhr.readyState,
      stats = this.stats,
      context = this.context,
      config = this.config;

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // >= HEADERS_RECEIVED
    if (readyState >= 2) {
      // clear xhr timeout and rearm it if readyState less than 4
      //console.log(Date.now(),'clear timeout');
      window.clearTimeout(this.requestTimeout);
      clearTimeout(this.requestTimeout);
      this.requestTimeout = null;

      if (stats.tfirst === 0) {
        stats.tfirst = Math.max(performance.now(), stats.trequest);
      }

      if (readyState === 4) {   
        let status = xhr.status;
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300) {
          stats.tload = Math.max(stats.tfirst, performance.now());
          
          let data, len;
          // console.log("context", context);
          if (context.responseType === 'arraybuffer') {
            // Get trunk data
            data = xhr.response;
            len = data.byteLength;
          } else {
            data = xhr.responseText;
            len = data.length;
          }

          stats.loaded = stats.total = len;

          var responseTmp = { url: xhr.responseURL, data: data },response;
          let file_ext = xhr.responseURL.split('.').pop();

          if ((file_ext === 'ts')){
            response = responseTmp;
            var resource = xhr.responseURL.split('_').pop();
            console.log('time: ',Date.now(),'. From cdn: ',resource);
            
            this.storage.setItem('cdn', resource, Base64.base64ArrayBuffer(data), data.byteLength); // store trunk 
            let timeCDN = Date.now() - startCDN; // calculated time download trunk from CDN 
            var detail = {chunk:resource, sender:undefined, size:data.byteLength, timeP2P:timeP2P, timeCDN:timeCDN}
            this.controlTimeout.updateTimeout(timeCDN);
            timeCDN = 0; timeP2P = 0;

            // P2PLoader.p2p = false

          }else{
            response = responseTmp;        
          }

          this.callbacks.onSuccess(response, stats, context, detail);
          
          
        } else {
          console.log('else xhr loader')
          // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
          if (stats.retry >= config.maxRetry || (status >= 400 && status < 499)) {
            
            this.callbacks.onError({ code: status, text: xhr.statusText }, context, xhr);
          } else {
            // retry
            // aborts and resets internal state
            this.destroy();
            // schedule retry
            this.retryTimeout = window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // set exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, config.maxRetryDelay);
            stats.retry++;
          }
        }
      } else {
        // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
        this.requestTimeout = window.setTimeout(this.loadtimeout.bind(this), config.timeout);
      }
    }
  }

  /**
   * CDN Request timeout, re-request
   */
  loadtimeout () {
    this.storage.cdnFail()
    console.log("Time: ", Date.now(), 'load timeout');
    this.callbacks.onTimeout(this.stats, this.context, null);
  }

  loadprogress (event) {
    let xhr = event.currentTarget,
      stats = this.stats;

    stats.loaded = event.loaded;
    if (event.lengthComputable) {
      stats.total = event.total;
    }

    let onProgress = this.callbacks.onProgress;
    if (onProgress) {
      // third arg is to provide on progress data
      onProgress(stats, this.context, null, xhr);
    }
  }
}

module.exports=P2PLoader