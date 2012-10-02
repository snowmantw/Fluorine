var ejs = require('ejs')
var express = require('express')
var app = express()
var http = require('http')
var server = http.createServer(app)
var ws = new (require('websocket').server)({httpServer: server})

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
    app.use(allowCrossDomain)
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use('/library',express.static( __dirname + '/../../library'));
    app.use('/build',express.static( __dirname + '/../../build'));
    app.use('/media',express.static( __dirname + '/media'));
    app.use(app.router);
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
    res.send('100')
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
        console.log('[DEBUG] test data: ', data)
    }
    )
}
)

server.listen(3000);
