
if('undefined' != typeof require){  fluorine = require('fluorine').fluorine }
else if('undefined' != typeof self){ fluorine = self.fluorine }

if('undefined' == typeof window){ self['it'] = context }

fluorine.infect();
fluorine.debug(true);
describe("Process", function(){
  describe("#next", function(){
    self.it("should grow while each action adds their executing part into the process.", function(){
      var proc;
      proc = Process();
      proc.next(function(a){
        a + 1;
      });
      proc.next(function(a, b){
        b + 2;
      });
      proc.next(function(a, b, c){
        c + 3;
      });
      proc.next(function(a, b, c, d){
        d + 4;
      });
      proc.next(function(a, b, c, d, e){
        e + 5;
      });
      expect(proc.__queue.length).toEqual(5);
    });
  });
  describe("#run", function(){
    self.it("should execute only one function after run once.", function(){
      var proc;
      proc = Process();
      proc.next(function(a){
        proc.run(a + 1);
      });
      proc.next(function(b){
        proc.run(b + 1);
      });
      proc.run(0);
      expect(proc.extract()).toEqual(2);
    });
    self.it("should execute exactly n times after run n times.", function(){
      var proc;
      proc = Process();
      proc.next(function(a){
        proc.run(a + 1);
      });
      proc.next(function(b){
        proc.run(b + 2);
      });
      proc.next(function(c){
        proc.run(c + 3);
      });
      proc.run(0);
      expect(proc.extract()).toEqual(6);
    });
    self.it("should conquer the asynchronous callback hell.", function(){
      var proc;
      proc = Process();
      runs(function(){
        proc.next(function(){
          proc.run(99);
        });
        proc.next(function(){
          jQuery.get("/testAjax", function(data){
            proc.run(data);
          });
        });
        proc.next(function(data){
          proc.run(data);
        });
        proc.run();
      });
      waits(500);
      runs(function(){
        expect(Number(proc.extract())).toEqual(10);
      });
    });
  });
});
self.Context = self.fluorine.Context;
describe("Context", function(){
  beforeEach(function(){
    fluorine.Notifier.init();
  });
  describe("#as", function(){
    self.it("should name results of previous computation as user needed", function(){
      var m, proc_m, runned_m;
      m = Context()._(function(){
        return 0;
      }).as("foo")._(function(a){
        return a + 8;
      }).as("bar");
      proc_m = m.done();
      runned_m = proc_m();
      expect(runned_m.extract()).toEqual(8);
      expect(m.__environment['foo']).toEqual(0);
      expect(m.__environment['bar']).toEqual(8);
    });
  });
  describe("#let", function(){
    self.it("should force next stage is as", function(){
      var m, proc_m, runned_m;
      m = Context(10)['let'](function(x){
        return x - 10;
      }).as('a')['let'](function(y){
        return y == 0;
      }).as('b');
      proc_m = m.done();
      runned_m = proc_m();
      expect(m.__environment['a']).toEqual(0);
      expect(m.__environment['b']).toEqual(true);
    });
  });
  describe("#tie", function(){
    self.it("should be able to tie deep contexts", function(){
      var m, proc_m, runned_m;
      m = Context(10)['let'](function(x){
        return x - 10;
      }).as('a')['let'](function(y){
        return y == 0;
      }).as('b').tie(function(){
        return Context(20)['let'](function(x){
          return x + this.a + 10;
        }).as('c')['let'](function(y){
          return y == 30;
        }).as('d')['let'](function(){
          return 300;
        }).as('z').tie(function(){
          return Context(this.d)['let'](function(x){
            return !this.b;
          }).as('e').done();
        }).done();
      });
      proc_m = m.done();
      runned_m = proc_m();
      expect(m.__environment['d']).toEqual(true);
      expect(m.__environment['e']).toEqual(false);
    });
  });
});
self.IO = self.fluorine.IO;
describe("IO", function(){
  beforeEach(function(){
    fluorine.Notifier.init();
  });
  describe("#get", function(){
    self.it("should get text resouce fomr server ", function(){
      var runned_m, m;
      runned_m = null;
      m = IO().get('/testAjax').as('ten')._(function(){
        return 10;
      })._(function(){
        return this.ten - 10;
      });
      runs(function(){
        var proc_m;
        proc_m = m.done();
        runned_m = proc_m();
      });
      waits(300);
      runs(function(){
        expect(runned_m.extract()).toEqual(0);
      });
    });
    self.it("should be able to request binary data from server.", function(){
      var isGIF, m1;
      isGIF = false;
      m1 = IO().getBinary("/media/TestGIF.gif")._(function(data){
        var arr, i, len, length, frames;
        arr = new Uint8Array(data);
        i = undefined;
        len = undefined;
        length = arr.length;
        frames = 0;
        if (arr[0] === 0x47 || arr[1] === 0x49 || arr[2] === 0x46 || arr[3] === 0x38) {
          return isGIF = true;
        }
      }).done()();
      waits(500);
      runs(function(){
        expect(isGIF).toEqual(true);
      });
    });
  });
  describe("#post", function(){
    self.it("should POST JSON to server.", function(){
      var a, m;
      a = null;
      m = IO()._(function(){
        return {
          'a': "foobar"
        };
      }).post('/testAjax')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("post ok");
      });
    });
    self.it("should POST ArrayBuffer to server.", function(){
      var a, m;
      a = null;
      m = IO()._(function(){
        return new Uint8Array([1, 2, 3]);
      }).postBinary('/testAjax')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("others");
      });
    });
    self.it("should POST Blob to server.", function(){
      var a, m;
      a = null;
      m = IO()._(function(){
        return new Blob(['blob object'], {
          'type': 'text/plain'
        });
      }).postBinary('/testAjax')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("others");
      });
    });
  });
  describe("#put", function(){
    self.it("should PUT JSON to server.", function(){
      var a, m;
      a = null;
      m = IO()._(function(){
        return {
          'a': "foobar"
        };
      }).put('/testAjax')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("put ok");
      });
    });
    self.it("should PUT ArrayBuffer to server.", function(){
      var a, m;
      a = null;
      m = IO()._(function(){
        return new Uint8Array([1, 2, 3]);
      }).putBinary('/testAjax')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("others");
      });
    });
    self.it("should PUT Blob to server.", function(){
      var a, m;
      a = null;
      m = IO()._(function(){
        return new Blob(['blob object'], {
          'type': 'text/plain'
        });
      }).putBinary('/testAjax')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("others");
      });
    });
  });
  describe("#delete", function(){
    self.it("should DELETE to server.", function(){
      var a, m;
      a = null;
      m = IO()._(function(){
        return {
          'a': "foobar"
        };
      })['delete']('/testAjax/asd')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("delete ok");
      });
    });
  });
  describe("#tie", function(){
    self.it("should tie some context and use it's result to GET from server, and tie handler of PUT.", function(){
      var a, m;
      a = null;
      m = IO().get('/testAjax')._(function(x){
        if (x == 10) {
          return {
            'a': "foobar"
          };
        }
      }).tie(function(){
        return Context(20)['let'](function(x){
          return x + this.a + 10;
        }).as('c')['let'](function(y){
          return y == 30;
        }).as('d')['let'](function(){
          return 300;
        }).as('z').tie(function(){
          return Context(this.d)._(function(x){
            if (!this.b) {
              return {
                'a': "foobar"
              };
            }
          }).done();
        }).done();
      }).put('/testAjax')._(function(r){
        return a = r;
      }).done()();
      waits(500);
      runs(function(){
        expect(a).toEqual("put ok");
      });
    });
    self.it("should make IOs as sequence, mixed with some pure computations.", function(){
      var m;
      m = IO().get('/testAjax').as('a')._(function(x){
        return {
          'a': "foobar"
        };
      }).put('/testAjax').as('b')['delete']('/testAjax/asd').as('c');
      m.done()();
      waits(500);
      runs(function(){
        expect(m.__environment['a']).toEqual("10");
        expect(m.__environment['b']).toEqual("put ok");
        expect(m.__environment['c']).toEqual("delete ok");
      });
    });
  });
});
self.UI = self.fluorine.UI;
describe("UI", function(){
  beforeEach(function(){
    fluorine.Notifier.init();
  });
  describe("#$", function(){
    self.it("should mapping jQery methods ", function(){
      var names, m;
      names = ['animate', 'addClass', 'after', 'append', 'appendTo', 'attr', 'before', 'css', 'clone', 'detach', 'empty', 'children', 'parents', 'parent', 'fadeIn', 'fadeOut', 'hide', 'height', 'html', 'innerHeight', 'innerWidth', 'insertAfter', 'insertBefore', 'offset', 'outerHeight', 'outerWidth', 'prepend', 'prependTo', 'remove', 'removeAfter', 'removeClass', 'removeProp', 'replaceAll', 'replaceWith', 'scrollLeft', 'show', 'scrollTop', 'text', 'toggleClass', 'unwrap', 'val', 'wrap', 'wrap', 'wrapAll', 'wrapInner', 'filter', 'not', 'eq'];
      m = UI('body').$();
      _.each(names, function(name){
        expect(m[name]).not.toBe(undefined);
      });
    });
  });
  describe("#tie", function(){
    self.it("should allow mixin with IO context", function(){
      var m;
      m = UI().tie(function(){
        return IO().get('/testUI/body').done();
      }).$().css('background', 'cyan').attr('tested', 'true').done()();
      waits(300);
      runs(function(){
        expect($('body').attr('tested')).toEqual("true");
      });
    });
    self.it("should forwarding events as spec", function(){
      var result, m;
      result = false;
      fluorine.Notifier.on('spec_click', function(){
        result = true;
      });
      m = UI('body').forward('click.spec', function(){
        return 'spec_click';
      }).done()();
      $('body').click();
      expect(result).toEqual(true);
    });
    self.it("should present how 'find' works differently from jQuery's 'find'", function(){
      var html, spans;
      html = "<div class='outer'><span class='outer'></span><div class='inner'>TEXT<span id='innder-but-global'>TXT</span></div></div>";
      $(html).appendTo('body');
      spans = UI('body').$().select('div.outer').select('.inner').find('span').done()().extract();
      expect(spans.length).toEqual(2);
      $('body div.outer').remove();
    });
    self.it("should present how 'select' works", function(){
      var html, text, spans;
      html = "<div class='outer'><span class='outer'></span><div class='inner'>TEXT<span id='innder-but-global'>TXT</span></div></div>";
      text = UI(html).$().select('.inner').select('span').text().done()().extract();
      spans = UI(html).$().select('.inner').select('span').done()().extract();
      expect(text).toEqual("TXT");
      expect(spans.length).toEqual(1);
    });
    self.it("should mixin multiple contexts", function(){
      var html, e, m;
      html = "<div id='text-div' style='border:2px red solid'>Some Text Div Here</div>";
      e = UI(html).$().appendTo('body').done();
      m = UI().tie(function(){
        return IO().get('/testUI/body').done();
      }).as('slc').tie(function(){
        return IO().get('/testUI/some-text').done();
      }).as('txt')._(function(){
        return this.slc;
      }).$().css('background', 'cyan').tie(function(){
        return e;
      })._(function(){
        return this.slc;
      }).$().tie(function(){
        return IO().get('/testUI/text-div').done();
      })._(function(s){
        return '#' + s;
      }).as('slc2').$()._(function($e){
        return $e.text(this.txt);
      }).done()();
      waits(300);
      runs(function(){
        expect($('body').attr('tested')).toEqual("true");
        expect($('#text-div').text()).toEqual("some-text");
      });
    });
  });
});
self.Event = self.fluorine.Event;
describe("Event", function(){
  beforeEach(function(){
    fluorine.Notifier.init();
  });
  describe("#initialize", function(){
    self.it("should allow tie notes handlers", function(){
      var m, proc_m, runned_m;
      m = Event('SpecNote')._(function(){
        return 10;
      }).as('a').tie(function(){
        return IO().get('/testAjax').done();
      }).as('b')._(function(){
        return 0 == this.a - Number(this.b);
      }).as('c');
      proc_m = m.done();
      runned_m = proc_m();
      Notifier.trigger('SpecNote');
      waits(300);
      runs(function(){
        expect(m.__environment['c']).toEqual(true);
      });
    });
  });
});
self.Socket = self.fluorine.Socket;
describe("Socket", function(){
  beforeEach(function(){
    fluorine.Notifier.init();
  });
  describe("#open", function(){
    self.it("should allow open and close", function(){
      var a, m;
      a = false;
      m = Socket().connect('ws://127.0.0.1:3030').forward(function(name, data, hr){
        if (name == "close") {
          a = true;
        }
      }).close().done()();
      waits(300);
      runs(function(){
        expect(a).toEqual(true);
      });
    });
  });
});

if('undefined' !== typeof window)
{
(function() {
  var jasmineEnv = jasmine.getEnv();
  jasmineEnv.updateInterval = 250;

  var consoleReporter = new jasmine.ConsoleReporter();
  jasmineEnv.addReporter(consoleReporter);

  /*
  jasmineEnv.specFilter = function(spec) {
    return consoleReporter.specFilter(spec);
  };
  */

  var currentWindowOnload = window.onload;
  window.onload = function() {
    if (currentWindowOnload) {
      currentWindowOnload();
    }

    execJasmine();
  };

  function execJasmine() {
    jasmineEnv.execute();
  }
})();
}
