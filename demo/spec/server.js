var ejs = require('ejs')
var express = require('express')
var app = express()
var http = require('http')
var server = http.createServer(app)
var ws = require('ws')
ws = new ws.Server({port: 3030})

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
//      res.header("Access-Control-Allow-Headers", "X-Requested-With");
      next();
});

app.get('/', function(req,res){
    res.render('spec.ejs')
});

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

server.listen(3000);
