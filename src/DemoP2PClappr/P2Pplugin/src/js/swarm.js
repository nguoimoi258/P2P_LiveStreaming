var _ = require('underscore')
var BufferedChannel = require('../rtc-bufferedchannel')
var SwarmUtils = require('./swarm_utils')
var Peer = require('./peer')
var Settings = require('../setting')
var AdaptiveTimeout = require('./adaptiveTimeout')

/**
 * Manage partner peers
 * Send interest and request 
 * Receive and handle signal from partner peers
 */
class Swarm{

    constructor(){ //&&
        console.log('Swarm created! abc')
        this.utils = new SwarmUtils(this)
        this.adaptiveTimeout = AdaptiveTimeout.getInstance()
        this.peers = []
        this.sender = undefined
        this.satifyCandidate = []
        this.chockedClient = 0
    }

    /**
     * Return number of partner peers
     */
    size(){
        return _.size(this.peers)
    }

    /**
     * Create buffered channel then add partner peer when connected 
     * @param {*} id id of partner peer
     * @param {*} channel 
     */
    addPeer(id, channel){
        // BufferedChannel works by wrapping a standard "RTCDataChannel"
        // channel: dc, datachannel connect to signaling
        var bufferedChannel = BufferedChannel(channel)  

        var peer = new Peer({ ident : id, 
                            dataChannel : bufferedChannel, 
                            swarm : this})

        this.peers.push(peer)
    }

    /**
     * Remove partner peer when disconnected
     * @param {*} id id of partner peer
     */
    removePeer(id){ 
        var peer = this.utils.findPeer(id)
        this.peers = _.without(this.peers, peer)

        try {
            this.callbackFail("remove peer failed")
        } catch(e) {
            console.log("Removed peer")
        }
    }

    /**
     * Send chunk URL interest to connected peers 
     * @param {*} resource chunk URL
     * @param {*} callbackSuccess 
     * @param {*} callbackFail 
     */
    sendInterested(resource, callbackSuccess, callbackFail){ // &&
        this.currResource = resource
        this.extCallbackSuccess = callbackSuccess
        this.extCallbackFail = callbackFail
        this.firstContain = true
        var timeout = this.adaptiveTimeout.getTimeoutForInterest()
        //console.log('timeout for interest',timeout)
        // if(this.sender)
        //      this.interestTimeoutID = setTimeout(this.sendRequest.bind(this),timeout + 100)
        // else{
        this.interestTimeoutID = setTimeout(this.interestFinish.bind(this), timeout)
        
        this.sendTo('contributors', 'interest', resource) // send interest
        
        // }
    }

    /**
     * Send to peers
     * If recipient is contributors: send interest to 10 contributors
     * @param {*} recipients target peer
     * @param {*} command type of signal
     * @param {*} resource chunk URL
     * @param {*} content data
     */
    sendTo(recipients, command, resource, content=''){
        if(recipients === 'contributors'){
            _.each(this.utils.contributors, function(peer){
                peer.send(command, resource, content)
            },this)
        }
        else{
            var peer = this.utils.findPeer(recipients)
            if (peer)
                peer.send(command, resource, content)
        }
    }

    /**
     * Callback fail when interest is timeout that don't received any contain signal
     */
    interestFinish(){ // &&
        this.callbackFail("interest finished")
    }

    /**
     * Send chunk data request to partner peerIdent
     * @param {*} peerIdent partner id to send request
     */
    sendRequest(){ // &&
        //console.log('send request to ',this.sender,":",this.currResource)
        var timeout = this.adaptiveTimeout.getTimeoutForRequest()
        //console.log('timeout for request',timeout)
        this.requestFailTimeoutID = setTimeout(this.callbackFail.bind(this), timeout, "timeoutRequest")
        this.sendTo(this.sender, 'request', this.currResource)
    }

    callbackFail(tmOut = null){ // &&
       // console.log('Callback fail')
        this.utils.decrementScore(this.utils.contributors)
        clearTimeout(this.interestTimeoutID)
        clearTimeout(this.requestFailTimeoutID)
        this.rebootRoundVars()
        this.sender = undefined
        if (tmOut === "timeoutRequest")
            this.extCallbackFail(this.currResource, "requestTimeout")
        else
            this.extCallbackFail(this.currResource, "other")
    }
    
    rebootRoundVars(){
        //this.currResource = undefined
        this.chockedClient = 0
        this.satifyCandidate = []
    }

    clearRequestFailInterval(){ // &&
        clearInterval(this.requestFailTimeoutID)
        this.requestFailTimeoutID = 0
    }

    chokeReceived(resource){ // && 
        // if(this.currResource === resource) // 1 peer doesn't have resource
        //     this.chockedClient += 1
        // if(this.chockedClient === _.size(this.utils.contributors)){ // if all of contributors are choked
        //     console.log('Chock overload')
        //     this.chockedClient = 0
        //     clearTimeout(this.interestTimeoutID)
        //     this.clearRequestFailInterval()
        //     this.callbackFail()
        // }
    }
   
     /**
     * Receive Settings.numberRequest contains then send request
     * @param {*} peer peer ident
     * @param {*} resource Chunk URL
     */
    containReceived(peer, resource){ // &&
        if(resource == this.currResource && this.firstContain){
            clearTimeout(this.interestTimeoutID)
            this.firstContain = false;
            console.log("Time:", Date.now(), peer.ident + 'has trunk, send request to it') 
            
            this.sender = peer.ident
            this.sendRequest()
        }
    }

    /**
     * Receive data from partner peer, callback success
     * @param {*} peer sender
     * @param {*} resource URL
     * @param {*} chunk chunk data
     */
    satisfyReceived(peer, resource, chunk){ // &&
        if(this.sender === peer.ident && this.currResource == resource){
            this.extCallbackSuccess(chunk, 'p2p', resource, this.sender)
            this.clearRequestFailInterval()
            clearTimeout(this.interestTimeoutID)
            this.updatePeersScore()
            this.rebootRoundVars()
        }
    }

    updatePeersScore(){  //increse score of peers having resource, decrease score of peers not having, double sender score
        var sucessPeer = this.utils.findPeer(this.sender)
        var goodPeer = _.union([sucessPeer], this.satifyCandidate)
        var badPeer = _.difference(this.utils.contributors, goodPeer)
        this.utils.decrementScore(badPeer)
        this.utils.incrementScore(goodPeer)
        this.utils.incrementScore([sucessPeer])
    }
}

module.exports=Swarm