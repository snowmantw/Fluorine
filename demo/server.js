var ejs = require('ejs');
var express = require('express');
var app = express.createServer();

app.configure(function()
{
    app.set('views', __dirname+'/../template');
    app.set("view options",{layout:false});
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use('/library',express.static( __dirname + '/../library'));
    app.use('/spec',express.static( __dirname + '/../spec'));
    app.use(app.router);
});

app.get('/', function(req,res){
    res.render('index.ejs')
});

app.get('/testAjax', function(req,res){
    res.send('100')
});

app.listen(3000);
