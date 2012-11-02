
BUILD = build
BUILD_FLUORINE = build/fluorine
BUILD_DEMO = build/demo
COFFEE = /usr/local/bin/coco -bcp
DEMO = demo
NODE = /usr/local/bin/node
OBJS = notifier.js process.js utils.js
OBJ_DEMOS = spec.js todo.js # context.js need addtional operations.
SOURCE = source
SOURCE_FLUORINE = source/fluorine
SOURCE_DEMO = source/demo
TARGETS = ${OBJS:.js=}
TARGET_DEMOS = ${OBJ_DEMOS:.js=}

all: clean utils notifier process context spec todo

clean: 
	@if [ -e ${BUILD} ]; then \
		rm -rf ${BUILD}/*   ; \
	else					  \
		mkdir -p ${BUILD}	; \
	fi

context: clean
	@if [ ! -e ${BUILD_FLUORINE} ]; then 	\
		mkdir -p ${BUILD_FLUORINE}		  ; \
	fi									  ;	\
        cat ${SOURCE_FLUORINE}/$@/context.js >> ${BUILD_FLUORINE}/context.js ;\
        cat ${SOURCE_FLUORINE}/$@/io.js >> ${BUILD_FLUORINE}/context.js \

${TARGETS}: clean
	@if [ ! -e ${BUILD_FLUORINE} ]; then 	\
		mkdir -p ${BUILD_FLUORINE}		  ; \
	fi									  ;	\
	find ${SOURCE_FLUORINE}/$@ -name "*.js" -exec cat {} > ${BUILD_FLUORINE}/$@.js \;

${TARGET_DEMOS}: clean
	@if [ ! -e ${BUILD_DEMO} ]; then 		\
		mkdir -p ${BUILD_DEMO}  		  ; \
	fi									  ;	\
	find ${SOURCE_DEMO}/$@ -name "*.co" -exec ${COFFEE} -p -c {} > ${BUILD_DEMO}/$@.js \;


