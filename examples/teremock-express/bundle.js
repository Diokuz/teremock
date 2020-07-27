/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./examples/teremock-express/client.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./dist/e-driver/index.js":
/*!********************************!*\
  !*** ./dist/e-driver/index.js ***!
  \********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// client side code
Object.defineProperty(exports, "__esModule", { value: true });
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
        const resultWsUrl = (wsUrl !== null && wsUrl !== void 0 ? wsUrl : `ws://localhost:${exports.DEFAULT_WS_PORT}/path/doesnt/matter`);
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
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* WEBPACK VAR INJECTION */(function(__dirname) {/* harmony import */ var _express__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../express */ "./express/index.js");
/* harmony import */ var _express__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_express__WEBPACK_IMPORTED_MODULE_0__);


async function run() {
  await _express__WEBPACK_IMPORTED_MODULE_0___default.a.start({
    // It is important to pass `node.__dirname: true` to webpack.config, if you want custom relative wd
    wd: [__dirname, '__teremocks__'],
  })

  const remove = await _express__WEBPACK_IMPORTED_MODULE_0___default.a.add({
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

/* WEBPACK VAR INJECTION */}.call(this, "examples\\teremock-express"))

/***/ }),

/***/ "./express/index.js":
/*!**************************!*\
  !*** ./express/index.js ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! ../dist/e-driver/index */ "./dist/e-driver/index.js")


/***/ })

/******/ });