
Process = fluorine.Process;

describe("Process",function(){

    var proc = null;

    beforeEach(function(){
        proc = Process();

    });
    
    describe("#next", function(){

        it("should grow while each action adds their executing part into the process.", function(){

            proc.next(function(a){ return a+1;});
            proc.next(function(a,b){ return b+2;});
            proc.next(function(a,b,c){ return c+3;});
            proc.next(function(a,b,c,d){ return d+4;});
            proc.next(function(a,b,c,d,e){ return e+5;});

            expect(proc.__queue.length).toEqual(5);
        })
    })

    describe("#run", function(){

        it("should execute only one function after run once.", function(){

            proc.next(function(a){ proc.run(a+1)});
            proc.next(function(b){ proc.run(b+1)});

            proc.run(0);

            expect(proc.extract()).toEqual(2);
        });

        it("should execute exactly n times after run n times.", function(){

            proc.next(function(a){ proc.run(a+1)});
            proc.next(function(b){ proc.run(b+2)});
            proc.next(function(c){ proc.run(c+3)});

            proc.run(0)

            expect(proc.extract()).toEqual(6);
        });

        it("should conquer the asynchronous callback hell.", function(){

            runs( function(){
                proc.next(function(){ proc.run(99)});
                proc.next(function()
                {   jQuery.get('/testAjax', function(data){
                        proc.run(data)  // the end of asynchronous steps
                    })
                });

                proc.next(function(data){ proc.run(data) });

                proc.run(); // synchronous
            });
            waits(500);
            runs( function(){

                expect(Number(proc.extract())).toEqual(100);
            });
        });
    })
});
