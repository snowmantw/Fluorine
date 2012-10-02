
BUILD = build
BUILD_FLUORINE = build/fluorine
BUILD_DEMO = build/demo
COFFEE = /usr/local/bin/coffee
DEMO = demo
NODE = /usr/local/bin/node
OBJS = context.js notifier.js process.js
OBJ_DEMOS = spec.js todo.js
SOURCE = source
SOURCE_FLUORINE = source/fluorine
SOURCE_DEMO = source/demo
TARGETS = ${OBJS:.js=}
TARGET_DEMOS = ${OBJ_DEMOS:.js=}


all: clean notifier process context spec

clean: 
	@if [ -e ${BUILD} ]; then \
		rm -rf ${BUILD}/*   ; \
	else					  \
		mkdir -p ${BUILD}	; \
	fi

${TARGETS}: clean
	@if [ ! -e ${BUILD_FLUORINE} ]; then 	\
		mkdir -p ${BUILD_FLUORINE}		  ; \
	fi									  ;	\
	find ${SOURCE_FLUORINE}/$@ -name "*.coffee" -exec ${COFFEE} -p -c {} > ${BUILD_FLUORINE}/$@.js \;

${TARGET_DEMOS}: clean
	@if [ ! -e ${BUILD_DEMO} ]; then 		\
		mkdir -p ${BUILD_DEMO}  		  ; \
	fi									  ;	\
	find ${SOURCE_DEMO}/$@ -name "*.coffee" -exec ${COFFEE} -p -c {} > ${BUILD_DEMO}/$@.js \;


