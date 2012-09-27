
BUILD = build
COFFEE = /usr/local/bin/coffee
DEMO = demo
NODE = /usr/local/bin/node
OBJS = context.js notifier.js process.js
SOURCE = source
TARGETS = ${OBJS:.js=}


all: clean notifier process context 

refresh: all
	${NODE} demo/server.js

clean: 
	@rm -rf ${BUILD}/*

${TARGETS}:
	@find ${SOURCE}/$@ -name "*.coffee" -exec ${COFFEE} -p -c {} > ${BUILD}/$@.js \;

