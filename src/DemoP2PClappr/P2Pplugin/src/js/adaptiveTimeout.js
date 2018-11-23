/**
 * Adaptive timeout for request peer to peer
 */

class AdaptiveTimeout{
    
    constructor(){
        this.timeoutForInterest = 100   //initial interest timeout
        this.timeoutForRequest = 1500   // initial request timeout
        this.timeChunk = 2000           // initial chunk time
        this.minTimeOutRequest = 1000   // init min request timeout
    }

    /**
     * Return interest timeout
     */
    getTimeoutForInterest(){
        return this.timeoutForInterest
    }

    /**
     * Return request timeout
     */
    getTimeoutForRequest(){
        return this.timeoutForRequest
    }

    /**
     * Update request timeout from previous chunk download time 
     * @param {*} timeCDN previous chunk download time
     */
    updateTimeout(timeCDN){
        this.timeoutForRequest = ((this.timeChunk - timeCDN - 100) <= this.minTimeOutRequest) ? this.minTimeOutRequest : (this.timeChunk - timeCDN - 100)
        console.log('Update: ',this.timeoutForRequest)
    }

    /**
     * Update chunk time after receive fragment
     * @param {*} timeChunk chunk time
     */

    setChunkTime(timeChunk){
        this.timeChunk = timeChunk*1000
        this.minTimeOutRequest = Math.round(this.timeChunk * Settings.ratioMinRequestTimeout)
    }

    getChunkTimeDelayP2P(){
        return this.timeChunk
    }
}

AdaptiveTimeout.getInstance = function() {
    if (this._instance === undefined) {
        this._instance = new this();
    }
    return this._instance;
}

module.exports=AdaptiveTimeout