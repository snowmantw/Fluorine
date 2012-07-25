
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

            proc.next(function(a){ return a+1;});
            proc.next(function(a,b){ return b+2;});

            proc.run(0);

            expect(proc.extract()).toEqual(1);
        });

        it("should execute exactly n times after run n times.", function(){

            proc.next(function(a){ return a+1;});
            proc.next(function(a,b){ return b+2;});
            proc.next(function(a,b,c){ return c+3;});

            proc.run(0)
            proc.run(0,0)
            proc.run(0,0,0)

            expect(proc.extract()).toEqual(3);
        });

        it("should follow the registering order to execute functions. ", function(){

            proc.next(function(a,b,c,d){ return d+4;});
            proc.next(function(a){ return a+1;});
            proc.next(function(a,b,c){ return c+3;});


            proc.run(0,0,0,0)
            proc.run(0)
            proc.run(0,0,0)
        
            expect(proc.extract()).toEqual(3);
        });

        it("should conquer the asynchronous callback hell.", function(){

            runs( function(){
                proc.next(function(){ return 99;});
                proc.next(function()
                {   jQuery.get('/testAjax', function(data){
                        proc.run(data)  // the end of asynchronous steps
                    })
                });

                proc.next(function(data){return Number(data)});

                proc.run(); // synchronous
                proc.run(); // trigger asynchronous steps
            });
            waits(500);
            runs( function(){

                expect(proc.extract()).toEqual(100);
            });
        });
    })
});
