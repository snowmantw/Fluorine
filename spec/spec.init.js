
jasmine.updateInterval = 250;

jasmine.getEnv().addReporter(new jasmine.ConsoleReporter(console.log));
jasmine.getEnv().execute();

/*
jasmine.specFilter = function(spec) {
    return consoleReporter.specFilter(spec);
};
*/

