var Storage = require('./storage')
//var md5 = require('./md5')

class Peer{

    constructor(params){ 

        this.ident = params.ident // peerId 
        this.dataChannel = params.dataChannel
        this.swarm = params.swarm

        this.dataChannel.on('data', (data) => {
            // process msg arrived to peer
            this.messageReceived(data)
        })

        this.dataChannel.on('closed', () => { 
            console.log("Datachannel closed!") 
        })

        this.score = 100
        this.storage = Storage.getInstance()
        
        this.active = false

        this.sendPing()
    }

    sendPing() { // && ping msg contains 2048 char x
        this.pingSent = Date.now()
        this.dataChannel.send("ping$$" + (new Array(2 * 1024)).join("x"))
        console.log("Peer send ping with 2048 charecter x")
    }

    sendPong() {
        this.dataChannel.send("pong$$")
        console.log("Peer send pong")
    }

    pongReceived() {
        var rtt = Date.now() - this.pingSent // time send pong - time send ping 
        this.active = true
        this.score -= Math.ceil(rtt / 100)
        console.log('join with PeerId: ' + this.ident + " (rtt: " + rtt + ")"  + " (score: " + this.score + ")")
    }

    messageReceived(data){
        var [command,resource,content] = data.split('$')
        switch(command){
          case 'interest':
            this.interestedReceived(resource)
            break
          case 'ping':
            this.sendPong()
            break
          case 'pong':
            this.pongReceived()
          case 'choke':
            //console.log('chock from ',this,":",resource)
            this.swarm.chokeReceived(resource)
            break
          case 'contain':
            //console.log('contain from ',this,":",resource)
            this.swarm.containReceived(this, resource)
            break
          case 'request':
            this.sendSatify(resource)
            break
          case 'satisfy':
            //console.log('check md5')
            if(content.length > 0){
                //console.log('md5 success')
                this.swarm.satisfyReceived(this, resource, content)
            }
            break
        }
    }

    interestedReceived(resource){
        //console.log("Resource:",resource)
        //this.storage.showStorage()
        
        // check storage contain url trunk 
        if (this.storage.contain(resource)){
            // simplyfied by don't check slot
            //console.log('Send contain from : ', this.ident, "Resource: ",resource)
            this.send('contain', resource)
        }
        else{
            //console.log('Send choke from : ', this.ident, "Resource: ",resource)
            this.send("choke", resource)
        }
    }

    send(command, resource, content=''){
        var message = this.mountMessage(command, resource, content)
        var messageLog = this.mountMessage(command, resource)
        console.log("Peer send msg: ", messageLog)
        this.dataChannel.send(message)
    }

    mountMessage(command, resource, content){
        var msg = command + "$" + resource + "$"
        if(content){
            msg = msg + content
        }
        return msg
    }

    sendSatify(resource){
        if(this.storage.contain(resource)){
            var content = this.storage.getItem(resource)
            this.send('satisfy', resource, content)
        }
        else
            this.send('choke', resource)
    }
}

module.exports = Peer