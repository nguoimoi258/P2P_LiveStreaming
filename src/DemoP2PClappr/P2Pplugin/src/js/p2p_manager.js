var _ = require('underscore')
var QuickConnect = require('rtc-quickconnect')
var Swarm = require('./swarm')
var Settings = require('../setting')

/**
 * P2P manage p2p connection and create datachannel
 */
class P2PManager{
    
    constructor(params){
        console.log('P2P manager created!', params)
        this.connectConfig = {room:params.room, iceServers:params.iceServers} // room and ice server
        
        var tracker = params.signaling // signaling
        console.log("Signaling: ");
        console.log(tracker, this.connectConfig)

        this.connection = QuickConnect(tracker, this.connectConfig)

        this.myID = this.connection.id // p2p id ??
        
        this.swarm = new Swarm() // create swarm
        this.dataChannel = this.connection.createDataChannel('test')  // create datachannel "test"
        this.setupListener()
    }

    /**
     * End calls: Disconnection without disconnect signaling
     */
    removeDataChannel(){ // &&
        this.dataChannel.close()
    }
    
    /**
     * Setup listeners: open-datachannel and close-datachannel
     */
    setupListener(){ 
        this.dataChannel.on('channel:opened:test', (id, dataChannel) => {
            // Listen event channel open 
            // mean has peer connect to channel 'test'. 
            // if statisfying conditions add peer to swarm
            this.onChannelOpened(id, dataChannel)
        }) 
        
        this.dataChannel.on('channel:closed:test', (id, dataChannel) => {
            // Listen event channel closed
            // mean has peer disconnect to channel 'test'
            // remove peer in swarm
            this.onChannelClosed(id, dataChannel)
        })
    }

    /**
     * Data channel opened, means has peer connect to. Add peer to swarm
     * @param {*} id id of partner peer
     * @param {*} dataChannel 
     */
    onChannelOpened(id, dataChannel) {
        console.log('Open peer: ',id)
        if (this.swarm.size() <= Settings.maxSwarmSize) {
            this.swarm.addPeer(id, dataChannel)
        } else {
            console.log("ignoring new peer, maxSwarmSize reached!")
        }
    }
    
     /**
     * Partner peer disconnect, Remove partner peer from swarm
     * @param {*} id id of partner peer
     * @param {*} dataChannel 
     */
    onChannelClosed(id,dataChannel) {
        console.log('Remove peer: ',id)
        this.swarm.removePeer(id)
    }

    /**
     * Return p2p id
     */
    getmyID(){
        return this.myID
    }

    /**
     * Update room when changing room
     * @param {*} data {room:room} room id
     */
    updateInfo(data){
        this.connection.profile(data) // Update room in profile
        // this.connection.join()
        // this.dataChannel = this.connection.createDataChannel('test') // re-create datachannel
        // this.setupListener()
        // this.myID = this.connection.id
    }

     /**
     * Request URL from P2P
     * @param {*} resource chunk URL
     * @param {*} callbackSuccess callback success
     * @param {*} callbackFail callback fail
     */
    requestResource(resource, callbackSuccess, callbackFail){
        if (_.size(this.swarm.utils.contributors) === 0) {
            console.log('request resource fail')
            callbackFail()
          } else {
            this.swarm.sendInterested(resource, callbackSuccess, callbackFail) // swarm send interest
          }
    }
}

module.exports=P2PManager