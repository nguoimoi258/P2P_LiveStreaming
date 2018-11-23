var _ = require('underscore')
var Settings = require('../setting')

class SwarmUtils{

    constructor(swarm){
        this.swarm = swarm
    }

    /**
     * Return set of connected peers
     */
    get peers(){
        var peerIDs = [],x
        if(_.size(this.swarm.peers) === 0)
            return []
        for (x in this.swarm.peers)
            peerIDs.push(this.swarm.peers[x].ident)
        
        return peerIDs
    }

    /**
     * Return Settings.maxContributors of connected peers having highest score to send interest
     */
    get contributors(){
        var activePeers = _.filter(this.swarm.peers, function(p){ return p.active})
        var orderedPeers = _.sortBy(activePeers, function(p){return p.score}).reverse()

        if(_.size(orderedPeers) > Settings.maxContributors){
            return orderedPeers.slice(0,Settings.maxContributors)
        }
        else{
            return orderedPeers
        }
    }

    /**
     * Return peer with id
     * @param {*} idPeer 
     */
    findPeer(idPeer){
        return _.find(this.swarm.peers, function(p){ return (p.ident === idPeer)}, this)
    }


    electSender(satifyCandidates){
        return _.first(_.sortBy(satifyCandidates,function(p){ return p.score}).reverse())
    }

    incrementScore(peers) {
        this.changeScore(peers, Settings.points)
    }

    decrementScore(peers) {
        this.changeScore(peers, Settings.points * -1)
    }

    changeScore(peers, points) {
        _.each(peers, function(peer) { peer.score += points }, this)
    }
}

module.exports=SwarmUtils