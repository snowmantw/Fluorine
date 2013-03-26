
BUILD = build
BUILD_FLUORINE = build/fluorine
BUILD_DEMO = build/demo
COFFEE = /usr/local/bin/coco -bcp
DEMO = demo
NODE = nodejs
OBJS = notifier.js process.js utils.js
OBJ_DEMOS = spec.js todo.js # context.js need addtional operations.
SOURCE = source
SOURCE_FLUORINE = source/fluorine
SOURCE_DEMO = source/demo
TARGETS = ${OBJS:.js=}
TARGET_DEMOS = ${OBJ_DEMOS:.js=}
MERGED = fluorine
PACKAGE_CONFIG = config
DOCS=document

all: clean utils notifier process context merge export package spec todo 

package:
	@cp ${PACKAGE_CONFIG}/package.json ${BUILD_FLUORINE}/

clean: 
	@if [ -e ${BUILD} ]; then \
		rm -rf ${BUILD}/*   ; \
	else					  \
		mkdir -p ${BUILD}	; \
	fi

export:
	@cat ${SOURCE_FLUORINE}/$@/export.js >> ${BUILD_FLUORINE}/${MERGED}.js  && \
	docco -o ${DOCS}/export -c ${DOCS}/docco.css ${SOURCE_FLUORINE}/$@/export.js 

merge:
	cat ${BUILD_FLUORINE}/utils.js > ${BUILD_FLUORINE}/${MERGED}.js  && \
	cat ${BUILD_FLUORINE}/process.js >> ${BUILD_FLUORINE}/${MERGED}.js   && \
	cat ${BUILD_FLUORINE}/notifier.js >> ${BUILD_FLUORINE}/${MERGED}.js && \
	cat ${BUILD_FLUORINE}/context.js >> ${BUILD_FLUORINE}/${MERGED}.js


# Contexts: merge order important.
context: clean
	@if [ ! -e ${BUILD_FLUORINE} ]; then 	\
		mkdir -p ${BUILD_FLUORINE}		  ; \
	fi									  ;	\
        cat ${SOURCE_FLUORINE}/$@/context.js > ${BUILD_FLUORINE}/context.js ;\
        cat ${SOURCE_FLUORINE}/$@/io.js >> ${BUILD_FLUORINE}/context.js ;\
        cat ${SOURCE_FLUORINE}/$@/ui.js >> ${BUILD_FLUORINE}/context.js ;\
        cat ${SOURCE_FLUORINE}/$@/event.js >> ${BUILD_FLUORINE}/context.js ;\
        cat ${SOURCE_FLUORINE}/$@/socket.js >> ${BUILD_FLUORINE}/context.js ;\
	docco -o ${DOCS}/context -c ${DOCS}/docco.css ${SOURCE_FLUORINE}/$@/context.js ;\
	docco -o ${DOCS}/context -c ${DOCS}/docco.css ${SOURCE_FLUORINE}/$@/io.js ;\
	docco -o ${DOCS}/context -c ${DOCS}/docco.css ${SOURCE_FLUORINE}/$@/ui.js ;\
	docco -o ${DOCS}/context -c ${DOCS}/docco.css ${SOURCE_FLUORINE}/$@/event.js ;\
	docco -o ${DOCS}/context -c ${DOCS}/docco.css ${SOURCE_FLUORINE}/$@/socket.js

${TARGETS}: clean
	@if [ ! -e ${BUILD_FLUORINE} ]; then 	\
		mkdir -p ${BUILD_FLUORINE}		  ; \
	fi									  ;	\
	find ${SOURCE_FLUORINE}/$@ -name "*.js" -exec cat {} > ${BUILD_FLUORINE}/$@.js \; ; \
	find ${SOURCE_FLUORINE}/$@ -name "*.js" -exec docco -o ${DOCS}/$@ -c ${DOCS}/docco.css {} \;

${TARGET_DEMOS}: clean
	@if [ ! -e ${BUILD_DEMO} ]; then 		\
		mkdir -p ${BUILD_DEMO}  		  ; \
	fi									  ;	\
	find ${SOURCE_DEMO}/$@ -name "*.co" -exec ${COFFEE} -p -c {} > ${BUILD_DEMO}/$@.js \;

.PHONY: context merge export clean package
