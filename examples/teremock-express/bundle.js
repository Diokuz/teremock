/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./dist/e-driver/index.js":
/*!********************************!*\
  !*** ./dist/e-driver/index.js ***!
  \********************************/
/*! flagged exports */
/*! export DEFAULT_WS_PORT [provided] [no usage info] [missing usage info prevents renaming] */
/*! export __esModule [provided] [no usage info] [missing usage info prevents renaming] */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_exports__ */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// client side code
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DEFAULT_WS_PORT = void 0;
exports.DEFAULT_WS_PORT = 27495;
class Tes {
    send(method, data) {
        this.socket.send(JSON.stringify({ method, data }));
    }
    handle(str) {
        const { message } = JSON.parse(str);
        switch (message) {
            case 'started':
                this.startResolve();
                break;
        }
    }
    async start(options = {}) {
        const { wsUrl, ...tOptions } = options;
        const resultWsUrl = wsUrl !== null && wsUrl !== void 0 ? wsUrl : `ws://localhost:${exports.DEFAULT_WS_PORT}/path/doesnt/matter`;
        let reject;
        this.startPromise = new Promise((res, rej) => {
            this.startResolve = res;
            reject = rej;
        });
        this.socket = new WebSocket(resultWsUrl);
        this.socket.addEventListener('open', (_event) => {
            console.log('WebSocket connection opened', resultWsUrl);
            this.send('start', tOptions);
        });
        this.socket.addEventListener('message', (event) => {
            console.log('message', event.data);
            this.handle(event.data);
        });
        this.socket.addEventListener('error', (event) => {
            console.log('WebSocket connection failed', event);
            reject();
        });
        return this.startPromise;
    }
    async add(userInterceptor) {
        await this.startPromise;
        this.socket.send(JSON.stringify({ method: 'add', data: userInterceptor }));
        return () => {
            this.socket.send(JSON.stringify({ method: 'remove', data: userInterceptor }));
        };
    }
    async stop() {
        // @todo stopPromise, and other promises too. Need some approach here.
        await this.startPromise;
        this.socket.send(JSON.stringify({ method: 'stop' }));
        this.socket.close();
    }
}
exports.default = new Tes();


/***/ }),

/***/ "./examples/teremock-express/client.js":
/*!*********************************************!*\
  !*** ./examples/teremock-express/client.js ***!
  \*********************************************/
/*! namespace exports */
/*! exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_require__.r, __webpack_exports__, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
var __dirname = "examples/teremock-express";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _express__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../express */ "./express/index.js");


async function run() {
  await _express__WEBPACK_IMPORTED_MODULE_0__.default.start({
    // It is important to pass `node.__dirname: true` to webpack.config, if you want custom relative wd
    wd: [__dirname, '__teremocks__'],
  })

  const remove = await _express__WEBPACK_IMPORTED_MODULE_0__.default.add({
    query: { q: 'ab' },
    response: {
      body: { suggest: 'Congrat!!! This is inline (not a file) mock for q=ab' },
    },
  })

  const suggest = document.querySelector('#suggest')
  document.querySelector('#input').addEventListener('keyup', (e) => {
    const query = e.target.value

    fetch(`/api?q=${query}`).then(async (re) => {
      const j = await re.json()
      const { status } = re

      suggest.innerText = `${status} ${j.suggest}`
    })
  })

  document.querySelector('#notfound').addEventListener('click', () => {
    fetch(`/notfound`).then(async (re) => {
      const j = await re.json()
      const { status } = re

      suggest.innerText = `${status} ${j.suggest}`
    })
  })

  setTimeout(() => {
    remove()
    suggest.innerText = `inline mock for 'ab' removed!`
  }, 5 * 1000)
}

run()


/***/ }),

/***/ "./express/index.js":
/*!**************************!*\
  !*** ./express/index.js ***!
  \**************************/
/*! dynamic exports */
/*! export DEFAULT_WS_PORT [provided] [no usage info] [provision prevents renaming (no use info)] -> ./dist/e-driver/index.js .DEFAULT_WS_PORT */
/*! export __esModule [provided] [no usage info] [provision prevents renaming (no use info)] -> ./dist/e-driver/index.js .__esModule */
/*! export default [provided] [no usage info] [provision prevents renaming (no use info)] -> ./dist/e-driver/index.js .default */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: module, __webpack_require__ */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

module.exports = __webpack_require__(/*! ../dist/e-driver/index */ "./dist/e-driver/index.js")


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	// startup
/******/ 	// Load entry module
/******/ 	__webpack_require__("./examples/teremock-express/client.js");
/******/ 	// This entry module used 'exports' so it can't be inlined
/******/ })()
;