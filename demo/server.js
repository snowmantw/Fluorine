var ejs = require('ejs');
var express = require('express');
var app = express.createServer();

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
    app.set('views', __dirname+'/../template');
    app.set("view options",{layout:false});
    app.use(allowCrossDomain)
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use('/library',express.static( __dirname + '/../library'));
    app.use('/spec',express.static( __dirname + '/../spec'));
    app.use('/media',express.static( __dirname + '/../media'));
    app.use(app.router);
});

app.all('/*', function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
//      res.header("Access-Control-Allow-Headers", "X-Requested-With");
      next();
});

app.get('/', function(req,res){
    res.render('index.ejs')
});

app.get('/testAjax', function(req,res){
    res.send('100')
});


app.listen(3000);
