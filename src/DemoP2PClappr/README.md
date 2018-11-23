# Clappr p2p
## Build plugin
```sh
$ cd P2PPlugin
$ npm install # install dependences
$ npm run build 
```
Bundle file is stored in dist folder

## Live stream
Copy bundle file built to dist folder
```sh
$ npm install express
$ node index
```
## Modify setting
Open file ../P2PPlugin/setting.js
Some setting:
- **SignalingServer**: Signaling server for webRTC 
- **maxSwarmSize**: Maximum number of peers on each swarm
- **maxContributors**: Number of peers that swarm sends interest message
- **numberChunkCache**: Number of last chunks stored to other peers download
- **updateReportTime**: Interval time that peer send information to report server
- **httpReport**: Server report address
