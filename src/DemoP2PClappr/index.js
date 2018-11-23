const express = require('express');
var path = require('path')
const app = express();

app.get('/index',function(req,res){
    res.sendFile(path.join(__dirname+'/index.html'))
})

//app.get('/clappr',function(req,res){
//    res.sendFile(path.join(__dirname+'/views/clappr.html'))
//})

app.use('/', express.static(__dirname))

app.listen(8900, function(){
    console.log('Server started at 8900')
})