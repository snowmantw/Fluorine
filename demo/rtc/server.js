var ejs = require('ejs')
var express = require('express')
var app = express()
var http = require('http')
var server = http.createServer(app)
var ws = require('ws')
ws = new ws.Server({port: 3030})

var ID = 1
var STORAGE = { offerers: {} }

// {id: {type: ...}}
var POLLING = { }

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

app.configure(function()
{
    app.set('views', __dirname+'/template');
    app.set("view options",{layout:false});
    app.use('/library',express.static( __dirname + '/../../library'));
    app.use('/build',express.static( __dirname + '/../../build'));
    app.use('/media',express.static( __dirname + '/media'));
    app.use(allowCrossDomain)
    app.use(express.methodOverride());
    app.use(express.bodyParser());
});

app.all('/*', function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      next();
});

app.get('/', function(req,res){
    res.render('spec.ejs')
});

app.post('/signal/id', function(req, res){
    var offerer_info = req.body
    ID += 1
    var id = ID // TODO: UUID generation.
    STORAGE.offerers[id] = offerer_info
    console.log('++id', id)
    POLLING[id] = {type: 'none'}
    res.end(String(id))
});

app.post('/signal/channels', function(req, res){
    var offerer_info = JSON.parse(enc_info)
    res.end(JSON.stringify(STORAGE.offerers))
});

app.post('/signal/answers-info/:toid', function(req, res){
    // TODO: Parse enc_info from POST body
    var info = JSON.parse(enc_info)

    if(toid == '')
    {
        for(var id in POLLING)
        {
            // TODO: Copy?????
            POLLING[id] = info
        }
    }

    POLLING[toid] = info
    res.end('true')
});

app.get('/signal/polling/:fromid', function(req, res){
    var fromid = req.params.fromid
    var data = POLLING[fromid]
    res.end(JSON.stringify(data))

    // In fact delete.
    POLLING[fromid] = {type: 'none'}
});

/*

app.get('/testAjax', function(req,res){
    res.send('10')
});

app.get('/testUI/:slc', function(req,res){
    res.send(req.params.slc)    // send the selector back.
});

app.post('/testAjax', function(req, res){
    if( 'foobar' == req.param('a') )
    {
        res.send('post ok')
    }
    else
    {
        res.send('others')  // FIXME: Binary data ?
    }
});

app.put('/testAjax', function(req, res){
    if( 'foobar' == req.param('a') )
    {
        res.send('put ok')
    }
    else
    {
        res.send('others')  // FIXME: Binary data ?
    }
});

app.delete('/testAjax/:test', function(req, res){
    if( 'asd' == req.params.test )
    {
        res.send('delete ok')
    }
    else
    {
        res.send('not ok')
    }
});

ws.on
(   'request'
,   function(req)
{   var connection = req.accept(null, req.origin)
    console.log('req',req)

    // another event in
    connection.on
    (   'message'
    ,   function(data)
    {
        ws.send('10')
        console.log('[DEBUG] test data: ', data)
    }
    )
}
)
*/

server.listen(3000);
