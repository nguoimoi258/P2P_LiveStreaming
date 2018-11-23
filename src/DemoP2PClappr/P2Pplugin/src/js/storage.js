var _ = require('underscore')
var Settings = require('../setting')
var Base64 = require('./base64-binary')

/**
 * Create storage to store chunk (urls and chunks)
 * Statistic number of CDN chunk, P2P chunks and its size (numP2P, numCDN, sizeP2P, sizeCDN)
 * Statistic number of upload (numUpload, sizeUpload) and number of fail download of CDN and P2P (cdn_fail, requestFail)
 */
class Storage{

    constructor(){
        
        this.urls = []
        this.chunks = {}
        
        this.numP2P = 0
        this.numCDN = 0
        
        this.sizeP2P = 0 //byte, size download from P2P 
        this.sizeCDN = 0 //byte, size donwload from CDN
        
        this.numUpload = 0
        this.sizeUpload = 0
        
        this.requestFail = 0
        this.cdn_fail = 0
        //setInterval(this.showStorage.bind(this),5000);
    }

    /**
     * Increase number of CDN download failure when CDN has timeouted
     */
    cdnFail(){
        this.cdn_fail += 1
    }

    /**
     * Increase number of P2P download failure when P2P has request timeouted
     */
    requestFailFunc(){
        this.requestFail += 1
    }

    /**
     * Increase number of CDN downloaded
     */
    CDNChunk(size){
        this.numCDN += 1
        this.sizeCDN += size
    }

    /**
     * Increase number of P2P downloaded
     */
    P2PChunk(size){
        this.numP2P += 1
        this.sizeP2P += size
    }

    /**
     * get size of storage
     */
    size(){
        return this.urls.length
    }
    
    showStorage(){
        console.log("Storage", this.urls)
    }

    /**
     * Send report to report to interval
     */
    showReport(){
        return { numCDN : this.numCDN,
                numP2P : this.numP2P, 
                sizeCDN : this.sizeCDN, 
                sizeP2P : this.sizeP2P,
                numUpload : this.numUpload, 
                sizeUpload : this.sizeUpload/1024,
                failP2P : this.requestFail, 
                failCDN : this.cdn_fail}
    }

    /**
     * Return true if chunk is in storage, if not return false
     * @param {*} url URL of chunk need check
     */
    contain(url){
        return _.contains(this.urls, url)
    }

    /**
     * Return chunk data of resource
     * Increase number of upload chunk
     * @param {*} resource URL of chunk need getting
     */
    getItem(resource){ // &&
        this.numUpload += 1
        this.sizeUpload += Base64.decodeArrayBuffer(this.chunks[resource]).byteLength
        return this.chunks[resource]
    }

    setItem(type, url, value, size){ // &&
        //this.showStorage()
        if(_.has(this.chunks, url)){
            console.log("Already have chunk")
            this.chunks[url] = value
        }
        else{
            // if (type === 'p2p'){ 
            //     this.P2PChunk()
            //     this.sizeP2P += size
            // }
            // else if(type === 'cdn'){
            //     this.CDNChunk()
            //     this.sizeCDN += size
            // }
            this.urls.push(url)
            this.chunks[url] = value 
            this.updateSize()
        }
    }

    updateSize(){ //&&
        if(this.size() > Settings.numberChunkCache){
            this.removeOldItem()
        }
    }

    removeOldItem(){ // &&
        var url = this.urls.splice(0,1)[0];
        delete this.chunks[url]
    }
}

/**
 * Get instance of storage, not create new storage when call of others location
 */
Storage.getInstance = function() {
    if (this._instance === undefined) {
        this._instance = new this();
    }
    return this._instance;
}

module.exports=Storage