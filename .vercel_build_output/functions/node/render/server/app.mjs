import {randomBytes, createHash} from "crypto";
import http from "http";
import https from "https";
import zlib from "zlib";
import Stream, {PassThrough, pipeline} from "stream";
import {types} from "util";
import {format, parse, resolve, URLSearchParams as URLSearchParams$1} from "url";
var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
var unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
var reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
var escaped$1 = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "	": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
var objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function devalue(value) {
  var counts = new Map();
  function walk(thing) {
    if (typeof thing === "function") {
      throw new Error("Cannot stringify a function");
    }
    if (counts.has(thing)) {
      counts.set(thing, counts.get(thing) + 1);
      return;
    }
    counts.set(thing, 1);
    if (!isPrimitive(thing)) {
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
          return;
        case "Array":
          thing.forEach(walk);
          break;
        case "Set":
        case "Map":
          Array.from(thing).forEach(walk);
          break;
        default:
          var proto = Object.getPrototypeOf(thing);
          if (proto !== Object.prototype && proto !== null && Object.getOwnPropertyNames(proto).sort().join("\0") !== objectProtoOwnPropertyNames) {
            throw new Error("Cannot stringify arbitrary non-POJOs");
          }
          if (Object.getOwnPropertySymbols(thing).length > 0) {
            throw new Error("Cannot stringify POJOs with symbolic keys");
          }
          Object.keys(thing).forEach(function(key) {
            return walk(thing[key]);
          });
      }
    }
  }
  walk(value);
  var names = new Map();
  Array.from(counts).filter(function(entry) {
    return entry[1] > 1;
  }).sort(function(a, b) {
    return b[1] - a[1];
  }).forEach(function(entry, i) {
    names.set(entry[0], getName(i));
  });
  function stringify(thing) {
    if (names.has(thing)) {
      return names.get(thing);
    }
    if (isPrimitive(thing)) {
      return stringifyPrimitive(thing);
    }
    var type = getType(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
        return "Object(" + stringify(thing.valueOf()) + ")";
      case "RegExp":
        return "new RegExp(" + stringifyString(thing.source) + ', "' + thing.flags + '")';
      case "Date":
        return "new Date(" + thing.getTime() + ")";
      case "Array":
        var members = thing.map(function(v, i) {
          return i in thing ? stringify(v) : "";
        });
        var tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return "[" + members.join(",") + tail + "]";
      case "Set":
      case "Map":
        return "new " + type + "([" + Array.from(thing).map(stringify).join(",") + "])";
      default:
        var obj = "{" + Object.keys(thing).map(function(key) {
          return safeKey(key) + ":" + stringify(thing[key]);
        }).join(",") + "}";
        var proto = Object.getPrototypeOf(thing);
        if (proto === null) {
          return Object.keys(thing).length > 0 ? "Object.assign(Object.create(null)," + obj + ")" : "Object.create(null)";
        }
        return obj;
    }
  }
  var str = stringify(value);
  if (names.size) {
    var params_1 = [];
    var statements_1 = [];
    var values_1 = [];
    names.forEach(function(name, thing) {
      params_1.push(name);
      if (isPrimitive(thing)) {
        values_1.push(stringifyPrimitive(thing));
        return;
      }
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          values_1.push("Object(" + stringify(thing.valueOf()) + ")");
          break;
        case "RegExp":
          values_1.push(thing.toString());
          break;
        case "Date":
          values_1.push("new Date(" + thing.getTime() + ")");
          break;
        case "Array":
          values_1.push("Array(" + thing.length + ")");
          thing.forEach(function(v, i) {
            statements_1.push(name + "[" + i + "]=" + stringify(v));
          });
          break;
        case "Set":
          values_1.push("new Set");
          statements_1.push(name + "." + Array.from(thing).map(function(v) {
            return "add(" + stringify(v) + ")";
          }).join("."));
          break;
        case "Map":
          values_1.push("new Map");
          statements_1.push(name + "." + Array.from(thing).map(function(_a) {
            var k = _a[0], v = _a[1];
            return "set(" + stringify(k) + ", " + stringify(v) + ")";
          }).join("."));
          break;
        default:
          values_1.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach(function(key) {
            statements_1.push("" + name + safeProp(key) + "=" + stringify(thing[key]));
          });
      }
    });
    statements_1.push("return " + str);
    return "(function(" + params_1.join(",") + "){" + statements_1.join(";") + "}(" + values_1.join(",") + "))";
  } else {
    return str;
  }
}
function getName(num) {
  var name = "";
  do {
    name = chars[num % chars.length] + name;
    num = ~~(num / chars.length) - 1;
  } while (num >= 0);
  return reserved.test(name) ? name + "_" : name;
}
function isPrimitive(thing) {
  return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
  if (typeof thing === "string")
    return stringifyString(thing);
  if (thing === void 0)
    return "void 0";
  if (thing === 0 && 1 / thing < 0)
    return "-0";
  var str = String(thing);
  if (typeof thing === "number")
    return str.replace(/^(-)?0\./, "$1.");
  return str;
}
function getType(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
  return escaped$1[c] || c;
}
function escapeUnsafeChars(str) {
  return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? "." + key : "[" + escapeUnsafeChars(JSON.stringify(key)) + "]";
}
function stringifyString(str) {
  var result = '"';
  for (var i = 0; i < str.length; i += 1) {
    var char = str.charAt(i);
    var code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped$1) {
      result += escaped$1[char];
    } else if (code >= 55296 && code <= 57343) {
      var next = str.charCodeAt(i + 1);
      if (code <= 56319 && (next >= 56320 && next <= 57343)) {
        result += char + str[++i];
      } else {
        result += "\\u" + code.toString(16).toUpperCase();
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}
function dataUriToBuffer(uri) {
  if (!/^data:/i.test(uri)) {
    throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
  }
  uri = uri.replace(/\r?\n/g, "");
  const firstComma = uri.indexOf(",");
  if (firstComma === -1 || firstComma <= 4) {
    throw new TypeError("malformed data: URI");
  }
  const meta = uri.substring(5, firstComma).split(";");
  let charset = "";
  let base64 = false;
  const type = meta[0] || "text/plain";
  let typeFull = type;
  for (let i = 1; i < meta.length; i++) {
    if (meta[i] === "base64") {
      base64 = true;
    } else {
      typeFull += `;${meta[i]}`;
      if (meta[i].indexOf("charset=") === 0) {
        charset = meta[i].substring(8);
      }
    }
  }
  if (!meta[0] && !charset.length) {
    typeFull += ";charset=US-ASCII";
    charset = "US-ASCII";
  }
  const encoding = base64 ? "base64" : "ascii";
  const data = unescape(uri.substring(firstComma + 1));
  const buffer = Buffer.from(data, encoding);
  buffer.type = type;
  buffer.typeFull = typeFull;
  buffer.charset = charset;
  return buffer;
}
var src = dataUriToBuffer;
const {Readable} = Stream;
const wm = new WeakMap();
async function* read(parts) {
  for (const part of parts) {
    if ("stream" in part) {
      yield* part.stream();
    } else {
      yield part;
    }
  }
}
class Blob$1 {
  constructor(blobParts = [], options = {type: ""}) {
    let size = 0;
    const parts = blobParts.map((element) => {
      let buffer;
      if (element instanceof Buffer) {
        buffer = element;
      } else if (ArrayBuffer.isView(element)) {
        buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
      } else if (element instanceof ArrayBuffer) {
        buffer = Buffer.from(element);
      } else if (element instanceof Blob$1) {
        buffer = element;
      } else {
        buffer = Buffer.from(typeof element === "string" ? element : String(element));
      }
      size += buffer.length || buffer.size || 0;
      return buffer;
    });
    const type = options.type === void 0 ? "" : String(options.type).toLowerCase();
    wm.set(this, {
      type: /[^\u0020-\u007E]/.test(type) ? "" : type,
      size,
      parts
    });
  }
  get size() {
    return wm.get(this).size;
  }
  get type() {
    return wm.get(this).type;
  }
  async text() {
    return Buffer.from(await this.arrayBuffer()).toString();
  }
  async arrayBuffer() {
    const data = new Uint8Array(this.size);
    let offset = 0;
    for await (const chunk of this.stream()) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    return data.buffer;
  }
  stream() {
    return Readable.from(read(wm.get(this).parts));
  }
  slice(start = 0, end = this.size, type = "") {
    const {size} = this;
    let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
    let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size);
    const span = Math.max(relativeEnd - relativeStart, 0);
    const parts = wm.get(this).parts.values();
    const blobParts = [];
    let added = 0;
    for (const part of parts) {
      const size2 = ArrayBuffer.isView(part) ? part.byteLength : part.size;
      if (relativeStart && size2 <= relativeStart) {
        relativeStart -= size2;
        relativeEnd -= size2;
      } else {
        const chunk = part.slice(relativeStart, Math.min(size2, relativeEnd));
        blobParts.push(chunk);
        added += ArrayBuffer.isView(chunk) ? chunk.byteLength : chunk.size;
        relativeStart = 0;
        if (added >= span) {
          break;
        }
      }
    }
    const blob = new Blob$1([], {type});
    Object.assign(wm.get(blob), {size: span, parts: blobParts});
    return blob;
  }
  get [Symbol.toStringTag]() {
    return "Blob";
  }
  static [Symbol.hasInstance](object) {
    return typeof object === "object" && typeof object.stream === "function" && object.stream.length === 0 && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[Symbol.toStringTag]);
  }
}
Object.defineProperties(Blob$1.prototype, {
  size: {enumerable: true},
  type: {enumerable: true},
  slice: {enumerable: true}
});
var fetchBlob = Blob$1;
class FetchBaseError extends Error {
  constructor(message, type) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.type = type;
  }
  get name() {
    return this.constructor.name;
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}
class FetchError extends FetchBaseError {
  constructor(message, type, systemError) {
    super(message, type);
    if (systemError) {
      this.code = this.errno = systemError.code;
      this.erroredSysCall = systemError.syscall;
    }
  }
}
const NAME = Symbol.toStringTag;
const isURLSearchParameters = (object) => {
  return typeof object === "object" && typeof object.append === "function" && typeof object.delete === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.has === "function" && typeof object.set === "function" && typeof object.sort === "function" && object[NAME] === "URLSearchParams";
};
const isBlob = (object) => {
  return typeof object === "object" && typeof object.arrayBuffer === "function" && typeof object.type === "string" && typeof object.stream === "function" && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[NAME]);
};
function isFormData(object) {
  return typeof object === "object" && typeof object.append === "function" && typeof object.set === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.delete === "function" && typeof object.keys === "function" && typeof object.values === "function" && typeof object.entries === "function" && typeof object.constructor === "function" && object[NAME] === "FormData";
}
const isAbortSignal = (object) => {
  return typeof object === "object" && object[NAME] === "AbortSignal";
};
const carriage = "\r\n";
const dashes = "-".repeat(2);
const carriageLength = Buffer.byteLength(carriage);
const getFooter = (boundary) => `${dashes}${boundary}${dashes}${carriage.repeat(2)}`;
function getHeader(boundary, name, field) {
  let header = "";
  header += `${dashes}${boundary}${carriage}`;
  header += `Content-Disposition: form-data; name="${name}"`;
  if (isBlob(field)) {
    header += `; filename="${field.name}"${carriage}`;
    header += `Content-Type: ${field.type || "application/octet-stream"}`;
  }
  return `${header}${carriage.repeat(2)}`;
}
const getBoundary = () => randomBytes(8).toString("hex");
async function* formDataIterator(form, boundary) {
  for (const [name, value] of form) {
    yield getHeader(boundary, name, value);
    if (isBlob(value)) {
      yield* value.stream();
    } else {
      yield value;
    }
    yield carriage;
  }
  yield getFooter(boundary);
}
function getFormDataLength(form, boundary) {
  let length = 0;
  for (const [name, value] of form) {
    length += Buffer.byteLength(getHeader(boundary, name, value));
    if (isBlob(value)) {
      length += value.size;
    } else {
      length += Buffer.byteLength(String(value));
    }
    length += carriageLength;
  }
  length += Buffer.byteLength(getFooter(boundary));
  return length;
}
const INTERNALS$2 = Symbol("Body internals");
class Body {
  constructor(body, {
    size = 0
  } = {}) {
    let boundary = null;
    if (body === null) {
      body = null;
    } else if (isURLSearchParameters(body)) {
      body = Buffer.from(body.toString());
    } else if (isBlob(body))
      ;
    else if (Buffer.isBuffer(body))
      ;
    else if (types.isAnyArrayBuffer(body)) {
      body = Buffer.from(body);
    } else if (ArrayBuffer.isView(body)) {
      body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    } else if (body instanceof Stream)
      ;
    else if (isFormData(body)) {
      boundary = `NodeFetchFormDataBoundary${getBoundary()}`;
      body = Stream.Readable.from(formDataIterator(body, boundary));
    } else {
      body = Buffer.from(String(body));
    }
    this[INTERNALS$2] = {
      body,
      boundary,
      disturbed: false,
      error: null
    };
    this.size = size;
    if (body instanceof Stream) {
      body.on("error", (err) => {
        const error2 = err instanceof FetchBaseError ? err : new FetchError(`Invalid response body while trying to fetch ${this.url}: ${err.message}`, "system", err);
        this[INTERNALS$2].error = error2;
      });
    }
  }
  get body() {
    return this[INTERNALS$2].body;
  }
  get bodyUsed() {
    return this[INTERNALS$2].disturbed;
  }
  async arrayBuffer() {
    const {buffer, byteOffset, byteLength} = await consumeBody(this);
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  async blob() {
    const ct = this.headers && this.headers.get("content-type") || this[INTERNALS$2].body && this[INTERNALS$2].body.type || "";
    const buf = await this.buffer();
    return new fetchBlob([buf], {
      type: ct
    });
  }
  async json() {
    const buffer = await consumeBody(this);
    return JSON.parse(buffer.toString());
  }
  async text() {
    const buffer = await consumeBody(this);
    return buffer.toString();
  }
  buffer() {
    return consumeBody(this);
  }
}
Object.defineProperties(Body.prototype, {
  body: {enumerable: true},
  bodyUsed: {enumerable: true},
  arrayBuffer: {enumerable: true},
  blob: {enumerable: true},
  json: {enumerable: true},
  text: {enumerable: true}
});
async function consumeBody(data) {
  if (data[INTERNALS$2].disturbed) {
    throw new TypeError(`body used already for: ${data.url}`);
  }
  data[INTERNALS$2].disturbed = true;
  if (data[INTERNALS$2].error) {
    throw data[INTERNALS$2].error;
  }
  let {body} = data;
  if (body === null) {
    return Buffer.alloc(0);
  }
  if (isBlob(body)) {
    body = body.stream();
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (!(body instanceof Stream)) {
    return Buffer.alloc(0);
  }
  const accum = [];
  let accumBytes = 0;
  try {
    for await (const chunk of body) {
      if (data.size > 0 && accumBytes + chunk.length > data.size) {
        const err = new FetchError(`content size at ${data.url} over limit: ${data.size}`, "max-size");
        body.destroy(err);
        throw err;
      }
      accumBytes += chunk.length;
      accum.push(chunk);
    }
  } catch (error2) {
    if (error2 instanceof FetchBaseError) {
      throw error2;
    } else {
      throw new FetchError(`Invalid response body while trying to fetch ${data.url}: ${error2.message}`, "system", error2);
    }
  }
  if (body.readableEnded === true || body._readableState.ended === true) {
    try {
      if (accum.every((c) => typeof c === "string")) {
        return Buffer.from(accum.join(""));
      }
      return Buffer.concat(accum, accumBytes);
    } catch (error2) {
      throw new FetchError(`Could not create Buffer from response body for ${data.url}: ${error2.message}`, "system", error2);
    }
  } else {
    throw new FetchError(`Premature close of server response while trying to fetch ${data.url}`);
  }
}
const clone = (instance, highWaterMark) => {
  let p1;
  let p2;
  let {body} = instance;
  if (instance.bodyUsed) {
    throw new Error("cannot clone body after it is used");
  }
  if (body instanceof Stream && typeof body.getBoundary !== "function") {
    p1 = new PassThrough({highWaterMark});
    p2 = new PassThrough({highWaterMark});
    body.pipe(p1);
    body.pipe(p2);
    instance[INTERNALS$2].body = p1;
    body = p2;
  }
  return body;
};
const extractContentType = (body, request) => {
  if (body === null) {
    return null;
  }
  if (typeof body === "string") {
    return "text/plain;charset=UTF-8";
  }
  if (isURLSearchParameters(body)) {
    return "application/x-www-form-urlencoded;charset=UTF-8";
  }
  if (isBlob(body)) {
    return body.type || null;
  }
  if (Buffer.isBuffer(body) || types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
    return null;
  }
  if (body && typeof body.getBoundary === "function") {
    return `multipart/form-data;boundary=${body.getBoundary()}`;
  }
  if (isFormData(body)) {
    return `multipart/form-data; boundary=${request[INTERNALS$2].boundary}`;
  }
  if (body instanceof Stream) {
    return null;
  }
  return "text/plain;charset=UTF-8";
};
const getTotalBytes = (request) => {
  const {body} = request;
  if (body === null) {
    return 0;
  }
  if (isBlob(body)) {
    return body.size;
  }
  if (Buffer.isBuffer(body)) {
    return body.length;
  }
  if (body && typeof body.getLengthSync === "function") {
    return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
  }
  if (isFormData(body)) {
    return getFormDataLength(request[INTERNALS$2].boundary);
  }
  return null;
};
const writeToStream = (dest, {body}) => {
  if (body === null) {
    dest.end();
  } else if (isBlob(body)) {
    body.stream().pipe(dest);
  } else if (Buffer.isBuffer(body)) {
    dest.write(body);
    dest.end();
  } else {
    body.pipe(dest);
  }
};
const validateHeaderName = typeof http.validateHeaderName === "function" ? http.validateHeaderName : (name) => {
  if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name)) {
    const err = new TypeError(`Header name must be a valid HTTP token [${name}]`);
    Object.defineProperty(err, "code", {value: "ERR_INVALID_HTTP_TOKEN"});
    throw err;
  }
};
const validateHeaderValue = typeof http.validateHeaderValue === "function" ? http.validateHeaderValue : (name, value) => {
  if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
    const err = new TypeError(`Invalid character in header content ["${name}"]`);
    Object.defineProperty(err, "code", {value: "ERR_INVALID_CHAR"});
    throw err;
  }
};
class Headers extends URLSearchParams {
  constructor(init2) {
    let result = [];
    if (init2 instanceof Headers) {
      const raw = init2.raw();
      for (const [name, values] of Object.entries(raw)) {
        result.push(...values.map((value) => [name, value]));
      }
    } else if (init2 == null)
      ;
    else if (typeof init2 === "object" && !types.isBoxedPrimitive(init2)) {
      const method = init2[Symbol.iterator];
      if (method == null) {
        result.push(...Object.entries(init2));
      } else {
        if (typeof method !== "function") {
          throw new TypeError("Header pairs must be iterable");
        }
        result = [...init2].map((pair) => {
          if (typeof pair !== "object" || types.isBoxedPrimitive(pair)) {
            throw new TypeError("Each header pair must be an iterable object");
          }
          return [...pair];
        }).map((pair) => {
          if (pair.length !== 2) {
            throw new TypeError("Each header pair must be a name/value tuple");
          }
          return [...pair];
        });
      }
    } else {
      throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");
    }
    result = result.length > 0 ? result.map(([name, value]) => {
      validateHeaderName(name);
      validateHeaderValue(name, String(value));
      return [String(name).toLowerCase(), String(value)];
    }) : void 0;
    super(result);
    return new Proxy(this, {
      get(target, p, receiver) {
        switch (p) {
          case "append":
          case "set":
            return (name, value) => {
              validateHeaderName(name);
              validateHeaderValue(name, String(value));
              return URLSearchParams.prototype[p].call(receiver, String(name).toLowerCase(), String(value));
            };
          case "delete":
          case "has":
          case "getAll":
            return (name) => {
              validateHeaderName(name);
              return URLSearchParams.prototype[p].call(receiver, String(name).toLowerCase());
            };
          case "keys":
            return () => {
              target.sort();
              return new Set(URLSearchParams.prototype.keys.call(target)).keys();
            };
          default:
            return Reflect.get(target, p, receiver);
        }
      }
    });
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
  toString() {
    return Object.prototype.toString.call(this);
  }
  get(name) {
    const values = this.getAll(name);
    if (values.length === 0) {
      return null;
    }
    let value = values.join(", ");
    if (/^content-encoding$/i.test(name)) {
      value = value.toLowerCase();
    }
    return value;
  }
  forEach(callback) {
    for (const name of this.keys()) {
      callback(this.get(name), name);
    }
  }
  *values() {
    for (const name of this.keys()) {
      yield this.get(name);
    }
  }
  *entries() {
    for (const name of this.keys()) {
      yield [name, this.get(name)];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  raw() {
    return [...this.keys()].reduce((result, key) => {
      result[key] = this.getAll(key);
      return result;
    }, {});
  }
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return [...this.keys()].reduce((result, key) => {
      const values = this.getAll(key);
      if (key === "host") {
        result[key] = values[0];
      } else {
        result[key] = values.length > 1 ? values : values[0];
      }
      return result;
    }, {});
  }
}
Object.defineProperties(Headers.prototype, ["get", "entries", "forEach", "values"].reduce((result, property) => {
  result[property] = {enumerable: true};
  return result;
}, {}));
function fromRawHeaders(headers = []) {
  return new Headers(headers.reduce((result, value, index2, array) => {
    if (index2 % 2 === 0) {
      result.push(array.slice(index2, index2 + 2));
    }
    return result;
  }, []).filter(([name, value]) => {
    try {
      validateHeaderName(name);
      validateHeaderValue(name, String(value));
      return true;
    } catch (e) {
      return false;
    }
  }));
}
const redirectStatus = new Set([301, 302, 303, 307, 308]);
const isRedirect = (code) => {
  return redirectStatus.has(code);
};
const INTERNALS$1 = Symbol("Response internals");
class Response extends Body {
  constructor(body = null, options = {}) {
    super(body, options);
    const status = options.status || 200;
    const headers = new Headers(options.headers);
    if (body !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(body);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    this[INTERNALS$1] = {
      url: options.url,
      status,
      statusText: options.statusText || "",
      headers,
      counter: options.counter,
      highWaterMark: options.highWaterMark
    };
  }
  get url() {
    return this[INTERNALS$1].url || "";
  }
  get status() {
    return this[INTERNALS$1].status;
  }
  get ok() {
    return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
  }
  get redirected() {
    return this[INTERNALS$1].counter > 0;
  }
  get statusText() {
    return this[INTERNALS$1].statusText;
  }
  get headers() {
    return this[INTERNALS$1].headers;
  }
  get highWaterMark() {
    return this[INTERNALS$1].highWaterMark;
  }
  clone() {
    return new Response(clone(this, this.highWaterMark), {
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      ok: this.ok,
      redirected: this.redirected,
      size: this.size
    });
  }
  static redirect(url, status = 302) {
    if (!isRedirect(status)) {
      throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
    }
    return new Response(null, {
      headers: {
        location: new URL(url).toString()
      },
      status
    });
  }
  get [Symbol.toStringTag]() {
    return "Response";
  }
}
Object.defineProperties(Response.prototype, {
  url: {enumerable: true},
  status: {enumerable: true},
  ok: {enumerable: true},
  redirected: {enumerable: true},
  statusText: {enumerable: true},
  headers: {enumerable: true},
  clone: {enumerable: true}
});
const getSearch = (parsedURL) => {
  if (parsedURL.search) {
    return parsedURL.search;
  }
  const lastOffset = parsedURL.href.length - 1;
  const hash = parsedURL.hash || (parsedURL.href[lastOffset] === "#" ? "#" : "");
  return parsedURL.href[lastOffset - hash.length] === "?" ? "?" : "";
};
const INTERNALS = Symbol("Request internals");
const isRequest = (object) => {
  return typeof object === "object" && typeof object[INTERNALS] === "object";
};
class Request extends Body {
  constructor(input, init2 = {}) {
    let parsedURL;
    if (isRequest(input)) {
      parsedURL = new URL(input.url);
    } else {
      parsedURL = new URL(input);
      input = {};
    }
    let method = init2.method || input.method || "GET";
    method = method.toUpperCase();
    if ((init2.body != null || isRequest(input)) && input.body !== null && (method === "GET" || method === "HEAD")) {
      throw new TypeError("Request with GET/HEAD method cannot have body");
    }
    const inputBody = init2.body ? init2.body : isRequest(input) && input.body !== null ? clone(input) : null;
    super(inputBody, {
      size: init2.size || input.size || 0
    });
    const headers = new Headers(init2.headers || input.headers || {});
    if (inputBody !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(inputBody, this);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    let signal = isRequest(input) ? input.signal : null;
    if ("signal" in init2) {
      signal = init2.signal;
    }
    if (signal !== null && !isAbortSignal(signal)) {
      throw new TypeError("Expected signal to be an instanceof AbortSignal");
    }
    this[INTERNALS] = {
      method,
      redirect: init2.redirect || input.redirect || "follow",
      headers,
      parsedURL,
      signal
    };
    this.follow = init2.follow === void 0 ? input.follow === void 0 ? 20 : input.follow : init2.follow;
    this.compress = init2.compress === void 0 ? input.compress === void 0 ? true : input.compress : init2.compress;
    this.counter = init2.counter || input.counter || 0;
    this.agent = init2.agent || input.agent;
    this.highWaterMark = init2.highWaterMark || input.highWaterMark || 16384;
    this.insecureHTTPParser = init2.insecureHTTPParser || input.insecureHTTPParser || false;
  }
  get method() {
    return this[INTERNALS].method;
  }
  get url() {
    return format(this[INTERNALS].parsedURL);
  }
  get headers() {
    return this[INTERNALS].headers;
  }
  get redirect() {
    return this[INTERNALS].redirect;
  }
  get signal() {
    return this[INTERNALS].signal;
  }
  clone() {
    return new Request(this);
  }
  get [Symbol.toStringTag]() {
    return "Request";
  }
}
Object.defineProperties(Request.prototype, {
  method: {enumerable: true},
  url: {enumerable: true},
  headers: {enumerable: true},
  redirect: {enumerable: true},
  clone: {enumerable: true},
  signal: {enumerable: true}
});
const getNodeRequestOptions = (request) => {
  const {parsedURL} = request[INTERNALS];
  const headers = new Headers(request[INTERNALS].headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "*/*");
  }
  let contentLengthValue = null;
  if (request.body === null && /^(post|put)$/i.test(request.method)) {
    contentLengthValue = "0";
  }
  if (request.body !== null) {
    const totalBytes = getTotalBytes(request);
    if (typeof totalBytes === "number" && !Number.isNaN(totalBytes)) {
      contentLengthValue = String(totalBytes);
    }
  }
  if (contentLengthValue) {
    headers.set("Content-Length", contentLengthValue);
  }
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "node-fetch");
  }
  if (request.compress && !headers.has("Accept-Encoding")) {
    headers.set("Accept-Encoding", "gzip,deflate,br");
  }
  let {agent} = request;
  if (typeof agent === "function") {
    agent = agent(parsedURL);
  }
  if (!headers.has("Connection") && !agent) {
    headers.set("Connection", "close");
  }
  const search = getSearch(parsedURL);
  const requestOptions = {
    path: parsedURL.pathname + search,
    pathname: parsedURL.pathname,
    hostname: parsedURL.hostname,
    protocol: parsedURL.protocol,
    port: parsedURL.port,
    hash: parsedURL.hash,
    search: parsedURL.search,
    query: parsedURL.query,
    href: parsedURL.href,
    method: request.method,
    headers: headers[Symbol.for("nodejs.util.inspect.custom")](),
    insecureHTTPParser: request.insecureHTTPParser,
    agent
  };
  return requestOptions;
};
class AbortError extends FetchBaseError {
  constructor(message, type = "aborted") {
    super(message, type);
  }
}
const supportedSchemas = new Set(["data:", "http:", "https:"]);
async function fetch$1(url, options_) {
  return new Promise((resolve2, reject) => {
    const request = new Request(url, options_);
    const options = getNodeRequestOptions(request);
    if (!supportedSchemas.has(options.protocol)) {
      throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${options.protocol.replace(/:$/, "")}" is not supported.`);
    }
    if (options.protocol === "data:") {
      const data = src(request.url);
      const response2 = new Response(data, {headers: {"Content-Type": data.typeFull}});
      resolve2(response2);
      return;
    }
    const send = (options.protocol === "https:" ? https : http).request;
    const {signal} = request;
    let response = null;
    const abort = () => {
      const error2 = new AbortError("The operation was aborted.");
      reject(error2);
      if (request.body && request.body instanceof Stream.Readable) {
        request.body.destroy(error2);
      }
      if (!response || !response.body) {
        return;
      }
      response.body.emit("error", error2);
    };
    if (signal && signal.aborted) {
      abort();
      return;
    }
    const abortAndFinalize = () => {
      abort();
      finalize();
    };
    const request_ = send(options);
    if (signal) {
      signal.addEventListener("abort", abortAndFinalize);
    }
    const finalize = () => {
      request_.abort();
      if (signal) {
        signal.removeEventListener("abort", abortAndFinalize);
      }
    };
    request_.on("error", (err) => {
      reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, "system", err));
      finalize();
    });
    request_.on("response", (response_) => {
      request_.setTimeout(0);
      const headers = fromRawHeaders(response_.rawHeaders);
      if (isRedirect(response_.statusCode)) {
        const location = headers.get("Location");
        const locationURL = location === null ? null : new URL(location, request.url);
        switch (request.redirect) {
          case "error":
            reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, "no-redirect"));
            finalize();
            return;
          case "manual":
            if (locationURL !== null) {
              try {
                headers.set("Location", locationURL);
              } catch (error2) {
                reject(error2);
              }
            }
            break;
          case "follow": {
            if (locationURL === null) {
              break;
            }
            if (request.counter >= request.follow) {
              reject(new FetchError(`maximum redirect reached at: ${request.url}`, "max-redirect"));
              finalize();
              return;
            }
            const requestOptions = {
              headers: new Headers(request.headers),
              follow: request.follow,
              counter: request.counter + 1,
              agent: request.agent,
              compress: request.compress,
              method: request.method,
              body: request.body,
              signal: request.signal,
              size: request.size
            };
            if (response_.statusCode !== 303 && request.body && options_.body instanceof Stream.Readable) {
              reject(new FetchError("Cannot follow redirect with body being a readable stream", "unsupported-redirect"));
              finalize();
              return;
            }
            if (response_.statusCode === 303 || (response_.statusCode === 301 || response_.statusCode === 302) && request.method === "POST") {
              requestOptions.method = "GET";
              requestOptions.body = void 0;
              requestOptions.headers.delete("content-length");
            }
            resolve2(fetch$1(new Request(locationURL, requestOptions)));
            finalize();
            return;
          }
        }
      }
      response_.once("end", () => {
        if (signal) {
          signal.removeEventListener("abort", abortAndFinalize);
        }
      });
      let body = pipeline(response_, new PassThrough(), (error2) => {
        reject(error2);
      });
      if (process.version < "v12.10") {
        response_.on("aborted", abortAndFinalize);
      }
      const responseOptions = {
        url: request.url,
        status: response_.statusCode,
        statusText: response_.statusMessage,
        headers,
        size: request.size,
        counter: request.counter,
        highWaterMark: request.highWaterMark
      };
      const codings = headers.get("Content-Encoding");
      if (!request.compress || request.method === "HEAD" || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      const zlibOptions = {
        flush: zlib.Z_SYNC_FLUSH,
        finishFlush: zlib.Z_SYNC_FLUSH
      };
      if (codings === "gzip" || codings === "x-gzip") {
        body = pipeline(body, zlib.createGunzip(zlibOptions), (error2) => {
          reject(error2);
        });
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      if (codings === "deflate" || codings === "x-deflate") {
        const raw = pipeline(response_, new PassThrough(), (error2) => {
          reject(error2);
        });
        raw.once("data", (chunk) => {
          if ((chunk[0] & 15) === 8) {
            body = pipeline(body, zlib.createInflate(), (error2) => {
              reject(error2);
            });
          } else {
            body = pipeline(body, zlib.createInflateRaw(), (error2) => {
              reject(error2);
            });
          }
          response = new Response(body, responseOptions);
          resolve2(response);
        });
        return;
      }
      if (codings === "br") {
        body = pipeline(body, zlib.createBrotliDecompress(), (error2) => {
          reject(error2);
        });
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      response = new Response(body, responseOptions);
      resolve2(response);
    });
    writeToStream(request_, request);
  });
}
function noop() {
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
const subscriber_queue = [];
function writable(value, start = noop) {
  let stop;
  const subscribers = [];
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (let i = 0; i < subscribers.length; i += 1) {
          const s2 = subscribers[i];
          s2[1]();
          subscriber_queue.push(s2, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set(fn(value));
  }
  function subscribe(run2, invalidate = noop) {
    const subscriber = [run2, invalidate];
    subscribers.push(subscriber);
    if (subscribers.length === 1) {
      stop = start(set) || noop;
    }
    run2(value);
    return () => {
      const index2 = subscribers.indexOf(subscriber);
      if (index2 !== -1) {
        subscribers.splice(index2, 1);
      }
      if (subscribers.length === 0) {
        stop();
        stop = null;
      }
    };
  }
  return {set, update, subscribe};
}
function normalize(loaded) {
  if (loaded.error) {
    const error2 = typeof loaded.error === "string" ? new Error(loaded.error) : loaded.error;
    const status = loaded.status;
    if (!(error2 instanceof Error)) {
      return {
        status: 500,
        error: new Error(`"error" property returned from load() must be a string or instance of Error, received type "${typeof error2}"`)
      };
    }
    if (!status || status < 400 || status > 599) {
      console.warn('"error" returned from load() without a valid status code \u2014 defaulting to 500');
      return {status: 500, error: error2};
    }
    return {status, error: error2};
  }
  if (loaded.redirect) {
    if (!loaded.status || Math.floor(loaded.status / 100) !== 3) {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be accompanied by a 3xx status code')
      };
    }
    if (typeof loaded.redirect !== "string") {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be a string')
      };
    }
  }
  return loaded;
}
const s = JSON.stringify;
async function get_response({request, options, $session, route, status = 200, error: error2}) {
  const dependencies = {};
  const serialized_session = try_serialize($session, (error3) => {
    throw new Error(`Failed to serialize session data: ${error3.message}`);
  });
  const serialized_data = [];
  const match = route && route.pattern.exec(request.path);
  const params = route && route.params(match);
  const page = {
    host: request.host,
    path: request.path,
    query: request.query,
    params
  };
  let uses_credentials = false;
  const fetcher = async (resource, opts = {}) => {
    let url;
    if (typeof resource === "string") {
      url = resource;
    } else {
      url = resource.url;
      opts = {
        method: resource.method,
        headers: resource.headers,
        body: resource.body,
        mode: resource.mode,
        credentials: resource.credentials,
        cache: resource.cache,
        redirect: resource.redirect,
        referrer: resource.referrer,
        integrity: resource.integrity,
        ...opts
      };
    }
    if (options.local && url.startsWith(options.paths.assets)) {
      url = url.replace(options.paths.assets, "");
    }
    const parsed = parse(url);
    if (opts.credentials !== "omit") {
      uses_credentials = true;
    }
    let response;
    if (parsed.protocol) {
      response = await fetch$1(parsed.href, opts);
    } else {
      const resolved = resolve(request.path, parsed.pathname);
      const filename = resolved.slice(1);
      const filename_html = `${filename}/index.html`;
      const asset = options.manifest.assets.find((d2) => d2.file === filename || d2.file === filename_html);
      if (asset) {
        if (options.get_static_file) {
          response = new Response(options.get_static_file(asset.file), {
            headers: {
              "content-type": asset.type
            }
          });
        } else {
          response = await fetch$1(`http://${page.host}/${asset.file}`, opts);
        }
      }
      if (!response) {
        const rendered2 = await ssr({
          host: request.host,
          method: opts.method || "GET",
          headers: opts.headers || {},
          path: resolved,
          body: opts.body,
          query: new URLSearchParams$1(parsed.query || "")
        }, {
          ...options,
          fetched: url,
          initiator: route
        });
        if (rendered2) {
          dependencies[resolved] = rendered2;
          response = new Response(rendered2.body, {
            status: rendered2.status,
            headers: rendered2.headers
          });
        }
      }
    }
    if (response) {
      const headers2 = {};
      response.headers.forEach((value, key) => {
        if (key !== "etag")
          headers2[key] = value;
      });
      const inline = {
        url,
        payload: {
          status: response.status,
          statusText: response.statusText,
          headers: headers2,
          body: null
        }
      };
      const proxy = new Proxy(response, {
        get(response2, key, receiver) {
          if (key === "text") {
            return async () => {
              const text = await response2.text();
              inline.payload.body = text;
              serialized_data.push(inline);
              return text;
            };
          }
          if (key === "json") {
            return async () => {
              const json = await response2.json();
              inline.payload.body = s(json);
              serialized_data.push(inline);
              return json;
            };
          }
          return Reflect.get(response2, key, receiver);
        }
      });
      return proxy;
    }
    return new Response("Not found", {
      status: 404
    });
  };
  const component_promises = error2 ? [options.manifest.layout()] : [options.manifest.layout(), ...route.parts.map((part) => part.load())];
  const components2 = [];
  const props_promises = [];
  let context = {};
  let maxage;
  if (options.only_render_prerenderable_pages) {
    if (error2)
      return;
    const mod = await component_promises[component_promises.length - 1];
    if (!mod.prerender)
      return;
  }
  for (let i = 0; i < component_promises.length; i += 1) {
    let loaded;
    try {
      const mod = await component_promises[i];
      components2[i] = mod.default;
      if (mod.preload) {
        throw new Error("preload has been deprecated in favour of load. Please consult the documentation: https://kit.svelte.dev/docs#load");
      }
      if (mod.load) {
        loaded = await mod.load.call(null, {
          page,
          get session() {
            uses_credentials = true;
            return $session;
          },
          fetch: fetcher,
          context: {...context}
        });
        if (!loaded)
          return;
      }
    } catch (e) {
      if (error2)
        throw e instanceof Error ? e : new Error(e);
      loaded = {
        error: e instanceof Error ? e : {name: "Error", message: e.toString()},
        status: 500
      };
    }
    if (loaded) {
      loaded = normalize(loaded);
      if (loaded.error) {
        return await get_response({
          request,
          options,
          $session,
          route,
          status: loaded.status,
          error: loaded.error
        });
      }
      if (loaded.redirect) {
        return {
          status: loaded.status,
          headers: {
            location: loaded.redirect
          }
        };
      }
      if (loaded.context) {
        context = {
          ...context,
          ...loaded.context
        };
      }
      maxage = loaded.maxage || 0;
      props_promises[i] = loaded.props;
    }
  }
  const session = writable($session);
  let session_tracking_active = false;
  const unsubscribe = session.subscribe(() => {
    if (session_tracking_active)
      uses_credentials = true;
  });
  session_tracking_active = true;
  if (error2) {
    if (options.dev) {
      error2.stack = await options.get_stack(error2);
    } else {
      error2.stack = String(error2);
    }
  }
  const props = {
    status,
    error: error2,
    stores: {
      page: writable(null),
      navigating: writable(null),
      session
    },
    page,
    components: components2
  };
  for (let i = 0; i < props_promises.length; i += 1) {
    props[`props_${i}`] = await props_promises[i];
  }
  let rendered;
  try {
    rendered = options.root.render(props);
  } catch (e) {
    if (error2)
      throw e instanceof Error ? e : new Error(e);
    return await get_response({
      request,
      options,
      $session,
      route,
      status: 500,
      error: e instanceof Error ? e : {name: "Error", message: e.toString()}
    });
  }
  unsubscribe();
  const js_deps = route ? route.js : [];
  const css_deps = route ? route.css : [];
  const style = route ? route.style : "";
  const prefix = `${options.paths.assets}/${options.app_dir}`;
  const links = options.amp ? `<style amp-custom>${style || (await Promise.all(css_deps.map((dep) => options.get_amp_css(dep)))).join("\n")}</style>` : [
    ...js_deps.map((dep) => `<link rel="modulepreload" href="${prefix}/${dep}">`),
    ...css_deps.map((dep) => `<link rel="stylesheet" href="${prefix}/${dep}">`)
  ].join("\n			");
  const init2 = options.amp ? `
		<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>
		<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
		<script async src="https://cdn.ampproject.org/v0.js"></script>` : `
		<script type="module">
			import { start } from ${s(options.entry)};
			start({
				target: ${options.target ? `document.querySelector(${s(options.target)})` : "document.body"},
				paths: ${s(options.paths)},
				status: ${status},
				error: ${serialize_error(error2)},
				session: ${serialized_session},
				nodes: [
					${(route ? route.parts : []).map((part) => `import(${s(options.get_component_path(part.id))})`).join(",\n					")}
				],
				page: {
					host: ${s(request.host || "location.host")},
					path: ${s(request.path)},
					query: new URLSearchParams(${s(request.query.toString())}),
					params: ${s(params)}
				}
			});
		</script>`;
  const head = [
    rendered.head,
    style && !options.amp ? `<style data-svelte>${style}</style>` : "",
    links,
    init2
  ].join("\n\n");
  const body = options.amp ? rendered.html : `${rendered.html}

			${serialized_data.map(({url, payload}) => `<script type="svelte-data" url="${url}">${s(payload)}</script>`).join("\n\n			")}
		`.replace(/^\t{2}/gm, "");
  const headers = {
    "content-type": "text/html"
  };
  if (maxage) {
    headers["cache-control"] = `${uses_credentials ? "private" : "public"}, max-age=${maxage}`;
  }
  return {
    status,
    headers,
    body: options.template({head, body}),
    dependencies
  };
}
async function render_page(request, route, options) {
  if (options.initiator === route) {
    return {
      status: 404,
      headers: {},
      body: `Not found: ${request.path}`
    };
  }
  const $session = await options.hooks.getSession({context: request.context});
  const response = await get_response({
    request,
    options,
    $session,
    route,
    status: route ? 200 : 404,
    error: route ? null : new Error(`Not found: ${request.path}`)
  });
  if (response) {
    return response;
  }
  if (options.fetched) {
    return {
      status: 500,
      headers: {},
      body: `Bad request in load function: failed to fetch ${options.fetched}`
    };
  }
}
function try_serialize(data, fail) {
  try {
    return devalue(data);
  } catch (err) {
    if (fail)
      fail(err);
    return null;
  }
}
function serialize_error(error2) {
  if (!error2)
    return null;
  let serialized = try_serialize(error2);
  if (!serialized) {
    const {name, message, stack} = error2;
    serialized = try_serialize({name, message, stack});
  }
  if (!serialized) {
    serialized = "{}";
  }
  return serialized;
}
async function render_route(request, route) {
  const mod = await route.load();
  const handler = mod[request.method.toLowerCase().replace("delete", "del")];
  if (handler) {
    const match = route.pattern.exec(request.path);
    const params = route.params(match);
    const response = await handler({...request, params});
    if (response) {
      if (typeof response !== "object" || response.body == null) {
        return {
          status: 500,
          body: `Invalid response from route ${request.path}; ${response.body == null ? "body is missing" : `expected an object, got ${typeof response}`}`,
          headers: {}
        };
      }
      let {status = 200, body, headers = {}} = response;
      headers = lowercase_keys(headers);
      if (typeof body === "object" && !("content-type" in headers) || headers["content-type"] === "application/json") {
        headers = {...headers, "content-type": "application/json"};
        body = JSON.stringify(body);
      }
      return {status, body, headers};
    }
  }
}
function lowercase_keys(obj) {
  const clone2 = {};
  for (const key in obj) {
    clone2[key.toLowerCase()] = obj[key];
  }
  return clone2;
}
function md5(body) {
  return createHash("md5").update(body).digest("hex");
}
async function ssr(incoming, options) {
  if (incoming.path.endsWith("/") && incoming.path !== "/") {
    const q = incoming.query.toString();
    return {
      status: 301,
      headers: {
        location: incoming.path.slice(0, -1) + (q ? `?${q}` : "")
      }
    };
  }
  const context = await options.hooks.getContext(incoming) || {};
  try {
    return await options.hooks.handle({
      ...incoming,
      params: null,
      context
    }, async (request) => {
      for (const route of options.manifest.routes) {
        if (!route.pattern.test(request.path))
          continue;
        const response = route.type === "endpoint" ? await render_route(request, route) : await render_page(request, route, options);
        if (response) {
          if (response.status === 200) {
            if (!/(no-store|immutable)/.test(response.headers["cache-control"])) {
              const etag = `"${md5(response.body)}"`;
              if (request.headers["if-none-match"] === etag) {
                return {
                  status: 304,
                  headers: {},
                  body: null
                };
              }
              response.headers["etag"] = etag;
            }
          }
          return response;
        }
      }
      return await render_page(request, null, options);
    });
  } catch (e) {
    if (e && e.stack) {
      e.stack = await options.get_stack(e);
    }
    console.error(e && e.stack || e);
    return {
      status: 500,
      headers: {},
      body: options.dev ? e.stack : e.message
    };
  }
}
function run(fn) {
  return fn();
}
function blank_object() {
  return Object.create(null);
}
function run_all(fns) {
  fns.forEach(run);
}
let current_component;
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component)
    throw new Error("Function called outside component initialization");
  return current_component;
}
function onMount(fn) {
  get_current_component().$$.on_mount.push(fn);
}
function afterUpdate(fn) {
  get_current_component().$$.after_update.push(fn);
}
function setContext(key, context) {
  get_current_component().$$.context.set(key, context);
}
const escaped = {
  '"': "&quot;",
  "'": "&#39;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
};
function escape$1(html) {
  return String(html).replace(/["'&<>]/g, (match) => escaped[match]);
}
function each(items, fn) {
  let str = "";
  for (let i = 0; i < items.length; i += 1) {
    str += fn(items[i], i);
  }
  return str;
}
const missing_component = {
  $$render: () => ""
};
function validate_component(component, name) {
  if (!component || !component.$$render) {
    if (name === "svelte:component")
      name += " this={...}";
    throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
  }
  return component;
}
let on_destroy;
function create_ssr_component(fn) {
  function $$render(result, props, bindings, slots) {
    const parent_component = current_component;
    const $$ = {
      on_destroy,
      context: new Map(parent_component ? parent_component.$$.context : []),
      on_mount: [],
      before_update: [],
      after_update: [],
      callbacks: blank_object()
    };
    set_current_component({$$});
    const html = fn(result, props, bindings, slots);
    set_current_component(parent_component);
    return html;
  }
  return {
    render: (props = {}, options = {}) => {
      on_destroy = [];
      const result = {title: "", head: "", css: new Set()};
      const html = $$render(result, props, {}, options);
      run_all(on_destroy);
      return {
        html,
        css: {
          code: Array.from(result.css).map((css2) => css2.code).join("\n"),
          map: null
        },
        head: result.title + result.head
      };
    },
    $$render
  };
}
const Error$1 = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {status} = $$props;
  let {error: error2} = $$props;
  if ($$props.status === void 0 && $$bindings.status && status !== void 0)
    $$bindings.status(status);
  if ($$props.error === void 0 && $$bindings.error && error2 !== void 0)
    $$bindings.error(error2);
  return `<h1>${escape$1(status)}</h1>

<p>${escape$1(error2.message)}</p>


${error2.stack ? `<pre>${escape$1(error2.stack)}</pre>` : ``}`;
});
var error = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Error$1
});
var root_svelte = "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}";
const css$3 = {
  code: "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}",
  map: `{"version":3,"file":"root.svelte","sources":["root.svelte"],"sourcesContent":["<!-- This file is generated by @sveltejs/kit \u2014 do not edit it! -->\\n<script>\\n\\timport { setContext, afterUpdate, onMount } from 'svelte';\\n\\timport ErrorComponent from \\"../components/error.svelte\\";\\n\\n\\t// error handling\\n\\texport let status = undefined;\\n\\texport let error = undefined;\\n\\n\\t// stores\\n\\texport let stores;\\n\\texport let page;\\n\\n\\texport let components;\\n\\texport let props_0 = null;\\n\\texport let props_1 = null;\\n\\n\\tconst Layout = components[0];\\n\\n\\tsetContext('__svelte__', stores);\\n\\n\\t$: stores.page.set(page);\\n\\tafterUpdate(stores.page.notify);\\n\\n\\tlet mounted = false;\\n\\tlet navigated = false;\\n\\tlet title = null;\\n\\n\\tonMount(() => {\\n\\t\\tconst unsubscribe = stores.page.subscribe(() => {\\n\\t\\t\\tif (mounted) {\\n\\t\\t\\t\\tnavigated = true;\\n\\t\\t\\t\\ttitle = document.title;\\n\\t\\t\\t}\\n\\t\\t});\\n\\n\\t\\tmounted = true;\\n\\t\\treturn unsubscribe;\\n\\t});\\n</script>\\n\\n<Layout {...(props_0 || {})}>\\n\\t{#if error}\\n\\t\\t<ErrorComponent {status} {error}/>\\n\\t{:else}\\n\\t\\t<svelte:component this={components[1]} {...(props_1 || {})}/>\\n\\t{/if}\\n</Layout>\\n\\n{#if mounted}\\n\\t<div id=\\"svelte-announcer\\" aria-live=\\"assertive\\" aria-atomic=\\"true\\">\\n\\t\\t{#if navigated}\\n\\t\\t\\tNavigated to {title}\\n\\t\\t{/if}\\n\\t</div>\\n{/if}\\n\\n<style>\\n\\t#svelte-announcer {\\n\\t\\tposition: absolute;\\n\\t\\tleft: 0;\\n\\t\\ttop: 0;\\n\\t\\tclip: rect(0 0 0 0);\\n\\t\\tclip-path: inset(50%);\\n\\t\\toverflow: hidden;\\n\\t\\twhite-space: nowrap;\\n\\t\\twidth: 1px;\\n\\t\\theight: 1px;\\n\\t}\\n</style>"],"names":[],"mappings":"AA0DC,iBAAiB,eAAC,CAAC,AAClB,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,CAAC,CACP,GAAG,CAAE,CAAC,CACN,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CACnB,SAAS,CAAE,MAAM,GAAG,CAAC,CACrB,QAAQ,CAAE,MAAM,CAChB,WAAW,CAAE,MAAM,CACnB,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,GAAG,AACZ,CAAC"}`
};
const Root = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {status = void 0} = $$props;
  let {error: error2 = void 0} = $$props;
  let {stores} = $$props;
  let {page} = $$props;
  let {components: components2} = $$props;
  let {props_0 = null} = $$props;
  let {props_1 = null} = $$props;
  const Layout = components2[0];
  setContext("__svelte__", stores);
  afterUpdate(stores.page.notify);
  let mounted = false;
  let navigated = false;
  let title = null;
  onMount(() => {
    const unsubscribe = stores.page.subscribe(() => {
      if (mounted) {
        navigated = true;
        title = document.title;
      }
    });
    mounted = true;
    return unsubscribe;
  });
  if ($$props.status === void 0 && $$bindings.status && status !== void 0)
    $$bindings.status(status);
  if ($$props.error === void 0 && $$bindings.error && error2 !== void 0)
    $$bindings.error(error2);
  if ($$props.stores === void 0 && $$bindings.stores && stores !== void 0)
    $$bindings.stores(stores);
  if ($$props.page === void 0 && $$bindings.page && page !== void 0)
    $$bindings.page(page);
  if ($$props.components === void 0 && $$bindings.components && components2 !== void 0)
    $$bindings.components(components2);
  if ($$props.props_0 === void 0 && $$bindings.props_0 && props_0 !== void 0)
    $$bindings.props_0(props_0);
  if ($$props.props_1 === void 0 && $$bindings.props_1 && props_1 !== void 0)
    $$bindings.props_1(props_1);
  $$result.css.add(css$3);
  {
    stores.page.set(page);
  }
  return `


${validate_component(Layout, "Layout").$$render($$result, Object.assign(props_0 || {}), {}, {
    default: () => `${error2 ? `${validate_component(Error$1, "ErrorComponent").$$render($$result, {status, error: error2}, {}, {})}` : `${validate_component(components2[1] || missing_component, "svelte:component").$$render($$result, Object.assign(props_1 || {}), {}, {})}`}`
  })}

${mounted ? `<div id="${"svelte-announcer"}" aria-live="${"assertive"}" aria-atomic="${"true"}" class="${"svelte-1j55zn5"}">${navigated ? `Navigated to ${escape$1(title)}` : ``}</div>` : ``}`;
});
var user_hooks = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module"
});
const template = ({head, body}) => '<!DOCTYPE html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<link rel="icon" href="/favicon.ico" />\n		<meta name="viewport" content="width=device-width, initial-scale=1" />\n		' + head + '\n	</head>\n	<body>\n		<div id="svelte">' + body + "</div>\n	</body>\n</html>\n";
function init({paths}) {
}
const d = decodeURIComponent;
const empty = () => ({});
const components = [
  () => Promise.resolve().then(function() {
    return index$1;
  }),
  () => Promise.resolve().then(function() {
    return index;
  }),
  () => Promise.resolve().then(function() {
    return _slug_;
  })
];
const client_component_lookup = {".svelte/build/runtime/internal/start.js": "start-24ccbae2.js", "src/routes/index.svelte": "pages/index.svelte-ab984603.js", "src/routes/blog/index.svelte": "pages/blog/index.svelte-90bdc3c2.js", "src/routes/blog/[slug].svelte": "pages/blog/[slug].svelte-02dc370f.js"};
const manifest = {
  assets: [{file: "favicon.ico", size: 1150, type: "image/vnd.microsoft.icon"}, {file: "images/hello-world.jpg", size: 281972, type: "image/jpeg"}, {file: "images/image-test.jpg", size: 185835, type: "image/jpeg"}, {file: "posts/posts.json", size: 0, type: "application/json"}, {file: "robots.txt", size: 67, type: "text/plain"}, {file: "shader/fragment.glsl", size: 129, type: null}, {file: "shader/vertex.glsl", size: 121, type: null}],
  layout: () => Promise.resolve().then(function() {
    return $layout$1;
  }),
  error: () => Promise.resolve().then(function() {
    return error;
  }),
  routes: [
    {
      type: "page",
      pattern: /^\/$/,
      params: empty,
      parts: [{id: "src/routes/index.svelte", load: components[0]}],
      css: ["assets/start-37120146.css"],
      js: ["start-24ccbae2.js", "chunks/vendor-d7b15c1b.js", "pages/index.svelte-ab984603.js"]
    },
    {
      type: "endpoint",
      pattern: /^\/blog\.json$/,
      params: empty,
      load: () => Promise.resolve().then(function() {
        return index_json;
      })
    },
    {
      type: "page",
      pattern: /^\/blog\/?$/,
      params: empty,
      parts: [{id: "src/routes/blog/index.svelte", load: components[1]}],
      css: ["assets/start-37120146.css", "assets/pages/blog/index.svelte-3e33c33a.css"],
      js: ["start-24ccbae2.js", "chunks/vendor-d7b15c1b.js", "pages/blog/index.svelte-90bdc3c2.js"]
    },
    {
      type: "endpoint",
      pattern: /^\/blog\/([^/]+?)\.json$/,
      params: (m) => ({slug: d(m[1])}),
      load: () => Promise.resolve().then(function() {
        return _slug__json;
      })
    },
    {
      type: "page",
      pattern: /^\/blog\/([^/]+?)\/?$/,
      params: (m) => ({slug: d(m[1])}),
      parts: [{id: "src/routes/blog/[slug].svelte", load: components[2]}],
      css: ["assets/start-37120146.css"],
      js: ["start-24ccbae2.js", "chunks/vendor-d7b15c1b.js", "pages/blog/[slug].svelte-02dc370f.js"]
    }
  ]
};
const get_hooks = (hooks2) => ({
  getContext: hooks2.getContext || (() => ({})),
  getSession: hooks2.getSession || (() => ({})),
  handle: hooks2.handle || ((request, render2) => render2(request))
});
const hooks = get_hooks(user_hooks);
function render(request, {
  paths = {base: "", assets: "/."},
  local = false,
  only_render_prerenderable_pages = false,
  get_static_file
} = {}) {
  return ssr({
    ...request,
    host: request.headers["host"]
  }, {
    paths,
    local,
    template,
    manifest,
    target: "#svelte",
    entry: "/./_app/start-24ccbae2.js",
    root: Root,
    hooks,
    dev: false,
    amp: false,
    only_render_prerenderable_pages,
    app_dir: "_app",
    get_component_path: (id) => "/./_app/" + client_component_lookup[id],
    get_stack: (error2) => error2.stack,
    get_static_file,
    get_amp_css: (dep) => amp_css_lookup[dep]
  });
}
const Routes = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<main></main>`;
});
var index$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Routes
});
var index_svelte = "ul.svelte-14k2xmx.svelte-14k2xmx{margin:0;padding:0}ul.svelte-14k2xmx li.svelte-14k2xmx{list-style:none;max-width:1280px;margin:0 auto}ul.svelte-14k2xmx li.svelte-14k2xmx:last-child{margin-right:0}.post.svelte-14k2xmx.svelte-14k2xmx{display:block;background-size:cover;background-position:center;background-repeat:no-repeat}.post.svelte-14k2xmx img.svelte-14k2xmx{width:100%;object-fit:cover;max-height:500px}";
const css$2 = {
  code: "ul.svelte-14k2xmx.svelte-14k2xmx{margin:0;padding:0}ul.svelte-14k2xmx li.svelte-14k2xmx{list-style:none;max-width:1280px;margin:0 auto}ul.svelte-14k2xmx li.svelte-14k2xmx:last-child{margin-right:0}.post.svelte-14k2xmx.svelte-14k2xmx{display:block;background-size:cover;background-position:center;background-repeat:no-repeat}.post.svelte-14k2xmx img.svelte-14k2xmx{width:100%;object-fit:cover;max-height:500px}",
  map: '{"version":3,"file":"index.svelte","sources":["index.svelte"],"sourcesContent":["<script context=\\"module\\">\\n\\texport async function load({fetch}) {\\n\\t\\tconst res = await fetch(`https://eric-portfolio.ghost.io/ghost/api/v3/content/posts/?key=0c0619aa6637854338d7d12d14`)\\n\\t\\t.then(res => {\\n\\t\\t\\t\\treturn res.json();\\n\\t\\t\\t}\\n\\t\\t);\\n\\n\\t\\ttry {\\n\\t\\t\\treturn {\\n\\t\\t\\t\\tprops: {\\n\\t\\t\\t\\t\\tjsonPosts: res\\n\\t\\t\\t\\t}\\n\\t\\t\\t}\\n\\t\\t} catch(err) {\\n\\t\\t\\tconsole.log(err);\\n\\t\\t}\\n\\n\\t}\\n\\n\\n</script>\\n\\n<script lang=\\"ts\\">export let jsonPosts;\\nconst posts = jsonPosts.posts;\\n</script>\\n<section>\\n\\t<h1>Posts</h1>\\n\\t<ul>\\n\\t\\t{#each posts as post}\\n\\t\\t<li>\\n\\t\\t\\t<a class=\\"post\\" href=\\"/blog/{post.slug}\\">\\n\\t\\t\\t\\t<img src=\\"static/images/{post.slug}.jpg\\">\\n\\t\\t\\t\\t<p>\\n\\t\\t\\t\\t\\t{post.title}\\n\\t\\t\\t\\t</p>\\n\\t\\t\\t</a>\\n\\t\\t</li>\\n\\t\\t{/each}\\n\\t</ul>\\n</section>\\n\\n<style lang=\\"scss\\">canvas {\\n  display: block;\\n}\\n\\nul {\\n  margin: 0;\\n  padding: 0;\\n}\\nul li {\\n  list-style: none;\\n  max-width: 1280px;\\n  margin: 0 auto;\\n}\\nul li:last-child {\\n  margin-right: 0;\\n}\\n\\n.post {\\n  display: block;\\n  background-size: cover;\\n  background-position: center;\\n  background-repeat: no-repeat;\\n}\\n.post img {\\n  width: 100%;\\n  object-fit: cover;\\n  max-height: 500px;\\n}</style>\\n"],"names":[],"mappings":"AA8CA,EAAE,8BAAC,CAAC,AACF,MAAM,CAAE,CAAC,CACT,OAAO,CAAE,CAAC,AACZ,CAAC,AACD,iBAAE,CAAC,EAAE,eAAC,CAAC,AACL,UAAU,CAAE,IAAI,CAChB,SAAS,CAAE,MAAM,CACjB,MAAM,CAAE,CAAC,CAAC,IAAI,AAChB,CAAC,AACD,iBAAE,CAAC,iBAAE,WAAW,AAAC,CAAC,AAChB,YAAY,CAAE,CAAC,AACjB,CAAC,AAED,KAAK,8BAAC,CAAC,AACL,OAAO,CAAE,KAAK,CACd,eAAe,CAAE,KAAK,CACtB,mBAAmB,CAAE,MAAM,CAC3B,iBAAiB,CAAE,SAAS,AAC9B,CAAC,AACD,oBAAK,CAAC,GAAG,eAAC,CAAC,AACT,KAAK,CAAE,IAAI,CACX,UAAU,CAAE,KAAK,CACjB,UAAU,CAAE,KAAK,AACnB,CAAC"}'
};
async function load$1({fetch: fetch2}) {
  const res = await fetch2(`https://eric-portfolio.ghost.io/ghost/api/v3/content/posts/?key=0c0619aa6637854338d7d12d14`).then((res2) => {
    return res2.json();
  });
  try {
    return {props: {jsonPosts: res}};
  } catch (err) {
    console.log(err);
  }
}
const Blog = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {jsonPosts} = $$props;
  const posts2 = jsonPosts.posts;
  if ($$props.jsonPosts === void 0 && $$bindings.jsonPosts && jsonPosts !== void 0)
    $$bindings.jsonPosts(jsonPosts);
  $$result.css.add(css$2);
  return `<section><h1>Posts</h1>
	<ul class="${"svelte-14k2xmx"}">${each(posts2, (post) => `<li class="${"svelte-14k2xmx"}"><a class="${"post svelte-14k2xmx"}" href="${"/blog/" + escape$1(post.slug)}"><img src="${"static/images/" + escape$1(post.slug) + ".jpg"}" class="${"svelte-14k2xmx"}">
				<p>${escape$1(post.title)}
				</p></a>
		</li>`)}</ul>
</section>`;
});
var index = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Blog,
  load: load$1
});
async function load({fetch: fetch2, page}) {
  let slug = page.params.slug;
  const res = await fetch2(`https://eric-portfolio.ghost.io/ghost/api/v3/content/posts/slug/${slug}/?key=0c0619aa6637854338d7d12d14`).then((res2) => {
    return res2.json();
  });
  try {
    return {props: {post: res.posts[0]}};
  } catch (err) {
    console.log(err);
  }
}
const U5Bslugu5D = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {post} = $$props;
  if ($$props.post === void 0 && $$bindings.post && post !== void 0)
    $$bindings.post(post);
  return `${$$result.head += `${$$result.title = `<title>${escape$1(post.title)}</title>`, ""}`, ""}

<h1>${escape$1(post.title)}</h1>
<div class="${"post"}">${post.html}</div>`;
});
var _slug_ = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: U5Bslugu5D,
  load
});
var Nav_svelte = "nav.svelte-ukjl08 a.svelte-ukjl08{color:black}";
const css$1 = {
  code: "nav.svelte-ukjl08 a.svelte-ukjl08{color:black}",
  map: '{"version":3,"file":"Nav.svelte","sources":["Nav.svelte"],"sourcesContent":["<script>\\n\\n</script>\\n\\n<nav>\\n    <a href=\\"/\\">Home</a>\\n    <a href=\\"/blog\\">blog</a>\\n</nav>\\n\\n<style lang=\\"scss\\">nav a {\\n  color: black;\\n}</style>"],"names":[],"mappings":"AASmB,iBAAG,CAAC,CAAC,cAAC,CAAC,AACxB,KAAK,CAAE,KAAK,AACd,CAAC"}'
};
const Nav = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  $$result.css.add(css$1);
  return `<nav class="${"svelte-ukjl08"}"><a href="${"/"}" class="${"svelte-ukjl08"}">Home</a>
    <a href="${"/blog"}" class="${"svelte-ukjl08"}">blog</a>
</nav>`;
});
const Footer = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return `<footer>Copyright 2021 - Eric Lam</footer>`;
});
const REVISION = "126";
const CullFaceNone = 0;
const CullFaceBack = 1;
const CullFaceFront = 2;
const PCFShadowMap = 1;
const PCFSoftShadowMap = 2;
const VSMShadowMap = 3;
const FrontSide = 0;
const BackSide = 1;
const DoubleSide = 2;
const FlatShading = 1;
const NoBlending = 0;
const NormalBlending = 1;
const AdditiveBlending = 2;
const SubtractiveBlending = 3;
const MultiplyBlending = 4;
const CustomBlending = 5;
const AddEquation = 100;
const SubtractEquation = 101;
const ReverseSubtractEquation = 102;
const MinEquation = 103;
const MaxEquation = 104;
const ZeroFactor = 200;
const OneFactor = 201;
const SrcColorFactor = 202;
const OneMinusSrcColorFactor = 203;
const SrcAlphaFactor = 204;
const OneMinusSrcAlphaFactor = 205;
const DstAlphaFactor = 206;
const OneMinusDstAlphaFactor = 207;
const DstColorFactor = 208;
const OneMinusDstColorFactor = 209;
const SrcAlphaSaturateFactor = 210;
const NeverDepth = 0;
const AlwaysDepth = 1;
const LessDepth = 2;
const LessEqualDepth = 3;
const EqualDepth = 4;
const GreaterEqualDepth = 5;
const GreaterDepth = 6;
const NotEqualDepth = 7;
const MultiplyOperation = 0;
const MixOperation = 1;
const AddOperation = 2;
const NoToneMapping = 0;
const LinearToneMapping = 1;
const ReinhardToneMapping = 2;
const CineonToneMapping = 3;
const ACESFilmicToneMapping = 4;
const CustomToneMapping = 5;
const UVMapping = 300;
const CubeReflectionMapping = 301;
const CubeRefractionMapping = 302;
const EquirectangularReflectionMapping = 303;
const EquirectangularRefractionMapping = 304;
const CubeUVReflectionMapping = 306;
const CubeUVRefractionMapping = 307;
const RepeatWrapping = 1e3;
const ClampToEdgeWrapping = 1001;
const MirroredRepeatWrapping = 1002;
const NearestFilter = 1003;
const NearestMipmapNearestFilter = 1004;
const NearestMipmapLinearFilter = 1005;
const LinearFilter = 1006;
const LinearMipmapNearestFilter = 1007;
const LinearMipmapLinearFilter = 1008;
const UnsignedByteType = 1009;
const ByteType = 1010;
const ShortType = 1011;
const UnsignedShortType = 1012;
const IntType = 1013;
const UnsignedIntType = 1014;
const FloatType = 1015;
const HalfFloatType = 1016;
const UnsignedShort4444Type = 1017;
const UnsignedShort5551Type = 1018;
const UnsignedShort565Type = 1019;
const UnsignedInt248Type = 1020;
const AlphaFormat = 1021;
const RGBFormat = 1022;
const RGBAFormat = 1023;
const LuminanceFormat = 1024;
const LuminanceAlphaFormat = 1025;
const DepthFormat = 1026;
const DepthStencilFormat = 1027;
const RedFormat = 1028;
const RedIntegerFormat = 1029;
const RGFormat = 1030;
const RGIntegerFormat = 1031;
const RGBIntegerFormat = 1032;
const RGBAIntegerFormat = 1033;
const RGB_S3TC_DXT1_Format = 33776;
const RGBA_S3TC_DXT1_Format = 33777;
const RGBA_S3TC_DXT3_Format = 33778;
const RGBA_S3TC_DXT5_Format = 33779;
const RGB_PVRTC_4BPPV1_Format = 35840;
const RGB_PVRTC_2BPPV1_Format = 35841;
const RGBA_PVRTC_4BPPV1_Format = 35842;
const RGBA_PVRTC_2BPPV1_Format = 35843;
const RGB_ETC1_Format = 36196;
const RGB_ETC2_Format = 37492;
const RGBA_ETC2_EAC_Format = 37496;
const RGBA_ASTC_4x4_Format = 37808;
const RGBA_ASTC_5x4_Format = 37809;
const RGBA_ASTC_5x5_Format = 37810;
const RGBA_ASTC_6x5_Format = 37811;
const RGBA_ASTC_6x6_Format = 37812;
const RGBA_ASTC_8x5_Format = 37813;
const RGBA_ASTC_8x6_Format = 37814;
const RGBA_ASTC_8x8_Format = 37815;
const RGBA_ASTC_10x5_Format = 37816;
const RGBA_ASTC_10x6_Format = 37817;
const RGBA_ASTC_10x8_Format = 37818;
const RGBA_ASTC_10x10_Format = 37819;
const RGBA_ASTC_12x10_Format = 37820;
const RGBA_ASTC_12x12_Format = 37821;
const RGBA_BPTC_Format = 36492;
const SRGB8_ALPHA8_ASTC_4x4_Format = 37840;
const SRGB8_ALPHA8_ASTC_5x4_Format = 37841;
const SRGB8_ALPHA8_ASTC_5x5_Format = 37842;
const SRGB8_ALPHA8_ASTC_6x5_Format = 37843;
const SRGB8_ALPHA8_ASTC_6x6_Format = 37844;
const SRGB8_ALPHA8_ASTC_8x5_Format = 37845;
const SRGB8_ALPHA8_ASTC_8x6_Format = 37846;
const SRGB8_ALPHA8_ASTC_8x8_Format = 37847;
const SRGB8_ALPHA8_ASTC_10x5_Format = 37848;
const SRGB8_ALPHA8_ASTC_10x6_Format = 37849;
const SRGB8_ALPHA8_ASTC_10x8_Format = 37850;
const SRGB8_ALPHA8_ASTC_10x10_Format = 37851;
const SRGB8_ALPHA8_ASTC_12x10_Format = 37852;
const SRGB8_ALPHA8_ASTC_12x12_Format = 37853;
const ZeroCurvatureEnding = 2400;
const ZeroSlopeEnding = 2401;
const WrapAroundEnding = 2402;
const TrianglesDrawMode = 0;
const LinearEncoding = 3e3;
const sRGBEncoding = 3001;
const GammaEncoding = 3007;
const RGBEEncoding = 3002;
const LogLuvEncoding = 3003;
const RGBM7Encoding = 3004;
const RGBM16Encoding = 3005;
const RGBDEncoding = 3006;
const BasicDepthPacking = 3200;
const RGBADepthPacking = 3201;
const TangentSpaceNormalMap = 0;
const ObjectSpaceNormalMap = 1;
const KeepStencilOp = 7680;
const AlwaysStencilFunc = 519;
const StaticDrawUsage = 35044;
const DynamicDrawUsage = 35048;
const GLSL3 = "300 es";
function EventDispatcher() {
}
Object.assign(EventDispatcher.prototype, {
  addEventListener: function(type, listener) {
    if (this._listeners === void 0)
      this._listeners = {};
    const listeners = this._listeners;
    if (listeners[type] === void 0) {
      listeners[type] = [];
    }
    if (listeners[type].indexOf(listener) === -1) {
      listeners[type].push(listener);
    }
  },
  hasEventListener: function(type, listener) {
    if (this._listeners === void 0)
      return false;
    const listeners = this._listeners;
    return listeners[type] !== void 0 && listeners[type].indexOf(listener) !== -1;
  },
  removeEventListener: function(type, listener) {
    if (this._listeners === void 0)
      return;
    const listeners = this._listeners;
    const listenerArray = listeners[type];
    if (listenerArray !== void 0) {
      const index2 = listenerArray.indexOf(listener);
      if (index2 !== -1) {
        listenerArray.splice(index2, 1);
      }
    }
  },
  dispatchEvent: function(event) {
    if (this._listeners === void 0)
      return;
    const listeners = this._listeners;
    const listenerArray = listeners[event.type];
    if (listenerArray !== void 0) {
      event.target = this;
      const array = listenerArray.slice(0);
      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, event);
      }
    }
  }
});
const _lut = [];
for (let i = 0; i < 256; i++) {
  _lut[i] = (i < 16 ? "0" : "") + i.toString(16);
}
let _seed = 1234567;
const MathUtils = {
  DEG2RAD: Math.PI / 180,
  RAD2DEG: 180 / Math.PI,
  generateUUID: function() {
    const d0 = Math.random() * 4294967295 | 0;
    const d1 = Math.random() * 4294967295 | 0;
    const d2 = Math.random() * 4294967295 | 0;
    const d3 = Math.random() * 4294967295 | 0;
    const uuid = _lut[d0 & 255] + _lut[d0 >> 8 & 255] + _lut[d0 >> 16 & 255] + _lut[d0 >> 24 & 255] + "-" + _lut[d1 & 255] + _lut[d1 >> 8 & 255] + "-" + _lut[d1 >> 16 & 15 | 64] + _lut[d1 >> 24 & 255] + "-" + _lut[d2 & 63 | 128] + _lut[d2 >> 8 & 255] + "-" + _lut[d2 >> 16 & 255] + _lut[d2 >> 24 & 255] + _lut[d3 & 255] + _lut[d3 >> 8 & 255] + _lut[d3 >> 16 & 255] + _lut[d3 >> 24 & 255];
    return uuid.toUpperCase();
  },
  clamp: function(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },
  euclideanModulo: function(n, m) {
    return (n % m + m) % m;
  },
  mapLinear: function(x, a1, a2, b1, b2) {
    return b1 + (x - a1) * (b2 - b1) / (a2 - a1);
  },
  lerp: function(x, y, t) {
    return (1 - t) * x + t * y;
  },
  damp: function(x, y, lambda, dt) {
    return MathUtils.lerp(x, y, 1 - Math.exp(-lambda * dt));
  },
  pingpong: function(x, length = 1) {
    return length - Math.abs(MathUtils.euclideanModulo(x, length * 2) - length);
  },
  smoothstep: function(x, min, max) {
    if (x <= min)
      return 0;
    if (x >= max)
      return 1;
    x = (x - min) / (max - min);
    return x * x * (3 - 2 * x);
  },
  smootherstep: function(x, min, max) {
    if (x <= min)
      return 0;
    if (x >= max)
      return 1;
    x = (x - min) / (max - min);
    return x * x * x * (x * (x * 6 - 15) + 10);
  },
  randInt: function(low, high) {
    return low + Math.floor(Math.random() * (high - low + 1));
  },
  randFloat: function(low, high) {
    return low + Math.random() * (high - low);
  },
  randFloatSpread: function(range) {
    return range * (0.5 - Math.random());
  },
  seededRandom: function(s2) {
    if (s2 !== void 0)
      _seed = s2 % 2147483647;
    _seed = _seed * 16807 % 2147483647;
    return (_seed - 1) / 2147483646;
  },
  degToRad: function(degrees) {
    return degrees * MathUtils.DEG2RAD;
  },
  radToDeg: function(radians) {
    return radians * MathUtils.RAD2DEG;
  },
  isPowerOfTwo: function(value) {
    return (value & value - 1) === 0 && value !== 0;
  },
  ceilPowerOfTwo: function(value) {
    return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
  },
  floorPowerOfTwo: function(value) {
    return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
  },
  setQuaternionFromProperEuler: function(q, a, b, c, order) {
    const cos = Math.cos;
    const sin = Math.sin;
    const c2 = cos(b / 2);
    const s2 = sin(b / 2);
    const c13 = cos((a + c) / 2);
    const s13 = sin((a + c) / 2);
    const c1_3 = cos((a - c) / 2);
    const s1_3 = sin((a - c) / 2);
    const c3_1 = cos((c - a) / 2);
    const s3_1 = sin((c - a) / 2);
    switch (order) {
      case "XYX":
        q.set(c2 * s13, s2 * c1_3, s2 * s1_3, c2 * c13);
        break;
      case "YZY":
        q.set(s2 * s1_3, c2 * s13, s2 * c1_3, c2 * c13);
        break;
      case "ZXZ":
        q.set(s2 * c1_3, s2 * s1_3, c2 * s13, c2 * c13);
        break;
      case "XZX":
        q.set(c2 * s13, s2 * s3_1, s2 * c3_1, c2 * c13);
        break;
      case "YXY":
        q.set(s2 * c3_1, c2 * s13, s2 * s3_1, c2 * c13);
        break;
      case "ZYZ":
        q.set(s2 * s3_1, s2 * c3_1, c2 * s13, c2 * c13);
        break;
      default:
        console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: " + order);
    }
  }
};
class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  get width() {
    return this.x;
  }
  set width(value) {
    this.x = value;
  }
  get height() {
    return this.y;
  }
  set height(value) {
    this.y = value;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  setScalar(scalar) {
    this.x = scalar;
    this.y = scalar;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setComponent(index2, value) {
    switch (index2) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      default:
        throw new Error("index is out of range: " + index2);
    }
    return this;
  }
  getComponent(index2) {
    switch (index2) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new Error("index is out of range: " + index2);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  add(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector2: .add() now only accepts one argument. Use .addVectors( a, b ) instead.");
      return this.addVectors(v, w);
    }
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  addScalar(s2) {
    this.x += s2;
    this.y += s2;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    return this;
  }
  addScaledVector(v, s2) {
    this.x += v.x * s2;
    this.y += v.y * s2;
    return this;
  }
  sub(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector2: .sub() now only accepts one argument. Use .subVectors( a, b ) instead.");
      return this.subVectors(v, w);
    }
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  subScalar(s2) {
    this.x -= s2;
    this.y -= s2;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  applyMatrix3(m) {
    const x = this.x, y = this.y;
    const e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6];
    this.y = e[1] * x + e[4] * y + e[7];
    return this;
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    return this;
  }
  clamp(min, max) {
    this.x = Math.max(min.x, Math.min(max.x, this.x));
    this.y = Math.max(min.y, Math.min(max.y, this.y));
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = Math.max(minVal, Math.min(maxVal, this.x));
    this.y = Math.max(minVal, Math.min(maxVal, this.y));
    return this;
  }
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }
  roundToZero() {
    this.x = this.x < 0 ? Math.ceil(this.x) : Math.floor(this.x);
    this.y = this.y < 0 ? Math.ceil(this.y) : Math.floor(this.y);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  angle() {
    const angle = Math.atan2(-this.y, -this.x) + Math.PI;
    return angle;
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
  }
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    return array;
  }
  fromBufferAttribute(attribute, index2, offset) {
    if (offset !== void 0) {
      console.warn("THREE.Vector2: offset has been removed from .fromBufferAttribute().");
    }
    this.x = attribute.getX(index2);
    this.y = attribute.getY(index2);
    return this;
  }
  rotateAround(center, angle) {
    const c = Math.cos(angle), s2 = Math.sin(angle);
    const x = this.x - center.x;
    const y = this.y - center.y;
    this.x = x * c - y * s2 + center.x;
    this.y = x * s2 + y * c + center.y;
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    return this;
  }
}
Vector2.prototype.isVector2 = true;
class Matrix3 {
  constructor() {
    this.elements = [
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1
    ];
    if (arguments.length > 0) {
      console.error("THREE.Matrix3: the constructor no longer reads arguments. use .set() instead.");
    }
  }
  set(n11, n12, n13, n21, n22, n23, n31, n32, n33) {
    const te = this.elements;
    te[0] = n11;
    te[1] = n21;
    te[2] = n31;
    te[3] = n12;
    te[4] = n22;
    te[5] = n32;
    te[6] = n13;
    te[7] = n23;
    te[8] = n33;
    return this;
  }
  identity() {
    this.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
    return this;
  }
  copy(m) {
    const te = this.elements;
    const me = m.elements;
    te[0] = me[0];
    te[1] = me[1];
    te[2] = me[2];
    te[3] = me[3];
    te[4] = me[4];
    te[5] = me[5];
    te[6] = me[6];
    te[7] = me[7];
    te[8] = me[8];
    return this;
  }
  extractBasis(xAxis, yAxis, zAxis) {
    xAxis.setFromMatrix3Column(this, 0);
    yAxis.setFromMatrix3Column(this, 1);
    zAxis.setFromMatrix3Column(this, 2);
    return this;
  }
  setFromMatrix4(m) {
    const me = m.elements;
    this.set(me[0], me[4], me[8], me[1], me[5], me[9], me[2], me[6], me[10]);
    return this;
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    const a11 = ae[0], a12 = ae[3], a13 = ae[6];
    const a21 = ae[1], a22 = ae[4], a23 = ae[7];
    const a31 = ae[2], a32 = ae[5], a33 = ae[8];
    const b11 = be[0], b12 = be[3], b13 = be[6];
    const b21 = be[1], b22 = be[4], b23 = be[7];
    const b31 = be[2], b32 = be[5], b33 = be[8];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31;
    te[3] = a11 * b12 + a12 * b22 + a13 * b32;
    te[6] = a11 * b13 + a12 * b23 + a13 * b33;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31;
    te[4] = a21 * b12 + a22 * b22 + a23 * b32;
    te[7] = a21 * b13 + a22 * b23 + a23 * b33;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31;
    te[5] = a31 * b12 + a32 * b22 + a33 * b32;
    te[8] = a31 * b13 + a32 * b23 + a33 * b33;
    return this;
  }
  multiplyScalar(s2) {
    const te = this.elements;
    te[0] *= s2;
    te[3] *= s2;
    te[6] *= s2;
    te[1] *= s2;
    te[4] *= s2;
    te[7] *= s2;
    te[2] *= s2;
    te[5] *= s2;
    te[8] *= s2;
    return this;
  }
  determinant() {
    const te = this.elements;
    const a = te[0], b = te[1], c = te[2], d2 = te[3], e = te[4], f = te[5], g = te[6], h = te[7], i = te[8];
    return a * e * i - a * f * h - b * d2 * i + b * f * g + c * d2 * h - c * e * g;
  }
  invert() {
    const te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n12 = te[3], n22 = te[4], n32 = te[5], n13 = te[6], n23 = te[7], n33 = te[8], t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13, det = n11 * t11 + n21 * t12 + n31 * t13;
    if (det === 0)
      return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    const detInv = 1 / det;
    te[0] = t11 * detInv;
    te[1] = (n31 * n23 - n33 * n21) * detInv;
    te[2] = (n32 * n21 - n31 * n22) * detInv;
    te[3] = t12 * detInv;
    te[4] = (n33 * n11 - n31 * n13) * detInv;
    te[5] = (n31 * n12 - n32 * n11) * detInv;
    te[6] = t13 * detInv;
    te[7] = (n21 * n13 - n23 * n11) * detInv;
    te[8] = (n22 * n11 - n21 * n12) * detInv;
    return this;
  }
  transpose() {
    let tmp;
    const m = this.elements;
    tmp = m[1];
    m[1] = m[3];
    m[3] = tmp;
    tmp = m[2];
    m[2] = m[6];
    m[6] = tmp;
    tmp = m[5];
    m[5] = m[7];
    m[7] = tmp;
    return this;
  }
  getNormalMatrix(matrix4) {
    return this.setFromMatrix4(matrix4).invert().transpose();
  }
  transposeIntoArray(r) {
    const m = this.elements;
    r[0] = m[0];
    r[1] = m[3];
    r[2] = m[6];
    r[3] = m[1];
    r[4] = m[4];
    r[5] = m[7];
    r[6] = m[2];
    r[7] = m[5];
    r[8] = m[8];
    return this;
  }
  setUvTransform(tx, ty, sx, sy, rotation, cx, cy) {
    const c = Math.cos(rotation);
    const s2 = Math.sin(rotation);
    this.set(sx * c, sx * s2, -sx * (c * cx + s2 * cy) + cx + tx, -sy * s2, sy * c, -sy * (-s2 * cx + c * cy) + cy + ty, 0, 0, 1);
    return this;
  }
  scale(sx, sy) {
    const te = this.elements;
    te[0] *= sx;
    te[3] *= sx;
    te[6] *= sx;
    te[1] *= sy;
    te[4] *= sy;
    te[7] *= sy;
    return this;
  }
  rotate(theta) {
    const c = Math.cos(theta);
    const s2 = Math.sin(theta);
    const te = this.elements;
    const a11 = te[0], a12 = te[3], a13 = te[6];
    const a21 = te[1], a22 = te[4], a23 = te[7];
    te[0] = c * a11 + s2 * a21;
    te[3] = c * a12 + s2 * a22;
    te[6] = c * a13 + s2 * a23;
    te[1] = -s2 * a11 + c * a21;
    te[4] = -s2 * a12 + c * a22;
    te[7] = -s2 * a13 + c * a23;
    return this;
  }
  translate(tx, ty) {
    const te = this.elements;
    te[0] += tx * te[2];
    te[3] += tx * te[5];
    te[6] += tx * te[8];
    te[1] += ty * te[2];
    te[4] += ty * te[5];
    te[7] += ty * te[8];
    return this;
  }
  equals(matrix) {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0; i < 9; i++) {
      if (te[i] !== me[i])
        return false;
    }
    return true;
  }
  fromArray(array, offset = 0) {
    for (let i = 0; i < 9; i++) {
      this.elements[i] = array[i + offset];
    }
    return this;
  }
  toArray(array = [], offset = 0) {
    const te = this.elements;
    array[offset] = te[0];
    array[offset + 1] = te[1];
    array[offset + 2] = te[2];
    array[offset + 3] = te[3];
    array[offset + 4] = te[4];
    array[offset + 5] = te[5];
    array[offset + 6] = te[6];
    array[offset + 7] = te[7];
    array[offset + 8] = te[8];
    return array;
  }
  clone() {
    return new this.constructor().fromArray(this.elements);
  }
}
Matrix3.prototype.isMatrix3 = true;
let _canvas;
const ImageUtils = {
  getDataURL: function(image) {
    if (/^data:/i.test(image.src)) {
      return image.src;
    }
    if (typeof HTMLCanvasElement == "undefined") {
      return image.src;
    }
    let canvas;
    if (image instanceof HTMLCanvasElement) {
      canvas = image;
    } else {
      if (_canvas === void 0)
        _canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      _canvas.width = image.width;
      _canvas.height = image.height;
      const context = _canvas.getContext("2d");
      if (image instanceof ImageData) {
        context.putImageData(image, 0, 0);
      } else {
        context.drawImage(image, 0, 0, image.width, image.height);
      }
      canvas = _canvas;
    }
    if (canvas.width > 2048 || canvas.height > 2048) {
      return canvas.toDataURL("image/jpeg", 0.6);
    } else {
      return canvas.toDataURL("image/png");
    }
  }
};
let textureId = 0;
class Texture extends EventDispatcher {
  constructor(image = Texture.DEFAULT_IMAGE, mapping = Texture.DEFAULT_MAPPING, wrapS = ClampToEdgeWrapping, wrapT = ClampToEdgeWrapping, magFilter = LinearFilter, minFilter = LinearMipmapLinearFilter, format2 = RGBAFormat, type = UnsignedByteType, anisotropy = 1, encoding = LinearEncoding) {
    super();
    Object.defineProperty(this, "id", {value: textureId++});
    this.uuid = MathUtils.generateUUID();
    this.name = "";
    this.image = image;
    this.mipmaps = [];
    this.mapping = mapping;
    this.wrapS = wrapS;
    this.wrapT = wrapT;
    this.magFilter = magFilter;
    this.minFilter = minFilter;
    this.anisotropy = anisotropy;
    this.format = format2;
    this.internalFormat = null;
    this.type = type;
    this.offset = new Vector2(0, 0);
    this.repeat = new Vector2(1, 1);
    this.center = new Vector2(0, 0);
    this.rotation = 0;
    this.matrixAutoUpdate = true;
    this.matrix = new Matrix3();
    this.generateMipmaps = true;
    this.premultiplyAlpha = false;
    this.flipY = true;
    this.unpackAlignment = 4;
    this.encoding = encoding;
    this.version = 0;
    this.onUpdate = null;
  }
  updateMatrix() {
    this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.name = source.name;
    this.image = source.image;
    this.mipmaps = source.mipmaps.slice(0);
    this.mapping = source.mapping;
    this.wrapS = source.wrapS;
    this.wrapT = source.wrapT;
    this.magFilter = source.magFilter;
    this.minFilter = source.minFilter;
    this.anisotropy = source.anisotropy;
    this.format = source.format;
    this.internalFormat = source.internalFormat;
    this.type = source.type;
    this.offset.copy(source.offset);
    this.repeat.copy(source.repeat);
    this.center.copy(source.center);
    this.rotation = source.rotation;
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrix.copy(source.matrix);
    this.generateMipmaps = source.generateMipmaps;
    this.premultiplyAlpha = source.premultiplyAlpha;
    this.flipY = source.flipY;
    this.unpackAlignment = source.unpackAlignment;
    this.encoding = source.encoding;
    return this;
  }
  toJSON(meta) {
    const isRootObject = meta === void 0 || typeof meta === "string";
    if (!isRootObject && meta.textures[this.uuid] !== void 0) {
      return meta.textures[this.uuid];
    }
    const output = {
      metadata: {
        version: 4.5,
        type: "Texture",
        generator: "Texture.toJSON"
      },
      uuid: this.uuid,
      name: this.name,
      mapping: this.mapping,
      repeat: [this.repeat.x, this.repeat.y],
      offset: [this.offset.x, this.offset.y],
      center: [this.center.x, this.center.y],
      rotation: this.rotation,
      wrap: [this.wrapS, this.wrapT],
      format: this.format,
      type: this.type,
      encoding: this.encoding,
      minFilter: this.minFilter,
      magFilter: this.magFilter,
      anisotropy: this.anisotropy,
      flipY: this.flipY,
      premultiplyAlpha: this.premultiplyAlpha,
      unpackAlignment: this.unpackAlignment
    };
    if (this.image !== void 0) {
      const image = this.image;
      if (image.uuid === void 0) {
        image.uuid = MathUtils.generateUUID();
      }
      if (!isRootObject && meta.images[image.uuid] === void 0) {
        let url;
        if (Array.isArray(image)) {
          url = [];
          for (let i = 0, l = image.length; i < l; i++) {
            if (image[i].isDataTexture) {
              url.push(serializeImage(image[i].image));
            } else {
              url.push(serializeImage(image[i]));
            }
          }
        } else {
          url = serializeImage(image);
        }
        meta.images[image.uuid] = {
          uuid: image.uuid,
          url
        };
      }
      output.image = image.uuid;
    }
    if (!isRootObject) {
      meta.textures[this.uuid] = output;
    }
    return output;
  }
  dispose() {
    this.dispatchEvent({type: "dispose"});
  }
  transformUv(uv) {
    if (this.mapping !== UVMapping)
      return uv;
    uv.applyMatrix3(this.matrix);
    if (uv.x < 0 || uv.x > 1) {
      switch (this.wrapS) {
        case RepeatWrapping:
          uv.x = uv.x - Math.floor(uv.x);
          break;
        case ClampToEdgeWrapping:
          uv.x = uv.x < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.x) % 2) === 1) {
            uv.x = Math.ceil(uv.x) - uv.x;
          } else {
            uv.x = uv.x - Math.floor(uv.x);
          }
          break;
      }
    }
    if (uv.y < 0 || uv.y > 1) {
      switch (this.wrapT) {
        case RepeatWrapping:
          uv.y = uv.y - Math.floor(uv.y);
          break;
        case ClampToEdgeWrapping:
          uv.y = uv.y < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.y) % 2) === 1) {
            uv.y = Math.ceil(uv.y) - uv.y;
          } else {
            uv.y = uv.y - Math.floor(uv.y);
          }
          break;
      }
    }
    if (this.flipY) {
      uv.y = 1 - uv.y;
    }
    return uv;
  }
  set needsUpdate(value) {
    if (value === true)
      this.version++;
  }
}
Texture.DEFAULT_IMAGE = void 0;
Texture.DEFAULT_MAPPING = UVMapping;
Texture.prototype.isTexture = true;
function serializeImage(image) {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return ImageUtils.getDataURL(image);
  } else {
    if (image.data) {
      return {
        data: Array.prototype.slice.call(image.data),
        width: image.width,
        height: image.height,
        type: image.data.constructor.name
      };
    } else {
      console.warn("THREE.Texture: Unable to serialize Texture.");
      return {};
    }
  }
}
class Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  get width() {
    return this.z;
  }
  set width(value) {
    this.z = value;
  }
  get height() {
    return this.w;
  }
  set height(value) {
    this.w = value;
  }
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  setScalar(scalar) {
    this.x = scalar;
    this.y = scalar;
    this.z = scalar;
    this.w = scalar;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setZ(z) {
    this.z = z;
    return this;
  }
  setW(w) {
    this.w = w;
    return this;
  }
  setComponent(index2, value) {
    switch (index2) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      case 3:
        this.w = value;
        break;
      default:
        throw new Error("index is out of range: " + index2);
    }
    return this;
  }
  getComponent(index2) {
    switch (index2) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      case 3:
        return this.w;
      default:
        throw new Error("index is out of range: " + index2);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z, this.w);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.w = v.w !== void 0 ? v.w : 1;
    return this;
  }
  add(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector4: .add() now only accepts one argument. Use .addVectors( a, b ) instead.");
      return this.addVectors(v, w);
    }
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.w += v.w;
    return this;
  }
  addScalar(s2) {
    this.x += s2;
    this.y += s2;
    this.z += s2;
    this.w += s2;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    this.w = a.w + b.w;
    return this;
  }
  addScaledVector(v, s2) {
    this.x += v.x * s2;
    this.y += v.y * s2;
    this.z += v.z * s2;
    this.w += v.w * s2;
    return this;
  }
  sub(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector4: .sub() now only accepts one argument. Use .subVectors( a, b ) instead.");
      return this.subVectors(v, w);
    }
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.w -= v.w;
    return this;
  }
  subScalar(s2) {
    this.x -= s2;
    this.y -= s2;
    this.z -= s2;
    this.w -= s2;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    this.w = a.w - b.w;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    this.w *= v.w;
    return this;
  }
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    this.w *= scalar;
    return this;
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z, w = this.w;
    const e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
    this.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
    this.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
    this.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  setAxisAngleFromQuaternion(q) {
    this.w = 2 * Math.acos(q.w);
    const s2 = Math.sqrt(1 - q.w * q.w);
    if (s2 < 1e-4) {
      this.x = 1;
      this.y = 0;
      this.z = 0;
    } else {
      this.x = q.x / s2;
      this.y = q.y / s2;
      this.z = q.z / s2;
    }
    return this;
  }
  setAxisAngleFromRotationMatrix(m) {
    let angle, x, y, z;
    const epsilon = 0.01, epsilon2 = 0.1, te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10];
    if (Math.abs(m12 - m21) < epsilon && Math.abs(m13 - m31) < epsilon && Math.abs(m23 - m32) < epsilon) {
      if (Math.abs(m12 + m21) < epsilon2 && Math.abs(m13 + m31) < epsilon2 && Math.abs(m23 + m32) < epsilon2 && Math.abs(m11 + m22 + m33 - 3) < epsilon2) {
        this.set(1, 0, 0, 0);
        return this;
      }
      angle = Math.PI;
      const xx = (m11 + 1) / 2;
      const yy = (m22 + 1) / 2;
      const zz = (m33 + 1) / 2;
      const xy = (m12 + m21) / 4;
      const xz = (m13 + m31) / 4;
      const yz = (m23 + m32) / 4;
      if (xx > yy && xx > zz) {
        if (xx < epsilon) {
          x = 0;
          y = 0.707106781;
          z = 0.707106781;
        } else {
          x = Math.sqrt(xx);
          y = xy / x;
          z = xz / x;
        }
      } else if (yy > zz) {
        if (yy < epsilon) {
          x = 0.707106781;
          y = 0;
          z = 0.707106781;
        } else {
          y = Math.sqrt(yy);
          x = xy / y;
          z = yz / y;
        }
      } else {
        if (zz < epsilon) {
          x = 0.707106781;
          y = 0.707106781;
          z = 0;
        } else {
          z = Math.sqrt(zz);
          x = xz / z;
          y = yz / z;
        }
      }
      this.set(x, y, z, angle);
      return this;
    }
    let s2 = Math.sqrt((m32 - m23) * (m32 - m23) + (m13 - m31) * (m13 - m31) + (m21 - m12) * (m21 - m12));
    if (Math.abs(s2) < 1e-3)
      s2 = 1;
    this.x = (m32 - m23) / s2;
    this.y = (m13 - m31) / s2;
    this.z = (m21 - m12) / s2;
    this.w = Math.acos((m11 + m22 + m33 - 1) / 2);
    return this;
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    this.w = Math.min(this.w, v.w);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    this.w = Math.max(this.w, v.w);
    return this;
  }
  clamp(min, max) {
    this.x = Math.max(min.x, Math.min(max.x, this.x));
    this.y = Math.max(min.y, Math.min(max.y, this.y));
    this.z = Math.max(min.z, Math.min(max.z, this.z));
    this.w = Math.max(min.w, Math.min(max.w, this.w));
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = Math.max(minVal, Math.min(maxVal, this.x));
    this.y = Math.max(minVal, Math.min(maxVal, this.y));
    this.z = Math.max(minVal, Math.min(maxVal, this.z));
    this.w = Math.max(minVal, Math.min(maxVal, this.w));
    return this;
  }
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    this.w = Math.floor(this.w);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    this.w = Math.ceil(this.w);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    this.w = Math.round(this.w);
    return this;
  }
  roundToZero() {
    this.x = this.x < 0 ? Math.ceil(this.x) : Math.floor(this.x);
    this.y = this.y < 0 ? Math.ceil(this.y) : Math.floor(this.y);
    this.z = this.z < 0 ? Math.ceil(this.z) : Math.floor(this.z);
    this.w = this.w < 0 ? Math.ceil(this.w) : Math.floor(this.w);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    this.w += (v.w - this.w) * alpha;
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    this.w = v1.w + (v2.w - v1.w) * alpha;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z && v.w === this.w;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    this.w = array[offset + 3];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    array[offset + 3] = this.w;
    return array;
  }
  fromBufferAttribute(attribute, index2, offset) {
    if (offset !== void 0) {
      console.warn("THREE.Vector4: offset has been removed from .fromBufferAttribute().");
    }
    this.x = attribute.getX(index2);
    this.y = attribute.getY(index2);
    this.z = attribute.getZ(index2);
    this.w = attribute.getW(index2);
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    this.w = Math.random();
    return this;
  }
}
Vector4.prototype.isVector4 = true;
class WebGLRenderTarget extends EventDispatcher {
  constructor(width, height, options) {
    super();
    this.width = width;
    this.height = height;
    this.depth = 1;
    this.scissor = new Vector4(0, 0, width, height);
    this.scissorTest = false;
    this.viewport = new Vector4(0, 0, width, height);
    options = options || {};
    this.texture = new Texture(void 0, options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.encoding);
    this.texture.image = {};
    this.texture.image.width = width;
    this.texture.image.height = height;
    this.texture.image.depth = 1;
    this.texture.generateMipmaps = options.generateMipmaps !== void 0 ? options.generateMipmaps : false;
    this.texture.minFilter = options.minFilter !== void 0 ? options.minFilter : LinearFilter;
    this.depthBuffer = options.depthBuffer !== void 0 ? options.depthBuffer : true;
    this.stencilBuffer = options.stencilBuffer !== void 0 ? options.stencilBuffer : false;
    this.depthTexture = options.depthTexture !== void 0 ? options.depthTexture : null;
  }
  setTexture(texture) {
    texture.image = {
      width: this.width,
      height: this.height,
      depth: this.depth
    };
    this.texture = texture;
  }
  setSize(width, height, depth = 1) {
    if (this.width !== width || this.height !== height || this.depth !== depth) {
      this.width = width;
      this.height = height;
      this.depth = depth;
      this.texture.image.width = width;
      this.texture.image.height = height;
      this.texture.image.depth = depth;
      this.dispose();
    }
    this.viewport.set(0, 0, width, height);
    this.scissor.set(0, 0, width, height);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.width = source.width;
    this.height = source.height;
    this.depth = source.depth;
    this.viewport.copy(source.viewport);
    this.texture = source.texture.clone();
    this.depthBuffer = source.depthBuffer;
    this.stencilBuffer = source.stencilBuffer;
    this.depthTexture = source.depthTexture;
    return this;
  }
  dispose() {
    this.dispatchEvent({type: "dispose"});
  }
}
WebGLRenderTarget.prototype.isWebGLRenderTarget = true;
class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
  }
  static slerp(qa, qb, qm, t) {
    return qm.copy(qa).slerp(qb, t);
  }
  static slerpFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t) {
    let x0 = src0[srcOffset0 + 0], y0 = src0[srcOffset0 + 1], z0 = src0[srcOffset0 + 2], w0 = src0[srcOffset0 + 3];
    const x1 = src1[srcOffset1 + 0], y1 = src1[srcOffset1 + 1], z1 = src1[srcOffset1 + 2], w1 = src1[srcOffset1 + 3];
    if (t === 0) {
      dst[dstOffset + 0] = x0;
      dst[dstOffset + 1] = y0;
      dst[dstOffset + 2] = z0;
      dst[dstOffset + 3] = w0;
      return;
    }
    if (t === 1) {
      dst[dstOffset + 0] = x1;
      dst[dstOffset + 1] = y1;
      dst[dstOffset + 2] = z1;
      dst[dstOffset + 3] = w1;
      return;
    }
    if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
      let s2 = 1 - t;
      const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1, dir = cos >= 0 ? 1 : -1, sqrSin = 1 - cos * cos;
      if (sqrSin > Number.EPSILON) {
        const sin = Math.sqrt(sqrSin), len = Math.atan2(sin, cos * dir);
        s2 = Math.sin(s2 * len) / sin;
        t = Math.sin(t * len) / sin;
      }
      const tDir = t * dir;
      x0 = x0 * s2 + x1 * tDir;
      y0 = y0 * s2 + y1 * tDir;
      z0 = z0 * s2 + z1 * tDir;
      w0 = w0 * s2 + w1 * tDir;
      if (s2 === 1 - t) {
        const f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);
        x0 *= f;
        y0 *= f;
        z0 *= f;
        w0 *= f;
      }
    }
    dst[dstOffset] = x0;
    dst[dstOffset + 1] = y0;
    dst[dstOffset + 2] = z0;
    dst[dstOffset + 3] = w0;
  }
  static multiplyQuaternionsFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1) {
    const x0 = src0[srcOffset0];
    const y0 = src0[srcOffset0 + 1];
    const z0 = src0[srcOffset0 + 2];
    const w0 = src0[srcOffset0 + 3];
    const x1 = src1[srcOffset1];
    const y1 = src1[srcOffset1 + 1];
    const z1 = src1[srcOffset1 + 2];
    const w1 = src1[srcOffset1 + 3];
    dst[dstOffset] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1;
    dst[dstOffset + 1] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1;
    dst[dstOffset + 2] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1;
    dst[dstOffset + 3] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1;
    return dst;
  }
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
    this._onChangeCallback();
  }
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
    this._onChangeCallback();
  }
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value;
    this._onChangeCallback();
  }
  get w() {
    return this._w;
  }
  set w(value) {
    this._w = value;
    this._onChangeCallback();
  }
  set(x, y, z, w) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
    this._onChangeCallback();
    return this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  copy(quaternion) {
    this._x = quaternion.x;
    this._y = quaternion.y;
    this._z = quaternion.z;
    this._w = quaternion.w;
    this._onChangeCallback();
    return this;
  }
  setFromEuler(euler, update) {
    if (!(euler && euler.isEuler)) {
      throw new Error("THREE.Quaternion: .setFromEuler() now expects an Euler rotation rather than a Vector3 and order.");
    }
    const x = euler._x, y = euler._y, z = euler._z, order = euler._order;
    const cos = Math.cos;
    const sin = Math.sin;
    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);
    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);
    switch (order) {
      case "XYZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "YXZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "ZXY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "ZYX":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "YZX":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "XZY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      default:
        console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: " + order);
    }
    if (update !== false)
      this._onChangeCallback();
    return this;
  }
  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2, s2 = Math.sin(halfAngle);
    this._x = axis.x * s2;
    this._y = axis.y * s2;
    this._z = axis.z * s2;
    this._w = Math.cos(halfAngle);
    this._onChangeCallback();
    return this;
  }
  setFromRotationMatrix(m) {
    const te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10], trace = m11 + m22 + m33;
    if (trace > 0) {
      const s2 = 0.5 / Math.sqrt(trace + 1);
      this._w = 0.25 / s2;
      this._x = (m32 - m23) * s2;
      this._y = (m13 - m31) * s2;
      this._z = (m21 - m12) * s2;
    } else if (m11 > m22 && m11 > m33) {
      const s2 = 2 * Math.sqrt(1 + m11 - m22 - m33);
      this._w = (m32 - m23) / s2;
      this._x = 0.25 * s2;
      this._y = (m12 + m21) / s2;
      this._z = (m13 + m31) / s2;
    } else if (m22 > m33) {
      const s2 = 2 * Math.sqrt(1 + m22 - m11 - m33);
      this._w = (m13 - m31) / s2;
      this._x = (m12 + m21) / s2;
      this._y = 0.25 * s2;
      this._z = (m23 + m32) / s2;
    } else {
      const s2 = 2 * Math.sqrt(1 + m33 - m11 - m22);
      this._w = (m21 - m12) / s2;
      this._x = (m13 + m31) / s2;
      this._y = (m23 + m32) / s2;
      this._z = 0.25 * s2;
    }
    this._onChangeCallback();
    return this;
  }
  setFromUnitVectors(vFrom, vTo) {
    const EPS = 1e-6;
    let r = vFrom.dot(vTo) + 1;
    if (r < EPS) {
      r = 0;
      if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
        this._x = -vFrom.y;
        this._y = vFrom.x;
        this._z = 0;
        this._w = r;
      } else {
        this._x = 0;
        this._y = -vFrom.z;
        this._z = vFrom.y;
        this._w = r;
      }
    } else {
      this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
      this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
      this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
      this._w = r;
    }
    return this.normalize();
  }
  angleTo(q) {
    return 2 * Math.acos(Math.abs(MathUtils.clamp(this.dot(q), -1, 1)));
  }
  rotateTowards(q, step) {
    const angle = this.angleTo(q);
    if (angle === 0)
      return this;
    const t = Math.min(1, step / angle);
    this.slerp(q, t);
    return this;
  }
  identity() {
    return this.set(0, 0, 0, 1);
  }
  invert() {
    return this.conjugate();
  }
  conjugate() {
    this._x *= -1;
    this._y *= -1;
    this._z *= -1;
    this._onChangeCallback();
    return this;
  }
  dot(v) {
    return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;
  }
  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
  }
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
  }
  normalize() {
    let l = this.length();
    if (l === 0) {
      this._x = 0;
      this._y = 0;
      this._z = 0;
      this._w = 1;
    } else {
      l = 1 / l;
      this._x = this._x * l;
      this._y = this._y * l;
      this._z = this._z * l;
      this._w = this._w * l;
    }
    this._onChangeCallback();
    return this;
  }
  multiply(q, p) {
    if (p !== void 0) {
      console.warn("THREE.Quaternion: .multiply() now only accepts one argument. Use .multiplyQuaternions( a, b ) instead.");
      return this.multiplyQuaternions(q, p);
    }
    return this.multiplyQuaternions(this, q);
  }
  premultiply(q) {
    return this.multiplyQuaternions(q, this);
  }
  multiplyQuaternions(a, b) {
    const qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
    const qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;
    this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    this._onChangeCallback();
    return this;
  }
  slerp(qb, t) {
    if (t === 0)
      return this;
    if (t === 1)
      return this.copy(qb);
    const x = this._x, y = this._y, z = this._z, w = this._w;
    let cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;
    if (cosHalfTheta < 0) {
      this._w = -qb._w;
      this._x = -qb._x;
      this._y = -qb._y;
      this._z = -qb._z;
      cosHalfTheta = -cosHalfTheta;
    } else {
      this.copy(qb);
    }
    if (cosHalfTheta >= 1) {
      this._w = w;
      this._x = x;
      this._y = y;
      this._z = z;
      return this;
    }
    const sqrSinHalfTheta = 1 - cosHalfTheta * cosHalfTheta;
    if (sqrSinHalfTheta <= Number.EPSILON) {
      const s2 = 1 - t;
      this._w = s2 * w + t * this._w;
      this._x = s2 * x + t * this._x;
      this._y = s2 * y + t * this._y;
      this._z = s2 * z + t * this._z;
      this.normalize();
      this._onChangeCallback();
      return this;
    }
    const sinHalfTheta = Math.sqrt(sqrSinHalfTheta);
    const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta, ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    this._w = w * ratioA + this._w * ratioB;
    this._x = x * ratioA + this._x * ratioB;
    this._y = y * ratioA + this._y * ratioB;
    this._z = z * ratioA + this._z * ratioB;
    this._onChangeCallback();
    return this;
  }
  equals(quaternion) {
    return quaternion._x === this._x && quaternion._y === this._y && quaternion._z === this._z && quaternion._w === this._w;
  }
  fromArray(array, offset = 0) {
    this._x = array[offset];
    this._y = array[offset + 1];
    this._z = array[offset + 2];
    this._w = array[offset + 3];
    this._onChangeCallback();
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._w;
    return array;
  }
  fromBufferAttribute(attribute, index2) {
    this._x = attribute.getX(index2);
    this._y = attribute.getY(index2);
    this._z = attribute.getZ(index2);
    this._w = attribute.getW(index2);
    return this;
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {
  }
}
Quaternion.prototype.isQuaternion = true;
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    if (z === void 0)
      z = this.z;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  setScalar(scalar) {
    this.x = scalar;
    this.y = scalar;
    this.z = scalar;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setZ(z) {
    this.z = z;
    return this;
  }
  setComponent(index2, value) {
    switch (index2) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      default:
        throw new Error("index is out of range: " + index2);
    }
    return this;
  }
  getComponent(index2) {
    switch (index2) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error("index is out of range: " + index2);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector3: .add() now only accepts one argument. Use .addVectors( a, b ) instead.");
      return this.addVectors(v, w);
    }
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  addScalar(s2) {
    this.x += s2;
    this.y += s2;
    this.z += s2;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    return this;
  }
  addScaledVector(v, s2) {
    this.x += v.x * s2;
    this.y += v.y * s2;
    this.z += v.z * s2;
    return this;
  }
  sub(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector3: .sub() now only accepts one argument. Use .subVectors( a, b ) instead.");
      return this.subVectors(v, w);
    }
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  subScalar(s2) {
    this.x -= s2;
    this.y -= s2;
    this.z -= s2;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  multiply(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector3: .multiply() now only accepts one argument. Use .multiplyVectors( a, b ) instead.");
      return this.multiplyVectors(v, w);
    }
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }
  multiplyScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }
  multiplyVectors(a, b) {
    this.x = a.x * b.x;
    this.y = a.y * b.y;
    this.z = a.z * b.z;
    return this;
  }
  applyEuler(euler) {
    if (!(euler && euler.isEuler)) {
      console.error("THREE.Vector3: .applyEuler() now expects an Euler rotation rather than a Vector3 and order.");
    }
    return this.applyQuaternion(_quaternion.setFromEuler(euler));
  }
  applyAxisAngle(axis, angle) {
    return this.applyQuaternion(_quaternion.setFromAxisAngle(axis, angle));
  }
  applyMatrix3(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6] * z;
    this.y = e[1] * x + e[4] * y + e[7] * z;
    this.z = e[2] * x + e[5] * y + e[8] * z;
    return this;
  }
  applyNormalMatrix(m) {
    return this.applyMatrix3(m).normalize();
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  applyQuaternion(q) {
    const x = this.x, y = this.y, z = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
  }
  project(camera) {
    return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }
  unproject(camera) {
    return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  }
  transformDirection(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    return this;
  }
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    return this;
  }
  clamp(min, max) {
    this.x = Math.max(min.x, Math.min(max.x, this.x));
    this.y = Math.max(min.y, Math.min(max.y, this.y));
    this.z = Math.max(min.z, Math.min(max.z, this.z));
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = Math.max(minVal, Math.min(maxVal, this.x));
    this.y = Math.max(minVal, Math.min(maxVal, this.y));
    this.z = Math.max(minVal, Math.min(maxVal, this.z));
    return this;
  }
  clampLength(min, max) {
    const length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  }
  roundToZero() {
    this.x = this.x < 0 ? Math.ceil(this.x) : Math.floor(this.x);
    this.y = this.y < 0 ? Math.ceil(this.y) : Math.floor(this.y);
    this.z = this.z < 0 ? Math.ceil(this.z) : Math.floor(this.z);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  lerp(v, alpha) {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }
  lerpVectors(v1, v2, alpha) {
    this.x = v1.x + (v2.x - v1.x) * alpha;
    this.y = v1.y + (v2.y - v1.y) * alpha;
    this.z = v1.z + (v2.z - v1.z) * alpha;
    return this;
  }
  cross(v, w) {
    if (w !== void 0) {
      console.warn("THREE.Vector3: .cross() now only accepts one argument. Use .crossVectors( a, b ) instead.");
      return this.crossVectors(v, w);
    }
    return this.crossVectors(this, v);
  }
  crossVectors(a, b) {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
  projectOnVector(v) {
    const denominator = v.lengthSq();
    if (denominator === 0)
      return this.set(0, 0, 0);
    const scalar = v.dot(this) / denominator;
    return this.copy(v).multiplyScalar(scalar);
  }
  projectOnPlane(planeNormal) {
    _vector.copy(this).projectOnVector(planeNormal);
    return this.sub(_vector);
  }
  reflect(normal) {
    return this.sub(_vector.copy(normal).multiplyScalar(2 * this.dot(normal)));
  }
  angleTo(v) {
    const denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0)
      return Math.PI / 2;
    const theta = this.dot(v) / denominator;
    return Math.acos(MathUtils.clamp(theta, -1, 1));
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
  }
  setFromSpherical(s2) {
    return this.setFromSphericalCoords(s2.radius, s2.phi, s2.theta);
  }
  setFromSphericalCoords(radius, phi, theta) {
    const sinPhiRadius = Math.sin(phi) * radius;
    this.x = sinPhiRadius * Math.sin(theta);
    this.y = Math.cos(phi) * radius;
    this.z = sinPhiRadius * Math.cos(theta);
    return this;
  }
  setFromCylindrical(c) {
    return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
  }
  setFromCylindricalCoords(radius, theta, y) {
    this.x = radius * Math.sin(theta);
    this.y = y;
    this.z = radius * Math.cos(theta);
    return this;
  }
  setFromMatrixPosition(m) {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    return this;
  }
  setFromMatrixScale(m) {
    const sx = this.setFromMatrixColumn(m, 0).length();
    const sy = this.setFromMatrixColumn(m, 1).length();
    const sz = this.setFromMatrixColumn(m, 2).length();
    this.x = sx;
    this.y = sy;
    this.z = sz;
    return this;
  }
  setFromMatrixColumn(m, index2) {
    return this.fromArray(m.elements, index2 * 4);
  }
  setFromMatrix3Column(m, index2) {
    return this.fromArray(m.elements, index2 * 3);
  }
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }
  fromBufferAttribute(attribute, index2, offset) {
    if (offset !== void 0) {
      console.warn("THREE.Vector3: offset has been removed from .fromBufferAttribute().");
    }
    this.x = attribute.getX(index2);
    this.y = attribute.getY(index2);
    this.z = attribute.getZ(index2);
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    return this;
  }
}
Vector3.prototype.isVector3 = true;
const _vector = /* @__PURE__ */ new Vector3();
const _quaternion = /* @__PURE__ */ new Quaternion();
class Box3 {
  constructor(min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)) {
    this.min = min;
    this.max = max;
  }
  set(min, max) {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }
  setFromArray(array) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0, l = array.length; i < l; i += 3) {
      const x = array[i];
      const y = array[i + 1];
      const z = array[i + 2];
      if (x < minX)
        minX = x;
      if (y < minY)
        minY = y;
      if (z < minZ)
        minZ = z;
      if (x > maxX)
        maxX = x;
      if (y > maxY)
        maxY = y;
      if (z > maxZ)
        maxZ = z;
    }
    this.min.set(minX, minY, minZ);
    this.max.set(maxX, maxY, maxZ);
    return this;
  }
  setFromBufferAttribute(attribute) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0, l = attribute.count; i < l; i++) {
      const x = attribute.getX(i);
      const y = attribute.getY(i);
      const z = attribute.getZ(i);
      if (x < minX)
        minX = x;
      if (y < minY)
        minY = y;
      if (z < minZ)
        minZ = z;
      if (x > maxX)
        maxX = x;
      if (y > maxY)
        maxY = y;
      if (z > maxZ)
        maxZ = z;
    }
    this.min.set(minX, minY, minZ);
    this.max.set(maxX, maxY, maxZ);
    return this;
  }
  setFromPoints(points) {
    this.makeEmpty();
    for (let i = 0, il = points.length; i < il; i++) {
      this.expandByPoint(points[i]);
    }
    return this;
  }
  setFromCenterAndSize(center, size) {
    const halfSize = _vector$1.copy(size).multiplyScalar(0.5);
    this.min.copy(center).sub(halfSize);
    this.max.copy(center).add(halfSize);
    return this;
  }
  setFromObject(object) {
    this.makeEmpty();
    return this.expandByObject(object);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(box) {
    this.min.copy(box.min);
    this.max.copy(box.max);
    return this;
  }
  makeEmpty() {
    this.min.x = this.min.y = this.min.z = Infinity;
    this.max.x = this.max.y = this.max.z = -Infinity;
    return this;
  }
  isEmpty() {
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }
  getCenter(target) {
    if (target === void 0) {
      console.warn("THREE.Box3: .getCenter() target is now required");
      target = new Vector3();
    }
    return this.isEmpty() ? target.set(0, 0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
  getSize(target) {
    if (target === void 0) {
      console.warn("THREE.Box3: .getSize() target is now required");
      target = new Vector3();
    }
    return this.isEmpty() ? target.set(0, 0, 0) : target.subVectors(this.max, this.min);
  }
  expandByPoint(point) {
    this.min.min(point);
    this.max.max(point);
    return this;
  }
  expandByVector(vector) {
    this.min.sub(vector);
    this.max.add(vector);
    return this;
  }
  expandByScalar(scalar) {
    this.min.addScalar(-scalar);
    this.max.addScalar(scalar);
    return this;
  }
  expandByObject(object) {
    object.updateWorldMatrix(false, false);
    const geometry = object.geometry;
    if (geometry !== void 0) {
      if (geometry.boundingBox === null) {
        geometry.computeBoundingBox();
      }
      _box.copy(geometry.boundingBox);
      _box.applyMatrix4(object.matrixWorld);
      this.union(_box);
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      this.expandByObject(children[i]);
    }
    return this;
  }
  containsPoint(point) {
    return point.x < this.min.x || point.x > this.max.x || point.y < this.min.y || point.y > this.max.y || point.z < this.min.z || point.z > this.max.z ? false : true;
  }
  containsBox(box) {
    return this.min.x <= box.min.x && box.max.x <= this.max.x && this.min.y <= box.min.y && box.max.y <= this.max.y && this.min.z <= box.min.z && box.max.z <= this.max.z;
  }
  getParameter(point, target) {
    if (target === void 0) {
      console.warn("THREE.Box3: .getParameter() target is now required");
      target = new Vector3();
    }
    return target.set((point.x - this.min.x) / (this.max.x - this.min.x), (point.y - this.min.y) / (this.max.y - this.min.y), (point.z - this.min.z) / (this.max.z - this.min.z));
  }
  intersectsBox(box) {
    return box.max.x < this.min.x || box.min.x > this.max.x || box.max.y < this.min.y || box.min.y > this.max.y || box.max.z < this.min.z || box.min.z > this.max.z ? false : true;
  }
  intersectsSphere(sphere) {
    this.clampPoint(sphere.center, _vector$1);
    return _vector$1.distanceToSquared(sphere.center) <= sphere.radius * sphere.radius;
  }
  intersectsPlane(plane) {
    let min, max;
    if (plane.normal.x > 0) {
      min = plane.normal.x * this.min.x;
      max = plane.normal.x * this.max.x;
    } else {
      min = plane.normal.x * this.max.x;
      max = plane.normal.x * this.min.x;
    }
    if (plane.normal.y > 0) {
      min += plane.normal.y * this.min.y;
      max += plane.normal.y * this.max.y;
    } else {
      min += plane.normal.y * this.max.y;
      max += plane.normal.y * this.min.y;
    }
    if (plane.normal.z > 0) {
      min += plane.normal.z * this.min.z;
      max += plane.normal.z * this.max.z;
    } else {
      min += plane.normal.z * this.max.z;
      max += plane.normal.z * this.min.z;
    }
    return min <= -plane.constant && max >= -plane.constant;
  }
  intersectsTriangle(triangle) {
    if (this.isEmpty()) {
      return false;
    }
    this.getCenter(_center);
    _extents.subVectors(this.max, _center);
    _v0.subVectors(triangle.a, _center);
    _v1.subVectors(triangle.b, _center);
    _v2.subVectors(triangle.c, _center);
    _f0.subVectors(_v1, _v0);
    _f1.subVectors(_v2, _v1);
    _f2.subVectors(_v0, _v2);
    let axes = [
      0,
      -_f0.z,
      _f0.y,
      0,
      -_f1.z,
      _f1.y,
      0,
      -_f2.z,
      _f2.y,
      _f0.z,
      0,
      -_f0.x,
      _f1.z,
      0,
      -_f1.x,
      _f2.z,
      0,
      -_f2.x,
      -_f0.y,
      _f0.x,
      0,
      -_f1.y,
      _f1.x,
      0,
      -_f2.y,
      _f2.x,
      0
    ];
    if (!satForAxes(axes, _v0, _v1, _v2, _extents)) {
      return false;
    }
    axes = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (!satForAxes(axes, _v0, _v1, _v2, _extents)) {
      return false;
    }
    _triangleNormal.crossVectors(_f0, _f1);
    axes = [_triangleNormal.x, _triangleNormal.y, _triangleNormal.z];
    return satForAxes(axes, _v0, _v1, _v2, _extents);
  }
  clampPoint(point, target) {
    if (target === void 0) {
      console.warn("THREE.Box3: .clampPoint() target is now required");
      target = new Vector3();
    }
    return target.copy(point).clamp(this.min, this.max);
  }
  distanceToPoint(point) {
    const clampedPoint = _vector$1.copy(point).clamp(this.min, this.max);
    return clampedPoint.sub(point).length();
  }
  getBoundingSphere(target) {
    if (target === void 0) {
      console.error("THREE.Box3: .getBoundingSphere() target is now required");
    }
    this.getCenter(target.center);
    target.radius = this.getSize(_vector$1).length() * 0.5;
    return target;
  }
  intersect(box) {
    this.min.max(box.min);
    this.max.min(box.max);
    if (this.isEmpty())
      this.makeEmpty();
    return this;
  }
  union(box) {
    this.min.min(box.min);
    this.max.max(box.max);
    return this;
  }
  applyMatrix4(matrix) {
    if (this.isEmpty())
      return this;
    _points[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(matrix);
    _points[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(matrix);
    _points[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(matrix);
    _points[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(matrix);
    _points[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(matrix);
    _points[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(matrix);
    _points[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(matrix);
    _points[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(matrix);
    this.setFromPoints(_points);
    return this;
  }
  translate(offset) {
    this.min.add(offset);
    this.max.add(offset);
    return this;
  }
  equals(box) {
    return box.min.equals(this.min) && box.max.equals(this.max);
  }
}
Box3.prototype.isBox3 = true;
const _points = [
  /* @__PURE__ */ new Vector3(),
  /* @__PURE__ */ new Vector3(),
  /* @__PURE__ */ new Vector3(),
  /* @__PURE__ */ new Vector3(),
  /* @__PURE__ */ new Vector3(),
  /* @__PURE__ */ new Vector3(),
  /* @__PURE__ */ new Vector3(),
  /* @__PURE__ */ new Vector3()
];
const _vector$1 = /* @__PURE__ */ new Vector3();
const _box = /* @__PURE__ */ new Box3();
const _v0 = /* @__PURE__ */ new Vector3();
const _v1 = /* @__PURE__ */ new Vector3();
const _v2 = /* @__PURE__ */ new Vector3();
const _f0 = /* @__PURE__ */ new Vector3();
const _f1 = /* @__PURE__ */ new Vector3();
const _f2 = /* @__PURE__ */ new Vector3();
const _center = /* @__PURE__ */ new Vector3();
const _extents = /* @__PURE__ */ new Vector3();
const _triangleNormal = /* @__PURE__ */ new Vector3();
const _testAxis = /* @__PURE__ */ new Vector3();
function satForAxes(axes, v0, v1, v2, extents) {
  for (let i = 0, j = axes.length - 3; i <= j; i += 3) {
    _testAxis.fromArray(axes, i);
    const r = extents.x * Math.abs(_testAxis.x) + extents.y * Math.abs(_testAxis.y) + extents.z * Math.abs(_testAxis.z);
    const p0 = v0.dot(_testAxis);
    const p1 = v1.dot(_testAxis);
    const p2 = v2.dot(_testAxis);
    if (Math.max(-Math.max(p0, p1, p2), Math.min(p0, p1, p2)) > r) {
      return false;
    }
  }
  return true;
}
const _box$1 = /* @__PURE__ */ new Box3();
class Sphere {
  constructor(center = new Vector3(), radius = -1) {
    this.center = center;
    this.radius = radius;
  }
  set(center, radius) {
    this.center.copy(center);
    this.radius = radius;
    return this;
  }
  setFromPoints(points, optionalCenter) {
    const center = this.center;
    if (optionalCenter !== void 0) {
      center.copy(optionalCenter);
    } else {
      _box$1.setFromPoints(points).getCenter(center);
    }
    let maxRadiusSq = 0;
    for (let i = 0, il = points.length; i < il; i++) {
      maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(points[i]));
    }
    this.radius = Math.sqrt(maxRadiusSq);
    return this;
  }
  copy(sphere) {
    this.center.copy(sphere.center);
    this.radius = sphere.radius;
    return this;
  }
  isEmpty() {
    return this.radius < 0;
  }
  makeEmpty() {
    this.center.set(0, 0, 0);
    this.radius = -1;
    return this;
  }
  containsPoint(point) {
    return point.distanceToSquared(this.center) <= this.radius * this.radius;
  }
  distanceToPoint(point) {
    return point.distanceTo(this.center) - this.radius;
  }
  intersectsSphere(sphere) {
    const radiusSum = this.radius + sphere.radius;
    return sphere.center.distanceToSquared(this.center) <= radiusSum * radiusSum;
  }
  intersectsBox(box) {
    return box.intersectsSphere(this);
  }
  intersectsPlane(plane) {
    return Math.abs(plane.distanceToPoint(this.center)) <= this.radius;
  }
  clampPoint(point, target) {
    const deltaLengthSq = this.center.distanceToSquared(point);
    if (target === void 0) {
      console.warn("THREE.Sphere: .clampPoint() target is now required");
      target = new Vector3();
    }
    target.copy(point);
    if (deltaLengthSq > this.radius * this.radius) {
      target.sub(this.center).normalize();
      target.multiplyScalar(this.radius).add(this.center);
    }
    return target;
  }
  getBoundingBox(target) {
    if (target === void 0) {
      console.warn("THREE.Sphere: .getBoundingBox() target is now required");
      target = new Box3();
    }
    if (this.isEmpty()) {
      target.makeEmpty();
      return target;
    }
    target.set(this.center, this.center);
    target.expandByScalar(this.radius);
    return target;
  }
  applyMatrix4(matrix) {
    this.center.applyMatrix4(matrix);
    this.radius = this.radius * matrix.getMaxScaleOnAxis();
    return this;
  }
  translate(offset) {
    this.center.add(offset);
    return this;
  }
  equals(sphere) {
    return sphere.center.equals(this.center) && sphere.radius === this.radius;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
const _vector$2 = /* @__PURE__ */ new Vector3();
const _segCenter = /* @__PURE__ */ new Vector3();
const _segDir = /* @__PURE__ */ new Vector3();
const _diff = /* @__PURE__ */ new Vector3();
const _edge1 = /* @__PURE__ */ new Vector3();
const _edge2 = /* @__PURE__ */ new Vector3();
const _normal = /* @__PURE__ */ new Vector3();
class Ray {
  constructor(origin = new Vector3(), direction = new Vector3(0, 0, -1)) {
    this.origin = origin;
    this.direction = direction;
  }
  set(origin, direction) {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }
  copy(ray) {
    this.origin.copy(ray.origin);
    this.direction.copy(ray.direction);
    return this;
  }
  at(t, target) {
    if (target === void 0) {
      console.warn("THREE.Ray: .at() target is now required");
      target = new Vector3();
    }
    return target.copy(this.direction).multiplyScalar(t).add(this.origin);
  }
  lookAt(v) {
    this.direction.copy(v).sub(this.origin).normalize();
    return this;
  }
  recast(t) {
    this.origin.copy(this.at(t, _vector$2));
    return this;
  }
  closestPointToPoint(point, target) {
    if (target === void 0) {
      console.warn("THREE.Ray: .closestPointToPoint() target is now required");
      target = new Vector3();
    }
    target.subVectors(point, this.origin);
    const directionDistance = target.dot(this.direction);
    if (directionDistance < 0) {
      return target.copy(this.origin);
    }
    return target.copy(this.direction).multiplyScalar(directionDistance).add(this.origin);
  }
  distanceToPoint(point) {
    return Math.sqrt(this.distanceSqToPoint(point));
  }
  distanceSqToPoint(point) {
    const directionDistance = _vector$2.subVectors(point, this.origin).dot(this.direction);
    if (directionDistance < 0) {
      return this.origin.distanceToSquared(point);
    }
    _vector$2.copy(this.direction).multiplyScalar(directionDistance).add(this.origin);
    return _vector$2.distanceToSquared(point);
  }
  distanceSqToSegment(v0, v1, optionalPointOnRay, optionalPointOnSegment) {
    _segCenter.copy(v0).add(v1).multiplyScalar(0.5);
    _segDir.copy(v1).sub(v0).normalize();
    _diff.copy(this.origin).sub(_segCenter);
    const segExtent = v0.distanceTo(v1) * 0.5;
    const a01 = -this.direction.dot(_segDir);
    const b0 = _diff.dot(this.direction);
    const b1 = -_diff.dot(_segDir);
    const c = _diff.lengthSq();
    const det = Math.abs(1 - a01 * a01);
    let s0, s1, sqrDist, extDet;
    if (det > 0) {
      s0 = a01 * b1 - b0;
      s1 = a01 * b0 - b1;
      extDet = segExtent * det;
      if (s0 >= 0) {
        if (s1 >= -extDet) {
          if (s1 <= extDet) {
            const invDet = 1 / det;
            s0 *= invDet;
            s1 *= invDet;
            sqrDist = s0 * (s0 + a01 * s1 + 2 * b0) + s1 * (a01 * s0 + s1 + 2 * b1) + c;
          } else {
            s1 = segExtent;
            s0 = Math.max(0, -(a01 * s1 + b0));
            sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
          }
        } else {
          s1 = -segExtent;
          s0 = Math.max(0, -(a01 * s1 + b0));
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      } else {
        if (s1 <= -extDet) {
          s0 = Math.max(0, -(-a01 * segExtent + b0));
          s1 = s0 > 0 ? -segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        } else if (s1 <= extDet) {
          s0 = 0;
          s1 = Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = s1 * (s1 + 2 * b1) + c;
        } else {
          s0 = Math.max(0, -(a01 * segExtent + b0));
          s1 = s0 > 0 ? segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      }
    } else {
      s1 = a01 > 0 ? -segExtent : segExtent;
      s0 = Math.max(0, -(a01 * s1 + b0));
      sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
    }
    if (optionalPointOnRay) {
      optionalPointOnRay.copy(this.direction).multiplyScalar(s0).add(this.origin);
    }
    if (optionalPointOnSegment) {
      optionalPointOnSegment.copy(_segDir).multiplyScalar(s1).add(_segCenter);
    }
    return sqrDist;
  }
  intersectSphere(sphere, target) {
    _vector$2.subVectors(sphere.center, this.origin);
    const tca = _vector$2.dot(this.direction);
    const d2 = _vector$2.dot(_vector$2) - tca * tca;
    const radius2 = sphere.radius * sphere.radius;
    if (d2 > radius2)
      return null;
    const thc = Math.sqrt(radius2 - d2);
    const t0 = tca - thc;
    const t1 = tca + thc;
    if (t0 < 0 && t1 < 0)
      return null;
    if (t0 < 0)
      return this.at(t1, target);
    return this.at(t0, target);
  }
  intersectsSphere(sphere) {
    return this.distanceSqToPoint(sphere.center) <= sphere.radius * sphere.radius;
  }
  distanceToPlane(plane) {
    const denominator = plane.normal.dot(this.direction);
    if (denominator === 0) {
      if (plane.distanceToPoint(this.origin) === 0) {
        return 0;
      }
      return null;
    }
    const t = -(this.origin.dot(plane.normal) + plane.constant) / denominator;
    return t >= 0 ? t : null;
  }
  intersectPlane(plane, target) {
    const t = this.distanceToPlane(plane);
    if (t === null) {
      return null;
    }
    return this.at(t, target);
  }
  intersectsPlane(plane) {
    const distToPoint = plane.distanceToPoint(this.origin);
    if (distToPoint === 0) {
      return true;
    }
    const denominator = plane.normal.dot(this.direction);
    if (denominator * distToPoint < 0) {
      return true;
    }
    return false;
  }
  intersectBox(box, target) {
    let tmin, tmax, tymin, tymax, tzmin, tzmax;
    const invdirx = 1 / this.direction.x, invdiry = 1 / this.direction.y, invdirz = 1 / this.direction.z;
    const origin = this.origin;
    if (invdirx >= 0) {
      tmin = (box.min.x - origin.x) * invdirx;
      tmax = (box.max.x - origin.x) * invdirx;
    } else {
      tmin = (box.max.x - origin.x) * invdirx;
      tmax = (box.min.x - origin.x) * invdirx;
    }
    if (invdiry >= 0) {
      tymin = (box.min.y - origin.y) * invdiry;
      tymax = (box.max.y - origin.y) * invdiry;
    } else {
      tymin = (box.max.y - origin.y) * invdiry;
      tymax = (box.min.y - origin.y) * invdiry;
    }
    if (tmin > tymax || tymin > tmax)
      return null;
    if (tymin > tmin || tmin !== tmin)
      tmin = tymin;
    if (tymax < tmax || tmax !== tmax)
      tmax = tymax;
    if (invdirz >= 0) {
      tzmin = (box.min.z - origin.z) * invdirz;
      tzmax = (box.max.z - origin.z) * invdirz;
    } else {
      tzmin = (box.max.z - origin.z) * invdirz;
      tzmax = (box.min.z - origin.z) * invdirz;
    }
    if (tmin > tzmax || tzmin > tmax)
      return null;
    if (tzmin > tmin || tmin !== tmin)
      tmin = tzmin;
    if (tzmax < tmax || tmax !== tmax)
      tmax = tzmax;
    if (tmax < 0)
      return null;
    return this.at(tmin >= 0 ? tmin : tmax, target);
  }
  intersectsBox(box) {
    return this.intersectBox(box, _vector$2) !== null;
  }
  intersectTriangle(a, b, c, backfaceCulling, target) {
    _edge1.subVectors(b, a);
    _edge2.subVectors(c, a);
    _normal.crossVectors(_edge1, _edge2);
    let DdN = this.direction.dot(_normal);
    let sign;
    if (DdN > 0) {
      if (backfaceCulling)
        return null;
      sign = 1;
    } else if (DdN < 0) {
      sign = -1;
      DdN = -DdN;
    } else {
      return null;
    }
    _diff.subVectors(this.origin, a);
    const DdQxE2 = sign * this.direction.dot(_edge2.crossVectors(_diff, _edge2));
    if (DdQxE2 < 0) {
      return null;
    }
    const DdE1xQ = sign * this.direction.dot(_edge1.cross(_diff));
    if (DdE1xQ < 0) {
      return null;
    }
    if (DdQxE2 + DdE1xQ > DdN) {
      return null;
    }
    const QdN = -sign * _diff.dot(_normal);
    if (QdN < 0) {
      return null;
    }
    return this.at(QdN / DdN, target);
  }
  applyMatrix4(matrix4) {
    this.origin.applyMatrix4(matrix4);
    this.direction.transformDirection(matrix4);
    return this;
  }
  equals(ray) {
    return ray.origin.equals(this.origin) && ray.direction.equals(this.direction);
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
class Matrix4 {
  constructor() {
    this.elements = [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ];
    if (arguments.length > 0) {
      console.error("THREE.Matrix4: the constructor no longer reads arguments. use .set() instead.");
    }
  }
  set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    const te = this.elements;
    te[0] = n11;
    te[4] = n12;
    te[8] = n13;
    te[12] = n14;
    te[1] = n21;
    te[5] = n22;
    te[9] = n23;
    te[13] = n24;
    te[2] = n31;
    te[6] = n32;
    te[10] = n33;
    te[14] = n34;
    te[3] = n41;
    te[7] = n42;
    te[11] = n43;
    te[15] = n44;
    return this;
  }
  identity() {
    this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    return this;
  }
  clone() {
    return new Matrix4().fromArray(this.elements);
  }
  copy(m) {
    const te = this.elements;
    const me = m.elements;
    te[0] = me[0];
    te[1] = me[1];
    te[2] = me[2];
    te[3] = me[3];
    te[4] = me[4];
    te[5] = me[5];
    te[6] = me[6];
    te[7] = me[7];
    te[8] = me[8];
    te[9] = me[9];
    te[10] = me[10];
    te[11] = me[11];
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    te[15] = me[15];
    return this;
  }
  copyPosition(m) {
    const te = this.elements, me = m.elements;
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    return this;
  }
  setFromMatrix3(m) {
    const me = m.elements;
    this.set(me[0], me[3], me[6], 0, me[1], me[4], me[7], 0, me[2], me[5], me[8], 0, 0, 0, 0, 1);
    return this;
  }
  extractBasis(xAxis, yAxis, zAxis) {
    xAxis.setFromMatrixColumn(this, 0);
    yAxis.setFromMatrixColumn(this, 1);
    zAxis.setFromMatrixColumn(this, 2);
    return this;
  }
  makeBasis(xAxis, yAxis, zAxis) {
    this.set(xAxis.x, yAxis.x, zAxis.x, 0, xAxis.y, yAxis.y, zAxis.y, 0, xAxis.z, yAxis.z, zAxis.z, 0, 0, 0, 0, 1);
    return this;
  }
  extractRotation(m) {
    const te = this.elements;
    const me = m.elements;
    const scaleX = 1 / _v1$1.setFromMatrixColumn(m, 0).length();
    const scaleY = 1 / _v1$1.setFromMatrixColumn(m, 1).length();
    const scaleZ = 1 / _v1$1.setFromMatrixColumn(m, 2).length();
    te[0] = me[0] * scaleX;
    te[1] = me[1] * scaleX;
    te[2] = me[2] * scaleX;
    te[3] = 0;
    te[4] = me[4] * scaleY;
    te[5] = me[5] * scaleY;
    te[6] = me[6] * scaleY;
    te[7] = 0;
    te[8] = me[8] * scaleZ;
    te[9] = me[9] * scaleZ;
    te[10] = me[10] * scaleZ;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  makeRotationFromEuler(euler) {
    if (!(euler && euler.isEuler)) {
      console.error("THREE.Matrix4: .makeRotationFromEuler() now expects a Euler rotation rather than a Vector3 and order.");
    }
    const te = this.elements;
    const x = euler.x, y = euler.y, z = euler.z;
    const a = Math.cos(x), b = Math.sin(x);
    const c = Math.cos(y), d2 = Math.sin(y);
    const e = Math.cos(z), f = Math.sin(z);
    if (euler.order === "XYZ") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = -c * f;
      te[8] = d2;
      te[1] = af + be * d2;
      te[5] = ae - bf * d2;
      te[9] = -b * c;
      te[2] = bf - ae * d2;
      te[6] = be + af * d2;
      te[10] = a * c;
    } else if (euler.order === "YXZ") {
      const ce = c * e, cf = c * f, de = d2 * e, df = d2 * f;
      te[0] = ce + df * b;
      te[4] = de * b - cf;
      te[8] = a * d2;
      te[1] = a * f;
      te[5] = a * e;
      te[9] = -b;
      te[2] = cf * b - de;
      te[6] = df + ce * b;
      te[10] = a * c;
    } else if (euler.order === "ZXY") {
      const ce = c * e, cf = c * f, de = d2 * e, df = d2 * f;
      te[0] = ce - df * b;
      te[4] = -a * f;
      te[8] = de + cf * b;
      te[1] = cf + de * b;
      te[5] = a * e;
      te[9] = df - ce * b;
      te[2] = -a * d2;
      te[6] = b;
      te[10] = a * c;
    } else if (euler.order === "ZYX") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = be * d2 - af;
      te[8] = ae * d2 + bf;
      te[1] = c * f;
      te[5] = bf * d2 + ae;
      te[9] = af * d2 - be;
      te[2] = -d2;
      te[6] = b * c;
      te[10] = a * c;
    } else if (euler.order === "YZX") {
      const ac = a * c, ad = a * d2, bc = b * c, bd = b * d2;
      te[0] = c * e;
      te[4] = bd - ac * f;
      te[8] = bc * f + ad;
      te[1] = f;
      te[5] = a * e;
      te[9] = -b * e;
      te[2] = -d2 * e;
      te[6] = ad * f + bc;
      te[10] = ac - bd * f;
    } else if (euler.order === "XZY") {
      const ac = a * c, ad = a * d2, bc = b * c, bd = b * d2;
      te[0] = c * e;
      te[4] = -f;
      te[8] = d2 * e;
      te[1] = ac * f + bd;
      te[5] = a * e;
      te[9] = ad * f - bc;
      te[2] = bc * f - ad;
      te[6] = b * e;
      te[10] = bd * f + ac;
    }
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  makeRotationFromQuaternion(q) {
    return this.compose(_zero, q, _one);
  }
  lookAt(eye, target, up) {
    const te = this.elements;
    _z.subVectors(eye, target);
    if (_z.lengthSq() === 0) {
      _z.z = 1;
    }
    _z.normalize();
    _x.crossVectors(up, _z);
    if (_x.lengthSq() === 0) {
      if (Math.abs(up.z) === 1) {
        _z.x += 1e-4;
      } else {
        _z.z += 1e-4;
      }
      _z.normalize();
      _x.crossVectors(up, _z);
    }
    _x.normalize();
    _y.crossVectors(_z, _x);
    te[0] = _x.x;
    te[4] = _y.x;
    te[8] = _z.x;
    te[1] = _x.y;
    te[5] = _y.y;
    te[9] = _z.y;
    te[2] = _x.z;
    te[6] = _y.z;
    te[10] = _z.z;
    return this;
  }
  multiply(m, n) {
    if (n !== void 0) {
      console.warn("THREE.Matrix4: .multiply() now only accepts one argument. Use .multiplyMatrices( a, b ) instead.");
      return this.multiplyMatrices(m, n);
    }
    return this.multiplyMatrices(this, m);
  }
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  multiplyScalar(s2) {
    const te = this.elements;
    te[0] *= s2;
    te[4] *= s2;
    te[8] *= s2;
    te[12] *= s2;
    te[1] *= s2;
    te[5] *= s2;
    te[9] *= s2;
    te[13] *= s2;
    te[2] *= s2;
    te[6] *= s2;
    te[10] *= s2;
    te[14] *= s2;
    te[3] *= s2;
    te[7] *= s2;
    te[11] *= s2;
    te[15] *= s2;
    return this;
  }
  determinant() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    return n41 * (+n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34) + n42 * (+n11 * n23 * n34 - n11 * n24 * n33 + n14 * n21 * n33 - n13 * n21 * n34 + n13 * n24 * n31 - n14 * n23 * n31) + n43 * (+n11 * n24 * n32 - n11 * n22 * n34 - n14 * n21 * n32 + n12 * n21 * n34 + n14 * n22 * n31 - n12 * n24 * n31) + n44 * (-n13 * n22 * n31 - n11 * n23 * n32 + n11 * n22 * n33 + n13 * n21 * n32 - n12 * n21 * n33 + n12 * n23 * n31);
  }
  transpose() {
    const te = this.elements;
    let tmp;
    tmp = te[1];
    te[1] = te[4];
    te[4] = tmp;
    tmp = te[2];
    te[2] = te[8];
    te[8] = tmp;
    tmp = te[6];
    te[6] = te[9];
    te[9] = tmp;
    tmp = te[3];
    te[3] = te[12];
    te[12] = tmp;
    tmp = te[7];
    te[7] = te[13];
    te[13] = tmp;
    tmp = te[11];
    te[11] = te[14];
    te[14] = tmp;
    return this;
  }
  setPosition(x, y, z) {
    const te = this.elements;
    if (x.isVector3) {
      te[12] = x.x;
      te[13] = x.y;
      te[14] = x.z;
    } else {
      te[12] = x;
      te[13] = y;
      te[14] = z;
    }
    return this;
  }
  invert() {
    const te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3], n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7], n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11], n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15], t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44, t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44, t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44, t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0)
      return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const detInv = 1 / det;
    te[0] = t11 * detInv;
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
    te[4] = t12 * detInv;
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
    te[8] = t13 * detInv;
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
    te[12] = t14 * detInv;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
    return this;
  }
  scale(v) {
    const te = this.elements;
    const x = v.x, y = v.y, z = v.z;
    te[0] *= x;
    te[4] *= y;
    te[8] *= z;
    te[1] *= x;
    te[5] *= y;
    te[9] *= z;
    te[2] *= x;
    te[6] *= y;
    te[10] *= z;
    te[3] *= x;
    te[7] *= y;
    te[11] *= z;
    return this;
  }
  getMaxScaleOnAxis() {
    const te = this.elements;
    const scaleXSq = te[0] * te[0] + te[1] * te[1] + te[2] * te[2];
    const scaleYSq = te[4] * te[4] + te[5] * te[5] + te[6] * te[6];
    const scaleZSq = te[8] * te[8] + te[9] * te[9] + te[10] * te[10];
    return Math.sqrt(Math.max(scaleXSq, scaleYSq, scaleZSq));
  }
  makeTranslation(x, y, z) {
    this.set(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
    return this;
  }
  makeRotationX(theta) {
    const c = Math.cos(theta), s2 = Math.sin(theta);
    this.set(1, 0, 0, 0, 0, c, -s2, 0, 0, s2, c, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationY(theta) {
    const c = Math.cos(theta), s2 = Math.sin(theta);
    this.set(c, 0, s2, 0, 0, 1, 0, 0, -s2, 0, c, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationZ(theta) {
    const c = Math.cos(theta), s2 = Math.sin(theta);
    this.set(c, -s2, 0, 0, s2, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    return this;
  }
  makeRotationAxis(axis, angle) {
    const c = Math.cos(angle);
    const s2 = Math.sin(angle);
    const t = 1 - c;
    const x = axis.x, y = axis.y, z = axis.z;
    const tx = t * x, ty = t * y;
    this.set(tx * x + c, tx * y - s2 * z, tx * z + s2 * y, 0, tx * y + s2 * z, ty * y + c, ty * z - s2 * x, 0, tx * z - s2 * y, ty * z + s2 * x, t * z * z + c, 0, 0, 0, 0, 1);
    return this;
  }
  makeScale(x, y, z) {
    this.set(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
    return this;
  }
  makeShear(x, y, z) {
    this.set(1, y, z, 0, x, 1, z, 0, x, y, 1, 0, 0, 0, 0, 1);
    return this;
  }
  compose(position, quaternion, scale) {
    const te = this.elements;
    const x = quaternion._x, y = quaternion._y, z = quaternion._z, w = quaternion._w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  decompose(position, quaternion, scale) {
    const te = this.elements;
    let sx = _v1$1.set(te[0], te[1], te[2]).length();
    const sy = _v1$1.set(te[4], te[5], te[6]).length();
    const sz = _v1$1.set(te[8], te[9], te[10]).length();
    const det = this.determinant();
    if (det < 0)
      sx = -sx;
    position.x = te[12];
    position.y = te[13];
    position.z = te[14];
    _m1.copy(this);
    const invSX = 1 / sx;
    const invSY = 1 / sy;
    const invSZ = 1 / sz;
    _m1.elements[0] *= invSX;
    _m1.elements[1] *= invSX;
    _m1.elements[2] *= invSX;
    _m1.elements[4] *= invSY;
    _m1.elements[5] *= invSY;
    _m1.elements[6] *= invSY;
    _m1.elements[8] *= invSZ;
    _m1.elements[9] *= invSZ;
    _m1.elements[10] *= invSZ;
    quaternion.setFromRotationMatrix(_m1);
    scale.x = sx;
    scale.y = sy;
    scale.z = sz;
    return this;
  }
  makePerspective(left, right, top, bottom, near, far) {
    if (far === void 0) {
      console.warn("THREE.Matrix4: .makePerspective() has been redefined and has a new signature. Please check the docs.");
    }
    const te = this.elements;
    const x = 2 * near / (right - left);
    const y = 2 * near / (top - bottom);
    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    const c = -(far + near) / (far - near);
    const d2 = -2 * far * near / (far - near);
    te[0] = x;
    te[4] = 0;
    te[8] = a;
    te[12] = 0;
    te[1] = 0;
    te[5] = y;
    te[9] = b;
    te[13] = 0;
    te[2] = 0;
    te[6] = 0;
    te[10] = c;
    te[14] = d2;
    te[3] = 0;
    te[7] = 0;
    te[11] = -1;
    te[15] = 0;
    return this;
  }
  makeOrthographic(left, right, top, bottom, near, far) {
    const te = this.elements;
    const w = 1 / (right - left);
    const h = 1 / (top - bottom);
    const p = 1 / (far - near);
    const x = (right + left) * w;
    const y = (top + bottom) * h;
    const z = (far + near) * p;
    te[0] = 2 * w;
    te[4] = 0;
    te[8] = 0;
    te[12] = -x;
    te[1] = 0;
    te[5] = 2 * h;
    te[9] = 0;
    te[13] = -y;
    te[2] = 0;
    te[6] = 0;
    te[10] = -2 * p;
    te[14] = -z;
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[15] = 1;
    return this;
  }
  equals(matrix) {
    const te = this.elements;
    const me = matrix.elements;
    for (let i = 0; i < 16; i++) {
      if (te[i] !== me[i])
        return false;
    }
    return true;
  }
  fromArray(array, offset = 0) {
    for (let i = 0; i < 16; i++) {
      this.elements[i] = array[i + offset];
    }
    return this;
  }
  toArray(array = [], offset = 0) {
    const te = this.elements;
    array[offset] = te[0];
    array[offset + 1] = te[1];
    array[offset + 2] = te[2];
    array[offset + 3] = te[3];
    array[offset + 4] = te[4];
    array[offset + 5] = te[5];
    array[offset + 6] = te[6];
    array[offset + 7] = te[7];
    array[offset + 8] = te[8];
    array[offset + 9] = te[9];
    array[offset + 10] = te[10];
    array[offset + 11] = te[11];
    array[offset + 12] = te[12];
    array[offset + 13] = te[13];
    array[offset + 14] = te[14];
    array[offset + 15] = te[15];
    return array;
  }
}
Matrix4.prototype.isMatrix4 = true;
const _v1$1 = /* @__PURE__ */ new Vector3();
const _m1 = /* @__PURE__ */ new Matrix4();
const _zero = /* @__PURE__ */ new Vector3(0, 0, 0);
const _one = /* @__PURE__ */ new Vector3(1, 1, 1);
const _x = /* @__PURE__ */ new Vector3();
const _y = /* @__PURE__ */ new Vector3();
const _z = /* @__PURE__ */ new Vector3();
const _matrix = /* @__PURE__ */ new Matrix4();
const _quaternion$1 = /* @__PURE__ */ new Quaternion();
class Euler {
  constructor(x = 0, y = 0, z = 0, order = Euler.DefaultOrder) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
  }
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value;
    this._onChangeCallback();
  }
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value;
    this._onChangeCallback();
  }
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value;
    this._onChangeCallback();
  }
  get order() {
    return this._order;
  }
  set order(value) {
    this._order = value;
    this._onChangeCallback();
  }
  set(x, y, z, order) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order || this._order;
    this._onChangeCallback();
    return this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  copy(euler) {
    this._x = euler._x;
    this._y = euler._y;
    this._z = euler._z;
    this._order = euler._order;
    this._onChangeCallback();
    return this;
  }
  setFromRotationMatrix(m, order, update) {
    const clamp = MathUtils.clamp;
    const te = m.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    order = order || this._order;
    switch (order) {
      case "XYZ":
        this._y = Math.asin(clamp(m13, -1, 1));
        if (Math.abs(m13) < 0.9999999) {
          this._x = Math.atan2(-m23, m33);
          this._z = Math.atan2(-m12, m11);
        } else {
          this._x = Math.atan2(m32, m22);
          this._z = 0;
        }
        break;
      case "YXZ":
        this._x = Math.asin(-clamp(m23, -1, 1));
        if (Math.abs(m23) < 0.9999999) {
          this._y = Math.atan2(m13, m33);
          this._z = Math.atan2(m21, m22);
        } else {
          this._y = Math.atan2(-m31, m11);
          this._z = 0;
        }
        break;
      case "ZXY":
        this._x = Math.asin(clamp(m32, -1, 1));
        if (Math.abs(m32) < 0.9999999) {
          this._y = Math.atan2(-m31, m33);
          this._z = Math.atan2(-m12, m22);
        } else {
          this._y = 0;
          this._z = Math.atan2(m21, m11);
        }
        break;
      case "ZYX":
        this._y = Math.asin(-clamp(m31, -1, 1));
        if (Math.abs(m31) < 0.9999999) {
          this._x = Math.atan2(m32, m33);
          this._z = Math.atan2(m21, m11);
        } else {
          this._x = 0;
          this._z = Math.atan2(-m12, m22);
        }
        break;
      case "YZX":
        this._z = Math.asin(clamp(m21, -1, 1));
        if (Math.abs(m21) < 0.9999999) {
          this._x = Math.atan2(-m23, m22);
          this._y = Math.atan2(-m31, m11);
        } else {
          this._x = 0;
          this._y = Math.atan2(m13, m33);
        }
        break;
      case "XZY":
        this._z = Math.asin(-clamp(m12, -1, 1));
        if (Math.abs(m12) < 0.9999999) {
          this._x = Math.atan2(m32, m22);
          this._y = Math.atan2(m13, m11);
        } else {
          this._x = Math.atan2(-m23, m33);
          this._y = 0;
        }
        break;
      default:
        console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " + order);
    }
    this._order = order;
    if (update !== false)
      this._onChangeCallback();
    return this;
  }
  setFromQuaternion(q, order, update) {
    _matrix.makeRotationFromQuaternion(q);
    return this.setFromRotationMatrix(_matrix, order, update);
  }
  setFromVector3(v, order) {
    return this.set(v.x, v.y, v.z, order || this._order);
  }
  reorder(newOrder) {
    _quaternion$1.setFromEuler(this);
    return this.setFromQuaternion(_quaternion$1, newOrder);
  }
  equals(euler) {
    return euler._x === this._x && euler._y === this._y && euler._z === this._z && euler._order === this._order;
  }
  fromArray(array) {
    this._x = array[0];
    this._y = array[1];
    this._z = array[2];
    if (array[3] !== void 0)
      this._order = array[3];
    this._onChangeCallback();
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._order;
    return array;
  }
  toVector3(optionalResult) {
    if (optionalResult) {
      return optionalResult.set(this._x, this._y, this._z);
    } else {
      return new Vector3(this._x, this._y, this._z);
    }
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {
  }
}
Euler.prototype.isEuler = true;
Euler.DefaultOrder = "XYZ";
Euler.RotationOrders = ["XYZ", "YZX", "ZXY", "XZY", "YXZ", "ZYX"];
class Layers {
  constructor() {
    this.mask = 1 | 0;
  }
  set(channel) {
    this.mask = 1 << channel | 0;
  }
  enable(channel) {
    this.mask |= 1 << channel | 0;
  }
  enableAll() {
    this.mask = 4294967295 | 0;
  }
  toggle(channel) {
    this.mask ^= 1 << channel | 0;
  }
  disable(channel) {
    this.mask &= ~(1 << channel | 0);
  }
  disableAll() {
    this.mask = 0;
  }
  test(layers) {
    return (this.mask & layers.mask) !== 0;
  }
}
let _object3DId = 0;
const _v1$2 = new Vector3();
const _q1 = new Quaternion();
const _m1$1 = new Matrix4();
const _target = new Vector3();
const _position = new Vector3();
const _scale = new Vector3();
const _quaternion$2 = new Quaternion();
const _xAxis = new Vector3(1, 0, 0);
const _yAxis = new Vector3(0, 1, 0);
const _zAxis = new Vector3(0, 0, 1);
const _addedEvent = {type: "added"};
const _removedEvent = {type: "removed"};
function Object3D() {
  Object.defineProperty(this, "id", {value: _object3DId++});
  this.uuid = MathUtils.generateUUID();
  this.name = "";
  this.type = "Object3D";
  this.parent = null;
  this.children = [];
  this.up = Object3D.DefaultUp.clone();
  const position = new Vector3();
  const rotation = new Euler();
  const quaternion = new Quaternion();
  const scale = new Vector3(1, 1, 1);
  function onRotationChange() {
    quaternion.setFromEuler(rotation, false);
  }
  function onQuaternionChange() {
    rotation.setFromQuaternion(quaternion, void 0, false);
  }
  rotation._onChange(onRotationChange);
  quaternion._onChange(onQuaternionChange);
  Object.defineProperties(this, {
    position: {
      configurable: true,
      enumerable: true,
      value: position
    },
    rotation: {
      configurable: true,
      enumerable: true,
      value: rotation
    },
    quaternion: {
      configurable: true,
      enumerable: true,
      value: quaternion
    },
    scale: {
      configurable: true,
      enumerable: true,
      value: scale
    },
    modelViewMatrix: {
      value: new Matrix4()
    },
    normalMatrix: {
      value: new Matrix3()
    }
  });
  this.matrix = new Matrix4();
  this.matrixWorld = new Matrix4();
  this.matrixAutoUpdate = Object3D.DefaultMatrixAutoUpdate;
  this.matrixWorldNeedsUpdate = false;
  this.layers = new Layers();
  this.visible = true;
  this.castShadow = false;
  this.receiveShadow = false;
  this.frustumCulled = true;
  this.renderOrder = 0;
  this.animations = [];
  this.userData = {};
}
Object3D.DefaultUp = new Vector3(0, 1, 0);
Object3D.DefaultMatrixAutoUpdate = true;
Object3D.prototype = Object.assign(Object.create(EventDispatcher.prototype), {
  constructor: Object3D,
  isObject3D: true,
  onBeforeRender: function() {
  },
  onAfterRender: function() {
  },
  applyMatrix4: function(matrix) {
    if (this.matrixAutoUpdate)
      this.updateMatrix();
    this.matrix.premultiply(matrix);
    this.matrix.decompose(this.position, this.quaternion, this.scale);
  },
  applyQuaternion: function(q) {
    this.quaternion.premultiply(q);
    return this;
  },
  setRotationFromAxisAngle: function(axis, angle) {
    this.quaternion.setFromAxisAngle(axis, angle);
  },
  setRotationFromEuler: function(euler) {
    this.quaternion.setFromEuler(euler, true);
  },
  setRotationFromMatrix: function(m) {
    this.quaternion.setFromRotationMatrix(m);
  },
  setRotationFromQuaternion: function(q) {
    this.quaternion.copy(q);
  },
  rotateOnAxis: function(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.multiply(_q1);
    return this;
  },
  rotateOnWorldAxis: function(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.premultiply(_q1);
    return this;
  },
  rotateX: function(angle) {
    return this.rotateOnAxis(_xAxis, angle);
  },
  rotateY: function(angle) {
    return this.rotateOnAxis(_yAxis, angle);
  },
  rotateZ: function(angle) {
    return this.rotateOnAxis(_zAxis, angle);
  },
  translateOnAxis: function(axis, distance) {
    _v1$2.copy(axis).applyQuaternion(this.quaternion);
    this.position.add(_v1$2.multiplyScalar(distance));
    return this;
  },
  translateX: function(distance) {
    return this.translateOnAxis(_xAxis, distance);
  },
  translateY: function(distance) {
    return this.translateOnAxis(_yAxis, distance);
  },
  translateZ: function(distance) {
    return this.translateOnAxis(_zAxis, distance);
  },
  localToWorld: function(vector) {
    return vector.applyMatrix4(this.matrixWorld);
  },
  worldToLocal: function(vector) {
    return vector.applyMatrix4(_m1$1.copy(this.matrixWorld).invert());
  },
  lookAt: function(x, y, z) {
    if (x.isVector3) {
      _target.copy(x);
    } else {
      _target.set(x, y, z);
    }
    const parent = this.parent;
    this.updateWorldMatrix(true, false);
    _position.setFromMatrixPosition(this.matrixWorld);
    if (this.isCamera || this.isLight) {
      _m1$1.lookAt(_position, _target, this.up);
    } else {
      _m1$1.lookAt(_target, _position, this.up);
    }
    this.quaternion.setFromRotationMatrix(_m1$1);
    if (parent) {
      _m1$1.extractRotation(parent.matrixWorld);
      _q1.setFromRotationMatrix(_m1$1);
      this.quaternion.premultiply(_q1.invert());
    }
  },
  add: function(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.add(arguments[i]);
      }
      return this;
    }
    if (object === this) {
      console.error("THREE.Object3D.add: object can't be added as a child of itself.", object);
      return this;
    }
    if (object && object.isObject3D) {
      if (object.parent !== null) {
        object.parent.remove(object);
      }
      object.parent = this;
      this.children.push(object);
      object.dispatchEvent(_addedEvent);
    } else {
      console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.", object);
    }
    return this;
  },
  remove: function(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) {
        this.remove(arguments[i]);
      }
      return this;
    }
    const index2 = this.children.indexOf(object);
    if (index2 !== -1) {
      object.parent = null;
      this.children.splice(index2, 1);
      object.dispatchEvent(_removedEvent);
    }
    return this;
  },
  clear: function() {
    for (let i = 0; i < this.children.length; i++) {
      const object = this.children[i];
      object.parent = null;
      object.dispatchEvent(_removedEvent);
    }
    this.children.length = 0;
    return this;
  },
  attach: function(object) {
    this.updateWorldMatrix(true, false);
    _m1$1.copy(this.matrixWorld).invert();
    if (object.parent !== null) {
      object.parent.updateWorldMatrix(true, false);
      _m1$1.multiply(object.parent.matrixWorld);
    }
    object.applyMatrix4(_m1$1);
    this.add(object);
    object.updateWorldMatrix(false, true);
    return this;
  },
  getObjectById: function(id) {
    return this.getObjectByProperty("id", id);
  },
  getObjectByName: function(name) {
    return this.getObjectByProperty("name", name);
  },
  getObjectByProperty: function(name, value) {
    if (this[name] === value)
      return this;
    for (let i = 0, l = this.children.length; i < l; i++) {
      const child = this.children[i];
      const object = child.getObjectByProperty(name, value);
      if (object !== void 0) {
        return object;
      }
    }
    return void 0;
  },
  getWorldPosition: function(target) {
    if (target === void 0) {
      console.warn("THREE.Object3D: .getWorldPosition() target is now required");
      target = new Vector3();
    }
    this.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this.matrixWorld);
  },
  getWorldQuaternion: function(target) {
    if (target === void 0) {
      console.warn("THREE.Object3D: .getWorldQuaternion() target is now required");
      target = new Quaternion();
    }
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(_position, target, _scale);
    return target;
  },
  getWorldScale: function(target) {
    if (target === void 0) {
      console.warn("THREE.Object3D: .getWorldScale() target is now required");
      target = new Vector3();
    }
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(_position, _quaternion$2, target);
    return target;
  },
  getWorldDirection: function(target) {
    if (target === void 0) {
      console.warn("THREE.Object3D: .getWorldDirection() target is now required");
      target = new Vector3();
    }
    this.updateWorldMatrix(true, false);
    const e = this.matrixWorld.elements;
    return target.set(e[8], e[9], e[10]).normalize();
  },
  raycast: function() {
  },
  traverse: function(callback) {
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].traverse(callback);
    }
  },
  traverseVisible: function(callback) {
    if (this.visible === false)
      return;
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].traverseVisible(callback);
    }
  },
  traverseAncestors: function(callback) {
    const parent = this.parent;
    if (parent !== null) {
      callback(parent);
      parent.traverseAncestors(callback);
    }
  },
  updateMatrix: function() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixWorldNeedsUpdate = true;
  },
  updateMatrixWorld: function(force) {
    if (this.matrixAutoUpdate)
      this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.parent === null) {
        this.matrixWorld.copy(this.matrix);
      } else {
        this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].updateMatrixWorld(force);
    }
  },
  updateWorldMatrix: function(updateParents, updateChildren) {
    const parent = this.parent;
    if (updateParents === true && parent !== null) {
      parent.updateWorldMatrix(true, false);
    }
    if (this.matrixAutoUpdate)
      this.updateMatrix();
    if (this.parent === null) {
      this.matrixWorld.copy(this.matrix);
    } else {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    }
    if (updateChildren === true) {
      const children = this.children;
      for (let i = 0, l = children.length; i < l; i++) {
        children[i].updateWorldMatrix(false, true);
      }
    }
  },
  toJSON: function(meta) {
    const isRootObject = meta === void 0 || typeof meta === "string";
    const output = {};
    if (isRootObject) {
      meta = {
        geometries: {},
        materials: {},
        textures: {},
        images: {},
        shapes: {},
        skeletons: {},
        animations: {}
      };
      output.metadata = {
        version: 4.5,
        type: "Object",
        generator: "Object3D.toJSON"
      };
    }
    const object = {};
    object.uuid = this.uuid;
    object.type = this.type;
    if (this.name !== "")
      object.name = this.name;
    if (this.castShadow === true)
      object.castShadow = true;
    if (this.receiveShadow === true)
      object.receiveShadow = true;
    if (this.visible === false)
      object.visible = false;
    if (this.frustumCulled === false)
      object.frustumCulled = false;
    if (this.renderOrder !== 0)
      object.renderOrder = this.renderOrder;
    if (JSON.stringify(this.userData) !== "{}")
      object.userData = this.userData;
    object.layers = this.layers.mask;
    object.matrix = this.matrix.toArray();
    if (this.matrixAutoUpdate === false)
      object.matrixAutoUpdate = false;
    if (this.isInstancedMesh) {
      object.type = "InstancedMesh";
      object.count = this.count;
      object.instanceMatrix = this.instanceMatrix.toJSON();
    }
    function serialize(library, element) {
      if (library[element.uuid] === void 0) {
        library[element.uuid] = element.toJSON(meta);
      }
      return element.uuid;
    }
    if (this.isMesh || this.isLine || this.isPoints) {
      object.geometry = serialize(meta.geometries, this.geometry);
      const parameters = this.geometry.parameters;
      if (parameters !== void 0 && parameters.shapes !== void 0) {
        const shapes = parameters.shapes;
        if (Array.isArray(shapes)) {
          for (let i = 0, l = shapes.length; i < l; i++) {
            const shape = shapes[i];
            serialize(meta.shapes, shape);
          }
        } else {
          serialize(meta.shapes, shapes);
        }
      }
    }
    if (this.isSkinnedMesh) {
      object.bindMode = this.bindMode;
      object.bindMatrix = this.bindMatrix.toArray();
      if (this.skeleton !== void 0) {
        serialize(meta.skeletons, this.skeleton);
        object.skeleton = this.skeleton.uuid;
      }
    }
    if (this.material !== void 0) {
      if (Array.isArray(this.material)) {
        const uuids = [];
        for (let i = 0, l = this.material.length; i < l; i++) {
          uuids.push(serialize(meta.materials, this.material[i]));
        }
        object.material = uuids;
      } else {
        object.material = serialize(meta.materials, this.material);
      }
    }
    if (this.children.length > 0) {
      object.children = [];
      for (let i = 0; i < this.children.length; i++) {
        object.children.push(this.children[i].toJSON(meta).object);
      }
    }
    if (this.animations.length > 0) {
      object.animations = [];
      for (let i = 0; i < this.animations.length; i++) {
        const animation = this.animations[i];
        object.animations.push(serialize(meta.animations, animation));
      }
    }
    if (isRootObject) {
      const geometries = extractFromCache(meta.geometries);
      const materials = extractFromCache(meta.materials);
      const textures = extractFromCache(meta.textures);
      const images = extractFromCache(meta.images);
      const shapes = extractFromCache(meta.shapes);
      const skeletons = extractFromCache(meta.skeletons);
      const animations = extractFromCache(meta.animations);
      if (geometries.length > 0)
        output.geometries = geometries;
      if (materials.length > 0)
        output.materials = materials;
      if (textures.length > 0)
        output.textures = textures;
      if (images.length > 0)
        output.images = images;
      if (shapes.length > 0)
        output.shapes = shapes;
      if (skeletons.length > 0)
        output.skeletons = skeletons;
      if (animations.length > 0)
        output.animations = animations;
    }
    output.object = object;
    return output;
    function extractFromCache(cache) {
      const values = [];
      for (const key in cache) {
        const data = cache[key];
        delete data.metadata;
        values.push(data);
      }
      return values;
    }
  },
  clone: function(recursive) {
    return new this.constructor().copy(this, recursive);
  },
  copy: function(source, recursive = true) {
    this.name = source.name;
    this.up.copy(source.up);
    this.position.copy(source.position);
    this.rotation.order = source.rotation.order;
    this.quaternion.copy(source.quaternion);
    this.scale.copy(source.scale);
    this.matrix.copy(source.matrix);
    this.matrixWorld.copy(source.matrixWorld);
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrixWorldNeedsUpdate = source.matrixWorldNeedsUpdate;
    this.layers.mask = source.layers.mask;
    this.visible = source.visible;
    this.castShadow = source.castShadow;
    this.receiveShadow = source.receiveShadow;
    this.frustumCulled = source.frustumCulled;
    this.renderOrder = source.renderOrder;
    this.userData = JSON.parse(JSON.stringify(source.userData));
    if (recursive === true) {
      for (let i = 0; i < source.children.length; i++) {
        const child = source.children[i];
        this.add(child.clone());
      }
    }
    return this;
  }
});
const _vector1 = /* @__PURE__ */ new Vector3();
const _vector2 = /* @__PURE__ */ new Vector3();
const _normalMatrix = /* @__PURE__ */ new Matrix3();
class Plane {
  constructor(normal = new Vector3(1, 0, 0), constant = 0) {
    this.normal = normal;
    this.constant = constant;
  }
  set(normal, constant) {
    this.normal.copy(normal);
    this.constant = constant;
    return this;
  }
  setComponents(x, y, z, w) {
    this.normal.set(x, y, z);
    this.constant = w;
    return this;
  }
  setFromNormalAndCoplanarPoint(normal, point) {
    this.normal.copy(normal);
    this.constant = -point.dot(this.normal);
    return this;
  }
  setFromCoplanarPoints(a, b, c) {
    const normal = _vector1.subVectors(c, b).cross(_vector2.subVectors(a, b)).normalize();
    this.setFromNormalAndCoplanarPoint(normal, a);
    return this;
  }
  copy(plane) {
    this.normal.copy(plane.normal);
    this.constant = plane.constant;
    return this;
  }
  normalize() {
    const inverseNormalLength = 1 / this.normal.length();
    this.normal.multiplyScalar(inverseNormalLength);
    this.constant *= inverseNormalLength;
    return this;
  }
  negate() {
    this.constant *= -1;
    this.normal.negate();
    return this;
  }
  distanceToPoint(point) {
    return this.normal.dot(point) + this.constant;
  }
  distanceToSphere(sphere) {
    return this.distanceToPoint(sphere.center) - sphere.radius;
  }
  projectPoint(point, target) {
    if (target === void 0) {
      console.warn("THREE.Plane: .projectPoint() target is now required");
      target = new Vector3();
    }
    return target.copy(this.normal).multiplyScalar(-this.distanceToPoint(point)).add(point);
  }
  intersectLine(line, target) {
    if (target === void 0) {
      console.warn("THREE.Plane: .intersectLine() target is now required");
      target = new Vector3();
    }
    const direction = line.delta(_vector1);
    const denominator = this.normal.dot(direction);
    if (denominator === 0) {
      if (this.distanceToPoint(line.start) === 0) {
        return target.copy(line.start);
      }
      return void 0;
    }
    const t = -(line.start.dot(this.normal) + this.constant) / denominator;
    if (t < 0 || t > 1) {
      return void 0;
    }
    return target.copy(direction).multiplyScalar(t).add(line.start);
  }
  intersectsLine(line) {
    const startSign = this.distanceToPoint(line.start);
    const endSign = this.distanceToPoint(line.end);
    return startSign < 0 && endSign > 0 || endSign < 0 && startSign > 0;
  }
  intersectsBox(box) {
    return box.intersectsPlane(this);
  }
  intersectsSphere(sphere) {
    return sphere.intersectsPlane(this);
  }
  coplanarPoint(target) {
    if (target === void 0) {
      console.warn("THREE.Plane: .coplanarPoint() target is now required");
      target = new Vector3();
    }
    return target.copy(this.normal).multiplyScalar(-this.constant);
  }
  applyMatrix4(matrix, optionalNormalMatrix) {
    const normalMatrix = optionalNormalMatrix || _normalMatrix.getNormalMatrix(matrix);
    const referencePoint = this.coplanarPoint(_vector1).applyMatrix4(matrix);
    const normal = this.normal.applyMatrix3(normalMatrix).normalize();
    this.constant = -referencePoint.dot(normal);
    return this;
  }
  translate(offset) {
    this.constant -= offset.dot(this.normal);
    return this;
  }
  equals(plane) {
    return plane.normal.equals(this.normal) && plane.constant === this.constant;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
Plane.prototype.isPlane = true;
const _v0$1 = /* @__PURE__ */ new Vector3();
const _v1$3 = /* @__PURE__ */ new Vector3();
const _v2$1 = /* @__PURE__ */ new Vector3();
const _v3 = /* @__PURE__ */ new Vector3();
const _vab = /* @__PURE__ */ new Vector3();
const _vac = /* @__PURE__ */ new Vector3();
const _vbc = /* @__PURE__ */ new Vector3();
const _vap = /* @__PURE__ */ new Vector3();
const _vbp = /* @__PURE__ */ new Vector3();
const _vcp = /* @__PURE__ */ new Vector3();
class Triangle {
  constructor(a = new Vector3(), b = new Vector3(), c = new Vector3()) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
  static getNormal(a, b, c, target) {
    if (target === void 0) {
      console.warn("THREE.Triangle: .getNormal() target is now required");
      target = new Vector3();
    }
    target.subVectors(c, b);
    _v0$1.subVectors(a, b);
    target.cross(_v0$1);
    const targetLengthSq = target.lengthSq();
    if (targetLengthSq > 0) {
      return target.multiplyScalar(1 / Math.sqrt(targetLengthSq));
    }
    return target.set(0, 0, 0);
  }
  static getBarycoord(point, a, b, c, target) {
    _v0$1.subVectors(c, a);
    _v1$3.subVectors(b, a);
    _v2$1.subVectors(point, a);
    const dot00 = _v0$1.dot(_v0$1);
    const dot01 = _v0$1.dot(_v1$3);
    const dot02 = _v0$1.dot(_v2$1);
    const dot11 = _v1$3.dot(_v1$3);
    const dot12 = _v1$3.dot(_v2$1);
    const denom = dot00 * dot11 - dot01 * dot01;
    if (target === void 0) {
      console.warn("THREE.Triangle: .getBarycoord() target is now required");
      target = new Vector3();
    }
    if (denom === 0) {
      return target.set(-2, -1, -1);
    }
    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    return target.set(1 - u - v, v, u);
  }
  static containsPoint(point, a, b, c) {
    this.getBarycoord(point, a, b, c, _v3);
    return _v3.x >= 0 && _v3.y >= 0 && _v3.x + _v3.y <= 1;
  }
  static getUV(point, p1, p2, p3, uv1, uv2, uv3, target) {
    this.getBarycoord(point, p1, p2, p3, _v3);
    target.set(0, 0);
    target.addScaledVector(uv1, _v3.x);
    target.addScaledVector(uv2, _v3.y);
    target.addScaledVector(uv3, _v3.z);
    return target;
  }
  static isFrontFacing(a, b, c, direction) {
    _v0$1.subVectors(c, b);
    _v1$3.subVectors(a, b);
    return _v0$1.cross(_v1$3).dot(direction) < 0 ? true : false;
  }
  set(a, b, c) {
    this.a.copy(a);
    this.b.copy(b);
    this.c.copy(c);
    return this;
  }
  setFromPointsAndIndices(points, i0, i1, i2) {
    this.a.copy(points[i0]);
    this.b.copy(points[i1]);
    this.c.copy(points[i2]);
    return this;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(triangle) {
    this.a.copy(triangle.a);
    this.b.copy(triangle.b);
    this.c.copy(triangle.c);
    return this;
  }
  getArea() {
    _v0$1.subVectors(this.c, this.b);
    _v1$3.subVectors(this.a, this.b);
    return _v0$1.cross(_v1$3).length() * 0.5;
  }
  getMidpoint(target) {
    if (target === void 0) {
      console.warn("THREE.Triangle: .getMidpoint() target is now required");
      target = new Vector3();
    }
    return target.addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3);
  }
  getNormal(target) {
    return Triangle.getNormal(this.a, this.b, this.c, target);
  }
  getPlane(target) {
    if (target === void 0) {
      console.warn("THREE.Triangle: .getPlane() target is now required");
      target = new Plane();
    }
    return target.setFromCoplanarPoints(this.a, this.b, this.c);
  }
  getBarycoord(point, target) {
    return Triangle.getBarycoord(point, this.a, this.b, this.c, target);
  }
  getUV(point, uv1, uv2, uv3, target) {
    return Triangle.getUV(point, this.a, this.b, this.c, uv1, uv2, uv3, target);
  }
  containsPoint(point) {
    return Triangle.containsPoint(point, this.a, this.b, this.c);
  }
  isFrontFacing(direction) {
    return Triangle.isFrontFacing(this.a, this.b, this.c, direction);
  }
  intersectsBox(box) {
    return box.intersectsTriangle(this);
  }
  closestPointToPoint(p, target) {
    if (target === void 0) {
      console.warn("THREE.Triangle: .closestPointToPoint() target is now required");
      target = new Vector3();
    }
    const a = this.a, b = this.b, c = this.c;
    let v, w;
    _vab.subVectors(b, a);
    _vac.subVectors(c, a);
    _vap.subVectors(p, a);
    const d1 = _vab.dot(_vap);
    const d2 = _vac.dot(_vap);
    if (d1 <= 0 && d2 <= 0) {
      return target.copy(a);
    }
    _vbp.subVectors(p, b);
    const d3 = _vab.dot(_vbp);
    const d4 = _vac.dot(_vbp);
    if (d3 >= 0 && d4 <= d3) {
      return target.copy(b);
    }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      v = d1 / (d1 - d3);
      return target.copy(a).addScaledVector(_vab, v);
    }
    _vcp.subVectors(p, c);
    const d5 = _vab.dot(_vcp);
    const d6 = _vac.dot(_vcp);
    if (d6 >= 0 && d5 <= d6) {
      return target.copy(c);
    }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      w = d2 / (d2 - d6);
      return target.copy(a).addScaledVector(_vac, w);
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      _vbc.subVectors(c, b);
      w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      return target.copy(b).addScaledVector(_vbc, w);
    }
    const denom = 1 / (va + vb + vc);
    v = vb * denom;
    w = vc * denom;
    return target.copy(a).addScaledVector(_vab, v).addScaledVector(_vac, w);
  }
  equals(triangle) {
    return triangle.a.equals(this.a) && triangle.b.equals(this.b) && triangle.c.equals(this.c);
  }
}
let materialId = 0;
function Material() {
  Object.defineProperty(this, "id", {value: materialId++});
  this.uuid = MathUtils.generateUUID();
  this.name = "";
  this.type = "Material";
  this.fog = true;
  this.blending = NormalBlending;
  this.side = FrontSide;
  this.vertexColors = false;
  this.opacity = 1;
  this.transparent = false;
  this.blendSrc = SrcAlphaFactor;
  this.blendDst = OneMinusSrcAlphaFactor;
  this.blendEquation = AddEquation;
  this.blendSrcAlpha = null;
  this.blendDstAlpha = null;
  this.blendEquationAlpha = null;
  this.depthFunc = LessEqualDepth;
  this.depthTest = true;
  this.depthWrite = true;
  this.stencilWriteMask = 255;
  this.stencilFunc = AlwaysStencilFunc;
  this.stencilRef = 0;
  this.stencilFuncMask = 255;
  this.stencilFail = KeepStencilOp;
  this.stencilZFail = KeepStencilOp;
  this.stencilZPass = KeepStencilOp;
  this.stencilWrite = false;
  this.clippingPlanes = null;
  this.clipIntersection = false;
  this.clipShadows = false;
  this.shadowSide = null;
  this.colorWrite = true;
  this.precision = null;
  this.polygonOffset = false;
  this.polygonOffsetFactor = 0;
  this.polygonOffsetUnits = 0;
  this.dithering = false;
  this.alphaTest = 0;
  this.premultipliedAlpha = false;
  this.visible = true;
  this.toneMapped = true;
  this.userData = {};
  this.version = 0;
}
Material.prototype = Object.assign(Object.create(EventDispatcher.prototype), {
  constructor: Material,
  isMaterial: true,
  onBeforeCompile: function() {
  },
  customProgramCacheKey: function() {
    return this.onBeforeCompile.toString();
  },
  setValues: function(values) {
    if (values === void 0)
      return;
    for (const key in values) {
      const newValue = values[key];
      if (newValue === void 0) {
        console.warn("THREE.Material: '" + key + "' parameter is undefined.");
        continue;
      }
      if (key === "shading") {
        console.warn("THREE." + this.type + ": .shading has been removed. Use the boolean .flatShading instead.");
        this.flatShading = newValue === FlatShading ? true : false;
        continue;
      }
      const currentValue = this[key];
      if (currentValue === void 0) {
        console.warn("THREE." + this.type + ": '" + key + "' is not a property of this material.");
        continue;
      }
      if (currentValue && currentValue.isColor) {
        currentValue.set(newValue);
      } else if (currentValue && currentValue.isVector3 && (newValue && newValue.isVector3)) {
        currentValue.copy(newValue);
      } else {
        this[key] = newValue;
      }
    }
  },
  toJSON: function(meta) {
    const isRoot = meta === void 0 || typeof meta === "string";
    if (isRoot) {
      meta = {
        textures: {},
        images: {}
      };
    }
    const data = {
      metadata: {
        version: 4.5,
        type: "Material",
        generator: "Material.toJSON"
      }
    };
    data.uuid = this.uuid;
    data.type = this.type;
    if (this.name !== "")
      data.name = this.name;
    if (this.color && this.color.isColor)
      data.color = this.color.getHex();
    if (this.roughness !== void 0)
      data.roughness = this.roughness;
    if (this.metalness !== void 0)
      data.metalness = this.metalness;
    if (this.sheen && this.sheen.isColor)
      data.sheen = this.sheen.getHex();
    if (this.emissive && this.emissive.isColor)
      data.emissive = this.emissive.getHex();
    if (this.emissiveIntensity && this.emissiveIntensity !== 1)
      data.emissiveIntensity = this.emissiveIntensity;
    if (this.specular && this.specular.isColor)
      data.specular = this.specular.getHex();
    if (this.shininess !== void 0)
      data.shininess = this.shininess;
    if (this.clearcoat !== void 0)
      data.clearcoat = this.clearcoat;
    if (this.clearcoatRoughness !== void 0)
      data.clearcoatRoughness = this.clearcoatRoughness;
    if (this.clearcoatMap && this.clearcoatMap.isTexture) {
      data.clearcoatMap = this.clearcoatMap.toJSON(meta).uuid;
    }
    if (this.clearcoatRoughnessMap && this.clearcoatRoughnessMap.isTexture) {
      data.clearcoatRoughnessMap = this.clearcoatRoughnessMap.toJSON(meta).uuid;
    }
    if (this.clearcoatNormalMap && this.clearcoatNormalMap.isTexture) {
      data.clearcoatNormalMap = this.clearcoatNormalMap.toJSON(meta).uuid;
      data.clearcoatNormalScale = this.clearcoatNormalScale.toArray();
    }
    if (this.map && this.map.isTexture)
      data.map = this.map.toJSON(meta).uuid;
    if (this.matcap && this.matcap.isTexture)
      data.matcap = this.matcap.toJSON(meta).uuid;
    if (this.alphaMap && this.alphaMap.isTexture)
      data.alphaMap = this.alphaMap.toJSON(meta).uuid;
    if (this.lightMap && this.lightMap.isTexture) {
      data.lightMap = this.lightMap.toJSON(meta).uuid;
      data.lightMapIntensity = this.lightMapIntensity;
    }
    if (this.aoMap && this.aoMap.isTexture) {
      data.aoMap = this.aoMap.toJSON(meta).uuid;
      data.aoMapIntensity = this.aoMapIntensity;
    }
    if (this.bumpMap && this.bumpMap.isTexture) {
      data.bumpMap = this.bumpMap.toJSON(meta).uuid;
      data.bumpScale = this.bumpScale;
    }
    if (this.normalMap && this.normalMap.isTexture) {
      data.normalMap = this.normalMap.toJSON(meta).uuid;
      data.normalMapType = this.normalMapType;
      data.normalScale = this.normalScale.toArray();
    }
    if (this.displacementMap && this.displacementMap.isTexture) {
      data.displacementMap = this.displacementMap.toJSON(meta).uuid;
      data.displacementScale = this.displacementScale;
      data.displacementBias = this.displacementBias;
    }
    if (this.roughnessMap && this.roughnessMap.isTexture)
      data.roughnessMap = this.roughnessMap.toJSON(meta).uuid;
    if (this.metalnessMap && this.metalnessMap.isTexture)
      data.metalnessMap = this.metalnessMap.toJSON(meta).uuid;
    if (this.emissiveMap && this.emissiveMap.isTexture)
      data.emissiveMap = this.emissiveMap.toJSON(meta).uuid;
    if (this.specularMap && this.specularMap.isTexture)
      data.specularMap = this.specularMap.toJSON(meta).uuid;
    if (this.envMap && this.envMap.isTexture) {
      data.envMap = this.envMap.toJSON(meta).uuid;
      data.reflectivity = this.reflectivity;
      data.refractionRatio = this.refractionRatio;
      if (this.combine !== void 0)
        data.combine = this.combine;
      if (this.envMapIntensity !== void 0)
        data.envMapIntensity = this.envMapIntensity;
    }
    if (this.gradientMap && this.gradientMap.isTexture) {
      data.gradientMap = this.gradientMap.toJSON(meta).uuid;
    }
    if (this.size !== void 0)
      data.size = this.size;
    if (this.sizeAttenuation !== void 0)
      data.sizeAttenuation = this.sizeAttenuation;
    if (this.blending !== NormalBlending)
      data.blending = this.blending;
    if (this.side !== FrontSide)
      data.side = this.side;
    if (this.vertexColors)
      data.vertexColors = true;
    if (this.opacity < 1)
      data.opacity = this.opacity;
    if (this.transparent === true)
      data.transparent = this.transparent;
    data.depthFunc = this.depthFunc;
    data.depthTest = this.depthTest;
    data.depthWrite = this.depthWrite;
    data.stencilWrite = this.stencilWrite;
    data.stencilWriteMask = this.stencilWriteMask;
    data.stencilFunc = this.stencilFunc;
    data.stencilRef = this.stencilRef;
    data.stencilFuncMask = this.stencilFuncMask;
    data.stencilFail = this.stencilFail;
    data.stencilZFail = this.stencilZFail;
    data.stencilZPass = this.stencilZPass;
    if (this.rotation && this.rotation !== 0)
      data.rotation = this.rotation;
    if (this.polygonOffset === true)
      data.polygonOffset = true;
    if (this.polygonOffsetFactor !== 0)
      data.polygonOffsetFactor = this.polygonOffsetFactor;
    if (this.polygonOffsetUnits !== 0)
      data.polygonOffsetUnits = this.polygonOffsetUnits;
    if (this.linewidth && this.linewidth !== 1)
      data.linewidth = this.linewidth;
    if (this.dashSize !== void 0)
      data.dashSize = this.dashSize;
    if (this.gapSize !== void 0)
      data.gapSize = this.gapSize;
    if (this.scale !== void 0)
      data.scale = this.scale;
    if (this.dithering === true)
      data.dithering = true;
    if (this.alphaTest > 0)
      data.alphaTest = this.alphaTest;
    if (this.premultipliedAlpha === true)
      data.premultipliedAlpha = this.premultipliedAlpha;
    if (this.wireframe === true)
      data.wireframe = this.wireframe;
    if (this.wireframeLinewidth > 1)
      data.wireframeLinewidth = this.wireframeLinewidth;
    if (this.wireframeLinecap !== "round")
      data.wireframeLinecap = this.wireframeLinecap;
    if (this.wireframeLinejoin !== "round")
      data.wireframeLinejoin = this.wireframeLinejoin;
    if (this.morphTargets === true)
      data.morphTargets = true;
    if (this.morphNormals === true)
      data.morphNormals = true;
    if (this.skinning === true)
      data.skinning = true;
    if (this.flatShading === true)
      data.flatShading = this.flatShading;
    if (this.visible === false)
      data.visible = false;
    if (this.toneMapped === false)
      data.toneMapped = false;
    if (JSON.stringify(this.userData) !== "{}")
      data.userData = this.userData;
    function extractFromCache(cache) {
      const values = [];
      for (const key in cache) {
        const data2 = cache[key];
        delete data2.metadata;
        values.push(data2);
      }
      return values;
    }
    if (isRoot) {
      const textures = extractFromCache(meta.textures);
      const images = extractFromCache(meta.images);
      if (textures.length > 0)
        data.textures = textures;
      if (images.length > 0)
        data.images = images;
    }
    return data;
  },
  clone: function() {
    return new this.constructor().copy(this);
  },
  copy: function(source) {
    this.name = source.name;
    this.fog = source.fog;
    this.blending = source.blending;
    this.side = source.side;
    this.vertexColors = source.vertexColors;
    this.opacity = source.opacity;
    this.transparent = source.transparent;
    this.blendSrc = source.blendSrc;
    this.blendDst = source.blendDst;
    this.blendEquation = source.blendEquation;
    this.blendSrcAlpha = source.blendSrcAlpha;
    this.blendDstAlpha = source.blendDstAlpha;
    this.blendEquationAlpha = source.blendEquationAlpha;
    this.depthFunc = source.depthFunc;
    this.depthTest = source.depthTest;
    this.depthWrite = source.depthWrite;
    this.stencilWriteMask = source.stencilWriteMask;
    this.stencilFunc = source.stencilFunc;
    this.stencilRef = source.stencilRef;
    this.stencilFuncMask = source.stencilFuncMask;
    this.stencilFail = source.stencilFail;
    this.stencilZFail = source.stencilZFail;
    this.stencilZPass = source.stencilZPass;
    this.stencilWrite = source.stencilWrite;
    const srcPlanes = source.clippingPlanes;
    let dstPlanes = null;
    if (srcPlanes !== null) {
      const n = srcPlanes.length;
      dstPlanes = new Array(n);
      for (let i = 0; i !== n; ++i) {
        dstPlanes[i] = srcPlanes[i].clone();
      }
    }
    this.clippingPlanes = dstPlanes;
    this.clipIntersection = source.clipIntersection;
    this.clipShadows = source.clipShadows;
    this.shadowSide = source.shadowSide;
    this.colorWrite = source.colorWrite;
    this.precision = source.precision;
    this.polygonOffset = source.polygonOffset;
    this.polygonOffsetFactor = source.polygonOffsetFactor;
    this.polygonOffsetUnits = source.polygonOffsetUnits;
    this.dithering = source.dithering;
    this.alphaTest = source.alphaTest;
    this.premultipliedAlpha = source.premultipliedAlpha;
    this.visible = source.visible;
    this.toneMapped = source.toneMapped;
    this.userData = JSON.parse(JSON.stringify(source.userData));
    return this;
  },
  dispose: function() {
    this.dispatchEvent({type: "dispose"});
  }
});
Object.defineProperty(Material.prototype, "needsUpdate", {
  set: function(value) {
    if (value === true)
      this.version++;
  }
});
const _colorKeywords = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
const _hslA = {h: 0, s: 0, l: 0};
const _hslB = {h: 0, s: 0, l: 0};
function hue2rgb(p, q, t) {
  if (t < 0)
    t += 1;
  if (t > 1)
    t -= 1;
  if (t < 1 / 6)
    return p + (q - p) * 6 * t;
  if (t < 1 / 2)
    return q;
  if (t < 2 / 3)
    return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}
function SRGBToLinear(c) {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
function LinearToSRGB(c) {
  return c < 31308e-7 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
class Color {
  constructor(r, g, b) {
    if (g === void 0 && b === void 0) {
      return this.set(r);
    }
    return this.setRGB(r, g, b);
  }
  set(value) {
    if (value && value.isColor) {
      this.copy(value);
    } else if (typeof value === "number") {
      this.setHex(value);
    } else if (typeof value === "string") {
      this.setStyle(value);
    }
    return this;
  }
  setScalar(scalar) {
    this.r = scalar;
    this.g = scalar;
    this.b = scalar;
    return this;
  }
  setHex(hex) {
    hex = Math.floor(hex);
    this.r = (hex >> 16 & 255) / 255;
    this.g = (hex >> 8 & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }
  setRGB(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }
  setHSL(h, s2, l) {
    h = MathUtils.euclideanModulo(h, 1);
    s2 = MathUtils.clamp(s2, 0, 1);
    l = MathUtils.clamp(l, 0, 1);
    if (s2 === 0) {
      this.r = this.g = this.b = l;
    } else {
      const p = l <= 0.5 ? l * (1 + s2) : l + s2 - l * s2;
      const q = 2 * l - p;
      this.r = hue2rgb(q, p, h + 1 / 3);
      this.g = hue2rgb(q, p, h);
      this.b = hue2rgb(q, p, h - 1 / 3);
    }
    return this;
  }
  setStyle(style) {
    function handleAlpha(string) {
      if (string === void 0)
        return;
      if (parseFloat(string) < 1) {
        console.warn("THREE.Color: Alpha component of " + style + " will be ignored.");
      }
    }
    let m;
    if (m = /^((?:rgb|hsl)a?)\(([^\)]*)\)/.exec(style)) {
      let color;
      const name = m[1];
      const components2 = m[2];
      switch (name) {
        case "rgb":
        case "rgba":
          if (color = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components2)) {
            this.r = Math.min(255, parseInt(color[1], 10)) / 255;
            this.g = Math.min(255, parseInt(color[2], 10)) / 255;
            this.b = Math.min(255, parseInt(color[3], 10)) / 255;
            handleAlpha(color[4]);
            return this;
          }
          if (color = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components2)) {
            this.r = Math.min(100, parseInt(color[1], 10)) / 100;
            this.g = Math.min(100, parseInt(color[2], 10)) / 100;
            this.b = Math.min(100, parseInt(color[3], 10)) / 100;
            handleAlpha(color[4]);
            return this;
          }
          break;
        case "hsl":
        case "hsla":
          if (color = /^\s*(\d*\.?\d+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components2)) {
            const h = parseFloat(color[1]) / 360;
            const s2 = parseInt(color[2], 10) / 100;
            const l = parseInt(color[3], 10) / 100;
            handleAlpha(color[4]);
            return this.setHSL(h, s2, l);
          }
          break;
      }
    } else if (m = /^\#([A-Fa-f\d]+)$/.exec(style)) {
      const hex = m[1];
      const size = hex.length;
      if (size === 3) {
        this.r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
        this.g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
        this.b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
        return this;
      } else if (size === 6) {
        this.r = parseInt(hex.charAt(0) + hex.charAt(1), 16) / 255;
        this.g = parseInt(hex.charAt(2) + hex.charAt(3), 16) / 255;
        this.b = parseInt(hex.charAt(4) + hex.charAt(5), 16) / 255;
        return this;
      }
    }
    if (style && style.length > 0) {
      return this.setColorName(style);
    }
    return this;
  }
  setColorName(style) {
    const hex = _colorKeywords[style];
    if (hex !== void 0) {
      this.setHex(hex);
    } else {
      console.warn("THREE.Color: Unknown color " + style);
    }
    return this;
  }
  clone() {
    return new this.constructor(this.r, this.g, this.b);
  }
  copy(color) {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    return this;
  }
  copyGammaToLinear(color, gammaFactor = 2) {
    this.r = Math.pow(color.r, gammaFactor);
    this.g = Math.pow(color.g, gammaFactor);
    this.b = Math.pow(color.b, gammaFactor);
    return this;
  }
  copyLinearToGamma(color, gammaFactor = 2) {
    const safeInverse = gammaFactor > 0 ? 1 / gammaFactor : 1;
    this.r = Math.pow(color.r, safeInverse);
    this.g = Math.pow(color.g, safeInverse);
    this.b = Math.pow(color.b, safeInverse);
    return this;
  }
  convertGammaToLinear(gammaFactor) {
    this.copyGammaToLinear(this, gammaFactor);
    return this;
  }
  convertLinearToGamma(gammaFactor) {
    this.copyLinearToGamma(this, gammaFactor);
    return this;
  }
  copySRGBToLinear(color) {
    this.r = SRGBToLinear(color.r);
    this.g = SRGBToLinear(color.g);
    this.b = SRGBToLinear(color.b);
    return this;
  }
  copyLinearToSRGB(color) {
    this.r = LinearToSRGB(color.r);
    this.g = LinearToSRGB(color.g);
    this.b = LinearToSRGB(color.b);
    return this;
  }
  convertSRGBToLinear() {
    this.copySRGBToLinear(this);
    return this;
  }
  convertLinearToSRGB() {
    this.copyLinearToSRGB(this);
    return this;
  }
  getHex() {
    return this.r * 255 << 16 ^ this.g * 255 << 8 ^ this.b * 255 << 0;
  }
  getHexString() {
    return ("000000" + this.getHex().toString(16)).slice(-6);
  }
  getHSL(target) {
    if (target === void 0) {
      console.warn("THREE.Color: .getHSL() target is now required");
      target = {h: 0, s: 0, l: 0};
    }
    const r = this.r, g = this.g, b = this.b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue, saturation;
    const lightness = (min + max) / 2;
    if (min === max) {
      hue = 0;
      saturation = 0;
    } else {
      const delta = max - min;
      saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
      switch (max) {
        case r:
          hue = (g - b) / delta + (g < b ? 6 : 0);
          break;
        case g:
          hue = (b - r) / delta + 2;
          break;
        case b:
          hue = (r - g) / delta + 4;
          break;
      }
      hue /= 6;
    }
    target.h = hue;
    target.s = saturation;
    target.l = lightness;
    return target;
  }
  getStyle() {
    return "rgb(" + (this.r * 255 | 0) + "," + (this.g * 255 | 0) + "," + (this.b * 255 | 0) + ")";
  }
  offsetHSL(h, s2, l) {
    this.getHSL(_hslA);
    _hslA.h += h;
    _hslA.s += s2;
    _hslA.l += l;
    this.setHSL(_hslA.h, _hslA.s, _hslA.l);
    return this;
  }
  add(color) {
    this.r += color.r;
    this.g += color.g;
    this.b += color.b;
    return this;
  }
  addColors(color1, color2) {
    this.r = color1.r + color2.r;
    this.g = color1.g + color2.g;
    this.b = color1.b + color2.b;
    return this;
  }
  addScalar(s2) {
    this.r += s2;
    this.g += s2;
    this.b += s2;
    return this;
  }
  sub(color) {
    this.r = Math.max(0, this.r - color.r);
    this.g = Math.max(0, this.g - color.g);
    this.b = Math.max(0, this.b - color.b);
    return this;
  }
  multiply(color) {
    this.r *= color.r;
    this.g *= color.g;
    this.b *= color.b;
    return this;
  }
  multiplyScalar(s2) {
    this.r *= s2;
    this.g *= s2;
    this.b *= s2;
    return this;
  }
  lerp(color, alpha) {
    this.r += (color.r - this.r) * alpha;
    this.g += (color.g - this.g) * alpha;
    this.b += (color.b - this.b) * alpha;
    return this;
  }
  lerpColors(color1, color2, alpha) {
    this.r = color1.r + (color2.r - color1.r) * alpha;
    this.g = color1.g + (color2.g - color1.g) * alpha;
    this.b = color1.b + (color2.b - color1.b) * alpha;
    return this;
  }
  lerpHSL(color, alpha) {
    this.getHSL(_hslA);
    color.getHSL(_hslB);
    const h = MathUtils.lerp(_hslA.h, _hslB.h, alpha);
    const s2 = MathUtils.lerp(_hslA.s, _hslB.s, alpha);
    const l = MathUtils.lerp(_hslA.l, _hslB.l, alpha);
    this.setHSL(h, s2, l);
    return this;
  }
  equals(c) {
    return c.r === this.r && c.g === this.g && c.b === this.b;
  }
  fromArray(array, offset = 0) {
    this.r = array[offset];
    this.g = array[offset + 1];
    this.b = array[offset + 2];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.r;
    array[offset + 1] = this.g;
    array[offset + 2] = this.b;
    return array;
  }
  fromBufferAttribute(attribute, index2) {
    this.r = attribute.getX(index2);
    this.g = attribute.getY(index2);
    this.b = attribute.getZ(index2);
    if (attribute.normalized === true) {
      this.r /= 255;
      this.g /= 255;
      this.b /= 255;
    }
    return this;
  }
  toJSON() {
    return this.getHex();
  }
}
Color.NAMES = _colorKeywords;
Color.prototype.isColor = true;
Color.prototype.r = 1;
Color.prototype.g = 1;
Color.prototype.b = 1;
class MeshBasicMaterial extends Material {
  constructor(parameters) {
    super();
    this.type = "MeshBasicMaterial";
    this.color = new Color(16777215);
    this.map = null;
    this.lightMap = null;
    this.lightMapIntensity = 1;
    this.aoMap = null;
    this.aoMapIntensity = 1;
    this.specularMap = null;
    this.alphaMap = null;
    this.envMap = null;
    this.combine = MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = "round";
    this.wireframeLinejoin = "round";
    this.skinning = false;
    this.morphTargets = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.specularMap = source.specularMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.refractionRatio = source.refractionRatio;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.wireframeLinecap = source.wireframeLinecap;
    this.wireframeLinejoin = source.wireframeLinejoin;
    this.skinning = source.skinning;
    this.morphTargets = source.morphTargets;
    return this;
  }
}
MeshBasicMaterial.prototype.isMeshBasicMaterial = true;
const _vector$3 = new Vector3();
const _vector2$1 = new Vector2();
function BufferAttribute(array, itemSize, normalized) {
  if (Array.isArray(array)) {
    throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");
  }
  this.name = "";
  this.array = array;
  this.itemSize = itemSize;
  this.count = array !== void 0 ? array.length / itemSize : 0;
  this.normalized = normalized === true;
  this.usage = StaticDrawUsage;
  this.updateRange = {offset: 0, count: -1};
  this.version = 0;
}
Object.defineProperty(BufferAttribute.prototype, "needsUpdate", {
  set: function(value) {
    if (value === true)
      this.version++;
  }
});
Object.assign(BufferAttribute.prototype, {
  isBufferAttribute: true,
  onUploadCallback: function() {
  },
  setUsage: function(value) {
    this.usage = value;
    return this;
  },
  copy: function(source) {
    this.name = source.name;
    this.array = new source.array.constructor(source.array);
    this.itemSize = source.itemSize;
    this.count = source.count;
    this.normalized = source.normalized;
    this.usage = source.usage;
    return this;
  },
  copyAt: function(index1, attribute, index2) {
    index1 *= this.itemSize;
    index2 *= attribute.itemSize;
    for (let i = 0, l = this.itemSize; i < l; i++) {
      this.array[index1 + i] = attribute.array[index2 + i];
    }
    return this;
  },
  copyArray: function(array) {
    this.array.set(array);
    return this;
  },
  copyColorsArray: function(colors) {
    const array = this.array;
    let offset = 0;
    for (let i = 0, l = colors.length; i < l; i++) {
      let color = colors[i];
      if (color === void 0) {
        console.warn("THREE.BufferAttribute.copyColorsArray(): color is undefined", i);
        color = new Color();
      }
      array[offset++] = color.r;
      array[offset++] = color.g;
      array[offset++] = color.b;
    }
    return this;
  },
  copyVector2sArray: function(vectors) {
    const array = this.array;
    let offset = 0;
    for (let i = 0, l = vectors.length; i < l; i++) {
      let vector = vectors[i];
      if (vector === void 0) {
        console.warn("THREE.BufferAttribute.copyVector2sArray(): vector is undefined", i);
        vector = new Vector2();
      }
      array[offset++] = vector.x;
      array[offset++] = vector.y;
    }
    return this;
  },
  copyVector3sArray: function(vectors) {
    const array = this.array;
    let offset = 0;
    for (let i = 0, l = vectors.length; i < l; i++) {
      let vector = vectors[i];
      if (vector === void 0) {
        console.warn("THREE.BufferAttribute.copyVector3sArray(): vector is undefined", i);
        vector = new Vector3();
      }
      array[offset++] = vector.x;
      array[offset++] = vector.y;
      array[offset++] = vector.z;
    }
    return this;
  },
  copyVector4sArray: function(vectors) {
    const array = this.array;
    let offset = 0;
    for (let i = 0, l = vectors.length; i < l; i++) {
      let vector = vectors[i];
      if (vector === void 0) {
        console.warn("THREE.BufferAttribute.copyVector4sArray(): vector is undefined", i);
        vector = new Vector4();
      }
      array[offset++] = vector.x;
      array[offset++] = vector.y;
      array[offset++] = vector.z;
      array[offset++] = vector.w;
    }
    return this;
  },
  applyMatrix3: function(m) {
    if (this.itemSize === 2) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector2$1.fromBufferAttribute(this, i);
        _vector2$1.applyMatrix3(m);
        this.setXY(i, _vector2$1.x, _vector2$1.y);
      }
    } else if (this.itemSize === 3) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector$3.fromBufferAttribute(this, i);
        _vector$3.applyMatrix3(m);
        this.setXYZ(i, _vector$3.x, _vector$3.y, _vector$3.z);
      }
    }
    return this;
  },
  applyMatrix4: function(m) {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector$3.x = this.getX(i);
      _vector$3.y = this.getY(i);
      _vector$3.z = this.getZ(i);
      _vector$3.applyMatrix4(m);
      this.setXYZ(i, _vector$3.x, _vector$3.y, _vector$3.z);
    }
    return this;
  },
  applyNormalMatrix: function(m) {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector$3.x = this.getX(i);
      _vector$3.y = this.getY(i);
      _vector$3.z = this.getZ(i);
      _vector$3.applyNormalMatrix(m);
      this.setXYZ(i, _vector$3.x, _vector$3.y, _vector$3.z);
    }
    return this;
  },
  transformDirection: function(m) {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector$3.x = this.getX(i);
      _vector$3.y = this.getY(i);
      _vector$3.z = this.getZ(i);
      _vector$3.transformDirection(m);
      this.setXYZ(i, _vector$3.x, _vector$3.y, _vector$3.z);
    }
    return this;
  },
  set: function(value, offset = 0) {
    this.array.set(value, offset);
    return this;
  },
  getX: function(index2) {
    return this.array[index2 * this.itemSize];
  },
  setX: function(index2, x) {
    this.array[index2 * this.itemSize] = x;
    return this;
  },
  getY: function(index2) {
    return this.array[index2 * this.itemSize + 1];
  },
  setY: function(index2, y) {
    this.array[index2 * this.itemSize + 1] = y;
    return this;
  },
  getZ: function(index2) {
    return this.array[index2 * this.itemSize + 2];
  },
  setZ: function(index2, z) {
    this.array[index2 * this.itemSize + 2] = z;
    return this;
  },
  getW: function(index2) {
    return this.array[index2 * this.itemSize + 3];
  },
  setW: function(index2, w) {
    this.array[index2 * this.itemSize + 3] = w;
    return this;
  },
  setXY: function(index2, x, y) {
    index2 *= this.itemSize;
    this.array[index2 + 0] = x;
    this.array[index2 + 1] = y;
    return this;
  },
  setXYZ: function(index2, x, y, z) {
    index2 *= this.itemSize;
    this.array[index2 + 0] = x;
    this.array[index2 + 1] = y;
    this.array[index2 + 2] = z;
    return this;
  },
  setXYZW: function(index2, x, y, z, w) {
    index2 *= this.itemSize;
    this.array[index2 + 0] = x;
    this.array[index2 + 1] = y;
    this.array[index2 + 2] = z;
    this.array[index2 + 3] = w;
    return this;
  },
  onUpload: function(callback) {
    this.onUploadCallback = callback;
    return this;
  },
  clone: function() {
    return new this.constructor(this.array, this.itemSize).copy(this);
  },
  toJSON: function() {
    return {
      itemSize: this.itemSize,
      type: this.array.constructor.name,
      array: Array.prototype.slice.call(this.array),
      normalized: this.normalized
    };
  }
});
function Int8BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Int8Array(array), itemSize, normalized);
}
Int8BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Int8BufferAttribute.prototype.constructor = Int8BufferAttribute;
function Uint8BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Uint8Array(array), itemSize, normalized);
}
Uint8BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Uint8BufferAttribute.prototype.constructor = Uint8BufferAttribute;
function Uint8ClampedBufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Uint8ClampedArray(array), itemSize, normalized);
}
Uint8ClampedBufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Uint8ClampedBufferAttribute.prototype.constructor = Uint8ClampedBufferAttribute;
function Int16BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Int16Array(array), itemSize, normalized);
}
Int16BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Int16BufferAttribute.prototype.constructor = Int16BufferAttribute;
function Uint16BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Uint16Array(array), itemSize, normalized);
}
Uint16BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Uint16BufferAttribute.prototype.constructor = Uint16BufferAttribute;
function Int32BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Int32Array(array), itemSize, normalized);
}
Int32BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Int32BufferAttribute.prototype.constructor = Int32BufferAttribute;
function Uint32BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Uint32Array(array), itemSize, normalized);
}
Uint32BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Uint32BufferAttribute.prototype.constructor = Uint32BufferAttribute;
function Float16BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Uint16Array(array), itemSize, normalized);
}
Float16BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Float16BufferAttribute.prototype.constructor = Float16BufferAttribute;
Float16BufferAttribute.prototype.isFloat16BufferAttribute = true;
function Float32BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Float32Array(array), itemSize, normalized);
}
Float32BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Float32BufferAttribute.prototype.constructor = Float32BufferAttribute;
function Float64BufferAttribute(array, itemSize, normalized) {
  BufferAttribute.call(this, new Float64Array(array), itemSize, normalized);
}
Float64BufferAttribute.prototype = Object.create(BufferAttribute.prototype);
Float64BufferAttribute.prototype.constructor = Float64BufferAttribute;
function arrayMax(array) {
  if (array.length === 0)
    return -Infinity;
  let max = array[0];
  for (let i = 1, l = array.length; i < l; ++i) {
    if (array[i] > max)
      max = array[i];
  }
  return max;
}
let _id = 0;
const _m1$2 = new Matrix4();
const _obj = new Object3D();
const _offset = new Vector3();
const _box$2 = new Box3();
const _boxMorphTargets = new Box3();
const _vector$4 = new Vector3();
function BufferGeometry() {
  Object.defineProperty(this, "id", {value: _id++});
  this.uuid = MathUtils.generateUUID();
  this.name = "";
  this.type = "BufferGeometry";
  this.index = null;
  this.attributes = {};
  this.morphAttributes = {};
  this.morphTargetsRelative = false;
  this.groups = [];
  this.boundingBox = null;
  this.boundingSphere = null;
  this.drawRange = {start: 0, count: Infinity};
  this.userData = {};
}
BufferGeometry.prototype = Object.assign(Object.create(EventDispatcher.prototype), {
  constructor: BufferGeometry,
  isBufferGeometry: true,
  getIndex: function() {
    return this.index;
  },
  setIndex: function(index2) {
    if (Array.isArray(index2)) {
      this.index = new (arrayMax(index2) > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute)(index2, 1);
    } else {
      this.index = index2;
    }
    return this;
  },
  getAttribute: function(name) {
    return this.attributes[name];
  },
  setAttribute: function(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  },
  deleteAttribute: function(name) {
    delete this.attributes[name];
    return this;
  },
  hasAttribute: function(name) {
    return this.attributes[name] !== void 0;
  },
  addGroup: function(start, count, materialIndex = 0) {
    this.groups.push({
      start,
      count,
      materialIndex
    });
  },
  clearGroups: function() {
    this.groups = [];
  },
  setDrawRange: function(start, count) {
    this.drawRange.start = start;
    this.drawRange.count = count;
  },
  applyMatrix4: function(matrix) {
    const position = this.attributes.position;
    if (position !== void 0) {
      position.applyMatrix4(matrix);
      position.needsUpdate = true;
    }
    const normal = this.attributes.normal;
    if (normal !== void 0) {
      const normalMatrix = new Matrix3().getNormalMatrix(matrix);
      normal.applyNormalMatrix(normalMatrix);
      normal.needsUpdate = true;
    }
    const tangent = this.attributes.tangent;
    if (tangent !== void 0) {
      tangent.transformDirection(matrix);
      tangent.needsUpdate = true;
    }
    if (this.boundingBox !== null) {
      this.computeBoundingBox();
    }
    if (this.boundingSphere !== null) {
      this.computeBoundingSphere();
    }
    return this;
  },
  rotateX: function(angle) {
    _m1$2.makeRotationX(angle);
    this.applyMatrix4(_m1$2);
    return this;
  },
  rotateY: function(angle) {
    _m1$2.makeRotationY(angle);
    this.applyMatrix4(_m1$2);
    return this;
  },
  rotateZ: function(angle) {
    _m1$2.makeRotationZ(angle);
    this.applyMatrix4(_m1$2);
    return this;
  },
  translate: function(x, y, z) {
    _m1$2.makeTranslation(x, y, z);
    this.applyMatrix4(_m1$2);
    return this;
  },
  scale: function(x, y, z) {
    _m1$2.makeScale(x, y, z);
    this.applyMatrix4(_m1$2);
    return this;
  },
  lookAt: function(vector) {
    _obj.lookAt(vector);
    _obj.updateMatrix();
    this.applyMatrix4(_obj.matrix);
    return this;
  },
  center: function() {
    this.computeBoundingBox();
    this.boundingBox.getCenter(_offset).negate();
    this.translate(_offset.x, _offset.y, _offset.z);
    return this;
  },
  setFromPoints: function(points) {
    const position = [];
    for (let i = 0, l = points.length; i < l; i++) {
      const point = points[i];
      position.push(point.x, point.y, point.z || 0);
    }
    this.setAttribute("position", new Float32BufferAttribute(position, 3));
    return this;
  },
  computeBoundingBox: function() {
    if (this.boundingBox === null) {
      this.boundingBox = new Box3();
    }
    const position = this.attributes.position;
    const morphAttributesPosition = this.morphAttributes.position;
    if (position && position.isGLBufferAttribute) {
      console.error('THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box. Alternatively set "mesh.frustumCulled" to "false".', this);
      this.boundingBox.set(new Vector3(-Infinity, -Infinity, -Infinity), new Vector3(Infinity, Infinity, Infinity));
      return;
    }
    if (position !== void 0) {
      this.boundingBox.setFromBufferAttribute(position);
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          _box$2.setFromBufferAttribute(morphAttribute);
          if (this.morphTargetsRelative) {
            _vector$4.addVectors(this.boundingBox.min, _box$2.min);
            this.boundingBox.expandByPoint(_vector$4);
            _vector$4.addVectors(this.boundingBox.max, _box$2.max);
            this.boundingBox.expandByPoint(_vector$4);
          } else {
            this.boundingBox.expandByPoint(_box$2.min);
            this.boundingBox.expandByPoint(_box$2.max);
          }
        }
      }
    } else {
      this.boundingBox.makeEmpty();
    }
    if (isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) {
      console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.', this);
    }
  },
  computeBoundingSphere: function() {
    if (this.boundingSphere === null) {
      this.boundingSphere = new Sphere();
    }
    const position = this.attributes.position;
    const morphAttributesPosition = this.morphAttributes.position;
    if (position && position.isGLBufferAttribute) {
      console.error('THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere. Alternatively set "mesh.frustumCulled" to "false".', this);
      this.boundingSphere.set(new Vector3(), Infinity);
      return;
    }
    if (position) {
      const center = this.boundingSphere.center;
      _box$2.setFromBufferAttribute(position);
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          _boxMorphTargets.setFromBufferAttribute(morphAttribute);
          if (this.morphTargetsRelative) {
            _vector$4.addVectors(_box$2.min, _boxMorphTargets.min);
            _box$2.expandByPoint(_vector$4);
            _vector$4.addVectors(_box$2.max, _boxMorphTargets.max);
            _box$2.expandByPoint(_vector$4);
          } else {
            _box$2.expandByPoint(_boxMorphTargets.min);
            _box$2.expandByPoint(_boxMorphTargets.max);
          }
        }
      }
      _box$2.getCenter(center);
      let maxRadiusSq = 0;
      for (let i = 0, il = position.count; i < il; i++) {
        _vector$4.fromBufferAttribute(position, i);
        maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector$4));
      }
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          const morphTargetsRelative = this.morphTargetsRelative;
          for (let j = 0, jl = morphAttribute.count; j < jl; j++) {
            _vector$4.fromBufferAttribute(morphAttribute, j);
            if (morphTargetsRelative) {
              _offset.fromBufferAttribute(position, j);
              _vector$4.add(_offset);
            }
            maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector$4));
          }
        }
      }
      this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
      if (isNaN(this.boundingSphere.radius)) {
        console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this);
      }
    }
  },
  computeFaceNormals: function() {
  },
  computeTangents: function() {
    const index2 = this.index;
    const attributes = this.attributes;
    if (index2 === null || attributes.position === void 0 || attributes.normal === void 0 || attributes.uv === void 0) {
      console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");
      return;
    }
    const indices = index2.array;
    const positions = attributes.position.array;
    const normals = attributes.normal.array;
    const uvs = attributes.uv.array;
    const nVertices = positions.length / 3;
    if (attributes.tangent === void 0) {
      this.setAttribute("tangent", new BufferAttribute(new Float32Array(4 * nVertices), 4));
    }
    const tangents = attributes.tangent.array;
    const tan1 = [], tan2 = [];
    for (let i = 0; i < nVertices; i++) {
      tan1[i] = new Vector3();
      tan2[i] = new Vector3();
    }
    const vA = new Vector3(), vB = new Vector3(), vC = new Vector3(), uvA = new Vector2(), uvB = new Vector2(), uvC = new Vector2(), sdir = new Vector3(), tdir = new Vector3();
    function handleTriangle(a, b, c) {
      vA.fromArray(positions, a * 3);
      vB.fromArray(positions, b * 3);
      vC.fromArray(positions, c * 3);
      uvA.fromArray(uvs, a * 2);
      uvB.fromArray(uvs, b * 2);
      uvC.fromArray(uvs, c * 2);
      vB.sub(vA);
      vC.sub(vA);
      uvB.sub(uvA);
      uvC.sub(uvA);
      const r = 1 / (uvB.x * uvC.y - uvC.x * uvB.y);
      if (!isFinite(r))
        return;
      sdir.copy(vB).multiplyScalar(uvC.y).addScaledVector(vC, -uvB.y).multiplyScalar(r);
      tdir.copy(vC).multiplyScalar(uvB.x).addScaledVector(vB, -uvC.x).multiplyScalar(r);
      tan1[a].add(sdir);
      tan1[b].add(sdir);
      tan1[c].add(sdir);
      tan2[a].add(tdir);
      tan2[b].add(tdir);
      tan2[c].add(tdir);
    }
    let groups = this.groups;
    if (groups.length === 0) {
      groups = [{
        start: 0,
        count: indices.length
      }];
    }
    for (let i = 0, il = groups.length; i < il; ++i) {
      const group = groups[i];
      const start = group.start;
      const count = group.count;
      for (let j = start, jl = start + count; j < jl; j += 3) {
        handleTriangle(indices[j + 0], indices[j + 1], indices[j + 2]);
      }
    }
    const tmp = new Vector3(), tmp2 = new Vector3();
    const n = new Vector3(), n2 = new Vector3();
    function handleVertex(v) {
      n.fromArray(normals, v * 3);
      n2.copy(n);
      const t = tan1[v];
      tmp.copy(t);
      tmp.sub(n.multiplyScalar(n.dot(t))).normalize();
      tmp2.crossVectors(n2, t);
      const test = tmp2.dot(tan2[v]);
      const w = test < 0 ? -1 : 1;
      tangents[v * 4] = tmp.x;
      tangents[v * 4 + 1] = tmp.y;
      tangents[v * 4 + 2] = tmp.z;
      tangents[v * 4 + 3] = w;
    }
    for (let i = 0, il = groups.length; i < il; ++i) {
      const group = groups[i];
      const start = group.start;
      const count = group.count;
      for (let j = start, jl = start + count; j < jl; j += 3) {
        handleVertex(indices[j + 0]);
        handleVertex(indices[j + 1]);
        handleVertex(indices[j + 2]);
      }
    }
  },
  computeVertexNormals: function() {
    const index2 = this.index;
    const positionAttribute = this.getAttribute("position");
    if (positionAttribute !== void 0) {
      let normalAttribute = this.getAttribute("normal");
      if (normalAttribute === void 0) {
        normalAttribute = new BufferAttribute(new Float32Array(positionAttribute.count * 3), 3);
        this.setAttribute("normal", normalAttribute);
      } else {
        for (let i = 0, il = normalAttribute.count; i < il; i++) {
          normalAttribute.setXYZ(i, 0, 0, 0);
        }
      }
      const pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
      const nA = new Vector3(), nB = new Vector3(), nC = new Vector3();
      const cb = new Vector3(), ab = new Vector3();
      if (index2) {
        for (let i = 0, il = index2.count; i < il; i += 3) {
          const vA = index2.getX(i + 0);
          const vB = index2.getX(i + 1);
          const vC = index2.getX(i + 2);
          pA.fromBufferAttribute(positionAttribute, vA);
          pB.fromBufferAttribute(positionAttribute, vB);
          pC.fromBufferAttribute(positionAttribute, vC);
          cb.subVectors(pC, pB);
          ab.subVectors(pA, pB);
          cb.cross(ab);
          nA.fromBufferAttribute(normalAttribute, vA);
          nB.fromBufferAttribute(normalAttribute, vB);
          nC.fromBufferAttribute(normalAttribute, vC);
          nA.add(cb);
          nB.add(cb);
          nC.add(cb);
          normalAttribute.setXYZ(vA, nA.x, nA.y, nA.z);
          normalAttribute.setXYZ(vB, nB.x, nB.y, nB.z);
          normalAttribute.setXYZ(vC, nC.x, nC.y, nC.z);
        }
      } else {
        for (let i = 0, il = positionAttribute.count; i < il; i += 3) {
          pA.fromBufferAttribute(positionAttribute, i + 0);
          pB.fromBufferAttribute(positionAttribute, i + 1);
          pC.fromBufferAttribute(positionAttribute, i + 2);
          cb.subVectors(pC, pB);
          ab.subVectors(pA, pB);
          cb.cross(ab);
          normalAttribute.setXYZ(i + 0, cb.x, cb.y, cb.z);
          normalAttribute.setXYZ(i + 1, cb.x, cb.y, cb.z);
          normalAttribute.setXYZ(i + 2, cb.x, cb.y, cb.z);
        }
      }
      this.normalizeNormals();
      normalAttribute.needsUpdate = true;
    }
  },
  merge: function(geometry, offset) {
    if (!(geometry && geometry.isBufferGeometry)) {
      console.error("THREE.BufferGeometry.merge(): geometry not an instance of THREE.BufferGeometry.", geometry);
      return;
    }
    if (offset === void 0) {
      offset = 0;
      console.warn("THREE.BufferGeometry.merge(): Overwriting original geometry, starting at offset=0. Use BufferGeometryUtils.mergeBufferGeometries() for lossless merge.");
    }
    const attributes = this.attributes;
    for (const key in attributes) {
      if (geometry.attributes[key] === void 0)
        continue;
      const attribute1 = attributes[key];
      const attributeArray1 = attribute1.array;
      const attribute2 = geometry.attributes[key];
      const attributeArray2 = attribute2.array;
      const attributeOffset = attribute2.itemSize * offset;
      const length = Math.min(attributeArray2.length, attributeArray1.length - attributeOffset);
      for (let i = 0, j = attributeOffset; i < length; i++, j++) {
        attributeArray1[j] = attributeArray2[i];
      }
    }
    return this;
  },
  normalizeNormals: function() {
    const normals = this.attributes.normal;
    for (let i = 0, il = normals.count; i < il; i++) {
      _vector$4.fromBufferAttribute(normals, i);
      _vector$4.normalize();
      normals.setXYZ(i, _vector$4.x, _vector$4.y, _vector$4.z);
    }
  },
  toNonIndexed: function() {
    function convertBufferAttribute(attribute, indices2) {
      const array = attribute.array;
      const itemSize = attribute.itemSize;
      const normalized = attribute.normalized;
      const array2 = new array.constructor(indices2.length * itemSize);
      let index2 = 0, index22 = 0;
      for (let i = 0, l = indices2.length; i < l; i++) {
        index2 = indices2[i] * itemSize;
        for (let j = 0; j < itemSize; j++) {
          array2[index22++] = array[index2++];
        }
      }
      return new BufferAttribute(array2, itemSize, normalized);
    }
    if (this.index === null) {
      console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.");
      return this;
    }
    const geometry2 = new BufferGeometry();
    const indices = this.index.array;
    const attributes = this.attributes;
    for (const name in attributes) {
      const attribute = attributes[name];
      const newAttribute = convertBufferAttribute(attribute, indices);
      geometry2.setAttribute(name, newAttribute);
    }
    const morphAttributes = this.morphAttributes;
    for (const name in morphAttributes) {
      const morphArray = [];
      const morphAttribute = morphAttributes[name];
      for (let i = 0, il = morphAttribute.length; i < il; i++) {
        const attribute = morphAttribute[i];
        const newAttribute = convertBufferAttribute(attribute, indices);
        morphArray.push(newAttribute);
      }
      geometry2.morphAttributes[name] = morphArray;
    }
    geometry2.morphTargetsRelative = this.morphTargetsRelative;
    const groups = this.groups;
    for (let i = 0, l = groups.length; i < l; i++) {
      const group = groups[i];
      geometry2.addGroup(group.start, group.count, group.materialIndex);
    }
    return geometry2;
  },
  toJSON: function() {
    const data = {
      metadata: {
        version: 4.5,
        type: "BufferGeometry",
        generator: "BufferGeometry.toJSON"
      }
    };
    data.uuid = this.uuid;
    data.type = this.type;
    if (this.name !== "")
      data.name = this.name;
    if (Object.keys(this.userData).length > 0)
      data.userData = this.userData;
    if (this.parameters !== void 0) {
      const parameters = this.parameters;
      for (const key in parameters) {
        if (parameters[key] !== void 0)
          data[key] = parameters[key];
      }
      return data;
    }
    data.data = {attributes: {}};
    const index2 = this.index;
    if (index2 !== null) {
      data.data.index = {
        type: index2.array.constructor.name,
        array: Array.prototype.slice.call(index2.array)
      };
    }
    const attributes = this.attributes;
    for (const key in attributes) {
      const attribute = attributes[key];
      const attributeData = attribute.toJSON(data.data);
      if (attribute.name !== "")
        attributeData.name = attribute.name;
      data.data.attributes[key] = attributeData;
    }
    const morphAttributes = {};
    let hasMorphAttributes = false;
    for (const key in this.morphAttributes) {
      const attributeArray = this.morphAttributes[key];
      const array = [];
      for (let i = 0, il = attributeArray.length; i < il; i++) {
        const attribute = attributeArray[i];
        const attributeData = attribute.toJSON(data.data);
        if (attribute.name !== "")
          attributeData.name = attribute.name;
        array.push(attributeData);
      }
      if (array.length > 0) {
        morphAttributes[key] = array;
        hasMorphAttributes = true;
      }
    }
    if (hasMorphAttributes) {
      data.data.morphAttributes = morphAttributes;
      data.data.morphTargetsRelative = this.morphTargetsRelative;
    }
    const groups = this.groups;
    if (groups.length > 0) {
      data.data.groups = JSON.parse(JSON.stringify(groups));
    }
    const boundingSphere = this.boundingSphere;
    if (boundingSphere !== null) {
      data.data.boundingSphere = {
        center: boundingSphere.center.toArray(),
        radius: boundingSphere.radius
      };
    }
    return data;
  },
  clone: function() {
    return new BufferGeometry().copy(this);
  },
  copy: function(source) {
    this.index = null;
    this.attributes = {};
    this.morphAttributes = {};
    this.groups = [];
    this.boundingBox = null;
    this.boundingSphere = null;
    const data = {};
    this.name = source.name;
    const index2 = source.index;
    if (index2 !== null) {
      this.setIndex(index2.clone(data));
    }
    const attributes = source.attributes;
    for (const name in attributes) {
      const attribute = attributes[name];
      this.setAttribute(name, attribute.clone(data));
    }
    const morphAttributes = source.morphAttributes;
    for (const name in morphAttributes) {
      const array = [];
      const morphAttribute = morphAttributes[name];
      for (let i = 0, l = morphAttribute.length; i < l; i++) {
        array.push(morphAttribute[i].clone(data));
      }
      this.morphAttributes[name] = array;
    }
    this.morphTargetsRelative = source.morphTargetsRelative;
    const groups = source.groups;
    for (let i = 0, l = groups.length; i < l; i++) {
      const group = groups[i];
      this.addGroup(group.start, group.count, group.materialIndex);
    }
    const boundingBox = source.boundingBox;
    if (boundingBox !== null) {
      this.boundingBox = boundingBox.clone();
    }
    const boundingSphere = source.boundingSphere;
    if (boundingSphere !== null) {
      this.boundingSphere = boundingSphere.clone();
    }
    this.drawRange.start = source.drawRange.start;
    this.drawRange.count = source.drawRange.count;
    this.userData = source.userData;
    return this;
  },
  dispose: function() {
    this.dispatchEvent({type: "dispose"});
  }
});
const _inverseMatrix = new Matrix4();
const _ray = new Ray();
const _sphere = new Sphere();
const _vA = new Vector3();
const _vB = new Vector3();
const _vC = new Vector3();
const _tempA = new Vector3();
const _tempB = new Vector3();
const _tempC = new Vector3();
const _morphA = new Vector3();
const _morphB = new Vector3();
const _morphC = new Vector3();
const _uvA = new Vector2();
const _uvB = new Vector2();
const _uvC = new Vector2();
const _intersectionPoint = new Vector3();
const _intersectionPointWorld = new Vector3();
function Mesh(geometry = new BufferGeometry(), material = new MeshBasicMaterial()) {
  Object3D.call(this);
  this.type = "Mesh";
  this.geometry = geometry;
  this.material = material;
  this.updateMorphTargets();
}
Mesh.prototype = Object.assign(Object.create(Object3D.prototype), {
  constructor: Mesh,
  isMesh: true,
  copy: function(source) {
    Object3D.prototype.copy.call(this, source);
    if (source.morphTargetInfluences !== void 0) {
      this.morphTargetInfluences = source.morphTargetInfluences.slice();
    }
    if (source.morphTargetDictionary !== void 0) {
      this.morphTargetDictionary = Object.assign({}, source.morphTargetDictionary);
    }
    this.material = source.material;
    this.geometry = source.geometry;
    return this;
  },
  updateMorphTargets: function() {
    const geometry = this.geometry;
    if (geometry.isBufferGeometry) {
      const morphAttributes = geometry.morphAttributes;
      const keys = Object.keys(morphAttributes);
      if (keys.length > 0) {
        const morphAttribute = morphAttributes[keys[0]];
        if (morphAttribute !== void 0) {
          this.morphTargetInfluences = [];
          this.morphTargetDictionary = {};
          for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
            const name = morphAttribute[m].name || String(m);
            this.morphTargetInfluences.push(0);
            this.morphTargetDictionary[name] = m;
          }
        }
      }
    } else {
      const morphTargets = geometry.morphTargets;
      if (morphTargets !== void 0 && morphTargets.length > 0) {
        console.error("THREE.Mesh.updateMorphTargets() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");
      }
    }
  },
  raycast: function(raycaster, intersects) {
    const geometry = this.geometry;
    const material = this.material;
    const matrixWorld = this.matrixWorld;
    if (material === void 0)
      return;
    if (geometry.boundingSphere === null)
      geometry.computeBoundingSphere();
    _sphere.copy(geometry.boundingSphere);
    _sphere.applyMatrix4(matrixWorld);
    if (raycaster.ray.intersectsSphere(_sphere) === false)
      return;
    _inverseMatrix.copy(matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    if (geometry.boundingBox !== null) {
      if (_ray.intersectsBox(geometry.boundingBox) === false)
        return;
    }
    let intersection;
    if (geometry.isBufferGeometry) {
      const index2 = geometry.index;
      const position = geometry.attributes.position;
      const morphPosition = geometry.morphAttributes.position;
      const morphTargetsRelative = geometry.morphTargetsRelative;
      const uv = geometry.attributes.uv;
      const uv2 = geometry.attributes.uv2;
      const groups = geometry.groups;
      const drawRange = geometry.drawRange;
      if (index2 !== null) {
        if (Array.isArray(material)) {
          for (let i = 0, il = groups.length; i < il; i++) {
            const group = groups[i];
            const groupMaterial = material[group.materialIndex];
            const start = Math.max(group.start, drawRange.start);
            const end = Math.min(group.start + group.count, drawRange.start + drawRange.count);
            for (let j = start, jl = end; j < jl; j += 3) {
              const a = index2.getX(j);
              const b = index2.getX(j + 1);
              const c = index2.getX(j + 2);
              intersection = checkBufferGeometryIntersection(this, groupMaterial, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c);
              if (intersection) {
                intersection.faceIndex = Math.floor(j / 3);
                intersection.face.materialIndex = group.materialIndex;
                intersects.push(intersection);
              }
            }
          }
        } else {
          const start = Math.max(0, drawRange.start);
          const end = Math.min(index2.count, drawRange.start + drawRange.count);
          for (let i = start, il = end; i < il; i += 3) {
            const a = index2.getX(i);
            const b = index2.getX(i + 1);
            const c = index2.getX(i + 2);
            intersection = checkBufferGeometryIntersection(this, material, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c);
            if (intersection) {
              intersection.faceIndex = Math.floor(i / 3);
              intersects.push(intersection);
            }
          }
        }
      } else if (position !== void 0) {
        if (Array.isArray(material)) {
          for (let i = 0, il = groups.length; i < il; i++) {
            const group = groups[i];
            const groupMaterial = material[group.materialIndex];
            const start = Math.max(group.start, drawRange.start);
            const end = Math.min(group.start + group.count, drawRange.start + drawRange.count);
            for (let j = start, jl = end; j < jl; j += 3) {
              const a = j;
              const b = j + 1;
              const c = j + 2;
              intersection = checkBufferGeometryIntersection(this, groupMaterial, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c);
              if (intersection) {
                intersection.faceIndex = Math.floor(j / 3);
                intersection.face.materialIndex = group.materialIndex;
                intersects.push(intersection);
              }
            }
          }
        } else {
          const start = Math.max(0, drawRange.start);
          const end = Math.min(position.count, drawRange.start + drawRange.count);
          for (let i = start, il = end; i < il; i += 3) {
            const a = i;
            const b = i + 1;
            const c = i + 2;
            intersection = checkBufferGeometryIntersection(this, material, raycaster, _ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c);
            if (intersection) {
              intersection.faceIndex = Math.floor(i / 3);
              intersects.push(intersection);
            }
          }
        }
      }
    } else if (geometry.isGeometry) {
      console.error("THREE.Mesh.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");
    }
  }
});
function checkIntersection(object, material, raycaster, ray, pA, pB, pC, point) {
  let intersect;
  if (material.side === BackSide) {
    intersect = ray.intersectTriangle(pC, pB, pA, true, point);
  } else {
    intersect = ray.intersectTriangle(pA, pB, pC, material.side !== DoubleSide, point);
  }
  if (intersect === null)
    return null;
  _intersectionPointWorld.copy(point);
  _intersectionPointWorld.applyMatrix4(object.matrixWorld);
  const distance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
  if (distance < raycaster.near || distance > raycaster.far)
    return null;
  return {
    distance,
    point: _intersectionPointWorld.clone(),
    object
  };
}
function checkBufferGeometryIntersection(object, material, raycaster, ray, position, morphPosition, morphTargetsRelative, uv, uv2, a, b, c) {
  _vA.fromBufferAttribute(position, a);
  _vB.fromBufferAttribute(position, b);
  _vC.fromBufferAttribute(position, c);
  const morphInfluences = object.morphTargetInfluences;
  if (material.morphTargets && morphPosition && morphInfluences) {
    _morphA.set(0, 0, 0);
    _morphB.set(0, 0, 0);
    _morphC.set(0, 0, 0);
    for (let i = 0, il = morphPosition.length; i < il; i++) {
      const influence = morphInfluences[i];
      const morphAttribute = morphPosition[i];
      if (influence === 0)
        continue;
      _tempA.fromBufferAttribute(morphAttribute, a);
      _tempB.fromBufferAttribute(morphAttribute, b);
      _tempC.fromBufferAttribute(morphAttribute, c);
      if (morphTargetsRelative) {
        _morphA.addScaledVector(_tempA, influence);
        _morphB.addScaledVector(_tempB, influence);
        _morphC.addScaledVector(_tempC, influence);
      } else {
        _morphA.addScaledVector(_tempA.sub(_vA), influence);
        _morphB.addScaledVector(_tempB.sub(_vB), influence);
        _morphC.addScaledVector(_tempC.sub(_vC), influence);
      }
    }
    _vA.add(_morphA);
    _vB.add(_morphB);
    _vC.add(_morphC);
  }
  if (object.isSkinnedMesh && material.skinning) {
    object.boneTransform(a, _vA);
    object.boneTransform(b, _vB);
    object.boneTransform(c, _vC);
  }
  const intersection = checkIntersection(object, material, raycaster, ray, _vA, _vB, _vC, _intersectionPoint);
  if (intersection) {
    if (uv) {
      _uvA.fromBufferAttribute(uv, a);
      _uvB.fromBufferAttribute(uv, b);
      _uvC.fromBufferAttribute(uv, c);
      intersection.uv = Triangle.getUV(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2());
    }
    if (uv2) {
      _uvA.fromBufferAttribute(uv2, a);
      _uvB.fromBufferAttribute(uv2, b);
      _uvC.fromBufferAttribute(uv2, c);
      intersection.uv2 = Triangle.getUV(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2());
    }
    const face = {
      a,
      b,
      c,
      normal: new Vector3(),
      materialIndex: 0
    };
    Triangle.getNormal(_vA, _vB, _vC, face.normal);
    intersection.face = face;
  }
  return intersection;
}
class BoxGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1) {
    super();
    this.type = "BoxGeometry";
    this.parameters = {
      width,
      height,
      depth,
      widthSegments,
      heightSegments,
      depthSegments
    };
    const scope = this;
    widthSegments = Math.floor(widthSegments);
    heightSegments = Math.floor(heightSegments);
    depthSegments = Math.floor(depthSegments);
    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];
    let numberOfVertices = 0;
    let groupStart = 0;
    buildPlane("z", "y", "x", -1, -1, depth, height, width, depthSegments, heightSegments, 0);
    buildPlane("z", "y", "x", 1, -1, depth, height, -width, depthSegments, heightSegments, 1);
    buildPlane("x", "z", "y", 1, 1, width, depth, height, widthSegments, depthSegments, 2);
    buildPlane("x", "z", "y", 1, -1, width, depth, -height, widthSegments, depthSegments, 3);
    buildPlane("x", "y", "z", 1, -1, width, height, depth, widthSegments, heightSegments, 4);
    buildPlane("x", "y", "z", -1, -1, width, height, -depth, widthSegments, heightSegments, 5);
    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    function buildPlane(u, v, w, udir, vdir, width2, height2, depth2, gridX, gridY, materialIndex) {
      const segmentWidth = width2 / gridX;
      const segmentHeight = height2 / gridY;
      const widthHalf = width2 / 2;
      const heightHalf = height2 / 2;
      const depthHalf = depth2 / 2;
      const gridX1 = gridX + 1;
      const gridY1 = gridY + 1;
      let vertexCounter = 0;
      let groupCount = 0;
      const vector = new Vector3();
      for (let iy = 0; iy < gridY1; iy++) {
        const y = iy * segmentHeight - heightHalf;
        for (let ix = 0; ix < gridX1; ix++) {
          const x = ix * segmentWidth - widthHalf;
          vector[u] = x * udir;
          vector[v] = y * vdir;
          vector[w] = depthHalf;
          vertices.push(vector.x, vector.y, vector.z);
          vector[u] = 0;
          vector[v] = 0;
          vector[w] = depth2 > 0 ? 1 : -1;
          normals.push(vector.x, vector.y, vector.z);
          uvs.push(ix / gridX);
          uvs.push(1 - iy / gridY);
          vertexCounter += 1;
        }
      }
      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = numberOfVertices + ix + gridX1 * iy;
          const b = numberOfVertices + ix + gridX1 * (iy + 1);
          const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
          const d2 = numberOfVertices + (ix + 1) + gridX1 * iy;
          indices.push(a, b, d2);
          indices.push(b, c, d2);
          groupCount += 6;
        }
      }
      scope.addGroup(groupStart, groupCount, materialIndex);
      groupStart += groupCount;
      numberOfVertices += vertexCounter;
    }
  }
}
function cloneUniforms(src2) {
  const dst = {};
  for (const u in src2) {
    dst[u] = {};
    for (const p in src2[u]) {
      const property = src2[u][p];
      if (property && (property.isColor || property.isMatrix3 || property.isMatrix4 || property.isVector2 || property.isVector3 || property.isVector4 || property.isTexture || property.isQuaternion)) {
        dst[u][p] = property.clone();
      } else if (Array.isArray(property)) {
        dst[u][p] = property.slice();
      } else {
        dst[u][p] = property;
      }
    }
  }
  return dst;
}
function mergeUniforms(uniforms) {
  const merged = {};
  for (let u = 0; u < uniforms.length; u++) {
    const tmp = cloneUniforms(uniforms[u]);
    for (const p in tmp) {
      merged[p] = tmp[p];
    }
  }
  return merged;
}
const UniformsUtils = {clone: cloneUniforms, merge: mergeUniforms};
var default_vertex = "void main() {\n	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}";
var default_fragment = "void main() {\n	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );\n}";
function ShaderMaterial(parameters) {
  Material.call(this);
  this.type = "ShaderMaterial";
  this.defines = {};
  this.uniforms = {};
  this.vertexShader = default_vertex;
  this.fragmentShader = default_fragment;
  this.linewidth = 1;
  this.wireframe = false;
  this.wireframeLinewidth = 1;
  this.fog = false;
  this.lights = false;
  this.clipping = false;
  this.skinning = false;
  this.morphTargets = false;
  this.morphNormals = false;
  this.extensions = {
    derivatives: false,
    fragDepth: false,
    drawBuffers: false,
    shaderTextureLOD: false
  };
  this.defaultAttributeValues = {
    color: [1, 1, 1],
    uv: [0, 0],
    uv2: [0, 0]
  };
  this.index0AttributeName = void 0;
  this.uniformsNeedUpdate = false;
  this.glslVersion = null;
  if (parameters !== void 0) {
    if (parameters.attributes !== void 0) {
      console.error("THREE.ShaderMaterial: attributes should now be defined in THREE.BufferGeometry instead.");
    }
    this.setValues(parameters);
  }
}
ShaderMaterial.prototype = Object.create(Material.prototype);
ShaderMaterial.prototype.constructor = ShaderMaterial;
ShaderMaterial.prototype.isShaderMaterial = true;
ShaderMaterial.prototype.copy = function(source) {
  Material.prototype.copy.call(this, source);
  this.fragmentShader = source.fragmentShader;
  this.vertexShader = source.vertexShader;
  this.uniforms = cloneUniforms(source.uniforms);
  this.defines = Object.assign({}, source.defines);
  this.wireframe = source.wireframe;
  this.wireframeLinewidth = source.wireframeLinewidth;
  this.lights = source.lights;
  this.clipping = source.clipping;
  this.skinning = source.skinning;
  this.morphTargets = source.morphTargets;
  this.morphNormals = source.morphNormals;
  this.extensions = Object.assign({}, source.extensions);
  this.glslVersion = source.glslVersion;
  return this;
};
ShaderMaterial.prototype.toJSON = function(meta) {
  const data = Material.prototype.toJSON.call(this, meta);
  data.glslVersion = this.glslVersion;
  data.uniforms = {};
  for (const name in this.uniforms) {
    const uniform = this.uniforms[name];
    const value = uniform.value;
    if (value && value.isTexture) {
      data.uniforms[name] = {
        type: "t",
        value: value.toJSON(meta).uuid
      };
    } else if (value && value.isColor) {
      data.uniforms[name] = {
        type: "c",
        value: value.getHex()
      };
    } else if (value && value.isVector2) {
      data.uniforms[name] = {
        type: "v2",
        value: value.toArray()
      };
    } else if (value && value.isVector3) {
      data.uniforms[name] = {
        type: "v3",
        value: value.toArray()
      };
    } else if (value && value.isVector4) {
      data.uniforms[name] = {
        type: "v4",
        value: value.toArray()
      };
    } else if (value && value.isMatrix3) {
      data.uniforms[name] = {
        type: "m3",
        value: value.toArray()
      };
    } else if (value && value.isMatrix4) {
      data.uniforms[name] = {
        type: "m4",
        value: value.toArray()
      };
    } else {
      data.uniforms[name] = {
        value
      };
    }
  }
  if (Object.keys(this.defines).length > 0)
    data.defines = this.defines;
  data.vertexShader = this.vertexShader;
  data.fragmentShader = this.fragmentShader;
  const extensions = {};
  for (const key in this.extensions) {
    if (this.extensions[key] === true)
      extensions[key] = true;
  }
  if (Object.keys(extensions).length > 0)
    data.extensions = extensions;
  return data;
};
function Camera() {
  Object3D.call(this);
  this.type = "Camera";
  this.matrixWorldInverse = new Matrix4();
  this.projectionMatrix = new Matrix4();
  this.projectionMatrixInverse = new Matrix4();
}
Camera.prototype = Object.assign(Object.create(Object3D.prototype), {
  constructor: Camera,
  isCamera: true,
  copy: function(source, recursive) {
    Object3D.prototype.copy.call(this, source, recursive);
    this.matrixWorldInverse.copy(source.matrixWorldInverse);
    this.projectionMatrix.copy(source.projectionMatrix);
    this.projectionMatrixInverse.copy(source.projectionMatrixInverse);
    return this;
  },
  getWorldDirection: function(target) {
    if (target === void 0) {
      console.warn("THREE.Camera: .getWorldDirection() target is now required");
      target = new Vector3();
    }
    this.updateWorldMatrix(true, false);
    const e = this.matrixWorld.elements;
    return target.set(-e[8], -e[9], -e[10]).normalize();
  },
  updateMatrixWorld: function(force) {
    Object3D.prototype.updateMatrixWorld.call(this, force);
    this.matrixWorldInverse.copy(this.matrixWorld).invert();
  },
  updateWorldMatrix: function(updateParents, updateChildren) {
    Object3D.prototype.updateWorldMatrix.call(this, updateParents, updateChildren);
    this.matrixWorldInverse.copy(this.matrixWorld).invert();
  },
  clone: function() {
    return new this.constructor().copy(this);
  }
});
function PerspectiveCamera(fov2 = 50, aspect2 = 1, near = 0.1, far = 2e3) {
  Camera.call(this);
  this.type = "PerspectiveCamera";
  this.fov = fov2;
  this.zoom = 1;
  this.near = near;
  this.far = far;
  this.focus = 10;
  this.aspect = aspect2;
  this.view = null;
  this.filmGauge = 35;
  this.filmOffset = 0;
  this.updateProjectionMatrix();
}
PerspectiveCamera.prototype = Object.assign(Object.create(Camera.prototype), {
  constructor: PerspectiveCamera,
  isPerspectiveCamera: true,
  copy: function(source, recursive) {
    Camera.prototype.copy.call(this, source, recursive);
    this.fov = source.fov;
    this.zoom = source.zoom;
    this.near = source.near;
    this.far = source.far;
    this.focus = source.focus;
    this.aspect = source.aspect;
    this.view = source.view === null ? null : Object.assign({}, source.view);
    this.filmGauge = source.filmGauge;
    this.filmOffset = source.filmOffset;
    return this;
  },
  setFocalLength: function(focalLength) {
    const vExtentSlope = 0.5 * this.getFilmHeight() / focalLength;
    this.fov = MathUtils.RAD2DEG * 2 * Math.atan(vExtentSlope);
    this.updateProjectionMatrix();
  },
  getFocalLength: function() {
    const vExtentSlope = Math.tan(MathUtils.DEG2RAD * 0.5 * this.fov);
    return 0.5 * this.getFilmHeight() / vExtentSlope;
  },
  getEffectiveFOV: function() {
    return MathUtils.RAD2DEG * 2 * Math.atan(Math.tan(MathUtils.DEG2RAD * 0.5 * this.fov) / this.zoom);
  },
  getFilmWidth: function() {
    return this.filmGauge * Math.min(this.aspect, 1);
  },
  getFilmHeight: function() {
    return this.filmGauge / Math.max(this.aspect, 1);
  },
  setViewOffset: function(fullWidth, fullHeight, x, y, width, height) {
    this.aspect = fullWidth / fullHeight;
    if (this.view === null) {
      this.view = {
        enabled: true,
        fullWidth: 1,
        fullHeight: 1,
        offsetX: 0,
        offsetY: 0,
        width: 1,
        height: 1
      };
    }
    this.view.enabled = true;
    this.view.fullWidth = fullWidth;
    this.view.fullHeight = fullHeight;
    this.view.offsetX = x;
    this.view.offsetY = y;
    this.view.width = width;
    this.view.height = height;
    this.updateProjectionMatrix();
  },
  clearViewOffset: function() {
    if (this.view !== null) {
      this.view.enabled = false;
    }
    this.updateProjectionMatrix();
  },
  updateProjectionMatrix: function() {
    const near = this.near;
    let top = near * Math.tan(MathUtils.DEG2RAD * 0.5 * this.fov) / this.zoom;
    let height = 2 * top;
    let width = this.aspect * height;
    let left = -0.5 * width;
    const view = this.view;
    if (this.view !== null && this.view.enabled) {
      const fullWidth = view.fullWidth, fullHeight = view.fullHeight;
      left += view.offsetX * width / fullWidth;
      top -= view.offsetY * height / fullHeight;
      width *= view.width / fullWidth;
      height *= view.height / fullHeight;
    }
    const skew = this.filmOffset;
    if (skew !== 0)
      left += near * skew / this.getFilmWidth();
    this.projectionMatrix.makePerspective(left, left + width, top, top - height, near, this.far);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  },
  toJSON: function(meta) {
    const data = Object3D.prototype.toJSON.call(this, meta);
    data.object.fov = this.fov;
    data.object.zoom = this.zoom;
    data.object.near = this.near;
    data.object.far = this.far;
    data.object.focus = this.focus;
    data.object.aspect = this.aspect;
    if (this.view !== null)
      data.object.view = Object.assign({}, this.view);
    data.object.filmGauge = this.filmGauge;
    data.object.filmOffset = this.filmOffset;
    return data;
  }
});
const fov = 90, aspect = 1;
class CubeCamera extends Object3D {
  constructor(near, far, renderTarget) {
    super();
    this.type = "CubeCamera";
    if (renderTarget.isWebGLCubeRenderTarget !== true) {
      console.error("THREE.CubeCamera: The constructor now expects an instance of WebGLCubeRenderTarget as third parameter.");
      return;
    }
    this.renderTarget = renderTarget;
    const cameraPX = new PerspectiveCamera(fov, aspect, near, far);
    cameraPX.layers = this.layers;
    cameraPX.up.set(0, -1, 0);
    cameraPX.lookAt(new Vector3(1, 0, 0));
    this.add(cameraPX);
    const cameraNX = new PerspectiveCamera(fov, aspect, near, far);
    cameraNX.layers = this.layers;
    cameraNX.up.set(0, -1, 0);
    cameraNX.lookAt(new Vector3(-1, 0, 0));
    this.add(cameraNX);
    const cameraPY = new PerspectiveCamera(fov, aspect, near, far);
    cameraPY.layers = this.layers;
    cameraPY.up.set(0, 0, 1);
    cameraPY.lookAt(new Vector3(0, 1, 0));
    this.add(cameraPY);
    const cameraNY = new PerspectiveCamera(fov, aspect, near, far);
    cameraNY.layers = this.layers;
    cameraNY.up.set(0, 0, -1);
    cameraNY.lookAt(new Vector3(0, -1, 0));
    this.add(cameraNY);
    const cameraPZ = new PerspectiveCamera(fov, aspect, near, far);
    cameraPZ.layers = this.layers;
    cameraPZ.up.set(0, -1, 0);
    cameraPZ.lookAt(new Vector3(0, 0, 1));
    this.add(cameraPZ);
    const cameraNZ = new PerspectiveCamera(fov, aspect, near, far);
    cameraNZ.layers = this.layers;
    cameraNZ.up.set(0, -1, 0);
    cameraNZ.lookAt(new Vector3(0, 0, -1));
    this.add(cameraNZ);
  }
  update(renderer, scene) {
    if (this.parent === null)
      this.updateMatrixWorld();
    const renderTarget = this.renderTarget;
    const [cameraPX, cameraNX, cameraPY, cameraNY, cameraPZ, cameraNZ] = this.children;
    const currentXrEnabled = renderer.xr.enabled;
    const currentRenderTarget = renderer.getRenderTarget();
    renderer.xr.enabled = false;
    const generateMipmaps = renderTarget.texture.generateMipmaps;
    renderTarget.texture.generateMipmaps = false;
    renderer.setRenderTarget(renderTarget, 0);
    renderer.render(scene, cameraPX);
    renderer.setRenderTarget(renderTarget, 1);
    renderer.render(scene, cameraNX);
    renderer.setRenderTarget(renderTarget, 2);
    renderer.render(scene, cameraPY);
    renderer.setRenderTarget(renderTarget, 3);
    renderer.render(scene, cameraNY);
    renderer.setRenderTarget(renderTarget, 4);
    renderer.render(scene, cameraPZ);
    renderTarget.texture.generateMipmaps = generateMipmaps;
    renderer.setRenderTarget(renderTarget, 5);
    renderer.render(scene, cameraNZ);
    renderer.setRenderTarget(currentRenderTarget);
    renderer.xr.enabled = currentXrEnabled;
  }
}
class CubeTexture extends Texture {
  constructor(images, mapping, wrapS, wrapT, magFilter, minFilter, format2, type, anisotropy, encoding) {
    images = images !== void 0 ? images : [];
    mapping = mapping !== void 0 ? mapping : CubeReflectionMapping;
    format2 = format2 !== void 0 ? format2 : RGBFormat;
    super(images, mapping, wrapS, wrapT, magFilter, minFilter, format2, type, anisotropy, encoding);
    this._needsFlipEnvMap = true;
    this.flipY = false;
  }
  get images() {
    return this.image;
  }
  set images(value) {
    this.image = value;
  }
}
CubeTexture.prototype.isCubeTexture = true;
class WebGLCubeRenderTarget extends WebGLRenderTarget {
  constructor(size, options, dummy) {
    if (Number.isInteger(options)) {
      console.warn("THREE.WebGLCubeRenderTarget: constructor signature is now WebGLCubeRenderTarget( size, options )");
      options = dummy;
    }
    super(size, size, options);
    options = options || {};
    this.texture = new CubeTexture(void 0, options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.encoding);
    this.texture.generateMipmaps = options.generateMipmaps !== void 0 ? options.generateMipmaps : false;
    this.texture.minFilter = options.minFilter !== void 0 ? options.minFilter : LinearFilter;
    this.texture._needsFlipEnvMap = false;
  }
  fromEquirectangularTexture(renderer, texture) {
    this.texture.type = texture.type;
    this.texture.format = RGBAFormat;
    this.texture.encoding = texture.encoding;
    this.texture.generateMipmaps = texture.generateMipmaps;
    this.texture.minFilter = texture.minFilter;
    this.texture.magFilter = texture.magFilter;
    const shader = {
      uniforms: {
        tEquirect: {value: null}
      },
      vertexShader: `

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,
      fragmentShader: `

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`
    };
    const geometry = new BoxGeometry(5, 5, 5);
    const material = new ShaderMaterial({
      name: "CubemapFromEquirect",
      uniforms: cloneUniforms(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      side: BackSide,
      blending: NoBlending
    });
    material.uniforms.tEquirect.value = texture;
    const mesh = new Mesh(geometry, material);
    const currentMinFilter = texture.minFilter;
    if (texture.minFilter === LinearMipmapLinearFilter)
      texture.minFilter = LinearFilter;
    const camera = new CubeCamera(1, 10, this);
    camera.update(renderer, mesh);
    texture.minFilter = currentMinFilter;
    mesh.geometry.dispose();
    mesh.material.dispose();
    return this;
  }
  clear(renderer, color, depth, stencil) {
    const currentRenderTarget = renderer.getRenderTarget();
    for (let i = 0; i < 6; i++) {
      renderer.setRenderTarget(this, i);
      renderer.clear(color, depth, stencil);
    }
    renderer.setRenderTarget(currentRenderTarget);
  }
}
WebGLCubeRenderTarget.prototype.isWebGLCubeRenderTarget = true;
class DataTexture extends Texture {
  constructor(data, width, height, format2, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, encoding) {
    super(null, mapping, wrapS, wrapT, magFilter, minFilter, format2, type, anisotropy, encoding);
    this.image = {data: data || null, width: width || 1, height: height || 1};
    this.magFilter = magFilter !== void 0 ? magFilter : NearestFilter;
    this.minFilter = minFilter !== void 0 ? minFilter : NearestFilter;
    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
    this.needsUpdate = true;
  }
}
DataTexture.prototype.isDataTexture = true;
const _sphere$1 = /* @__PURE__ */ new Sphere();
const _vector$5 = /* @__PURE__ */ new Vector3();
class Frustum {
  constructor(p0 = new Plane(), p1 = new Plane(), p2 = new Plane(), p3 = new Plane(), p4 = new Plane(), p5 = new Plane()) {
    this.planes = [p0, p1, p2, p3, p4, p5];
  }
  set(p0, p1, p2, p3, p4, p5) {
    const planes = this.planes;
    planes[0].copy(p0);
    planes[1].copy(p1);
    planes[2].copy(p2);
    planes[3].copy(p3);
    planes[4].copy(p4);
    planes[5].copy(p5);
    return this;
  }
  copy(frustum) {
    const planes = this.planes;
    for (let i = 0; i < 6; i++) {
      planes[i].copy(frustum.planes[i]);
    }
    return this;
  }
  setFromProjectionMatrix(m) {
    const planes = this.planes;
    const me = m.elements;
    const me0 = me[0], me1 = me[1], me2 = me[2], me3 = me[3];
    const me4 = me[4], me5 = me[5], me6 = me[6], me7 = me[7];
    const me8 = me[8], me9 = me[9], me10 = me[10], me11 = me[11];
    const me12 = me[12], me13 = me[13], me14 = me[14], me15 = me[15];
    planes[0].setComponents(me3 - me0, me7 - me4, me11 - me8, me15 - me12).normalize();
    planes[1].setComponents(me3 + me0, me7 + me4, me11 + me8, me15 + me12).normalize();
    planes[2].setComponents(me3 + me1, me7 + me5, me11 + me9, me15 + me13).normalize();
    planes[3].setComponents(me3 - me1, me7 - me5, me11 - me9, me15 - me13).normalize();
    planes[4].setComponents(me3 - me2, me7 - me6, me11 - me10, me15 - me14).normalize();
    planes[5].setComponents(me3 + me2, me7 + me6, me11 + me10, me15 + me14).normalize();
    return this;
  }
  intersectsObject(object) {
    const geometry = object.geometry;
    if (geometry.boundingSphere === null)
      geometry.computeBoundingSphere();
    _sphere$1.copy(geometry.boundingSphere).applyMatrix4(object.matrixWorld);
    return this.intersectsSphere(_sphere$1);
  }
  intersectsSprite(sprite) {
    _sphere$1.center.set(0, 0, 0);
    _sphere$1.radius = 0.7071067811865476;
    _sphere$1.applyMatrix4(sprite.matrixWorld);
    return this.intersectsSphere(_sphere$1);
  }
  intersectsSphere(sphere) {
    const planes = this.planes;
    const center = sphere.center;
    const negRadius = -sphere.radius;
    for (let i = 0; i < 6; i++) {
      const distance = planes[i].distanceToPoint(center);
      if (distance < negRadius) {
        return false;
      }
    }
    return true;
  }
  intersectsBox(box) {
    const planes = this.planes;
    for (let i = 0; i < 6; i++) {
      const plane = planes[i];
      _vector$5.x = plane.normal.x > 0 ? box.max.x : box.min.x;
      _vector$5.y = plane.normal.y > 0 ? box.max.y : box.min.y;
      _vector$5.z = plane.normal.z > 0 ? box.max.z : box.min.z;
      if (plane.distanceToPoint(_vector$5) < 0) {
        return false;
      }
    }
    return true;
  }
  containsPoint(point) {
    const planes = this.planes;
    for (let i = 0; i < 6; i++) {
      if (planes[i].distanceToPoint(point) < 0) {
        return false;
      }
    }
    return true;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
function WebGLAnimation() {
  let context = null;
  let isAnimating = false;
  let animationLoop = null;
  let requestId = null;
  function onAnimationFrame(time, frame) {
    animationLoop(time, frame);
    requestId = context.requestAnimationFrame(onAnimationFrame);
  }
  return {
    start: function() {
      if (isAnimating === true)
        return;
      if (animationLoop === null)
        return;
      requestId = context.requestAnimationFrame(onAnimationFrame);
      isAnimating = true;
    },
    stop: function() {
      context.cancelAnimationFrame(requestId);
      isAnimating = false;
    },
    setAnimationLoop: function(callback) {
      animationLoop = callback;
    },
    setContext: function(value) {
      context = value;
    }
  };
}
function WebGLAttributes(gl, capabilities) {
  const isWebGL2 = capabilities.isWebGL2;
  const buffers = new WeakMap();
  function createBuffer(attribute, bufferType) {
    const array = attribute.array;
    const usage = attribute.usage;
    const buffer = gl.createBuffer();
    gl.bindBuffer(bufferType, buffer);
    gl.bufferData(bufferType, array, usage);
    attribute.onUploadCallback();
    let type = 5126;
    if (array instanceof Float32Array) {
      type = 5126;
    } else if (array instanceof Float64Array) {
      console.warn("THREE.WebGLAttributes: Unsupported data buffer format: Float64Array.");
    } else if (array instanceof Uint16Array) {
      if (attribute.isFloat16BufferAttribute) {
        if (isWebGL2) {
          type = 5131;
        } else {
          console.warn("THREE.WebGLAttributes: Usage of Float16BufferAttribute requires WebGL2.");
        }
      } else {
        type = 5123;
      }
    } else if (array instanceof Int16Array) {
      type = 5122;
    } else if (array instanceof Uint32Array) {
      type = 5125;
    } else if (array instanceof Int32Array) {
      type = 5124;
    } else if (array instanceof Int8Array) {
      type = 5120;
    } else if (array instanceof Uint8Array) {
      type = 5121;
    }
    return {
      buffer,
      type,
      bytesPerElement: array.BYTES_PER_ELEMENT,
      version: attribute.version
    };
  }
  function updateBuffer(buffer, attribute, bufferType) {
    const array = attribute.array;
    const updateRange = attribute.updateRange;
    gl.bindBuffer(bufferType, buffer);
    if (updateRange.count === -1) {
      gl.bufferSubData(bufferType, 0, array);
    } else {
      if (isWebGL2) {
        gl.bufferSubData(bufferType, updateRange.offset * array.BYTES_PER_ELEMENT, array, updateRange.offset, updateRange.count);
      } else {
        gl.bufferSubData(bufferType, updateRange.offset * array.BYTES_PER_ELEMENT, array.subarray(updateRange.offset, updateRange.offset + updateRange.count));
      }
      updateRange.count = -1;
    }
  }
  function get2(attribute) {
    if (attribute.isInterleavedBufferAttribute)
      attribute = attribute.data;
    return buffers.get(attribute);
  }
  function remove(attribute) {
    if (attribute.isInterleavedBufferAttribute)
      attribute = attribute.data;
    const data = buffers.get(attribute);
    if (data) {
      gl.deleteBuffer(data.buffer);
      buffers.delete(attribute);
    }
  }
  function update(attribute, bufferType) {
    if (attribute.isGLBufferAttribute) {
      const cached = buffers.get(attribute);
      if (!cached || cached.version < attribute.version) {
        buffers.set(attribute, {
          buffer: attribute.buffer,
          type: attribute.type,
          bytesPerElement: attribute.elementSize,
          version: attribute.version
        });
      }
      return;
    }
    if (attribute.isInterleavedBufferAttribute)
      attribute = attribute.data;
    const data = buffers.get(attribute);
    if (data === void 0) {
      buffers.set(attribute, createBuffer(attribute, bufferType));
    } else if (data.version < attribute.version) {
      updateBuffer(data.buffer, attribute, bufferType);
      data.version = attribute.version;
    }
  }
  return {
    get: get2,
    remove,
    update
  };
}
class PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
    super();
    this.type = "PlaneGeometry";
    this.parameters = {
      width,
      height,
      widthSegments,
      heightSegments
    };
    const width_half = width / 2;
    const height_half = height / 2;
    const gridX = Math.floor(widthSegments);
    const gridY = Math.floor(heightSegments);
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const segment_width = width / gridX;
    const segment_height = height / gridY;
    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segment_height - height_half;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segment_width - width_half;
        vertices.push(x, -y, 0);
        normals.push(0, 0, 1);
        uvs.push(ix / gridX);
        uvs.push(1 - iy / gridY);
      }
    }
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = ix + 1 + gridX1 * (iy + 1);
        const d2 = ix + 1 + gridX1 * iy;
        indices.push(a, b, d2);
        indices.push(b, c, d2);
      }
    }
    this.setIndex(indices);
    this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
    this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  }
}
var alphamap_fragment = "#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, vUv ).g;\n#endif";
var alphamap_pars_fragment = "#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif";
var alphatest_fragment = "#ifdef ALPHATEST\n	if ( diffuseColor.a < ALPHATEST ) discard;\n#endif";
var aomap_fragment = "#ifdef USE_AOMAP\n	float ambientOcclusion = ( texture2D( aoMap, vUv2 ).r - 1.0 ) * aoMapIntensity + 1.0;\n	reflectedLight.indirectDiffuse *= ambientOcclusion;\n	#if defined( USE_ENVMAP ) && defined( STANDARD )\n		float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );\n		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.specularRoughness );\n	#endif\n#endif";
var aomap_pars_fragment = "#ifdef USE_AOMAP\n	uniform sampler2D aoMap;\n	uniform float aoMapIntensity;\n#endif";
var begin_vertex = "vec3 transformed = vec3( position );";
var beginnormal_vertex = "vec3 objectNormal = vec3( normal );\n#ifdef USE_TANGENT\n	vec3 objectTangent = vec3( tangent.xyz );\n#endif";
var bsdfs = "vec2 integrateSpecularBRDF( const in float dotNV, const in float roughness ) {\n	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );\n	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );\n	vec4 r = roughness * c0 + c1;\n	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;\n	return vec2( -1.04, 1.04 ) * a004 + r.zw;\n}\nfloat punctualLightIntensityToIrradianceFactor( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {\n#if defined ( PHYSICALLY_CORRECT_LIGHTS )\n	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );\n	if( cutoffDistance > 0.0 ) {\n		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );\n	}\n	return distanceFalloff;\n#else\n	if( cutoffDistance > 0.0 && decayExponent > 0.0 ) {\n		return pow( saturate( -lightDistance / cutoffDistance + 1.0 ), decayExponent );\n	}\n	return 1.0;\n#endif\n}\nvec3 BRDF_Diffuse_Lambert( const in vec3 diffuseColor ) {\n	return RECIPROCAL_PI * diffuseColor;\n}\nvec3 F_Schlick( const in vec3 specularColor, const in float dotLH ) {\n	float fresnel = exp2( ( -5.55473 * dotLH - 6.98316 ) * dotLH );\n	return ( 1.0 - specularColor ) * fresnel + specularColor;\n}\nvec3 F_Schlick_RoughnessDependent( const in vec3 F0, const in float dotNV, const in float roughness ) {\n	float fresnel = exp2( ( -5.55473 * dotNV - 6.98316 ) * dotNV );\n	vec3 Fr = max( vec3( 1.0 - roughness ), F0 ) - F0;\n	return Fr * fresnel + F0;\n}\nfloat G_GGX_Smith( const in float alpha, const in float dotNL, const in float dotNV ) {\n	float a2 = pow2( alpha );\n	float gl = dotNL + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\n	float gv = dotNV + sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\n	return 1.0 / ( gl * gv );\n}\nfloat G_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\n	float a2 = pow2( alpha );\n	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\n	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\n	return 0.5 / max( gv + gl, EPSILON );\n}\nfloat D_GGX( const in float alpha, const in float dotNH ) {\n	float a2 = pow2( alpha );\n	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;\n	return RECIPROCAL_PI * a2 / pow2( denom );\n}\nvec3 BRDF_Specular_GGX( const in IncidentLight incidentLight, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {\n	float alpha = pow2( roughness );\n	vec3 halfDir = normalize( incidentLight.direction + viewDir );\n	float dotNL = saturate( dot( normal, incidentLight.direction ) );\n	float dotNV = saturate( dot( normal, viewDir ) );\n	float dotNH = saturate( dot( normal, halfDir ) );\n	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );\n	vec3 F = F_Schlick( specularColor, dotLH );\n	float G = G_GGX_SmithCorrelated( alpha, dotNL, dotNV );\n	float D = D_GGX( alpha, dotNH );\n	return F * ( G * D );\n}\nvec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {\n	const float LUT_SIZE = 64.0;\n	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;\n	const float LUT_BIAS = 0.5 / LUT_SIZE;\n	float dotNV = saturate( dot( N, V ) );\n	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );\n	uv = uv * LUT_SCALE + LUT_BIAS;\n	return uv;\n}\nfloat LTC_ClippedSphereFormFactor( const in vec3 f ) {\n	float l = length( f );\n	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );\n}\nvec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {\n	float x = dot( v1, v2 );\n	float y = abs( x );\n	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;\n	float b = 3.4175940 + ( 4.1616724 + y ) * y;\n	float v = a / b;\n	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;\n	return cross( v1, v2 ) * theta_sintheta;\n}\nvec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {\n	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];\n	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];\n	vec3 lightNormal = cross( v1, v2 );\n	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );\n	vec3 T1, T2;\n	T1 = normalize( V - N * dot( V, N ) );\n	T2 = - cross( N, T1 );\n	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );\n	vec3 coords[ 4 ];\n	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );\n	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );\n	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );\n	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );\n	coords[ 0 ] = normalize( coords[ 0 ] );\n	coords[ 1 ] = normalize( coords[ 1 ] );\n	coords[ 2 ] = normalize( coords[ 2 ] );\n	coords[ 3 ] = normalize( coords[ 3 ] );\n	vec3 vectorFormFactor = vec3( 0.0 );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );\n	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );\n	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );\n	return vec3( result );\n}\nvec3 BRDF_Specular_GGX_Environment( const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {\n	float dotNV = saturate( dot( normal, viewDir ) );\n	vec2 brdf = integrateSpecularBRDF( dotNV, roughness );\n	return specularColor * brdf.x + brdf.y;\n}\nvoid BRDF_Specular_Multiscattering_Environment( const in GeometricContext geometry, const in vec3 specularColor, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {\n	float dotNV = saturate( dot( geometry.normal, geometry.viewDir ) );\n	vec3 F = F_Schlick_RoughnessDependent( specularColor, dotNV, roughness );\n	vec2 brdf = integrateSpecularBRDF( dotNV, roughness );\n	vec3 FssEss = F * brdf.x + brdf.y;\n	float Ess = brdf.x + brdf.y;\n	float Ems = 1.0 - Ess;\n	vec3 Favg = specularColor + ( 1.0 - specularColor ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );\n	singleScatter += FssEss;\n	multiScatter += Fms * Ems;\n}\nfloat G_BlinnPhong_Implicit( ) {\n	return 0.25;\n}\nfloat D_BlinnPhong( const in float shininess, const in float dotNH ) {\n	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );\n}\nvec3 BRDF_Specular_BlinnPhong( const in IncidentLight incidentLight, const in GeometricContext geometry, const in vec3 specularColor, const in float shininess ) {\n	vec3 halfDir = normalize( incidentLight.direction + geometry.viewDir );\n	float dotNH = saturate( dot( geometry.normal, halfDir ) );\n	float dotLH = saturate( dot( incidentLight.direction, halfDir ) );\n	vec3 F = F_Schlick( specularColor, dotLH );\n	float G = G_BlinnPhong_Implicit( );\n	float D = D_BlinnPhong( shininess, dotNH );\n	return F * ( G * D );\n}\nfloat GGXRoughnessToBlinnExponent( const in float ggxRoughness ) {\n	return ( 2.0 / pow2( ggxRoughness + 0.0001 ) - 2.0 );\n}\nfloat BlinnExponentToGGXRoughness( const in float blinnExponent ) {\n	return sqrt( 2.0 / ( blinnExponent + 2.0 ) );\n}\n#if defined( USE_SHEEN )\nfloat D_Charlie(float roughness, float NoH) {\n	float invAlpha = 1.0 / roughness;\n	float cos2h = NoH * NoH;\n	float sin2h = max(1.0 - cos2h, 0.0078125);	return (2.0 + invAlpha) * pow(sin2h, invAlpha * 0.5) / (2.0 * PI);\n}\nfloat V_Neubelt(float NoV, float NoL) {\n	return saturate(1.0 / (4.0 * (NoL + NoV - NoL * NoV)));\n}\nvec3 BRDF_Specular_Sheen( const in float roughness, const in vec3 L, const in GeometricContext geometry, vec3 specularColor ) {\n	vec3 N = geometry.normal;\n	vec3 V = geometry.viewDir;\n	vec3 H = normalize( V + L );\n	float dotNH = saturate( dot( N, H ) );\n	return specularColor * D_Charlie( roughness, dotNH ) * V_Neubelt( dot(N, V), dot(N, L) );\n}\n#endif";
var bumpmap_pars_fragment = "#ifdef USE_BUMPMAP\n	uniform sampler2D bumpMap;\n	uniform float bumpScale;\n	vec2 dHdxy_fwd() {\n		vec2 dSTdx = dFdx( vUv );\n		vec2 dSTdy = dFdy( vUv );\n		float Hll = bumpScale * texture2D( bumpMap, vUv ).x;\n		float dBx = bumpScale * texture2D( bumpMap, vUv + dSTdx ).x - Hll;\n		float dBy = bumpScale * texture2D( bumpMap, vUv + dSTdy ).x - Hll;\n		return vec2( dBx, dBy );\n	}\n	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {\n		vec3 vSigmaX = vec3( dFdx( surf_pos.x ), dFdx( surf_pos.y ), dFdx( surf_pos.z ) );\n		vec3 vSigmaY = vec3( dFdy( surf_pos.x ), dFdy( surf_pos.y ), dFdy( surf_pos.z ) );\n		vec3 vN = surf_norm;\n		vec3 R1 = cross( vSigmaY, vN );\n		vec3 R2 = cross( vN, vSigmaX );\n		float fDet = dot( vSigmaX, R1 ) * faceDirection;\n		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );\n		return normalize( abs( fDet ) * surf_norm - vGrad );\n	}\n#endif";
var clipping_planes_fragment = "#if NUM_CLIPPING_PLANES > 0\n	vec4 plane;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {\n		plane = clippingPlanes[ i ];\n		if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;\n	}\n	#pragma unroll_loop_end\n	#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES\n		bool clipped = true;\n		#pragma unroll_loop_start\n		for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {\n			plane = clippingPlanes[ i ];\n			clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;\n		}\n		#pragma unroll_loop_end\n		if ( clipped ) discard;\n	#endif\n#endif";
var clipping_planes_pars_fragment = "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];\n#endif";
var clipping_planes_pars_vertex = "#if NUM_CLIPPING_PLANES > 0\n	varying vec3 vClipPosition;\n#endif";
var clipping_planes_vertex = "#if NUM_CLIPPING_PLANES > 0\n	vClipPosition = - mvPosition.xyz;\n#endif";
var color_fragment = "#ifdef USE_COLOR\n	diffuseColor.rgb *= vColor;\n#endif";
var color_pars_fragment = "#ifdef USE_COLOR\n	varying vec3 vColor;\n#endif";
var color_pars_vertex = "#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n	varying vec3 vColor;\n#endif";
var color_vertex = "#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n	vColor = vec3( 1.0 );\n#endif\n#ifdef USE_COLOR\n	vColor.xyz *= color.xyz;\n#endif\n#ifdef USE_INSTANCING_COLOR\n	vColor.xyz *= instanceColor.xyz;\n#endif";
var common = "#define PI 3.141592653589793\n#define PI2 6.283185307179586\n#define PI_HALF 1.5707963267948966\n#define RECIPROCAL_PI 0.3183098861837907\n#define RECIPROCAL_PI2 0.15915494309189535\n#define EPSILON 1e-6\n#ifndef saturate\n#define saturate(a) clamp( a, 0.0, 1.0 )\n#endif\n#define whiteComplement(a) ( 1.0 - saturate( a ) )\nfloat pow2( const in float x ) { return x*x; }\nfloat pow3( const in float x ) { return x*x*x; }\nfloat pow4( const in float x ) { float x2 = x*x; return x2*x2; }\nfloat average( const in vec3 color ) { return dot( color, vec3( 0.3333 ) ); }\nhighp float rand( const in vec2 uv ) {\n	const highp float a = 12.9898, b = 78.233, c = 43758.5453;\n	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );\n	return fract(sin(sn) * c);\n}\n#ifdef HIGH_PRECISION\n	float precisionSafeLength( vec3 v ) { return length( v ); }\n#else\n	float max3( vec3 v ) { return max( max( v.x, v.y ), v.z ); }\n	float precisionSafeLength( vec3 v ) {\n		float maxComponent = max3( abs( v ) );\n		return length( v / maxComponent ) * maxComponent;\n	}\n#endif\nstruct IncidentLight {\n	vec3 color;\n	vec3 direction;\n	bool visible;\n};\nstruct ReflectedLight {\n	vec3 directDiffuse;\n	vec3 directSpecular;\n	vec3 indirectDiffuse;\n	vec3 indirectSpecular;\n};\nstruct GeometricContext {\n	vec3 position;\n	vec3 normal;\n	vec3 viewDir;\n#ifdef CLEARCOAT\n	vec3 clearcoatNormal;\n#endif\n};\nvec3 transformDirection( in vec3 dir, in mat4 matrix ) {\n	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );\n}\nvec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {\n	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );\n}\nvec3 projectOnPlane(in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {\n	float distance = dot( planeNormal, point - pointOnPlane );\n	return - distance * planeNormal + point;\n}\nfloat sideOfPlane( in vec3 point, in vec3 pointOnPlane, in vec3 planeNormal ) {\n	return sign( dot( point - pointOnPlane, planeNormal ) );\n}\nvec3 linePlaneIntersect( in vec3 pointOnLine, in vec3 lineDirection, in vec3 pointOnPlane, in vec3 planeNormal ) {\n	return lineDirection * ( dot( planeNormal, pointOnPlane - pointOnLine ) / dot( planeNormal, lineDirection ) ) + pointOnLine;\n}\nmat3 transposeMat3( const in mat3 m ) {\n	mat3 tmp;\n	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );\n	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );\n	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );\n	return tmp;\n}\nfloat linearToRelativeLuminance( const in vec3 color ) {\n	vec3 weights = vec3( 0.2126, 0.7152, 0.0722 );\n	return dot( weights, color.rgb );\n}\nbool isPerspectiveMatrix( mat4 m ) {\n	return m[ 2 ][ 3 ] == - 1.0;\n}\nvec2 equirectUv( in vec3 dir ) {\n	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;\n	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\n	return vec2( u, v );\n}";
var cube_uv_reflection_fragment = "#ifdef ENVMAP_TYPE_CUBE_UV\n	#define cubeUV_maxMipLevel 8.0\n	#define cubeUV_minMipLevel 4.0\n	#define cubeUV_maxTileSize 256.0\n	#define cubeUV_minTileSize 16.0\n	float getFace( vec3 direction ) {\n		vec3 absDirection = abs( direction );\n		float face = - 1.0;\n		if ( absDirection.x > absDirection.z ) {\n			if ( absDirection.x > absDirection.y )\n				face = direction.x > 0.0 ? 0.0 : 3.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		} else {\n			if ( absDirection.z > absDirection.y )\n				face = direction.z > 0.0 ? 2.0 : 5.0;\n			else\n				face = direction.y > 0.0 ? 1.0 : 4.0;\n		}\n		return face;\n	}\n	vec2 getUV( vec3 direction, float face ) {\n		vec2 uv;\n		if ( face == 0.0 ) {\n			uv = vec2( direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 1.0 ) {\n			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );\n		} else if ( face == 2.0 ) {\n			uv = vec2( - direction.x, direction.y ) / abs( direction.z );\n		} else if ( face == 3.0 ) {\n			uv = vec2( - direction.z, direction.y ) / abs( direction.x );\n		} else if ( face == 4.0 ) {\n			uv = vec2( - direction.x, direction.z ) / abs( direction.y );\n		} else {\n			uv = vec2( direction.x, direction.y ) / abs( direction.z );\n		}\n		return 0.5 * ( uv + 1.0 );\n	}\n	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {\n		float face = getFace( direction );\n		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );\n		mipInt = max( mipInt, cubeUV_minMipLevel );\n		float faceSize = exp2( mipInt );\n		float texelSize = 1.0 / ( 3.0 * cubeUV_maxTileSize );\n		vec2 uv = getUV( direction, face ) * ( faceSize - 1.0 );\n		vec2 f = fract( uv );\n		uv += 0.5 - f;\n		if ( face > 2.0 ) {\n			uv.y += faceSize;\n			face -= 3.0;\n		}\n		uv.x += face * faceSize;\n		if ( mipInt < cubeUV_maxMipLevel ) {\n			uv.y += 2.0 * cubeUV_maxTileSize;\n		}\n		uv.y += filterInt * 2.0 * cubeUV_minTileSize;\n		uv.x += 3.0 * max( 0.0, cubeUV_maxTileSize - 2.0 * faceSize );\n		uv *= texelSize;\n		vec3 tl = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;\n		uv.x += texelSize;\n		vec3 tr = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;\n		uv.y += texelSize;\n		vec3 br = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;\n		uv.x -= texelSize;\n		vec3 bl = envMapTexelToLinear( texture2D( envMap, uv ) ).rgb;\n		vec3 tm = mix( tl, tr, f.x );\n		vec3 bm = mix( bl, br, f.x );\n		return mix( tm, bm, f.y );\n	}\n	#define r0 1.0\n	#define v0 0.339\n	#define m0 - 2.0\n	#define r1 0.8\n	#define v1 0.276\n	#define m1 - 1.0\n	#define r4 0.4\n	#define v4 0.046\n	#define m4 2.0\n	#define r5 0.305\n	#define v5 0.016\n	#define m5 3.0\n	#define r6 0.21\n	#define v6 0.0038\n	#define m6 4.0\n	float roughnessToMip( float roughness ) {\n		float mip = 0.0;\n		if ( roughness >= r1 ) {\n			mip = ( r0 - roughness ) * ( m1 - m0 ) / ( r0 - r1 ) + m0;\n		} else if ( roughness >= r4 ) {\n			mip = ( r1 - roughness ) * ( m4 - m1 ) / ( r1 - r4 ) + m1;\n		} else if ( roughness >= r5 ) {\n			mip = ( r4 - roughness ) * ( m5 - m4 ) / ( r4 - r5 ) + m4;\n		} else if ( roughness >= r6 ) {\n			mip = ( r5 - roughness ) * ( m6 - m5 ) / ( r5 - r6 ) + m5;\n		} else {\n			mip = - 2.0 * log2( 1.16 * roughness );		}\n		return mip;\n	}\n	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {\n		float mip = clamp( roughnessToMip( roughness ), m0, cubeUV_maxMipLevel );\n		float mipF = fract( mip );\n		float mipInt = floor( mip );\n		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );\n		if ( mipF == 0.0 ) {\n			return vec4( color0, 1.0 );\n		} else {\n			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );\n			return vec4( mix( color0, color1, mipF ), 1.0 );\n		}\n	}\n#endif";
var defaultnormal_vertex = "vec3 transformedNormal = objectNormal;\n#ifdef USE_INSTANCING\n	mat3 m = mat3( instanceMatrix );\n	transformedNormal /= vec3( dot( m[ 0 ], m[ 0 ] ), dot( m[ 1 ], m[ 1 ] ), dot( m[ 2 ], m[ 2 ] ) );\n	transformedNormal = m * transformedNormal;\n#endif\ntransformedNormal = normalMatrix * transformedNormal;\n#ifdef FLIP_SIDED\n	transformedNormal = - transformedNormal;\n#endif\n#ifdef USE_TANGENT\n	vec3 transformedTangent = ( modelViewMatrix * vec4( objectTangent, 0.0 ) ).xyz;\n	#ifdef FLIP_SIDED\n		transformedTangent = - transformedTangent;\n	#endif\n#endif";
var displacementmap_pars_vertex = "#ifdef USE_DISPLACEMENTMAP\n	uniform sampler2D displacementMap;\n	uniform float displacementScale;\n	uniform float displacementBias;\n#endif";
var displacementmap_vertex = "#ifdef USE_DISPLACEMENTMAP\n	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vUv ).x * displacementScale + displacementBias );\n#endif";
var emissivemap_fragment = "#ifdef USE_EMISSIVEMAP\n	vec4 emissiveColor = texture2D( emissiveMap, vUv );\n	emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;\n	totalEmissiveRadiance *= emissiveColor.rgb;\n#endif";
var emissivemap_pars_fragment = "#ifdef USE_EMISSIVEMAP\n	uniform sampler2D emissiveMap;\n#endif";
var encodings_fragment = "gl_FragColor = linearToOutputTexel( gl_FragColor );";
var encodings_pars_fragment = "\nvec4 LinearToLinear( in vec4 value ) {\n	return value;\n}\nvec4 GammaToLinear( in vec4 value, in float gammaFactor ) {\n	return vec4( pow( value.rgb, vec3( gammaFactor ) ), value.a );\n}\nvec4 LinearToGamma( in vec4 value, in float gammaFactor ) {\n	return vec4( pow( value.rgb, vec3( 1.0 / gammaFactor ) ), value.a );\n}\nvec4 sRGBToLinear( in vec4 value ) {\n	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );\n}\nvec4 LinearTosRGB( in vec4 value ) {\n	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );\n}\nvec4 RGBEToLinear( in vec4 value ) {\n	return vec4( value.rgb * exp2( value.a * 255.0 - 128.0 ), 1.0 );\n}\nvec4 LinearToRGBE( in vec4 value ) {\n	float maxComponent = max( max( value.r, value.g ), value.b );\n	float fExp = clamp( ceil( log2( maxComponent ) ), -128.0, 127.0 );\n	return vec4( value.rgb / exp2( fExp ), ( fExp + 128.0 ) / 255.0 );\n}\nvec4 RGBMToLinear( in vec4 value, in float maxRange ) {\n	return vec4( value.rgb * value.a * maxRange, 1.0 );\n}\nvec4 LinearToRGBM( in vec4 value, in float maxRange ) {\n	float maxRGB = max( value.r, max( value.g, value.b ) );\n	float M = clamp( maxRGB / maxRange, 0.0, 1.0 );\n	M = ceil( M * 255.0 ) / 255.0;\n	return vec4( value.rgb / ( M * maxRange ), M );\n}\nvec4 RGBDToLinear( in vec4 value, in float maxRange ) {\n	return vec4( value.rgb * ( ( maxRange / 255.0 ) / value.a ), 1.0 );\n}\nvec4 LinearToRGBD( in vec4 value, in float maxRange ) {\n	float maxRGB = max( value.r, max( value.g, value.b ) );\n	float D = max( maxRange / maxRGB, 1.0 );\n	D = clamp( floor( D ) / 255.0, 0.0, 1.0 );\n	return vec4( value.rgb * ( D * ( 255.0 / maxRange ) ), D );\n}\nconst mat3 cLogLuvM = mat3( 0.2209, 0.3390, 0.4184, 0.1138, 0.6780, 0.7319, 0.0102, 0.1130, 0.2969 );\nvec4 LinearToLogLuv( in vec4 value ) {\n	vec3 Xp_Y_XYZp = cLogLuvM * value.rgb;\n	Xp_Y_XYZp = max( Xp_Y_XYZp, vec3( 1e-6, 1e-6, 1e-6 ) );\n	vec4 vResult;\n	vResult.xy = Xp_Y_XYZp.xy / Xp_Y_XYZp.z;\n	float Le = 2.0 * log2(Xp_Y_XYZp.y) + 127.0;\n	vResult.w = fract( Le );\n	vResult.z = ( Le - ( floor( vResult.w * 255.0 ) ) / 255.0 ) / 255.0;\n	return vResult;\n}\nconst mat3 cLogLuvInverseM = mat3( 6.0014, -2.7008, -1.7996, -1.3320, 3.1029, -5.7721, 0.3008, -1.0882, 5.6268 );\nvec4 LogLuvToLinear( in vec4 value ) {\n	float Le = value.z * 255.0 + value.w;\n	vec3 Xp_Y_XYZp;\n	Xp_Y_XYZp.y = exp2( ( Le - 127.0 ) / 2.0 );\n	Xp_Y_XYZp.z = Xp_Y_XYZp.y / value.y;\n	Xp_Y_XYZp.x = value.x * Xp_Y_XYZp.z;\n	vec3 vRGB = cLogLuvInverseM * Xp_Y_XYZp.rgb;\n	return vec4( max( vRGB, 0.0 ), 1.0 );\n}";
var envmap_fragment = "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vec3 cameraToFrag;\n		if ( isOrthographic ) {\n			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToFrag = normalize( vWorldPosition - cameraPosition );\n		}\n		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vec3 reflectVec = reflect( cameraToFrag, worldNormal );\n		#else\n			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );\n		#endif\n	#else\n		vec3 reflectVec = vReflect;\n	#endif\n	#ifdef ENVMAP_TYPE_CUBE\n		vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );\n	#elif defined( ENVMAP_TYPE_CUBE_UV )\n		vec4 envColor = textureCubeUV( envMap, reflectVec, 0.0 );\n	#else\n		vec4 envColor = vec4( 0.0 );\n	#endif\n	#ifndef ENVMAP_TYPE_CUBE_UV\n		envColor = envMapTexelToLinear( envColor );\n	#endif\n	#ifdef ENVMAP_BLENDING_MULTIPLY\n		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );\n	#elif defined( ENVMAP_BLENDING_MIX )\n		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );\n	#elif defined( ENVMAP_BLENDING_ADD )\n		outgoingLight += envColor.xyz * specularStrength * reflectivity;\n	#endif\n#endif";
var envmap_common_pars_fragment = "#ifdef USE_ENVMAP\n	uniform float envMapIntensity;\n	uniform float flipEnvMap;\n	uniform int maxMipLevel;\n	#ifdef ENVMAP_TYPE_CUBE\n		uniform samplerCube envMap;\n	#else\n		uniform sampler2D envMap;\n	#endif\n	\n#endif";
var envmap_pars_fragment = "#ifdef USE_ENVMAP\n	uniform float reflectivity;\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		varying vec3 vWorldPosition;\n		uniform float refractionRatio;\n	#else\n		varying vec3 vReflect;\n	#endif\n#endif";
var envmap_pars_vertex = "#ifdef USE_ENVMAP\n	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) ||defined( PHONG )\n		#define ENV_WORLDPOS\n	#endif\n	#ifdef ENV_WORLDPOS\n		\n		varying vec3 vWorldPosition;\n	#else\n		varying vec3 vReflect;\n		uniform float refractionRatio;\n	#endif\n#endif";
var envmap_vertex = "#ifdef USE_ENVMAP\n	#ifdef ENV_WORLDPOS\n		vWorldPosition = worldPosition.xyz;\n	#else\n		vec3 cameraToVertex;\n		if ( isOrthographic ) {\n			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );\n		} else {\n			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );\n		}\n		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );\n		#ifdef ENVMAP_MODE_REFLECTION\n			vReflect = reflect( cameraToVertex, worldNormal );\n		#else\n			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );\n		#endif\n	#endif\n#endif";
var fog_vertex = "#ifdef USE_FOG\n	fogDepth = - mvPosition.z;\n#endif";
var fog_pars_vertex = "#ifdef USE_FOG\n	varying float fogDepth;\n#endif";
var fog_fragment = "#ifdef USE_FOG\n	#ifdef FOG_EXP2\n		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );\n	#else\n		float fogFactor = smoothstep( fogNear, fogFar, fogDepth );\n	#endif\n	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );\n#endif";
var fog_pars_fragment = "#ifdef USE_FOG\n	uniform vec3 fogColor;\n	varying float fogDepth;\n	#ifdef FOG_EXP2\n		uniform float fogDensity;\n	#else\n		uniform float fogNear;\n		uniform float fogFar;\n	#endif\n#endif";
var gradientmap_pars_fragment = "#ifdef USE_GRADIENTMAP\n	uniform sampler2D gradientMap;\n#endif\nvec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {\n	float dotNL = dot( normal, lightDirection );\n	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );\n	#ifdef USE_GRADIENTMAP\n		return texture2D( gradientMap, coord ).rgb;\n	#else\n		return ( coord.x < 0.7 ) ? vec3( 0.7 ) : vec3( 1.0 );\n	#endif\n}";
var lightmap_fragment = "#ifdef USE_LIGHTMAP\n	vec4 lightMapTexel= texture2D( lightMap, vUv2 );\n	reflectedLight.indirectDiffuse += PI * lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;\n#endif";
var lightmap_pars_fragment = "#ifdef USE_LIGHTMAP\n	uniform sampler2D lightMap;\n	uniform float lightMapIntensity;\n#endif";
var lights_lambert_vertex = "vec3 diffuse = vec3( 1.0 );\nGeometricContext geometry;\ngeometry.position = mvPosition.xyz;\ngeometry.normal = normalize( transformedNormal );\ngeometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( -mvPosition.xyz );\nGeometricContext backGeometry;\nbackGeometry.position = geometry.position;\nbackGeometry.normal = -geometry.normal;\nbackGeometry.viewDir = geometry.viewDir;\nvLightFront = vec3( 0.0 );\nvIndirectFront = vec3( 0.0 );\n#ifdef DOUBLE_SIDED\n	vLightBack = vec3( 0.0 );\n	vIndirectBack = vec3( 0.0 );\n#endif\nIncidentLight directLight;\nfloat dotNL;\nvec3 directLightColor_Diffuse;\nvIndirectFront += getAmbientLightIrradiance( ambientLightColor );\nvIndirectFront += getLightProbeIrradiance( lightProbe, geometry );\n#ifdef DOUBLE_SIDED\n	vIndirectBack += getAmbientLightIrradiance( ambientLightColor );\n	vIndirectBack += getLightProbeIrradiance( lightProbe, backGeometry );\n#endif\n#if NUM_POINT_LIGHTS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n		getPointDirectLightIrradiance( pointLights[ i ], geometry, directLight );\n		dotNL = dot( geometry.normal, directLight.direction );\n		directLightColor_Diffuse = PI * directLight.color;\n		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;\n		#ifdef DOUBLE_SIDED\n			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;\n		#endif\n	}\n	#pragma unroll_loop_end\n#endif\n#if NUM_SPOT_LIGHTS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n		getSpotDirectLightIrradiance( spotLights[ i ], geometry, directLight );\n		dotNL = dot( geometry.normal, directLight.direction );\n		directLightColor_Diffuse = PI * directLight.color;\n		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;\n		#ifdef DOUBLE_SIDED\n			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;\n		#endif\n	}\n	#pragma unroll_loop_end\n#endif\n#if NUM_DIR_LIGHTS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n		getDirectionalDirectLightIrradiance( directionalLights[ i ], geometry, directLight );\n		dotNL = dot( geometry.normal, directLight.direction );\n		directLightColor_Diffuse = PI * directLight.color;\n		vLightFront += saturate( dotNL ) * directLightColor_Diffuse;\n		#ifdef DOUBLE_SIDED\n			vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;\n		#endif\n	}\n	#pragma unroll_loop_end\n#endif\n#if NUM_HEMI_LIGHTS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n		vIndirectFront += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\n		#ifdef DOUBLE_SIDED\n			vIndirectBack += getHemisphereLightIrradiance( hemisphereLights[ i ], backGeometry );\n		#endif\n	}\n	#pragma unroll_loop_end\n#endif";
var lights_pars_begin = "uniform bool receiveShadow;\nuniform vec3 ambientLightColor;\nuniform vec3 lightProbe[ 9 ];\nvec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {\n	float x = normal.x, y = normal.y, z = normal.z;\n	vec3 result = shCoefficients[ 0 ] * 0.886227;\n	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;\n	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;\n	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;\n	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;\n	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;\n	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );\n	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;\n	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );\n	return result;\n}\nvec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in GeometricContext geometry ) {\n	vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );\n	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );\n	return irradiance;\n}\nvec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {\n	vec3 irradiance = ambientLightColor;\n	#ifndef PHYSICALLY_CORRECT_LIGHTS\n		irradiance *= PI;\n	#endif\n	return irradiance;\n}\n#if NUM_DIR_LIGHTS > 0\n	struct DirectionalLight {\n		vec3 direction;\n		vec3 color;\n	};\n	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];\n	void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {\n		directLight.color = directionalLight.color;\n		directLight.direction = directionalLight.direction;\n		directLight.visible = true;\n	}\n#endif\n#if NUM_POINT_LIGHTS > 0\n	struct PointLight {\n		vec3 position;\n		vec3 color;\n		float distance;\n		float decay;\n	};\n	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];\n	void getPointDirectLightIrradiance( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight directLight ) {\n		vec3 lVector = pointLight.position - geometry.position;\n		directLight.direction = normalize( lVector );\n		float lightDistance = length( lVector );\n		directLight.color = pointLight.color;\n		directLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );\n		directLight.visible = ( directLight.color != vec3( 0.0 ) );\n	}\n#endif\n#if NUM_SPOT_LIGHTS > 0\n	struct SpotLight {\n		vec3 position;\n		vec3 direction;\n		vec3 color;\n		float distance;\n		float decay;\n		float coneCos;\n		float penumbraCos;\n	};\n	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];\n	void getSpotDirectLightIrradiance( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight directLight ) {\n		vec3 lVector = spotLight.position - geometry.position;\n		directLight.direction = normalize( lVector );\n		float lightDistance = length( lVector );\n		float angleCos = dot( directLight.direction, spotLight.direction );\n		if ( angleCos > spotLight.coneCos ) {\n			float spotEffect = smoothstep( spotLight.coneCos, spotLight.penumbraCos, angleCos );\n			directLight.color = spotLight.color;\n			directLight.color *= spotEffect * punctualLightIntensityToIrradianceFactor( lightDistance, spotLight.distance, spotLight.decay );\n			directLight.visible = true;\n		} else {\n			directLight.color = vec3( 0.0 );\n			directLight.visible = false;\n		}\n	}\n#endif\n#if NUM_RECT_AREA_LIGHTS > 0\n	struct RectAreaLight {\n		vec3 color;\n		vec3 position;\n		vec3 halfWidth;\n		vec3 halfHeight;\n	};\n	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;\n	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];\n#endif\n#if NUM_HEMI_LIGHTS > 0\n	struct HemisphereLight {\n		vec3 direction;\n		vec3 skyColor;\n		vec3 groundColor;\n	};\n	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];\n	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in GeometricContext geometry ) {\n		float dotNL = dot( geometry.normal, hemiLight.direction );\n		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;\n		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );\n		#ifndef PHYSICALLY_CORRECT_LIGHTS\n			irradiance *= PI;\n		#endif\n		return irradiance;\n	}\n#endif";
var envmap_physical_pars_fragment = "#if defined( USE_ENVMAP )\n	#ifdef ENVMAP_MODE_REFRACTION\n		uniform float refractionRatio;\n	#endif\n	vec3 getLightProbeIndirectIrradiance( const in GeometricContext geometry, const in int maxMIPLevel ) {\n		vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );\n		#ifdef ENVMAP_TYPE_CUBE\n			vec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );\n			#ifdef TEXTURE_LOD_EXT\n				vec4 envMapColor = textureCubeLodEXT( envMap, queryVec, float( maxMIPLevel ) );\n			#else\n				vec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );\n			#endif\n			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;\n		#elif defined( ENVMAP_TYPE_CUBE_UV )\n			vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );\n		#else\n			vec4 envMapColor = vec4( 0.0 );\n		#endif\n		return PI * envMapColor.rgb * envMapIntensity;\n	}\n	float getSpecularMIPLevel( const in float roughness, const in int maxMIPLevel ) {\n		float maxMIPLevelScalar = float( maxMIPLevel );\n		float sigma = PI * roughness * roughness / ( 1.0 + roughness );\n		float desiredMIPLevel = maxMIPLevelScalar + log2( sigma );\n		return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );\n	}\n	vec3 getLightProbeIndirectRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in int maxMIPLevel ) {\n		#ifdef ENVMAP_MODE_REFLECTION\n			vec3 reflectVec = reflect( -viewDir, normal );\n			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );\n		#else\n			vec3 reflectVec = refract( -viewDir, normal, refractionRatio );\n		#endif\n		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );\n		float specularMIPLevel = getSpecularMIPLevel( roughness, maxMIPLevel );\n		#ifdef ENVMAP_TYPE_CUBE\n			vec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );\n			#ifdef TEXTURE_LOD_EXT\n				vec4 envMapColor = textureCubeLodEXT( envMap, queryReflectVec, specularMIPLevel );\n			#else\n				vec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );\n			#endif\n			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;\n		#elif defined( ENVMAP_TYPE_CUBE_UV )\n			vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );\n		#endif\n		return envMapColor.rgb * envMapIntensity;\n	}\n#endif";
var lights_toon_fragment = "ToonMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;";
var lights_toon_pars_fragment = "varying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\nstruct ToonMaterial {\n	vec3 diffuseColor;\n};\nvoid RE_Direct_Toon( const in IncidentLight directLight, const in GeometricContext geometry, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	vec3 irradiance = getGradientIrradiance( geometry.normal, directLight.direction ) * directLight.color;\n	#ifndef PHYSICALLY_CORRECT_LIGHTS\n		irradiance *= PI;\n	#endif\n	reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in GeometricContext geometry, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_Toon\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon\n#define Material_LightProbeLOD( material )	(0)";
var lights_phong_fragment = "BlinnPhongMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb;\nmaterial.specularColor = specular;\nmaterial.specularShininess = shininess;\nmaterial.specularStrength = specularStrength;";
var lights_phong_pars_fragment = "varying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\nstruct BlinnPhongMaterial {\n	vec3 diffuseColor;\n	vec3 specularColor;\n	float specularShininess;\n	float specularStrength;\n};\nvoid RE_Direct_BlinnPhong( const in IncidentLight directLight, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	#ifndef PHYSICALLY_CORRECT_LIGHTS\n		irradiance *= PI;\n	#endif\n	reflectedLight.directDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n	reflectedLight.directSpecular += irradiance * BRDF_Specular_BlinnPhong( directLight, geometry, material.specularColor, material.specularShininess ) * material.specularStrength;\n}\nvoid RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in GeometricContext geometry, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n}\n#define RE_Direct				RE_Direct_BlinnPhong\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong\n#define Material_LightProbeLOD( material )	(0)";
var lights_physical_fragment = "PhysicalMaterial material;\nmaterial.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );\nvec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );\nfloat geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );\nmaterial.specularRoughness = max( roughnessFactor, 0.0525 );material.specularRoughness += geometryRoughness;\nmaterial.specularRoughness = min( material.specularRoughness, 1.0 );\n#ifdef REFLECTIVITY\n	material.specularColor = mix( vec3( MAXIMUM_SPECULAR_COEFFICIENT * pow2( reflectivity ) ), diffuseColor.rgb, metalnessFactor );\n#else\n	material.specularColor = mix( vec3( DEFAULT_SPECULAR_COEFFICIENT ), diffuseColor.rgb, metalnessFactor );\n#endif\n#ifdef CLEARCOAT\n	material.clearcoat = clearcoat;\n	material.clearcoatRoughness = clearcoatRoughness;\n	#ifdef USE_CLEARCOATMAP\n		material.clearcoat *= texture2D( clearcoatMap, vUv ).x;\n	#endif\n	#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vUv ).y;\n	#endif\n	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );\n	material.clearcoatRoughness += geometryRoughness;\n	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );\n#endif\n#ifdef USE_SHEEN\n	material.sheenColor = sheen;\n#endif";
var lights_physical_pars_fragment = "struct PhysicalMaterial {\n	vec3 diffuseColor;\n	float specularRoughness;\n	vec3 specularColor;\n#ifdef CLEARCOAT\n	float clearcoat;\n	float clearcoatRoughness;\n#endif\n#ifdef USE_SHEEN\n	vec3 sheenColor;\n#endif\n};\n#define MAXIMUM_SPECULAR_COEFFICIENT 0.16\n#define DEFAULT_SPECULAR_COEFFICIENT 0.04\nfloat clearcoatDHRApprox( const in float roughness, const in float dotNL ) {\n	return DEFAULT_SPECULAR_COEFFICIENT + ( 1.0 - DEFAULT_SPECULAR_COEFFICIENT ) * ( pow( 1.0 - dotNL, 5.0 ) * pow( 1.0 - roughness, 2.0 ) );\n}\n#if NUM_RECT_AREA_LIGHTS > 0\n	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n		vec3 normal = geometry.normal;\n		vec3 viewDir = geometry.viewDir;\n		vec3 position = geometry.position;\n		vec3 lightPos = rectAreaLight.position;\n		vec3 halfWidth = rectAreaLight.halfWidth;\n		vec3 halfHeight = rectAreaLight.halfHeight;\n		vec3 lightColor = rectAreaLight.color;\n		float roughness = material.specularRoughness;\n		vec3 rectCoords[ 4 ];\n		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;\n		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;\n		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;\n		vec2 uv = LTC_Uv( normal, viewDir, roughness );\n		vec4 t1 = texture2D( ltc_1, uv );\n		vec4 t2 = texture2D( ltc_2, uv );\n		mat3 mInv = mat3(\n			vec3( t1.x, 0, t1.y ),\n			vec3(    0, 1,    0 ),\n			vec3( t1.z, 0, t1.w )\n		);\n		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );\n		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );\n		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );\n	}\n#endif\nvoid RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	float dotNL = saturate( dot( geometry.normal, directLight.direction ) );\n	vec3 irradiance = dotNL * directLight.color;\n	#ifndef PHYSICALLY_CORRECT_LIGHTS\n		irradiance *= PI;\n	#endif\n	#ifdef CLEARCOAT\n		float ccDotNL = saturate( dot( geometry.clearcoatNormal, directLight.direction ) );\n		vec3 ccIrradiance = ccDotNL * directLight.color;\n		#ifndef PHYSICALLY_CORRECT_LIGHTS\n			ccIrradiance *= PI;\n		#endif\n		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, ccDotNL );\n		reflectedLight.directSpecular += ccIrradiance * material.clearcoat * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.clearcoatNormal, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearcoatRoughness );\n	#else\n		float clearcoatDHR = 0.0;\n	#endif\n	#ifdef USE_SHEEN\n		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_Sheen(\n			material.specularRoughness,\n			directLight.direction,\n			geometry,\n			material.sheenColor\n		);\n	#else\n		reflectedLight.directSpecular += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Specular_GGX( directLight, geometry.viewDir, geometry.normal, material.specularColor, material.specularRoughness);\n	#endif\n	reflectedLight.directDiffuse += ( 1.0 - clearcoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {\n	reflectedLight.indirectDiffuse += irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n}\nvoid RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {\n	#ifdef CLEARCOAT\n		float ccDotNV = saturate( dot( geometry.clearcoatNormal, geometry.viewDir ) );\n		reflectedLight.indirectSpecular += clearcoatRadiance * material.clearcoat * BRDF_Specular_GGX_Environment( geometry.viewDir, geometry.clearcoatNormal, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearcoatRoughness );\n		float ccDotNL = ccDotNV;\n		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, ccDotNL );\n	#else\n		float clearcoatDHR = 0.0;\n	#endif\n	float clearcoatInv = 1.0 - clearcoatDHR;\n	vec3 singleScattering = vec3( 0.0 );\n	vec3 multiScattering = vec3( 0.0 );\n	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;\n	BRDF_Specular_Multiscattering_Environment( geometry, material.specularColor, material.specularRoughness, singleScattering, multiScattering );\n	vec3 diffuse = material.diffuseColor * ( 1.0 - ( singleScattering + multiScattering ) );\n	reflectedLight.indirectSpecular += clearcoatInv * radiance * singleScattering;\n	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;\n	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;\n}\n#define RE_Direct				RE_Direct_Physical\n#define RE_Direct_RectArea		RE_Direct_RectArea_Physical\n#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical\n#define RE_IndirectSpecular		RE_IndirectSpecular_Physical\nfloat computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {\n	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );\n}";
var lights_fragment_begin = "\nGeometricContext geometry;\ngeometry.position = - vViewPosition;\ngeometry.normal = normal;\ngeometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n#ifdef CLEARCOAT\n	geometry.clearcoatNormal = clearcoatNormal;\n#endif\nIncidentLight directLight;\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n	PointLight pointLight;\n	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n	PointLightShadow pointLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n		pointLight = pointLights[ i ];\n		getPointDirectLightIrradiance( pointLight, geometry, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n		pointLightShadow = pointLightShadows[ i ];\n		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometry, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n	SpotLight spotLight;\n	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n		spotLight = spotLights[ i ];\n		getSpotDirectLightIrradiance( spotLight, geometry, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n		spotLightShadow = spotLightShadows[ i ];\n		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometry, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\n	DirectionalLight directionalLight;\n	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLightShadow;\n	#endif\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n		directionalLight = directionalLights[ i ];\n		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n		directionalLightShadow = directionalLightShadows[ i ];\n		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n		#endif\n		RE_Direct( directLight, geometry, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n	RectAreaLight rectAreaLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n		rectAreaLight = rectAreaLights[ i ];\n		RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );\n	}\n	#pragma unroll_loop_end\n#endif\n#if defined( RE_IndirectDiffuse )\n	vec3 iblIrradiance = vec3( 0.0 );\n	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n	irradiance += getLightProbeIrradiance( lightProbe, geometry );\n	#if ( NUM_HEMI_LIGHTS > 0 )\n		#pragma unroll_loop_start\n		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\n		}\n		#pragma unroll_loop_end\n	#endif\n#endif\n#if defined( RE_IndirectSpecular )\n	vec3 radiance = vec3( 0.0 );\n	vec3 clearcoatRadiance = vec3( 0.0 );\n#endif";
var lights_fragment_maps = "#if defined( RE_IndirectDiffuse )\n	#ifdef USE_LIGHTMAP\n		vec4 lightMapTexel= texture2D( lightMap, vUv2 );\n		vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;\n		#ifndef PHYSICALLY_CORRECT_LIGHTS\n			lightMapIrradiance *= PI;\n		#endif\n		irradiance += lightMapIrradiance;\n	#endif\n	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )\n		iblIrradiance += getLightProbeIndirectIrradiance( geometry, maxMipLevel );\n	#endif\n#endif\n#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )\n	radiance += getLightProbeIndirectRadiance( geometry.viewDir, geometry.normal, material.specularRoughness, maxMipLevel );\n	#ifdef CLEARCOAT\n		clearcoatRadiance += getLightProbeIndirectRadiance( geometry.viewDir, geometry.clearcoatNormal, material.clearcoatRoughness, maxMipLevel );\n	#endif\n#endif";
var lights_fragment_end = "#if defined( RE_IndirectDiffuse )\n	RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );\n#endif\n#if defined( RE_IndirectSpecular )\n	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometry, material, reflectedLight );\n#endif";
var logdepthbuf_fragment = "#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )\n	gl_FragDepthEXT = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;\n#endif";
var logdepthbuf_pars_fragment = "#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )\n	uniform float logDepthBufFC;\n	varying float vFragDepth;\n	varying float vIsPerspective;\n#endif";
var logdepthbuf_pars_vertex = "#ifdef USE_LOGDEPTHBUF\n	#ifdef USE_LOGDEPTHBUF_EXT\n		varying float vFragDepth;\n		varying float vIsPerspective;\n	#else\n		uniform float logDepthBufFC;\n	#endif\n#endif";
var logdepthbuf_vertex = "#ifdef USE_LOGDEPTHBUF\n	#ifdef USE_LOGDEPTHBUF_EXT\n		vFragDepth = 1.0 + gl_Position.w;\n		vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );\n	#else\n		if ( isPerspectiveMatrix( projectionMatrix ) ) {\n			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;\n			gl_Position.z *= gl_Position.w;\n		}\n	#endif\n#endif";
var map_fragment = "#ifdef USE_MAP\n	vec4 texelColor = texture2D( map, vUv );\n	texelColor = mapTexelToLinear( texelColor );\n	diffuseColor *= texelColor;\n#endif";
var map_pars_fragment = "#ifdef USE_MAP\n	uniform sampler2D map;\n#endif";
var map_particle_fragment = "#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n	vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;\n#endif\n#ifdef USE_MAP\n	vec4 mapTexel = texture2D( map, uv );\n	diffuseColor *= mapTexelToLinear( mapTexel );\n#endif\n#ifdef USE_ALPHAMAP\n	diffuseColor.a *= texture2D( alphaMap, uv ).g;\n#endif";
var map_particle_pars_fragment = "#if defined( USE_MAP ) || defined( USE_ALPHAMAP )\n	uniform mat3 uvTransform;\n#endif\n#ifdef USE_MAP\n	uniform sampler2D map;\n#endif\n#ifdef USE_ALPHAMAP\n	uniform sampler2D alphaMap;\n#endif";
var metalnessmap_fragment = "float metalnessFactor = metalness;\n#ifdef USE_METALNESSMAP\n	vec4 texelMetalness = texture2D( metalnessMap, vUv );\n	metalnessFactor *= texelMetalness.b;\n#endif";
var metalnessmap_pars_fragment = "#ifdef USE_METALNESSMAP\n	uniform sampler2D metalnessMap;\n#endif";
var morphnormal_vertex = "#ifdef USE_MORPHNORMALS\n	objectNormal *= morphTargetBaseInfluence;\n	objectNormal += morphNormal0 * morphTargetInfluences[ 0 ];\n	objectNormal += morphNormal1 * morphTargetInfluences[ 1 ];\n	objectNormal += morphNormal2 * morphTargetInfluences[ 2 ];\n	objectNormal += morphNormal3 * morphTargetInfluences[ 3 ];\n#endif";
var morphtarget_pars_vertex = "#ifdef USE_MORPHTARGETS\n	uniform float morphTargetBaseInfluence;\n	#ifndef USE_MORPHNORMALS\n		uniform float morphTargetInfluences[ 8 ];\n	#else\n		uniform float morphTargetInfluences[ 4 ];\n	#endif\n#endif";
var morphtarget_vertex = "#ifdef USE_MORPHTARGETS\n	transformed *= morphTargetBaseInfluence;\n	transformed += morphTarget0 * morphTargetInfluences[ 0 ];\n	transformed += morphTarget1 * morphTargetInfluences[ 1 ];\n	transformed += morphTarget2 * morphTargetInfluences[ 2 ];\n	transformed += morphTarget3 * morphTargetInfluences[ 3 ];\n	#ifndef USE_MORPHNORMALS\n		transformed += morphTarget4 * morphTargetInfluences[ 4 ];\n		transformed += morphTarget5 * morphTargetInfluences[ 5 ];\n		transformed += morphTarget6 * morphTargetInfluences[ 6 ];\n		transformed += morphTarget7 * morphTargetInfluences[ 7 ];\n	#endif\n#endif";
var normal_fragment_begin = "float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;\n#ifdef FLAT_SHADED\n	vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );\n	vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );\n	vec3 normal = normalize( cross( fdx, fdy ) );\n#else\n	vec3 normal = normalize( vNormal );\n	#ifdef DOUBLE_SIDED\n		normal = normal * faceDirection;\n	#endif\n	#ifdef USE_TANGENT\n		vec3 tangent = normalize( vTangent );\n		vec3 bitangent = normalize( vBitangent );\n		#ifdef DOUBLE_SIDED\n			tangent = tangent * faceDirection;\n			bitangent = bitangent * faceDirection;\n		#endif\n		#if defined( TANGENTSPACE_NORMALMAP ) || defined( USE_CLEARCOAT_NORMALMAP )\n			mat3 vTBN = mat3( tangent, bitangent, normal );\n		#endif\n	#endif\n#endif\nvec3 geometryNormal = normal;";
var normal_fragment_maps = "#ifdef OBJECTSPACE_NORMALMAP\n	normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;\n	#ifdef FLIP_SIDED\n		normal = - normal;\n	#endif\n	#ifdef DOUBLE_SIDED\n		normal = normal * faceDirection;\n	#endif\n	normal = normalize( normalMatrix * normal );\n#elif defined( TANGENTSPACE_NORMALMAP )\n	vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;\n	mapN.xy *= normalScale;\n	#ifdef USE_TANGENT\n		normal = normalize( vTBN * mapN );\n	#else\n		normal = perturbNormal2Arb( -vViewPosition, normal, mapN, faceDirection );\n	#endif\n#elif defined( USE_BUMPMAP )\n	normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd(), faceDirection );\n#endif";
var normalmap_pars_fragment = "#ifdef USE_NORMALMAP\n	uniform sampler2D normalMap;\n	uniform vec2 normalScale;\n#endif\n#ifdef OBJECTSPACE_NORMALMAP\n	uniform mat3 normalMatrix;\n#endif\n#if ! defined ( USE_TANGENT ) && ( defined ( TANGENTSPACE_NORMALMAP ) || defined ( USE_CLEARCOAT_NORMALMAP ) )\n	vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {\n		vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n		vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n		vec2 st0 = dFdx( vUv.st );\n		vec2 st1 = dFdy( vUv.st );\n		vec3 N = surf_norm;\n		vec3 q1perp = cross( q1, N );\n		vec3 q0perp = cross( N, q0 );\n		vec3 T = q1perp * st0.x + q0perp * st1.x;\n		vec3 B = q1perp * st0.y + q0perp * st1.y;\n		float det = max( dot( T, T ), dot( B, B ) );\n		float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );\n		return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );\n	}\n#endif";
var clearcoat_normal_fragment_begin = "#ifdef CLEARCOAT\n	vec3 clearcoatNormal = geometryNormal;\n#endif";
var clearcoat_normal_fragment_maps = "#ifdef USE_CLEARCOAT_NORMALMAP\n	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vUv ).xyz * 2.0 - 1.0;\n	clearcoatMapN.xy *= clearcoatNormalScale;\n	#ifdef USE_TANGENT\n		clearcoatNormal = normalize( vTBN * clearcoatMapN );\n	#else\n		clearcoatNormal = perturbNormal2Arb( - vViewPosition, clearcoatNormal, clearcoatMapN, faceDirection );\n	#endif\n#endif";
var clearcoat_pars_fragment = "#ifdef USE_CLEARCOATMAP\n	uniform sampler2D clearcoatMap;\n#endif\n#ifdef USE_CLEARCOAT_ROUGHNESSMAP\n	uniform sampler2D clearcoatRoughnessMap;\n#endif\n#ifdef USE_CLEARCOAT_NORMALMAP\n	uniform sampler2D clearcoatNormalMap;\n	uniform vec2 clearcoatNormalScale;\n#endif";
var packing = "vec3 packNormalToRGB( const in vec3 normal ) {\n	return normalize( normal ) * 0.5 + 0.5;\n}\nvec3 unpackRGBToNormal( const in vec3 rgb ) {\n	return 2.0 * rgb.xyz - 1.0;\n}\nconst float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;\nconst vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256., 256. );\nconst vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );\nconst float ShiftRight8 = 1. / 256.;\nvec4 packDepthToRGBA( const in float v ) {\n	vec4 r = vec4( fract( v * PackFactors ), v );\n	r.yzw -= r.xyz * ShiftRight8;	return r * PackUpscale;\n}\nfloat unpackRGBAToDepth( const in vec4 v ) {\n	return dot( v, UnpackFactors );\n}\nvec4 pack2HalfToRGBA( vec2 v ) {\n	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ));\n	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w);\n}\nvec2 unpackRGBATo2Half( vec4 v ) {\n	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );\n}\nfloat viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {\n	return ( viewZ + near ) / ( near - far );\n}\nfloat orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {\n	return linearClipZ * ( near - far ) - near;\n}\nfloat viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {\n	return (( near + viewZ ) * far ) / (( far - near ) * viewZ );\n}\nfloat perspectiveDepthToViewZ( const in float invClipZ, const in float near, const in float far ) {\n	return ( near * far ) / ( ( far - near ) * invClipZ - far );\n}";
var premultiplied_alpha_fragment = "#ifdef PREMULTIPLIED_ALPHA\n	gl_FragColor.rgb *= gl_FragColor.a;\n#endif";
var project_vertex = "vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n	mvPosition = instanceMatrix * mvPosition;\n#endif\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;";
var dithering_fragment = "#ifdef DITHERING\n	gl_FragColor.rgb = dithering( gl_FragColor.rgb );\n#endif";
var dithering_pars_fragment = "#ifdef DITHERING\n	vec3 dithering( vec3 color ) {\n		float grid_position = rand( gl_FragCoord.xy );\n		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );\n		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );\n		return color + dither_shift_RGB;\n	}\n#endif";
var roughnessmap_fragment = "float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n	vec4 texelRoughness = texture2D( roughnessMap, vUv );\n	roughnessFactor *= texelRoughness.g;\n#endif";
var roughnessmap_pars_fragment = "#ifdef USE_ROUGHNESSMAP\n	uniform sampler2D roughnessMap;\n#endif";
var shadowmap_pars_fragment = "#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];\n		varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];\n		struct SpotLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {\n		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );\n	}\n	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {\n		return unpackRGBATo2Half( texture2D( shadow, uv ) );\n	}\n	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){\n		float occlusion = 1.0;\n		vec2 distribution = texture2DDistribution( shadow, uv );\n		float hard_shadow = step( compare , distribution.x );\n		if (hard_shadow != 1.0 ) {\n			float distance = compare - distribution.x ;\n			float variance = max( 0.00000, distribution.y * distribution.y );\n			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );\n		}\n		return occlusion;\n	}\n	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {\n		float shadow = 1.0;\n		shadowCoord.xyz /= shadowCoord.w;\n		shadowCoord.z += shadowBias;\n		bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );\n		bool inFrustum = all( inFrustumVec );\n		bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );\n		bool frustumTest = all( frustumTestVec );\n		if ( frustumTest ) {\n		#if defined( SHADOWMAP_TYPE_PCF )\n			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n			float dx0 = - texelSize.x * shadowRadius;\n			float dy0 = - texelSize.y * shadowRadius;\n			float dx1 = + texelSize.x * shadowRadius;\n			float dy1 = + texelSize.y * shadowRadius;\n			float dx2 = dx0 / 2.0;\n			float dy2 = dy0 / 2.0;\n			float dx3 = dx1 / 2.0;\n			float dy3 = dy1 / 2.0;\n			shadow = (\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )\n			) * ( 1.0 / 17.0 );\n		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;\n			float dx = texelSize.x;\n			float dy = texelSize.y;\n			vec2 uv = shadowCoord.xy;\n			vec2 f = fract( uv * shadowMapSize + 0.5 );\n			uv -= f * texelSize;\n			shadow = (\n				texture2DCompare( shadowMap, uv, shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +\n				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ), \n					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),\n					 f.x ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ), \n					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),\n					 f.x ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ), \n					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),\n					 f.y ) +\n				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ), \n					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),\n					 f.y ) +\n				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ), \n						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),\n						  f.x ),\n					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ), \n						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),\n						  f.x ),\n					 f.y )\n			) * ( 1.0 / 9.0 );\n		#elif defined( SHADOWMAP_TYPE_VSM )\n			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );\n		#else\n			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );\n		#endif\n		}\n		return shadow;\n	}\n	vec2 cubeToUV( vec3 v, float texelSizeY ) {\n		vec3 absV = abs( v );\n		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );\n		absV *= scaleToCube;\n		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );\n		vec2 planar = v.xy;\n		float almostATexel = 1.5 * texelSizeY;\n		float almostOne = 1.0 - almostATexel;\n		if ( absV.z >= almostOne ) {\n			if ( v.z > 0.0 )\n				planar.x = 4.0 - v.x;\n		} else if ( absV.x >= almostOne ) {\n			float signX = sign( v.x );\n			planar.x = v.z * signX + 2.0 * signX;\n		} else if ( absV.y >= almostOne ) {\n			float signY = sign( v.y );\n			planar.x = v.x + 2.0 * signY + 2.0;\n			planar.y = v.z * signY - 2.0;\n		}\n		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );\n	}\n	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {\n		vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );\n		vec3 lightToPosition = shadowCoord.xyz;\n		float dp = ( length( lightToPosition ) - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );		dp += shadowBias;\n		vec3 bd3D = normalize( lightToPosition );\n		#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )\n			vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;\n			return (\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +\n				texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )\n			) * ( 1.0 / 9.0 );\n		#else\n			return texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );\n		#endif\n	}\n#endif";
var shadowmap_pars_vertex = "#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];\n		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];\n		struct DirectionalLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n		uniform mat4 spotShadowMatrix[ NUM_SPOT_LIGHT_SHADOWS ];\n		varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHT_SHADOWS ];\n		struct SpotLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n		};\n		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];\n		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];\n		struct PointLightShadow {\n			float shadowBias;\n			float shadowNormalBias;\n			float shadowRadius;\n			vec2 shadowMapSize;\n			float shadowCameraNear;\n			float shadowCameraFar;\n		};\n		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];\n	#endif\n#endif";
var shadowmap_vertex = "#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SPOT_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0\n		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );\n		vec4 shadowWorldPosition;\n	#endif\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );\n		vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {\n		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias, 0 );\n		vSpotShadowCoord[ i ] = spotShadowMatrix[ i ] * shadowWorldPosition;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n		shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );\n		vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;\n	}\n	#pragma unroll_loop_end\n	#endif\n#endif";
var shadowmask_pars_fragment = "float getShadowMask() {\n	float shadow = 1.0;\n	#ifdef USE_SHADOWMAP\n	#if NUM_DIR_LIGHT_SHADOWS > 0\n	DirectionalLightShadow directionalLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {\n		directionalLight = directionalLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_SPOT_LIGHT_SHADOWS > 0\n	SpotLightShadow spotLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {\n		spotLight = spotLightShadows[ i ];\n		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowBias, spotLight.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#if NUM_POINT_LIGHT_SHADOWS > 0\n	PointLightShadow pointLight;\n	#pragma unroll_loop_start\n	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {\n		pointLight = pointLightShadows[ i ];\n		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;\n	}\n	#pragma unroll_loop_end\n	#endif\n	#endif\n	return shadow;\n}";
var skinbase_vertex = "#ifdef USE_SKINNING\n	mat4 boneMatX = getBoneMatrix( skinIndex.x );\n	mat4 boneMatY = getBoneMatrix( skinIndex.y );\n	mat4 boneMatZ = getBoneMatrix( skinIndex.z );\n	mat4 boneMatW = getBoneMatrix( skinIndex.w );\n#endif";
var skinning_pars_vertex = "#ifdef USE_SKINNING\n	uniform mat4 bindMatrix;\n	uniform mat4 bindMatrixInverse;\n	#ifdef BONE_TEXTURE\n		uniform highp sampler2D boneTexture;\n		uniform int boneTextureSize;\n		mat4 getBoneMatrix( const in float i ) {\n			float j = i * 4.0;\n			float x = mod( j, float( boneTextureSize ) );\n			float y = floor( j / float( boneTextureSize ) );\n			float dx = 1.0 / float( boneTextureSize );\n			float dy = 1.0 / float( boneTextureSize );\n			y = dy * ( y + 0.5 );\n			vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );\n			vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );\n			vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );\n			vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );\n			mat4 bone = mat4( v1, v2, v3, v4 );\n			return bone;\n		}\n	#else\n		uniform mat4 boneMatrices[ MAX_BONES ];\n		mat4 getBoneMatrix( const in float i ) {\n			mat4 bone = boneMatrices[ int(i) ];\n			return bone;\n		}\n	#endif\n#endif";
var skinning_vertex = "#ifdef USE_SKINNING\n	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );\n	vec4 skinned = vec4( 0.0 );\n	skinned += boneMatX * skinVertex * skinWeight.x;\n	skinned += boneMatY * skinVertex * skinWeight.y;\n	skinned += boneMatZ * skinVertex * skinWeight.z;\n	skinned += boneMatW * skinVertex * skinWeight.w;\n	transformed = ( bindMatrixInverse * skinned ).xyz;\n#endif";
var skinnormal_vertex = "#ifdef USE_SKINNING\n	mat4 skinMatrix = mat4( 0.0 );\n	skinMatrix += skinWeight.x * boneMatX;\n	skinMatrix += skinWeight.y * boneMatY;\n	skinMatrix += skinWeight.z * boneMatZ;\n	skinMatrix += skinWeight.w * boneMatW;\n	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;\n	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n	#ifdef USE_TANGENT\n		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;\n	#endif\n#endif";
var specularmap_fragment = "float specularStrength;\n#ifdef USE_SPECULARMAP\n	vec4 texelSpecular = texture2D( specularMap, vUv );\n	specularStrength = texelSpecular.r;\n#else\n	specularStrength = 1.0;\n#endif";
var specularmap_pars_fragment = "#ifdef USE_SPECULARMAP\n	uniform sampler2D specularMap;\n#endif";
var tonemapping_fragment = "#if defined( TONE_MAPPING )\n	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );\n#endif";
var tonemapping_pars_fragment = "#ifndef saturate\n#define saturate(a) clamp( a, 0.0, 1.0 )\n#endif\nuniform float toneMappingExposure;\nvec3 LinearToneMapping( vec3 color ) {\n	return toneMappingExposure * color;\n}\nvec3 ReinhardToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	return saturate( color / ( vec3( 1.0 ) + color ) );\n}\nvec3 OptimizedCineonToneMapping( vec3 color ) {\n	color *= toneMappingExposure;\n	color = max( vec3( 0.0 ), color - 0.004 );\n	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );\n}\nvec3 RRTAndODTFit( vec3 v ) {\n	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;\n	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;\n	return a / b;\n}\nvec3 ACESFilmicToneMapping( vec3 color ) {\n	const mat3 ACESInputMat = mat3(\n		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),\n		vec3( 0.04823, 0.01566, 0.83777 )\n	);\n	const mat3 ACESOutputMat = mat3(\n		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),\n		vec3( -0.07367, -0.00605,  1.07602 )\n	);\n	color *= toneMappingExposure / 0.6;\n	color = ACESInputMat * color;\n	color = RRTAndODTFit( color );\n	color = ACESOutputMat * color;\n	return saturate( color );\n}\nvec3 CustomToneMapping( vec3 color ) { return color; }";
var transmissionmap_fragment = "#ifdef USE_TRANSMISSIONMAP\n	totalTransmission *= texture2D( transmissionMap, vUv ).r;\n#endif";
var transmissionmap_pars_fragment = "#ifdef USE_TRANSMISSIONMAP\n	uniform sampler2D transmissionMap;\n#endif";
var uv_pars_fragment = "#if ( defined( USE_UV ) && ! defined( UVS_VERTEX_ONLY ) )\n	varying vec2 vUv;\n#endif";
var uv_pars_vertex = "#ifdef USE_UV\n	#ifdef UVS_VERTEX_ONLY\n		vec2 vUv;\n	#else\n		varying vec2 vUv;\n	#endif\n	uniform mat3 uvTransform;\n#endif";
var uv_vertex = "#ifdef USE_UV\n	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n#endif";
var uv2_pars_fragment = "#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n	varying vec2 vUv2;\n#endif";
var uv2_pars_vertex = "#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n	attribute vec2 uv2;\n	varying vec2 vUv2;\n	uniform mat3 uv2Transform;\n#endif";
var uv2_vertex = "#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )\n	vUv2 = ( uv2Transform * vec3( uv2, 1 ) ).xy;\n#endif";
var worldpos_vertex = "#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )\n	vec4 worldPosition = vec4( transformed, 1.0 );\n	#ifdef USE_INSTANCING\n		worldPosition = instanceMatrix * worldPosition;\n	#endif\n	worldPosition = modelMatrix * worldPosition;\n#endif";
var background_frag = "uniform sampler2D t2D;\nvarying vec2 vUv;\nvoid main() {\n	vec4 texColor = texture2D( t2D, vUv );\n	gl_FragColor = mapTexelToLinear( texColor );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n}";
var background_vert = "varying vec2 vUv;\nuniform mat3 uvTransform;\nvoid main() {\n	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\n	gl_Position = vec4( position.xy, 1.0, 1.0 );\n}";
var cube_frag = "#include <envmap_common_pars_fragment>\nuniform float opacity;\nvarying vec3 vWorldDirection;\n#include <cube_uv_reflection_fragment>\nvoid main() {\n	vec3 vReflect = vWorldDirection;\n	#include <envmap_fragment>\n	gl_FragColor = envColor;\n	gl_FragColor.a *= opacity;\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n}";
var cube_vert = "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n	gl_Position.z = gl_Position.w;\n}";
var depth_frag = "#if DEPTH_PACKING == 3200\n	uniform float opacity;\n#endif\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( 1.0 );\n	#if DEPTH_PACKING == 3200\n		diffuseColor.a = opacity;\n	#endif\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <logdepthbuf_fragment>\n	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;\n	#if DEPTH_PACKING == 3200\n		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );\n	#elif DEPTH_PACKING == 3201\n		gl_FragColor = packDepthToRGBA( fragCoordZ );\n	#endif\n}";
var depth_vert = "#include <common>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvarying vec2 vHighPrecisionZW;\nvoid main() {\n	#include <uv_vertex>\n	#include <skinbase_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vHighPrecisionZW = gl_Position.zw;\n}";
var distanceRGBA_frag = "#define DISTANCE\nuniform vec3 referencePosition;\nuniform float nearDistance;\nuniform float farDistance;\nvarying vec3 vWorldPosition;\n#include <common>\n#include <packing>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main () {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( 1.0 );\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	float dist = length( vWorldPosition - referencePosition );\n	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );\n	dist = saturate( dist );\n	gl_FragColor = packDepthToRGBA( dist );\n}";
var distanceRGBA_vert = "#define DISTANCE\nvarying vec3 vWorldPosition;\n#include <common>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <skinbase_vertex>\n	#ifdef USE_DISPLACEMENTMAP\n		#include <beginnormal_vertex>\n		#include <morphnormal_vertex>\n		#include <skinnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <worldpos_vertex>\n	#include <clipping_planes_vertex>\n	vWorldPosition = worldPosition.xyz;\n}";
var equirect_frag = "uniform sampler2D tEquirect;\nvarying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vec3 direction = normalize( vWorldDirection );\n	vec2 sampleUV = equirectUv( direction );\n	vec4 texColor = texture2D( tEquirect, sampleUV );\n	gl_FragColor = mapTexelToLinear( texColor );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n}";
var equirect_vert = "varying vec3 vWorldDirection;\n#include <common>\nvoid main() {\n	vWorldDirection = transformDirection( position, modelMatrix );\n	#include <begin_vertex>\n	#include <project_vertex>\n}";
var linedashed_frag = "uniform vec3 diffuse;\nuniform float opacity;\nuniform float dashSize;\nuniform float totalSize;\nvarying float vLineDistance;\n#include <common>\n#include <color_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	if ( mod( vLineDistance, totalSize ) > dashSize ) {\n		discard;\n	}\n	vec3 outgoingLight = vec3( 0.0 );\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <color_fragment>\n	outgoingLight = diffuseColor.rgb;\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}";
var linedashed_vert = "uniform float scale;\nattribute float lineDistance;\nvarying float vLineDistance;\n#include <common>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	vLineDistance = scale * lineDistance;\n	#include <color_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}";
var meshbasic_frag = "uniform vec3 diffuse;\nuniform float opacity;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <cube_uv_reflection_fragment>\n#include <fog_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <specularmap_fragment>\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	#ifdef USE_LIGHTMAP\n	\n		vec4 lightMapTexel= texture2D( lightMap, vUv2 );\n		reflectedLight.indirectDiffuse += lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;\n	#else\n		reflectedLight.indirectDiffuse += vec3( 1.0 );\n	#endif\n	#include <aomap_fragment>\n	reflectedLight.indirectDiffuse *= diffuseColor.rgb;\n	vec3 outgoingLight = reflectedLight.indirectDiffuse;\n	#include <envmap_fragment>\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
var meshbasic_vert = "#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <uv2_vertex>\n	#include <color_vertex>\n	#include <skinbase_vertex>\n	#ifdef USE_ENVMAP\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <worldpos_vertex>\n	#include <clipping_planes_vertex>\n	#include <envmap_vertex>\n	#include <fog_vertex>\n}";
var meshlambert_frag = "uniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\nvarying vec3 vLightFront;\nvarying vec3 vIndirectFront;\n#ifdef DOUBLE_SIDED\n	varying vec3 vLightBack;\n	varying vec3 vIndirectBack;\n#endif\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <cube_uv_reflection_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <fog_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <specularmap_fragment>\n	#include <emissivemap_fragment>\n	#ifdef DOUBLE_SIDED\n		reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;\n	#else\n		reflectedLight.indirectDiffuse += vIndirectFront;\n	#endif\n	#include <lightmap_fragment>\n	reflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );\n	#ifdef DOUBLE_SIDED\n		reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;\n	#else\n		reflectedLight.directDiffuse = vLightFront;\n	#endif\n	reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
var meshlambert_vert = "#define LAMBERT\nvarying vec3 vLightFront;\nvarying vec3 vIndirectFront;\n#ifdef DOUBLE_SIDED\n	varying vec3 vLightBack;\n	varying vec3 vIndirectBack;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <envmap_pars_vertex>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <uv2_vertex>\n	#include <color_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <lights_lambert_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
var meshmatcap_frag = "#define MATCAP\nuniform vec3 diffuse;\nuniform float opacity;\nuniform sampler2D matcap;\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	vec3 viewDir = normalize( vViewPosition );\n	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );\n	vec3 y = cross( viewDir, x );\n	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;\n	#ifdef USE_MATCAP\n		vec4 matcapColor = texture2D( matcap, uv );\n		matcapColor = matcapTexelToLinear( matcapColor );\n	#else\n		vec4 matcapColor = vec4( 1.0 );\n	#endif\n	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
var meshmatcap_vert = "#define MATCAP\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <color_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <color_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#ifndef FLAT_SHADED\n		vNormal = normalize( transformedNormal );\n	#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n	vViewPosition = - mvPosition.xyz;\n}";
var meshtoon_frag = "#define TOON\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <gradientmap_pars_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <lights_toon_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_toon_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
var meshtoon_vert = "#define TOON\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <uv2_vertex>\n	#include <color_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n	vNormal = normalize( transformedNormal );\n#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
var meshphong_frag = "#define PHONG\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform vec3 specular;\nuniform float shininess;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_pars_fragment>\n#include <cube_uv_reflection_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <lights_phong_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <specularmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <lights_phong_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n	#include <envmap_fragment>\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
var meshphong_vert = "#define PHONG\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <uv2_vertex>\n	#include <color_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n	vNormal = normalize( transformedNormal );\n#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <envmap_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
var meshphysical_frag = "#define STANDARD\n#ifdef PHYSICAL\n	#define REFLECTIVITY\n	#define CLEARCOAT\n	#define TRANSMISSION\n#endif\nuniform vec3 diffuse;\nuniform vec3 emissive;\nuniform float roughness;\nuniform float metalness;\nuniform float opacity;\n#ifdef TRANSMISSION\n	uniform float transmission;\n#endif\n#ifdef REFLECTIVITY\n	uniform float reflectivity;\n#endif\n#ifdef CLEARCOAT\n	uniform float clearcoat;\n	uniform float clearcoatRoughness;\n#endif\n#ifdef USE_SHEEN\n	uniform vec3 sheen;\n#endif\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n#include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n#include <transmissionmap_pars_fragment>\n#include <bsdfs>\n#include <cube_uv_reflection_fragment>\n#include <envmap_common_pars_fragment>\n#include <envmap_physical_pars_fragment>\n#include <fog_pars_fragment>\n#include <lights_pars_begin>\n#include <lights_physical_pars_fragment>\n#include <shadowmap_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <clearcoat_pars_fragment>\n#include <roughnessmap_pars_fragment>\n#include <metalnessmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n	vec3 totalEmissiveRadiance = emissive;\n	#ifdef TRANSMISSION\n		float totalTransmission = transmission;\n	#endif\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <color_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	#include <roughnessmap_fragment>\n	#include <metalnessmap_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	#include <clearcoat_normal_fragment_begin>\n	#include <clearcoat_normal_fragment_maps>\n	#include <emissivemap_fragment>\n	#include <transmissionmap_fragment>\n	#include <lights_physical_fragment>\n	#include <lights_fragment_begin>\n	#include <lights_fragment_maps>\n	#include <lights_fragment_end>\n	#include <aomap_fragment>\n	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n	#ifdef TRANSMISSION\n		diffuseColor.a *= mix( saturate( 1. - totalTransmission + linearToRelativeLuminance( reflectedLight.directSpecular + reflectedLight.indirectSpecular ) ), 1.0, metalness );\n	#endif\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n	#include <dithering_fragment>\n}";
var meshphysical_vert = "#define STANDARD\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <uv2_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <uv2_vertex>\n	#include <color_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n	vNormal = normalize( transformedNormal );\n	#ifdef USE_TANGENT\n		vTangent = normalize( transformedTangent );\n		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );\n	#endif\n#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	vViewPosition = - mvPosition.xyz;\n	#include <worldpos_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
var normal_frag = "#define NORMAL\nuniform float opacity;\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )\n	varying vec3 vViewPosition;\n#endif\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif\n#include <packing>\n#include <uv_pars_fragment>\n#include <bumpmap_pars_fragment>\n#include <normalmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	#include <logdepthbuf_fragment>\n	#include <normal_fragment_begin>\n	#include <normal_fragment_maps>\n	gl_FragColor = vec4( packNormalToRGB( normal ), opacity );\n}";
var normal_vert = "#define NORMAL\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )\n	varying vec3 vViewPosition;\n#endif\n#ifndef FLAT_SHADED\n	varying vec3 vNormal;\n	#ifdef USE_TANGENT\n		varying vec3 vTangent;\n		varying vec3 vBitangent;\n	#endif\n#endif\n#include <common>\n#include <uv_pars_vertex>\n#include <displacementmap_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n#ifndef FLAT_SHADED\n	vNormal = normalize( transformedNormal );\n	#ifdef USE_TANGENT\n		vTangent = normalize( transformedTangent );\n		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );\n	#endif\n#endif\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <skinning_vertex>\n	#include <displacementmap_vertex>\n	#include <project_vertex>\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( TANGENTSPACE_NORMALMAP )\n	vViewPosition = - mvPosition.xyz;\n#endif\n}";
var points_frag = "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <color_pars_fragment>\n#include <map_particle_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_particle_fragment>\n	#include <color_fragment>\n	#include <alphatest_fragment>\n	outgoingLight = diffuseColor.rgb;\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n	#include <premultiplied_alpha_fragment>\n}";
var points_vert = "uniform float size;\nuniform float scale;\n#include <common>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <color_vertex>\n	#include <begin_vertex>\n	#include <morphtarget_vertex>\n	#include <project_vertex>\n	gl_PointSize = size;\n	#ifdef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );\n	#endif\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <worldpos_vertex>\n	#include <fog_vertex>\n}";
var shadow_frag = "uniform vec3 color;\nuniform float opacity;\n#include <common>\n#include <packing>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\nvoid main() {\n	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n}";
var shadow_vert = "#include <common>\n#include <fog_pars_vertex>\n#include <shadowmap_pars_vertex>\nvoid main() {\n	#include <begin_vertex>\n	#include <project_vertex>\n	#include <worldpos_vertex>\n	#include <beginnormal_vertex>\n	#include <morphnormal_vertex>\n	#include <skinbase_vertex>\n	#include <skinnormal_vertex>\n	#include <defaultnormal_vertex>\n	#include <shadowmap_vertex>\n	#include <fog_vertex>\n}";
var sprite_frag = "uniform vec3 diffuse;\nuniform float opacity;\n#include <common>\n#include <uv_pars_fragment>\n#include <map_pars_fragment>\n#include <alphamap_pars_fragment>\n#include <fog_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\nvoid main() {\n	#include <clipping_planes_fragment>\n	vec3 outgoingLight = vec3( 0.0 );\n	vec4 diffuseColor = vec4( diffuse, opacity );\n	#include <logdepthbuf_fragment>\n	#include <map_fragment>\n	#include <alphamap_fragment>\n	#include <alphatest_fragment>\n	outgoingLight = diffuseColor.rgb;\n	gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n	#include <tonemapping_fragment>\n	#include <encodings_fragment>\n	#include <fog_fragment>\n}";
var sprite_vert = "uniform float rotation;\nuniform vec2 center;\n#include <common>\n#include <uv_pars_vertex>\n#include <fog_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\nvoid main() {\n	#include <uv_vertex>\n	vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );\n	vec2 scale;\n	scale.x = length( vec3( modelMatrix[ 0 ].x, modelMatrix[ 0 ].y, modelMatrix[ 0 ].z ) );\n	scale.y = length( vec3( modelMatrix[ 1 ].x, modelMatrix[ 1 ].y, modelMatrix[ 1 ].z ) );\n	#ifndef USE_SIZEATTENUATION\n		bool isPerspective = isPerspectiveMatrix( projectionMatrix );\n		if ( isPerspective ) scale *= - mvPosition.z;\n	#endif\n	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;\n	vec2 rotatedPosition;\n	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;\n	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;\n	mvPosition.xy += rotatedPosition;\n	gl_Position = projectionMatrix * mvPosition;\n	#include <logdepthbuf_vertex>\n	#include <clipping_planes_vertex>\n	#include <fog_vertex>\n}";
const ShaderChunk = {
  alphamap_fragment,
  alphamap_pars_fragment,
  alphatest_fragment,
  aomap_fragment,
  aomap_pars_fragment,
  begin_vertex,
  beginnormal_vertex,
  bsdfs,
  bumpmap_pars_fragment,
  clipping_planes_fragment,
  clipping_planes_pars_fragment,
  clipping_planes_pars_vertex,
  clipping_planes_vertex,
  color_fragment,
  color_pars_fragment,
  color_pars_vertex,
  color_vertex,
  common,
  cube_uv_reflection_fragment,
  defaultnormal_vertex,
  displacementmap_pars_vertex,
  displacementmap_vertex,
  emissivemap_fragment,
  emissivemap_pars_fragment,
  encodings_fragment,
  encodings_pars_fragment,
  envmap_fragment,
  envmap_common_pars_fragment,
  envmap_pars_fragment,
  envmap_pars_vertex,
  envmap_physical_pars_fragment,
  envmap_vertex,
  fog_vertex,
  fog_pars_vertex,
  fog_fragment,
  fog_pars_fragment,
  gradientmap_pars_fragment,
  lightmap_fragment,
  lightmap_pars_fragment,
  lights_lambert_vertex,
  lights_pars_begin,
  lights_toon_fragment,
  lights_toon_pars_fragment,
  lights_phong_fragment,
  lights_phong_pars_fragment,
  lights_physical_fragment,
  lights_physical_pars_fragment,
  lights_fragment_begin,
  lights_fragment_maps,
  lights_fragment_end,
  logdepthbuf_fragment,
  logdepthbuf_pars_fragment,
  logdepthbuf_pars_vertex,
  logdepthbuf_vertex,
  map_fragment,
  map_pars_fragment,
  map_particle_fragment,
  map_particle_pars_fragment,
  metalnessmap_fragment,
  metalnessmap_pars_fragment,
  morphnormal_vertex,
  morphtarget_pars_vertex,
  morphtarget_vertex,
  normal_fragment_begin,
  normal_fragment_maps,
  normalmap_pars_fragment,
  clearcoat_normal_fragment_begin,
  clearcoat_normal_fragment_maps,
  clearcoat_pars_fragment,
  packing,
  premultiplied_alpha_fragment,
  project_vertex,
  dithering_fragment,
  dithering_pars_fragment,
  roughnessmap_fragment,
  roughnessmap_pars_fragment,
  shadowmap_pars_fragment,
  shadowmap_pars_vertex,
  shadowmap_vertex,
  shadowmask_pars_fragment,
  skinbase_vertex,
  skinning_pars_vertex,
  skinning_vertex,
  skinnormal_vertex,
  specularmap_fragment,
  specularmap_pars_fragment,
  tonemapping_fragment,
  tonemapping_pars_fragment,
  transmissionmap_fragment,
  transmissionmap_pars_fragment,
  uv_pars_fragment,
  uv_pars_vertex,
  uv_vertex,
  uv2_pars_fragment,
  uv2_pars_vertex,
  uv2_vertex,
  worldpos_vertex,
  background_frag,
  background_vert,
  cube_frag,
  cube_vert,
  depth_frag,
  depth_vert,
  distanceRGBA_frag,
  distanceRGBA_vert,
  equirect_frag,
  equirect_vert,
  linedashed_frag,
  linedashed_vert,
  meshbasic_frag,
  meshbasic_vert,
  meshlambert_frag,
  meshlambert_vert,
  meshmatcap_frag,
  meshmatcap_vert,
  meshtoon_frag,
  meshtoon_vert,
  meshphong_frag,
  meshphong_vert,
  meshphysical_frag,
  meshphysical_vert,
  normal_frag,
  normal_vert,
  points_frag,
  points_vert,
  shadow_frag,
  shadow_vert,
  sprite_frag,
  sprite_vert
};
const UniformsLib = {
  common: {
    diffuse: {value: new Color(15658734)},
    opacity: {value: 1},
    map: {value: null},
    uvTransform: {value: new Matrix3()},
    uv2Transform: {value: new Matrix3()},
    alphaMap: {value: null}
  },
  specularmap: {
    specularMap: {value: null}
  },
  envmap: {
    envMap: {value: null},
    flipEnvMap: {value: -1},
    reflectivity: {value: 1},
    refractionRatio: {value: 0.98},
    maxMipLevel: {value: 0}
  },
  aomap: {
    aoMap: {value: null},
    aoMapIntensity: {value: 1}
  },
  lightmap: {
    lightMap: {value: null},
    lightMapIntensity: {value: 1}
  },
  emissivemap: {
    emissiveMap: {value: null}
  },
  bumpmap: {
    bumpMap: {value: null},
    bumpScale: {value: 1}
  },
  normalmap: {
    normalMap: {value: null},
    normalScale: {value: new Vector2(1, 1)}
  },
  displacementmap: {
    displacementMap: {value: null},
    displacementScale: {value: 1},
    displacementBias: {value: 0}
  },
  roughnessmap: {
    roughnessMap: {value: null}
  },
  metalnessmap: {
    metalnessMap: {value: null}
  },
  gradientmap: {
    gradientMap: {value: null}
  },
  fog: {
    fogDensity: {value: 25e-5},
    fogNear: {value: 1},
    fogFar: {value: 2e3},
    fogColor: {value: new Color(16777215)}
  },
  lights: {
    ambientLightColor: {value: []},
    lightProbe: {value: []},
    directionalLights: {value: [], properties: {
      direction: {},
      color: {}
    }},
    directionalLightShadows: {value: [], properties: {
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    }},
    directionalShadowMap: {value: []},
    directionalShadowMatrix: {value: []},
    spotLights: {value: [], properties: {
      color: {},
      position: {},
      direction: {},
      distance: {},
      coneCos: {},
      penumbraCos: {},
      decay: {}
    }},
    spotLightShadows: {value: [], properties: {
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    }},
    spotShadowMap: {value: []},
    spotShadowMatrix: {value: []},
    pointLights: {value: [], properties: {
      color: {},
      position: {},
      decay: {},
      distance: {}
    }},
    pointLightShadows: {value: [], properties: {
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {},
      shadowCameraNear: {},
      shadowCameraFar: {}
    }},
    pointShadowMap: {value: []},
    pointShadowMatrix: {value: []},
    hemisphereLights: {value: [], properties: {
      direction: {},
      skyColor: {},
      groundColor: {}
    }},
    rectAreaLights: {value: [], properties: {
      color: {},
      position: {},
      width: {},
      height: {}
    }},
    ltc_1: {value: null},
    ltc_2: {value: null}
  },
  points: {
    diffuse: {value: new Color(15658734)},
    opacity: {value: 1},
    size: {value: 1},
    scale: {value: 1},
    map: {value: null},
    alphaMap: {value: null},
    uvTransform: {value: new Matrix3()}
  },
  sprite: {
    diffuse: {value: new Color(15658734)},
    opacity: {value: 1},
    center: {value: new Vector2(0.5, 0.5)},
    rotation: {value: 0},
    map: {value: null},
    alphaMap: {value: null},
    uvTransform: {value: new Matrix3()}
  }
};
const ShaderLib = {
  basic: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.meshbasic_vert,
    fragmentShader: ShaderChunk.meshbasic_frag
  },
  lambert: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: {value: new Color(0)}
      }
    ]),
    vertexShader: ShaderChunk.meshlambert_vert,
    fragmentShader: ShaderChunk.meshlambert_frag
  },
  phong: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: {value: new Color(0)},
        specular: {value: new Color(1118481)},
        shininess: {value: 30}
      }
    ]),
    vertexShader: ShaderChunk.meshphong_vert,
    fragmentShader: ShaderChunk.meshphong_frag
  },
  standard: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.roughnessmap,
      UniformsLib.metalnessmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: {value: new Color(0)},
        roughness: {value: 1},
        metalness: {value: 0},
        envMapIntensity: {value: 1}
      }
    ]),
    vertexShader: ShaderChunk.meshphysical_vert,
    fragmentShader: ShaderChunk.meshphysical_frag
  },
  toon: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.gradientmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: {value: new Color(0)}
      }
    ]),
    vertexShader: ShaderChunk.meshtoon_vert,
    fragmentShader: ShaderChunk.meshtoon_frag
  },
  matcap: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      {
        matcap: {value: null}
      }
    ]),
    vertexShader: ShaderChunk.meshmatcap_vert,
    fragmentShader: ShaderChunk.meshmatcap_frag
  },
  points: {
    uniforms: mergeUniforms([
      UniformsLib.points,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.points_vert,
    fragmentShader: ShaderChunk.points_frag
  },
  dashed: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.fog,
      {
        scale: {value: 1},
        dashSize: {value: 1},
        totalSize: {value: 2}
      }
    ]),
    vertexShader: ShaderChunk.linedashed_vert,
    fragmentShader: ShaderChunk.linedashed_frag
  },
  depth: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap
    ]),
    vertexShader: ShaderChunk.depth_vert,
    fragmentShader: ShaderChunk.depth_frag
  },
  normal: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      {
        opacity: {value: 1}
      }
    ]),
    vertexShader: ShaderChunk.normal_vert,
    fragmentShader: ShaderChunk.normal_frag
  },
  sprite: {
    uniforms: mergeUniforms([
      UniformsLib.sprite,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.sprite_vert,
    fragmentShader: ShaderChunk.sprite_frag
  },
  background: {
    uniforms: {
      uvTransform: {value: new Matrix3()},
      t2D: {value: null}
    },
    vertexShader: ShaderChunk.background_vert,
    fragmentShader: ShaderChunk.background_frag
  },
  cube: {
    uniforms: mergeUniforms([
      UniformsLib.envmap,
      {
        opacity: {value: 1}
      }
    ]),
    vertexShader: ShaderChunk.cube_vert,
    fragmentShader: ShaderChunk.cube_frag
  },
  equirect: {
    uniforms: {
      tEquirect: {value: null}
    },
    vertexShader: ShaderChunk.equirect_vert,
    fragmentShader: ShaderChunk.equirect_frag
  },
  distanceRGBA: {
    uniforms: mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap,
      {
        referencePosition: {value: new Vector3()},
        nearDistance: {value: 1},
        farDistance: {value: 1e3}
      }
    ]),
    vertexShader: ShaderChunk.distanceRGBA_vert,
    fragmentShader: ShaderChunk.distanceRGBA_frag
  },
  shadow: {
    uniforms: mergeUniforms([
      UniformsLib.lights,
      UniformsLib.fog,
      {
        color: {value: new Color(0)},
        opacity: {value: 1}
      }
    ]),
    vertexShader: ShaderChunk.shadow_vert,
    fragmentShader: ShaderChunk.shadow_frag
  }
};
ShaderLib.physical = {
  uniforms: mergeUniforms([
    ShaderLib.standard.uniforms,
    {
      clearcoat: {value: 0},
      clearcoatMap: {value: null},
      clearcoatRoughness: {value: 0},
      clearcoatRoughnessMap: {value: null},
      clearcoatNormalScale: {value: new Vector2(1, 1)},
      clearcoatNormalMap: {value: null},
      sheen: {value: new Color(0)},
      transmission: {value: 0},
      transmissionMap: {value: null}
    }
  ]),
  vertexShader: ShaderChunk.meshphysical_vert,
  fragmentShader: ShaderChunk.meshphysical_frag
};
function WebGLBackground(renderer, cubemaps, state, objects, premultipliedAlpha) {
  const clearColor = new Color(0);
  let clearAlpha = 0;
  let planeMesh;
  let boxMesh;
  let currentBackground = null;
  let currentBackgroundVersion = 0;
  let currentTonemapping = null;
  function render2(renderList, scene, camera, forceClear) {
    let background = scene.isScene === true ? scene.background : null;
    if (background && background.isTexture) {
      background = cubemaps.get(background);
    }
    const xr = renderer.xr;
    const session = xr.getSession && xr.getSession();
    if (session && session.environmentBlendMode === "additive") {
      background = null;
    }
    if (background === null) {
      setClear(clearColor, clearAlpha);
    } else if (background && background.isColor) {
      setClear(background, 1);
      forceClear = true;
    }
    if (renderer.autoClear || forceClear) {
      renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
    }
    if (background && (background.isCubeTexture || background.isWebGLCubeRenderTarget || background.mapping === CubeUVReflectionMapping)) {
      if (boxMesh === void 0) {
        boxMesh = new Mesh(new BoxGeometry(1, 1, 1), new ShaderMaterial({
          name: "BackgroundCubeMaterial",
          uniforms: cloneUniforms(ShaderLib.cube.uniforms),
          vertexShader: ShaderLib.cube.vertexShader,
          fragmentShader: ShaderLib.cube.fragmentShader,
          side: BackSide,
          depthTest: false,
          depthWrite: false,
          fog: false
        }));
        boxMesh.geometry.deleteAttribute("normal");
        boxMesh.geometry.deleteAttribute("uv");
        boxMesh.onBeforeRender = function(renderer2, scene2, camera2) {
          this.matrixWorld.copyPosition(camera2.matrixWorld);
        };
        Object.defineProperty(boxMesh.material, "envMap", {
          get: function() {
            return this.uniforms.envMap.value;
          }
        });
        objects.update(boxMesh);
      }
      if (background.isWebGLCubeRenderTarget) {
        background = background.texture;
      }
      boxMesh.material.uniforms.envMap.value = background;
      boxMesh.material.uniforms.flipEnvMap.value = background.isCubeTexture && background._needsFlipEnvMap ? -1 : 1;
      if (currentBackground !== background || currentBackgroundVersion !== background.version || currentTonemapping !== renderer.toneMapping) {
        boxMesh.material.needsUpdate = true;
        currentBackground = background;
        currentBackgroundVersion = background.version;
        currentTonemapping = renderer.toneMapping;
      }
      renderList.unshift(boxMesh, boxMesh.geometry, boxMesh.material, 0, 0, null);
    } else if (background && background.isTexture) {
      if (planeMesh === void 0) {
        planeMesh = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
          name: "BackgroundMaterial",
          uniforms: cloneUniforms(ShaderLib.background.uniforms),
          vertexShader: ShaderLib.background.vertexShader,
          fragmentShader: ShaderLib.background.fragmentShader,
          side: FrontSide,
          depthTest: false,
          depthWrite: false,
          fog: false
        }));
        planeMesh.geometry.deleteAttribute("normal");
        Object.defineProperty(planeMesh.material, "map", {
          get: function() {
            return this.uniforms.t2D.value;
          }
        });
        objects.update(planeMesh);
      }
      planeMesh.material.uniforms.t2D.value = background;
      if (background.matrixAutoUpdate === true) {
        background.updateMatrix();
      }
      planeMesh.material.uniforms.uvTransform.value.copy(background.matrix);
      if (currentBackground !== background || currentBackgroundVersion !== background.version || currentTonemapping !== renderer.toneMapping) {
        planeMesh.material.needsUpdate = true;
        currentBackground = background;
        currentBackgroundVersion = background.version;
        currentTonemapping = renderer.toneMapping;
      }
      renderList.unshift(planeMesh, planeMesh.geometry, planeMesh.material, 0, 0, null);
    }
  }
  function setClear(color, alpha) {
    state.buffers.color.setClear(color.r, color.g, color.b, alpha, premultipliedAlpha);
  }
  return {
    getClearColor: function() {
      return clearColor;
    },
    setClearColor: function(color, alpha = 1) {
      clearColor.set(color);
      clearAlpha = alpha;
      setClear(clearColor, clearAlpha);
    },
    getClearAlpha: function() {
      return clearAlpha;
    },
    setClearAlpha: function(alpha) {
      clearAlpha = alpha;
      setClear(clearColor, clearAlpha);
    },
    render: render2
  };
}
function WebGLBindingStates(gl, extensions, attributes, capabilities) {
  const maxVertexAttributes = gl.getParameter(34921);
  const extension = capabilities.isWebGL2 ? null : extensions.get("OES_vertex_array_object");
  const vaoAvailable = capabilities.isWebGL2 || extension !== null;
  const bindingStates = {};
  const defaultState = createBindingState(null);
  let currentState = defaultState;
  function setup(object, material, program, geometry, index2) {
    let updateBuffers = false;
    if (vaoAvailable) {
      const state = getBindingState(geometry, program, material);
      if (currentState !== state) {
        currentState = state;
        bindVertexArrayObject(currentState.object);
      }
      updateBuffers = needsUpdate(geometry, index2);
      if (updateBuffers)
        saveCache(geometry, index2);
    } else {
      const wireframe = material.wireframe === true;
      if (currentState.geometry !== geometry.id || currentState.program !== program.id || currentState.wireframe !== wireframe) {
        currentState.geometry = geometry.id;
        currentState.program = program.id;
        currentState.wireframe = wireframe;
        updateBuffers = true;
      }
    }
    if (object.isInstancedMesh === true) {
      updateBuffers = true;
    }
    if (index2 !== null) {
      attributes.update(index2, 34963);
    }
    if (updateBuffers) {
      setupVertexAttributes(object, material, program, geometry);
      if (index2 !== null) {
        gl.bindBuffer(34963, attributes.get(index2).buffer);
      }
    }
  }
  function createVertexArrayObject() {
    if (capabilities.isWebGL2)
      return gl.createVertexArray();
    return extension.createVertexArrayOES();
  }
  function bindVertexArrayObject(vao) {
    if (capabilities.isWebGL2)
      return gl.bindVertexArray(vao);
    return extension.bindVertexArrayOES(vao);
  }
  function deleteVertexArrayObject(vao) {
    if (capabilities.isWebGL2)
      return gl.deleteVertexArray(vao);
    return extension.deleteVertexArrayOES(vao);
  }
  function getBindingState(geometry, program, material) {
    const wireframe = material.wireframe === true;
    let programMap = bindingStates[geometry.id];
    if (programMap === void 0) {
      programMap = {};
      bindingStates[geometry.id] = programMap;
    }
    let stateMap = programMap[program.id];
    if (stateMap === void 0) {
      stateMap = {};
      programMap[program.id] = stateMap;
    }
    let state = stateMap[wireframe];
    if (state === void 0) {
      state = createBindingState(createVertexArrayObject());
      stateMap[wireframe] = state;
    }
    return state;
  }
  function createBindingState(vao) {
    const newAttributes = [];
    const enabledAttributes = [];
    const attributeDivisors = [];
    for (let i = 0; i < maxVertexAttributes; i++) {
      newAttributes[i] = 0;
      enabledAttributes[i] = 0;
      attributeDivisors[i] = 0;
    }
    return {
      geometry: null,
      program: null,
      wireframe: false,
      newAttributes,
      enabledAttributes,
      attributeDivisors,
      object: vao,
      attributes: {},
      index: null
    };
  }
  function needsUpdate(geometry, index2) {
    const cachedAttributes = currentState.attributes;
    const geometryAttributes = geometry.attributes;
    let attributesNum = 0;
    for (const key in geometryAttributes) {
      const cachedAttribute = cachedAttributes[key];
      const geometryAttribute = geometryAttributes[key];
      if (cachedAttribute === void 0)
        return true;
      if (cachedAttribute.attribute !== geometryAttribute)
        return true;
      if (cachedAttribute.data !== geometryAttribute.data)
        return true;
      attributesNum++;
    }
    if (currentState.attributesNum !== attributesNum)
      return true;
    if (currentState.index !== index2)
      return true;
    return false;
  }
  function saveCache(geometry, index2) {
    const cache = {};
    const attributes2 = geometry.attributes;
    let attributesNum = 0;
    for (const key in attributes2) {
      const attribute = attributes2[key];
      const data = {};
      data.attribute = attribute;
      if (attribute.data) {
        data.data = attribute.data;
      }
      cache[key] = data;
      attributesNum++;
    }
    currentState.attributes = cache;
    currentState.attributesNum = attributesNum;
    currentState.index = index2;
  }
  function initAttributes() {
    const newAttributes = currentState.newAttributes;
    for (let i = 0, il = newAttributes.length; i < il; i++) {
      newAttributes[i] = 0;
    }
  }
  function enableAttribute(attribute) {
    enableAttributeAndDivisor(attribute, 0);
  }
  function enableAttributeAndDivisor(attribute, meshPerAttribute) {
    const newAttributes = currentState.newAttributes;
    const enabledAttributes = currentState.enabledAttributes;
    const attributeDivisors = currentState.attributeDivisors;
    newAttributes[attribute] = 1;
    if (enabledAttributes[attribute] === 0) {
      gl.enableVertexAttribArray(attribute);
      enabledAttributes[attribute] = 1;
    }
    if (attributeDivisors[attribute] !== meshPerAttribute) {
      const extension2 = capabilities.isWebGL2 ? gl : extensions.get("ANGLE_instanced_arrays");
      extension2[capabilities.isWebGL2 ? "vertexAttribDivisor" : "vertexAttribDivisorANGLE"](attribute, meshPerAttribute);
      attributeDivisors[attribute] = meshPerAttribute;
    }
  }
  function disableUnusedAttributes() {
    const newAttributes = currentState.newAttributes;
    const enabledAttributes = currentState.enabledAttributes;
    for (let i = 0, il = enabledAttributes.length; i < il; i++) {
      if (enabledAttributes[i] !== newAttributes[i]) {
        gl.disableVertexAttribArray(i);
        enabledAttributes[i] = 0;
      }
    }
  }
  function vertexAttribPointer(index2, size, type, normalized, stride, offset) {
    if (capabilities.isWebGL2 === true && (type === 5124 || type === 5125)) {
      gl.vertexAttribIPointer(index2, size, type, stride, offset);
    } else {
      gl.vertexAttribPointer(index2, size, type, normalized, stride, offset);
    }
  }
  function setupVertexAttributes(object, material, program, geometry) {
    if (capabilities.isWebGL2 === false && (object.isInstancedMesh || geometry.isInstancedBufferGeometry)) {
      if (extensions.get("ANGLE_instanced_arrays") === null)
        return;
    }
    initAttributes();
    const geometryAttributes = geometry.attributes;
    const programAttributes = program.getAttributes();
    const materialDefaultAttributeValues = material.defaultAttributeValues;
    for (const name in programAttributes) {
      const programAttribute = programAttributes[name];
      if (programAttribute >= 0) {
        const geometryAttribute = geometryAttributes[name];
        if (geometryAttribute !== void 0) {
          const normalized = geometryAttribute.normalized;
          const size = geometryAttribute.itemSize;
          const attribute = attributes.get(geometryAttribute);
          if (attribute === void 0)
            continue;
          const buffer = attribute.buffer;
          const type = attribute.type;
          const bytesPerElement = attribute.bytesPerElement;
          if (geometryAttribute.isInterleavedBufferAttribute) {
            const data = geometryAttribute.data;
            const stride = data.stride;
            const offset = geometryAttribute.offset;
            if (data && data.isInstancedInterleavedBuffer) {
              enableAttributeAndDivisor(programAttribute, data.meshPerAttribute);
              if (geometry._maxInstanceCount === void 0) {
                geometry._maxInstanceCount = data.meshPerAttribute * data.count;
              }
            } else {
              enableAttribute(programAttribute);
            }
            gl.bindBuffer(34962, buffer);
            vertexAttribPointer(programAttribute, size, type, normalized, stride * bytesPerElement, offset * bytesPerElement);
          } else {
            if (geometryAttribute.isInstancedBufferAttribute) {
              enableAttributeAndDivisor(programAttribute, geometryAttribute.meshPerAttribute);
              if (geometry._maxInstanceCount === void 0) {
                geometry._maxInstanceCount = geometryAttribute.meshPerAttribute * geometryAttribute.count;
              }
            } else {
              enableAttribute(programAttribute);
            }
            gl.bindBuffer(34962, buffer);
            vertexAttribPointer(programAttribute, size, type, normalized, 0, 0);
          }
        } else if (name === "instanceMatrix") {
          const attribute = attributes.get(object.instanceMatrix);
          if (attribute === void 0)
            continue;
          const buffer = attribute.buffer;
          const type = attribute.type;
          enableAttributeAndDivisor(programAttribute + 0, 1);
          enableAttributeAndDivisor(programAttribute + 1, 1);
          enableAttributeAndDivisor(programAttribute + 2, 1);
          enableAttributeAndDivisor(programAttribute + 3, 1);
          gl.bindBuffer(34962, buffer);
          gl.vertexAttribPointer(programAttribute + 0, 4, type, false, 64, 0);
          gl.vertexAttribPointer(programAttribute + 1, 4, type, false, 64, 16);
          gl.vertexAttribPointer(programAttribute + 2, 4, type, false, 64, 32);
          gl.vertexAttribPointer(programAttribute + 3, 4, type, false, 64, 48);
        } else if (name === "instanceColor") {
          const attribute = attributes.get(object.instanceColor);
          if (attribute === void 0)
            continue;
          const buffer = attribute.buffer;
          const type = attribute.type;
          enableAttributeAndDivisor(programAttribute, 1);
          gl.bindBuffer(34962, buffer);
          gl.vertexAttribPointer(programAttribute, 3, type, false, 12, 0);
        } else if (materialDefaultAttributeValues !== void 0) {
          const value = materialDefaultAttributeValues[name];
          if (value !== void 0) {
            switch (value.length) {
              case 2:
                gl.vertexAttrib2fv(programAttribute, value);
                break;
              case 3:
                gl.vertexAttrib3fv(programAttribute, value);
                break;
              case 4:
                gl.vertexAttrib4fv(programAttribute, value);
                break;
              default:
                gl.vertexAttrib1fv(programAttribute, value);
            }
          }
        }
      }
    }
    disableUnusedAttributes();
  }
  function dispose() {
    reset();
    for (const geometryId in bindingStates) {
      const programMap = bindingStates[geometryId];
      for (const programId in programMap) {
        const stateMap = programMap[programId];
        for (const wireframe in stateMap) {
          deleteVertexArrayObject(stateMap[wireframe].object);
          delete stateMap[wireframe];
        }
        delete programMap[programId];
      }
      delete bindingStates[geometryId];
    }
  }
  function releaseStatesOfGeometry(geometry) {
    if (bindingStates[geometry.id] === void 0)
      return;
    const programMap = bindingStates[geometry.id];
    for (const programId in programMap) {
      const stateMap = programMap[programId];
      for (const wireframe in stateMap) {
        deleteVertexArrayObject(stateMap[wireframe].object);
        delete stateMap[wireframe];
      }
      delete programMap[programId];
    }
    delete bindingStates[geometry.id];
  }
  function releaseStatesOfProgram(program) {
    for (const geometryId in bindingStates) {
      const programMap = bindingStates[geometryId];
      if (programMap[program.id] === void 0)
        continue;
      const stateMap = programMap[program.id];
      for (const wireframe in stateMap) {
        deleteVertexArrayObject(stateMap[wireframe].object);
        delete stateMap[wireframe];
      }
      delete programMap[program.id];
    }
  }
  function reset() {
    resetDefaultState();
    if (currentState === defaultState)
      return;
    currentState = defaultState;
    bindVertexArrayObject(currentState.object);
  }
  function resetDefaultState() {
    defaultState.geometry = null;
    defaultState.program = null;
    defaultState.wireframe = false;
  }
  return {
    setup,
    reset,
    resetDefaultState,
    dispose,
    releaseStatesOfGeometry,
    releaseStatesOfProgram,
    initAttributes,
    enableAttribute,
    disableUnusedAttributes
  };
}
function WebGLBufferRenderer(gl, extensions, info, capabilities) {
  const isWebGL2 = capabilities.isWebGL2;
  let mode;
  function setMode(value) {
    mode = value;
  }
  function render2(start, count) {
    gl.drawArrays(mode, start, count);
    info.update(count, mode, 1);
  }
  function renderInstances(start, count, primcount) {
    if (primcount === 0)
      return;
    let extension, methodName;
    if (isWebGL2) {
      extension = gl;
      methodName = "drawArraysInstanced";
    } else {
      extension = extensions.get("ANGLE_instanced_arrays");
      methodName = "drawArraysInstancedANGLE";
      if (extension === null) {
        console.error("THREE.WebGLBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");
        return;
      }
    }
    extension[methodName](mode, start, count, primcount);
    info.update(count, mode, primcount);
  }
  this.setMode = setMode;
  this.render = render2;
  this.renderInstances = renderInstances;
}
function WebGLCapabilities(gl, extensions, parameters) {
  let maxAnisotropy;
  function getMaxAnisotropy() {
    if (maxAnisotropy !== void 0)
      return maxAnisotropy;
    if (extensions.has("EXT_texture_filter_anisotropic") === true) {
      const extension = extensions.get("EXT_texture_filter_anisotropic");
      maxAnisotropy = gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    } else {
      maxAnisotropy = 0;
    }
    return maxAnisotropy;
  }
  function getMaxPrecision(precision2) {
    if (precision2 === "highp") {
      if (gl.getShaderPrecisionFormat(35633, 36338).precision > 0 && gl.getShaderPrecisionFormat(35632, 36338).precision > 0) {
        return "highp";
      }
      precision2 = "mediump";
    }
    if (precision2 === "mediump") {
      if (gl.getShaderPrecisionFormat(35633, 36337).precision > 0 && gl.getShaderPrecisionFormat(35632, 36337).precision > 0) {
        return "mediump";
      }
    }
    return "lowp";
  }
  const isWebGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext || typeof WebGL2ComputeRenderingContext !== "undefined" && gl instanceof WebGL2ComputeRenderingContext;
  let precision = parameters.precision !== void 0 ? parameters.precision : "highp";
  const maxPrecision = getMaxPrecision(precision);
  if (maxPrecision !== precision) {
    console.warn("THREE.WebGLRenderer:", precision, "not supported, using", maxPrecision, "instead.");
    precision = maxPrecision;
  }
  const logarithmicDepthBuffer = parameters.logarithmicDepthBuffer === true;
  const maxTextures = gl.getParameter(34930);
  const maxVertexTextures = gl.getParameter(35660);
  const maxTextureSize = gl.getParameter(3379);
  const maxCubemapSize = gl.getParameter(34076);
  const maxAttributes = gl.getParameter(34921);
  const maxVertexUniforms = gl.getParameter(36347);
  const maxVaryings = gl.getParameter(36348);
  const maxFragmentUniforms = gl.getParameter(36349);
  const vertexTextures = maxVertexTextures > 0;
  const floatFragmentTextures = isWebGL2 || extensions.has("OES_texture_float");
  const floatVertexTextures = vertexTextures && floatFragmentTextures;
  const maxSamples = isWebGL2 ? gl.getParameter(36183) : 0;
  return {
    isWebGL2,
    getMaxAnisotropy,
    getMaxPrecision,
    precision,
    logarithmicDepthBuffer,
    maxTextures,
    maxVertexTextures,
    maxTextureSize,
    maxCubemapSize,
    maxAttributes,
    maxVertexUniforms,
    maxVaryings,
    maxFragmentUniforms,
    vertexTextures,
    floatFragmentTextures,
    floatVertexTextures,
    maxSamples
  };
}
function WebGLClipping(properties) {
  const scope = this;
  let globalState = null, numGlobalPlanes = 0, localClippingEnabled = false, renderingShadows = false;
  const plane = new Plane(), viewNormalMatrix = new Matrix3(), uniform = {value: null, needsUpdate: false};
  this.uniform = uniform;
  this.numPlanes = 0;
  this.numIntersection = 0;
  this.init = function(planes, enableLocalClipping, camera) {
    const enabled = planes.length !== 0 || enableLocalClipping || numGlobalPlanes !== 0 || localClippingEnabled;
    localClippingEnabled = enableLocalClipping;
    globalState = projectPlanes(planes, camera, 0);
    numGlobalPlanes = planes.length;
    return enabled;
  };
  this.beginShadows = function() {
    renderingShadows = true;
    projectPlanes(null);
  };
  this.endShadows = function() {
    renderingShadows = false;
    resetGlobalState();
  };
  this.setState = function(material, camera, useCache) {
    const planes = material.clippingPlanes, clipIntersection = material.clipIntersection, clipShadows = material.clipShadows;
    const materialProperties = properties.get(material);
    if (!localClippingEnabled || planes === null || planes.length === 0 || renderingShadows && !clipShadows) {
      if (renderingShadows) {
        projectPlanes(null);
      } else {
        resetGlobalState();
      }
    } else {
      const nGlobal = renderingShadows ? 0 : numGlobalPlanes, lGlobal = nGlobal * 4;
      let dstArray = materialProperties.clippingState || null;
      uniform.value = dstArray;
      dstArray = projectPlanes(planes, camera, lGlobal, useCache);
      for (let i = 0; i !== lGlobal; ++i) {
        dstArray[i] = globalState[i];
      }
      materialProperties.clippingState = dstArray;
      this.numIntersection = clipIntersection ? this.numPlanes : 0;
      this.numPlanes += nGlobal;
    }
  };
  function resetGlobalState() {
    if (uniform.value !== globalState) {
      uniform.value = globalState;
      uniform.needsUpdate = numGlobalPlanes > 0;
    }
    scope.numPlanes = numGlobalPlanes;
    scope.numIntersection = 0;
  }
  function projectPlanes(planes, camera, dstOffset, skipTransform) {
    const nPlanes = planes !== null ? planes.length : 0;
    let dstArray = null;
    if (nPlanes !== 0) {
      dstArray = uniform.value;
      if (skipTransform !== true || dstArray === null) {
        const flatSize = dstOffset + nPlanes * 4, viewMatrix = camera.matrixWorldInverse;
        viewNormalMatrix.getNormalMatrix(viewMatrix);
        if (dstArray === null || dstArray.length < flatSize) {
          dstArray = new Float32Array(flatSize);
        }
        for (let i = 0, i4 = dstOffset; i !== nPlanes; ++i, i4 += 4) {
          plane.copy(planes[i]).applyMatrix4(viewMatrix, viewNormalMatrix);
          plane.normal.toArray(dstArray, i4);
          dstArray[i4 + 3] = plane.constant;
        }
      }
      uniform.value = dstArray;
      uniform.needsUpdate = true;
    }
    scope.numPlanes = nPlanes;
    scope.numIntersection = 0;
    return dstArray;
  }
}
function WebGLCubeMaps(renderer) {
  let cubemaps = new WeakMap();
  function mapTextureMapping(texture, mapping) {
    if (mapping === EquirectangularReflectionMapping) {
      texture.mapping = CubeReflectionMapping;
    } else if (mapping === EquirectangularRefractionMapping) {
      texture.mapping = CubeRefractionMapping;
    }
    return texture;
  }
  function get2(texture) {
    if (texture && texture.isTexture) {
      const mapping = texture.mapping;
      if (mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping) {
        if (cubemaps.has(texture)) {
          const cubemap = cubemaps.get(texture).texture;
          return mapTextureMapping(cubemap, texture.mapping);
        } else {
          const image = texture.image;
          if (image && image.height > 0) {
            const currentRenderTarget = renderer.getRenderTarget();
            const renderTarget = new WebGLCubeRenderTarget(image.height / 2);
            renderTarget.fromEquirectangularTexture(renderer, texture);
            cubemaps.set(texture, renderTarget);
            renderer.setRenderTarget(currentRenderTarget);
            texture.addEventListener("dispose", onTextureDispose);
            return mapTextureMapping(renderTarget.texture, texture.mapping);
          } else {
            return null;
          }
        }
      }
    }
    return texture;
  }
  function onTextureDispose(event) {
    const texture = event.target;
    texture.removeEventListener("dispose", onTextureDispose);
    const cubemap = cubemaps.get(texture);
    if (cubemap !== void 0) {
      cubemaps.delete(texture);
      cubemap.dispose();
    }
  }
  function dispose() {
    cubemaps = new WeakMap();
  }
  return {
    get: get2,
    dispose
  };
}
function WebGLExtensions(gl) {
  const extensions = {};
  function getExtension(name) {
    if (extensions[name] !== void 0) {
      return extensions[name];
    }
    let extension;
    switch (name) {
      case "WEBGL_depth_texture":
        extension = gl.getExtension("WEBGL_depth_texture") || gl.getExtension("MOZ_WEBGL_depth_texture") || gl.getExtension("WEBKIT_WEBGL_depth_texture");
        break;
      case "EXT_texture_filter_anisotropic":
        extension = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("MOZ_EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
        break;
      case "WEBGL_compressed_texture_s3tc":
        extension = gl.getExtension("WEBGL_compressed_texture_s3tc") || gl.getExtension("MOZ_WEBGL_compressed_texture_s3tc") || gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
        break;
      case "WEBGL_compressed_texture_pvrtc":
        extension = gl.getExtension("WEBGL_compressed_texture_pvrtc") || gl.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");
        break;
      default:
        extension = gl.getExtension(name);
    }
    extensions[name] = extension;
    return extension;
  }
  return {
    has: function(name) {
      return getExtension(name) !== null;
    },
    init: function(capabilities) {
      if (capabilities.isWebGL2) {
        getExtension("EXT_color_buffer_float");
      } else {
        getExtension("WEBGL_depth_texture");
        getExtension("OES_texture_float");
        getExtension("OES_texture_half_float");
        getExtension("OES_texture_half_float_linear");
        getExtension("OES_standard_derivatives");
        getExtension("OES_element_index_uint");
        getExtension("OES_vertex_array_object");
        getExtension("ANGLE_instanced_arrays");
      }
      getExtension("OES_texture_float_linear");
      getExtension("EXT_color_buffer_half_float");
    },
    get: function(name) {
      const extension = getExtension(name);
      if (extension === null) {
        console.warn("THREE.WebGLRenderer: " + name + " extension not supported.");
      }
      return extension;
    }
  };
}
function WebGLGeometries(gl, attributes, info, bindingStates) {
  const geometries = {};
  const wireframeAttributes = new WeakMap();
  function onGeometryDispose(event) {
    const geometry = event.target;
    if (geometry.index !== null) {
      attributes.remove(geometry.index);
    }
    for (const name in geometry.attributes) {
      attributes.remove(geometry.attributes[name]);
    }
    geometry.removeEventListener("dispose", onGeometryDispose);
    delete geometries[geometry.id];
    const attribute = wireframeAttributes.get(geometry);
    if (attribute) {
      attributes.remove(attribute);
      wireframeAttributes.delete(geometry);
    }
    bindingStates.releaseStatesOfGeometry(geometry);
    if (geometry.isInstancedBufferGeometry === true) {
      delete geometry._maxInstanceCount;
    }
    info.memory.geometries--;
  }
  function get2(object, geometry) {
    if (geometries[geometry.id] === true)
      return geometry;
    geometry.addEventListener("dispose", onGeometryDispose);
    geometries[geometry.id] = true;
    info.memory.geometries++;
    return geometry;
  }
  function update(geometry) {
    const geometryAttributes = geometry.attributes;
    for (const name in geometryAttributes) {
      attributes.update(geometryAttributes[name], 34962);
    }
    const morphAttributes = geometry.morphAttributes;
    for (const name in morphAttributes) {
      const array = morphAttributes[name];
      for (let i = 0, l = array.length; i < l; i++) {
        attributes.update(array[i], 34962);
      }
    }
  }
  function updateWireframeAttribute(geometry) {
    const indices = [];
    const geometryIndex = geometry.index;
    const geometryPosition = geometry.attributes.position;
    let version = 0;
    if (geometryIndex !== null) {
      const array = geometryIndex.array;
      version = geometryIndex.version;
      for (let i = 0, l = array.length; i < l; i += 3) {
        const a = array[i + 0];
        const b = array[i + 1];
        const c = array[i + 2];
        indices.push(a, b, b, c, c, a);
      }
    } else {
      const array = geometryPosition.array;
      version = geometryPosition.version;
      for (let i = 0, l = array.length / 3 - 1; i < l; i += 3) {
        const a = i + 0;
        const b = i + 1;
        const c = i + 2;
        indices.push(a, b, b, c, c, a);
      }
    }
    const attribute = new (arrayMax(indices) > 65535 ? Uint32BufferAttribute : Uint16BufferAttribute)(indices, 1);
    attribute.version = version;
    const previousAttribute = wireframeAttributes.get(geometry);
    if (previousAttribute)
      attributes.remove(previousAttribute);
    wireframeAttributes.set(geometry, attribute);
  }
  function getWireframeAttribute(geometry) {
    const currentAttribute = wireframeAttributes.get(geometry);
    if (currentAttribute) {
      const geometryIndex = geometry.index;
      if (geometryIndex !== null) {
        if (currentAttribute.version < geometryIndex.version) {
          updateWireframeAttribute(geometry);
        }
      }
    } else {
      updateWireframeAttribute(geometry);
    }
    return wireframeAttributes.get(geometry);
  }
  return {
    get: get2,
    update,
    getWireframeAttribute
  };
}
function WebGLIndexedBufferRenderer(gl, extensions, info, capabilities) {
  const isWebGL2 = capabilities.isWebGL2;
  let mode;
  function setMode(value) {
    mode = value;
  }
  let type, bytesPerElement;
  function setIndex(value) {
    type = value.type;
    bytesPerElement = value.bytesPerElement;
  }
  function render2(start, count) {
    gl.drawElements(mode, count, type, start * bytesPerElement);
    info.update(count, mode, 1);
  }
  function renderInstances(start, count, primcount) {
    if (primcount === 0)
      return;
    let extension, methodName;
    if (isWebGL2) {
      extension = gl;
      methodName = "drawElementsInstanced";
    } else {
      extension = extensions.get("ANGLE_instanced_arrays");
      methodName = "drawElementsInstancedANGLE";
      if (extension === null) {
        console.error("THREE.WebGLIndexedBufferRenderer: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.");
        return;
      }
    }
    extension[methodName](mode, count, type, start * bytesPerElement, primcount);
    info.update(count, mode, primcount);
  }
  this.setMode = setMode;
  this.setIndex = setIndex;
  this.render = render2;
  this.renderInstances = renderInstances;
}
function WebGLInfo(gl) {
  const memory = {
    geometries: 0,
    textures: 0
  };
  const render2 = {
    frame: 0,
    calls: 0,
    triangles: 0,
    points: 0,
    lines: 0
  };
  function update(count, mode, instanceCount) {
    render2.calls++;
    switch (mode) {
      case 4:
        render2.triangles += instanceCount * (count / 3);
        break;
      case 1:
        render2.lines += instanceCount * (count / 2);
        break;
      case 3:
        render2.lines += instanceCount * (count - 1);
        break;
      case 2:
        render2.lines += instanceCount * count;
        break;
      case 0:
        render2.points += instanceCount * count;
        break;
      default:
        console.error("THREE.WebGLInfo: Unknown draw mode:", mode);
        break;
    }
  }
  function reset() {
    render2.frame++;
    render2.calls = 0;
    render2.triangles = 0;
    render2.points = 0;
    render2.lines = 0;
  }
  return {
    memory,
    render: render2,
    programs: null,
    autoReset: true,
    reset,
    update
  };
}
function numericalSort(a, b) {
  return a[0] - b[0];
}
function absNumericalSort(a, b) {
  return Math.abs(b[1]) - Math.abs(a[1]);
}
function WebGLMorphtargets(gl) {
  const influencesList = {};
  const morphInfluences = new Float32Array(8);
  const workInfluences = [];
  for (let i = 0; i < 8; i++) {
    workInfluences[i] = [i, 0];
  }
  function update(object, geometry, material, program) {
    const objectInfluences = object.morphTargetInfluences;
    const length = objectInfluences === void 0 ? 0 : objectInfluences.length;
    let influences = influencesList[geometry.id];
    if (influences === void 0) {
      influences = [];
      for (let i = 0; i < length; i++) {
        influences[i] = [i, 0];
      }
      influencesList[geometry.id] = influences;
    }
    for (let i = 0; i < length; i++) {
      const influence = influences[i];
      influence[0] = i;
      influence[1] = objectInfluences[i];
    }
    influences.sort(absNumericalSort);
    for (let i = 0; i < 8; i++) {
      if (i < length && influences[i][1]) {
        workInfluences[i][0] = influences[i][0];
        workInfluences[i][1] = influences[i][1];
      } else {
        workInfluences[i][0] = Number.MAX_SAFE_INTEGER;
        workInfluences[i][1] = 0;
      }
    }
    workInfluences.sort(numericalSort);
    const morphTargets = material.morphTargets && geometry.morphAttributes.position;
    const morphNormals = material.morphNormals && geometry.morphAttributes.normal;
    let morphInfluencesSum = 0;
    for (let i = 0; i < 8; i++) {
      const influence = workInfluences[i];
      const index2 = influence[0];
      const value = influence[1];
      if (index2 !== Number.MAX_SAFE_INTEGER && value) {
        if (morphTargets && geometry.getAttribute("morphTarget" + i) !== morphTargets[index2]) {
          geometry.setAttribute("morphTarget" + i, morphTargets[index2]);
        }
        if (morphNormals && geometry.getAttribute("morphNormal" + i) !== morphNormals[index2]) {
          geometry.setAttribute("morphNormal" + i, morphNormals[index2]);
        }
        morphInfluences[i] = value;
        morphInfluencesSum += value;
      } else {
        if (morphTargets && geometry.hasAttribute("morphTarget" + i) === true) {
          geometry.deleteAttribute("morphTarget" + i);
        }
        if (morphNormals && geometry.hasAttribute("morphNormal" + i) === true) {
          geometry.deleteAttribute("morphNormal" + i);
        }
        morphInfluences[i] = 0;
      }
    }
    const morphBaseInfluence = geometry.morphTargetsRelative ? 1 : 1 - morphInfluencesSum;
    program.getUniforms().setValue(gl, "morphTargetBaseInfluence", morphBaseInfluence);
    program.getUniforms().setValue(gl, "morphTargetInfluences", morphInfluences);
  }
  return {
    update
  };
}
function WebGLObjects(gl, geometries, attributes, info) {
  let updateMap = new WeakMap();
  function update(object) {
    const frame = info.render.frame;
    const geometry = object.geometry;
    const buffergeometry = geometries.get(object, geometry);
    if (updateMap.get(buffergeometry) !== frame) {
      geometries.update(buffergeometry);
      updateMap.set(buffergeometry, frame);
    }
    if (object.isInstancedMesh) {
      if (object.hasEventListener("dispose", onInstancedMeshDispose) === false) {
        object.addEventListener("dispose", onInstancedMeshDispose);
      }
      attributes.update(object.instanceMatrix, 34962);
      if (object.instanceColor !== null) {
        attributes.update(object.instanceColor, 34962);
      }
    }
    return buffergeometry;
  }
  function dispose() {
    updateMap = new WeakMap();
  }
  function onInstancedMeshDispose(event) {
    const instancedMesh = event.target;
    instancedMesh.removeEventListener("dispose", onInstancedMeshDispose);
    attributes.remove(instancedMesh.instanceMatrix);
    if (instancedMesh.instanceColor !== null)
      attributes.remove(instancedMesh.instanceColor);
  }
  return {
    update,
    dispose
  };
}
class DataTexture2DArray extends Texture {
  constructor(data = null, width = 1, height = 1, depth = 1) {
    super(null);
    this.image = {data, width, height, depth};
    this.magFilter = NearestFilter;
    this.minFilter = NearestFilter;
    this.wrapR = ClampToEdgeWrapping;
    this.generateMipmaps = false;
    this.flipY = false;
    this.needsUpdate = true;
  }
}
DataTexture2DArray.prototype.isDataTexture2DArray = true;
class DataTexture3D extends Texture {
  constructor(data = null, width = 1, height = 1, depth = 1) {
    super(null);
    this.image = {data, width, height, depth};
    this.magFilter = NearestFilter;
    this.minFilter = NearestFilter;
    this.wrapR = ClampToEdgeWrapping;
    this.generateMipmaps = false;
    this.flipY = false;
    this.needsUpdate = true;
  }
}
DataTexture3D.prototype.isDataTexture3D = true;
const emptyTexture = new Texture();
const emptyTexture2dArray = new DataTexture2DArray();
const emptyTexture3d = new DataTexture3D();
const emptyCubeTexture = new CubeTexture();
const arrayCacheF32 = [];
const arrayCacheI32 = [];
const mat4array = new Float32Array(16);
const mat3array = new Float32Array(9);
const mat2array = new Float32Array(4);
function flatten(array, nBlocks, blockSize) {
  const firstElem = array[0];
  if (firstElem <= 0 || firstElem > 0)
    return array;
  const n = nBlocks * blockSize;
  let r = arrayCacheF32[n];
  if (r === void 0) {
    r = new Float32Array(n);
    arrayCacheF32[n] = r;
  }
  if (nBlocks !== 0) {
    firstElem.toArray(r, 0);
    for (let i = 1, offset = 0; i !== nBlocks; ++i) {
      offset += blockSize;
      array[i].toArray(r, offset);
    }
  }
  return r;
}
function arraysEqual(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0, l = a.length; i < l; i++) {
    if (a[i] !== b[i])
      return false;
  }
  return true;
}
function copyArray(a, b) {
  for (let i = 0, l = b.length; i < l; i++) {
    a[i] = b[i];
  }
}
function allocTexUnits(textures, n) {
  let r = arrayCacheI32[n];
  if (r === void 0) {
    r = new Int32Array(n);
    arrayCacheI32[n] = r;
  }
  for (let i = 0; i !== n; ++i) {
    r[i] = textures.allocateTextureUnit();
  }
  return r;
}
function setValueV1f(gl, v) {
  const cache = this.cache;
  if (cache[0] === v)
    return;
  gl.uniform1f(this.addr, v);
  cache[0] = v;
}
function setValueV2f(gl, v) {
  const cache = this.cache;
  if (v.x !== void 0) {
    if (cache[0] !== v.x || cache[1] !== v.y) {
      gl.uniform2f(this.addr, v.x, v.y);
      cache[0] = v.x;
      cache[1] = v.y;
    }
  } else {
    if (arraysEqual(cache, v))
      return;
    gl.uniform2fv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV3f(gl, v) {
  const cache = this.cache;
  if (v.x !== void 0) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z) {
      gl.uniform3f(this.addr, v.x, v.y, v.z);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
    }
  } else if (v.r !== void 0) {
    if (cache[0] !== v.r || cache[1] !== v.g || cache[2] !== v.b) {
      gl.uniform3f(this.addr, v.r, v.g, v.b);
      cache[0] = v.r;
      cache[1] = v.g;
      cache[2] = v.b;
    }
  } else {
    if (arraysEqual(cache, v))
      return;
    gl.uniform3fv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueV4f(gl, v) {
  const cache = this.cache;
  if (v.x !== void 0) {
    if (cache[0] !== v.x || cache[1] !== v.y || cache[2] !== v.z || cache[3] !== v.w) {
      gl.uniform4f(this.addr, v.x, v.y, v.z, v.w);
      cache[0] = v.x;
      cache[1] = v.y;
      cache[2] = v.z;
      cache[3] = v.w;
    }
  } else {
    if (arraysEqual(cache, v))
      return;
    gl.uniform4fv(this.addr, v);
    copyArray(cache, v);
  }
}
function setValueM2(gl, v) {
  const cache = this.cache;
  const elements = v.elements;
  if (elements === void 0) {
    if (arraysEqual(cache, v))
      return;
    gl.uniformMatrix2fv(this.addr, false, v);
    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements))
      return;
    mat2array.set(elements);
    gl.uniformMatrix2fv(this.addr, false, mat2array);
    copyArray(cache, elements);
  }
}
function setValueM3(gl, v) {
  const cache = this.cache;
  const elements = v.elements;
  if (elements === void 0) {
    if (arraysEqual(cache, v))
      return;
    gl.uniformMatrix3fv(this.addr, false, v);
    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements))
      return;
    mat3array.set(elements);
    gl.uniformMatrix3fv(this.addr, false, mat3array);
    copyArray(cache, elements);
  }
}
function setValueM4(gl, v) {
  const cache = this.cache;
  const elements = v.elements;
  if (elements === void 0) {
    if (arraysEqual(cache, v))
      return;
    gl.uniformMatrix4fv(this.addr, false, v);
    copyArray(cache, v);
  } else {
    if (arraysEqual(cache, elements))
      return;
    mat4array.set(elements);
    gl.uniformMatrix4fv(this.addr, false, mat4array);
    copyArray(cache, elements);
  }
}
function setValueT1(gl, v, textures) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  textures.safeSetTexture2D(v || emptyTexture, unit);
}
function setValueT2DArray1(gl, v, textures) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  textures.setTexture2DArray(v || emptyTexture2dArray, unit);
}
function setValueT3D1(gl, v, textures) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  textures.setTexture3D(v || emptyTexture3d, unit);
}
function setValueT6(gl, v, textures) {
  const cache = this.cache;
  const unit = textures.allocateTextureUnit();
  if (cache[0] !== unit) {
    gl.uniform1i(this.addr, unit);
    cache[0] = unit;
  }
  textures.safeSetTextureCube(v || emptyCubeTexture, unit);
}
function setValueV1i(gl, v) {
  const cache = this.cache;
  if (cache[0] === v)
    return;
  gl.uniform1i(this.addr, v);
  cache[0] = v;
}
function setValueV2i(gl, v) {
  const cache = this.cache;
  if (arraysEqual(cache, v))
    return;
  gl.uniform2iv(this.addr, v);
  copyArray(cache, v);
}
function setValueV3i(gl, v) {
  const cache = this.cache;
  if (arraysEqual(cache, v))
    return;
  gl.uniform3iv(this.addr, v);
  copyArray(cache, v);
}
function setValueV4i(gl, v) {
  const cache = this.cache;
  if (arraysEqual(cache, v))
    return;
  gl.uniform4iv(this.addr, v);
  copyArray(cache, v);
}
function setValueV1ui(gl, v) {
  const cache = this.cache;
  if (cache[0] === v)
    return;
  gl.uniform1ui(this.addr, v);
  cache[0] = v;
}
function getSingularSetter(type) {
  switch (type) {
    case 5126:
      return setValueV1f;
    case 35664:
      return setValueV2f;
    case 35665:
      return setValueV3f;
    case 35666:
      return setValueV4f;
    case 35674:
      return setValueM2;
    case 35675:
      return setValueM3;
    case 35676:
      return setValueM4;
    case 5124:
    case 35670:
      return setValueV1i;
    case 35667:
    case 35671:
      return setValueV2i;
    case 35668:
    case 35672:
      return setValueV3i;
    case 35669:
    case 35673:
      return setValueV4i;
    case 5125:
      return setValueV1ui;
    case 35678:
    case 36198:
    case 36298:
    case 36306:
    case 35682:
      return setValueT1;
    case 35679:
    case 36299:
    case 36307:
      return setValueT3D1;
    case 35680:
    case 36300:
    case 36308:
    case 36293:
      return setValueT6;
    case 36289:
    case 36303:
    case 36311:
    case 36292:
      return setValueT2DArray1;
  }
}
function setValueV1fArray(gl, v) {
  gl.uniform1fv(this.addr, v);
}
function setValueV1iArray(gl, v) {
  gl.uniform1iv(this.addr, v);
}
function setValueV2iArray(gl, v) {
  gl.uniform2iv(this.addr, v);
}
function setValueV3iArray(gl, v) {
  gl.uniform3iv(this.addr, v);
}
function setValueV4iArray(gl, v) {
  gl.uniform4iv(this.addr, v);
}
function setValueV2fArray(gl, v) {
  const data = flatten(v, this.size, 2);
  gl.uniform2fv(this.addr, data);
}
function setValueV3fArray(gl, v) {
  const data = flatten(v, this.size, 3);
  gl.uniform3fv(this.addr, data);
}
function setValueV4fArray(gl, v) {
  const data = flatten(v, this.size, 4);
  gl.uniform4fv(this.addr, data);
}
function setValueM2Array(gl, v) {
  const data = flatten(v, this.size, 4);
  gl.uniformMatrix2fv(this.addr, false, data);
}
function setValueM3Array(gl, v) {
  const data = flatten(v, this.size, 9);
  gl.uniformMatrix3fv(this.addr, false, data);
}
function setValueM4Array(gl, v) {
  const data = flatten(v, this.size, 16);
  gl.uniformMatrix4fv(this.addr, false, data);
}
function setValueT1Array(gl, v, textures) {
  const n = v.length;
  const units = allocTexUnits(textures, n);
  gl.uniform1iv(this.addr, units);
  for (let i = 0; i !== n; ++i) {
    textures.safeSetTexture2D(v[i] || emptyTexture, units[i]);
  }
}
function setValueT6Array(gl, v, textures) {
  const n = v.length;
  const units = allocTexUnits(textures, n);
  gl.uniform1iv(this.addr, units);
  for (let i = 0; i !== n; ++i) {
    textures.safeSetTextureCube(v[i] || emptyCubeTexture, units[i]);
  }
}
function getPureArraySetter(type) {
  switch (type) {
    case 5126:
      return setValueV1fArray;
    case 35664:
      return setValueV2fArray;
    case 35665:
      return setValueV3fArray;
    case 35666:
      return setValueV4fArray;
    case 35674:
      return setValueM2Array;
    case 35675:
      return setValueM3Array;
    case 35676:
      return setValueM4Array;
    case 5124:
    case 35670:
      return setValueV1iArray;
    case 35667:
    case 35671:
      return setValueV2iArray;
    case 35668:
    case 35672:
      return setValueV3iArray;
    case 35669:
    case 35673:
      return setValueV4iArray;
    case 35678:
    case 36198:
    case 36298:
    case 36306:
    case 35682:
      return setValueT1Array;
    case 35680:
    case 36300:
    case 36308:
    case 36293:
      return setValueT6Array;
  }
}
function SingleUniform(id, activeInfo, addr) {
  this.id = id;
  this.addr = addr;
  this.cache = [];
  this.setValue = getSingularSetter(activeInfo.type);
}
function PureArrayUniform(id, activeInfo, addr) {
  this.id = id;
  this.addr = addr;
  this.cache = [];
  this.size = activeInfo.size;
  this.setValue = getPureArraySetter(activeInfo.type);
}
PureArrayUniform.prototype.updateCache = function(data) {
  const cache = this.cache;
  if (data instanceof Float32Array && cache.length !== data.length) {
    this.cache = new Float32Array(data.length);
  }
  copyArray(cache, data);
};
function StructuredUniform(id) {
  this.id = id;
  this.seq = [];
  this.map = {};
}
StructuredUniform.prototype.setValue = function(gl, value, textures) {
  const seq = this.seq;
  for (let i = 0, n = seq.length; i !== n; ++i) {
    const u = seq[i];
    u.setValue(gl, value[u.id], textures);
  }
};
const RePathPart = /(\w+)(\])?(\[|\.)?/g;
function addUniform(container, uniformObject) {
  container.seq.push(uniformObject);
  container.map[uniformObject.id] = uniformObject;
}
function parseUniform(activeInfo, addr, container) {
  const path = activeInfo.name, pathLength = path.length;
  RePathPart.lastIndex = 0;
  while (true) {
    const match = RePathPart.exec(path), matchEnd = RePathPart.lastIndex;
    let id = match[1];
    const idIsIndex = match[2] === "]", subscript = match[3];
    if (idIsIndex)
      id = id | 0;
    if (subscript === void 0 || subscript === "[" && matchEnd + 2 === pathLength) {
      addUniform(container, subscript === void 0 ? new SingleUniform(id, activeInfo, addr) : new PureArrayUniform(id, activeInfo, addr));
      break;
    } else {
      const map = container.map;
      let next = map[id];
      if (next === void 0) {
        next = new StructuredUniform(id);
        addUniform(container, next);
      }
      container = next;
    }
  }
}
function WebGLUniforms(gl, program) {
  this.seq = [];
  this.map = {};
  const n = gl.getProgramParameter(program, 35718);
  for (let i = 0; i < n; ++i) {
    const info = gl.getActiveUniform(program, i), addr = gl.getUniformLocation(program, info.name);
    parseUniform(info, addr, this);
  }
}
WebGLUniforms.prototype.setValue = function(gl, name, value, textures) {
  const u = this.map[name];
  if (u !== void 0)
    u.setValue(gl, value, textures);
};
WebGLUniforms.prototype.setOptional = function(gl, object, name) {
  const v = object[name];
  if (v !== void 0)
    this.setValue(gl, name, v);
};
WebGLUniforms.upload = function(gl, seq, values, textures) {
  for (let i = 0, n = seq.length; i !== n; ++i) {
    const u = seq[i], v = values[u.id];
    if (v.needsUpdate !== false) {
      u.setValue(gl, v.value, textures);
    }
  }
};
WebGLUniforms.seqWithValue = function(seq, values) {
  const r = [];
  for (let i = 0, n = seq.length; i !== n; ++i) {
    const u = seq[i];
    if (u.id in values)
      r.push(u);
  }
  return r;
};
function WebGLShader(gl, type, string) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, string);
  gl.compileShader(shader);
  return shader;
}
let programIdCount = 0;
function addLineNumbers(string) {
  const lines = string.split("\n");
  for (let i = 0; i < lines.length; i++) {
    lines[i] = i + 1 + ": " + lines[i];
  }
  return lines.join("\n");
}
function getEncodingComponents(encoding) {
  switch (encoding) {
    case LinearEncoding:
      return ["Linear", "( value )"];
    case sRGBEncoding:
      return ["sRGB", "( value )"];
    case RGBEEncoding:
      return ["RGBE", "( value )"];
    case RGBM7Encoding:
      return ["RGBM", "( value, 7.0 )"];
    case RGBM16Encoding:
      return ["RGBM", "( value, 16.0 )"];
    case RGBDEncoding:
      return ["RGBD", "( value, 256.0 )"];
    case GammaEncoding:
      return ["Gamma", "( value, float( GAMMA_FACTOR ) )"];
    case LogLuvEncoding:
      return ["LogLuv", "( value )"];
    default:
      console.warn("THREE.WebGLProgram: Unsupported encoding:", encoding);
      return ["Linear", "( value )"];
  }
}
function getShaderErrors(gl, shader, type) {
  const status = gl.getShaderParameter(shader, 35713);
  const log = gl.getShaderInfoLog(shader).trim();
  if (status && log === "")
    return "";
  const source = gl.getShaderSource(shader);
  return "THREE.WebGLShader: gl.getShaderInfoLog() " + type + "\n" + log + addLineNumbers(source);
}
function getTexelDecodingFunction(functionName, encoding) {
  const components2 = getEncodingComponents(encoding);
  return "vec4 " + functionName + "( vec4 value ) { return " + components2[0] + "ToLinear" + components2[1] + "; }";
}
function getTexelEncodingFunction(functionName, encoding) {
  const components2 = getEncodingComponents(encoding);
  return "vec4 " + functionName + "( vec4 value ) { return LinearTo" + components2[0] + components2[1] + "; }";
}
function getToneMappingFunction(functionName, toneMapping) {
  let toneMappingName;
  switch (toneMapping) {
    case LinearToneMapping:
      toneMappingName = "Linear";
      break;
    case ReinhardToneMapping:
      toneMappingName = "Reinhard";
      break;
    case CineonToneMapping:
      toneMappingName = "OptimizedCineon";
      break;
    case ACESFilmicToneMapping:
      toneMappingName = "ACESFilmic";
      break;
    case CustomToneMapping:
      toneMappingName = "Custom";
      break;
    default:
      console.warn("THREE.WebGLProgram: Unsupported toneMapping:", toneMapping);
      toneMappingName = "Linear";
  }
  return "vec3 " + functionName + "( vec3 color ) { return " + toneMappingName + "ToneMapping( color ); }";
}
function generateExtensions(parameters) {
  const chunks = [
    parameters.extensionDerivatives || parameters.envMapCubeUV || parameters.bumpMap || parameters.tangentSpaceNormalMap || parameters.clearcoatNormalMap || parameters.flatShading || parameters.shaderID === "physical" ? "#extension GL_OES_standard_derivatives : enable" : "",
    (parameters.extensionFragDepth || parameters.logarithmicDepthBuffer) && parameters.rendererExtensionFragDepth ? "#extension GL_EXT_frag_depth : enable" : "",
    parameters.extensionDrawBuffers && parameters.rendererExtensionDrawBuffers ? "#extension GL_EXT_draw_buffers : require" : "",
    (parameters.extensionShaderTextureLOD || parameters.envMap) && parameters.rendererExtensionShaderTextureLod ? "#extension GL_EXT_shader_texture_lod : enable" : ""
  ];
  return chunks.filter(filterEmptyLine).join("\n");
}
function generateDefines(defines) {
  const chunks = [];
  for (const name in defines) {
    const value = defines[name];
    if (value === false)
      continue;
    chunks.push("#define " + name + " " + value);
  }
  return chunks.join("\n");
}
function fetchAttributeLocations(gl, program) {
  const attributes = {};
  const n = gl.getProgramParameter(program, 35721);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveAttrib(program, i);
    const name = info.name;
    attributes[name] = gl.getAttribLocation(program, name);
  }
  return attributes;
}
function filterEmptyLine(string) {
  return string !== "";
}
function replaceLightNums(string, parameters) {
  return string.replace(/NUM_DIR_LIGHTS/g, parameters.numDirLights).replace(/NUM_SPOT_LIGHTS/g, parameters.numSpotLights).replace(/NUM_RECT_AREA_LIGHTS/g, parameters.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g, parameters.numPointLights).replace(/NUM_HEMI_LIGHTS/g, parameters.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g, parameters.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS/g, parameters.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g, parameters.numPointLightShadows);
}
function replaceClippingPlaneNums(string, parameters) {
  return string.replace(/NUM_CLIPPING_PLANES/g, parameters.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g, parameters.numClippingPlanes - parameters.numClipIntersection);
}
const includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm;
function resolveIncludes(string) {
  return string.replace(includePattern, includeReplacer);
}
function includeReplacer(match, include) {
  const string = ShaderChunk[include];
  if (string === void 0) {
    throw new Error("Can not resolve #include <" + include + ">");
  }
  return resolveIncludes(string);
}
const deprecatedUnrollLoopPattern = /#pragma unroll_loop[\s]+?for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g;
const unrollLoopPattern = /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
function unrollLoops(string) {
  return string.replace(unrollLoopPattern, loopReplacer).replace(deprecatedUnrollLoopPattern, deprecatedLoopReplacer);
}
function deprecatedLoopReplacer(match, start, end, snippet) {
  console.warn("WebGLProgram: #pragma unroll_loop shader syntax is deprecated. Please use #pragma unroll_loop_start syntax instead.");
  return loopReplacer(match, start, end, snippet);
}
function loopReplacer(match, start, end, snippet) {
  let string = "";
  for (let i = parseInt(start); i < parseInt(end); i++) {
    string += snippet.replace(/\[\s*i\s*\]/g, "[ " + i + " ]").replace(/UNROLLED_LOOP_INDEX/g, i);
  }
  return string;
}
function generatePrecision(parameters) {
  let precisionstring = "precision " + parameters.precision + " float;\nprecision " + parameters.precision + " int;";
  if (parameters.precision === "highp") {
    precisionstring += "\n#define HIGH_PRECISION";
  } else if (parameters.precision === "mediump") {
    precisionstring += "\n#define MEDIUM_PRECISION";
  } else if (parameters.precision === "lowp") {
    precisionstring += "\n#define LOW_PRECISION";
  }
  return precisionstring;
}
function generateShadowMapTypeDefine(parameters) {
  let shadowMapTypeDefine = "SHADOWMAP_TYPE_BASIC";
  if (parameters.shadowMapType === PCFShadowMap) {
    shadowMapTypeDefine = "SHADOWMAP_TYPE_PCF";
  } else if (parameters.shadowMapType === PCFSoftShadowMap) {
    shadowMapTypeDefine = "SHADOWMAP_TYPE_PCF_SOFT";
  } else if (parameters.shadowMapType === VSMShadowMap) {
    shadowMapTypeDefine = "SHADOWMAP_TYPE_VSM";
  }
  return shadowMapTypeDefine;
}
function generateEnvMapTypeDefine(parameters) {
  let envMapTypeDefine = "ENVMAP_TYPE_CUBE";
  if (parameters.envMap) {
    switch (parameters.envMapMode) {
      case CubeReflectionMapping:
      case CubeRefractionMapping:
        envMapTypeDefine = "ENVMAP_TYPE_CUBE";
        break;
      case CubeUVReflectionMapping:
      case CubeUVRefractionMapping:
        envMapTypeDefine = "ENVMAP_TYPE_CUBE_UV";
        break;
    }
  }
  return envMapTypeDefine;
}
function generateEnvMapModeDefine(parameters) {
  let envMapModeDefine = "ENVMAP_MODE_REFLECTION";
  if (parameters.envMap) {
    switch (parameters.envMapMode) {
      case CubeRefractionMapping:
      case CubeUVRefractionMapping:
        envMapModeDefine = "ENVMAP_MODE_REFRACTION";
        break;
    }
  }
  return envMapModeDefine;
}
function generateEnvMapBlendingDefine(parameters) {
  let envMapBlendingDefine = "ENVMAP_BLENDING_NONE";
  if (parameters.envMap) {
    switch (parameters.combine) {
      case MultiplyOperation:
        envMapBlendingDefine = "ENVMAP_BLENDING_MULTIPLY";
        break;
      case MixOperation:
        envMapBlendingDefine = "ENVMAP_BLENDING_MIX";
        break;
      case AddOperation:
        envMapBlendingDefine = "ENVMAP_BLENDING_ADD";
        break;
    }
  }
  return envMapBlendingDefine;
}
function WebGLProgram(renderer, cacheKey, parameters, bindingStates) {
  const gl = renderer.getContext();
  const defines = parameters.defines;
  let vertexShader = parameters.vertexShader;
  let fragmentShader = parameters.fragmentShader;
  const shadowMapTypeDefine = generateShadowMapTypeDefine(parameters);
  const envMapTypeDefine = generateEnvMapTypeDefine(parameters);
  const envMapModeDefine = generateEnvMapModeDefine(parameters);
  const envMapBlendingDefine = generateEnvMapBlendingDefine(parameters);
  const gammaFactorDefine = renderer.gammaFactor > 0 ? renderer.gammaFactor : 1;
  const customExtensions = parameters.isWebGL2 ? "" : generateExtensions(parameters);
  const customDefines = generateDefines(defines);
  const program = gl.createProgram();
  let prefixVertex, prefixFragment;
  let versionString = parameters.glslVersion ? "#version " + parameters.glslVersion + "\n" : "";
  if (parameters.isRawShaderMaterial) {
    prefixVertex = [
      customDefines
    ].filter(filterEmptyLine).join("\n");
    if (prefixVertex.length > 0) {
      prefixVertex += "\n";
    }
    prefixFragment = [
      customExtensions,
      customDefines
    ].filter(filterEmptyLine).join("\n");
    if (prefixFragment.length > 0) {
      prefixFragment += "\n";
    }
  } else {
    prefixVertex = [
      generatePrecision(parameters),
      "#define SHADER_NAME " + parameters.shaderName,
      customDefines,
      parameters.instancing ? "#define USE_INSTANCING" : "",
      parameters.instancingColor ? "#define USE_INSTANCING_COLOR" : "",
      parameters.supportsVertexTextures ? "#define VERTEX_TEXTURES" : "",
      "#define GAMMA_FACTOR " + gammaFactorDefine,
      "#define MAX_BONES " + parameters.maxBones,
      parameters.useFog && parameters.fog ? "#define USE_FOG" : "",
      parameters.useFog && parameters.fogExp2 ? "#define FOG_EXP2" : "",
      parameters.map ? "#define USE_MAP" : "",
      parameters.envMap ? "#define USE_ENVMAP" : "",
      parameters.envMap ? "#define " + envMapModeDefine : "",
      parameters.lightMap ? "#define USE_LIGHTMAP" : "",
      parameters.aoMap ? "#define USE_AOMAP" : "",
      parameters.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
      parameters.bumpMap ? "#define USE_BUMPMAP" : "",
      parameters.normalMap ? "#define USE_NORMALMAP" : "",
      parameters.normalMap && parameters.objectSpaceNormalMap ? "#define OBJECTSPACE_NORMALMAP" : "",
      parameters.normalMap && parameters.tangentSpaceNormalMap ? "#define TANGENTSPACE_NORMALMAP" : "",
      parameters.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
      parameters.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
      parameters.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
      parameters.displacementMap && parameters.supportsVertexTextures ? "#define USE_DISPLACEMENTMAP" : "",
      parameters.specularMap ? "#define USE_SPECULARMAP" : "",
      parameters.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
      parameters.metalnessMap ? "#define USE_METALNESSMAP" : "",
      parameters.alphaMap ? "#define USE_ALPHAMAP" : "",
      parameters.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
      parameters.vertexTangents ? "#define USE_TANGENT" : "",
      parameters.vertexColors ? "#define USE_COLOR" : "",
      parameters.vertexUvs ? "#define USE_UV" : "",
      parameters.uvsVertexOnly ? "#define UVS_VERTEX_ONLY" : "",
      parameters.flatShading ? "#define FLAT_SHADED" : "",
      parameters.skinning ? "#define USE_SKINNING" : "",
      parameters.useVertexTexture ? "#define BONE_TEXTURE" : "",
      parameters.morphTargets ? "#define USE_MORPHTARGETS" : "",
      parameters.morphNormals && parameters.flatShading === false ? "#define USE_MORPHNORMALS" : "",
      parameters.doubleSided ? "#define DOUBLE_SIDED" : "",
      parameters.flipSided ? "#define FLIP_SIDED" : "",
      parameters.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
      parameters.shadowMapEnabled ? "#define " + shadowMapTypeDefine : "",
      parameters.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
      parameters.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
      parameters.logarithmicDepthBuffer && parameters.rendererExtensionFragDepth ? "#define USE_LOGDEPTHBUF_EXT" : "",
      "uniform mat4 modelMatrix;",
      "uniform mat4 modelViewMatrix;",
      "uniform mat4 projectionMatrix;",
      "uniform mat4 viewMatrix;",
      "uniform mat3 normalMatrix;",
      "uniform vec3 cameraPosition;",
      "uniform bool isOrthographic;",
      "#ifdef USE_INSTANCING",
      "	attribute mat4 instanceMatrix;",
      "#endif",
      "#ifdef USE_INSTANCING_COLOR",
      "	attribute vec3 instanceColor;",
      "#endif",
      "attribute vec3 position;",
      "attribute vec3 normal;",
      "attribute vec2 uv;",
      "#ifdef USE_TANGENT",
      "	attribute vec4 tangent;",
      "#endif",
      "#ifdef USE_COLOR",
      "	attribute vec3 color;",
      "#endif",
      "#ifdef USE_MORPHTARGETS",
      "	attribute vec3 morphTarget0;",
      "	attribute vec3 morphTarget1;",
      "	attribute vec3 morphTarget2;",
      "	attribute vec3 morphTarget3;",
      "	#ifdef USE_MORPHNORMALS",
      "		attribute vec3 morphNormal0;",
      "		attribute vec3 morphNormal1;",
      "		attribute vec3 morphNormal2;",
      "		attribute vec3 morphNormal3;",
      "	#else",
      "		attribute vec3 morphTarget4;",
      "		attribute vec3 morphTarget5;",
      "		attribute vec3 morphTarget6;",
      "		attribute vec3 morphTarget7;",
      "	#endif",
      "#endif",
      "#ifdef USE_SKINNING",
      "	attribute vec4 skinIndex;",
      "	attribute vec4 skinWeight;",
      "#endif",
      "\n"
    ].filter(filterEmptyLine).join("\n");
    prefixFragment = [
      customExtensions,
      generatePrecision(parameters),
      "#define SHADER_NAME " + parameters.shaderName,
      customDefines,
      parameters.alphaTest ? "#define ALPHATEST " + parameters.alphaTest + (parameters.alphaTest % 1 ? "" : ".0") : "",
      "#define GAMMA_FACTOR " + gammaFactorDefine,
      parameters.useFog && parameters.fog ? "#define USE_FOG" : "",
      parameters.useFog && parameters.fogExp2 ? "#define FOG_EXP2" : "",
      parameters.map ? "#define USE_MAP" : "",
      parameters.matcap ? "#define USE_MATCAP" : "",
      parameters.envMap ? "#define USE_ENVMAP" : "",
      parameters.envMap ? "#define " + envMapTypeDefine : "",
      parameters.envMap ? "#define " + envMapModeDefine : "",
      parameters.envMap ? "#define " + envMapBlendingDefine : "",
      parameters.lightMap ? "#define USE_LIGHTMAP" : "",
      parameters.aoMap ? "#define USE_AOMAP" : "",
      parameters.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
      parameters.bumpMap ? "#define USE_BUMPMAP" : "",
      parameters.normalMap ? "#define USE_NORMALMAP" : "",
      parameters.normalMap && parameters.objectSpaceNormalMap ? "#define OBJECTSPACE_NORMALMAP" : "",
      parameters.normalMap && parameters.tangentSpaceNormalMap ? "#define TANGENTSPACE_NORMALMAP" : "",
      parameters.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
      parameters.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
      parameters.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
      parameters.specularMap ? "#define USE_SPECULARMAP" : "",
      parameters.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
      parameters.metalnessMap ? "#define USE_METALNESSMAP" : "",
      parameters.alphaMap ? "#define USE_ALPHAMAP" : "",
      parameters.sheen ? "#define USE_SHEEN" : "",
      parameters.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
      parameters.vertexTangents ? "#define USE_TANGENT" : "",
      parameters.vertexColors || parameters.instancingColor ? "#define USE_COLOR" : "",
      parameters.vertexUvs ? "#define USE_UV" : "",
      parameters.uvsVertexOnly ? "#define UVS_VERTEX_ONLY" : "",
      parameters.gradientMap ? "#define USE_GRADIENTMAP" : "",
      parameters.flatShading ? "#define FLAT_SHADED" : "",
      parameters.doubleSided ? "#define DOUBLE_SIDED" : "",
      parameters.flipSided ? "#define FLIP_SIDED" : "",
      parameters.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
      parameters.shadowMapEnabled ? "#define " + shadowMapTypeDefine : "",
      parameters.premultipliedAlpha ? "#define PREMULTIPLIED_ALPHA" : "",
      parameters.physicallyCorrectLights ? "#define PHYSICALLY_CORRECT_LIGHTS" : "",
      parameters.logarithmicDepthBuffer ? "#define USE_LOGDEPTHBUF" : "",
      parameters.logarithmicDepthBuffer && parameters.rendererExtensionFragDepth ? "#define USE_LOGDEPTHBUF_EXT" : "",
      (parameters.extensionShaderTextureLOD || parameters.envMap) && parameters.rendererExtensionShaderTextureLod ? "#define TEXTURE_LOD_EXT" : "",
      "uniform mat4 viewMatrix;",
      "uniform vec3 cameraPosition;",
      "uniform bool isOrthographic;",
      parameters.toneMapping !== NoToneMapping ? "#define TONE_MAPPING" : "",
      parameters.toneMapping !== NoToneMapping ? ShaderChunk["tonemapping_pars_fragment"] : "",
      parameters.toneMapping !== NoToneMapping ? getToneMappingFunction("toneMapping", parameters.toneMapping) : "",
      parameters.dithering ? "#define DITHERING" : "",
      ShaderChunk["encodings_pars_fragment"],
      parameters.map ? getTexelDecodingFunction("mapTexelToLinear", parameters.mapEncoding) : "",
      parameters.matcap ? getTexelDecodingFunction("matcapTexelToLinear", parameters.matcapEncoding) : "",
      parameters.envMap ? getTexelDecodingFunction("envMapTexelToLinear", parameters.envMapEncoding) : "",
      parameters.emissiveMap ? getTexelDecodingFunction("emissiveMapTexelToLinear", parameters.emissiveMapEncoding) : "",
      parameters.lightMap ? getTexelDecodingFunction("lightMapTexelToLinear", parameters.lightMapEncoding) : "",
      getTexelEncodingFunction("linearToOutputTexel", parameters.outputEncoding),
      parameters.depthPacking ? "#define DEPTH_PACKING " + parameters.depthPacking : "",
      "\n"
    ].filter(filterEmptyLine).join("\n");
  }
  vertexShader = resolveIncludes(vertexShader);
  vertexShader = replaceLightNums(vertexShader, parameters);
  vertexShader = replaceClippingPlaneNums(vertexShader, parameters);
  fragmentShader = resolveIncludes(fragmentShader);
  fragmentShader = replaceLightNums(fragmentShader, parameters);
  fragmentShader = replaceClippingPlaneNums(fragmentShader, parameters);
  vertexShader = unrollLoops(vertexShader);
  fragmentShader = unrollLoops(fragmentShader);
  if (parameters.isWebGL2 && parameters.isRawShaderMaterial !== true) {
    versionString = "#version 300 es\n";
    prefixVertex = [
      "#define attribute in",
      "#define varying out",
      "#define texture2D texture"
    ].join("\n") + "\n" + prefixVertex;
    prefixFragment = [
      "#define varying in",
      parameters.glslVersion === GLSL3 ? "" : "out highp vec4 pc_fragColor;",
      parameters.glslVersion === GLSL3 ? "" : "#define gl_FragColor pc_fragColor",
      "#define gl_FragDepthEXT gl_FragDepth",
      "#define texture2D texture",
      "#define textureCube texture",
      "#define texture2DProj textureProj",
      "#define texture2DLodEXT textureLod",
      "#define texture2DProjLodEXT textureProjLod",
      "#define textureCubeLodEXT textureLod",
      "#define texture2DGradEXT textureGrad",
      "#define texture2DProjGradEXT textureProjGrad",
      "#define textureCubeGradEXT textureGrad"
    ].join("\n") + "\n" + prefixFragment;
  }
  const vertexGlsl = versionString + prefixVertex + vertexShader;
  const fragmentGlsl = versionString + prefixFragment + fragmentShader;
  const glVertexShader = WebGLShader(gl, 35633, vertexGlsl);
  const glFragmentShader = WebGLShader(gl, 35632, fragmentGlsl);
  gl.attachShader(program, glVertexShader);
  gl.attachShader(program, glFragmentShader);
  if (parameters.index0AttributeName !== void 0) {
    gl.bindAttribLocation(program, 0, parameters.index0AttributeName);
  } else if (parameters.morphTargets === true) {
    gl.bindAttribLocation(program, 0, "position");
  }
  gl.linkProgram(program);
  if (renderer.debug.checkShaderErrors) {
    const programLog = gl.getProgramInfoLog(program).trim();
    const vertexLog = gl.getShaderInfoLog(glVertexShader).trim();
    const fragmentLog = gl.getShaderInfoLog(glFragmentShader).trim();
    let runnable = true;
    let haveDiagnostics = true;
    if (gl.getProgramParameter(program, 35714) === false) {
      runnable = false;
      const vertexErrors = getShaderErrors(gl, glVertexShader, "vertex");
      const fragmentErrors = getShaderErrors(gl, glFragmentShader, "fragment");
      console.error("THREE.WebGLProgram: shader error: ", gl.getError(), "35715", gl.getProgramParameter(program, 35715), "gl.getProgramInfoLog", programLog, vertexErrors, fragmentErrors);
    } else if (programLog !== "") {
      console.warn("THREE.WebGLProgram: gl.getProgramInfoLog()", programLog);
    } else if (vertexLog === "" || fragmentLog === "") {
      haveDiagnostics = false;
    }
    if (haveDiagnostics) {
      this.diagnostics = {
        runnable,
        programLog,
        vertexShader: {
          log: vertexLog,
          prefix: prefixVertex
        },
        fragmentShader: {
          log: fragmentLog,
          prefix: prefixFragment
        }
      };
    }
  }
  gl.deleteShader(glVertexShader);
  gl.deleteShader(glFragmentShader);
  let cachedUniforms;
  this.getUniforms = function() {
    if (cachedUniforms === void 0) {
      cachedUniforms = new WebGLUniforms(gl, program);
    }
    return cachedUniforms;
  };
  let cachedAttributes;
  this.getAttributes = function() {
    if (cachedAttributes === void 0) {
      cachedAttributes = fetchAttributeLocations(gl, program);
    }
    return cachedAttributes;
  };
  this.destroy = function() {
    bindingStates.releaseStatesOfProgram(this);
    gl.deleteProgram(program);
    this.program = void 0;
  };
  this.name = parameters.shaderName;
  this.id = programIdCount++;
  this.cacheKey = cacheKey;
  this.usedTimes = 1;
  this.program = program;
  this.vertexShader = glVertexShader;
  this.fragmentShader = glFragmentShader;
  return this;
}
function WebGLPrograms(renderer, cubemaps, extensions, capabilities, bindingStates, clipping) {
  const programs = [];
  const isWebGL2 = capabilities.isWebGL2;
  const logarithmicDepthBuffer = capabilities.logarithmicDepthBuffer;
  const floatVertexTextures = capabilities.floatVertexTextures;
  const maxVertexUniforms = capabilities.maxVertexUniforms;
  const vertexTextures = capabilities.vertexTextures;
  let precision = capabilities.precision;
  const shaderIDs = {
    MeshDepthMaterial: "depth",
    MeshDistanceMaterial: "distanceRGBA",
    MeshNormalMaterial: "normal",
    MeshBasicMaterial: "basic",
    MeshLambertMaterial: "lambert",
    MeshPhongMaterial: "phong",
    MeshToonMaterial: "toon",
    MeshStandardMaterial: "physical",
    MeshPhysicalMaterial: "physical",
    MeshMatcapMaterial: "matcap",
    LineBasicMaterial: "basic",
    LineDashedMaterial: "dashed",
    PointsMaterial: "points",
    ShadowMaterial: "shadow",
    SpriteMaterial: "sprite"
  };
  const parameterNames = [
    "precision",
    "isWebGL2",
    "supportsVertexTextures",
    "outputEncoding",
    "instancing",
    "instancingColor",
    "map",
    "mapEncoding",
    "matcap",
    "matcapEncoding",
    "envMap",
    "envMapMode",
    "envMapEncoding",
    "envMapCubeUV",
    "lightMap",
    "lightMapEncoding",
    "aoMap",
    "emissiveMap",
    "emissiveMapEncoding",
    "bumpMap",
    "normalMap",
    "objectSpaceNormalMap",
    "tangentSpaceNormalMap",
    "clearcoatMap",
    "clearcoatRoughnessMap",
    "clearcoatNormalMap",
    "displacementMap",
    "specularMap",
    "roughnessMap",
    "metalnessMap",
    "gradientMap",
    "alphaMap",
    "combine",
    "vertexColors",
    "vertexTangents",
    "vertexUvs",
    "uvsVertexOnly",
    "fog",
    "useFog",
    "fogExp2",
    "flatShading",
    "sizeAttenuation",
    "logarithmicDepthBuffer",
    "skinning",
    "maxBones",
    "useVertexTexture",
    "morphTargets",
    "morphNormals",
    "maxMorphTargets",
    "maxMorphNormals",
    "premultipliedAlpha",
    "numDirLights",
    "numPointLights",
    "numSpotLights",
    "numHemiLights",
    "numRectAreaLights",
    "numDirLightShadows",
    "numPointLightShadows",
    "numSpotLightShadows",
    "shadowMapEnabled",
    "shadowMapType",
    "toneMapping",
    "physicallyCorrectLights",
    "alphaTest",
    "doubleSided",
    "flipSided",
    "numClippingPlanes",
    "numClipIntersection",
    "depthPacking",
    "dithering",
    "sheen",
    "transmissionMap"
  ];
  function getMaxBones(object) {
    const skeleton = object.skeleton;
    const bones = skeleton.bones;
    if (floatVertexTextures) {
      return 1024;
    } else {
      const nVertexUniforms = maxVertexUniforms;
      const nVertexMatrices = Math.floor((nVertexUniforms - 20) / 4);
      const maxBones = Math.min(nVertexMatrices, bones.length);
      if (maxBones < bones.length) {
        console.warn("THREE.WebGLRenderer: Skeleton has " + bones.length + " bones. This GPU supports " + maxBones + ".");
        return 0;
      }
      return maxBones;
    }
  }
  function getTextureEncodingFromMap(map) {
    let encoding;
    if (map && map.isTexture) {
      encoding = map.encoding;
    } else if (map && map.isWebGLRenderTarget) {
      console.warn("THREE.WebGLPrograms.getTextureEncodingFromMap: don't use render targets as textures. Use their .texture property instead.");
      encoding = map.texture.encoding;
    } else {
      encoding = LinearEncoding;
    }
    return encoding;
  }
  function getParameters(material, lights, shadows, scene, object) {
    const fog = scene.fog;
    const environment = material.isMeshStandardMaterial ? scene.environment : null;
    const envMap = cubemaps.get(material.envMap || environment);
    const shaderID = shaderIDs[material.type];
    const maxBones = object.isSkinnedMesh ? getMaxBones(object) : 0;
    if (material.precision !== null) {
      precision = capabilities.getMaxPrecision(material.precision);
      if (precision !== material.precision) {
        console.warn("THREE.WebGLProgram.getParameters:", material.precision, "not supported, using", precision, "instead.");
      }
    }
    let vertexShader, fragmentShader;
    if (shaderID) {
      const shader = ShaderLib[shaderID];
      vertexShader = shader.vertexShader;
      fragmentShader = shader.fragmentShader;
    } else {
      vertexShader = material.vertexShader;
      fragmentShader = material.fragmentShader;
    }
    const currentRenderTarget = renderer.getRenderTarget();
    const parameters = {
      isWebGL2,
      shaderID,
      shaderName: material.type,
      vertexShader,
      fragmentShader,
      defines: material.defines,
      isRawShaderMaterial: material.isRawShaderMaterial === true,
      glslVersion: material.glslVersion,
      precision,
      instancing: object.isInstancedMesh === true,
      instancingColor: object.isInstancedMesh === true && object.instanceColor !== null,
      supportsVertexTextures: vertexTextures,
      outputEncoding: currentRenderTarget !== null ? getTextureEncodingFromMap(currentRenderTarget.texture) : renderer.outputEncoding,
      map: !!material.map,
      mapEncoding: getTextureEncodingFromMap(material.map),
      matcap: !!material.matcap,
      matcapEncoding: getTextureEncodingFromMap(material.matcap),
      envMap: !!envMap,
      envMapMode: envMap && envMap.mapping,
      envMapEncoding: getTextureEncodingFromMap(envMap),
      envMapCubeUV: !!envMap && (envMap.mapping === CubeUVReflectionMapping || envMap.mapping === CubeUVRefractionMapping),
      lightMap: !!material.lightMap,
      lightMapEncoding: getTextureEncodingFromMap(material.lightMap),
      aoMap: !!material.aoMap,
      emissiveMap: !!material.emissiveMap,
      emissiveMapEncoding: getTextureEncodingFromMap(material.emissiveMap),
      bumpMap: !!material.bumpMap,
      normalMap: !!material.normalMap,
      objectSpaceNormalMap: material.normalMapType === ObjectSpaceNormalMap,
      tangentSpaceNormalMap: material.normalMapType === TangentSpaceNormalMap,
      clearcoatMap: !!material.clearcoatMap,
      clearcoatRoughnessMap: !!material.clearcoatRoughnessMap,
      clearcoatNormalMap: !!material.clearcoatNormalMap,
      displacementMap: !!material.displacementMap,
      roughnessMap: !!material.roughnessMap,
      metalnessMap: !!material.metalnessMap,
      specularMap: !!material.specularMap,
      alphaMap: !!material.alphaMap,
      gradientMap: !!material.gradientMap,
      sheen: !!material.sheen,
      transmissionMap: !!material.transmissionMap,
      combine: material.combine,
      vertexTangents: material.normalMap && material.vertexTangents,
      vertexColors: material.vertexColors,
      vertexUvs: !!material.map || !!material.bumpMap || !!material.normalMap || !!material.specularMap || !!material.alphaMap || !!material.emissiveMap || !!material.roughnessMap || !!material.metalnessMap || !!material.clearcoatMap || !!material.clearcoatRoughnessMap || !!material.clearcoatNormalMap || !!material.displacementMap || !!material.transmissionMap,
      uvsVertexOnly: !(!!material.map || !!material.bumpMap || !!material.normalMap || !!material.specularMap || !!material.alphaMap || !!material.emissiveMap || !!material.roughnessMap || !!material.metalnessMap || !!material.clearcoatNormalMap || !!material.transmissionMap) && !!material.displacementMap,
      fog: !!fog,
      useFog: material.fog,
      fogExp2: fog && fog.isFogExp2,
      flatShading: !!material.flatShading,
      sizeAttenuation: material.sizeAttenuation,
      logarithmicDepthBuffer,
      skinning: material.skinning && maxBones > 0,
      maxBones,
      useVertexTexture: floatVertexTextures,
      morphTargets: material.morphTargets,
      morphNormals: material.morphNormals,
      maxMorphTargets: renderer.maxMorphTargets,
      maxMorphNormals: renderer.maxMorphNormals,
      numDirLights: lights.directional.length,
      numPointLights: lights.point.length,
      numSpotLights: lights.spot.length,
      numRectAreaLights: lights.rectArea.length,
      numHemiLights: lights.hemi.length,
      numDirLightShadows: lights.directionalShadowMap.length,
      numPointLightShadows: lights.pointShadowMap.length,
      numSpotLightShadows: lights.spotShadowMap.length,
      numClippingPlanes: clipping.numPlanes,
      numClipIntersection: clipping.numIntersection,
      dithering: material.dithering,
      shadowMapEnabled: renderer.shadowMap.enabled && shadows.length > 0,
      shadowMapType: renderer.shadowMap.type,
      toneMapping: material.toneMapped ? renderer.toneMapping : NoToneMapping,
      physicallyCorrectLights: renderer.physicallyCorrectLights,
      premultipliedAlpha: material.premultipliedAlpha,
      alphaTest: material.alphaTest,
      doubleSided: material.side === DoubleSide,
      flipSided: material.side === BackSide,
      depthPacking: material.depthPacking !== void 0 ? material.depthPacking : false,
      index0AttributeName: material.index0AttributeName,
      extensionDerivatives: material.extensions && material.extensions.derivatives,
      extensionFragDepth: material.extensions && material.extensions.fragDepth,
      extensionDrawBuffers: material.extensions && material.extensions.drawBuffers,
      extensionShaderTextureLOD: material.extensions && material.extensions.shaderTextureLOD,
      rendererExtensionFragDepth: isWebGL2 || extensions.has("EXT_frag_depth"),
      rendererExtensionDrawBuffers: isWebGL2 || extensions.has("WEBGL_draw_buffers"),
      rendererExtensionShaderTextureLod: isWebGL2 || extensions.has("EXT_shader_texture_lod"),
      customProgramCacheKey: material.customProgramCacheKey()
    };
    return parameters;
  }
  function getProgramCacheKey(parameters) {
    const array = [];
    if (parameters.shaderID) {
      array.push(parameters.shaderID);
    } else {
      array.push(parameters.fragmentShader);
      array.push(parameters.vertexShader);
    }
    if (parameters.defines !== void 0) {
      for (const name in parameters.defines) {
        array.push(name);
        array.push(parameters.defines[name]);
      }
    }
    if (parameters.isRawShaderMaterial === false) {
      for (let i = 0; i < parameterNames.length; i++) {
        array.push(parameters[parameterNames[i]]);
      }
      array.push(renderer.outputEncoding);
      array.push(renderer.gammaFactor);
    }
    array.push(parameters.customProgramCacheKey);
    return array.join();
  }
  function getUniforms(material) {
    const shaderID = shaderIDs[material.type];
    let uniforms;
    if (shaderID) {
      const shader = ShaderLib[shaderID];
      uniforms = UniformsUtils.clone(shader.uniforms);
    } else {
      uniforms = material.uniforms;
    }
    return uniforms;
  }
  function acquireProgram(parameters, cacheKey) {
    let program;
    for (let p = 0, pl = programs.length; p < pl; p++) {
      const preexistingProgram = programs[p];
      if (preexistingProgram.cacheKey === cacheKey) {
        program = preexistingProgram;
        ++program.usedTimes;
        break;
      }
    }
    if (program === void 0) {
      program = new WebGLProgram(renderer, cacheKey, parameters, bindingStates);
      programs.push(program);
    }
    return program;
  }
  function releaseProgram(program) {
    if (--program.usedTimes === 0) {
      const i = programs.indexOf(program);
      programs[i] = programs[programs.length - 1];
      programs.pop();
      program.destroy();
    }
  }
  return {
    getParameters,
    getProgramCacheKey,
    getUniforms,
    acquireProgram,
    releaseProgram,
    programs
  };
}
function WebGLProperties() {
  let properties = new WeakMap();
  function get2(object) {
    let map = properties.get(object);
    if (map === void 0) {
      map = {};
      properties.set(object, map);
    }
    return map;
  }
  function remove(object) {
    properties.delete(object);
  }
  function update(object, key, value) {
    properties.get(object)[key] = value;
  }
  function dispose() {
    properties = new WeakMap();
  }
  return {
    get: get2,
    remove,
    update,
    dispose
  };
}
function painterSortStable(a, b) {
  if (a.groupOrder !== b.groupOrder) {
    return a.groupOrder - b.groupOrder;
  } else if (a.renderOrder !== b.renderOrder) {
    return a.renderOrder - b.renderOrder;
  } else if (a.program !== b.program) {
    return a.program.id - b.program.id;
  } else if (a.material.id !== b.material.id) {
    return a.material.id - b.material.id;
  } else if (a.z !== b.z) {
    return a.z - b.z;
  } else {
    return a.id - b.id;
  }
}
function reversePainterSortStable(a, b) {
  if (a.groupOrder !== b.groupOrder) {
    return a.groupOrder - b.groupOrder;
  } else if (a.renderOrder !== b.renderOrder) {
    return a.renderOrder - b.renderOrder;
  } else if (a.z !== b.z) {
    return b.z - a.z;
  } else {
    return a.id - b.id;
  }
}
function WebGLRenderList(properties) {
  const renderItems = [];
  let renderItemsIndex = 0;
  const opaque = [];
  const transparent = [];
  const defaultProgram = {id: -1};
  function init2() {
    renderItemsIndex = 0;
    opaque.length = 0;
    transparent.length = 0;
  }
  function getNextRenderItem(object, geometry, material, groupOrder, z, group) {
    let renderItem = renderItems[renderItemsIndex];
    const materialProperties = properties.get(material);
    if (renderItem === void 0) {
      renderItem = {
        id: object.id,
        object,
        geometry,
        material,
        program: materialProperties.program || defaultProgram,
        groupOrder,
        renderOrder: object.renderOrder,
        z,
        group
      };
      renderItems[renderItemsIndex] = renderItem;
    } else {
      renderItem.id = object.id;
      renderItem.object = object;
      renderItem.geometry = geometry;
      renderItem.material = material;
      renderItem.program = materialProperties.program || defaultProgram;
      renderItem.groupOrder = groupOrder;
      renderItem.renderOrder = object.renderOrder;
      renderItem.z = z;
      renderItem.group = group;
    }
    renderItemsIndex++;
    return renderItem;
  }
  function push(object, geometry, material, groupOrder, z, group) {
    const renderItem = getNextRenderItem(object, geometry, material, groupOrder, z, group);
    (material.transparent === true ? transparent : opaque).push(renderItem);
  }
  function unshift(object, geometry, material, groupOrder, z, group) {
    const renderItem = getNextRenderItem(object, geometry, material, groupOrder, z, group);
    (material.transparent === true ? transparent : opaque).unshift(renderItem);
  }
  function sort(customOpaqueSort, customTransparentSort) {
    if (opaque.length > 1)
      opaque.sort(customOpaqueSort || painterSortStable);
    if (transparent.length > 1)
      transparent.sort(customTransparentSort || reversePainterSortStable);
  }
  function finish() {
    for (let i = renderItemsIndex, il = renderItems.length; i < il; i++) {
      const renderItem = renderItems[i];
      if (renderItem.id === null)
        break;
      renderItem.id = null;
      renderItem.object = null;
      renderItem.geometry = null;
      renderItem.material = null;
      renderItem.program = null;
      renderItem.group = null;
    }
  }
  return {
    opaque,
    transparent,
    init: init2,
    push,
    unshift,
    finish,
    sort
  };
}
function WebGLRenderLists(properties) {
  let lists = new WeakMap();
  function get2(scene, renderCallDepth) {
    let list;
    if (lists.has(scene) === false) {
      list = new WebGLRenderList(properties);
      lists.set(scene, [list]);
    } else {
      if (renderCallDepth >= lists.get(scene).length) {
        list = new WebGLRenderList(properties);
        lists.get(scene).push(list);
      } else {
        list = lists.get(scene)[renderCallDepth];
      }
    }
    return list;
  }
  function dispose() {
    lists = new WeakMap();
  }
  return {
    get: get2,
    dispose
  };
}
function UniformsCache() {
  const lights = {};
  return {
    get: function(light) {
      if (lights[light.id] !== void 0) {
        return lights[light.id];
      }
      let uniforms;
      switch (light.type) {
        case "DirectionalLight":
          uniforms = {
            direction: new Vector3(),
            color: new Color()
          };
          break;
        case "SpotLight":
          uniforms = {
            position: new Vector3(),
            direction: new Vector3(),
            color: new Color(),
            distance: 0,
            coneCos: 0,
            penumbraCos: 0,
            decay: 0
          };
          break;
        case "PointLight":
          uniforms = {
            position: new Vector3(),
            color: new Color(),
            distance: 0,
            decay: 0
          };
          break;
        case "HemisphereLight":
          uniforms = {
            direction: new Vector3(),
            skyColor: new Color(),
            groundColor: new Color()
          };
          break;
        case "RectAreaLight":
          uniforms = {
            color: new Color(),
            position: new Vector3(),
            halfWidth: new Vector3(),
            halfHeight: new Vector3()
          };
          break;
      }
      lights[light.id] = uniforms;
      return uniforms;
    }
  };
}
function ShadowUniformsCache() {
  const lights = {};
  return {
    get: function(light) {
      if (lights[light.id] !== void 0) {
        return lights[light.id];
      }
      let uniforms;
      switch (light.type) {
        case "DirectionalLight":
          uniforms = {
            shadowBias: 0,
            shadowNormalBias: 0,
            shadowRadius: 1,
            shadowMapSize: new Vector2()
          };
          break;
        case "SpotLight":
          uniforms = {
            shadowBias: 0,
            shadowNormalBias: 0,
            shadowRadius: 1,
            shadowMapSize: new Vector2()
          };
          break;
        case "PointLight":
          uniforms = {
            shadowBias: 0,
            shadowNormalBias: 0,
            shadowRadius: 1,
            shadowMapSize: new Vector2(),
            shadowCameraNear: 1,
            shadowCameraFar: 1e3
          };
          break;
      }
      lights[light.id] = uniforms;
      return uniforms;
    }
  };
}
let nextVersion = 0;
function shadowCastingLightsFirst(lightA, lightB) {
  return (lightB.castShadow ? 1 : 0) - (lightA.castShadow ? 1 : 0);
}
function WebGLLights(extensions, capabilities) {
  const cache = new UniformsCache();
  const shadowCache = ShadowUniformsCache();
  const state = {
    version: 0,
    hash: {
      directionalLength: -1,
      pointLength: -1,
      spotLength: -1,
      rectAreaLength: -1,
      hemiLength: -1,
      numDirectionalShadows: -1,
      numPointShadows: -1,
      numSpotShadows: -1
    },
    ambient: [0, 0, 0],
    probe: [],
    directional: [],
    directionalShadow: [],
    directionalShadowMap: [],
    directionalShadowMatrix: [],
    spot: [],
    spotShadow: [],
    spotShadowMap: [],
    spotShadowMatrix: [],
    rectArea: [],
    rectAreaLTC1: null,
    rectAreaLTC2: null,
    point: [],
    pointShadow: [],
    pointShadowMap: [],
    pointShadowMatrix: [],
    hemi: []
  };
  for (let i = 0; i < 9; i++)
    state.probe.push(new Vector3());
  const vector3 = new Vector3();
  const matrix4 = new Matrix4();
  const matrix42 = new Matrix4();
  function setup(lights) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 9; i++)
      state.probe[i].set(0, 0, 0);
    let directionalLength = 0;
    let pointLength = 0;
    let spotLength = 0;
    let rectAreaLength = 0;
    let hemiLength = 0;
    let numDirectionalShadows = 0;
    let numPointShadows = 0;
    let numSpotShadows = 0;
    lights.sort(shadowCastingLightsFirst);
    for (let i = 0, l = lights.length; i < l; i++) {
      const light = lights[i];
      const color = light.color;
      const intensity = light.intensity;
      const distance = light.distance;
      const shadowMap = light.shadow && light.shadow.map ? light.shadow.map.texture : null;
      if (light.isAmbientLight) {
        r += color.r * intensity;
        g += color.g * intensity;
        b += color.b * intensity;
      } else if (light.isLightProbe) {
        for (let j = 0; j < 9; j++) {
          state.probe[j].addScaledVector(light.sh.coefficients[j], intensity);
        }
      } else if (light.isDirectionalLight) {
        const uniforms = cache.get(light);
        uniforms.color.copy(light.color).multiplyScalar(light.intensity);
        if (light.castShadow) {
          const shadow = light.shadow;
          const shadowUniforms = shadowCache.get(light);
          shadowUniforms.shadowBias = shadow.bias;
          shadowUniforms.shadowNormalBias = shadow.normalBias;
          shadowUniforms.shadowRadius = shadow.radius;
          shadowUniforms.shadowMapSize = shadow.mapSize;
          state.directionalShadow[directionalLength] = shadowUniforms;
          state.directionalShadowMap[directionalLength] = shadowMap;
          state.directionalShadowMatrix[directionalLength] = light.shadow.matrix;
          numDirectionalShadows++;
        }
        state.directional[directionalLength] = uniforms;
        directionalLength++;
      } else if (light.isSpotLight) {
        const uniforms = cache.get(light);
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.color.copy(color).multiplyScalar(intensity);
        uniforms.distance = distance;
        uniforms.coneCos = Math.cos(light.angle);
        uniforms.penumbraCos = Math.cos(light.angle * (1 - light.penumbra));
        uniforms.decay = light.decay;
        if (light.castShadow) {
          const shadow = light.shadow;
          const shadowUniforms = shadowCache.get(light);
          shadowUniforms.shadowBias = shadow.bias;
          shadowUniforms.shadowNormalBias = shadow.normalBias;
          shadowUniforms.shadowRadius = shadow.radius;
          shadowUniforms.shadowMapSize = shadow.mapSize;
          state.spotShadow[spotLength] = shadowUniforms;
          state.spotShadowMap[spotLength] = shadowMap;
          state.spotShadowMatrix[spotLength] = light.shadow.matrix;
          numSpotShadows++;
        }
        state.spot[spotLength] = uniforms;
        spotLength++;
      } else if (light.isRectAreaLight) {
        const uniforms = cache.get(light);
        uniforms.color.copy(color).multiplyScalar(intensity);
        uniforms.halfWidth.set(light.width * 0.5, 0, 0);
        uniforms.halfHeight.set(0, light.height * 0.5, 0);
        state.rectArea[rectAreaLength] = uniforms;
        rectAreaLength++;
      } else if (light.isPointLight) {
        const uniforms = cache.get(light);
        uniforms.color.copy(light.color).multiplyScalar(light.intensity);
        uniforms.distance = light.distance;
        uniforms.decay = light.decay;
        if (light.castShadow) {
          const shadow = light.shadow;
          const shadowUniforms = shadowCache.get(light);
          shadowUniforms.shadowBias = shadow.bias;
          shadowUniforms.shadowNormalBias = shadow.normalBias;
          shadowUniforms.shadowRadius = shadow.radius;
          shadowUniforms.shadowMapSize = shadow.mapSize;
          shadowUniforms.shadowCameraNear = shadow.camera.near;
          shadowUniforms.shadowCameraFar = shadow.camera.far;
          state.pointShadow[pointLength] = shadowUniforms;
          state.pointShadowMap[pointLength] = shadowMap;
          state.pointShadowMatrix[pointLength] = light.shadow.matrix;
          numPointShadows++;
        }
        state.point[pointLength] = uniforms;
        pointLength++;
      } else if (light.isHemisphereLight) {
        const uniforms = cache.get(light);
        uniforms.skyColor.copy(light.color).multiplyScalar(intensity);
        uniforms.groundColor.copy(light.groundColor).multiplyScalar(intensity);
        state.hemi[hemiLength] = uniforms;
        hemiLength++;
      }
    }
    if (rectAreaLength > 0) {
      if (capabilities.isWebGL2) {
        state.rectAreaLTC1 = UniformsLib.LTC_FLOAT_1;
        state.rectAreaLTC2 = UniformsLib.LTC_FLOAT_2;
      } else {
        if (extensions.has("OES_texture_float_linear") === true) {
          state.rectAreaLTC1 = UniformsLib.LTC_FLOAT_1;
          state.rectAreaLTC2 = UniformsLib.LTC_FLOAT_2;
        } else if (extensions.has("OES_texture_half_float_linear") === true) {
          state.rectAreaLTC1 = UniformsLib.LTC_HALF_1;
          state.rectAreaLTC2 = UniformsLib.LTC_HALF_2;
        } else {
          console.error("THREE.WebGLRenderer: Unable to use RectAreaLight. Missing WebGL extensions.");
        }
      }
    }
    state.ambient[0] = r;
    state.ambient[1] = g;
    state.ambient[2] = b;
    const hash = state.hash;
    if (hash.directionalLength !== directionalLength || hash.pointLength !== pointLength || hash.spotLength !== spotLength || hash.rectAreaLength !== rectAreaLength || hash.hemiLength !== hemiLength || hash.numDirectionalShadows !== numDirectionalShadows || hash.numPointShadows !== numPointShadows || hash.numSpotShadows !== numSpotShadows) {
      state.directional.length = directionalLength;
      state.spot.length = spotLength;
      state.rectArea.length = rectAreaLength;
      state.point.length = pointLength;
      state.hemi.length = hemiLength;
      state.directionalShadow.length = numDirectionalShadows;
      state.directionalShadowMap.length = numDirectionalShadows;
      state.pointShadow.length = numPointShadows;
      state.pointShadowMap.length = numPointShadows;
      state.spotShadow.length = numSpotShadows;
      state.spotShadowMap.length = numSpotShadows;
      state.directionalShadowMatrix.length = numDirectionalShadows;
      state.pointShadowMatrix.length = numPointShadows;
      state.spotShadowMatrix.length = numSpotShadows;
      hash.directionalLength = directionalLength;
      hash.pointLength = pointLength;
      hash.spotLength = spotLength;
      hash.rectAreaLength = rectAreaLength;
      hash.hemiLength = hemiLength;
      hash.numDirectionalShadows = numDirectionalShadows;
      hash.numPointShadows = numPointShadows;
      hash.numSpotShadows = numSpotShadows;
      state.version = nextVersion++;
    }
  }
  function setupView(lights, camera) {
    let directionalLength = 0;
    let pointLength = 0;
    let spotLength = 0;
    let rectAreaLength = 0;
    let hemiLength = 0;
    const viewMatrix = camera.matrixWorldInverse;
    for (let i = 0, l = lights.length; i < l; i++) {
      const light = lights[i];
      if (light.isDirectionalLight) {
        const uniforms = state.directional[directionalLength];
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        vector3.setFromMatrixPosition(light.target.matrixWorld);
        uniforms.direction.sub(vector3);
        uniforms.direction.transformDirection(viewMatrix);
        directionalLength++;
      } else if (light.isSpotLight) {
        const uniforms = state.spot[spotLength];
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        vector3.setFromMatrixPosition(light.target.matrixWorld);
        uniforms.direction.sub(vector3);
        uniforms.direction.transformDirection(viewMatrix);
        spotLength++;
      } else if (light.isRectAreaLight) {
        const uniforms = state.rectArea[rectAreaLength];
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
        matrix42.identity();
        matrix4.copy(light.matrixWorld);
        matrix4.premultiply(viewMatrix);
        matrix42.extractRotation(matrix4);
        uniforms.halfWidth.set(light.width * 0.5, 0, 0);
        uniforms.halfHeight.set(0, light.height * 0.5, 0);
        uniforms.halfWidth.applyMatrix4(matrix42);
        uniforms.halfHeight.applyMatrix4(matrix42);
        rectAreaLength++;
      } else if (light.isPointLight) {
        const uniforms = state.point[pointLength];
        uniforms.position.setFromMatrixPosition(light.matrixWorld);
        uniforms.position.applyMatrix4(viewMatrix);
        pointLength++;
      } else if (light.isHemisphereLight) {
        const uniforms = state.hemi[hemiLength];
        uniforms.direction.setFromMatrixPosition(light.matrixWorld);
        uniforms.direction.transformDirection(viewMatrix);
        uniforms.direction.normalize();
        hemiLength++;
      }
    }
  }
  return {
    setup,
    setupView,
    state
  };
}
function WebGLRenderState(extensions, capabilities) {
  const lights = new WebGLLights(extensions, capabilities);
  const lightsArray = [];
  const shadowsArray = [];
  function init2() {
    lightsArray.length = 0;
    shadowsArray.length = 0;
  }
  function pushLight(light) {
    lightsArray.push(light);
  }
  function pushShadow(shadowLight) {
    shadowsArray.push(shadowLight);
  }
  function setupLights() {
    lights.setup(lightsArray);
  }
  function setupLightsView(camera) {
    lights.setupView(lightsArray, camera);
  }
  const state = {
    lightsArray,
    shadowsArray,
    lights
  };
  return {
    init: init2,
    state,
    setupLights,
    setupLightsView,
    pushLight,
    pushShadow
  };
}
function WebGLRenderStates(extensions, capabilities) {
  let renderStates = new WeakMap();
  function get2(scene, renderCallDepth = 0) {
    let renderState;
    if (renderStates.has(scene) === false) {
      renderState = new WebGLRenderState(extensions, capabilities);
      renderStates.set(scene, [renderState]);
    } else {
      if (renderCallDepth >= renderStates.get(scene).length) {
        renderState = new WebGLRenderState(extensions, capabilities);
        renderStates.get(scene).push(renderState);
      } else {
        renderState = renderStates.get(scene)[renderCallDepth];
      }
    }
    return renderState;
  }
  function dispose() {
    renderStates = new WeakMap();
  }
  return {
    get: get2,
    dispose
  };
}
class MeshDepthMaterial extends Material {
  constructor(parameters) {
    super();
    this.type = "MeshDepthMaterial";
    this.depthPacking = BasicDepthPacking;
    this.skinning = false;
    this.morphTargets = false;
    this.map = null;
    this.alphaMap = null;
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.fog = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.depthPacking = source.depthPacking;
    this.skinning = source.skinning;
    this.morphTargets = source.morphTargets;
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    return this;
  }
}
MeshDepthMaterial.prototype.isMeshDepthMaterial = true;
class MeshDistanceMaterial extends Material {
  constructor(parameters) {
    super();
    this.type = "MeshDistanceMaterial";
    this.referencePosition = new Vector3();
    this.nearDistance = 1;
    this.farDistance = 1e3;
    this.skinning = false;
    this.morphTargets = false;
    this.map = null;
    this.alphaMap = null;
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.fog = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.referencePosition.copy(source.referencePosition);
    this.nearDistance = source.nearDistance;
    this.farDistance = source.farDistance;
    this.skinning = source.skinning;
    this.morphTargets = source.morphTargets;
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    return this;
  }
}
MeshDistanceMaterial.prototype.isMeshDistanceMaterial = true;
var vsm_frag = "uniform sampler2D shadow_pass;\nuniform vec2 resolution;\nuniform float radius;\n#include <packing>\nvoid main() {\n	float mean = 0.0;\n	float squared_mean = 0.0;\n	float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy ) / resolution ) );\n	for ( float i = -1.0; i < 1.0 ; i += SAMPLE_RATE) {\n		#ifdef HORIZONTAL_PASS\n			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( i, 0.0 ) * radius ) / resolution ) );\n			mean += distribution.x;\n			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;\n		#else\n			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, i ) * radius ) / resolution ) );\n			mean += depth;\n			squared_mean += depth * depth;\n		#endif\n	}\n	mean = mean * HALF_SAMPLE_RATE;\n	squared_mean = squared_mean * HALF_SAMPLE_RATE;\n	float std_dev = sqrt( squared_mean - mean * mean );\n	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );\n}";
var vsm_vert = "void main() {\n	gl_Position = vec4( position, 1.0 );\n}";
function WebGLShadowMap(_renderer, _objects, maxTextureSize) {
  let _frustum = new Frustum();
  const _shadowMapSize = new Vector2(), _viewportSize = new Vector2(), _viewport = new Vector4(), _depthMaterials = [], _distanceMaterials = [], _materialCache = {};
  const shadowSide = {0: BackSide, 1: FrontSide, 2: DoubleSide};
  const shadowMaterialVertical = new ShaderMaterial({
    defines: {
      SAMPLE_RATE: 2 / 8,
      HALF_SAMPLE_RATE: 1 / 8
    },
    uniforms: {
      shadow_pass: {value: null},
      resolution: {value: new Vector2()},
      radius: {value: 4}
    },
    vertexShader: vsm_vert,
    fragmentShader: vsm_frag
  });
  const shadowMaterialHorizontal = shadowMaterialVertical.clone();
  shadowMaterialHorizontal.defines.HORIZONTAL_PASS = 1;
  const fullScreenTri = new BufferGeometry();
  fullScreenTri.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5]), 3));
  const fullScreenMesh = new Mesh(fullScreenTri, shadowMaterialVertical);
  const scope = this;
  this.enabled = false;
  this.autoUpdate = true;
  this.needsUpdate = false;
  this.type = PCFShadowMap;
  this.render = function(lights, scene, camera) {
    if (scope.enabled === false)
      return;
    if (scope.autoUpdate === false && scope.needsUpdate === false)
      return;
    if (lights.length === 0)
      return;
    const currentRenderTarget = _renderer.getRenderTarget();
    const activeCubeFace = _renderer.getActiveCubeFace();
    const activeMipmapLevel = _renderer.getActiveMipmapLevel();
    const _state = _renderer.state;
    _state.setBlending(NoBlending);
    _state.buffers.color.setClear(1, 1, 1, 1);
    _state.buffers.depth.setTest(true);
    _state.setScissorTest(false);
    for (let i = 0, il = lights.length; i < il; i++) {
      const light = lights[i];
      const shadow = light.shadow;
      if (shadow === void 0) {
        console.warn("THREE.WebGLShadowMap:", light, "has no shadow.");
        continue;
      }
      if (shadow.autoUpdate === false && shadow.needsUpdate === false)
        continue;
      _shadowMapSize.copy(shadow.mapSize);
      const shadowFrameExtents = shadow.getFrameExtents();
      _shadowMapSize.multiply(shadowFrameExtents);
      _viewportSize.copy(shadow.mapSize);
      if (_shadowMapSize.x > maxTextureSize || _shadowMapSize.y > maxTextureSize) {
        if (_shadowMapSize.x > maxTextureSize) {
          _viewportSize.x = Math.floor(maxTextureSize / shadowFrameExtents.x);
          _shadowMapSize.x = _viewportSize.x * shadowFrameExtents.x;
          shadow.mapSize.x = _viewportSize.x;
        }
        if (_shadowMapSize.y > maxTextureSize) {
          _viewportSize.y = Math.floor(maxTextureSize / shadowFrameExtents.y);
          _shadowMapSize.y = _viewportSize.y * shadowFrameExtents.y;
          shadow.mapSize.y = _viewportSize.y;
        }
      }
      if (shadow.map === null && !shadow.isPointLightShadow && this.type === VSMShadowMap) {
        const pars = {minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat};
        shadow.map = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y, pars);
        shadow.map.texture.name = light.name + ".shadowMap";
        shadow.mapPass = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y, pars);
        shadow.camera.updateProjectionMatrix();
      }
      if (shadow.map === null) {
        const pars = {minFilter: NearestFilter, magFilter: NearestFilter, format: RGBAFormat};
        shadow.map = new WebGLRenderTarget(_shadowMapSize.x, _shadowMapSize.y, pars);
        shadow.map.texture.name = light.name + ".shadowMap";
        shadow.camera.updateProjectionMatrix();
      }
      _renderer.setRenderTarget(shadow.map);
      _renderer.clear();
      const viewportCount = shadow.getViewportCount();
      for (let vp = 0; vp < viewportCount; vp++) {
        const viewport = shadow.getViewport(vp);
        _viewport.set(_viewportSize.x * viewport.x, _viewportSize.y * viewport.y, _viewportSize.x * viewport.z, _viewportSize.y * viewport.w);
        _state.viewport(_viewport);
        shadow.updateMatrices(light, vp);
        _frustum = shadow.getFrustum();
        renderObject(scene, camera, shadow.camera, light, this.type);
      }
      if (!shadow.isPointLightShadow && this.type === VSMShadowMap) {
        VSMPass(shadow, camera);
      }
      shadow.needsUpdate = false;
    }
    scope.needsUpdate = false;
    _renderer.setRenderTarget(currentRenderTarget, activeCubeFace, activeMipmapLevel);
  };
  function VSMPass(shadow, camera) {
    const geometry = _objects.update(fullScreenMesh);
    shadowMaterialVertical.uniforms.shadow_pass.value = shadow.map.texture;
    shadowMaterialVertical.uniforms.resolution.value = shadow.mapSize;
    shadowMaterialVertical.uniforms.radius.value = shadow.radius;
    _renderer.setRenderTarget(shadow.mapPass);
    _renderer.clear();
    _renderer.renderBufferDirect(camera, null, geometry, shadowMaterialVertical, fullScreenMesh, null);
    shadowMaterialHorizontal.uniforms.shadow_pass.value = shadow.mapPass.texture;
    shadowMaterialHorizontal.uniforms.resolution.value = shadow.mapSize;
    shadowMaterialHorizontal.uniforms.radius.value = shadow.radius;
    _renderer.setRenderTarget(shadow.map);
    _renderer.clear();
    _renderer.renderBufferDirect(camera, null, geometry, shadowMaterialHorizontal, fullScreenMesh, null);
  }
  function getDepthMaterialVariant(useMorphing, useSkinning, useInstancing) {
    const index2 = useMorphing << 0 | useSkinning << 1 | useInstancing << 2;
    let material = _depthMaterials[index2];
    if (material === void 0) {
      material = new MeshDepthMaterial({
        depthPacking: RGBADepthPacking,
        morphTargets: useMorphing,
        skinning: useSkinning
      });
      _depthMaterials[index2] = material;
    }
    return material;
  }
  function getDistanceMaterialVariant(useMorphing, useSkinning, useInstancing) {
    const index2 = useMorphing << 0 | useSkinning << 1 | useInstancing << 2;
    let material = _distanceMaterials[index2];
    if (material === void 0) {
      material = new MeshDistanceMaterial({
        morphTargets: useMorphing,
        skinning: useSkinning
      });
      _distanceMaterials[index2] = material;
    }
    return material;
  }
  function getDepthMaterial(object, geometry, material, light, shadowCameraNear, shadowCameraFar, type) {
    let result = null;
    let getMaterialVariant = getDepthMaterialVariant;
    let customMaterial = object.customDepthMaterial;
    if (light.isPointLight === true) {
      getMaterialVariant = getDistanceMaterialVariant;
      customMaterial = object.customDistanceMaterial;
    }
    if (customMaterial === void 0) {
      let useMorphing = false;
      if (material.morphTargets === true) {
        useMorphing = geometry.morphAttributes && geometry.morphAttributes.position && geometry.morphAttributes.position.length > 0;
      }
      let useSkinning = false;
      if (object.isSkinnedMesh === true) {
        if (material.skinning === true) {
          useSkinning = true;
        } else {
          console.warn("THREE.WebGLShadowMap: THREE.SkinnedMesh with material.skinning set to false:", object);
        }
      }
      const useInstancing = object.isInstancedMesh === true;
      result = getMaterialVariant(useMorphing, useSkinning, useInstancing);
    } else {
      result = customMaterial;
    }
    if (_renderer.localClippingEnabled && material.clipShadows === true && material.clippingPlanes.length !== 0) {
      const keyA = result.uuid, keyB = material.uuid;
      let materialsForVariant = _materialCache[keyA];
      if (materialsForVariant === void 0) {
        materialsForVariant = {};
        _materialCache[keyA] = materialsForVariant;
      }
      let cachedMaterial = materialsForVariant[keyB];
      if (cachedMaterial === void 0) {
        cachedMaterial = result.clone();
        materialsForVariant[keyB] = cachedMaterial;
      }
      result = cachedMaterial;
    }
    result.visible = material.visible;
    result.wireframe = material.wireframe;
    if (type === VSMShadowMap) {
      result.side = material.shadowSide !== null ? material.shadowSide : material.side;
    } else {
      result.side = material.shadowSide !== null ? material.shadowSide : shadowSide[material.side];
    }
    result.clipShadows = material.clipShadows;
    result.clippingPlanes = material.clippingPlanes;
    result.clipIntersection = material.clipIntersection;
    result.wireframeLinewidth = material.wireframeLinewidth;
    result.linewidth = material.linewidth;
    if (light.isPointLight === true && result.isMeshDistanceMaterial === true) {
      result.referencePosition.setFromMatrixPosition(light.matrixWorld);
      result.nearDistance = shadowCameraNear;
      result.farDistance = shadowCameraFar;
    }
    return result;
  }
  function renderObject(object, camera, shadowCamera, light, type) {
    if (object.visible === false)
      return;
    const visible = object.layers.test(camera.layers);
    if (visible && (object.isMesh || object.isLine || object.isPoints)) {
      if ((object.castShadow || object.receiveShadow && type === VSMShadowMap) && (!object.frustumCulled || _frustum.intersectsObject(object))) {
        object.modelViewMatrix.multiplyMatrices(shadowCamera.matrixWorldInverse, object.matrixWorld);
        const geometry = _objects.update(object);
        const material = object.material;
        if (Array.isArray(material)) {
          const groups = geometry.groups;
          for (let k = 0, kl = groups.length; k < kl; k++) {
            const group = groups[k];
            const groupMaterial = material[group.materialIndex];
            if (groupMaterial && groupMaterial.visible) {
              const depthMaterial = getDepthMaterial(object, geometry, groupMaterial, light, shadowCamera.near, shadowCamera.far, type);
              _renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, group);
            }
          }
        } else if (material.visible) {
          const depthMaterial = getDepthMaterial(object, geometry, material, light, shadowCamera.near, shadowCamera.far, type);
          _renderer.renderBufferDirect(shadowCamera, null, geometry, depthMaterial, object, null);
        }
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      renderObject(children[i], camera, shadowCamera, light, type);
    }
  }
}
function WebGLState(gl, extensions, capabilities) {
  const isWebGL2 = capabilities.isWebGL2;
  function ColorBuffer() {
    let locked = false;
    const color = new Vector4();
    let currentColorMask = null;
    const currentColorClear = new Vector4(0, 0, 0, 0);
    return {
      setMask: function(colorMask) {
        if (currentColorMask !== colorMask && !locked) {
          gl.colorMask(colorMask, colorMask, colorMask, colorMask);
          currentColorMask = colorMask;
        }
      },
      setLocked: function(lock) {
        locked = lock;
      },
      setClear: function(r, g, b, a, premultipliedAlpha) {
        if (premultipliedAlpha === true) {
          r *= a;
          g *= a;
          b *= a;
        }
        color.set(r, g, b, a);
        if (currentColorClear.equals(color) === false) {
          gl.clearColor(r, g, b, a);
          currentColorClear.copy(color);
        }
      },
      reset: function() {
        locked = false;
        currentColorMask = null;
        currentColorClear.set(-1, 0, 0, 0);
      }
    };
  }
  function DepthBuffer() {
    let locked = false;
    let currentDepthMask = null;
    let currentDepthFunc = null;
    let currentDepthClear = null;
    return {
      setTest: function(depthTest) {
        if (depthTest) {
          enable(2929);
        } else {
          disable(2929);
        }
      },
      setMask: function(depthMask) {
        if (currentDepthMask !== depthMask && !locked) {
          gl.depthMask(depthMask);
          currentDepthMask = depthMask;
        }
      },
      setFunc: function(depthFunc) {
        if (currentDepthFunc !== depthFunc) {
          if (depthFunc) {
            switch (depthFunc) {
              case NeverDepth:
                gl.depthFunc(512);
                break;
              case AlwaysDepth:
                gl.depthFunc(519);
                break;
              case LessDepth:
                gl.depthFunc(513);
                break;
              case LessEqualDepth:
                gl.depthFunc(515);
                break;
              case EqualDepth:
                gl.depthFunc(514);
                break;
              case GreaterEqualDepth:
                gl.depthFunc(518);
                break;
              case GreaterDepth:
                gl.depthFunc(516);
                break;
              case NotEqualDepth:
                gl.depthFunc(517);
                break;
              default:
                gl.depthFunc(515);
            }
          } else {
            gl.depthFunc(515);
          }
          currentDepthFunc = depthFunc;
        }
      },
      setLocked: function(lock) {
        locked = lock;
      },
      setClear: function(depth) {
        if (currentDepthClear !== depth) {
          gl.clearDepth(depth);
          currentDepthClear = depth;
        }
      },
      reset: function() {
        locked = false;
        currentDepthMask = null;
        currentDepthFunc = null;
        currentDepthClear = null;
      }
    };
  }
  function StencilBuffer() {
    let locked = false;
    let currentStencilMask = null;
    let currentStencilFunc = null;
    let currentStencilRef = null;
    let currentStencilFuncMask = null;
    let currentStencilFail = null;
    let currentStencilZFail = null;
    let currentStencilZPass = null;
    let currentStencilClear = null;
    return {
      setTest: function(stencilTest) {
        if (!locked) {
          if (stencilTest) {
            enable(2960);
          } else {
            disable(2960);
          }
        }
      },
      setMask: function(stencilMask) {
        if (currentStencilMask !== stencilMask && !locked) {
          gl.stencilMask(stencilMask);
          currentStencilMask = stencilMask;
        }
      },
      setFunc: function(stencilFunc, stencilRef, stencilMask) {
        if (currentStencilFunc !== stencilFunc || currentStencilRef !== stencilRef || currentStencilFuncMask !== stencilMask) {
          gl.stencilFunc(stencilFunc, stencilRef, stencilMask);
          currentStencilFunc = stencilFunc;
          currentStencilRef = stencilRef;
          currentStencilFuncMask = stencilMask;
        }
      },
      setOp: function(stencilFail, stencilZFail, stencilZPass) {
        if (currentStencilFail !== stencilFail || currentStencilZFail !== stencilZFail || currentStencilZPass !== stencilZPass) {
          gl.stencilOp(stencilFail, stencilZFail, stencilZPass);
          currentStencilFail = stencilFail;
          currentStencilZFail = stencilZFail;
          currentStencilZPass = stencilZPass;
        }
      },
      setLocked: function(lock) {
        locked = lock;
      },
      setClear: function(stencil) {
        if (currentStencilClear !== stencil) {
          gl.clearStencil(stencil);
          currentStencilClear = stencil;
        }
      },
      reset: function() {
        locked = false;
        currentStencilMask = null;
        currentStencilFunc = null;
        currentStencilRef = null;
        currentStencilFuncMask = null;
        currentStencilFail = null;
        currentStencilZFail = null;
        currentStencilZPass = null;
        currentStencilClear = null;
      }
    };
  }
  const colorBuffer = new ColorBuffer();
  const depthBuffer = new DepthBuffer();
  const stencilBuffer = new StencilBuffer();
  let enabledCapabilities = {};
  let currentProgram = null;
  let currentBlendingEnabled = false;
  let currentBlending = null;
  let currentBlendEquation = null;
  let currentBlendSrc = null;
  let currentBlendDst = null;
  let currentBlendEquationAlpha = null;
  let currentBlendSrcAlpha = null;
  let currentBlendDstAlpha = null;
  let currentPremultipledAlpha = false;
  let currentFlipSided = null;
  let currentCullFace = null;
  let currentLineWidth = null;
  let currentPolygonOffsetFactor = null;
  let currentPolygonOffsetUnits = null;
  const maxTextures = gl.getParameter(35661);
  let lineWidthAvailable = false;
  let version = 0;
  const glVersion = gl.getParameter(7938);
  if (glVersion.indexOf("WebGL") !== -1) {
    version = parseFloat(/^WebGL (\d)/.exec(glVersion)[1]);
    lineWidthAvailable = version >= 1;
  } else if (glVersion.indexOf("OpenGL ES") !== -1) {
    version = parseFloat(/^OpenGL ES (\d)/.exec(glVersion)[1]);
    lineWidthAvailable = version >= 2;
  }
  let currentTextureSlot = null;
  let currentBoundTextures = {};
  const currentScissor = new Vector4();
  const currentViewport = new Vector4();
  function createTexture(type, target, count) {
    const data = new Uint8Array(4);
    const texture = gl.createTexture();
    gl.bindTexture(type, texture);
    gl.texParameteri(type, 10241, 9728);
    gl.texParameteri(type, 10240, 9728);
    for (let i = 0; i < count; i++) {
      gl.texImage2D(target + i, 0, 6408, 1, 1, 0, 6408, 5121, data);
    }
    return texture;
  }
  const emptyTextures = {};
  emptyTextures[3553] = createTexture(3553, 3553, 1);
  emptyTextures[34067] = createTexture(34067, 34069, 6);
  colorBuffer.setClear(0, 0, 0, 1);
  depthBuffer.setClear(1);
  stencilBuffer.setClear(0);
  enable(2929);
  depthBuffer.setFunc(LessEqualDepth);
  setFlipSided(false);
  setCullFace(CullFaceBack);
  enable(2884);
  setBlending(NoBlending);
  function enable(id) {
    if (enabledCapabilities[id] !== true) {
      gl.enable(id);
      enabledCapabilities[id] = true;
    }
  }
  function disable(id) {
    if (enabledCapabilities[id] !== false) {
      gl.disable(id);
      enabledCapabilities[id] = false;
    }
  }
  function useProgram(program) {
    if (currentProgram !== program) {
      gl.useProgram(program);
      currentProgram = program;
      return true;
    }
    return false;
  }
  const equationToGL = {
    [AddEquation]: 32774,
    [SubtractEquation]: 32778,
    [ReverseSubtractEquation]: 32779
  };
  if (isWebGL2) {
    equationToGL[MinEquation] = 32775;
    equationToGL[MaxEquation] = 32776;
  } else {
    const extension = extensions.get("EXT_blend_minmax");
    if (extension !== null) {
      equationToGL[MinEquation] = extension.MIN_EXT;
      equationToGL[MaxEquation] = extension.MAX_EXT;
    }
  }
  const factorToGL = {
    [ZeroFactor]: 0,
    [OneFactor]: 1,
    [SrcColorFactor]: 768,
    [SrcAlphaFactor]: 770,
    [SrcAlphaSaturateFactor]: 776,
    [DstColorFactor]: 774,
    [DstAlphaFactor]: 772,
    [OneMinusSrcColorFactor]: 769,
    [OneMinusSrcAlphaFactor]: 771,
    [OneMinusDstColorFactor]: 775,
    [OneMinusDstAlphaFactor]: 773
  };
  function setBlending(blending, blendEquation, blendSrc, blendDst, blendEquationAlpha, blendSrcAlpha, blendDstAlpha, premultipliedAlpha) {
    if (blending === NoBlending) {
      if (currentBlendingEnabled === true) {
        disable(3042);
        currentBlendingEnabled = false;
      }
      return;
    }
    if (currentBlendingEnabled === false) {
      enable(3042);
      currentBlendingEnabled = true;
    }
    if (blending !== CustomBlending) {
      if (blending !== currentBlending || premultipliedAlpha !== currentPremultipledAlpha) {
        if (currentBlendEquation !== AddEquation || currentBlendEquationAlpha !== AddEquation) {
          gl.blendEquation(32774);
          currentBlendEquation = AddEquation;
          currentBlendEquationAlpha = AddEquation;
        }
        if (premultipliedAlpha) {
          switch (blending) {
            case NormalBlending:
              gl.blendFuncSeparate(1, 771, 1, 771);
              break;
            case AdditiveBlending:
              gl.blendFunc(1, 1);
              break;
            case SubtractiveBlending:
              gl.blendFuncSeparate(0, 0, 769, 771);
              break;
            case MultiplyBlending:
              gl.blendFuncSeparate(0, 768, 0, 770);
              break;
            default:
              console.error("THREE.WebGLState: Invalid blending: ", blending);
              break;
          }
        } else {
          switch (blending) {
            case NormalBlending:
              gl.blendFuncSeparate(770, 771, 1, 771);
              break;
            case AdditiveBlending:
              gl.blendFunc(770, 1);
              break;
            case SubtractiveBlending:
              gl.blendFunc(0, 769);
              break;
            case MultiplyBlending:
              gl.blendFunc(0, 768);
              break;
            default:
              console.error("THREE.WebGLState: Invalid blending: ", blending);
              break;
          }
        }
        currentBlendSrc = null;
        currentBlendDst = null;
        currentBlendSrcAlpha = null;
        currentBlendDstAlpha = null;
        currentBlending = blending;
        currentPremultipledAlpha = premultipliedAlpha;
      }
      return;
    }
    blendEquationAlpha = blendEquationAlpha || blendEquation;
    blendSrcAlpha = blendSrcAlpha || blendSrc;
    blendDstAlpha = blendDstAlpha || blendDst;
    if (blendEquation !== currentBlendEquation || blendEquationAlpha !== currentBlendEquationAlpha) {
      gl.blendEquationSeparate(equationToGL[blendEquation], equationToGL[blendEquationAlpha]);
      currentBlendEquation = blendEquation;
      currentBlendEquationAlpha = blendEquationAlpha;
    }
    if (blendSrc !== currentBlendSrc || blendDst !== currentBlendDst || blendSrcAlpha !== currentBlendSrcAlpha || blendDstAlpha !== currentBlendDstAlpha) {
      gl.blendFuncSeparate(factorToGL[blendSrc], factorToGL[blendDst], factorToGL[blendSrcAlpha], factorToGL[blendDstAlpha]);
      currentBlendSrc = blendSrc;
      currentBlendDst = blendDst;
      currentBlendSrcAlpha = blendSrcAlpha;
      currentBlendDstAlpha = blendDstAlpha;
    }
    currentBlending = blending;
    currentPremultipledAlpha = null;
  }
  function setMaterial(material, frontFaceCW) {
    material.side === DoubleSide ? disable(2884) : enable(2884);
    let flipSided = material.side === BackSide;
    if (frontFaceCW)
      flipSided = !flipSided;
    setFlipSided(flipSided);
    material.blending === NormalBlending && material.transparent === false ? setBlending(NoBlending) : setBlending(material.blending, material.blendEquation, material.blendSrc, material.blendDst, material.blendEquationAlpha, material.blendSrcAlpha, material.blendDstAlpha, material.premultipliedAlpha);
    depthBuffer.setFunc(material.depthFunc);
    depthBuffer.setTest(material.depthTest);
    depthBuffer.setMask(material.depthWrite);
    colorBuffer.setMask(material.colorWrite);
    const stencilWrite = material.stencilWrite;
    stencilBuffer.setTest(stencilWrite);
    if (stencilWrite) {
      stencilBuffer.setMask(material.stencilWriteMask);
      stencilBuffer.setFunc(material.stencilFunc, material.stencilRef, material.stencilFuncMask);
      stencilBuffer.setOp(material.stencilFail, material.stencilZFail, material.stencilZPass);
    }
    setPolygonOffset(material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits);
  }
  function setFlipSided(flipSided) {
    if (currentFlipSided !== flipSided) {
      if (flipSided) {
        gl.frontFace(2304);
      } else {
        gl.frontFace(2305);
      }
      currentFlipSided = flipSided;
    }
  }
  function setCullFace(cullFace) {
    if (cullFace !== CullFaceNone) {
      enable(2884);
      if (cullFace !== currentCullFace) {
        if (cullFace === CullFaceBack) {
          gl.cullFace(1029);
        } else if (cullFace === CullFaceFront) {
          gl.cullFace(1028);
        } else {
          gl.cullFace(1032);
        }
      }
    } else {
      disable(2884);
    }
    currentCullFace = cullFace;
  }
  function setLineWidth(width) {
    if (width !== currentLineWidth) {
      if (lineWidthAvailable)
        gl.lineWidth(width);
      currentLineWidth = width;
    }
  }
  function setPolygonOffset(polygonOffset, factor, units) {
    if (polygonOffset) {
      enable(32823);
      if (currentPolygonOffsetFactor !== factor || currentPolygonOffsetUnits !== units) {
        gl.polygonOffset(factor, units);
        currentPolygonOffsetFactor = factor;
        currentPolygonOffsetUnits = units;
      }
    } else {
      disable(32823);
    }
  }
  function setScissorTest(scissorTest) {
    if (scissorTest) {
      enable(3089);
    } else {
      disable(3089);
    }
  }
  function activeTexture(webglSlot) {
    if (webglSlot === void 0)
      webglSlot = 33984 + maxTextures - 1;
    if (currentTextureSlot !== webglSlot) {
      gl.activeTexture(webglSlot);
      currentTextureSlot = webglSlot;
    }
  }
  function bindTexture(webglType, webglTexture) {
    if (currentTextureSlot === null) {
      activeTexture();
    }
    let boundTexture = currentBoundTextures[currentTextureSlot];
    if (boundTexture === void 0) {
      boundTexture = {type: void 0, texture: void 0};
      currentBoundTextures[currentTextureSlot] = boundTexture;
    }
    if (boundTexture.type !== webglType || boundTexture.texture !== webglTexture) {
      gl.bindTexture(webglType, webglTexture || emptyTextures[webglType]);
      boundTexture.type = webglType;
      boundTexture.texture = webglTexture;
    }
  }
  function unbindTexture() {
    const boundTexture = currentBoundTextures[currentTextureSlot];
    if (boundTexture !== void 0 && boundTexture.type !== void 0) {
      gl.bindTexture(boundTexture.type, null);
      boundTexture.type = void 0;
      boundTexture.texture = void 0;
    }
  }
  function compressedTexImage2D() {
    try {
      gl.compressedTexImage2D.apply(gl, arguments);
    } catch (error2) {
      console.error("THREE.WebGLState:", error2);
    }
  }
  function texImage2D() {
    try {
      gl.texImage2D.apply(gl, arguments);
    } catch (error2) {
      console.error("THREE.WebGLState:", error2);
    }
  }
  function texImage3D() {
    try {
      gl.texImage3D.apply(gl, arguments);
    } catch (error2) {
      console.error("THREE.WebGLState:", error2);
    }
  }
  function scissor(scissor2) {
    if (currentScissor.equals(scissor2) === false) {
      gl.scissor(scissor2.x, scissor2.y, scissor2.z, scissor2.w);
      currentScissor.copy(scissor2);
    }
  }
  function viewport(viewport2) {
    if (currentViewport.equals(viewport2) === false) {
      gl.viewport(viewport2.x, viewport2.y, viewport2.z, viewport2.w);
      currentViewport.copy(viewport2);
    }
  }
  function reset() {
    gl.disable(3042);
    gl.disable(2884);
    gl.disable(2929);
    gl.disable(32823);
    gl.disable(3089);
    gl.disable(2960);
    gl.blendEquation(32774);
    gl.blendFunc(1, 0);
    gl.blendFuncSeparate(1, 0, 1, 0);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.depthFunc(513);
    gl.clearDepth(1);
    gl.stencilMask(4294967295);
    gl.stencilFunc(519, 0, 4294967295);
    gl.stencilOp(7680, 7680, 7680);
    gl.clearStencil(0);
    gl.cullFace(1029);
    gl.frontFace(2305);
    gl.polygonOffset(0, 0);
    gl.activeTexture(33984);
    gl.useProgram(null);
    gl.lineWidth(1);
    gl.scissor(0, 0, gl.canvas.width, gl.canvas.height);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    enabledCapabilities = {};
    currentTextureSlot = null;
    currentBoundTextures = {};
    currentProgram = null;
    currentBlendingEnabled = false;
    currentBlending = null;
    currentBlendEquation = null;
    currentBlendSrc = null;
    currentBlendDst = null;
    currentBlendEquationAlpha = null;
    currentBlendSrcAlpha = null;
    currentBlendDstAlpha = null;
    currentPremultipledAlpha = false;
    currentFlipSided = null;
    currentCullFace = null;
    currentLineWidth = null;
    currentPolygonOffsetFactor = null;
    currentPolygonOffsetUnits = null;
    colorBuffer.reset();
    depthBuffer.reset();
    stencilBuffer.reset();
  }
  return {
    buffers: {
      color: colorBuffer,
      depth: depthBuffer,
      stencil: stencilBuffer
    },
    enable,
    disable,
    useProgram,
    setBlending,
    setMaterial,
    setFlipSided,
    setCullFace,
    setLineWidth,
    setPolygonOffset,
    setScissorTest,
    activeTexture,
    bindTexture,
    unbindTexture,
    compressedTexImage2D,
    texImage2D,
    texImage3D,
    scissor,
    viewport,
    reset
  };
}
function WebGLTextures(_gl, extensions, state, properties, capabilities, utils, info) {
  const isWebGL2 = capabilities.isWebGL2;
  const maxTextures = capabilities.maxTextures;
  const maxCubemapSize = capabilities.maxCubemapSize;
  const maxTextureSize = capabilities.maxTextureSize;
  const maxSamples = capabilities.maxSamples;
  const _videoTextures = new WeakMap();
  let _canvas2;
  let useOffscreenCanvas = false;
  try {
    useOffscreenCanvas = typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
  } catch (err) {
  }
  function createCanvas(width, height) {
    return useOffscreenCanvas ? new OffscreenCanvas(width, height) : document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  }
  function resizeImage(image, needsPowerOfTwo, needsNewCanvas, maxSize) {
    let scale = 1;
    if (image.width > maxSize || image.height > maxSize) {
      scale = maxSize / Math.max(image.width, image.height);
    }
    if (scale < 1 || needsPowerOfTwo === true) {
      if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
        const floor = needsPowerOfTwo ? MathUtils.floorPowerOfTwo : Math.floor;
        const width = floor(scale * image.width);
        const height = floor(scale * image.height);
        if (_canvas2 === void 0)
          _canvas2 = createCanvas(width, height);
        const canvas = needsNewCanvas ? createCanvas(width, height) : _canvas2;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        console.warn("THREE.WebGLRenderer: Texture has been resized from (" + image.width + "x" + image.height + ") to (" + width + "x" + height + ").");
        return canvas;
      } else {
        if ("data" in image) {
          console.warn("THREE.WebGLRenderer: Image in DataTexture is too big (" + image.width + "x" + image.height + ").");
        }
        return image;
      }
    }
    return image;
  }
  function isPowerOfTwo(image) {
    return MathUtils.isPowerOfTwo(image.width) && MathUtils.isPowerOfTwo(image.height);
  }
  function textureNeedsPowerOfTwo(texture) {
    if (isWebGL2)
      return false;
    return texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping || texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
  }
  function textureNeedsGenerateMipmaps(texture, supportsMips) {
    return texture.generateMipmaps && supportsMips && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
  }
  function generateMipmap(target, texture, width, height) {
    _gl.generateMipmap(target);
    const textureProperties = properties.get(texture);
    textureProperties.__maxMipLevel = Math.log2(Math.max(width, height));
  }
  function getInternalFormat(internalFormatName, glFormat, glType) {
    if (isWebGL2 === false)
      return glFormat;
    if (internalFormatName !== null) {
      if (_gl[internalFormatName] !== void 0)
        return _gl[internalFormatName];
      console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '" + internalFormatName + "'");
    }
    let internalFormat = glFormat;
    if (glFormat === 6403) {
      if (glType === 5126)
        internalFormat = 33326;
      if (glType === 5131)
        internalFormat = 33325;
      if (glType === 5121)
        internalFormat = 33321;
    }
    if (glFormat === 6407) {
      if (glType === 5126)
        internalFormat = 34837;
      if (glType === 5131)
        internalFormat = 34843;
      if (glType === 5121)
        internalFormat = 32849;
    }
    if (glFormat === 6408) {
      if (glType === 5126)
        internalFormat = 34836;
      if (glType === 5131)
        internalFormat = 34842;
      if (glType === 5121)
        internalFormat = 32856;
    }
    if (internalFormat === 33325 || internalFormat === 33326 || internalFormat === 34842 || internalFormat === 34836) {
      extensions.get("EXT_color_buffer_float");
    }
    return internalFormat;
  }
  function filterFallback(f) {
    if (f === NearestFilter || f === NearestMipmapNearestFilter || f === NearestMipmapLinearFilter) {
      return 9728;
    }
    return 9729;
  }
  function onTextureDispose(event) {
    const texture = event.target;
    texture.removeEventListener("dispose", onTextureDispose);
    deallocateTexture(texture);
    if (texture.isVideoTexture) {
      _videoTextures.delete(texture);
    }
    info.memory.textures--;
  }
  function onRenderTargetDispose(event) {
    const renderTarget = event.target;
    renderTarget.removeEventListener("dispose", onRenderTargetDispose);
    deallocateRenderTarget(renderTarget);
    info.memory.textures--;
  }
  function deallocateTexture(texture) {
    const textureProperties = properties.get(texture);
    if (textureProperties.__webglInit === void 0)
      return;
    _gl.deleteTexture(textureProperties.__webglTexture);
    properties.remove(texture);
  }
  function deallocateRenderTarget(renderTarget) {
    const texture = renderTarget.texture;
    const renderTargetProperties = properties.get(renderTarget);
    const textureProperties = properties.get(texture);
    if (!renderTarget)
      return;
    if (textureProperties.__webglTexture !== void 0) {
      _gl.deleteTexture(textureProperties.__webglTexture);
    }
    if (renderTarget.depthTexture) {
      renderTarget.depthTexture.dispose();
    }
    if (renderTarget.isWebGLCubeRenderTarget) {
      for (let i = 0; i < 6; i++) {
        _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i]);
        if (renderTargetProperties.__webglDepthbuffer)
          _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer[i]);
      }
    } else {
      _gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer);
      if (renderTargetProperties.__webglDepthbuffer)
        _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer);
      if (renderTargetProperties.__webglMultisampledFramebuffer)
        _gl.deleteFramebuffer(renderTargetProperties.__webglMultisampledFramebuffer);
      if (renderTargetProperties.__webglColorRenderbuffer)
        _gl.deleteRenderbuffer(renderTargetProperties.__webglColorRenderbuffer);
      if (renderTargetProperties.__webglDepthRenderbuffer)
        _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthRenderbuffer);
    }
    properties.remove(texture);
    properties.remove(renderTarget);
  }
  let textureUnits = 0;
  function resetTextureUnits() {
    textureUnits = 0;
  }
  function allocateTextureUnit() {
    const textureUnit = textureUnits;
    if (textureUnit >= maxTextures) {
      console.warn("THREE.WebGLTextures: Trying to use " + textureUnit + " texture units while this GPU supports only " + maxTextures);
    }
    textureUnits += 1;
    return textureUnit;
  }
  function setTexture2D(texture, slot) {
    const textureProperties = properties.get(texture);
    if (texture.isVideoTexture)
      updateVideoTexture(texture);
    if (texture.version > 0 && textureProperties.__version !== texture.version) {
      const image = texture.image;
      if (image === void 0) {
        console.warn("THREE.WebGLRenderer: Texture marked for update but image is undefined");
      } else if (image.complete === false) {
        console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");
      } else {
        uploadTexture(textureProperties, texture, slot);
        return;
      }
    }
    state.activeTexture(33984 + slot);
    state.bindTexture(3553, textureProperties.__webglTexture);
  }
  function setTexture2DArray(texture, slot) {
    const textureProperties = properties.get(texture);
    if (texture.version > 0 && textureProperties.__version !== texture.version) {
      uploadTexture(textureProperties, texture, slot);
      return;
    }
    state.activeTexture(33984 + slot);
    state.bindTexture(35866, textureProperties.__webglTexture);
  }
  function setTexture3D(texture, slot) {
    const textureProperties = properties.get(texture);
    if (texture.version > 0 && textureProperties.__version !== texture.version) {
      uploadTexture(textureProperties, texture, slot);
      return;
    }
    state.activeTexture(33984 + slot);
    state.bindTexture(32879, textureProperties.__webglTexture);
  }
  function setTextureCube(texture, slot) {
    const textureProperties = properties.get(texture);
    if (texture.version > 0 && textureProperties.__version !== texture.version) {
      uploadCubeTexture(textureProperties, texture, slot);
      return;
    }
    state.activeTexture(33984 + slot);
    state.bindTexture(34067, textureProperties.__webglTexture);
  }
  const wrappingToGL = {
    [RepeatWrapping]: 10497,
    [ClampToEdgeWrapping]: 33071,
    [MirroredRepeatWrapping]: 33648
  };
  const filterToGL = {
    [NearestFilter]: 9728,
    [NearestMipmapNearestFilter]: 9984,
    [NearestMipmapLinearFilter]: 9986,
    [LinearFilter]: 9729,
    [LinearMipmapNearestFilter]: 9985,
    [LinearMipmapLinearFilter]: 9987
  };
  function setTextureParameters(textureType, texture, supportsMips) {
    if (supportsMips) {
      _gl.texParameteri(textureType, 10242, wrappingToGL[texture.wrapS]);
      _gl.texParameteri(textureType, 10243, wrappingToGL[texture.wrapT]);
      if (textureType === 32879 || textureType === 35866) {
        _gl.texParameteri(textureType, 32882, wrappingToGL[texture.wrapR]);
      }
      _gl.texParameteri(textureType, 10240, filterToGL[texture.magFilter]);
      _gl.texParameteri(textureType, 10241, filterToGL[texture.minFilter]);
    } else {
      _gl.texParameteri(textureType, 10242, 33071);
      _gl.texParameteri(textureType, 10243, 33071);
      if (textureType === 32879 || textureType === 35866) {
        _gl.texParameteri(textureType, 32882, 33071);
      }
      if (texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping) {
        console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping.");
      }
      _gl.texParameteri(textureType, 10240, filterFallback(texture.magFilter));
      _gl.texParameteri(textureType, 10241, filterFallback(texture.minFilter));
      if (texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter) {
        console.warn("THREE.WebGLRenderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.");
      }
    }
    if (extensions.has("EXT_texture_filter_anisotropic") === true) {
      const extension = extensions.get("EXT_texture_filter_anisotropic");
      if (texture.type === FloatType && extensions.has("OES_texture_float_linear") === false)
        return;
      if (isWebGL2 === false && (texture.type === HalfFloatType && extensions.has("OES_texture_half_float_linear") === false))
        return;
      if (texture.anisotropy > 1 || properties.get(texture).__currentAnisotropy) {
        _gl.texParameterf(textureType, extension.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(texture.anisotropy, capabilities.getMaxAnisotropy()));
        properties.get(texture).__currentAnisotropy = texture.anisotropy;
      }
    }
  }
  function initTexture(textureProperties, texture) {
    if (textureProperties.__webglInit === void 0) {
      textureProperties.__webglInit = true;
      texture.addEventListener("dispose", onTextureDispose);
      textureProperties.__webglTexture = _gl.createTexture();
      info.memory.textures++;
    }
  }
  function uploadTexture(textureProperties, texture, slot) {
    let textureType = 3553;
    if (texture.isDataTexture2DArray)
      textureType = 35866;
    if (texture.isDataTexture3D)
      textureType = 32879;
    initTexture(textureProperties, texture);
    state.activeTexture(33984 + slot);
    state.bindTexture(textureType, textureProperties.__webglTexture);
    _gl.pixelStorei(37440, texture.flipY);
    _gl.pixelStorei(37441, texture.premultiplyAlpha);
    _gl.pixelStorei(3317, texture.unpackAlignment);
    _gl.pixelStorei(37443, 0);
    const needsPowerOfTwo = textureNeedsPowerOfTwo(texture) && isPowerOfTwo(texture.image) === false;
    const image = resizeImage(texture.image, needsPowerOfTwo, false, maxTextureSize);
    const supportsMips = isPowerOfTwo(image) || isWebGL2, glFormat = utils.convert(texture.format);
    let glType = utils.convert(texture.type), glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType);
    setTextureParameters(textureType, texture, supportsMips);
    let mipmap;
    const mipmaps = texture.mipmaps;
    if (texture.isDepthTexture) {
      glInternalFormat = 6402;
      if (isWebGL2) {
        if (texture.type === FloatType) {
          glInternalFormat = 36012;
        } else if (texture.type === UnsignedIntType) {
          glInternalFormat = 33190;
        } else if (texture.type === UnsignedInt248Type) {
          glInternalFormat = 35056;
        } else {
          glInternalFormat = 33189;
        }
      } else {
        if (texture.type === FloatType) {
          console.error("WebGLRenderer: Floating point depth texture requires WebGL2.");
        }
      }
      if (texture.format === DepthFormat && glInternalFormat === 6402) {
        if (texture.type !== UnsignedShortType && texture.type !== UnsignedIntType) {
          console.warn("THREE.WebGLRenderer: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture.");
          texture.type = UnsignedShortType;
          glType = utils.convert(texture.type);
        }
      }
      if (texture.format === DepthStencilFormat && glInternalFormat === 6402) {
        glInternalFormat = 34041;
        if (texture.type !== UnsignedInt248Type) {
          console.warn("THREE.WebGLRenderer: Use UnsignedInt248Type for DepthStencilFormat DepthTexture.");
          texture.type = UnsignedInt248Type;
          glType = utils.convert(texture.type);
        }
      }
      state.texImage2D(3553, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, null);
    } else if (texture.isDataTexture) {
      if (mipmaps.length > 0 && supportsMips) {
        for (let i = 0, il = mipmaps.length; i < il; i++) {
          mipmap = mipmaps[i];
          state.texImage2D(3553, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
        }
        texture.generateMipmaps = false;
        textureProperties.__maxMipLevel = mipmaps.length - 1;
      } else {
        state.texImage2D(3553, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, image.data);
        textureProperties.__maxMipLevel = 0;
      }
    } else if (texture.isCompressedTexture) {
      for (let i = 0, il = mipmaps.length; i < il; i++) {
        mipmap = mipmaps[i];
        if (texture.format !== RGBAFormat && texture.format !== RGBFormat) {
          if (glFormat !== null) {
            state.compressedTexImage2D(3553, i, glInternalFormat, mipmap.width, mipmap.height, 0, mipmap.data);
          } else {
            console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
          }
        } else {
          state.texImage2D(3553, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
        }
      }
      textureProperties.__maxMipLevel = mipmaps.length - 1;
    } else if (texture.isDataTexture2DArray) {
      state.texImage3D(35866, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
      textureProperties.__maxMipLevel = 0;
    } else if (texture.isDataTexture3D) {
      state.texImage3D(32879, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
      textureProperties.__maxMipLevel = 0;
    } else {
      if (mipmaps.length > 0 && supportsMips) {
        for (let i = 0, il = mipmaps.length; i < il; i++) {
          mipmap = mipmaps[i];
          state.texImage2D(3553, i, glInternalFormat, glFormat, glType, mipmap);
        }
        texture.generateMipmaps = false;
        textureProperties.__maxMipLevel = mipmaps.length - 1;
      } else {
        state.texImage2D(3553, 0, glInternalFormat, glFormat, glType, image);
        textureProperties.__maxMipLevel = 0;
      }
    }
    if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
      generateMipmap(textureType, texture, image.width, image.height);
    }
    textureProperties.__version = texture.version;
    if (texture.onUpdate)
      texture.onUpdate(texture);
  }
  function uploadCubeTexture(textureProperties, texture, slot) {
    if (texture.image.length !== 6)
      return;
    initTexture(textureProperties, texture);
    state.activeTexture(33984 + slot);
    state.bindTexture(34067, textureProperties.__webglTexture);
    _gl.pixelStorei(37440, texture.flipY);
    _gl.pixelStorei(37441, texture.premultiplyAlpha);
    _gl.pixelStorei(3317, texture.unpackAlignment);
    _gl.pixelStorei(37443, 0);
    const isCompressed = texture && (texture.isCompressedTexture || texture.image[0].isCompressedTexture);
    const isDataTexture = texture.image[0] && texture.image[0].isDataTexture;
    const cubeImage = [];
    for (let i = 0; i < 6; i++) {
      if (!isCompressed && !isDataTexture) {
        cubeImage[i] = resizeImage(texture.image[i], false, true, maxCubemapSize);
      } else {
        cubeImage[i] = isDataTexture ? texture.image[i].image : texture.image[i];
      }
    }
    const image = cubeImage[0], supportsMips = isPowerOfTwo(image) || isWebGL2, glFormat = utils.convert(texture.format), glType = utils.convert(texture.type), glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType);
    setTextureParameters(34067, texture, supportsMips);
    let mipmaps;
    if (isCompressed) {
      for (let i = 0; i < 6; i++) {
        mipmaps = cubeImage[i].mipmaps;
        for (let j = 0; j < mipmaps.length; j++) {
          const mipmap = mipmaps[j];
          if (texture.format !== RGBAFormat && texture.format !== RGBFormat) {
            if (glFormat !== null) {
              state.compressedTexImage2D(34069 + i, j, glInternalFormat, mipmap.width, mipmap.height, 0, mipmap.data);
            } else {
              console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");
            }
          } else {
            state.texImage2D(34069 + i, j, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
          }
        }
      }
      textureProperties.__maxMipLevel = mipmaps.length - 1;
    } else {
      mipmaps = texture.mipmaps;
      for (let i = 0; i < 6; i++) {
        if (isDataTexture) {
          state.texImage2D(34069 + i, 0, glInternalFormat, cubeImage[i].width, cubeImage[i].height, 0, glFormat, glType, cubeImage[i].data);
          for (let j = 0; j < mipmaps.length; j++) {
            const mipmap = mipmaps[j];
            const mipmapImage = mipmap.image[i].image;
            state.texImage2D(34069 + i, j + 1, glInternalFormat, mipmapImage.width, mipmapImage.height, 0, glFormat, glType, mipmapImage.data);
          }
        } else {
          state.texImage2D(34069 + i, 0, glInternalFormat, glFormat, glType, cubeImage[i]);
          for (let j = 0; j < mipmaps.length; j++) {
            const mipmap = mipmaps[j];
            state.texImage2D(34069 + i, j + 1, glInternalFormat, glFormat, glType, mipmap.image[i]);
          }
        }
      }
      textureProperties.__maxMipLevel = mipmaps.length;
    }
    if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
      generateMipmap(34067, texture, image.width, image.height);
    }
    textureProperties.__version = texture.version;
    if (texture.onUpdate)
      texture.onUpdate(texture);
  }
  function setupFrameBufferTexture(framebuffer, renderTarget, attachment, textureTarget) {
    const texture = renderTarget.texture;
    const glFormat = utils.convert(texture.format);
    const glType = utils.convert(texture.type);
    const glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType);
    if (textureTarget === 32879 || textureTarget === 35866) {
      state.texImage3D(textureTarget, 0, glInternalFormat, renderTarget.width, renderTarget.height, renderTarget.depth, 0, glFormat, glType, null);
    } else {
      state.texImage2D(textureTarget, 0, glInternalFormat, renderTarget.width, renderTarget.height, 0, glFormat, glType, null);
    }
    _gl.bindFramebuffer(36160, framebuffer);
    _gl.framebufferTexture2D(36160, attachment, textureTarget, properties.get(texture).__webglTexture, 0);
    _gl.bindFramebuffer(36160, null);
  }
  function setupRenderBufferStorage(renderbuffer, renderTarget, isMultisample) {
    _gl.bindRenderbuffer(36161, renderbuffer);
    if (renderTarget.depthBuffer && !renderTarget.stencilBuffer) {
      let glInternalFormat = 33189;
      if (isMultisample) {
        const depthTexture = renderTarget.depthTexture;
        if (depthTexture && depthTexture.isDepthTexture) {
          if (depthTexture.type === FloatType) {
            glInternalFormat = 36012;
          } else if (depthTexture.type === UnsignedIntType) {
            glInternalFormat = 33190;
          }
        }
        const samples = getRenderTargetSamples(renderTarget);
        _gl.renderbufferStorageMultisample(36161, samples, glInternalFormat, renderTarget.width, renderTarget.height);
      } else {
        _gl.renderbufferStorage(36161, glInternalFormat, renderTarget.width, renderTarget.height);
      }
      _gl.framebufferRenderbuffer(36160, 36096, 36161, renderbuffer);
    } else if (renderTarget.depthBuffer && renderTarget.stencilBuffer) {
      if (isMultisample) {
        const samples = getRenderTargetSamples(renderTarget);
        _gl.renderbufferStorageMultisample(36161, samples, 35056, renderTarget.width, renderTarget.height);
      } else {
        _gl.renderbufferStorage(36161, 34041, renderTarget.width, renderTarget.height);
      }
      _gl.framebufferRenderbuffer(36160, 33306, 36161, renderbuffer);
    } else {
      const texture = renderTarget.texture;
      const glFormat = utils.convert(texture.format);
      const glType = utils.convert(texture.type);
      const glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType);
      if (isMultisample) {
        const samples = getRenderTargetSamples(renderTarget);
        _gl.renderbufferStorageMultisample(36161, samples, glInternalFormat, renderTarget.width, renderTarget.height);
      } else {
        _gl.renderbufferStorage(36161, glInternalFormat, renderTarget.width, renderTarget.height);
      }
    }
    _gl.bindRenderbuffer(36161, null);
  }
  function setupDepthTexture(framebuffer, renderTarget) {
    const isCube = renderTarget && renderTarget.isWebGLCubeRenderTarget;
    if (isCube)
      throw new Error("Depth Texture with cube render targets is not supported");
    _gl.bindFramebuffer(36160, framebuffer);
    if (!(renderTarget.depthTexture && renderTarget.depthTexture.isDepthTexture)) {
      throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");
    }
    if (!properties.get(renderTarget.depthTexture).__webglTexture || renderTarget.depthTexture.image.width !== renderTarget.width || renderTarget.depthTexture.image.height !== renderTarget.height) {
      renderTarget.depthTexture.image.width = renderTarget.width;
      renderTarget.depthTexture.image.height = renderTarget.height;
      renderTarget.depthTexture.needsUpdate = true;
    }
    setTexture2D(renderTarget.depthTexture, 0);
    const webglDepthTexture = properties.get(renderTarget.depthTexture).__webglTexture;
    if (renderTarget.depthTexture.format === DepthFormat) {
      _gl.framebufferTexture2D(36160, 36096, 3553, webglDepthTexture, 0);
    } else if (renderTarget.depthTexture.format === DepthStencilFormat) {
      _gl.framebufferTexture2D(36160, 33306, 3553, webglDepthTexture, 0);
    } else {
      throw new Error("Unknown depthTexture format");
    }
  }
  function setupDepthRenderbuffer(renderTarget) {
    const renderTargetProperties = properties.get(renderTarget);
    const isCube = renderTarget.isWebGLCubeRenderTarget === true;
    if (renderTarget.depthTexture) {
      if (isCube)
        throw new Error("target.depthTexture not supported in Cube render targets");
      setupDepthTexture(renderTargetProperties.__webglFramebuffer, renderTarget);
    } else {
      if (isCube) {
        renderTargetProperties.__webglDepthbuffer = [];
        for (let i = 0; i < 6; i++) {
          _gl.bindFramebuffer(36160, renderTargetProperties.__webglFramebuffer[i]);
          renderTargetProperties.__webglDepthbuffer[i] = _gl.createRenderbuffer();
          setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer[i], renderTarget, false);
        }
      } else {
        _gl.bindFramebuffer(36160, renderTargetProperties.__webglFramebuffer);
        renderTargetProperties.__webglDepthbuffer = _gl.createRenderbuffer();
        setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer, renderTarget, false);
      }
    }
    _gl.bindFramebuffer(36160, null);
  }
  function setupRenderTarget(renderTarget) {
    const texture = renderTarget.texture;
    const renderTargetProperties = properties.get(renderTarget);
    const textureProperties = properties.get(texture);
    renderTarget.addEventListener("dispose", onRenderTargetDispose);
    textureProperties.__webglTexture = _gl.createTexture();
    info.memory.textures++;
    const isCube = renderTarget.isWebGLCubeRenderTarget === true;
    const isMultisample = renderTarget.isWebGLMultisampleRenderTarget === true;
    const isRenderTarget3D = texture.isDataTexture3D || texture.isDataTexture2DArray;
    const supportsMips = isPowerOfTwo(renderTarget) || isWebGL2;
    if (isWebGL2 && texture.format === RGBFormat && (texture.type === FloatType || texture.type === HalfFloatType)) {
      texture.format = RGBAFormat;
      console.warn("THREE.WebGLRenderer: Rendering to textures with RGB format is not supported. Using RGBA format instead.");
    }
    if (isCube) {
      renderTargetProperties.__webglFramebuffer = [];
      for (let i = 0; i < 6; i++) {
        renderTargetProperties.__webglFramebuffer[i] = _gl.createFramebuffer();
      }
    } else {
      renderTargetProperties.__webglFramebuffer = _gl.createFramebuffer();
      if (isMultisample) {
        if (isWebGL2) {
          renderTargetProperties.__webglMultisampledFramebuffer = _gl.createFramebuffer();
          renderTargetProperties.__webglColorRenderbuffer = _gl.createRenderbuffer();
          _gl.bindRenderbuffer(36161, renderTargetProperties.__webglColorRenderbuffer);
          const glFormat = utils.convert(texture.format);
          const glType = utils.convert(texture.type);
          const glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType);
          const samples = getRenderTargetSamples(renderTarget);
          _gl.renderbufferStorageMultisample(36161, samples, glInternalFormat, renderTarget.width, renderTarget.height);
          _gl.bindFramebuffer(36160, renderTargetProperties.__webglMultisampledFramebuffer);
          _gl.framebufferRenderbuffer(36160, 36064, 36161, renderTargetProperties.__webglColorRenderbuffer);
          _gl.bindRenderbuffer(36161, null);
          if (renderTarget.depthBuffer) {
            renderTargetProperties.__webglDepthRenderbuffer = _gl.createRenderbuffer();
            setupRenderBufferStorage(renderTargetProperties.__webglDepthRenderbuffer, renderTarget, true);
          }
          _gl.bindFramebuffer(36160, null);
        } else {
          console.warn("THREE.WebGLRenderer: WebGLMultisampleRenderTarget can only be used with WebGL2.");
        }
      }
    }
    if (isCube) {
      state.bindTexture(34067, textureProperties.__webglTexture);
      setTextureParameters(34067, texture, supportsMips);
      for (let i = 0; i < 6; i++) {
        setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer[i], renderTarget, 36064, 34069 + i);
      }
      if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
        generateMipmap(34067, texture, renderTarget.width, renderTarget.height);
      }
      state.bindTexture(34067, null);
    } else {
      let glTextureType = 3553;
      if (isRenderTarget3D) {
        if (isWebGL2) {
          const isTexture3D = texture.isDataTexture3D;
          glTextureType = isTexture3D ? 32879 : 35866;
        } else {
          console.warn("THREE.DataTexture3D and THREE.DataTexture2DArray only supported with WebGL2.");
        }
      }
      state.bindTexture(glTextureType, textureProperties.__webglTexture);
      setTextureParameters(glTextureType, texture, supportsMips);
      setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer, renderTarget, 36064, glTextureType);
      if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
        generateMipmap(3553, texture, renderTarget.width, renderTarget.height);
      }
      state.bindTexture(3553, null);
    }
    if (renderTarget.depthBuffer) {
      setupDepthRenderbuffer(renderTarget);
    }
  }
  function updateRenderTargetMipmap(renderTarget) {
    const texture = renderTarget.texture;
    const supportsMips = isPowerOfTwo(renderTarget) || isWebGL2;
    if (textureNeedsGenerateMipmaps(texture, supportsMips)) {
      const target = renderTarget.isWebGLCubeRenderTarget ? 34067 : 3553;
      const webglTexture = properties.get(texture).__webglTexture;
      state.bindTexture(target, webglTexture);
      generateMipmap(target, texture, renderTarget.width, renderTarget.height);
      state.bindTexture(target, null);
    }
  }
  function updateMultisampleRenderTarget(renderTarget) {
    if (renderTarget.isWebGLMultisampleRenderTarget) {
      if (isWebGL2) {
        const renderTargetProperties = properties.get(renderTarget);
        _gl.bindFramebuffer(36008, renderTargetProperties.__webglMultisampledFramebuffer);
        _gl.bindFramebuffer(36009, renderTargetProperties.__webglFramebuffer);
        const width = renderTarget.width;
        const height = renderTarget.height;
        let mask = 16384;
        if (renderTarget.depthBuffer)
          mask |= 256;
        if (renderTarget.stencilBuffer)
          mask |= 1024;
        _gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, mask, 9728);
        _gl.bindFramebuffer(36160, renderTargetProperties.__webglMultisampledFramebuffer);
      } else {
        console.warn("THREE.WebGLRenderer: WebGLMultisampleRenderTarget can only be used with WebGL2.");
      }
    }
  }
  function getRenderTargetSamples(renderTarget) {
    return isWebGL2 && renderTarget.isWebGLMultisampleRenderTarget ? Math.min(maxSamples, renderTarget.samples) : 0;
  }
  function updateVideoTexture(texture) {
    const frame = info.render.frame;
    if (_videoTextures.get(texture) !== frame) {
      _videoTextures.set(texture, frame);
      texture.update();
    }
  }
  let warnedTexture2D = false;
  let warnedTextureCube = false;
  function safeSetTexture2D(texture, slot) {
    if (texture && texture.isWebGLRenderTarget) {
      if (warnedTexture2D === false) {
        console.warn("THREE.WebGLTextures.safeSetTexture2D: don't use render targets as textures. Use their .texture property instead.");
        warnedTexture2D = true;
      }
      texture = texture.texture;
    }
    setTexture2D(texture, slot);
  }
  function safeSetTextureCube(texture, slot) {
    if (texture && texture.isWebGLCubeRenderTarget) {
      if (warnedTextureCube === false) {
        console.warn("THREE.WebGLTextures.safeSetTextureCube: don't use cube render targets as textures. Use their .texture property instead.");
        warnedTextureCube = true;
      }
      texture = texture.texture;
    }
    setTextureCube(texture, slot);
  }
  this.allocateTextureUnit = allocateTextureUnit;
  this.resetTextureUnits = resetTextureUnits;
  this.setTexture2D = setTexture2D;
  this.setTexture2DArray = setTexture2DArray;
  this.setTexture3D = setTexture3D;
  this.setTextureCube = setTextureCube;
  this.setupRenderTarget = setupRenderTarget;
  this.updateRenderTargetMipmap = updateRenderTargetMipmap;
  this.updateMultisampleRenderTarget = updateMultisampleRenderTarget;
  this.safeSetTexture2D = safeSetTexture2D;
  this.safeSetTextureCube = safeSetTextureCube;
}
function WebGLUtils(gl, extensions, capabilities) {
  const isWebGL2 = capabilities.isWebGL2;
  function convert(p) {
    let extension;
    if (p === UnsignedByteType)
      return 5121;
    if (p === UnsignedShort4444Type)
      return 32819;
    if (p === UnsignedShort5551Type)
      return 32820;
    if (p === UnsignedShort565Type)
      return 33635;
    if (p === ByteType)
      return 5120;
    if (p === ShortType)
      return 5122;
    if (p === UnsignedShortType)
      return 5123;
    if (p === IntType)
      return 5124;
    if (p === UnsignedIntType)
      return 5125;
    if (p === FloatType)
      return 5126;
    if (p === HalfFloatType) {
      if (isWebGL2)
        return 5131;
      extension = extensions.get("OES_texture_half_float");
      if (extension !== null) {
        return extension.HALF_FLOAT_OES;
      } else {
        return null;
      }
    }
    if (p === AlphaFormat)
      return 6406;
    if (p === RGBFormat)
      return 6407;
    if (p === RGBAFormat)
      return 6408;
    if (p === LuminanceFormat)
      return 6409;
    if (p === LuminanceAlphaFormat)
      return 6410;
    if (p === DepthFormat)
      return 6402;
    if (p === DepthStencilFormat)
      return 34041;
    if (p === RedFormat)
      return 6403;
    if (p === RedIntegerFormat)
      return 36244;
    if (p === RGFormat)
      return 33319;
    if (p === RGIntegerFormat)
      return 33320;
    if (p === RGBIntegerFormat)
      return 36248;
    if (p === RGBAIntegerFormat)
      return 36249;
    if (p === RGB_S3TC_DXT1_Format || p === RGBA_S3TC_DXT1_Format || p === RGBA_S3TC_DXT3_Format || p === RGBA_S3TC_DXT5_Format) {
      extension = extensions.get("WEBGL_compressed_texture_s3tc");
      if (extension !== null) {
        if (p === RGB_S3TC_DXT1_Format)
          return extension.COMPRESSED_RGB_S3TC_DXT1_EXT;
        if (p === RGBA_S3TC_DXT1_Format)
          return extension.COMPRESSED_RGBA_S3TC_DXT1_EXT;
        if (p === RGBA_S3TC_DXT3_Format)
          return extension.COMPRESSED_RGBA_S3TC_DXT3_EXT;
        if (p === RGBA_S3TC_DXT5_Format)
          return extension.COMPRESSED_RGBA_S3TC_DXT5_EXT;
      } else {
        return null;
      }
    }
    if (p === RGB_PVRTC_4BPPV1_Format || p === RGB_PVRTC_2BPPV1_Format || p === RGBA_PVRTC_4BPPV1_Format || p === RGBA_PVRTC_2BPPV1_Format) {
      extension = extensions.get("WEBGL_compressed_texture_pvrtc");
      if (extension !== null) {
        if (p === RGB_PVRTC_4BPPV1_Format)
          return extension.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
        if (p === RGB_PVRTC_2BPPV1_Format)
          return extension.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
        if (p === RGBA_PVRTC_4BPPV1_Format)
          return extension.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
        if (p === RGBA_PVRTC_2BPPV1_Format)
          return extension.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
      } else {
        return null;
      }
    }
    if (p === RGB_ETC1_Format) {
      extension = extensions.get("WEBGL_compressed_texture_etc1");
      if (extension !== null) {
        return extension.COMPRESSED_RGB_ETC1_WEBGL;
      } else {
        return null;
      }
    }
    if (p === RGB_ETC2_Format || p === RGBA_ETC2_EAC_Format) {
      extension = extensions.get("WEBGL_compressed_texture_etc");
      if (extension !== null) {
        if (p === RGB_ETC2_Format)
          return extension.COMPRESSED_RGB8_ETC2;
        if (p === RGBA_ETC2_EAC_Format)
          return extension.COMPRESSED_RGBA8_ETC2_EAC;
      }
    }
    if (p === RGBA_ASTC_4x4_Format || p === RGBA_ASTC_5x4_Format || p === RGBA_ASTC_5x5_Format || p === RGBA_ASTC_6x5_Format || p === RGBA_ASTC_6x6_Format || p === RGBA_ASTC_8x5_Format || p === RGBA_ASTC_8x6_Format || p === RGBA_ASTC_8x8_Format || p === RGBA_ASTC_10x5_Format || p === RGBA_ASTC_10x6_Format || p === RGBA_ASTC_10x8_Format || p === RGBA_ASTC_10x10_Format || p === RGBA_ASTC_12x10_Format || p === RGBA_ASTC_12x12_Format || p === SRGB8_ALPHA8_ASTC_4x4_Format || p === SRGB8_ALPHA8_ASTC_5x4_Format || p === SRGB8_ALPHA8_ASTC_5x5_Format || p === SRGB8_ALPHA8_ASTC_6x5_Format || p === SRGB8_ALPHA8_ASTC_6x6_Format || p === SRGB8_ALPHA8_ASTC_8x5_Format || p === SRGB8_ALPHA8_ASTC_8x6_Format || p === SRGB8_ALPHA8_ASTC_8x8_Format || p === SRGB8_ALPHA8_ASTC_10x5_Format || p === SRGB8_ALPHA8_ASTC_10x6_Format || p === SRGB8_ALPHA8_ASTC_10x8_Format || p === SRGB8_ALPHA8_ASTC_10x10_Format || p === SRGB8_ALPHA8_ASTC_12x10_Format || p === SRGB8_ALPHA8_ASTC_12x12_Format) {
      extension = extensions.get("WEBGL_compressed_texture_astc");
      if (extension !== null) {
        return p;
      } else {
        return null;
      }
    }
    if (p === RGBA_BPTC_Format) {
      extension = extensions.get("EXT_texture_compression_bptc");
      if (extension !== null) {
        return p;
      } else {
        return null;
      }
    }
    if (p === UnsignedInt248Type) {
      if (isWebGL2)
        return 34042;
      extension = extensions.get("WEBGL_depth_texture");
      if (extension !== null) {
        return extension.UNSIGNED_INT_24_8_WEBGL;
      } else {
        return null;
      }
    }
  }
  return {convert};
}
function ArrayCamera(array = []) {
  PerspectiveCamera.call(this);
  this.cameras = array;
}
ArrayCamera.prototype = Object.assign(Object.create(PerspectiveCamera.prototype), {
  constructor: ArrayCamera,
  isArrayCamera: true
});
class Group extends Object3D {
  constructor() {
    super();
    this.type = "Group";
  }
}
Group.prototype.isGroup = true;
function WebXRController() {
  this._targetRay = null;
  this._grip = null;
  this._hand = null;
}
Object.assign(WebXRController.prototype, {
  constructor: WebXRController,
  getHandSpace: function() {
    if (this._hand === null) {
      this._hand = new Group();
      this._hand.matrixAutoUpdate = false;
      this._hand.visible = false;
      this._hand.joints = {};
      this._hand.inputState = {pinching: false};
    }
    return this._hand;
  },
  getTargetRaySpace: function() {
    if (this._targetRay === null) {
      this._targetRay = new Group();
      this._targetRay.matrixAutoUpdate = false;
      this._targetRay.visible = false;
    }
    return this._targetRay;
  },
  getGripSpace: function() {
    if (this._grip === null) {
      this._grip = new Group();
      this._grip.matrixAutoUpdate = false;
      this._grip.visible = false;
    }
    return this._grip;
  },
  dispatchEvent: function(event) {
    if (this._targetRay !== null) {
      this._targetRay.dispatchEvent(event);
    }
    if (this._grip !== null) {
      this._grip.dispatchEvent(event);
    }
    if (this._hand !== null) {
      this._hand.dispatchEvent(event);
    }
    return this;
  },
  disconnect: function(inputSource) {
    this.dispatchEvent({type: "disconnected", data: inputSource});
    if (this._targetRay !== null) {
      this._targetRay.visible = false;
    }
    if (this._grip !== null) {
      this._grip.visible = false;
    }
    if (this._hand !== null) {
      this._hand.visible = false;
    }
    return this;
  },
  update: function(inputSource, frame, referenceSpace) {
    let inputPose = null;
    let gripPose = null;
    let handPose = null;
    const targetRay = this._targetRay;
    const grip = this._grip;
    const hand = this._hand;
    if (inputSource && frame.session.visibilityState !== "visible-blurred") {
      if (hand && inputSource.hand) {
        handPose = true;
        for (const inputjoint of inputSource.hand.values()) {
          const jointPose = frame.getJointPose(inputjoint, referenceSpace);
          if (hand.joints[inputjoint.jointName] === void 0) {
            const joint2 = new Group();
            joint2.matrixAutoUpdate = false;
            joint2.visible = false;
            hand.joints[inputjoint.jointName] = joint2;
            hand.add(joint2);
          }
          const joint = hand.joints[inputjoint.jointName];
          if (jointPose !== null) {
            joint.matrix.fromArray(jointPose.transform.matrix);
            joint.matrix.decompose(joint.position, joint.rotation, joint.scale);
            joint.jointRadius = jointPose.radius;
          }
          joint.visible = jointPose !== null;
        }
        const indexTip = hand.joints["index-finger-tip"];
        const thumbTip = hand.joints["thumb-tip"];
        const distance = indexTip.position.distanceTo(thumbTip.position);
        const distanceToPinch = 0.02;
        const threshold = 5e-3;
        if (hand.inputState.pinching && distance > distanceToPinch + threshold) {
          hand.inputState.pinching = false;
          this.dispatchEvent({
            type: "pinchend",
            handedness: inputSource.handedness,
            target: this
          });
        } else if (!hand.inputState.pinching && distance <= distanceToPinch - threshold) {
          hand.inputState.pinching = true;
          this.dispatchEvent({
            type: "pinchstart",
            handedness: inputSource.handedness,
            target: this
          });
        }
      } else {
        if (targetRay !== null) {
          inputPose = frame.getPose(inputSource.targetRaySpace, referenceSpace);
          if (inputPose !== null) {
            targetRay.matrix.fromArray(inputPose.transform.matrix);
            targetRay.matrix.decompose(targetRay.position, targetRay.rotation, targetRay.scale);
          }
        }
        if (grip !== null && inputSource.gripSpace) {
          gripPose = frame.getPose(inputSource.gripSpace, referenceSpace);
          if (gripPose !== null) {
            grip.matrix.fromArray(gripPose.transform.matrix);
            grip.matrix.decompose(grip.position, grip.rotation, grip.scale);
          }
        }
      }
    }
    if (targetRay !== null) {
      targetRay.visible = inputPose !== null;
    }
    if (grip !== null) {
      grip.visible = gripPose !== null;
    }
    if (hand !== null) {
      hand.visible = handPose !== null;
    }
    return this;
  }
});
function WebXRManager(renderer, gl) {
  const scope = this;
  let session = null;
  let framebufferScaleFactor = 1;
  let referenceSpace = null;
  let referenceSpaceType = "local-floor";
  let pose = null;
  const controllers = [];
  const inputSourcesMap = new Map();
  const cameraL = new PerspectiveCamera();
  cameraL.layers.enable(1);
  cameraL.viewport = new Vector4();
  const cameraR = new PerspectiveCamera();
  cameraR.layers.enable(2);
  cameraR.viewport = new Vector4();
  const cameras = [cameraL, cameraR];
  const cameraVR = new ArrayCamera();
  cameraVR.layers.enable(1);
  cameraVR.layers.enable(2);
  let _currentDepthNear = null;
  let _currentDepthFar = null;
  this.enabled = false;
  this.isPresenting = false;
  this.getController = function(index2) {
    let controller = controllers[index2];
    if (controller === void 0) {
      controller = new WebXRController();
      controllers[index2] = controller;
    }
    return controller.getTargetRaySpace();
  };
  this.getControllerGrip = function(index2) {
    let controller = controllers[index2];
    if (controller === void 0) {
      controller = new WebXRController();
      controllers[index2] = controller;
    }
    return controller.getGripSpace();
  };
  this.getHand = function(index2) {
    let controller = controllers[index2];
    if (controller === void 0) {
      controller = new WebXRController();
      controllers[index2] = controller;
    }
    return controller.getHandSpace();
  };
  function onSessionEvent(event) {
    const controller = inputSourcesMap.get(event.inputSource);
    if (controller) {
      controller.dispatchEvent({type: event.type, data: event.inputSource});
    }
  }
  function onSessionEnd() {
    inputSourcesMap.forEach(function(controller, inputSource) {
      controller.disconnect(inputSource);
    });
    inputSourcesMap.clear();
    _currentDepthNear = null;
    _currentDepthFar = null;
    renderer.setFramebuffer(null);
    renderer.setRenderTarget(renderer.getRenderTarget());
    animation.stop();
    scope.isPresenting = false;
    scope.dispatchEvent({type: "sessionend"});
  }
  this.setFramebufferScaleFactor = function(value) {
    framebufferScaleFactor = value;
    if (scope.isPresenting === true) {
      console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.");
    }
  };
  this.setReferenceSpaceType = function(value) {
    referenceSpaceType = value;
    if (scope.isPresenting === true) {
      console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.");
    }
  };
  this.getReferenceSpace = function() {
    return referenceSpace;
  };
  this.getSession = function() {
    return session;
  };
  this.setSession = async function(value) {
    session = value;
    if (session !== null) {
      session.addEventListener("select", onSessionEvent);
      session.addEventListener("selectstart", onSessionEvent);
      session.addEventListener("selectend", onSessionEvent);
      session.addEventListener("squeeze", onSessionEvent);
      session.addEventListener("squeezestart", onSessionEvent);
      session.addEventListener("squeezeend", onSessionEvent);
      session.addEventListener("end", onSessionEnd);
      session.addEventListener("inputsourceschange", onInputSourcesChange);
      const attributes = gl.getContextAttributes();
      if (attributes.xrCompatible !== true) {
        await gl.makeXRCompatible();
      }
      const layerInit = {
        antialias: attributes.antialias,
        alpha: attributes.alpha,
        depth: attributes.depth,
        stencil: attributes.stencil,
        framebufferScaleFactor
      };
      const baseLayer = new XRWebGLLayer(session, gl, layerInit);
      session.updateRenderState({baseLayer});
      referenceSpace = await session.requestReferenceSpace(referenceSpaceType);
      animation.setContext(session);
      animation.start();
      scope.isPresenting = true;
      scope.dispatchEvent({type: "sessionstart"});
    }
  };
  function onInputSourcesChange(event) {
    const inputSources = session.inputSources;
    for (let i = 0; i < controllers.length; i++) {
      inputSourcesMap.set(inputSources[i], controllers[i]);
    }
    for (let i = 0; i < event.removed.length; i++) {
      const inputSource = event.removed[i];
      const controller = inputSourcesMap.get(inputSource);
      if (controller) {
        controller.dispatchEvent({type: "disconnected", data: inputSource});
        inputSourcesMap.delete(inputSource);
      }
    }
    for (let i = 0; i < event.added.length; i++) {
      const inputSource = event.added[i];
      const controller = inputSourcesMap.get(inputSource);
      if (controller) {
        controller.dispatchEvent({type: "connected", data: inputSource});
      }
    }
  }
  const cameraLPos = new Vector3();
  const cameraRPos = new Vector3();
  function setProjectionFromUnion(camera, cameraL2, cameraR2) {
    cameraLPos.setFromMatrixPosition(cameraL2.matrixWorld);
    cameraRPos.setFromMatrixPosition(cameraR2.matrixWorld);
    const ipd = cameraLPos.distanceTo(cameraRPos);
    const projL = cameraL2.projectionMatrix.elements;
    const projR = cameraR2.projectionMatrix.elements;
    const near = projL[14] / (projL[10] - 1);
    const far = projL[14] / (projL[10] + 1);
    const topFov = (projL[9] + 1) / projL[5];
    const bottomFov = (projL[9] - 1) / projL[5];
    const leftFov = (projL[8] - 1) / projL[0];
    const rightFov = (projR[8] + 1) / projR[0];
    const left = near * leftFov;
    const right = near * rightFov;
    const zOffset = ipd / (-leftFov + rightFov);
    const xOffset = zOffset * -leftFov;
    cameraL2.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
    camera.translateX(xOffset);
    camera.translateZ(zOffset);
    camera.matrixWorld.compose(camera.position, camera.quaternion, camera.scale);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const near2 = near + zOffset;
    const far2 = far + zOffset;
    const left2 = left - xOffset;
    const right2 = right + (ipd - xOffset);
    const top2 = topFov * far / far2 * near2;
    const bottom2 = bottomFov * far / far2 * near2;
    camera.projectionMatrix.makePerspective(left2, right2, top2, bottom2, near2, far2);
  }
  function updateCamera(camera, parent) {
    if (parent === null) {
      camera.matrixWorld.copy(camera.matrix);
    } else {
      camera.matrixWorld.multiplyMatrices(parent.matrixWorld, camera.matrix);
    }
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  this.getCamera = function(camera) {
    cameraVR.near = cameraR.near = cameraL.near = camera.near;
    cameraVR.far = cameraR.far = cameraL.far = camera.far;
    if (_currentDepthNear !== cameraVR.near || _currentDepthFar !== cameraVR.far) {
      session.updateRenderState({
        depthNear: cameraVR.near,
        depthFar: cameraVR.far
      });
      _currentDepthNear = cameraVR.near;
      _currentDepthFar = cameraVR.far;
    }
    const parent = camera.parent;
    const cameras2 = cameraVR.cameras;
    updateCamera(cameraVR, parent);
    for (let i = 0; i < cameras2.length; i++) {
      updateCamera(cameras2[i], parent);
    }
    camera.matrixWorld.copy(cameraVR.matrixWorld);
    camera.matrix.copy(cameraVR.matrix);
    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
    const children = camera.children;
    for (let i = 0, l = children.length; i < l; i++) {
      children[i].updateMatrixWorld(true);
    }
    if (cameras2.length === 2) {
      setProjectionFromUnion(cameraVR, cameraL, cameraR);
    } else {
      cameraVR.projectionMatrix.copy(cameraL.projectionMatrix);
    }
    return cameraVR;
  };
  let onAnimationFrameCallback = null;
  function onAnimationFrame(time, frame) {
    pose = frame.getViewerPose(referenceSpace);
    if (pose !== null) {
      const views = pose.views;
      const baseLayer = session.renderState.baseLayer;
      renderer.setFramebuffer(baseLayer.framebuffer);
      let cameraVRNeedsUpdate = false;
      if (views.length !== cameraVR.cameras.length) {
        cameraVR.cameras.length = 0;
        cameraVRNeedsUpdate = true;
      }
      for (let i = 0; i < views.length; i++) {
        const view = views[i];
        const viewport = baseLayer.getViewport(view);
        const camera = cameras[i];
        camera.matrix.fromArray(view.transform.matrix);
        camera.projectionMatrix.fromArray(view.projectionMatrix);
        camera.viewport.set(viewport.x, viewport.y, viewport.width, viewport.height);
        if (i === 0) {
          cameraVR.matrix.copy(camera.matrix);
        }
        if (cameraVRNeedsUpdate === true) {
          cameraVR.cameras.push(camera);
        }
      }
    }
    const inputSources = session.inputSources;
    for (let i = 0; i < controllers.length; i++) {
      const controller = controllers[i];
      const inputSource = inputSources[i];
      controller.update(inputSource, frame, referenceSpace);
    }
    if (onAnimationFrameCallback)
      onAnimationFrameCallback(time, frame);
  }
  const animation = new WebGLAnimation();
  animation.setAnimationLoop(onAnimationFrame);
  this.setAnimationLoop = function(callback) {
    onAnimationFrameCallback = callback;
  };
  this.dispose = function() {
  };
}
Object.assign(WebXRManager.prototype, EventDispatcher.prototype);
function WebGLMaterials(properties) {
  function refreshFogUniforms(uniforms, fog) {
    uniforms.fogColor.value.copy(fog.color);
    if (fog.isFog) {
      uniforms.fogNear.value = fog.near;
      uniforms.fogFar.value = fog.far;
    } else if (fog.isFogExp2) {
      uniforms.fogDensity.value = fog.density;
    }
  }
  function refreshMaterialUniforms(uniforms, material, pixelRatio, height) {
    if (material.isMeshBasicMaterial) {
      refreshUniformsCommon(uniforms, material);
    } else if (material.isMeshLambertMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsLambert(uniforms, material);
    } else if (material.isMeshToonMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsToon(uniforms, material);
    } else if (material.isMeshPhongMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsPhong(uniforms, material);
    } else if (material.isMeshStandardMaterial) {
      refreshUniformsCommon(uniforms, material);
      if (material.isMeshPhysicalMaterial) {
        refreshUniformsPhysical(uniforms, material);
      } else {
        refreshUniformsStandard(uniforms, material);
      }
    } else if (material.isMeshMatcapMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsMatcap(uniforms, material);
    } else if (material.isMeshDepthMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsDepth(uniforms, material);
    } else if (material.isMeshDistanceMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsDistance(uniforms, material);
    } else if (material.isMeshNormalMaterial) {
      refreshUniformsCommon(uniforms, material);
      refreshUniformsNormal(uniforms, material);
    } else if (material.isLineBasicMaterial) {
      refreshUniformsLine(uniforms, material);
      if (material.isLineDashedMaterial) {
        refreshUniformsDash(uniforms, material);
      }
    } else if (material.isPointsMaterial) {
      refreshUniformsPoints(uniforms, material, pixelRatio, height);
    } else if (material.isSpriteMaterial) {
      refreshUniformsSprites(uniforms, material);
    } else if (material.isShadowMaterial) {
      uniforms.color.value.copy(material.color);
      uniforms.opacity.value = material.opacity;
    } else if (material.isShaderMaterial) {
      material.uniformsNeedUpdate = false;
    }
  }
  function refreshUniformsCommon(uniforms, material) {
    uniforms.opacity.value = material.opacity;
    if (material.color) {
      uniforms.diffuse.value.copy(material.color);
    }
    if (material.emissive) {
      uniforms.emissive.value.copy(material.emissive).multiplyScalar(material.emissiveIntensity);
    }
    if (material.map) {
      uniforms.map.value = material.map;
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
    }
    if (material.specularMap) {
      uniforms.specularMap.value = material.specularMap;
    }
    const envMap = properties.get(material).envMap;
    if (envMap) {
      uniforms.envMap.value = envMap;
      uniforms.flipEnvMap.value = envMap.isCubeTexture && envMap._needsFlipEnvMap ? -1 : 1;
      uniforms.reflectivity.value = material.reflectivity;
      uniforms.refractionRatio.value = material.refractionRatio;
      const maxMipLevel = properties.get(envMap).__maxMipLevel;
      if (maxMipLevel !== void 0) {
        uniforms.maxMipLevel.value = maxMipLevel;
      }
    }
    if (material.lightMap) {
      uniforms.lightMap.value = material.lightMap;
      uniforms.lightMapIntensity.value = material.lightMapIntensity;
    }
    if (material.aoMap) {
      uniforms.aoMap.value = material.aoMap;
      uniforms.aoMapIntensity.value = material.aoMapIntensity;
    }
    let uvScaleMap;
    if (material.map) {
      uvScaleMap = material.map;
    } else if (material.specularMap) {
      uvScaleMap = material.specularMap;
    } else if (material.displacementMap) {
      uvScaleMap = material.displacementMap;
    } else if (material.normalMap) {
      uvScaleMap = material.normalMap;
    } else if (material.bumpMap) {
      uvScaleMap = material.bumpMap;
    } else if (material.roughnessMap) {
      uvScaleMap = material.roughnessMap;
    } else if (material.metalnessMap) {
      uvScaleMap = material.metalnessMap;
    } else if (material.alphaMap) {
      uvScaleMap = material.alphaMap;
    } else if (material.emissiveMap) {
      uvScaleMap = material.emissiveMap;
    } else if (material.clearcoatMap) {
      uvScaleMap = material.clearcoatMap;
    } else if (material.clearcoatNormalMap) {
      uvScaleMap = material.clearcoatNormalMap;
    } else if (material.clearcoatRoughnessMap) {
      uvScaleMap = material.clearcoatRoughnessMap;
    }
    if (uvScaleMap !== void 0) {
      if (uvScaleMap.isWebGLRenderTarget) {
        uvScaleMap = uvScaleMap.texture;
      }
      if (uvScaleMap.matrixAutoUpdate === true) {
        uvScaleMap.updateMatrix();
      }
      uniforms.uvTransform.value.copy(uvScaleMap.matrix);
    }
    let uv2ScaleMap;
    if (material.aoMap) {
      uv2ScaleMap = material.aoMap;
    } else if (material.lightMap) {
      uv2ScaleMap = material.lightMap;
    }
    if (uv2ScaleMap !== void 0) {
      if (uv2ScaleMap.isWebGLRenderTarget) {
        uv2ScaleMap = uv2ScaleMap.texture;
      }
      if (uv2ScaleMap.matrixAutoUpdate === true) {
        uv2ScaleMap.updateMatrix();
      }
      uniforms.uv2Transform.value.copy(uv2ScaleMap.matrix);
    }
  }
  function refreshUniformsLine(uniforms, material) {
    uniforms.diffuse.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
  }
  function refreshUniformsDash(uniforms, material) {
    uniforms.dashSize.value = material.dashSize;
    uniforms.totalSize.value = material.dashSize + material.gapSize;
    uniforms.scale.value = material.scale;
  }
  function refreshUniformsPoints(uniforms, material, pixelRatio, height) {
    uniforms.diffuse.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    uniforms.size.value = material.size * pixelRatio;
    uniforms.scale.value = height * 0.5;
    if (material.map) {
      uniforms.map.value = material.map;
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
    }
    let uvScaleMap;
    if (material.map) {
      uvScaleMap = material.map;
    } else if (material.alphaMap) {
      uvScaleMap = material.alphaMap;
    }
    if (uvScaleMap !== void 0) {
      if (uvScaleMap.matrixAutoUpdate === true) {
        uvScaleMap.updateMatrix();
      }
      uniforms.uvTransform.value.copy(uvScaleMap.matrix);
    }
  }
  function refreshUniformsSprites(uniforms, material) {
    uniforms.diffuse.value.copy(material.color);
    uniforms.opacity.value = material.opacity;
    uniforms.rotation.value = material.rotation;
    if (material.map) {
      uniforms.map.value = material.map;
    }
    if (material.alphaMap) {
      uniforms.alphaMap.value = material.alphaMap;
    }
    let uvScaleMap;
    if (material.map) {
      uvScaleMap = material.map;
    } else if (material.alphaMap) {
      uvScaleMap = material.alphaMap;
    }
    if (uvScaleMap !== void 0) {
      if (uvScaleMap.matrixAutoUpdate === true) {
        uvScaleMap.updateMatrix();
      }
      uniforms.uvTransform.value.copy(uvScaleMap.matrix);
    }
  }
  function refreshUniformsLambert(uniforms, material) {
    if (material.emissiveMap) {
      uniforms.emissiveMap.value = material.emissiveMap;
    }
  }
  function refreshUniformsPhong(uniforms, material) {
    uniforms.specular.value.copy(material.specular);
    uniforms.shininess.value = Math.max(material.shininess, 1e-4);
    if (material.emissiveMap) {
      uniforms.emissiveMap.value = material.emissiveMap;
    }
    if (material.bumpMap) {
      uniforms.bumpMap.value = material.bumpMap;
      uniforms.bumpScale.value = material.bumpScale;
      if (material.side === BackSide)
        uniforms.bumpScale.value *= -1;
    }
    if (material.normalMap) {
      uniforms.normalMap.value = material.normalMap;
      uniforms.normalScale.value.copy(material.normalScale);
      if (material.side === BackSide)
        uniforms.normalScale.value.negate();
    }
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
  }
  function refreshUniformsToon(uniforms, material) {
    if (material.gradientMap) {
      uniforms.gradientMap.value = material.gradientMap;
    }
    if (material.emissiveMap) {
      uniforms.emissiveMap.value = material.emissiveMap;
    }
    if (material.bumpMap) {
      uniforms.bumpMap.value = material.bumpMap;
      uniforms.bumpScale.value = material.bumpScale;
      if (material.side === BackSide)
        uniforms.bumpScale.value *= -1;
    }
    if (material.normalMap) {
      uniforms.normalMap.value = material.normalMap;
      uniforms.normalScale.value.copy(material.normalScale);
      if (material.side === BackSide)
        uniforms.normalScale.value.negate();
    }
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
  }
  function refreshUniformsStandard(uniforms, material) {
    uniforms.roughness.value = material.roughness;
    uniforms.metalness.value = material.metalness;
    if (material.roughnessMap) {
      uniforms.roughnessMap.value = material.roughnessMap;
    }
    if (material.metalnessMap) {
      uniforms.metalnessMap.value = material.metalnessMap;
    }
    if (material.emissiveMap) {
      uniforms.emissiveMap.value = material.emissiveMap;
    }
    if (material.bumpMap) {
      uniforms.bumpMap.value = material.bumpMap;
      uniforms.bumpScale.value = material.bumpScale;
      if (material.side === BackSide)
        uniforms.bumpScale.value *= -1;
    }
    if (material.normalMap) {
      uniforms.normalMap.value = material.normalMap;
      uniforms.normalScale.value.copy(material.normalScale);
      if (material.side === BackSide)
        uniforms.normalScale.value.negate();
    }
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
    const envMap = properties.get(material).envMap;
    if (envMap) {
      uniforms.envMapIntensity.value = material.envMapIntensity;
    }
  }
  function refreshUniformsPhysical(uniforms, material) {
    refreshUniformsStandard(uniforms, material);
    uniforms.reflectivity.value = material.reflectivity;
    uniforms.clearcoat.value = material.clearcoat;
    uniforms.clearcoatRoughness.value = material.clearcoatRoughness;
    if (material.sheen)
      uniforms.sheen.value.copy(material.sheen);
    if (material.clearcoatMap) {
      uniforms.clearcoatMap.value = material.clearcoatMap;
    }
    if (material.clearcoatRoughnessMap) {
      uniforms.clearcoatRoughnessMap.value = material.clearcoatRoughnessMap;
    }
    if (material.clearcoatNormalMap) {
      uniforms.clearcoatNormalScale.value.copy(material.clearcoatNormalScale);
      uniforms.clearcoatNormalMap.value = material.clearcoatNormalMap;
      if (material.side === BackSide) {
        uniforms.clearcoatNormalScale.value.negate();
      }
    }
    uniforms.transmission.value = material.transmission;
    if (material.transmissionMap) {
      uniforms.transmissionMap.value = material.transmissionMap;
    }
  }
  function refreshUniformsMatcap(uniforms, material) {
    if (material.matcap) {
      uniforms.matcap.value = material.matcap;
    }
    if (material.bumpMap) {
      uniforms.bumpMap.value = material.bumpMap;
      uniforms.bumpScale.value = material.bumpScale;
      if (material.side === BackSide)
        uniforms.bumpScale.value *= -1;
    }
    if (material.normalMap) {
      uniforms.normalMap.value = material.normalMap;
      uniforms.normalScale.value.copy(material.normalScale);
      if (material.side === BackSide)
        uniforms.normalScale.value.negate();
    }
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
  }
  function refreshUniformsDepth(uniforms, material) {
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
  }
  function refreshUniformsDistance(uniforms, material) {
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
    uniforms.referencePosition.value.copy(material.referencePosition);
    uniforms.nearDistance.value = material.nearDistance;
    uniforms.farDistance.value = material.farDistance;
  }
  function refreshUniformsNormal(uniforms, material) {
    if (material.bumpMap) {
      uniforms.bumpMap.value = material.bumpMap;
      uniforms.bumpScale.value = material.bumpScale;
      if (material.side === BackSide)
        uniforms.bumpScale.value *= -1;
    }
    if (material.normalMap) {
      uniforms.normalMap.value = material.normalMap;
      uniforms.normalScale.value.copy(material.normalScale);
      if (material.side === BackSide)
        uniforms.normalScale.value.negate();
    }
    if (material.displacementMap) {
      uniforms.displacementMap.value = material.displacementMap;
      uniforms.displacementScale.value = material.displacementScale;
      uniforms.displacementBias.value = material.displacementBias;
    }
  }
  return {
    refreshFogUniforms,
    refreshMaterialUniforms
  };
}
function createCanvasElement() {
  const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.style.display = "block";
  return canvas;
}
function WebGLRenderer(parameters) {
  parameters = parameters || {};
  const _canvas2 = parameters.canvas !== void 0 ? parameters.canvas : createCanvasElement(), _context2 = parameters.context !== void 0 ? parameters.context : null, _alpha = parameters.alpha !== void 0 ? parameters.alpha : false, _depth = parameters.depth !== void 0 ? parameters.depth : true, _stencil = parameters.stencil !== void 0 ? parameters.stencil : true, _antialias = parameters.antialias !== void 0 ? parameters.antialias : false, _premultipliedAlpha = parameters.premultipliedAlpha !== void 0 ? parameters.premultipliedAlpha : true, _preserveDrawingBuffer = parameters.preserveDrawingBuffer !== void 0 ? parameters.preserveDrawingBuffer : false, _powerPreference = parameters.powerPreference !== void 0 ? parameters.powerPreference : "default", _failIfMajorPerformanceCaveat = parameters.failIfMajorPerformanceCaveat !== void 0 ? parameters.failIfMajorPerformanceCaveat : false;
  let currentRenderList = null;
  let currentRenderState = null;
  const renderListStack = [];
  const renderStateStack = [];
  this.domElement = _canvas2;
  this.debug = {
    checkShaderErrors: true
  };
  this.autoClear = true;
  this.autoClearColor = true;
  this.autoClearDepth = true;
  this.autoClearStencil = true;
  this.sortObjects = true;
  this.clippingPlanes = [];
  this.localClippingEnabled = false;
  this.gammaFactor = 2;
  this.outputEncoding = LinearEncoding;
  this.physicallyCorrectLights = false;
  this.toneMapping = NoToneMapping;
  this.toneMappingExposure = 1;
  this.maxMorphTargets = 8;
  this.maxMorphNormals = 4;
  const _this = this;
  let _isContextLost = false;
  let _framebuffer = null;
  let _currentActiveCubeFace = 0;
  let _currentActiveMipmapLevel = 0;
  let _currentRenderTarget = null;
  let _currentFramebuffer = null;
  let _currentMaterialId = -1;
  let _currentCamera = null;
  const _currentViewport = new Vector4();
  const _currentScissor = new Vector4();
  let _currentScissorTest = null;
  let _width = _canvas2.width;
  let _height = _canvas2.height;
  let _pixelRatio = 1;
  let _opaqueSort = null;
  let _transparentSort = null;
  const _viewport = new Vector4(0, 0, _width, _height);
  const _scissor = new Vector4(0, 0, _width, _height);
  let _scissorTest = false;
  const _frustum = new Frustum();
  let _clippingEnabled = false;
  let _localClippingEnabled = false;
  const _projScreenMatrix = new Matrix4();
  const _vector3 = new Vector3();
  const _emptyScene = {background: null, fog: null, environment: null, overrideMaterial: null, isScene: true};
  function getTargetPixelRatio() {
    return _currentRenderTarget === null ? _pixelRatio : 1;
  }
  let _gl = _context2;
  function getContext(contextNames, contextAttributes) {
    for (let i = 0; i < contextNames.length; i++) {
      const contextName = contextNames[i];
      const context = _canvas2.getContext(contextName, contextAttributes);
      if (context !== null)
        return context;
    }
    return null;
  }
  try {
    const contextAttributes = {
      alpha: _alpha,
      depth: _depth,
      stencil: _stencil,
      antialias: _antialias,
      premultipliedAlpha: _premultipliedAlpha,
      preserveDrawingBuffer: _preserveDrawingBuffer,
      powerPreference: _powerPreference,
      failIfMajorPerformanceCaveat: _failIfMajorPerformanceCaveat
    };
    _canvas2.addEventListener("webglcontextlost", onContextLost, false);
    _canvas2.addEventListener("webglcontextrestored", onContextRestore, false);
    if (_gl === null) {
      const contextNames = ["webgl2", "webgl", "experimental-webgl"];
      if (_this.isWebGL1Renderer === true) {
        contextNames.shift();
      }
      _gl = getContext(contextNames, contextAttributes);
      if (_gl === null) {
        if (getContext(contextNames)) {
          throw new Error("Error creating WebGL context with your selected attributes.");
        } else {
          throw new Error("Error creating WebGL context.");
        }
      }
    }
    if (_gl.getShaderPrecisionFormat === void 0) {
      _gl.getShaderPrecisionFormat = function() {
        return {rangeMin: 1, rangeMax: 1, precision: 1};
      };
    }
  } catch (error2) {
    console.error("THREE.WebGLRenderer: " + error2.message);
    throw error2;
  }
  let extensions, capabilities, state, info;
  let properties, textures, cubemaps, attributes, geometries, objects;
  let programCache, materials, renderLists, renderStates, clipping;
  let background, morphtargets, bufferRenderer, indexedBufferRenderer;
  let utils, bindingStates;
  function initGLContext() {
    extensions = new WebGLExtensions(_gl);
    capabilities = new WebGLCapabilities(_gl, extensions, parameters);
    extensions.init(capabilities);
    utils = new WebGLUtils(_gl, extensions, capabilities);
    state = new WebGLState(_gl, extensions, capabilities);
    state.scissor(_currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor());
    state.viewport(_currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor());
    info = new WebGLInfo(_gl);
    properties = new WebGLProperties();
    textures = new WebGLTextures(_gl, extensions, state, properties, capabilities, utils, info);
    cubemaps = new WebGLCubeMaps(_this);
    attributes = new WebGLAttributes(_gl, capabilities);
    bindingStates = new WebGLBindingStates(_gl, extensions, attributes, capabilities);
    geometries = new WebGLGeometries(_gl, attributes, info, bindingStates);
    objects = new WebGLObjects(_gl, geometries, attributes, info);
    morphtargets = new WebGLMorphtargets(_gl);
    clipping = new WebGLClipping(properties);
    programCache = new WebGLPrograms(_this, cubemaps, extensions, capabilities, bindingStates, clipping);
    materials = new WebGLMaterials(properties);
    renderLists = new WebGLRenderLists(properties);
    renderStates = new WebGLRenderStates(extensions, capabilities);
    background = new WebGLBackground(_this, cubemaps, state, objects, _premultipliedAlpha);
    bufferRenderer = new WebGLBufferRenderer(_gl, extensions, info, capabilities);
    indexedBufferRenderer = new WebGLIndexedBufferRenderer(_gl, extensions, info, capabilities);
    info.programs = programCache.programs;
    _this.capabilities = capabilities;
    _this.extensions = extensions;
    _this.properties = properties;
    _this.renderLists = renderLists;
    _this.state = state;
    _this.info = info;
  }
  initGLContext();
  const xr = new WebXRManager(_this, _gl);
  this.xr = xr;
  const shadowMap = new WebGLShadowMap(_this, objects, capabilities.maxTextureSize);
  this.shadowMap = shadowMap;
  this.getContext = function() {
    return _gl;
  };
  this.getContextAttributes = function() {
    return _gl.getContextAttributes();
  };
  this.forceContextLoss = function() {
    const extension = extensions.get("WEBGL_lose_context");
    if (extension)
      extension.loseContext();
  };
  this.forceContextRestore = function() {
    const extension = extensions.get("WEBGL_lose_context");
    if (extension)
      extension.restoreContext();
  };
  this.getPixelRatio = function() {
    return _pixelRatio;
  };
  this.setPixelRatio = function(value) {
    if (value === void 0)
      return;
    _pixelRatio = value;
    this.setSize(_width, _height, false);
  };
  this.getSize = function(target) {
    if (target === void 0) {
      console.warn("WebGLRenderer: .getsize() now requires a Vector2 as an argument");
      target = new Vector2();
    }
    return target.set(_width, _height);
  };
  this.setSize = function(width, height, updateStyle) {
    if (xr.isPresenting) {
      console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");
      return;
    }
    _width = width;
    _height = height;
    _canvas2.width = Math.floor(width * _pixelRatio);
    _canvas2.height = Math.floor(height * _pixelRatio);
    if (updateStyle !== false) {
      _canvas2.style.width = width + "px";
      _canvas2.style.height = height + "px";
    }
    this.setViewport(0, 0, width, height);
  };
  this.getDrawingBufferSize = function(target) {
    if (target === void 0) {
      console.warn("WebGLRenderer: .getdrawingBufferSize() now requires a Vector2 as an argument");
      target = new Vector2();
    }
    return target.set(_width * _pixelRatio, _height * _pixelRatio).floor();
  };
  this.setDrawingBufferSize = function(width, height, pixelRatio) {
    _width = width;
    _height = height;
    _pixelRatio = pixelRatio;
    _canvas2.width = Math.floor(width * pixelRatio);
    _canvas2.height = Math.floor(height * pixelRatio);
    this.setViewport(0, 0, width, height);
  };
  this.getCurrentViewport = function(target) {
    if (target === void 0) {
      console.warn("WebGLRenderer: .getCurrentViewport() now requires a Vector4 as an argument");
      target = new Vector4();
    }
    return target.copy(_currentViewport);
  };
  this.getViewport = function(target) {
    return target.copy(_viewport);
  };
  this.setViewport = function(x, y, width, height) {
    if (x.isVector4) {
      _viewport.set(x.x, x.y, x.z, x.w);
    } else {
      _viewport.set(x, y, width, height);
    }
    state.viewport(_currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor());
  };
  this.getScissor = function(target) {
    return target.copy(_scissor);
  };
  this.setScissor = function(x, y, width, height) {
    if (x.isVector4) {
      _scissor.set(x.x, x.y, x.z, x.w);
    } else {
      _scissor.set(x, y, width, height);
    }
    state.scissor(_currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor());
  };
  this.getScissorTest = function() {
    return _scissorTest;
  };
  this.setScissorTest = function(boolean) {
    state.setScissorTest(_scissorTest = boolean);
  };
  this.setOpaqueSort = function(method) {
    _opaqueSort = method;
  };
  this.setTransparentSort = function(method) {
    _transparentSort = method;
  };
  this.getClearColor = function(target) {
    if (target === void 0) {
      console.warn("WebGLRenderer: .getClearColor() now requires a Color as an argument");
      target = new Color();
    }
    return target.copy(background.getClearColor());
  };
  this.setClearColor = function() {
    background.setClearColor.apply(background, arguments);
  };
  this.getClearAlpha = function() {
    return background.getClearAlpha();
  };
  this.setClearAlpha = function() {
    background.setClearAlpha.apply(background, arguments);
  };
  this.clear = function(color, depth, stencil) {
    let bits = 0;
    if (color === void 0 || color)
      bits |= 16384;
    if (depth === void 0 || depth)
      bits |= 256;
    if (stencil === void 0 || stencil)
      bits |= 1024;
    _gl.clear(bits);
  };
  this.clearColor = function() {
    this.clear(true, false, false);
  };
  this.clearDepth = function() {
    this.clear(false, true, false);
  };
  this.clearStencil = function() {
    this.clear(false, false, true);
  };
  this.dispose = function() {
    _canvas2.removeEventListener("webglcontextlost", onContextLost, false);
    _canvas2.removeEventListener("webglcontextrestored", onContextRestore, false);
    renderLists.dispose();
    renderStates.dispose();
    properties.dispose();
    cubemaps.dispose();
    objects.dispose();
    bindingStates.dispose();
    xr.dispose();
    animation.stop();
  };
  function onContextLost(event) {
    event.preventDefault();
    console.log("THREE.WebGLRenderer: Context Lost.");
    _isContextLost = true;
  }
  function onContextRestore() {
    console.log("THREE.WebGLRenderer: Context Restored.");
    _isContextLost = false;
    initGLContext();
  }
  function onMaterialDispose(event) {
    const material = event.target;
    material.removeEventListener("dispose", onMaterialDispose);
    deallocateMaterial(material);
  }
  function deallocateMaterial(material) {
    releaseMaterialProgramReference(material);
    properties.remove(material);
  }
  function releaseMaterialProgramReference(material) {
    const programInfo = properties.get(material).program;
    if (programInfo !== void 0) {
      programCache.releaseProgram(programInfo);
    }
  }
  function renderObjectImmediate(object, program) {
    object.render(function(object2) {
      _this.renderBufferImmediate(object2, program);
    });
  }
  this.renderBufferImmediate = function(object, program) {
    bindingStates.initAttributes();
    const buffers = properties.get(object);
    if (object.hasPositions && !buffers.position)
      buffers.position = _gl.createBuffer();
    if (object.hasNormals && !buffers.normal)
      buffers.normal = _gl.createBuffer();
    if (object.hasUvs && !buffers.uv)
      buffers.uv = _gl.createBuffer();
    if (object.hasColors && !buffers.color)
      buffers.color = _gl.createBuffer();
    const programAttributes = program.getAttributes();
    if (object.hasPositions) {
      _gl.bindBuffer(34962, buffers.position);
      _gl.bufferData(34962, object.positionArray, 35048);
      bindingStates.enableAttribute(programAttributes.position);
      _gl.vertexAttribPointer(programAttributes.position, 3, 5126, false, 0, 0);
    }
    if (object.hasNormals) {
      _gl.bindBuffer(34962, buffers.normal);
      _gl.bufferData(34962, object.normalArray, 35048);
      bindingStates.enableAttribute(programAttributes.normal);
      _gl.vertexAttribPointer(programAttributes.normal, 3, 5126, false, 0, 0);
    }
    if (object.hasUvs) {
      _gl.bindBuffer(34962, buffers.uv);
      _gl.bufferData(34962, object.uvArray, 35048);
      bindingStates.enableAttribute(programAttributes.uv);
      _gl.vertexAttribPointer(programAttributes.uv, 2, 5126, false, 0, 0);
    }
    if (object.hasColors) {
      _gl.bindBuffer(34962, buffers.color);
      _gl.bufferData(34962, object.colorArray, 35048);
      bindingStates.enableAttribute(programAttributes.color);
      _gl.vertexAttribPointer(programAttributes.color, 3, 5126, false, 0, 0);
    }
    bindingStates.disableUnusedAttributes();
    _gl.drawArrays(4, 0, object.count);
    object.count = 0;
  };
  this.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
    if (scene === null)
      scene = _emptyScene;
    const frontFaceCW = object.isMesh && object.matrixWorld.determinant() < 0;
    const program = setProgram(camera, scene, material, object);
    state.setMaterial(material, frontFaceCW);
    let index2 = geometry.index;
    const position = geometry.attributes.position;
    if (index2 === null) {
      if (position === void 0 || position.count === 0)
        return;
    } else if (index2.count === 0) {
      return;
    }
    let rangeFactor = 1;
    if (material.wireframe === true) {
      index2 = geometries.getWireframeAttribute(geometry);
      rangeFactor = 2;
    }
    if (material.morphTargets || material.morphNormals) {
      morphtargets.update(object, geometry, material, program);
    }
    bindingStates.setup(object, material, program, geometry, index2);
    let attribute;
    let renderer = bufferRenderer;
    if (index2 !== null) {
      attribute = attributes.get(index2);
      renderer = indexedBufferRenderer;
      renderer.setIndex(attribute);
    }
    const dataCount = index2 !== null ? index2.count : position.count;
    const rangeStart = geometry.drawRange.start * rangeFactor;
    const rangeCount = geometry.drawRange.count * rangeFactor;
    const groupStart = group !== null ? group.start * rangeFactor : 0;
    const groupCount = group !== null ? group.count * rangeFactor : Infinity;
    const drawStart = Math.max(rangeStart, groupStart);
    const drawEnd = Math.min(dataCount, rangeStart + rangeCount, groupStart + groupCount) - 1;
    const drawCount = Math.max(0, drawEnd - drawStart + 1);
    if (drawCount === 0)
      return;
    if (object.isMesh) {
      if (material.wireframe === true) {
        state.setLineWidth(material.wireframeLinewidth * getTargetPixelRatio());
        renderer.setMode(1);
      } else {
        renderer.setMode(4);
      }
    } else if (object.isLine) {
      let lineWidth = material.linewidth;
      if (lineWidth === void 0)
        lineWidth = 1;
      state.setLineWidth(lineWidth * getTargetPixelRatio());
      if (object.isLineSegments) {
        renderer.setMode(1);
      } else if (object.isLineLoop) {
        renderer.setMode(2);
      } else {
        renderer.setMode(3);
      }
    } else if (object.isPoints) {
      renderer.setMode(0);
    } else if (object.isSprite) {
      renderer.setMode(4);
    }
    if (object.isInstancedMesh) {
      renderer.renderInstances(drawStart, drawCount, object.count);
    } else if (geometry.isInstancedBufferGeometry) {
      const instanceCount = Math.min(geometry.instanceCount, geometry._maxInstanceCount);
      renderer.renderInstances(drawStart, drawCount, instanceCount);
    } else {
      renderer.render(drawStart, drawCount);
    }
  };
  this.compile = function(scene, camera) {
    currentRenderState = renderStates.get(scene);
    currentRenderState.init();
    scene.traverseVisible(function(object) {
      if (object.isLight && object.layers.test(camera.layers)) {
        currentRenderState.pushLight(object);
        if (object.castShadow) {
          currentRenderState.pushShadow(object);
        }
      }
    });
    currentRenderState.setupLights();
    const compiled = new WeakMap();
    scene.traverse(function(object) {
      const material = object.material;
      if (material) {
        if (Array.isArray(material)) {
          for (let i = 0; i < material.length; i++) {
            const material2 = material[i];
            if (compiled.has(material2) === false) {
              initMaterial(material2, scene, object);
              compiled.set(material2);
            }
          }
        } else if (compiled.has(material) === false) {
          initMaterial(material, scene, object);
          compiled.set(material);
        }
      }
    });
  };
  let onAnimationFrameCallback = null;
  function onAnimationFrame(time) {
    if (xr.isPresenting)
      return;
    if (onAnimationFrameCallback)
      onAnimationFrameCallback(time);
  }
  const animation = new WebGLAnimation();
  animation.setAnimationLoop(onAnimationFrame);
  if (typeof window !== "undefined")
    animation.setContext(window);
  this.setAnimationLoop = function(callback) {
    onAnimationFrameCallback = callback;
    xr.setAnimationLoop(callback);
    callback === null ? animation.stop() : animation.start();
  };
  this.render = function(scene, camera) {
    let renderTarget, forceClear;
    if (arguments[2] !== void 0) {
      console.warn("THREE.WebGLRenderer.render(): the renderTarget argument has been removed. Use .setRenderTarget() instead.");
      renderTarget = arguments[2];
    }
    if (arguments[3] !== void 0) {
      console.warn("THREE.WebGLRenderer.render(): the forceClear argument has been removed. Use .clear() instead.");
      forceClear = arguments[3];
    }
    if (camera !== void 0 && camera.isCamera !== true) {
      console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");
      return;
    }
    if (_isContextLost === true)
      return;
    bindingStates.resetDefaultState();
    _currentMaterialId = -1;
    _currentCamera = null;
    if (scene.autoUpdate === true)
      scene.updateMatrixWorld();
    if (camera.parent === null)
      camera.updateMatrixWorld();
    if (xr.enabled === true && xr.isPresenting === true) {
      camera = xr.getCamera(camera);
    }
    if (scene.isScene === true)
      scene.onBeforeRender(_this, scene, camera, renderTarget || _currentRenderTarget);
    currentRenderState = renderStates.get(scene, renderStateStack.length);
    currentRenderState.init();
    renderStateStack.push(currentRenderState);
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    _localClippingEnabled = this.localClippingEnabled;
    _clippingEnabled = clipping.init(this.clippingPlanes, _localClippingEnabled, camera);
    currentRenderList = renderLists.get(scene, renderListStack.length);
    currentRenderList.init();
    renderListStack.push(currentRenderList);
    projectObject(scene, camera, 0, _this.sortObjects);
    currentRenderList.finish();
    if (_this.sortObjects === true) {
      currentRenderList.sort(_opaqueSort, _transparentSort);
    }
    if (_clippingEnabled === true)
      clipping.beginShadows();
    const shadowsArray = currentRenderState.state.shadowsArray;
    shadowMap.render(shadowsArray, scene, camera);
    currentRenderState.setupLights();
    currentRenderState.setupLightsView(camera);
    if (_clippingEnabled === true)
      clipping.endShadows();
    if (this.info.autoReset === true)
      this.info.reset();
    if (renderTarget !== void 0) {
      this.setRenderTarget(renderTarget);
    }
    background.render(currentRenderList, scene, camera, forceClear);
    const opaqueObjects = currentRenderList.opaque;
    const transparentObjects = currentRenderList.transparent;
    if (opaqueObjects.length > 0)
      renderObjects(opaqueObjects, scene, camera);
    if (transparentObjects.length > 0)
      renderObjects(transparentObjects, scene, camera);
    if (scene.isScene === true)
      scene.onAfterRender(_this, scene, camera);
    if (_currentRenderTarget !== null) {
      textures.updateRenderTargetMipmap(_currentRenderTarget);
      textures.updateMultisampleRenderTarget(_currentRenderTarget);
    }
    state.buffers.depth.setTest(true);
    state.buffers.depth.setMask(true);
    state.buffers.color.setMask(true);
    state.setPolygonOffset(false);
    renderStateStack.pop();
    if (renderStateStack.length > 0) {
      currentRenderState = renderStateStack[renderStateStack.length - 1];
    } else {
      currentRenderState = null;
    }
    renderListStack.pop();
    if (renderListStack.length > 0) {
      currentRenderList = renderListStack[renderListStack.length - 1];
    } else {
      currentRenderList = null;
    }
  };
  function projectObject(object, camera, groupOrder, sortObjects) {
    if (object.visible === false)
      return;
    const visible = object.layers.test(camera.layers);
    if (visible) {
      if (object.isGroup) {
        groupOrder = object.renderOrder;
      } else if (object.isLOD) {
        if (object.autoUpdate === true)
          object.update(camera);
      } else if (object.isLight) {
        currentRenderState.pushLight(object);
        if (object.castShadow) {
          currentRenderState.pushShadow(object);
        }
      } else if (object.isSprite) {
        if (!object.frustumCulled || _frustum.intersectsSprite(object)) {
          if (sortObjects) {
            _vector3.setFromMatrixPosition(object.matrixWorld).applyMatrix4(_projScreenMatrix);
          }
          const geometry = objects.update(object);
          const material = object.material;
          if (material.visible) {
            currentRenderList.push(object, geometry, material, groupOrder, _vector3.z, null);
          }
        }
      } else if (object.isImmediateRenderObject) {
        if (sortObjects) {
          _vector3.setFromMatrixPosition(object.matrixWorld).applyMatrix4(_projScreenMatrix);
        }
        currentRenderList.push(object, null, object.material, groupOrder, _vector3.z, null);
      } else if (object.isMesh || object.isLine || object.isPoints) {
        if (object.isSkinnedMesh) {
          if (object.skeleton.frame !== info.render.frame) {
            object.skeleton.update();
            object.skeleton.frame = info.render.frame;
          }
        }
        if (!object.frustumCulled || _frustum.intersectsObject(object)) {
          if (sortObjects) {
            _vector3.setFromMatrixPosition(object.matrixWorld).applyMatrix4(_projScreenMatrix);
          }
          const geometry = objects.update(object);
          const material = object.material;
          if (Array.isArray(material)) {
            const groups = geometry.groups;
            for (let i = 0, l = groups.length; i < l; i++) {
              const group = groups[i];
              const groupMaterial = material[group.materialIndex];
              if (groupMaterial && groupMaterial.visible) {
                currentRenderList.push(object, geometry, groupMaterial, groupOrder, _vector3.z, group);
              }
            }
          } else if (material.visible) {
            currentRenderList.push(object, geometry, material, groupOrder, _vector3.z, null);
          }
        }
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      projectObject(children[i], camera, groupOrder, sortObjects);
    }
  }
  function renderObjects(renderList, scene, camera) {
    const overrideMaterial = scene.isScene === true ? scene.overrideMaterial : null;
    for (let i = 0, l = renderList.length; i < l; i++) {
      const renderItem = renderList[i];
      const object = renderItem.object;
      const geometry = renderItem.geometry;
      const material = overrideMaterial === null ? renderItem.material : overrideMaterial;
      const group = renderItem.group;
      if (camera.isArrayCamera) {
        const cameras = camera.cameras;
        for (let j = 0, jl = cameras.length; j < jl; j++) {
          const camera2 = cameras[j];
          if (object.layers.test(camera2.layers)) {
            state.viewport(_currentViewport.copy(camera2.viewport));
            currentRenderState.setupLightsView(camera2);
            renderObject(object, scene, camera2, geometry, material, group);
          }
        }
      } else {
        renderObject(object, scene, camera, geometry, material, group);
      }
    }
  }
  function renderObject(object, scene, camera, geometry, material, group) {
    object.onBeforeRender(_this, scene, camera, geometry, material, group);
    object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
    object.normalMatrix.getNormalMatrix(object.modelViewMatrix);
    if (object.isImmediateRenderObject) {
      const program = setProgram(camera, scene, material, object);
      state.setMaterial(material);
      bindingStates.reset();
      renderObjectImmediate(object, program);
    } else {
      _this.renderBufferDirect(camera, scene, geometry, material, object, group);
    }
    object.onAfterRender(_this, scene, camera, geometry, material, group);
  }
  function initMaterial(material, scene, object) {
    if (scene.isScene !== true)
      scene = _emptyScene;
    const materialProperties = properties.get(material);
    const lights = currentRenderState.state.lights;
    const shadowsArray = currentRenderState.state.shadowsArray;
    const lightsStateVersion = lights.state.version;
    const parameters2 = programCache.getParameters(material, lights.state, shadowsArray, scene, object);
    const programCacheKey = programCache.getProgramCacheKey(parameters2);
    let program = materialProperties.program;
    let programChange = true;
    materialProperties.environment = material.isMeshStandardMaterial ? scene.environment : null;
    materialProperties.fog = scene.fog;
    materialProperties.envMap = cubemaps.get(material.envMap || materialProperties.environment);
    if (program === void 0) {
      material.addEventListener("dispose", onMaterialDispose);
    } else if (program.cacheKey !== programCacheKey) {
      releaseMaterialProgramReference(material);
    } else if (materialProperties.lightsStateVersion !== lightsStateVersion) {
      programChange = false;
    } else if (parameters2.shaderID !== void 0) {
      return;
    } else {
      programChange = false;
    }
    if (programChange) {
      parameters2.uniforms = programCache.getUniforms(material);
      material.onBeforeCompile(parameters2, _this);
      program = programCache.acquireProgram(parameters2, programCacheKey);
      materialProperties.program = program;
      materialProperties.uniforms = parameters2.uniforms;
      materialProperties.outputEncoding = parameters2.outputEncoding;
    }
    const uniforms = materialProperties.uniforms;
    if (!material.isShaderMaterial && !material.isRawShaderMaterial || material.clipping === true) {
      materialProperties.numClippingPlanes = clipping.numPlanes;
      materialProperties.numIntersection = clipping.numIntersection;
      uniforms.clippingPlanes = clipping.uniform;
    }
    materialProperties.needsLights = materialNeedsLights(material);
    materialProperties.lightsStateVersion = lightsStateVersion;
    if (materialProperties.needsLights) {
      uniforms.ambientLightColor.value = lights.state.ambient;
      uniforms.lightProbe.value = lights.state.probe;
      uniforms.directionalLights.value = lights.state.directional;
      uniforms.directionalLightShadows.value = lights.state.directionalShadow;
      uniforms.spotLights.value = lights.state.spot;
      uniforms.spotLightShadows.value = lights.state.spotShadow;
      uniforms.rectAreaLights.value = lights.state.rectArea;
      uniforms.ltc_1.value = lights.state.rectAreaLTC1;
      uniforms.ltc_2.value = lights.state.rectAreaLTC2;
      uniforms.pointLights.value = lights.state.point;
      uniforms.pointLightShadows.value = lights.state.pointShadow;
      uniforms.hemisphereLights.value = lights.state.hemi;
      uniforms.directionalShadowMap.value = lights.state.directionalShadowMap;
      uniforms.directionalShadowMatrix.value = lights.state.directionalShadowMatrix;
      uniforms.spotShadowMap.value = lights.state.spotShadowMap;
      uniforms.spotShadowMatrix.value = lights.state.spotShadowMatrix;
      uniforms.pointShadowMap.value = lights.state.pointShadowMap;
      uniforms.pointShadowMatrix.value = lights.state.pointShadowMatrix;
    }
    const progUniforms = materialProperties.program.getUniforms();
    const uniformsList = WebGLUniforms.seqWithValue(progUniforms.seq, uniforms);
    materialProperties.uniformsList = uniformsList;
  }
  function setProgram(camera, scene, material, object) {
    if (scene.isScene !== true)
      scene = _emptyScene;
    textures.resetTextureUnits();
    const fog = scene.fog;
    const environment = material.isMeshStandardMaterial ? scene.environment : null;
    const encoding = _currentRenderTarget === null ? _this.outputEncoding : _currentRenderTarget.texture.encoding;
    const envMap = cubemaps.get(material.envMap || environment);
    const materialProperties = properties.get(material);
    const lights = currentRenderState.state.lights;
    if (_clippingEnabled === true) {
      if (_localClippingEnabled === true || camera !== _currentCamera) {
        const useCache = camera === _currentCamera && material.id === _currentMaterialId;
        clipping.setState(material, camera, useCache);
      }
    }
    if (material.version === materialProperties.__version) {
      if (material.fog && materialProperties.fog !== fog) {
        initMaterial(material, scene, object);
      } else if (materialProperties.environment !== environment) {
        initMaterial(material, scene, object);
      } else if (materialProperties.needsLights && materialProperties.lightsStateVersion !== lights.state.version) {
        initMaterial(material, scene, object);
      } else if (materialProperties.numClippingPlanes !== void 0 && (materialProperties.numClippingPlanes !== clipping.numPlanes || materialProperties.numIntersection !== clipping.numIntersection)) {
        initMaterial(material, scene, object);
      } else if (materialProperties.outputEncoding !== encoding) {
        initMaterial(material, scene, object);
      } else if (materialProperties.envMap !== envMap) {
        initMaterial(material, scene, object);
      }
    } else {
      initMaterial(material, scene, object);
      materialProperties.__version = material.version;
    }
    let refreshProgram = false;
    let refreshMaterial = false;
    let refreshLights = false;
    const program = materialProperties.program, p_uniforms = program.getUniforms(), m_uniforms = materialProperties.uniforms;
    if (state.useProgram(program.program)) {
      refreshProgram = true;
      refreshMaterial = true;
      refreshLights = true;
    }
    if (material.id !== _currentMaterialId) {
      _currentMaterialId = material.id;
      refreshMaterial = true;
    }
    if (refreshProgram || _currentCamera !== camera) {
      p_uniforms.setValue(_gl, "projectionMatrix", camera.projectionMatrix);
      if (capabilities.logarithmicDepthBuffer) {
        p_uniforms.setValue(_gl, "logDepthBufFC", 2 / (Math.log(camera.far + 1) / Math.LN2));
      }
      if (_currentCamera !== camera) {
        _currentCamera = camera;
        refreshMaterial = true;
        refreshLights = true;
      }
      if (material.isShaderMaterial || material.isMeshPhongMaterial || material.isMeshToonMaterial || material.isMeshStandardMaterial || material.envMap) {
        const uCamPos = p_uniforms.map.cameraPosition;
        if (uCamPos !== void 0) {
          uCamPos.setValue(_gl, _vector3.setFromMatrixPosition(camera.matrixWorld));
        }
      }
      if (material.isMeshPhongMaterial || material.isMeshToonMaterial || material.isMeshLambertMaterial || material.isMeshBasicMaterial || material.isMeshStandardMaterial || material.isShaderMaterial) {
        p_uniforms.setValue(_gl, "isOrthographic", camera.isOrthographicCamera === true);
      }
      if (material.isMeshPhongMaterial || material.isMeshToonMaterial || material.isMeshLambertMaterial || material.isMeshBasicMaterial || material.isMeshStandardMaterial || material.isShaderMaterial || material.isShadowMaterial || material.skinning) {
        p_uniforms.setValue(_gl, "viewMatrix", camera.matrixWorldInverse);
      }
    }
    if (material.skinning) {
      p_uniforms.setOptional(_gl, object, "bindMatrix");
      p_uniforms.setOptional(_gl, object, "bindMatrixInverse");
      const skeleton = object.skeleton;
      if (skeleton) {
        const bones = skeleton.bones;
        if (capabilities.floatVertexTextures) {
          if (skeleton.boneTexture === null) {
            let size = Math.sqrt(bones.length * 4);
            size = MathUtils.ceilPowerOfTwo(size);
            size = Math.max(size, 4);
            const boneMatrices = new Float32Array(size * size * 4);
            boneMatrices.set(skeleton.boneMatrices);
            const boneTexture = new DataTexture(boneMatrices, size, size, RGBAFormat, FloatType);
            skeleton.boneMatrices = boneMatrices;
            skeleton.boneTexture = boneTexture;
            skeleton.boneTextureSize = size;
          }
          p_uniforms.setValue(_gl, "boneTexture", skeleton.boneTexture, textures);
          p_uniforms.setValue(_gl, "boneTextureSize", skeleton.boneTextureSize);
        } else {
          p_uniforms.setOptional(_gl, skeleton, "boneMatrices");
        }
      }
    }
    if (refreshMaterial || materialProperties.receiveShadow !== object.receiveShadow) {
      materialProperties.receiveShadow = object.receiveShadow;
      p_uniforms.setValue(_gl, "receiveShadow", object.receiveShadow);
    }
    if (refreshMaterial) {
      p_uniforms.setValue(_gl, "toneMappingExposure", _this.toneMappingExposure);
      if (materialProperties.needsLights) {
        markUniformsLightsNeedsUpdate(m_uniforms, refreshLights);
      }
      if (fog && material.fog) {
        materials.refreshFogUniforms(m_uniforms, fog);
      }
      materials.refreshMaterialUniforms(m_uniforms, material, _pixelRatio, _height);
      WebGLUniforms.upload(_gl, materialProperties.uniformsList, m_uniforms, textures);
    }
    if (material.isShaderMaterial && material.uniformsNeedUpdate === true) {
      WebGLUniforms.upload(_gl, materialProperties.uniformsList, m_uniforms, textures);
      material.uniformsNeedUpdate = false;
    }
    if (material.isSpriteMaterial) {
      p_uniforms.setValue(_gl, "center", object.center);
    }
    p_uniforms.setValue(_gl, "modelViewMatrix", object.modelViewMatrix);
    p_uniforms.setValue(_gl, "normalMatrix", object.normalMatrix);
    p_uniforms.setValue(_gl, "modelMatrix", object.matrixWorld);
    return program;
  }
  function markUniformsLightsNeedsUpdate(uniforms, value) {
    uniforms.ambientLightColor.needsUpdate = value;
    uniforms.lightProbe.needsUpdate = value;
    uniforms.directionalLights.needsUpdate = value;
    uniforms.directionalLightShadows.needsUpdate = value;
    uniforms.pointLights.needsUpdate = value;
    uniforms.pointLightShadows.needsUpdate = value;
    uniforms.spotLights.needsUpdate = value;
    uniforms.spotLightShadows.needsUpdate = value;
    uniforms.rectAreaLights.needsUpdate = value;
    uniforms.hemisphereLights.needsUpdate = value;
  }
  function materialNeedsLights(material) {
    return material.isMeshLambertMaterial || material.isMeshToonMaterial || material.isMeshPhongMaterial || material.isMeshStandardMaterial || material.isShadowMaterial || material.isShaderMaterial && material.lights === true;
  }
  this.setFramebuffer = function(value) {
    if (_framebuffer !== value && _currentRenderTarget === null)
      _gl.bindFramebuffer(36160, value);
    _framebuffer = value;
  };
  this.getActiveCubeFace = function() {
    return _currentActiveCubeFace;
  };
  this.getActiveMipmapLevel = function() {
    return _currentActiveMipmapLevel;
  };
  this.getRenderTarget = function() {
    return _currentRenderTarget;
  };
  this.setRenderTarget = function(renderTarget, activeCubeFace = 0, activeMipmapLevel = 0) {
    _currentRenderTarget = renderTarget;
    _currentActiveCubeFace = activeCubeFace;
    _currentActiveMipmapLevel = activeMipmapLevel;
    if (renderTarget && properties.get(renderTarget).__webglFramebuffer === void 0) {
      textures.setupRenderTarget(renderTarget);
    }
    let framebuffer = _framebuffer;
    let isCube = false;
    let isRenderTarget3D = false;
    if (renderTarget) {
      const texture = renderTarget.texture;
      if (texture.isDataTexture3D || texture.isDataTexture2DArray) {
        isRenderTarget3D = true;
      }
      const __webglFramebuffer = properties.get(renderTarget).__webglFramebuffer;
      if (renderTarget.isWebGLCubeRenderTarget) {
        framebuffer = __webglFramebuffer[activeCubeFace];
        isCube = true;
      } else if (renderTarget.isWebGLMultisampleRenderTarget) {
        framebuffer = properties.get(renderTarget).__webglMultisampledFramebuffer;
      } else {
        framebuffer = __webglFramebuffer;
      }
      _currentViewport.copy(renderTarget.viewport);
      _currentScissor.copy(renderTarget.scissor);
      _currentScissorTest = renderTarget.scissorTest;
    } else {
      _currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor();
      _currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor();
      _currentScissorTest = _scissorTest;
    }
    if (_currentFramebuffer !== framebuffer) {
      _gl.bindFramebuffer(36160, framebuffer);
      _currentFramebuffer = framebuffer;
    }
    state.viewport(_currentViewport);
    state.scissor(_currentScissor);
    state.setScissorTest(_currentScissorTest);
    if (isCube) {
      const textureProperties = properties.get(renderTarget.texture);
      _gl.framebufferTexture2D(36160, 36064, 34069 + activeCubeFace, textureProperties.__webglTexture, activeMipmapLevel);
    } else if (isRenderTarget3D) {
      const textureProperties = properties.get(renderTarget.texture);
      const layer = activeCubeFace || 0;
      _gl.framebufferTextureLayer(36160, 36064, textureProperties.__webglTexture, activeMipmapLevel || 0, layer);
    }
  };
  this.readRenderTargetPixels = function(renderTarget, x, y, width, height, buffer, activeCubeFaceIndex) {
    if (!(renderTarget && renderTarget.isWebGLRenderTarget)) {
      console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
      return;
    }
    let framebuffer = properties.get(renderTarget).__webglFramebuffer;
    if (renderTarget.isWebGLCubeRenderTarget && activeCubeFaceIndex !== void 0) {
      framebuffer = framebuffer[activeCubeFaceIndex];
    }
    if (framebuffer) {
      let restore = false;
      if (framebuffer !== _currentFramebuffer) {
        _gl.bindFramebuffer(36160, framebuffer);
        restore = true;
      }
      try {
        const texture = renderTarget.texture;
        const textureFormat = texture.format;
        const textureType = texture.type;
        if (textureFormat !== RGBAFormat && utils.convert(textureFormat) !== _gl.getParameter(35739)) {
          console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");
          return;
        }
        const halfFloatSupportedByExt = textureType === HalfFloatType && (extensions.has("EXT_color_buffer_half_float") || capabilities.isWebGL2 && extensions.has("EXT_color_buffer_float"));
        if (textureType !== UnsignedByteType && utils.convert(textureType) !== _gl.getParameter(35738) && !(textureType === FloatType && (capabilities.isWebGL2 || extensions.has("OES_texture_float") || extensions.has("WEBGL_color_buffer_float"))) && !halfFloatSupportedByExt) {
          console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");
          return;
        }
        if (_gl.checkFramebufferStatus(36160) === 36053) {
          if (x >= 0 && x <= renderTarget.width - width && (y >= 0 && y <= renderTarget.height - height)) {
            _gl.readPixels(x, y, width, height, utils.convert(textureFormat), utils.convert(textureType), buffer);
          }
        } else {
          console.error("THREE.WebGLRenderer.readRenderTargetPixels: readPixels from renderTarget failed. Framebuffer not complete.");
        }
      } finally {
        if (restore) {
          _gl.bindFramebuffer(36160, _currentFramebuffer);
        }
      }
    }
  };
  this.copyFramebufferToTexture = function(position, texture, level = 0) {
    const levelScale = Math.pow(2, -level);
    const width = Math.floor(texture.image.width * levelScale);
    const height = Math.floor(texture.image.height * levelScale);
    const glFormat = utils.convert(texture.format);
    textures.setTexture2D(texture, 0);
    _gl.copyTexImage2D(3553, level, glFormat, position.x, position.y, width, height, 0);
    state.unbindTexture();
  };
  this.copyTextureToTexture = function(position, srcTexture, dstTexture, level = 0) {
    const width = srcTexture.image.width;
    const height = srcTexture.image.height;
    const glFormat = utils.convert(dstTexture.format);
    const glType = utils.convert(dstTexture.type);
    textures.setTexture2D(dstTexture, 0);
    _gl.pixelStorei(37440, dstTexture.flipY);
    _gl.pixelStorei(37441, dstTexture.premultiplyAlpha);
    _gl.pixelStorei(3317, dstTexture.unpackAlignment);
    if (srcTexture.isDataTexture) {
      _gl.texSubImage2D(3553, level, position.x, position.y, width, height, glFormat, glType, srcTexture.image.data);
    } else {
      if (srcTexture.isCompressedTexture) {
        _gl.compressedTexSubImage2D(3553, level, position.x, position.y, srcTexture.mipmaps[0].width, srcTexture.mipmaps[0].height, glFormat, srcTexture.mipmaps[0].data);
      } else {
        _gl.texSubImage2D(3553, level, position.x, position.y, glFormat, glType, srcTexture.image);
      }
    }
    if (level === 0 && dstTexture.generateMipmaps)
      _gl.generateMipmap(3553);
    state.unbindTexture();
  };
  this.copyTextureToTexture3D = function(sourceBox, position, srcTexture, dstTexture, level = 0) {
    if (_this.isWebGL1Renderer) {
      console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: can only be used with WebGL2.");
      return;
    }
    const {width, height, data} = srcTexture.image;
    const glFormat = utils.convert(dstTexture.format);
    const glType = utils.convert(dstTexture.type);
    let glTarget;
    if (dstTexture.isDataTexture3D) {
      textures.setTexture3D(dstTexture, 0);
      glTarget = 32879;
    } else if (dstTexture.isDataTexture2DArray) {
      textures.setTexture2DArray(dstTexture, 0);
      glTarget = 35866;
    } else {
      console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");
      return;
    }
    _gl.pixelStorei(37440, dstTexture.flipY);
    _gl.pixelStorei(37441, dstTexture.premultiplyAlpha);
    _gl.pixelStorei(3317, dstTexture.unpackAlignment);
    const unpackRowLen = _gl.getParameter(3314);
    const unpackImageHeight = _gl.getParameter(32878);
    const unpackSkipPixels = _gl.getParameter(3316);
    const unpackSkipRows = _gl.getParameter(3315);
    const unpackSkipImages = _gl.getParameter(32877);
    _gl.pixelStorei(3314, width);
    _gl.pixelStorei(32878, height);
    _gl.pixelStorei(3316, sourceBox.min.x);
    _gl.pixelStorei(3315, sourceBox.min.y);
    _gl.pixelStorei(32877, sourceBox.min.z);
    _gl.texSubImage3D(glTarget, level, position.x, position.y, position.z, sourceBox.max.x - sourceBox.min.x + 1, sourceBox.max.y - sourceBox.min.y + 1, sourceBox.max.z - sourceBox.min.z + 1, glFormat, glType, data);
    _gl.pixelStorei(3314, unpackRowLen);
    _gl.pixelStorei(32878, unpackImageHeight);
    _gl.pixelStorei(3316, unpackSkipPixels);
    _gl.pixelStorei(3315, unpackSkipRows);
    _gl.pixelStorei(32877, unpackSkipImages);
    if (level === 0 && dstTexture.generateMipmaps)
      _gl.generateMipmap(glTarget);
    state.unbindTexture();
  };
  this.initTexture = function(texture) {
    textures.setTexture2D(texture, 0);
    state.unbindTexture();
  };
  this.resetState = function() {
    state.reset();
    bindingStates.reset();
  };
  if (typeof __THREE_DEVTOOLS__ !== "undefined") {
    __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", {detail: this}));
  }
}
class Scene extends Object3D {
  constructor() {
    super();
    this.type = "Scene";
    this.background = null;
    this.environment = null;
    this.fog = null;
    this.overrideMaterial = null;
    this.autoUpdate = true;
    if (typeof __THREE_DEVTOOLS__ !== "undefined") {
      __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", {detail: this}));
    }
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    if (source.background !== null)
      this.background = source.background.clone();
    if (source.environment !== null)
      this.environment = source.environment.clone();
    if (source.fog !== null)
      this.fog = source.fog.clone();
    if (source.overrideMaterial !== null)
      this.overrideMaterial = source.overrideMaterial.clone();
    this.autoUpdate = source.autoUpdate;
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    return this;
  }
  toJSON(meta) {
    const data = super.toJSON(meta);
    if (this.background !== null)
      data.object.background = this.background.toJSON(meta);
    if (this.environment !== null)
      data.object.environment = this.environment.toJSON(meta);
    if (this.fog !== null)
      data.object.fog = this.fog.toJSON();
    return data;
  }
}
Scene.prototype.isScene = true;
function InterleavedBuffer(array, stride) {
  this.array = array;
  this.stride = stride;
  this.count = array !== void 0 ? array.length / stride : 0;
  this.usage = StaticDrawUsage;
  this.updateRange = {offset: 0, count: -1};
  this.version = 0;
  this.uuid = MathUtils.generateUUID();
}
Object.defineProperty(InterleavedBuffer.prototype, "needsUpdate", {
  set: function(value) {
    if (value === true)
      this.version++;
  }
});
Object.assign(InterleavedBuffer.prototype, {
  isInterleavedBuffer: true,
  onUploadCallback: function() {
  },
  setUsage: function(value) {
    this.usage = value;
    return this;
  },
  copy: function(source) {
    this.array = new source.array.constructor(source.array);
    this.count = source.count;
    this.stride = source.stride;
    this.usage = source.usage;
    return this;
  },
  copyAt: function(index1, attribute, index2) {
    index1 *= this.stride;
    index2 *= attribute.stride;
    for (let i = 0, l = this.stride; i < l; i++) {
      this.array[index1 + i] = attribute.array[index2 + i];
    }
    return this;
  },
  set: function(value, offset = 0) {
    this.array.set(value, offset);
    return this;
  },
  clone: function(data) {
    if (data.arrayBuffers === void 0) {
      data.arrayBuffers = {};
    }
    if (this.array.buffer._uuid === void 0) {
      this.array.buffer._uuid = MathUtils.generateUUID();
    }
    if (data.arrayBuffers[this.array.buffer._uuid] === void 0) {
      data.arrayBuffers[this.array.buffer._uuid] = this.array.slice(0).buffer;
    }
    const array = new this.array.constructor(data.arrayBuffers[this.array.buffer._uuid]);
    const ib = new InterleavedBuffer(array, this.stride);
    ib.setUsage(this.usage);
    return ib;
  },
  onUpload: function(callback) {
    this.onUploadCallback = callback;
    return this;
  },
  toJSON: function(data) {
    if (data.arrayBuffers === void 0) {
      data.arrayBuffers = {};
    }
    if (this.array.buffer._uuid === void 0) {
      this.array.buffer._uuid = MathUtils.generateUUID();
    }
    if (data.arrayBuffers[this.array.buffer._uuid] === void 0) {
      data.arrayBuffers[this.array.buffer._uuid] = Array.prototype.slice.call(new Uint32Array(this.array.buffer));
    }
    return {
      uuid: this.uuid,
      buffer: this.array.buffer._uuid,
      type: this.array.constructor.name,
      stride: this.stride
    };
  }
});
const _vector$6 = new Vector3();
function InterleavedBufferAttribute(interleavedBuffer, itemSize, offset, normalized) {
  this.name = "";
  this.data = interleavedBuffer;
  this.itemSize = itemSize;
  this.offset = offset;
  this.normalized = normalized === true;
}
Object.defineProperties(InterleavedBufferAttribute.prototype, {
  count: {
    get: function() {
      return this.data.count;
    }
  },
  array: {
    get: function() {
      return this.data.array;
    }
  },
  needsUpdate: {
    set: function(value) {
      this.data.needsUpdate = value;
    }
  }
});
Object.assign(InterleavedBufferAttribute.prototype, {
  isInterleavedBufferAttribute: true,
  applyMatrix4: function(m) {
    for (let i = 0, l = this.data.count; i < l; i++) {
      _vector$6.x = this.getX(i);
      _vector$6.y = this.getY(i);
      _vector$6.z = this.getZ(i);
      _vector$6.applyMatrix4(m);
      this.setXYZ(i, _vector$6.x, _vector$6.y, _vector$6.z);
    }
    return this;
  },
  setX: function(index2, x) {
    this.data.array[index2 * this.data.stride + this.offset] = x;
    return this;
  },
  setY: function(index2, y) {
    this.data.array[index2 * this.data.stride + this.offset + 1] = y;
    return this;
  },
  setZ: function(index2, z) {
    this.data.array[index2 * this.data.stride + this.offset + 2] = z;
    return this;
  },
  setW: function(index2, w) {
    this.data.array[index2 * this.data.stride + this.offset + 3] = w;
    return this;
  },
  getX: function(index2) {
    return this.data.array[index2 * this.data.stride + this.offset];
  },
  getY: function(index2) {
    return this.data.array[index2 * this.data.stride + this.offset + 1];
  },
  getZ: function(index2) {
    return this.data.array[index2 * this.data.stride + this.offset + 2];
  },
  getW: function(index2) {
    return this.data.array[index2 * this.data.stride + this.offset + 3];
  },
  setXY: function(index2, x, y) {
    index2 = index2 * this.data.stride + this.offset;
    this.data.array[index2 + 0] = x;
    this.data.array[index2 + 1] = y;
    return this;
  },
  setXYZ: function(index2, x, y, z) {
    index2 = index2 * this.data.stride + this.offset;
    this.data.array[index2 + 0] = x;
    this.data.array[index2 + 1] = y;
    this.data.array[index2 + 2] = z;
    return this;
  },
  setXYZW: function(index2, x, y, z, w) {
    index2 = index2 * this.data.stride + this.offset;
    this.data.array[index2 + 0] = x;
    this.data.array[index2 + 1] = y;
    this.data.array[index2 + 2] = z;
    this.data.array[index2 + 3] = w;
    return this;
  },
  clone: function(data) {
    if (data === void 0) {
      console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interlaved buffer attribute will deinterleave buffer data.");
      const array = [];
      for (let i = 0; i < this.count; i++) {
        const index2 = i * this.data.stride + this.offset;
        for (let j = 0; j < this.itemSize; j++) {
          array.push(this.data.array[index2 + j]);
        }
      }
      return new BufferAttribute(new this.array.constructor(array), this.itemSize, this.normalized);
    } else {
      if (data.interleavedBuffers === void 0) {
        data.interleavedBuffers = {};
      }
      if (data.interleavedBuffers[this.data.uuid] === void 0) {
        data.interleavedBuffers[this.data.uuid] = this.data.clone(data);
      }
      return new InterleavedBufferAttribute(data.interleavedBuffers[this.data.uuid], this.itemSize, this.offset, this.normalized);
    }
  },
  toJSON: function(data) {
    if (data === void 0) {
      console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interlaved buffer attribute will deinterleave buffer data.");
      const array = [];
      for (let i = 0; i < this.count; i++) {
        const index2 = i * this.data.stride + this.offset;
        for (let j = 0; j < this.itemSize; j++) {
          array.push(this.data.array[index2 + j]);
        }
      }
      return {
        itemSize: this.itemSize,
        type: this.array.constructor.name,
        array,
        normalized: this.normalized
      };
    } else {
      if (data.interleavedBuffers === void 0) {
        data.interleavedBuffers = {};
      }
      if (data.interleavedBuffers[this.data.uuid] === void 0) {
        data.interleavedBuffers[this.data.uuid] = this.data.toJSON(data);
      }
      return {
        isInterleavedBufferAttribute: true,
        itemSize: this.itemSize,
        data: this.data.uuid,
        offset: this.offset,
        normalized: this.normalized
      };
    }
  }
});
const _v1$4 = /* @__PURE__ */ new Vector3();
const _v2$2 = /* @__PURE__ */ new Vector3();
class LOD extends Object3D {
  constructor() {
    super();
    this._currentLevel = 0;
    this.type = "LOD";
    Object.defineProperties(this, {
      levels: {
        enumerable: true,
        value: []
      },
      isLOD: {
        value: true
      }
    });
    this.autoUpdate = true;
  }
  copy(source) {
    super.copy(source, false);
    const levels = source.levels;
    for (let i = 0, l = levels.length; i < l; i++) {
      const level = levels[i];
      this.addLevel(level.object.clone(), level.distance);
    }
    this.autoUpdate = source.autoUpdate;
    return this;
  }
  addLevel(object, distance = 0) {
    distance = Math.abs(distance);
    const levels = this.levels;
    let l;
    for (l = 0; l < levels.length; l++) {
      if (distance < levels[l].distance) {
        break;
      }
    }
    levels.splice(l, 0, {distance, object});
    this.add(object);
    return this;
  }
  getCurrentLevel() {
    return this._currentLevel;
  }
  getObjectForDistance(distance) {
    const levels = this.levels;
    if (levels.length > 0) {
      let i, l;
      for (i = 1, l = levels.length; i < l; i++) {
        if (distance < levels[i].distance) {
          break;
        }
      }
      return levels[i - 1].object;
    }
    return null;
  }
  raycast(raycaster, intersects) {
    const levels = this.levels;
    if (levels.length > 0) {
      _v1$4.setFromMatrixPosition(this.matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(_v1$4);
      this.getObjectForDistance(distance).raycast(raycaster, intersects);
    }
  }
  update(camera) {
    const levels = this.levels;
    if (levels.length > 1) {
      _v1$4.setFromMatrixPosition(camera.matrixWorld);
      _v2$2.setFromMatrixPosition(this.matrixWorld);
      const distance = _v1$4.distanceTo(_v2$2) / camera.zoom;
      levels[0].object.visible = true;
      let i, l;
      for (i = 1, l = levels.length; i < l; i++) {
        if (distance >= levels[i].distance) {
          levels[i - 1].object.visible = false;
          levels[i].object.visible = true;
        } else {
          break;
        }
      }
      this._currentLevel = i - 1;
      for (; i < l; i++) {
        levels[i].object.visible = false;
      }
    }
  }
  toJSON(meta) {
    const data = super.toJSON(meta);
    if (this.autoUpdate === false)
      data.object.autoUpdate = false;
    data.object.levels = [];
    const levels = this.levels;
    for (let i = 0, l = levels.length; i < l; i++) {
      const level = levels[i];
      data.object.levels.push({
        object: level.object.uuid,
        distance: level.distance
      });
    }
    return data;
  }
}
const _basePosition = new Vector3();
const _skinIndex = new Vector4();
const _skinWeight = new Vector4();
const _vector$7 = new Vector3();
const _matrix$1 = new Matrix4();
function SkinnedMesh(geometry, material) {
  Mesh.call(this, geometry, material);
  this.type = "SkinnedMesh";
  this.bindMode = "attached";
  this.bindMatrix = new Matrix4();
  this.bindMatrixInverse = new Matrix4();
}
SkinnedMesh.prototype = Object.assign(Object.create(Mesh.prototype), {
  constructor: SkinnedMesh,
  isSkinnedMesh: true,
  copy: function(source) {
    Mesh.prototype.copy.call(this, source);
    this.bindMode = source.bindMode;
    this.bindMatrix.copy(source.bindMatrix);
    this.bindMatrixInverse.copy(source.bindMatrixInverse);
    this.skeleton = source.skeleton;
    return this;
  },
  bind: function(skeleton, bindMatrix) {
    this.skeleton = skeleton;
    if (bindMatrix === void 0) {
      this.updateMatrixWorld(true);
      this.skeleton.calculateInverses();
      bindMatrix = this.matrixWorld;
    }
    this.bindMatrix.copy(bindMatrix);
    this.bindMatrixInverse.copy(bindMatrix).invert();
  },
  pose: function() {
    this.skeleton.pose();
  },
  normalizeSkinWeights: function() {
    const vector = new Vector4();
    const skinWeight = this.geometry.attributes.skinWeight;
    for (let i = 0, l = skinWeight.count; i < l; i++) {
      vector.x = skinWeight.getX(i);
      vector.y = skinWeight.getY(i);
      vector.z = skinWeight.getZ(i);
      vector.w = skinWeight.getW(i);
      const scale = 1 / vector.manhattanLength();
      if (scale !== Infinity) {
        vector.multiplyScalar(scale);
      } else {
        vector.set(1, 0, 0, 0);
      }
      skinWeight.setXYZW(i, vector.x, vector.y, vector.z, vector.w);
    }
  },
  updateMatrixWorld: function(force) {
    Mesh.prototype.updateMatrixWorld.call(this, force);
    if (this.bindMode === "attached") {
      this.bindMatrixInverse.copy(this.matrixWorld).invert();
    } else if (this.bindMode === "detached") {
      this.bindMatrixInverse.copy(this.bindMatrix).invert();
    } else {
      console.warn("THREE.SkinnedMesh: Unrecognized bindMode: " + this.bindMode);
    }
  },
  boneTransform: function(index2, target) {
    const skeleton = this.skeleton;
    const geometry = this.geometry;
    _skinIndex.fromBufferAttribute(geometry.attributes.skinIndex, index2);
    _skinWeight.fromBufferAttribute(geometry.attributes.skinWeight, index2);
    _basePosition.fromBufferAttribute(geometry.attributes.position, index2).applyMatrix4(this.bindMatrix);
    target.set(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const weight = _skinWeight.getComponent(i);
      if (weight !== 0) {
        const boneIndex = _skinIndex.getComponent(i);
        _matrix$1.multiplyMatrices(skeleton.bones[boneIndex].matrixWorld, skeleton.boneInverses[boneIndex]);
        target.addScaledVector(_vector$7.copy(_basePosition).applyMatrix4(_matrix$1), weight);
      }
    }
    return target.applyMatrix4(this.bindMatrixInverse);
  }
});
function Bone() {
  Object3D.call(this);
  this.type = "Bone";
}
Bone.prototype = Object.assign(Object.create(Object3D.prototype), {
  constructor: Bone,
  isBone: true
});
const _offsetMatrix = /* @__PURE__ */ new Matrix4();
const _identityMatrix = /* @__PURE__ */ new Matrix4();
class Skeleton {
  constructor(bones = [], boneInverses = []) {
    this.uuid = MathUtils.generateUUID();
    this.bones = bones.slice(0);
    this.boneInverses = boneInverses;
    this.boneMatrices = null;
    this.boneTexture = null;
    this.boneTextureSize = 0;
    this.frame = -1;
    this.init();
  }
  init() {
    const bones = this.bones;
    const boneInverses = this.boneInverses;
    this.boneMatrices = new Float32Array(bones.length * 16);
    if (boneInverses.length === 0) {
      this.calculateInverses();
    } else {
      if (bones.length !== boneInverses.length) {
        console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones.");
        this.boneInverses = [];
        for (let i = 0, il = this.bones.length; i < il; i++) {
          this.boneInverses.push(new Matrix4());
        }
      }
    }
  }
  calculateInverses() {
    this.boneInverses.length = 0;
    for (let i = 0, il = this.bones.length; i < il; i++) {
      const inverse = new Matrix4();
      if (this.bones[i]) {
        inverse.copy(this.bones[i].matrixWorld).invert();
      }
      this.boneInverses.push(inverse);
    }
  }
  pose() {
    for (let i = 0, il = this.bones.length; i < il; i++) {
      const bone = this.bones[i];
      if (bone) {
        bone.matrixWorld.copy(this.boneInverses[i]).invert();
      }
    }
    for (let i = 0, il = this.bones.length; i < il; i++) {
      const bone = this.bones[i];
      if (bone) {
        if (bone.parent && bone.parent.isBone) {
          bone.matrix.copy(bone.parent.matrixWorld).invert();
          bone.matrix.multiply(bone.matrixWorld);
        } else {
          bone.matrix.copy(bone.matrixWorld);
        }
        bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
      }
    }
  }
  update() {
    const bones = this.bones;
    const boneInverses = this.boneInverses;
    const boneMatrices = this.boneMatrices;
    const boneTexture = this.boneTexture;
    for (let i = 0, il = bones.length; i < il; i++) {
      const matrix = bones[i] ? bones[i].matrixWorld : _identityMatrix;
      _offsetMatrix.multiplyMatrices(matrix, boneInverses[i]);
      _offsetMatrix.toArray(boneMatrices, i * 16);
    }
    if (boneTexture !== null) {
      boneTexture.needsUpdate = true;
    }
  }
  clone() {
    return new Skeleton(this.bones, this.boneInverses);
  }
  getBoneByName(name) {
    for (let i = 0, il = this.bones.length; i < il; i++) {
      const bone = this.bones[i];
      if (bone.name === name) {
        return bone;
      }
    }
    return void 0;
  }
  dispose() {
    if (this.boneTexture !== null) {
      this.boneTexture.dispose();
      this.boneTexture = null;
    }
  }
  fromJSON(json, bones) {
    this.uuid = json.uuid;
    for (let i = 0, l = json.bones.length; i < l; i++) {
      const uuid = json.bones[i];
      let bone = bones[uuid];
      if (bone === void 0) {
        console.warn("THREE.Skeleton: No bone found with UUID:", uuid);
        bone = new Bone();
      }
      this.bones.push(bone);
      this.boneInverses.push(new Matrix4().fromArray(json.boneInverses[i]));
    }
    this.init();
    return this;
  }
  toJSON() {
    const data = {
      metadata: {
        version: 4.5,
        type: "Skeleton",
        generator: "Skeleton.toJSON"
      },
      bones: [],
      boneInverses: []
    };
    data.uuid = this.uuid;
    const bones = this.bones;
    const boneInverses = this.boneInverses;
    for (let i = 0, l = bones.length; i < l; i++) {
      const bone = bones[i];
      data.bones.push(bone.uuid);
      const boneInverse = boneInverses[i];
      data.boneInverses.push(boneInverse.toArray());
    }
    return data;
  }
}
const _instanceLocalMatrix = new Matrix4();
const _instanceWorldMatrix = new Matrix4();
const _instanceIntersects = [];
const _mesh = new Mesh();
function InstancedMesh(geometry, material, count) {
  Mesh.call(this, geometry, material);
  this.instanceMatrix = new BufferAttribute(new Float32Array(count * 16), 16);
  this.instanceColor = null;
  this.count = count;
  this.frustumCulled = false;
}
InstancedMesh.prototype = Object.assign(Object.create(Mesh.prototype), {
  constructor: InstancedMesh,
  isInstancedMesh: true,
  copy: function(source) {
    Mesh.prototype.copy.call(this, source);
    this.instanceMatrix.copy(source.instanceMatrix);
    if (source.instanceColor !== null)
      this.instanceColor = source.instanceColor.clone();
    this.count = source.count;
    return this;
  },
  getColorAt: function(index2, color) {
    color.fromArray(this.instanceColor.array, index2 * 3);
  },
  getMatrixAt: function(index2, matrix) {
    matrix.fromArray(this.instanceMatrix.array, index2 * 16);
  },
  raycast: function(raycaster, intersects) {
    const matrixWorld = this.matrixWorld;
    const raycastTimes = this.count;
    _mesh.geometry = this.geometry;
    _mesh.material = this.material;
    if (_mesh.material === void 0)
      return;
    for (let instanceId = 0; instanceId < raycastTimes; instanceId++) {
      this.getMatrixAt(instanceId, _instanceLocalMatrix);
      _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix);
      _mesh.matrixWorld = _instanceWorldMatrix;
      _mesh.raycast(raycaster, _instanceIntersects);
      for (let i = 0, l = _instanceIntersects.length; i < l; i++) {
        const intersect = _instanceIntersects[i];
        intersect.instanceId = instanceId;
        intersect.object = this;
        intersects.push(intersect);
      }
      _instanceIntersects.length = 0;
    }
  },
  setColorAt: function(index2, color) {
    if (this.instanceColor === null) {
      this.instanceColor = new BufferAttribute(new Float32Array(this.count * 3), 3);
    }
    color.toArray(this.instanceColor.array, index2 * 3);
  },
  setMatrixAt: function(index2, matrix) {
    matrix.toArray(this.instanceMatrix.array, index2 * 16);
  },
  updateMorphTargets: function() {
  },
  dispose: function() {
    this.dispatchEvent({type: "dispose"});
  }
});
class LineBasicMaterial extends Material {
  constructor(parameters) {
    super();
    this.type = "LineBasicMaterial";
    this.color = new Color(16777215);
    this.linewidth = 1;
    this.linecap = "round";
    this.linejoin = "round";
    this.morphTargets = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.linewidth = source.linewidth;
    this.linecap = source.linecap;
    this.linejoin = source.linejoin;
    this.morphTargets = source.morphTargets;
    return this;
  }
}
LineBasicMaterial.prototype.isLineBasicMaterial = true;
const _start = new Vector3();
const _end = new Vector3();
const _inverseMatrix$1 = new Matrix4();
const _ray$1 = new Ray();
const _sphere$2 = new Sphere();
function Line(geometry = new BufferGeometry(), material = new LineBasicMaterial()) {
  Object3D.call(this);
  this.type = "Line";
  this.geometry = geometry;
  this.material = material;
  this.updateMorphTargets();
}
Line.prototype = Object.assign(Object.create(Object3D.prototype), {
  constructor: Line,
  isLine: true,
  copy: function(source) {
    Object3D.prototype.copy.call(this, source);
    this.material = source.material;
    this.geometry = source.geometry;
    return this;
  },
  computeLineDistances: function() {
    const geometry = this.geometry;
    if (geometry.isBufferGeometry) {
      if (geometry.index === null) {
        const positionAttribute = geometry.attributes.position;
        const lineDistances = [0];
        for (let i = 1, l = positionAttribute.count; i < l; i++) {
          _start.fromBufferAttribute(positionAttribute, i - 1);
          _end.fromBufferAttribute(positionAttribute, i);
          lineDistances[i] = lineDistances[i - 1];
          lineDistances[i] += _start.distanceTo(_end);
        }
        geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
      } else {
        console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
      }
    } else if (geometry.isGeometry) {
      console.error("THREE.Line.computeLineDistances() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");
    }
    return this;
  },
  raycast: function(raycaster, intersects) {
    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Line.threshold;
    if (geometry.boundingSphere === null)
      geometry.computeBoundingSphere();
    _sphere$2.copy(geometry.boundingSphere);
    _sphere$2.applyMatrix4(matrixWorld);
    _sphere$2.radius += threshold;
    if (raycaster.ray.intersectsSphere(_sphere$2) === false)
      return;
    _inverseMatrix$1.copy(matrixWorld).invert();
    _ray$1.copy(raycaster.ray).applyMatrix4(_inverseMatrix$1);
    const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;
    const vStart = new Vector3();
    const vEnd = new Vector3();
    const interSegment = new Vector3();
    const interRay = new Vector3();
    const step = this.isLineSegments ? 2 : 1;
    if (geometry.isBufferGeometry) {
      const index2 = geometry.index;
      const attributes = geometry.attributes;
      const positionAttribute = attributes.position;
      if (index2 !== null) {
        const indices = index2.array;
        for (let i = 0, l = indices.length - 1; i < l; i += step) {
          const a = indices[i];
          const b = indices[i + 1];
          vStart.fromBufferAttribute(positionAttribute, a);
          vEnd.fromBufferAttribute(positionAttribute, b);
          const distSq = _ray$1.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
          if (distSq > localThresholdSq)
            continue;
          interRay.applyMatrix4(this.matrixWorld);
          const distance = raycaster.ray.origin.distanceTo(interRay);
          if (distance < raycaster.near || distance > raycaster.far)
            continue;
          intersects.push({
            distance,
            point: interSegment.clone().applyMatrix4(this.matrixWorld),
            index: i,
            face: null,
            faceIndex: null,
            object: this
          });
        }
      } else {
        for (let i = 0, l = positionAttribute.count - 1; i < l; i += step) {
          vStart.fromBufferAttribute(positionAttribute, i);
          vEnd.fromBufferAttribute(positionAttribute, i + 1);
          const distSq = _ray$1.distanceSqToSegment(vStart, vEnd, interRay, interSegment);
          if (distSq > localThresholdSq)
            continue;
          interRay.applyMatrix4(this.matrixWorld);
          const distance = raycaster.ray.origin.distanceTo(interRay);
          if (distance < raycaster.near || distance > raycaster.far)
            continue;
          intersects.push({
            distance,
            point: interSegment.clone().applyMatrix4(this.matrixWorld),
            index: i,
            face: null,
            faceIndex: null,
            object: this
          });
        }
      }
    } else if (geometry.isGeometry) {
      console.error("THREE.Line.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");
    }
  },
  updateMorphTargets: function() {
    const geometry = this.geometry;
    if (geometry.isBufferGeometry) {
      const morphAttributes = geometry.morphAttributes;
      const keys = Object.keys(morphAttributes);
      if (keys.length > 0) {
        const morphAttribute = morphAttributes[keys[0]];
        if (morphAttribute !== void 0) {
          this.morphTargetInfluences = [];
          this.morphTargetDictionary = {};
          for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
            const name = morphAttribute[m].name || String(m);
            this.morphTargetInfluences.push(0);
            this.morphTargetDictionary[name] = m;
          }
        }
      }
    } else {
      const morphTargets = geometry.morphTargets;
      if (morphTargets !== void 0 && morphTargets.length > 0) {
        console.error("THREE.Line.updateMorphTargets() does not support THREE.Geometry. Use THREE.BufferGeometry instead.");
      }
    }
  }
});
const _start$1 = new Vector3();
const _end$1 = new Vector3();
function LineSegments(geometry, material) {
  Line.call(this, geometry, material);
  this.type = "LineSegments";
}
LineSegments.prototype = Object.assign(Object.create(Line.prototype), {
  constructor: LineSegments,
  isLineSegments: true,
  computeLineDistances: function() {
    const geometry = this.geometry;
    if (geometry.isBufferGeometry) {
      if (geometry.index === null) {
        const positionAttribute = geometry.attributes.position;
        const lineDistances = [];
        for (let i = 0, l = positionAttribute.count; i < l; i += 2) {
          _start$1.fromBufferAttribute(positionAttribute, i);
          _end$1.fromBufferAttribute(positionAttribute, i + 1);
          lineDistances[i] = i === 0 ? 0 : lineDistances[i - 1];
          lineDistances[i + 1] = lineDistances[i] + _start$1.distanceTo(_end$1);
        }
        geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
      } else {
        console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
      }
    } else if (geometry.isGeometry) {
      console.error("THREE.LineSegments.computeLineDistances() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");
    }
    return this;
  }
});
class PointsMaterial extends Material {
  constructor(parameters) {
    super();
    this.type = "PointsMaterial";
    this.color = new Color(16777215);
    this.map = null;
    this.alphaMap = null;
    this.size = 1;
    this.sizeAttenuation = true;
    this.morphTargets = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.size = source.size;
    this.sizeAttenuation = source.sizeAttenuation;
    this.morphTargets = source.morphTargets;
    return this;
  }
}
PointsMaterial.prototype.isPointsMaterial = true;
const _inverseMatrix$2 = new Matrix4();
const _ray$2 = new Ray();
const _sphere$3 = new Sphere();
const _position$1 = new Vector3();
function Points(geometry = new BufferGeometry(), material = new PointsMaterial()) {
  Object3D.call(this);
  this.type = "Points";
  this.geometry = geometry;
  this.material = material;
  this.updateMorphTargets();
}
Points.prototype = Object.assign(Object.create(Object3D.prototype), {
  constructor: Points,
  isPoints: true,
  copy: function(source) {
    Object3D.prototype.copy.call(this, source);
    this.material = source.material;
    this.geometry = source.geometry;
    return this;
  },
  raycast: function(raycaster, intersects) {
    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Points.threshold;
    if (geometry.boundingSphere === null)
      geometry.computeBoundingSphere();
    _sphere$3.copy(geometry.boundingSphere);
    _sphere$3.applyMatrix4(matrixWorld);
    _sphere$3.radius += threshold;
    if (raycaster.ray.intersectsSphere(_sphere$3) === false)
      return;
    _inverseMatrix$2.copy(matrixWorld).invert();
    _ray$2.copy(raycaster.ray).applyMatrix4(_inverseMatrix$2);
    const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;
    if (geometry.isBufferGeometry) {
      const index2 = geometry.index;
      const attributes = geometry.attributes;
      const positionAttribute = attributes.position;
      if (index2 !== null) {
        const indices = index2.array;
        for (let i = 0, il = indices.length; i < il; i++) {
          const a = indices[i];
          _position$1.fromBufferAttribute(positionAttribute, a);
          testPoint(_position$1, a, localThresholdSq, matrixWorld, raycaster, intersects, this);
        }
      } else {
        for (let i = 0, l = positionAttribute.count; i < l; i++) {
          _position$1.fromBufferAttribute(positionAttribute, i);
          testPoint(_position$1, i, localThresholdSq, matrixWorld, raycaster, intersects, this);
        }
      }
    } else {
      console.error("THREE.Points.raycast() no longer supports THREE.Geometry. Use THREE.BufferGeometry instead.");
    }
  },
  updateMorphTargets: function() {
    const geometry = this.geometry;
    if (geometry.isBufferGeometry) {
      const morphAttributes = geometry.morphAttributes;
      const keys = Object.keys(morphAttributes);
      if (keys.length > 0) {
        const morphAttribute = morphAttributes[keys[0]];
        if (morphAttribute !== void 0) {
          this.morphTargetInfluences = [];
          this.morphTargetDictionary = {};
          for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
            const name = morphAttribute[m].name || String(m);
            this.morphTargetInfluences.push(0);
            this.morphTargetDictionary[name] = m;
          }
        }
      }
    } else {
      const morphTargets = geometry.morphTargets;
      if (morphTargets !== void 0 && morphTargets.length > 0) {
        console.error("THREE.Points.updateMorphTargets() does not support THREE.Geometry. Use THREE.BufferGeometry instead.");
      }
    }
  }
});
function testPoint(point, index2, localThresholdSq, matrixWorld, raycaster, intersects, object) {
  const rayPointDistanceSq = _ray$2.distanceSqToPoint(point);
  if (rayPointDistanceSq < localThresholdSq) {
    const intersectPoint = new Vector3();
    _ray$2.closestPointToPoint(point, intersectPoint);
    intersectPoint.applyMatrix4(matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(intersectPoint);
    if (distance < raycaster.near || distance > raycaster.far)
      return;
    intersects.push({
      distance,
      distanceToRay: Math.sqrt(rayPointDistanceSq),
      point: intersectPoint,
      index: index2,
      face: null,
      object
    });
  }
}
class CompressedTexture extends Texture {
  constructor(mipmaps, width, height, format2, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, encoding) {
    super(null, mapping, wrapS, wrapT, magFilter, minFilter, format2, type, anisotropy, encoding);
    this.image = {width, height};
    this.mipmaps = mipmaps;
    this.flipY = false;
    this.generateMipmaps = false;
  }
}
CompressedTexture.prototype.isCompressedTexture = true;
function ParametricGeometry(func, slices, stacks) {
  BufferGeometry.call(this);
  this.type = "ParametricGeometry";
  this.parameters = {
    func,
    slices,
    stacks
  };
  const indices = [];
  const vertices = [];
  const normals = [];
  const uvs = [];
  const EPS = 1e-5;
  const normal = new Vector3();
  const p0 = new Vector3(), p1 = new Vector3();
  const pu = new Vector3(), pv = new Vector3();
  if (func.length < 3) {
    console.error("THREE.ParametricGeometry: Function must now modify a Vector3 as third parameter.");
  }
  const sliceCount = slices + 1;
  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks;
    for (let j = 0; j <= slices; j++) {
      const u = j / slices;
      func(u, v, p0);
      vertices.push(p0.x, p0.y, p0.z);
      if (u - EPS >= 0) {
        func(u - EPS, v, p1);
        pu.subVectors(p0, p1);
      } else {
        func(u + EPS, v, p1);
        pu.subVectors(p1, p0);
      }
      if (v - EPS >= 0) {
        func(u, v - EPS, p1);
        pv.subVectors(p0, p1);
      } else {
        func(u, v + EPS, p1);
        pv.subVectors(p1, p0);
      }
      normal.crossVectors(pu, pv).normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, v);
    }
  }
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * sliceCount + j;
      const b = i * sliceCount + j + 1;
      const c = (i + 1) * sliceCount + j + 1;
      const d2 = (i + 1) * sliceCount + j;
      indices.push(a, b, d2);
      indices.push(b, c, d2);
    }
  }
  this.setIndex(indices);
  this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  this.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  this.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
}
ParametricGeometry.prototype = Object.create(BufferGeometry.prototype);
ParametricGeometry.prototype.constructor = ParametricGeometry;
function MeshStandardMaterial(parameters) {
  Material.call(this);
  this.defines = {STANDARD: ""};
  this.type = "MeshStandardMaterial";
  this.color = new Color(16777215);
  this.roughness = 1;
  this.metalness = 0;
  this.map = null;
  this.lightMap = null;
  this.lightMapIntensity = 1;
  this.aoMap = null;
  this.aoMapIntensity = 1;
  this.emissive = new Color(0);
  this.emissiveIntensity = 1;
  this.emissiveMap = null;
  this.bumpMap = null;
  this.bumpScale = 1;
  this.normalMap = null;
  this.normalMapType = TangentSpaceNormalMap;
  this.normalScale = new Vector2(1, 1);
  this.displacementMap = null;
  this.displacementScale = 1;
  this.displacementBias = 0;
  this.roughnessMap = null;
  this.metalnessMap = null;
  this.alphaMap = null;
  this.envMap = null;
  this.envMapIntensity = 1;
  this.refractionRatio = 0.98;
  this.wireframe = false;
  this.wireframeLinewidth = 1;
  this.wireframeLinecap = "round";
  this.wireframeLinejoin = "round";
  this.skinning = false;
  this.morphTargets = false;
  this.morphNormals = false;
  this.flatShading = false;
  this.vertexTangents = false;
  this.setValues(parameters);
}
MeshStandardMaterial.prototype = Object.create(Material.prototype);
MeshStandardMaterial.prototype.constructor = MeshStandardMaterial;
MeshStandardMaterial.prototype.isMeshStandardMaterial = true;
MeshStandardMaterial.prototype.copy = function(source) {
  Material.prototype.copy.call(this, source);
  this.defines = {STANDARD: ""};
  this.color.copy(source.color);
  this.roughness = source.roughness;
  this.metalness = source.metalness;
  this.map = source.map;
  this.lightMap = source.lightMap;
  this.lightMapIntensity = source.lightMapIntensity;
  this.aoMap = source.aoMap;
  this.aoMapIntensity = source.aoMapIntensity;
  this.emissive.copy(source.emissive);
  this.emissiveMap = source.emissiveMap;
  this.emissiveIntensity = source.emissiveIntensity;
  this.bumpMap = source.bumpMap;
  this.bumpScale = source.bumpScale;
  this.normalMap = source.normalMap;
  this.normalMapType = source.normalMapType;
  this.normalScale.copy(source.normalScale);
  this.displacementMap = source.displacementMap;
  this.displacementScale = source.displacementScale;
  this.displacementBias = source.displacementBias;
  this.roughnessMap = source.roughnessMap;
  this.metalnessMap = source.metalnessMap;
  this.alphaMap = source.alphaMap;
  this.envMap = source.envMap;
  this.envMapIntensity = source.envMapIntensity;
  this.refractionRatio = source.refractionRatio;
  this.wireframe = source.wireframe;
  this.wireframeLinewidth = source.wireframeLinewidth;
  this.wireframeLinecap = source.wireframeLinecap;
  this.wireframeLinejoin = source.wireframeLinejoin;
  this.skinning = source.skinning;
  this.morphTargets = source.morphTargets;
  this.morphNormals = source.morphNormals;
  this.flatShading = source.flatShading;
  this.vertexTangents = source.vertexTangents;
  return this;
};
function MeshPhysicalMaterial(parameters) {
  MeshStandardMaterial.call(this);
  this.defines = {
    STANDARD: "",
    PHYSICAL: ""
  };
  this.type = "MeshPhysicalMaterial";
  this.clearcoat = 0;
  this.clearcoatMap = null;
  this.clearcoatRoughness = 0;
  this.clearcoatRoughnessMap = null;
  this.clearcoatNormalScale = new Vector2(1, 1);
  this.clearcoatNormalMap = null;
  this.reflectivity = 0.5;
  Object.defineProperty(this, "ior", {
    get: function() {
      return (1 + 0.4 * this.reflectivity) / (1 - 0.4 * this.reflectivity);
    },
    set: function(ior) {
      this.reflectivity = MathUtils.clamp(2.5 * (ior - 1) / (ior + 1), 0, 1);
    }
  });
  this.sheen = null;
  this.transmission = 0;
  this.transmissionMap = null;
  this.setValues(parameters);
}
MeshPhysicalMaterial.prototype = Object.create(MeshStandardMaterial.prototype);
MeshPhysicalMaterial.prototype.constructor = MeshPhysicalMaterial;
MeshPhysicalMaterial.prototype.isMeshPhysicalMaterial = true;
MeshPhysicalMaterial.prototype.copy = function(source) {
  MeshStandardMaterial.prototype.copy.call(this, source);
  this.defines = {
    STANDARD: "",
    PHYSICAL: ""
  };
  this.clearcoat = source.clearcoat;
  this.clearcoatMap = source.clearcoatMap;
  this.clearcoatRoughness = source.clearcoatRoughness;
  this.clearcoatRoughnessMap = source.clearcoatRoughnessMap;
  this.clearcoatNormalMap = source.clearcoatNormalMap;
  this.clearcoatNormalScale.copy(source.clearcoatNormalScale);
  this.reflectivity = source.reflectivity;
  if (source.sheen) {
    this.sheen = (this.sheen || new Color()).copy(source.sheen);
  } else {
    this.sheen = null;
  }
  this.transmission = source.transmission;
  this.transmissionMap = source.transmissionMap;
  return this;
};
class MeshPhongMaterial extends Material {
  constructor(parameters) {
    super();
    this.type = "MeshPhongMaterial";
    this.color = new Color(16777215);
    this.specular = new Color(1118481);
    this.shininess = 30;
    this.map = null;
    this.lightMap = null;
    this.lightMapIntensity = 1;
    this.aoMap = null;
    this.aoMapIntensity = 1;
    this.emissive = new Color(0);
    this.emissiveIntensity = 1;
    this.emissiveMap = null;
    this.bumpMap = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalMapType = TangentSpaceNormalMap;
    this.normalScale = new Vector2(1, 1);
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.specularMap = null;
    this.alphaMap = null;
    this.envMap = null;
    this.combine = MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = "round";
    this.wireframeLinejoin = "round";
    this.skinning = false;
    this.morphTargets = false;
    this.morphNormals = false;
    this.flatShading = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.specular.copy(source.specular);
    this.shininess = source.shininess;
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.emissive.copy(source.emissive);
    this.emissiveMap = source.emissiveMap;
    this.emissiveIntensity = source.emissiveIntensity;
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.specularMap = source.specularMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.refractionRatio = source.refractionRatio;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.wireframeLinecap = source.wireframeLinecap;
    this.wireframeLinejoin = source.wireframeLinejoin;
    this.skinning = source.skinning;
    this.morphTargets = source.morphTargets;
    this.morphNormals = source.morphNormals;
    this.flatShading = source.flatShading;
    return this;
  }
}
MeshPhongMaterial.prototype.isMeshPhongMaterial = true;
class MeshNormalMaterial extends Material {
  constructor(parameters) {
    super();
    this.type = "MeshNormalMaterial";
    this.bumpMap = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalMapType = TangentSpaceNormalMap;
    this.normalScale = new Vector2(1, 1);
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.fog = false;
    this.skinning = false;
    this.morphTargets = false;
    this.morphNormals = false;
    this.flatShading = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.skinning = source.skinning;
    this.morphTargets = source.morphTargets;
    this.morphNormals = source.morphNormals;
    this.flatShading = source.flatShading;
    return this;
  }
}
MeshNormalMaterial.prototype.isMeshNormalMaterial = true;
function Interpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {
  this.parameterPositions = parameterPositions;
  this._cachedIndex = 0;
  this.resultBuffer = resultBuffer !== void 0 ? resultBuffer : new sampleValues.constructor(sampleSize);
  this.sampleValues = sampleValues;
  this.valueSize = sampleSize;
}
Object.assign(Interpolant.prototype, {
  evaluate: function(t) {
    const pp = this.parameterPositions;
    let i1 = this._cachedIndex, t1 = pp[i1], t0 = pp[i1 - 1];
    validate_interval: {
      seek: {
        let right;
        linear_scan: {
          forward_scan:
            if (!(t < t1)) {
              for (let giveUpAt = i1 + 2; ; ) {
                if (t1 === void 0) {
                  if (t < t0)
                    break forward_scan;
                  i1 = pp.length;
                  this._cachedIndex = i1;
                  return this.afterEnd_(i1 - 1, t, t0);
                }
                if (i1 === giveUpAt)
                  break;
                t0 = t1;
                t1 = pp[++i1];
                if (t < t1) {
                  break seek;
                }
              }
              right = pp.length;
              break linear_scan;
            }
          if (!(t >= t0)) {
            const t1global = pp[1];
            if (t < t1global) {
              i1 = 2;
              t0 = t1global;
            }
            for (let giveUpAt = i1 - 2; ; ) {
              if (t0 === void 0) {
                this._cachedIndex = 0;
                return this.beforeStart_(0, t, t1);
              }
              if (i1 === giveUpAt)
                break;
              t1 = t0;
              t0 = pp[--i1 - 1];
              if (t >= t0) {
                break seek;
              }
            }
            right = i1;
            i1 = 0;
            break linear_scan;
          }
          break validate_interval;
        }
        while (i1 < right) {
          const mid = i1 + right >>> 1;
          if (t < pp[mid]) {
            right = mid;
          } else {
            i1 = mid + 1;
          }
        }
        t1 = pp[i1];
        t0 = pp[i1 - 1];
        if (t0 === void 0) {
          this._cachedIndex = 0;
          return this.beforeStart_(0, t, t1);
        }
        if (t1 === void 0) {
          i1 = pp.length;
          this._cachedIndex = i1;
          return this.afterEnd_(i1 - 1, t0, t);
        }
      }
      this._cachedIndex = i1;
      this.intervalChanged_(i1, t0, t1);
    }
    return this.interpolate_(i1, t0, t, t1);
  },
  settings: null,
  DefaultSettings_: {},
  getSettings_: function() {
    return this.settings || this.DefaultSettings_;
  },
  copySampleValue_: function(index2) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset = index2 * stride;
    for (let i = 0; i !== stride; ++i) {
      result[i] = values[offset + i];
    }
    return result;
  },
  interpolate_: function() {
    throw new Error("call to abstract method");
  },
  intervalChanged_: function() {
  }
});
Object.assign(Interpolant.prototype, {
  beforeStart_: Interpolant.prototype.copySampleValue_,
  afterEnd_: Interpolant.prototype.copySampleValue_
});
function CubicInterpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {
  Interpolant.call(this, parameterPositions, sampleValues, sampleSize, resultBuffer);
  this._weightPrev = -0;
  this._offsetPrev = -0;
  this._weightNext = -0;
  this._offsetNext = -0;
}
CubicInterpolant.prototype = Object.assign(Object.create(Interpolant.prototype), {
  constructor: CubicInterpolant,
  DefaultSettings_: {
    endingStart: ZeroCurvatureEnding,
    endingEnd: ZeroCurvatureEnding
  },
  intervalChanged_: function(i1, t0, t1) {
    const pp = this.parameterPositions;
    let iPrev = i1 - 2, iNext = i1 + 1, tPrev = pp[iPrev], tNext = pp[iNext];
    if (tPrev === void 0) {
      switch (this.getSettings_().endingStart) {
        case ZeroSlopeEnding:
          iPrev = i1;
          tPrev = 2 * t0 - t1;
          break;
        case WrapAroundEnding:
          iPrev = pp.length - 2;
          tPrev = t0 + pp[iPrev] - pp[iPrev + 1];
          break;
        default:
          iPrev = i1;
          tPrev = t1;
      }
    }
    if (tNext === void 0) {
      switch (this.getSettings_().endingEnd) {
        case ZeroSlopeEnding:
          iNext = i1;
          tNext = 2 * t1 - t0;
          break;
        case WrapAroundEnding:
          iNext = 1;
          tNext = t1 + pp[1] - pp[0];
          break;
        default:
          iNext = i1 - 1;
          tNext = t0;
      }
    }
    const halfDt = (t1 - t0) * 0.5, stride = this.valueSize;
    this._weightPrev = halfDt / (t0 - tPrev);
    this._weightNext = halfDt / (tNext - t1);
    this._offsetPrev = iPrev * stride;
    this._offsetNext = iNext * stride;
  },
  interpolate_: function(i1, t0, t, t1) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, o1 = i1 * stride, o0 = o1 - stride, oP = this._offsetPrev, oN = this._offsetNext, wP = this._weightPrev, wN = this._weightNext, p = (t - t0) / (t1 - t0), pp = p * p, ppp = pp * p;
    const sP = -wP * ppp + 2 * wP * pp - wP * p;
    const s0 = (1 + wP) * ppp + (-1.5 - 2 * wP) * pp + (-0.5 + wP) * p + 1;
    const s1 = (-1 - wN) * ppp + (1.5 + wN) * pp + 0.5 * p;
    const sN = wN * ppp - wN * pp;
    for (let i = 0; i !== stride; ++i) {
      result[i] = sP * values[oP + i] + s0 * values[o0 + i] + s1 * values[o1 + i] + sN * values[oN + i];
    }
    return result;
  }
});
function LinearInterpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {
  Interpolant.call(this, parameterPositions, sampleValues, sampleSize, resultBuffer);
}
LinearInterpolant.prototype = Object.assign(Object.create(Interpolant.prototype), {
  constructor: LinearInterpolant,
  interpolate_: function(i1, t0, t, t1) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset1 = i1 * stride, offset0 = offset1 - stride, weight1 = (t - t0) / (t1 - t0), weight0 = 1 - weight1;
    for (let i = 0; i !== stride; ++i) {
      result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
    }
    return result;
  }
});
function DiscreteInterpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {
  Interpolant.call(this, parameterPositions, sampleValues, sampleSize, resultBuffer);
}
DiscreteInterpolant.prototype = Object.assign(Object.create(Interpolant.prototype), {
  constructor: DiscreteInterpolant,
  interpolate_: function(i1) {
    return this.copySampleValue_(i1 - 1);
  }
});
function QuaternionLinearInterpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {
  Interpolant.call(this, parameterPositions, sampleValues, sampleSize, resultBuffer);
}
QuaternionLinearInterpolant.prototype = Object.assign(Object.create(Interpolant.prototype), {
  constructor: QuaternionLinearInterpolant,
  interpolate_: function(i1, t0, t, t1) {
    const result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, alpha = (t - t0) / (t1 - t0);
    let offset = i1 * stride;
    for (let end = offset + stride; offset !== end; offset += 4) {
      Quaternion.slerpFlat(result, 0, values, offset - stride, values, offset, alpha);
    }
    return result;
  }
});
const Cache = {
  enabled: false,
  files: {},
  add: function(key, file) {
    if (this.enabled === false)
      return;
    this.files[key] = file;
  },
  get: function(key) {
    if (this.enabled === false)
      return;
    return this.files[key];
  },
  remove: function(key) {
    delete this.files[key];
  },
  clear: function() {
    this.files = {};
  }
};
function LoadingManager(onLoad, onProgress, onError) {
  const scope = this;
  let isLoading = false;
  let itemsLoaded = 0;
  let itemsTotal = 0;
  let urlModifier = void 0;
  const handlers = [];
  this.onStart = void 0;
  this.onLoad = onLoad;
  this.onProgress = onProgress;
  this.onError = onError;
  this.itemStart = function(url) {
    itemsTotal++;
    if (isLoading === false) {
      if (scope.onStart !== void 0) {
        scope.onStart(url, itemsLoaded, itemsTotal);
      }
    }
    isLoading = true;
  };
  this.itemEnd = function(url) {
    itemsLoaded++;
    if (scope.onProgress !== void 0) {
      scope.onProgress(url, itemsLoaded, itemsTotal);
    }
    if (itemsLoaded === itemsTotal) {
      isLoading = false;
      if (scope.onLoad !== void 0) {
        scope.onLoad();
      }
    }
  };
  this.itemError = function(url) {
    if (scope.onError !== void 0) {
      scope.onError(url);
    }
  };
  this.resolveURL = function(url) {
    if (urlModifier) {
      return urlModifier(url);
    }
    return url;
  };
  this.setURLModifier = function(transform) {
    urlModifier = transform;
    return this;
  };
  this.addHandler = function(regex, loader) {
    handlers.push(regex, loader);
    return this;
  };
  this.removeHandler = function(regex) {
    const index2 = handlers.indexOf(regex);
    if (index2 !== -1) {
      handlers.splice(index2, 2);
    }
    return this;
  };
  this.getHandler = function(file) {
    for (let i = 0, l = handlers.length; i < l; i += 2) {
      const regex = handlers[i];
      const loader = handlers[i + 1];
      if (regex.global)
        regex.lastIndex = 0;
      if (regex.test(file)) {
        return loader;
      }
    }
    return null;
  };
}
const DefaultLoadingManager = new LoadingManager();
function Loader(manager) {
  this.manager = manager !== void 0 ? manager : DefaultLoadingManager;
  this.crossOrigin = "anonymous";
  this.withCredentials = false;
  this.path = "";
  this.resourcePath = "";
  this.requestHeader = {};
}
Object.assign(Loader.prototype, {
  load: function() {
  },
  loadAsync: function(url, onProgress) {
    const scope = this;
    return new Promise(function(resolve2, reject) {
      scope.load(url, resolve2, onProgress, reject);
    });
  },
  parse: function() {
  },
  setCrossOrigin: function(crossOrigin) {
    this.crossOrigin = crossOrigin;
    return this;
  },
  setWithCredentials: function(value) {
    this.withCredentials = value;
    return this;
  },
  setPath: function(path) {
    this.path = path;
    return this;
  },
  setResourcePath: function(resourcePath) {
    this.resourcePath = resourcePath;
    return this;
  },
  setRequestHeader: function(requestHeader) {
    this.requestHeader = requestHeader;
    return this;
  }
});
const loading = {};
function FileLoader(manager) {
  Loader.call(this, manager);
}
FileLoader.prototype = Object.assign(Object.create(Loader.prototype), {
  constructor: FileLoader,
  load: function(url, onLoad, onProgress, onError) {
    if (url === void 0)
      url = "";
    if (this.path !== void 0)
      url = this.path + url;
    url = this.manager.resolveURL(url);
    const scope = this;
    const cached = Cache.get(url);
    if (cached !== void 0) {
      scope.manager.itemStart(url);
      setTimeout(function() {
        if (onLoad)
          onLoad(cached);
        scope.manager.itemEnd(url);
      }, 0);
      return cached;
    }
    if (loading[url] !== void 0) {
      loading[url].push({
        onLoad,
        onProgress,
        onError
      });
      return;
    }
    const dataUriRegex = /^data:(.*?)(;base64)?,(.*)$/;
    const dataUriRegexResult = url.match(dataUriRegex);
    let request;
    if (dataUriRegexResult) {
      const mimeType = dataUriRegexResult[1];
      const isBase64 = !!dataUriRegexResult[2];
      let data = dataUriRegexResult[3];
      data = decodeURIComponent(data);
      if (isBase64)
        data = atob(data);
      try {
        let response;
        const responseType = (this.responseType || "").toLowerCase();
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            const view = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
              view[i] = data.charCodeAt(i);
            }
            if (responseType === "blob") {
              response = new Blob([view.buffer], {type: mimeType});
            } else {
              response = view.buffer;
            }
            break;
          case "document":
            const parser = new DOMParser();
            response = parser.parseFromString(data, mimeType);
            break;
          case "json":
            response = JSON.parse(data);
            break;
          default:
            response = data;
            break;
        }
        setTimeout(function() {
          if (onLoad)
            onLoad(response);
          scope.manager.itemEnd(url);
        }, 0);
      } catch (error2) {
        setTimeout(function() {
          if (onError)
            onError(error2);
          scope.manager.itemError(url);
          scope.manager.itemEnd(url);
        }, 0);
      }
    } else {
      loading[url] = [];
      loading[url].push({
        onLoad,
        onProgress,
        onError
      });
      request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.addEventListener("load", function(event) {
        const response = this.response;
        const callbacks = loading[url];
        delete loading[url];
        if (this.status === 200 || this.status === 0) {
          if (this.status === 0)
            console.warn("THREE.FileLoader: HTTP Status 0 received.");
          Cache.add(url, response);
          for (let i = 0, il = callbacks.length; i < il; i++) {
            const callback = callbacks[i];
            if (callback.onLoad)
              callback.onLoad(response);
          }
          scope.manager.itemEnd(url);
        } else {
          for (let i = 0, il = callbacks.length; i < il; i++) {
            const callback = callbacks[i];
            if (callback.onError)
              callback.onError(event);
          }
          scope.manager.itemError(url);
          scope.manager.itemEnd(url);
        }
      }, false);
      request.addEventListener("progress", function(event) {
        const callbacks = loading[url];
        for (let i = 0, il = callbacks.length; i < il; i++) {
          const callback = callbacks[i];
          if (callback.onProgress)
            callback.onProgress(event);
        }
      }, false);
      request.addEventListener("error", function(event) {
        const callbacks = loading[url];
        delete loading[url];
        for (let i = 0, il = callbacks.length; i < il; i++) {
          const callback = callbacks[i];
          if (callback.onError)
            callback.onError(event);
        }
        scope.manager.itemError(url);
        scope.manager.itemEnd(url);
      }, false);
      request.addEventListener("abort", function(event) {
        const callbacks = loading[url];
        delete loading[url];
        for (let i = 0, il = callbacks.length; i < il; i++) {
          const callback = callbacks[i];
          if (callback.onError)
            callback.onError(event);
        }
        scope.manager.itemError(url);
        scope.manager.itemEnd(url);
      }, false);
      if (this.responseType !== void 0)
        request.responseType = this.responseType;
      if (this.withCredentials !== void 0)
        request.withCredentials = this.withCredentials;
      if (request.overrideMimeType)
        request.overrideMimeType(this.mimeType !== void 0 ? this.mimeType : "text/plain");
      for (const header in this.requestHeader) {
        request.setRequestHeader(header, this.requestHeader[header]);
      }
      request.send(null);
    }
    scope.manager.itemStart(url);
    return request;
  },
  setResponseType: function(value) {
    this.responseType = value;
    return this;
  },
  setMimeType: function(value) {
    this.mimeType = value;
    return this;
  }
});
function CompressedTextureLoader(manager) {
  Loader.call(this, manager);
}
CompressedTextureLoader.prototype = Object.assign(Object.create(Loader.prototype), {
  constructor: CompressedTextureLoader,
  load: function(url, onLoad, onProgress, onError) {
    const scope = this;
    const images = [];
    const texture = new CompressedTexture();
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    let loaded = 0;
    function loadTexture(i) {
      loader.load(url[i], function(buffer) {
        const texDatas = scope.parse(buffer, true);
        images[i] = {
          width: texDatas.width,
          height: texDatas.height,
          format: texDatas.format,
          mipmaps: texDatas.mipmaps
        };
        loaded += 1;
        if (loaded === 6) {
          if (texDatas.mipmapCount === 1)
            texture.minFilter = LinearFilter;
          texture.image = images;
          texture.format = texDatas.format;
          texture.needsUpdate = true;
          if (onLoad)
            onLoad(texture);
        }
      }, onProgress, onError);
    }
    if (Array.isArray(url)) {
      for (let i = 0, il = url.length; i < il; ++i) {
        loadTexture(i);
      }
    } else {
      loader.load(url, function(buffer) {
        const texDatas = scope.parse(buffer, true);
        if (texDatas.isCubemap) {
          const faces = texDatas.mipmaps.length / texDatas.mipmapCount;
          for (let f = 0; f < faces; f++) {
            images[f] = {mipmaps: []};
            for (let i = 0; i < texDatas.mipmapCount; i++) {
              images[f].mipmaps.push(texDatas.mipmaps[f * texDatas.mipmapCount + i]);
              images[f].format = texDatas.format;
              images[f].width = texDatas.width;
              images[f].height = texDatas.height;
            }
          }
          texture.image = images;
        } else {
          texture.image.width = texDatas.width;
          texture.image.height = texDatas.height;
          texture.mipmaps = texDatas.mipmaps;
        }
        if (texDatas.mipmapCount === 1) {
          texture.minFilter = LinearFilter;
        }
        texture.format = texDatas.format;
        texture.needsUpdate = true;
        if (onLoad)
          onLoad(texture);
      }, onProgress, onError);
    }
    return texture;
  }
});
class ImageLoader extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    if (this.path !== void 0)
      url = this.path + url;
    url = this.manager.resolveURL(url);
    const scope = this;
    const cached = Cache.get(url);
    if (cached !== void 0) {
      scope.manager.itemStart(url);
      setTimeout(function() {
        if (onLoad)
          onLoad(cached);
        scope.manager.itemEnd(url);
      }, 0);
      return cached;
    }
    const image = document.createElementNS("http://www.w3.org/1999/xhtml", "img");
    function onImageLoad() {
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
      Cache.add(url, this);
      if (onLoad)
        onLoad(this);
      scope.manager.itemEnd(url);
    }
    function onImageError(event) {
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
      if (onError)
        onError(event);
      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    }
    image.addEventListener("load", onImageLoad, false);
    image.addEventListener("error", onImageError, false);
    if (url.substr(0, 5) !== "data:") {
      if (this.crossOrigin !== void 0)
        image.crossOrigin = this.crossOrigin;
    }
    scope.manager.itemStart(url);
    image.src = url;
    return image;
  }
}
class CubeTextureLoader extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(urls, onLoad, onProgress, onError) {
    const texture = new CubeTexture();
    const loader = new ImageLoader(this.manager);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setPath(this.path);
    let loaded = 0;
    function loadTexture(i) {
      loader.load(urls[i], function(image) {
        texture.images[i] = image;
        loaded++;
        if (loaded === 6) {
          texture.needsUpdate = true;
          if (onLoad)
            onLoad(texture);
        }
      }, void 0, onError);
    }
    for (let i = 0; i < urls.length; ++i) {
      loadTexture(i);
    }
    return texture;
  }
}
function DataTextureLoader(manager) {
  Loader.call(this, manager);
}
DataTextureLoader.prototype = Object.assign(Object.create(Loader.prototype), {
  constructor: DataTextureLoader,
  load: function(url, onLoad, onProgress, onError) {
    const scope = this;
    const texture = new DataTexture();
    const loader = new FileLoader(this.manager);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setPath(this.path);
    loader.setWithCredentials(scope.withCredentials);
    loader.load(url, function(buffer) {
      const texData = scope.parse(buffer);
      if (!texData)
        return;
      if (texData.image !== void 0) {
        texture.image = texData.image;
      } else if (texData.data !== void 0) {
        texture.image.width = texData.width;
        texture.image.height = texData.height;
        texture.image.data = texData.data;
      }
      texture.wrapS = texData.wrapS !== void 0 ? texData.wrapS : ClampToEdgeWrapping;
      texture.wrapT = texData.wrapT !== void 0 ? texData.wrapT : ClampToEdgeWrapping;
      texture.magFilter = texData.magFilter !== void 0 ? texData.magFilter : LinearFilter;
      texture.minFilter = texData.minFilter !== void 0 ? texData.minFilter : LinearFilter;
      texture.anisotropy = texData.anisotropy !== void 0 ? texData.anisotropy : 1;
      if (texData.encoding !== void 0) {
        texture.encoding = texData.encoding;
      }
      if (texData.flipY !== void 0) {
        texture.flipY = texData.flipY;
      }
      if (texData.format !== void 0) {
        texture.format = texData.format;
      }
      if (texData.type !== void 0) {
        texture.type = texData.type;
      }
      if (texData.mipmaps !== void 0) {
        texture.mipmaps = texData.mipmaps;
        texture.minFilter = LinearMipmapLinearFilter;
      }
      if (texData.mipmapCount === 1) {
        texture.minFilter = LinearFilter;
      }
      texture.needsUpdate = true;
      if (onLoad)
        onLoad(texture, texData);
    }, onProgress, onError);
    return texture;
  }
});
function TextureLoader(manager) {
  Loader.call(this, manager);
}
TextureLoader.prototype = Object.assign(Object.create(Loader.prototype), {
  constructor: TextureLoader,
  load: function(url, onLoad, onProgress, onError) {
    const texture = new Texture();
    const loader = new ImageLoader(this.manager);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setPath(this.path);
    loader.load(url, function(image) {
      texture.image = image;
      const isJPEG = url.search(/\.jpe?g($|\?)/i) > 0 || url.search(/^data\:image\/jpeg/) === 0;
      texture.format = isJPEG ? RGBFormat : RGBAFormat;
      texture.needsUpdate = true;
      if (onLoad !== void 0) {
        onLoad(texture);
      }
    }, onProgress, onError);
    return texture;
  }
});
function Curve() {
  this.type = "Curve";
  this.arcLengthDivisions = 200;
}
Object.assign(Curve.prototype, {
  getPoint: function() {
    console.warn("THREE.Curve: .getPoint() not implemented.");
    return null;
  },
  getPointAt: function(u, optionalTarget) {
    const t = this.getUtoTmapping(u);
    return this.getPoint(t, optionalTarget);
  },
  getPoints: function(divisions = 5) {
    const points = [];
    for (let d2 = 0; d2 <= divisions; d2++) {
      points.push(this.getPoint(d2 / divisions));
    }
    return points;
  },
  getSpacedPoints: function(divisions = 5) {
    const points = [];
    for (let d2 = 0; d2 <= divisions; d2++) {
      points.push(this.getPointAt(d2 / divisions));
    }
    return points;
  },
  getLength: function() {
    const lengths = this.getLengths();
    return lengths[lengths.length - 1];
  },
  getLengths: function(divisions) {
    if (divisions === void 0)
      divisions = this.arcLengthDivisions;
    if (this.cacheArcLengths && this.cacheArcLengths.length === divisions + 1 && !this.needsUpdate) {
      return this.cacheArcLengths;
    }
    this.needsUpdate = false;
    const cache = [];
    let current, last = this.getPoint(0);
    let sum = 0;
    cache.push(0);
    for (let p = 1; p <= divisions; p++) {
      current = this.getPoint(p / divisions);
      sum += current.distanceTo(last);
      cache.push(sum);
      last = current;
    }
    this.cacheArcLengths = cache;
    return cache;
  },
  updateArcLengths: function() {
    this.needsUpdate = true;
    this.getLengths();
  },
  getUtoTmapping: function(u, distance) {
    const arcLengths = this.getLengths();
    let i = 0;
    const il = arcLengths.length;
    let targetArcLength;
    if (distance) {
      targetArcLength = distance;
    } else {
      targetArcLength = u * arcLengths[il - 1];
    }
    let low = 0, high = il - 1, comparison;
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2);
      comparison = arcLengths[i] - targetArcLength;
      if (comparison < 0) {
        low = i + 1;
      } else if (comparison > 0) {
        high = i - 1;
      } else {
        high = i;
        break;
      }
    }
    i = high;
    if (arcLengths[i] === targetArcLength) {
      return i / (il - 1);
    }
    const lengthBefore = arcLengths[i];
    const lengthAfter = arcLengths[i + 1];
    const segmentLength = lengthAfter - lengthBefore;
    const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;
    const t = (i + segmentFraction) / (il - 1);
    return t;
  },
  getTangent: function(t, optionalTarget) {
    const delta = 1e-4;
    let t1 = t - delta;
    let t2 = t + delta;
    if (t1 < 0)
      t1 = 0;
    if (t2 > 1)
      t2 = 1;
    const pt1 = this.getPoint(t1);
    const pt2 = this.getPoint(t2);
    const tangent = optionalTarget || (pt1.isVector2 ? new Vector2() : new Vector3());
    tangent.copy(pt2).sub(pt1).normalize();
    return tangent;
  },
  getTangentAt: function(u, optionalTarget) {
    const t = this.getUtoTmapping(u);
    return this.getTangent(t, optionalTarget);
  },
  computeFrenetFrames: function(segments, closed) {
    const normal = new Vector3();
    const tangents = [];
    const normals = [];
    const binormals = [];
    const vec = new Vector3();
    const mat = new Matrix4();
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      tangents[i] = this.getTangentAt(u, new Vector3());
      tangents[i].normalize();
    }
    normals[0] = new Vector3();
    binormals[0] = new Vector3();
    let min = Number.MAX_VALUE;
    const tx = Math.abs(tangents[0].x);
    const ty = Math.abs(tangents[0].y);
    const tz = Math.abs(tangents[0].z);
    if (tx <= min) {
      min = tx;
      normal.set(1, 0, 0);
    }
    if (ty <= min) {
      min = ty;
      normal.set(0, 1, 0);
    }
    if (tz <= min) {
      normal.set(0, 0, 1);
    }
    vec.crossVectors(tangents[0], normal).normalize();
    normals[0].crossVectors(tangents[0], vec);
    binormals[0].crossVectors(tangents[0], normals[0]);
    for (let i = 1; i <= segments; i++) {
      normals[i] = normals[i - 1].clone();
      binormals[i] = binormals[i - 1].clone();
      vec.crossVectors(tangents[i - 1], tangents[i]);
      if (vec.length() > Number.EPSILON) {
        vec.normalize();
        const theta = Math.acos(MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
        normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
      }
      binormals[i].crossVectors(tangents[i], normals[i]);
    }
    if (closed === true) {
      let theta = Math.acos(MathUtils.clamp(normals[0].dot(normals[segments]), -1, 1));
      theta /= segments;
      if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
        theta = -theta;
      }
      for (let i = 1; i <= segments; i++) {
        normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i));
        binormals[i].crossVectors(tangents[i], normals[i]);
      }
    }
    return {
      tangents,
      normals,
      binormals
    };
  },
  clone: function() {
    return new this.constructor().copy(this);
  },
  copy: function(source) {
    this.arcLengthDivisions = source.arcLengthDivisions;
    return this;
  },
  toJSON: function() {
    const data = {
      metadata: {
        version: 4.5,
        type: "Curve",
        generator: "Curve.toJSON"
      }
    };
    data.arcLengthDivisions = this.arcLengthDivisions;
    data.type = this.type;
    return data;
  },
  fromJSON: function(json) {
    this.arcLengthDivisions = json.arcLengthDivisions;
    return this;
  }
});
class Light extends Object3D {
  constructor(color, intensity = 1) {
    super();
    this.type = "Light";
    this.color = new Color(color);
    this.intensity = intensity;
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.intensity = source.intensity;
    return this;
  }
  toJSON(meta) {
    const data = super.toJSON(meta);
    data.object.color = this.color.getHex();
    data.object.intensity = this.intensity;
    if (this.groundColor !== void 0)
      data.object.groundColor = this.groundColor.getHex();
    if (this.distance !== void 0)
      data.object.distance = this.distance;
    if (this.angle !== void 0)
      data.object.angle = this.angle;
    if (this.decay !== void 0)
      data.object.decay = this.decay;
    if (this.penumbra !== void 0)
      data.object.penumbra = this.penumbra;
    if (this.shadow !== void 0)
      data.object.shadow = this.shadow.toJSON();
    return data;
  }
}
Light.prototype.isLight = true;
const LoaderUtils = {
  decodeText: function(array) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(array);
    }
    let s2 = "";
    for (let i = 0, il = array.length; i < il; i++) {
      s2 += String.fromCharCode(array[i]);
    }
    try {
      return decodeURIComponent(escape(s2));
    } catch (e) {
      return s2;
    }
  },
  extractUrlBase: function(url) {
    const index2 = url.lastIndexOf("/");
    if (index2 === -1)
      return "./";
    return url.substr(0, index2 + 1);
  }
};
function InstancedBufferGeometry() {
  BufferGeometry.call(this);
  this.type = "InstancedBufferGeometry";
  this.instanceCount = Infinity;
}
InstancedBufferGeometry.prototype = Object.assign(Object.create(BufferGeometry.prototype), {
  constructor: InstancedBufferGeometry,
  isInstancedBufferGeometry: true,
  copy: function(source) {
    BufferGeometry.prototype.copy.call(this, source);
    this.instanceCount = source.instanceCount;
    return this;
  },
  clone: function() {
    return new this.constructor().copy(this);
  },
  toJSON: function() {
    const data = BufferGeometry.prototype.toJSON.call(this);
    data.instanceCount = this.instanceCount;
    data.isInstancedBufferGeometry = true;
    return data;
  }
});
function InstancedBufferAttribute(array, itemSize, normalized, meshPerAttribute) {
  if (typeof normalized === "number") {
    meshPerAttribute = normalized;
    normalized = false;
    console.error("THREE.InstancedBufferAttribute: The constructor now expects normalized as the third argument.");
  }
  BufferAttribute.call(this, array, itemSize, normalized);
  this.meshPerAttribute = meshPerAttribute || 1;
}
InstancedBufferAttribute.prototype = Object.assign(Object.create(BufferAttribute.prototype), {
  constructor: InstancedBufferAttribute,
  isInstancedBufferAttribute: true,
  copy: function(source) {
    BufferAttribute.prototype.copy.call(this, source);
    this.meshPerAttribute = source.meshPerAttribute;
    return this;
  },
  toJSON: function() {
    const data = BufferAttribute.prototype.toJSON.call(this);
    data.meshPerAttribute = this.meshPerAttribute;
    data.isInstancedBufferAttribute = true;
    return data;
  }
});
function ImageBitmapLoader(manager) {
  if (typeof createImageBitmap === "undefined") {
    console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported.");
  }
  if (typeof fetch === "undefined") {
    console.warn("THREE.ImageBitmapLoader: fetch() not supported.");
  }
  Loader.call(this, manager);
  this.options = {premultiplyAlpha: "none"};
}
ImageBitmapLoader.prototype = Object.assign(Object.create(Loader.prototype), {
  constructor: ImageBitmapLoader,
  isImageBitmapLoader: true,
  setOptions: function setOptions(options) {
    this.options = options;
    return this;
  },
  load: function(url, onLoad, onProgress, onError) {
    if (url === void 0)
      url = "";
    if (this.path !== void 0)
      url = this.path + url;
    url = this.manager.resolveURL(url);
    const scope = this;
    const cached = Cache.get(url);
    if (cached !== void 0) {
      scope.manager.itemStart(url);
      setTimeout(function() {
        if (onLoad)
          onLoad(cached);
        scope.manager.itemEnd(url);
      }, 0);
      return cached;
    }
    const fetchOptions = {};
    fetchOptions.credentials = this.crossOrigin === "anonymous" ? "same-origin" : "include";
    fetchOptions.headers = this.requestHeader;
    fetch(url, fetchOptions).then(function(res) {
      return res.blob();
    }).then(function(blob) {
      return createImageBitmap(blob, Object.assign(scope.options, {colorSpaceConversion: "none"}));
    }).then(function(imageBitmap) {
      Cache.add(url, imageBitmap);
      if (onLoad)
        onLoad(imageBitmap);
      scope.manager.itemEnd(url);
    }).catch(function(e) {
      if (onError)
        onError(e);
      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    });
    scope.manager.itemStart(url);
  }
});
let _context;
const AudioContext = {
  getContext: function() {
    if (_context === void 0) {
      _context = new (window.AudioContext || window.webkitAudioContext)();
    }
    return _context;
  },
  setContext: function(value) {
    _context = value;
  }
};
class AudioLoader extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new FileLoader(this.manager);
    loader.setResponseType("arraybuffer");
    loader.setPath(this.path);
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(url, function(buffer) {
      try {
        const bufferCopy = buffer.slice(0);
        const context = AudioContext.getContext();
        context.decodeAudioData(bufferCopy, function(audioBuffer) {
          onLoad(audioBuffer);
        });
      } catch (e) {
        if (onError) {
          onError(e);
        } else {
          console.error(e);
        }
        scope.manager.itemError(url);
      }
    }, onProgress, onError);
  }
}
new Matrix4();
new Matrix4();
class Audio extends Object3D {
  constructor(listener) {
    super();
    this.type = "Audio";
    this.listener = listener;
    this.context = listener.context;
    this.gain = this.context.createGain();
    this.gain.connect(listener.getInput());
    this.autoplay = false;
    this.buffer = null;
    this.detune = 0;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.offset = 0;
    this.duration = void 0;
    this.playbackRate = 1;
    this.isPlaying = false;
    this.hasPlaybackControl = true;
    this.source = null;
    this.sourceType = "empty";
    this._startedAt = 0;
    this._progress = 0;
    this._connected = false;
    this.filters = [];
  }
  getOutput() {
    return this.gain;
  }
  setNodeSource(audioNode) {
    this.hasPlaybackControl = false;
    this.sourceType = "audioNode";
    this.source = audioNode;
    this.connect();
    return this;
  }
  setMediaElementSource(mediaElement) {
    this.hasPlaybackControl = false;
    this.sourceType = "mediaNode";
    this.source = this.context.createMediaElementSource(mediaElement);
    this.connect();
    return this;
  }
  setMediaStreamSource(mediaStream) {
    this.hasPlaybackControl = false;
    this.sourceType = "mediaStreamNode";
    this.source = this.context.createMediaStreamSource(mediaStream);
    this.connect();
    return this;
  }
  setBuffer(audioBuffer) {
    this.buffer = audioBuffer;
    this.sourceType = "buffer";
    if (this.autoplay)
      this.play();
    return this;
  }
  play(delay = 0) {
    if (this.isPlaying === true) {
      console.warn("THREE.Audio: Audio is already playing.");
      return;
    }
    if (this.hasPlaybackControl === false) {
      console.warn("THREE.Audio: this Audio has no playback control.");
      return;
    }
    this._startedAt = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loop;
    source.loopStart = this.loopStart;
    source.loopEnd = this.loopEnd;
    source.onended = this.onEnded.bind(this);
    source.start(this._startedAt, this._progress + this.offset, this.duration);
    this.isPlaying = true;
    this.source = source;
    this.setDetune(this.detune);
    this.setPlaybackRate(this.playbackRate);
    return this.connect();
  }
  pause() {
    if (this.hasPlaybackControl === false) {
      console.warn("THREE.Audio: this Audio has no playback control.");
      return;
    }
    if (this.isPlaying === true) {
      this._progress += Math.max(this.context.currentTime - this._startedAt, 0) * this.playbackRate;
      if (this.loop === true) {
        this._progress = this._progress % (this.duration || this.buffer.duration);
      }
      this.source.stop();
      this.source.onended = null;
      this.isPlaying = false;
    }
    return this;
  }
  stop() {
    if (this.hasPlaybackControl === false) {
      console.warn("THREE.Audio: this Audio has no playback control.");
      return;
    }
    this._progress = 0;
    this.source.stop();
    this.source.onended = null;
    this.isPlaying = false;
    return this;
  }
  connect() {
    if (this.filters.length > 0) {
      this.source.connect(this.filters[0]);
      for (let i = 1, l = this.filters.length; i < l; i++) {
        this.filters[i - 1].connect(this.filters[i]);
      }
      this.filters[this.filters.length - 1].connect(this.getOutput());
    } else {
      this.source.connect(this.getOutput());
    }
    this._connected = true;
    return this;
  }
  disconnect() {
    if (this.filters.length > 0) {
      this.source.disconnect(this.filters[0]);
      for (let i = 1, l = this.filters.length; i < l; i++) {
        this.filters[i - 1].disconnect(this.filters[i]);
      }
      this.filters[this.filters.length - 1].disconnect(this.getOutput());
    } else {
      this.source.disconnect(this.getOutput());
    }
    this._connected = false;
    return this;
  }
  getFilters() {
    return this.filters;
  }
  setFilters(value) {
    if (!value)
      value = [];
    if (this._connected === true) {
      this.disconnect();
      this.filters = value.slice();
      this.connect();
    } else {
      this.filters = value.slice();
    }
    return this;
  }
  setDetune(value) {
    this.detune = value;
    if (this.source.detune === void 0)
      return;
    if (this.isPlaying === true) {
      this.source.detune.setTargetAtTime(this.detune, this.context.currentTime, 0.01);
    }
    return this;
  }
  getDetune() {
    return this.detune;
  }
  getFilter() {
    return this.getFilters()[0];
  }
  setFilter(filter) {
    return this.setFilters(filter ? [filter] : []);
  }
  setPlaybackRate(value) {
    if (this.hasPlaybackControl === false) {
      console.warn("THREE.Audio: this Audio has no playback control.");
      return;
    }
    this.playbackRate = value;
    if (this.isPlaying === true) {
      this.source.playbackRate.setTargetAtTime(this.playbackRate, this.context.currentTime, 0.01);
    }
    return this;
  }
  getPlaybackRate() {
    return this.playbackRate;
  }
  onEnded() {
    this.isPlaying = false;
  }
  getLoop() {
    if (this.hasPlaybackControl === false) {
      console.warn("THREE.Audio: this Audio has no playback control.");
      return false;
    }
    return this.loop;
  }
  setLoop(value) {
    if (this.hasPlaybackControl === false) {
      console.warn("THREE.Audio: this Audio has no playback control.");
      return;
    }
    this.loop = value;
    if (this.isPlaying === true) {
      this.source.loop = this.loop;
    }
    return this;
  }
  setLoopStart(value) {
    this.loopStart = value;
    return this;
  }
  setLoopEnd(value) {
    this.loopEnd = value;
    return this;
  }
  getVolume() {
    return this.gain.gain.value;
  }
  setVolume(value) {
    this.gain.gain.setTargetAtTime(value, this.context.currentTime, 0.01);
    return this;
  }
}
const _RESERVED_CHARS_RE = "\\[\\]\\.:\\/";
const _reservedRe = new RegExp("[" + _RESERVED_CHARS_RE + "]", "g");
const _wordChar = "[^" + _RESERVED_CHARS_RE + "]";
const _wordCharOrDot = "[^" + _RESERVED_CHARS_RE.replace("\\.", "") + "]";
const _directoryRe = /((?:WC+[\/:])*)/.source.replace("WC", _wordChar);
const _nodeRe = /(WCOD+)?/.source.replace("WCOD", _wordCharOrDot);
const _objectRe = /(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC", _wordChar);
const _propertyRe = /\.(WC+)(?:\[(.+)\])?/.source.replace("WC", _wordChar);
const _trackRe = new RegExp("^" + _directoryRe + _nodeRe + _objectRe + _propertyRe + "$");
const _supportedObjectNames = ["material", "materials", "bones"];
function Composite(targetGroup, path, optionalParsedPath) {
  const parsedPath = optionalParsedPath || PropertyBinding.parseTrackName(path);
  this._targetGroup = targetGroup;
  this._bindings = targetGroup.subscribe_(path, parsedPath);
}
Object.assign(Composite.prototype, {
  getValue: function(array, offset) {
    this.bind();
    const firstValidIndex = this._targetGroup.nCachedObjects_, binding = this._bindings[firstValidIndex];
    if (binding !== void 0)
      binding.getValue(array, offset);
  },
  setValue: function(array, offset) {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
      bindings[i].setValue(array, offset);
    }
  },
  bind: function() {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
      bindings[i].bind();
    }
  },
  unbind: function() {
    const bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i) {
      bindings[i].unbind();
    }
  }
});
function PropertyBinding(rootNode, path, parsedPath) {
  this.path = path;
  this.parsedPath = parsedPath || PropertyBinding.parseTrackName(path);
  this.node = PropertyBinding.findNode(rootNode, this.parsedPath.nodeName) || rootNode;
  this.rootNode = rootNode;
}
Object.assign(PropertyBinding, {
  Composite,
  create: function(root, path, parsedPath) {
    if (!(root && root.isAnimationObjectGroup)) {
      return new PropertyBinding(root, path, parsedPath);
    } else {
      return new PropertyBinding.Composite(root, path, parsedPath);
    }
  },
  sanitizeNodeName: function(name) {
    return name.replace(/\s/g, "_").replace(_reservedRe, "");
  },
  parseTrackName: function(trackName) {
    const matches = _trackRe.exec(trackName);
    if (!matches) {
      throw new Error("PropertyBinding: Cannot parse trackName: " + trackName);
    }
    const results = {
      nodeName: matches[2],
      objectName: matches[3],
      objectIndex: matches[4],
      propertyName: matches[5],
      propertyIndex: matches[6]
    };
    const lastDot = results.nodeName && results.nodeName.lastIndexOf(".");
    if (lastDot !== void 0 && lastDot !== -1) {
      const objectName = results.nodeName.substring(lastDot + 1);
      if (_supportedObjectNames.indexOf(objectName) !== -1) {
        results.nodeName = results.nodeName.substring(0, lastDot);
        results.objectName = objectName;
      }
    }
    if (results.propertyName === null || results.propertyName.length === 0) {
      throw new Error("PropertyBinding: can not parse propertyName from trackName: " + trackName);
    }
    return results;
  },
  findNode: function(root, nodeName) {
    if (!nodeName || nodeName === "" || nodeName === "." || nodeName === -1 || nodeName === root.name || nodeName === root.uuid) {
      return root;
    }
    if (root.skeleton) {
      const bone = root.skeleton.getBoneByName(nodeName);
      if (bone !== void 0) {
        return bone;
      }
    }
    if (root.children) {
      const searchNodeSubtree = function(children) {
        for (let i = 0; i < children.length; i++) {
          const childNode = children[i];
          if (childNode.name === nodeName || childNode.uuid === nodeName) {
            return childNode;
          }
          const result = searchNodeSubtree(childNode.children);
          if (result)
            return result;
        }
        return null;
      };
      const subTreeNode = searchNodeSubtree(root.children);
      if (subTreeNode) {
        return subTreeNode;
      }
    }
    return null;
  }
});
Object.assign(PropertyBinding.prototype, {
  _getValue_unavailable: function() {
  },
  _setValue_unavailable: function() {
  },
  BindingType: {
    Direct: 0,
    EntireArray: 1,
    ArrayElement: 2,
    HasFromToArray: 3
  },
  Versioning: {
    None: 0,
    NeedsUpdate: 1,
    MatrixWorldNeedsUpdate: 2
  },
  GetterByBindingType: [
    function getValue_direct(buffer, offset) {
      buffer[offset] = this.node[this.propertyName];
    },
    function getValue_array(buffer, offset) {
      const source = this.resolvedProperty;
      for (let i = 0, n = source.length; i !== n; ++i) {
        buffer[offset++] = source[i];
      }
    },
    function getValue_arrayElement(buffer, offset) {
      buffer[offset] = this.resolvedProperty[this.propertyIndex];
    },
    function getValue_toArray(buffer, offset) {
      this.resolvedProperty.toArray(buffer, offset);
    }
  ],
  SetterByBindingTypeAndVersioning: [
    [
      function setValue_direct(buffer, offset) {
        this.targetObject[this.propertyName] = buffer[offset];
      },
      function setValue_direct_setNeedsUpdate(buffer, offset) {
        this.targetObject[this.propertyName] = buffer[offset];
        this.targetObject.needsUpdate = true;
      },
      function setValue_direct_setMatrixWorldNeedsUpdate(buffer, offset) {
        this.targetObject[this.propertyName] = buffer[offset];
        this.targetObject.matrixWorldNeedsUpdate = true;
      }
    ],
    [
      function setValue_array(buffer, offset) {
        const dest = this.resolvedProperty;
        for (let i = 0, n = dest.length; i !== n; ++i) {
          dest[i] = buffer[offset++];
        }
      },
      function setValue_array_setNeedsUpdate(buffer, offset) {
        const dest = this.resolvedProperty;
        for (let i = 0, n = dest.length; i !== n; ++i) {
          dest[i] = buffer[offset++];
        }
        this.targetObject.needsUpdate = true;
      },
      function setValue_array_setMatrixWorldNeedsUpdate(buffer, offset) {
        const dest = this.resolvedProperty;
        for (let i = 0, n = dest.length; i !== n; ++i) {
          dest[i] = buffer[offset++];
        }
        this.targetObject.matrixWorldNeedsUpdate = true;
      }
    ],
    [
      function setValue_arrayElement(buffer, offset) {
        this.resolvedProperty[this.propertyIndex] = buffer[offset];
      },
      function setValue_arrayElement_setNeedsUpdate(buffer, offset) {
        this.resolvedProperty[this.propertyIndex] = buffer[offset];
        this.targetObject.needsUpdate = true;
      },
      function setValue_arrayElement_setMatrixWorldNeedsUpdate(buffer, offset) {
        this.resolvedProperty[this.propertyIndex] = buffer[offset];
        this.targetObject.matrixWorldNeedsUpdate = true;
      }
    ],
    [
      function setValue_fromArray(buffer, offset) {
        this.resolvedProperty.fromArray(buffer, offset);
      },
      function setValue_fromArray_setNeedsUpdate(buffer, offset) {
        this.resolvedProperty.fromArray(buffer, offset);
        this.targetObject.needsUpdate = true;
      },
      function setValue_fromArray_setMatrixWorldNeedsUpdate(buffer, offset) {
        this.resolvedProperty.fromArray(buffer, offset);
        this.targetObject.matrixWorldNeedsUpdate = true;
      }
    ]
  ],
  getValue: function getValue_unbound(targetArray, offset) {
    this.bind();
    this.getValue(targetArray, offset);
  },
  setValue: function getValue_unbound2(sourceArray, offset) {
    this.bind();
    this.setValue(sourceArray, offset);
  },
  bind: function() {
    let targetObject = this.node;
    const parsedPath = this.parsedPath;
    const objectName = parsedPath.objectName;
    const propertyName = parsedPath.propertyName;
    let propertyIndex = parsedPath.propertyIndex;
    if (!targetObject) {
      targetObject = PropertyBinding.findNode(this.rootNode, parsedPath.nodeName) || this.rootNode;
      this.node = targetObject;
    }
    this.getValue = this._getValue_unavailable;
    this.setValue = this._setValue_unavailable;
    if (!targetObject) {
      console.error("THREE.PropertyBinding: Trying to update node for track: " + this.path + " but it wasn't found.");
      return;
    }
    if (objectName) {
      let objectIndex = parsedPath.objectIndex;
      switch (objectName) {
        case "materials":
          if (!targetObject.material) {
            console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!targetObject.material.materials) {
            console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.", this);
            return;
          }
          targetObject = targetObject.material.materials;
          break;
        case "bones":
          if (!targetObject.skeleton) {
            console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
            return;
          }
          targetObject = targetObject.skeleton.bones;
          for (let i = 0; i < targetObject.length; i++) {
            if (targetObject[i].name === objectIndex) {
              objectIndex = i;
              break;
            }
          }
          break;
        default:
          if (targetObject[objectName] === void 0) {
            console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.", this);
            return;
          }
          targetObject = targetObject[objectName];
      }
      if (objectIndex !== void 0) {
        if (targetObject[objectIndex] === void 0) {
          console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, targetObject);
          return;
        }
        targetObject = targetObject[objectIndex];
      }
    }
    const nodeProperty = targetObject[propertyName];
    if (nodeProperty === void 0) {
      const nodeName = parsedPath.nodeName;
      console.error("THREE.PropertyBinding: Trying to update property for track: " + nodeName + "." + propertyName + " but it wasn't found.", targetObject);
      return;
    }
    let versioning = this.Versioning.None;
    this.targetObject = targetObject;
    if (targetObject.needsUpdate !== void 0) {
      versioning = this.Versioning.NeedsUpdate;
    } else if (targetObject.matrixWorldNeedsUpdate !== void 0) {
      versioning = this.Versioning.MatrixWorldNeedsUpdate;
    }
    let bindingType = this.BindingType.Direct;
    if (propertyIndex !== void 0) {
      if (propertyName === "morphTargetInfluences") {
        if (!targetObject.geometry) {
          console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
          return;
        }
        if (targetObject.geometry.isBufferGeometry) {
          if (!targetObject.geometry.morphAttributes) {
            console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.", this);
            return;
          }
          if (targetObject.morphTargetDictionary[propertyIndex] !== void 0) {
            propertyIndex = targetObject.morphTargetDictionary[propertyIndex];
          }
        } else {
          console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences on THREE.Geometry. Use THREE.BufferGeometry instead.", this);
          return;
        }
      }
      bindingType = this.BindingType.ArrayElement;
      this.resolvedProperty = nodeProperty;
      this.propertyIndex = propertyIndex;
    } else if (nodeProperty.fromArray !== void 0 && nodeProperty.toArray !== void 0) {
      bindingType = this.BindingType.HasFromToArray;
      this.resolvedProperty = nodeProperty;
    } else if (Array.isArray(nodeProperty)) {
      bindingType = this.BindingType.EntireArray;
      this.resolvedProperty = nodeProperty;
    } else {
      this.propertyName = propertyName;
    }
    this.getValue = this.GetterByBindingType[bindingType];
    this.setValue = this.SetterByBindingTypeAndVersioning[bindingType][versioning];
  },
  unbind: function() {
    this.node = null;
    this.getValue = this._getValue_unbound;
    this.setValue = this._setValue_unbound;
  }
});
Object.assign(PropertyBinding.prototype, {
  _getValue_unbound: PropertyBinding.prototype.getValue,
  _setValue_unbound: PropertyBinding.prototype.setValue
});
class Uniform {
  constructor(value) {
    if (typeof value === "string") {
      console.warn("THREE.Uniform: Type parameter is no longer needed.");
      value = arguments[1];
    }
    this.value = value;
  }
  clone() {
    return new Uniform(this.value.clone === void 0 ? this.value : this.value.clone());
  }
}
function InstancedInterleavedBuffer(array, stride, meshPerAttribute) {
  InterleavedBuffer.call(this, array, stride);
  this.meshPerAttribute = meshPerAttribute || 1;
}
InstancedInterleavedBuffer.prototype = Object.assign(Object.create(InterleavedBuffer.prototype), {
  constructor: InstancedInterleavedBuffer,
  isInstancedInterleavedBuffer: true,
  copy: function(source) {
    InterleavedBuffer.prototype.copy.call(this, source);
    this.meshPerAttribute = source.meshPerAttribute;
    return this;
  },
  clone: function(data) {
    const ib = InterleavedBuffer.prototype.clone.call(this, data);
    ib.meshPerAttribute = this.meshPerAttribute;
    return ib;
  },
  toJSON: function(data) {
    const json = InterleavedBuffer.prototype.toJSON.call(this, data);
    json.isInstancedInterleavedBuffer = true;
    json.meshPerAttribute = this.meshPerAttribute;
    return json;
  }
});
function GLBufferAttribute(buffer, type, itemSize, elementSize, count) {
  this.buffer = buffer;
  this.type = type;
  this.itemSize = itemSize;
  this.elementSize = elementSize;
  this.count = count;
  this.version = 0;
}
Object.defineProperty(GLBufferAttribute.prototype, "needsUpdate", {
  set: function(value) {
    if (value === true)
      this.version++;
  }
});
Object.assign(GLBufferAttribute.prototype, {
  isGLBufferAttribute: true,
  setBuffer: function(buffer) {
    this.buffer = buffer;
    return this;
  },
  setType: function(type, elementSize) {
    this.type = type;
    this.elementSize = elementSize;
    return this;
  },
  setItemSize: function(itemSize) {
    this.itemSize = itemSize;
    return this;
  },
  setCount: function(count) {
    this.count = count;
    return this;
  }
});
function Raycaster(origin, direction, near = 0, far = Infinity) {
  this.ray = new Ray(origin, direction);
  this.near = near;
  this.far = far;
  this.camera = null;
  this.layers = new Layers();
  this.params = {
    Mesh: {},
    Line: {threshold: 1},
    LOD: {},
    Points: {threshold: 1},
    Sprite: {}
  };
  Object.defineProperties(this.params, {
    PointCloud: {
      get: function() {
        console.warn("THREE.Raycaster: params.PointCloud has been renamed to params.Points.");
        return this.Points;
      }
    }
  });
}
function ascSort(a, b) {
  return a.distance - b.distance;
}
function intersectObject(object, raycaster, intersects, recursive) {
  if (object.layers.test(raycaster.layers)) {
    object.raycast(raycaster, intersects);
  }
  if (recursive === true) {
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      intersectObject(children[i], raycaster, intersects, true);
    }
  }
}
Object.assign(Raycaster.prototype, {
  set: function(origin, direction) {
    this.ray.set(origin, direction);
  },
  setFromCamera: function(coords, camera) {
    if (camera && camera.isPerspectiveCamera) {
      this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
      this.ray.direction.set(coords.x, coords.y, 0.5).unproject(camera).sub(this.ray.origin).normalize();
      this.camera = camera;
    } else if (camera && camera.isOrthographicCamera) {
      this.ray.origin.set(coords.x, coords.y, (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera);
      this.ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
      this.camera = camera;
    } else {
      console.error("THREE.Raycaster: Unsupported camera type: " + camera.type);
    }
  },
  intersectObject: function(object, recursive = false, intersects = []) {
    intersectObject(object, this, intersects, recursive);
    intersects.sort(ascSort);
    return intersects;
  },
  intersectObjects: function(objects, recursive = false, intersects = []) {
    for (let i = 0, l = objects.length; i < l; i++) {
      intersectObject(objects[i], this, intersects, recursive);
    }
    intersects.sort(ascSort);
    return intersects;
  }
});
function ImmediateRenderObject(material) {
  Object3D.call(this);
  this.material = material;
  this.render = function() {
  };
  this.hasPositions = false;
  this.hasNormals = false;
  this.hasColors = false;
  this.hasUvs = false;
  this.positionArray = null;
  this.normalArray = null;
  this.colorArray = null;
  this.uvArray = null;
  this.count = 0;
}
ImmediateRenderObject.prototype = Object.create(Object3D.prototype);
ImmediateRenderObject.prototype.constructor = ImmediateRenderObject;
ImmediateRenderObject.prototype.isImmediateRenderObject = true;
const backgroundMaterial = new MeshBasicMaterial({
  side: BackSide,
  depthWrite: false,
  depthTest: false
});
new Mesh(new BoxGeometry(), backgroundMaterial);
Curve.create = function(construct, getPoint) {
  console.log("THREE.Curve.create() has been deprecated");
  construct.prototype = Object.create(Curve.prototype);
  construct.prototype.constructor = construct;
  construct.prototype.getPoint = getPoint;
  return construct;
};
Loader.prototype.extractUrlBase = function(url) {
  console.warn("THREE.Loader: .extractUrlBase() has been deprecated. Use THREE.LoaderUtils.extractUrlBase() instead.");
  return LoaderUtils.extractUrlBase(url);
};
Loader.Handlers = {
  add: function() {
    console.error("THREE.Loader: Handlers.add() has been removed. Use LoadingManager.addHandler() instead.");
  },
  get: function() {
    console.error("THREE.Loader: Handlers.get() has been removed. Use LoadingManager.getHandler() instead.");
  }
};
Box3.prototype.center = function(optionalTarget) {
  console.warn("THREE.Box3: .center() has been renamed to .getCenter().");
  return this.getCenter(optionalTarget);
};
Box3.prototype.empty = function() {
  console.warn("THREE.Box3: .empty() has been renamed to .isEmpty().");
  return this.isEmpty();
};
Box3.prototype.isIntersectionBox = function(box) {
  console.warn("THREE.Box3: .isIntersectionBox() has been renamed to .intersectsBox().");
  return this.intersectsBox(box);
};
Box3.prototype.isIntersectionSphere = function(sphere) {
  console.warn("THREE.Box3: .isIntersectionSphere() has been renamed to .intersectsSphere().");
  return this.intersectsSphere(sphere);
};
Box3.prototype.size = function(optionalTarget) {
  console.warn("THREE.Box3: .size() has been renamed to .getSize().");
  return this.getSize(optionalTarget);
};
Sphere.prototype.empty = function() {
  console.warn("THREE.Sphere: .empty() has been renamed to .isEmpty().");
  return this.isEmpty();
};
Frustum.prototype.setFromMatrix = function(m) {
  console.warn("THREE.Frustum: .setFromMatrix() has been renamed to .setFromProjectionMatrix().");
  return this.setFromProjectionMatrix(m);
};
MathUtils.random16 = function() {
  console.warn("THREE.Math: .random16() has been deprecated. Use Math.random() instead.");
  return Math.random();
};
MathUtils.nearestPowerOfTwo = function(value) {
  console.warn("THREE.Math: .nearestPowerOfTwo() has been renamed to .floorPowerOfTwo().");
  return MathUtils.floorPowerOfTwo(value);
};
MathUtils.nextPowerOfTwo = function(value) {
  console.warn("THREE.Math: .nextPowerOfTwo() has been renamed to .ceilPowerOfTwo().");
  return MathUtils.ceilPowerOfTwo(value);
};
Matrix3.prototype.flattenToArrayOffset = function(array, offset) {
  console.warn("THREE.Matrix3: .flattenToArrayOffset() has been deprecated. Use .toArray() instead.");
  return this.toArray(array, offset);
};
Matrix3.prototype.multiplyVector3 = function(vector) {
  console.warn("THREE.Matrix3: .multiplyVector3() has been removed. Use vector.applyMatrix3( matrix ) instead.");
  return vector.applyMatrix3(this);
};
Matrix3.prototype.multiplyVector3Array = function() {
  console.error("THREE.Matrix3: .multiplyVector3Array() has been removed.");
};
Matrix3.prototype.applyToBufferAttribute = function(attribute) {
  console.warn("THREE.Matrix3: .applyToBufferAttribute() has been removed. Use attribute.applyMatrix3( matrix ) instead.");
  return attribute.applyMatrix3(this);
};
Matrix3.prototype.applyToVector3Array = function() {
  console.error("THREE.Matrix3: .applyToVector3Array() has been removed.");
};
Matrix3.prototype.getInverse = function(matrix) {
  console.warn("THREE.Matrix3: .getInverse() has been removed. Use matrixInv.copy( matrix ).invert(); instead.");
  return this.copy(matrix).invert();
};
Matrix4.prototype.extractPosition = function(m) {
  console.warn("THREE.Matrix4: .extractPosition() has been renamed to .copyPosition().");
  return this.copyPosition(m);
};
Matrix4.prototype.flattenToArrayOffset = function(array, offset) {
  console.warn("THREE.Matrix4: .flattenToArrayOffset() has been deprecated. Use .toArray() instead.");
  return this.toArray(array, offset);
};
Matrix4.prototype.getPosition = function() {
  console.warn("THREE.Matrix4: .getPosition() has been removed. Use Vector3.setFromMatrixPosition( matrix ) instead.");
  return new Vector3().setFromMatrixColumn(this, 3);
};
Matrix4.prototype.setRotationFromQuaternion = function(q) {
  console.warn("THREE.Matrix4: .setRotationFromQuaternion() has been renamed to .makeRotationFromQuaternion().");
  return this.makeRotationFromQuaternion(q);
};
Matrix4.prototype.multiplyToArray = function() {
  console.warn("THREE.Matrix4: .multiplyToArray() has been removed.");
};
Matrix4.prototype.multiplyVector3 = function(vector) {
  console.warn("THREE.Matrix4: .multiplyVector3() has been removed. Use vector.applyMatrix4( matrix ) instead.");
  return vector.applyMatrix4(this);
};
Matrix4.prototype.multiplyVector4 = function(vector) {
  console.warn("THREE.Matrix4: .multiplyVector4() has been removed. Use vector.applyMatrix4( matrix ) instead.");
  return vector.applyMatrix4(this);
};
Matrix4.prototype.multiplyVector3Array = function() {
  console.error("THREE.Matrix4: .multiplyVector3Array() has been removed.");
};
Matrix4.prototype.rotateAxis = function(v) {
  console.warn("THREE.Matrix4: .rotateAxis() has been removed. Use Vector3.transformDirection( matrix ) instead.");
  v.transformDirection(this);
};
Matrix4.prototype.crossVector = function(vector) {
  console.warn("THREE.Matrix4: .crossVector() has been removed. Use vector.applyMatrix4( matrix ) instead.");
  return vector.applyMatrix4(this);
};
Matrix4.prototype.translate = function() {
  console.error("THREE.Matrix4: .translate() has been removed.");
};
Matrix4.prototype.rotateX = function() {
  console.error("THREE.Matrix4: .rotateX() has been removed.");
};
Matrix4.prototype.rotateY = function() {
  console.error("THREE.Matrix4: .rotateY() has been removed.");
};
Matrix4.prototype.rotateZ = function() {
  console.error("THREE.Matrix4: .rotateZ() has been removed.");
};
Matrix4.prototype.rotateByAxis = function() {
  console.error("THREE.Matrix4: .rotateByAxis() has been removed.");
};
Matrix4.prototype.applyToBufferAttribute = function(attribute) {
  console.warn("THREE.Matrix4: .applyToBufferAttribute() has been removed. Use attribute.applyMatrix4( matrix ) instead.");
  return attribute.applyMatrix4(this);
};
Matrix4.prototype.applyToVector3Array = function() {
  console.error("THREE.Matrix4: .applyToVector3Array() has been removed.");
};
Matrix4.prototype.makeFrustum = function(left, right, bottom, top, near, far) {
  console.warn("THREE.Matrix4: .makeFrustum() has been removed. Use .makePerspective( left, right, top, bottom, near, far ) instead.");
  return this.makePerspective(left, right, top, bottom, near, far);
};
Matrix4.prototype.getInverse = function(matrix) {
  console.warn("THREE.Matrix4: .getInverse() has been removed. Use matrixInv.copy( matrix ).invert(); instead.");
  return this.copy(matrix).invert();
};
Plane.prototype.isIntersectionLine = function(line) {
  console.warn("THREE.Plane: .isIntersectionLine() has been renamed to .intersectsLine().");
  return this.intersectsLine(line);
};
Quaternion.prototype.multiplyVector3 = function(vector) {
  console.warn("THREE.Quaternion: .multiplyVector3() has been removed. Use is now vector.applyQuaternion( quaternion ) instead.");
  return vector.applyQuaternion(this);
};
Quaternion.prototype.inverse = function() {
  console.warn("THREE.Quaternion: .inverse() has been renamed to invert().");
  return this.invert();
};
Ray.prototype.isIntersectionBox = function(box) {
  console.warn("THREE.Ray: .isIntersectionBox() has been renamed to .intersectsBox().");
  return this.intersectsBox(box);
};
Ray.prototype.isIntersectionPlane = function(plane) {
  console.warn("THREE.Ray: .isIntersectionPlane() has been renamed to .intersectsPlane().");
  return this.intersectsPlane(plane);
};
Ray.prototype.isIntersectionSphere = function(sphere) {
  console.warn("THREE.Ray: .isIntersectionSphere() has been renamed to .intersectsSphere().");
  return this.intersectsSphere(sphere);
};
Triangle.prototype.area = function() {
  console.warn("THREE.Triangle: .area() has been renamed to .getArea().");
  return this.getArea();
};
Triangle.prototype.barycoordFromPoint = function(point, target) {
  console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord().");
  return this.getBarycoord(point, target);
};
Triangle.prototype.midpoint = function(target) {
  console.warn("THREE.Triangle: .midpoint() has been renamed to .getMidpoint().");
  return this.getMidpoint(target);
};
Triangle.prototypenormal = function(target) {
  console.warn("THREE.Triangle: .normal() has been renamed to .getNormal().");
  return this.getNormal(target);
};
Triangle.prototype.plane = function(target) {
  console.warn("THREE.Triangle: .plane() has been renamed to .getPlane().");
  return this.getPlane(target);
};
Triangle.barycoordFromPoint = function(point, a, b, c, target) {
  console.warn("THREE.Triangle: .barycoordFromPoint() has been renamed to .getBarycoord().");
  return Triangle.getBarycoord(point, a, b, c, target);
};
Triangle.normal = function(a, b, c, target) {
  console.warn("THREE.Triangle: .normal() has been renamed to .getNormal().");
  return Triangle.getNormal(a, b, c, target);
};
Vector2.prototype.fromAttribute = function(attribute, index2, offset) {
  console.warn("THREE.Vector2: .fromAttribute() has been renamed to .fromBufferAttribute().");
  return this.fromBufferAttribute(attribute, index2, offset);
};
Vector2.prototype.distanceToManhattan = function(v) {
  console.warn("THREE.Vector2: .distanceToManhattan() has been renamed to .manhattanDistanceTo().");
  return this.manhattanDistanceTo(v);
};
Vector2.prototype.lengthManhattan = function() {
  console.warn("THREE.Vector2: .lengthManhattan() has been renamed to .manhattanLength().");
  return this.manhattanLength();
};
Vector3.prototype.setEulerFromRotationMatrix = function() {
  console.error("THREE.Vector3: .setEulerFromRotationMatrix() has been removed. Use Euler.setFromRotationMatrix() instead.");
};
Vector3.prototype.setEulerFromQuaternion = function() {
  console.error("THREE.Vector3: .setEulerFromQuaternion() has been removed. Use Euler.setFromQuaternion() instead.");
};
Vector3.prototype.getPositionFromMatrix = function(m) {
  console.warn("THREE.Vector3: .getPositionFromMatrix() has been renamed to .setFromMatrixPosition().");
  return this.setFromMatrixPosition(m);
};
Vector3.prototype.getScaleFromMatrix = function(m) {
  console.warn("THREE.Vector3: .getScaleFromMatrix() has been renamed to .setFromMatrixScale().");
  return this.setFromMatrixScale(m);
};
Vector3.prototype.getColumnFromMatrix = function(index2, matrix) {
  console.warn("THREE.Vector3: .getColumnFromMatrix() has been renamed to .setFromMatrixColumn().");
  return this.setFromMatrixColumn(matrix, index2);
};
Vector3.prototype.applyProjection = function(m) {
  console.warn("THREE.Vector3: .applyProjection() has been removed. Use .applyMatrix4( m ) instead.");
  return this.applyMatrix4(m);
};
Vector3.prototype.fromAttribute = function(attribute, index2, offset) {
  console.warn("THREE.Vector3: .fromAttribute() has been renamed to .fromBufferAttribute().");
  return this.fromBufferAttribute(attribute, index2, offset);
};
Vector3.prototype.distanceToManhattan = function(v) {
  console.warn("THREE.Vector3: .distanceToManhattan() has been renamed to .manhattanDistanceTo().");
  return this.manhattanDistanceTo(v);
};
Vector3.prototype.lengthManhattan = function() {
  console.warn("THREE.Vector3: .lengthManhattan() has been renamed to .manhattanLength().");
  return this.manhattanLength();
};
Vector4.prototype.fromAttribute = function(attribute, index2, offset) {
  console.warn("THREE.Vector4: .fromAttribute() has been renamed to .fromBufferAttribute().");
  return this.fromBufferAttribute(attribute, index2, offset);
};
Vector4.prototype.lengthManhattan = function() {
  console.warn("THREE.Vector4: .lengthManhattan() has been renamed to .manhattanLength().");
  return this.manhattanLength();
};
Object3D.prototype.getChildByName = function(name) {
  console.warn("THREE.Object3D: .getChildByName() has been renamed to .getObjectByName().");
  return this.getObjectByName(name);
};
Object3D.prototype.renderDepth = function() {
  console.warn("THREE.Object3D: .renderDepth has been removed. Use .renderOrder, instead.");
};
Object3D.prototype.translate = function(distance, axis) {
  console.warn("THREE.Object3D: .translate() has been removed. Use .translateOnAxis( axis, distance ) instead.");
  return this.translateOnAxis(axis, distance);
};
Object3D.prototype.getWorldRotation = function() {
  console.error("THREE.Object3D: .getWorldRotation() has been removed. Use THREE.Object3D.getWorldQuaternion( target ) instead.");
};
Object3D.prototype.applyMatrix = function(matrix) {
  console.warn("THREE.Object3D: .applyMatrix() has been renamed to .applyMatrix4().");
  return this.applyMatrix4(matrix);
};
Object.defineProperties(Object3D.prototype, {
  eulerOrder: {
    get: function() {
      console.warn("THREE.Object3D: .eulerOrder is now .rotation.order.");
      return this.rotation.order;
    },
    set: function(value) {
      console.warn("THREE.Object3D: .eulerOrder is now .rotation.order.");
      this.rotation.order = value;
    }
  },
  useQuaternion: {
    get: function() {
      console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.");
    },
    set: function() {
      console.warn("THREE.Object3D: .useQuaternion has been removed. The library now uses quaternions by default.");
    }
  }
});
Mesh.prototype.setDrawMode = function() {
  console.error("THREE.Mesh: .setDrawMode() has been removed. The renderer now always assumes THREE.TrianglesDrawMode. Transform your geometry via BufferGeometryUtils.toTrianglesDrawMode() if necessary.");
};
Object.defineProperties(Mesh.prototype, {
  drawMode: {
    get: function() {
      console.error("THREE.Mesh: .drawMode has been removed. The renderer now always assumes THREE.TrianglesDrawMode.");
      return TrianglesDrawMode;
    },
    set: function() {
      console.error("THREE.Mesh: .drawMode has been removed. The renderer now always assumes THREE.TrianglesDrawMode. Transform your geometry via BufferGeometryUtils.toTrianglesDrawMode() if necessary.");
    }
  }
});
Object.defineProperties(LOD.prototype, {
  objects: {
    get: function() {
      console.warn("THREE.LOD: .objects has been renamed to .levels.");
      return this.levels;
    }
  }
});
Object.defineProperty(Skeleton.prototype, "useVertexTexture", {
  get: function() {
    console.warn("THREE.Skeleton: useVertexTexture has been removed.");
  },
  set: function() {
    console.warn("THREE.Skeleton: useVertexTexture has been removed.");
  }
});
SkinnedMesh.prototype.initBones = function() {
  console.error("THREE.SkinnedMesh: initBones() has been removed.");
};
Object.defineProperty(Curve.prototype, "__arcLengthDivisions", {
  get: function() {
    console.warn("THREE.Curve: .__arcLengthDivisions is now .arcLengthDivisions.");
    return this.arcLengthDivisions;
  },
  set: function(value) {
    console.warn("THREE.Curve: .__arcLengthDivisions is now .arcLengthDivisions.");
    this.arcLengthDivisions = value;
  }
});
PerspectiveCamera.prototype.setLens = function(focalLength, filmGauge) {
  console.warn("THREE.PerspectiveCamera.setLens is deprecated. Use .setFocalLength and .filmGauge for a photographic setup.");
  if (filmGauge !== void 0)
    this.filmGauge = filmGauge;
  this.setFocalLength(focalLength);
};
Object.defineProperties(Light.prototype, {
  onlyShadow: {
    set: function() {
      console.warn("THREE.Light: .onlyShadow has been removed.");
    }
  },
  shadowCameraFov: {
    set: function(value) {
      console.warn("THREE.Light: .shadowCameraFov is now .shadow.camera.fov.");
      this.shadow.camera.fov = value;
    }
  },
  shadowCameraLeft: {
    set: function(value) {
      console.warn("THREE.Light: .shadowCameraLeft is now .shadow.camera.left.");
      this.shadow.camera.left = value;
    }
  },
  shadowCameraRight: {
    set: function(value) {
      console.warn("THREE.Light: .shadowCameraRight is now .shadow.camera.right.");
      this.shadow.camera.right = value;
    }
  },
  shadowCameraTop: {
    set: function(value) {
      console.warn("THREE.Light: .shadowCameraTop is now .shadow.camera.top.");
      this.shadow.camera.top = value;
    }
  },
  shadowCameraBottom: {
    set: function(value) {
      console.warn("THREE.Light: .shadowCameraBottom is now .shadow.camera.bottom.");
      this.shadow.camera.bottom = value;
    }
  },
  shadowCameraNear: {
    set: function(value) {
      console.warn("THREE.Light: .shadowCameraNear is now .shadow.camera.near.");
      this.shadow.camera.near = value;
    }
  },
  shadowCameraFar: {
    set: function(value) {
      console.warn("THREE.Light: .shadowCameraFar is now .shadow.camera.far.");
      this.shadow.camera.far = value;
    }
  },
  shadowCameraVisible: {
    set: function() {
      console.warn("THREE.Light: .shadowCameraVisible has been removed. Use new THREE.CameraHelper( light.shadow.camera ) instead.");
    }
  },
  shadowBias: {
    set: function(value) {
      console.warn("THREE.Light: .shadowBias is now .shadow.bias.");
      this.shadow.bias = value;
    }
  },
  shadowDarkness: {
    set: function() {
      console.warn("THREE.Light: .shadowDarkness has been removed.");
    }
  },
  shadowMapWidth: {
    set: function(value) {
      console.warn("THREE.Light: .shadowMapWidth is now .shadow.mapSize.width.");
      this.shadow.mapSize.width = value;
    }
  },
  shadowMapHeight: {
    set: function(value) {
      console.warn("THREE.Light: .shadowMapHeight is now .shadow.mapSize.height.");
      this.shadow.mapSize.height = value;
    }
  }
});
Object.defineProperties(BufferAttribute.prototype, {
  length: {
    get: function() {
      console.warn("THREE.BufferAttribute: .length has been deprecated. Use .count instead.");
      return this.array.length;
    }
  },
  dynamic: {
    get: function() {
      console.warn("THREE.BufferAttribute: .dynamic has been deprecated. Use .usage instead.");
      return this.usage === DynamicDrawUsage;
    },
    set: function() {
      console.warn("THREE.BufferAttribute: .dynamic has been deprecated. Use .usage instead.");
      this.setUsage(DynamicDrawUsage);
    }
  }
});
BufferAttribute.prototype.setDynamic = function(value) {
  console.warn("THREE.BufferAttribute: .setDynamic() has been deprecated. Use .setUsage() instead.");
  this.setUsage(value === true ? DynamicDrawUsage : StaticDrawUsage);
  return this;
};
BufferAttribute.prototype.copyIndicesArray = function() {
  console.error("THREE.BufferAttribute: .copyIndicesArray() has been removed.");
}, BufferAttribute.prototype.setArray = function() {
  console.error("THREE.BufferAttribute: .setArray has been removed. Use BufferGeometry .setAttribute to replace/resize attribute buffers");
};
BufferGeometry.prototype.addIndex = function(index2) {
  console.warn("THREE.BufferGeometry: .addIndex() has been renamed to .setIndex().");
  this.setIndex(index2);
};
BufferGeometry.prototype.addAttribute = function(name, attribute) {
  console.warn("THREE.BufferGeometry: .addAttribute() has been renamed to .setAttribute().");
  if (!(attribute && attribute.isBufferAttribute) && !(attribute && attribute.isInterleavedBufferAttribute)) {
    console.warn("THREE.BufferGeometry: .addAttribute() now expects ( name, attribute ).");
    return this.setAttribute(name, new BufferAttribute(arguments[1], arguments[2]));
  }
  if (name === "index") {
    console.warn("THREE.BufferGeometry.addAttribute: Use .setIndex() for index attribute.");
    this.setIndex(attribute);
    return this;
  }
  return this.setAttribute(name, attribute);
};
BufferGeometry.prototype.addDrawCall = function(start, count, indexOffset) {
  if (indexOffset !== void 0) {
    console.warn("THREE.BufferGeometry: .addDrawCall() no longer supports indexOffset.");
  }
  console.warn("THREE.BufferGeometry: .addDrawCall() is now .addGroup().");
  this.addGroup(start, count);
};
BufferGeometry.prototype.clearDrawCalls = function() {
  console.warn("THREE.BufferGeometry: .clearDrawCalls() is now .clearGroups().");
  this.clearGroups();
};
BufferGeometry.prototype.computeOffsets = function() {
  console.warn("THREE.BufferGeometry: .computeOffsets() has been removed.");
};
BufferGeometry.prototype.removeAttribute = function(name) {
  console.warn("THREE.BufferGeometry: .removeAttribute() has been renamed to .deleteAttribute().");
  return this.deleteAttribute(name);
};
BufferGeometry.prototype.applyMatrix = function(matrix) {
  console.warn("THREE.BufferGeometry: .applyMatrix() has been renamed to .applyMatrix4().");
  return this.applyMatrix4(matrix);
};
Object.defineProperties(BufferGeometry.prototype, {
  drawcalls: {
    get: function() {
      console.error("THREE.BufferGeometry: .drawcalls has been renamed to .groups.");
      return this.groups;
    }
  },
  offsets: {
    get: function() {
      console.warn("THREE.BufferGeometry: .offsets has been renamed to .groups.");
      return this.groups;
    }
  }
});
Object.defineProperties(InstancedBufferGeometry.prototype, {
  maxInstancedCount: {
    get: function() {
      console.warn("THREE.InstancedBufferGeometry: .maxInstancedCount has been renamed to .instanceCount.");
      return this.instanceCount;
    },
    set: function(value) {
      console.warn("THREE.InstancedBufferGeometry: .maxInstancedCount has been renamed to .instanceCount.");
      this.instanceCount = value;
    }
  }
});
Object.defineProperties(Raycaster.prototype, {
  linePrecision: {
    get: function() {
      console.warn("THREE.Raycaster: .linePrecision has been deprecated. Use .params.Line.threshold instead.");
      return this.params.Line.threshold;
    },
    set: function(value) {
      console.warn("THREE.Raycaster: .linePrecision has been deprecated. Use .params.Line.threshold instead.");
      this.params.Line.threshold = value;
    }
  }
});
Object.defineProperties(InterleavedBuffer.prototype, {
  dynamic: {
    get: function() {
      console.warn("THREE.InterleavedBuffer: .length has been deprecated. Use .usage instead.");
      return this.usage === DynamicDrawUsage;
    },
    set: function(value) {
      console.warn("THREE.InterleavedBuffer: .length has been deprecated. Use .usage instead.");
      this.setUsage(value);
    }
  }
});
InterleavedBuffer.prototype.setDynamic = function(value) {
  console.warn("THREE.InterleavedBuffer: .setDynamic() has been deprecated. Use .setUsage() instead.");
  this.setUsage(value === true ? DynamicDrawUsage : StaticDrawUsage);
  return this;
};
InterleavedBuffer.prototype.setArray = function() {
  console.error("THREE.InterleavedBuffer: .setArray has been removed. Use BufferGeometry .setAttribute to replace/resize attribute buffers");
};
Scene.prototype.dispose = function() {
  console.error("THREE.Scene: .dispose() has been removed.");
};
Object.defineProperties(Uniform.prototype, {
  dynamic: {
    set: function() {
      console.warn("THREE.Uniform: .dynamic has been removed. Use object.onBeforeRender() instead.");
    }
  },
  onUpdate: {
    value: function() {
      console.warn("THREE.Uniform: .onUpdate() has been removed. Use object.onBeforeRender() instead.");
      return this;
    }
  }
});
Object.defineProperties(Material.prototype, {
  wrapAround: {
    get: function() {
      console.warn("THREE.Material: .wrapAround has been removed.");
    },
    set: function() {
      console.warn("THREE.Material: .wrapAround has been removed.");
    }
  },
  overdraw: {
    get: function() {
      console.warn("THREE.Material: .overdraw has been removed.");
    },
    set: function() {
      console.warn("THREE.Material: .overdraw has been removed.");
    }
  },
  wrapRGB: {
    get: function() {
      console.warn("THREE.Material: .wrapRGB has been removed.");
      return new Color();
    }
  },
  shading: {
    get: function() {
      console.error("THREE." + this.type + ": .shading has been removed. Use the boolean .flatShading instead.");
    },
    set: function(value) {
      console.warn("THREE." + this.type + ": .shading has been removed. Use the boolean .flatShading instead.");
      this.flatShading = value === FlatShading;
    }
  },
  stencilMask: {
    get: function() {
      console.warn("THREE." + this.type + ": .stencilMask has been removed. Use .stencilFuncMask instead.");
      return this.stencilFuncMask;
    },
    set: function(value) {
      console.warn("THREE." + this.type + ": .stencilMask has been removed. Use .stencilFuncMask instead.");
      this.stencilFuncMask = value;
    }
  }
});
Object.defineProperties(MeshPhongMaterial.prototype, {
  metal: {
    get: function() {
      console.warn("THREE.MeshPhongMaterial: .metal has been removed. Use THREE.MeshStandardMaterial instead.");
      return false;
    },
    set: function() {
      console.warn("THREE.MeshPhongMaterial: .metal has been removed. Use THREE.MeshStandardMaterial instead");
    }
  }
});
Object.defineProperties(MeshPhysicalMaterial.prototype, {
  transparency: {
    get: function() {
      console.warn("THREE.MeshPhysicalMaterial: .transparency has been renamed to .transmission.");
      return this.transmission;
    },
    set: function(value) {
      console.warn("THREE.MeshPhysicalMaterial: .transparency has been renamed to .transmission.");
      this.transmission = value;
    }
  }
});
Object.defineProperties(ShaderMaterial.prototype, {
  derivatives: {
    get: function() {
      console.warn("THREE.ShaderMaterial: .derivatives has been moved to .extensions.derivatives.");
      return this.extensions.derivatives;
    },
    set: function(value) {
      console.warn("THREE. ShaderMaterial: .derivatives has been moved to .extensions.derivatives.");
      this.extensions.derivatives = value;
    }
  }
});
WebGLRenderer.prototype.clearTarget = function(renderTarget, color, depth, stencil) {
  console.warn("THREE.WebGLRenderer: .clearTarget() has been deprecated. Use .setRenderTarget() and .clear() instead.");
  this.setRenderTarget(renderTarget);
  this.clear(color, depth, stencil);
};
WebGLRenderer.prototype.animate = function(callback) {
  console.warn("THREE.WebGLRenderer: .animate() is now .setAnimationLoop().");
  this.setAnimationLoop(callback);
};
WebGLRenderer.prototype.getCurrentRenderTarget = function() {
  console.warn("THREE.WebGLRenderer: .getCurrentRenderTarget() is now .getRenderTarget().");
  return this.getRenderTarget();
};
WebGLRenderer.prototype.getMaxAnisotropy = function() {
  console.warn("THREE.WebGLRenderer: .getMaxAnisotropy() is now .capabilities.getMaxAnisotropy().");
  return this.capabilities.getMaxAnisotropy();
};
WebGLRenderer.prototype.getPrecision = function() {
  console.warn("THREE.WebGLRenderer: .getPrecision() is now .capabilities.precision.");
  return this.capabilities.precision;
};
WebGLRenderer.prototype.resetGLState = function() {
  console.warn("THREE.WebGLRenderer: .resetGLState() is now .state.reset().");
  return this.state.reset();
};
WebGLRenderer.prototype.supportsFloatTextures = function() {
  console.warn("THREE.WebGLRenderer: .supportsFloatTextures() is now .extensions.get( 'OES_texture_float' ).");
  return this.extensions.get("OES_texture_float");
};
WebGLRenderer.prototype.supportsHalfFloatTextures = function() {
  console.warn("THREE.WebGLRenderer: .supportsHalfFloatTextures() is now .extensions.get( 'OES_texture_half_float' ).");
  return this.extensions.get("OES_texture_half_float");
};
WebGLRenderer.prototype.supportsStandardDerivatives = function() {
  console.warn("THREE.WebGLRenderer: .supportsStandardDerivatives() is now .extensions.get( 'OES_standard_derivatives' ).");
  return this.extensions.get("OES_standard_derivatives");
};
WebGLRenderer.prototype.supportsCompressedTextureS3TC = function() {
  console.warn("THREE.WebGLRenderer: .supportsCompressedTextureS3TC() is now .extensions.get( 'WEBGL_compressed_texture_s3tc' ).");
  return this.extensions.get("WEBGL_compressed_texture_s3tc");
};
WebGLRenderer.prototype.supportsCompressedTexturePVRTC = function() {
  console.warn("THREE.WebGLRenderer: .supportsCompressedTexturePVRTC() is now .extensions.get( 'WEBGL_compressed_texture_pvrtc' ).");
  return this.extensions.get("WEBGL_compressed_texture_pvrtc");
};
WebGLRenderer.prototype.supportsBlendMinMax = function() {
  console.warn("THREE.WebGLRenderer: .supportsBlendMinMax() is now .extensions.get( 'EXT_blend_minmax' ).");
  return this.extensions.get("EXT_blend_minmax");
};
WebGLRenderer.prototype.supportsVertexTextures = function() {
  console.warn("THREE.WebGLRenderer: .supportsVertexTextures() is now .capabilities.vertexTextures.");
  return this.capabilities.vertexTextures;
};
WebGLRenderer.prototype.supportsInstancedArrays = function() {
  console.warn("THREE.WebGLRenderer: .supportsInstancedArrays() is now .extensions.get( 'ANGLE_instanced_arrays' ).");
  return this.extensions.get("ANGLE_instanced_arrays");
};
WebGLRenderer.prototype.enableScissorTest = function(boolean) {
  console.warn("THREE.WebGLRenderer: .enableScissorTest() is now .setScissorTest().");
  this.setScissorTest(boolean);
};
WebGLRenderer.prototype.initMaterial = function() {
  console.warn("THREE.WebGLRenderer: .initMaterial() has been removed.");
};
WebGLRenderer.prototype.addPrePlugin = function() {
  console.warn("THREE.WebGLRenderer: .addPrePlugin() has been removed.");
};
WebGLRenderer.prototype.addPostPlugin = function() {
  console.warn("THREE.WebGLRenderer: .addPostPlugin() has been removed.");
};
WebGLRenderer.prototype.updateShadowMap = function() {
  console.warn("THREE.WebGLRenderer: .updateShadowMap() has been removed.");
};
WebGLRenderer.prototype.setFaceCulling = function() {
  console.warn("THREE.WebGLRenderer: .setFaceCulling() has been removed.");
};
WebGLRenderer.prototype.allocTextureUnit = function() {
  console.warn("THREE.WebGLRenderer: .allocTextureUnit() has been removed.");
};
WebGLRenderer.prototype.setTexture = function() {
  console.warn("THREE.WebGLRenderer: .setTexture() has been removed.");
};
WebGLRenderer.prototype.setTexture2D = function() {
  console.warn("THREE.WebGLRenderer: .setTexture2D() has been removed.");
};
WebGLRenderer.prototype.setTextureCube = function() {
  console.warn("THREE.WebGLRenderer: .setTextureCube() has been removed.");
};
WebGLRenderer.prototype.getActiveMipMapLevel = function() {
  console.warn("THREE.WebGLRenderer: .getActiveMipMapLevel() is now .getActiveMipmapLevel().");
  return this.getActiveMipmapLevel();
};
Object.defineProperties(WebGLRenderer.prototype, {
  shadowMapEnabled: {
    get: function() {
      return this.shadowMap.enabled;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderer: .shadowMapEnabled is now .shadowMap.enabled.");
      this.shadowMap.enabled = value;
    }
  },
  shadowMapType: {
    get: function() {
      return this.shadowMap.type;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderer: .shadowMapType is now .shadowMap.type.");
      this.shadowMap.type = value;
    }
  },
  shadowMapCullFace: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.");
      return void 0;
    },
    set: function() {
      console.warn("THREE.WebGLRenderer: .shadowMapCullFace has been removed. Set Material.shadowSide instead.");
    }
  },
  context: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .context has been removed. Use .getContext() instead.");
      return this.getContext();
    }
  },
  vr: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .vr has been renamed to .xr");
      return this.xr;
    }
  },
  gammaInput: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .gammaInput has been removed. Set the encoding for textures via Texture.encoding instead.");
      return false;
    },
    set: function() {
      console.warn("THREE.WebGLRenderer: .gammaInput has been removed. Set the encoding for textures via Texture.encoding instead.");
    }
  },
  gammaOutput: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .gammaOutput has been removed. Set WebGLRenderer.outputEncoding instead.");
      return false;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderer: .gammaOutput has been removed. Set WebGLRenderer.outputEncoding instead.");
      this.outputEncoding = value === true ? sRGBEncoding : LinearEncoding;
    }
  },
  toneMappingWhitePoint: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .toneMappingWhitePoint has been removed.");
      return 1;
    },
    set: function() {
      console.warn("THREE.WebGLRenderer: .toneMappingWhitePoint has been removed.");
    }
  }
});
Object.defineProperties(WebGLShadowMap.prototype, {
  cullFace: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.");
      return void 0;
    },
    set: function() {
      console.warn("THREE.WebGLRenderer: .shadowMap.cullFace has been removed. Set Material.shadowSide instead.");
    }
  },
  renderReverseSided: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.");
      return void 0;
    },
    set: function() {
      console.warn("THREE.WebGLRenderer: .shadowMap.renderReverseSided has been removed. Set Material.shadowSide instead.");
    }
  },
  renderSingleSided: {
    get: function() {
      console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.");
      return void 0;
    },
    set: function() {
      console.warn("THREE.WebGLRenderer: .shadowMap.renderSingleSided has been removed. Set Material.shadowSide instead.");
    }
  }
});
Object.defineProperties(WebGLRenderTarget.prototype, {
  wrapS: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS.");
      return this.texture.wrapS;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .wrapS is now .texture.wrapS.");
      this.texture.wrapS = value;
    }
  },
  wrapT: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT.");
      return this.texture.wrapT;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .wrapT is now .texture.wrapT.");
      this.texture.wrapT = value;
    }
  },
  magFilter: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter.");
      return this.texture.magFilter;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .magFilter is now .texture.magFilter.");
      this.texture.magFilter = value;
    }
  },
  minFilter: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter.");
      return this.texture.minFilter;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .minFilter is now .texture.minFilter.");
      this.texture.minFilter = value;
    }
  },
  anisotropy: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy.");
      return this.texture.anisotropy;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .anisotropy is now .texture.anisotropy.");
      this.texture.anisotropy = value;
    }
  },
  offset: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset.");
      return this.texture.offset;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .offset is now .texture.offset.");
      this.texture.offset = value;
    }
  },
  repeat: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat.");
      return this.texture.repeat;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .repeat is now .texture.repeat.");
      this.texture.repeat = value;
    }
  },
  format: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .format is now .texture.format.");
      return this.texture.format;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .format is now .texture.format.");
      this.texture.format = value;
    }
  },
  type: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .type is now .texture.type.");
      return this.texture.type;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .type is now .texture.type.");
      this.texture.type = value;
    }
  },
  generateMipmaps: {
    get: function() {
      console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps.");
      return this.texture.generateMipmaps;
    },
    set: function(value) {
      console.warn("THREE.WebGLRenderTarget: .generateMipmaps is now .texture.generateMipmaps.");
      this.texture.generateMipmaps = value;
    }
  }
});
Object.defineProperties(Audio.prototype, {
  load: {
    value: function(file) {
      console.warn("THREE.Audio: .load has been deprecated. Use THREE.AudioLoader instead.");
      const scope = this;
      const audioLoader = new AudioLoader();
      audioLoader.load(file, function(buffer) {
        scope.setBuffer(buffer);
      });
      return this;
    }
  },
  startTime: {
    set: function() {
      console.warn("THREE.Audio: .startTime is now .play( delay ).");
    }
  }
});
CubeCamera.prototype.updateCubeMap = function(renderer, scene) {
  console.warn("THREE.CubeCamera: .updateCubeMap() is now .update().");
  return this.update(renderer, scene);
};
CubeCamera.prototype.clear = function(renderer, color, depth, stencil) {
  console.warn("THREE.CubeCamera: .clear() is now .renderTarget.clear().");
  return this.renderTarget.clear(renderer, color, depth, stencil);
};
ImageUtils.crossOrigin = void 0;
ImageUtils.loadTexture = function(url, mapping, onLoad, onError) {
  console.warn("THREE.ImageUtils.loadTexture has been deprecated. Use THREE.TextureLoader() instead.");
  const loader = new TextureLoader();
  loader.setCrossOrigin(this.crossOrigin);
  const texture = loader.load(url, onLoad, void 0, onError);
  if (mapping)
    texture.mapping = mapping;
  return texture;
};
ImageUtils.loadTextureCube = function(urls, mapping, onLoad, onError) {
  console.warn("THREE.ImageUtils.loadTextureCube has been deprecated. Use THREE.CubeTextureLoader() instead.");
  const loader = new CubeTextureLoader();
  loader.setCrossOrigin(this.crossOrigin);
  const texture = loader.load(urls, onLoad, void 0, onError);
  if (mapping)
    texture.mapping = mapping;
  return texture;
};
ImageUtils.loadCompressedTexture = function() {
  console.error("THREE.ImageUtils.loadCompressedTexture has been removed. Use THREE.DDSLoader instead.");
};
ImageUtils.loadCompressedTextureCube = function() {
  console.error("THREE.ImageUtils.loadCompressedTextureCube has been removed. Use THREE.DDSLoader instead.");
};
if (typeof __THREE_DEVTOOLS__ !== "undefined") {
  __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", {detail: {
    revision: REVISION
  }}));
}
if (typeof window !== "undefined") {
  if (window.__THREE__) {
    console.warn("WARNING: Multiple instances of Three.js being imported.");
  } else {
    window.__THREE__ = REVISION;
  }
}
const lerp = (a, b, n) => (1 - n) * a + n * b;
class Scroll {
  constructor() {
    this.DOM = {main: document.querySelector("main")};
    this.DOM.scrollable = this.DOM.main.querySelector("div[data-scroll]");
    this.docScroll = 0;
    this.scrollToRender = 0;
    this.current = 0;
    this.ease = 0.1;
    this.speed = 0;
    this.speedTarget = 0;
    this.setSize();
    this.getScroll();
    this.init();
    this.style();
    this.initEvents();
    requestAnimationFrame(() => this.render());
  }
  init() {
    for (const key in this.renderedStyles) {
      this.current = this.scrollToRender = this.getScroll();
    }
    this.setPosition();
    this.shouldRender = true;
  }
  style() {
    this.DOM.main.style.position = "fixed";
    this.DOM.main.style.width = this.DOM.main.style.height = "100%";
    this.DOM.main.style.top = this.DOM.main.style.left = 0;
    this.DOM.main.style.overflow = "hidden";
  }
  getScroll() {
    this.docScroll = window.pageYOffset || document.documentElement.scrollTop;
    return this.docScroll;
  }
  initEvents() {
    window.onbeforeunload = function() {
      window.scrollTo(0, 0);
    };
    window.addEventListener("resize", () => this.setSize());
    window.addEventListener("scroll", this.getScroll.bind(this));
  }
  setSize() {
    document.body.style.height = `${this.DOM.scrollable.scrollHeight}px`;
  }
  setPosition() {
    if (Math.round(this.scrollToRender) !== Math.round(this.current) || this.scrollToRender < 10) {
      this.DOM.scrollable.style.transform = `translate3d(0,${-1 * this.scrollToRender}px,0)`;
    }
  }
  render() {
    this.speed = Math.min(Math.abs(this.current - this.scrollToRender), 200) / 200;
    this.speedTarget += (this.speed - this.speedTarget) * 0.2;
    this.current = this.getScroll();
    this.scrollToRender = lerp(this.scrollToRender, this.current, this.ease);
    this.setPosition();
  }
}
const fragment = `
    uniform float time;
    varying float vNoise;
    varying vec2 vUv;
    uniform sampler2D shrineTexture;

    void main()	{
        vec3 colour1 = vec3(1.,0.,0.);
        vec3 colour2 = vec3(1.,1.,1.);
        vec3 finalColour = mix(colour1,colour2,0.5*(vNoise + 1.));

        vec2 newUV = vUv;

        newUV = vec2(newUV.x, newUV.y + 0.01*sin(newUV.x*10. + time));

        vec4 shrineView = texture2D(shrineTexture, newUV);

        // gl_FragColor = vec4(finalColour,1.);
        gl_FragColor = vec4(vUv,0.,1.);
        // gl_FragColor = vec4(vNoise);
        // gl_FragColor = shrineView + 0.5*vec4(vNoise);
    }
`;
const vertex = `
    //	Classic Perlin 3D Noise
    //	by Stefan Gustavson
    //
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

    float cnoise(vec3 P){
    vec3 Pi0 = floor(P); // Integer part for indexing
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
    }

    uniform float time;
    varying float vNoise;
    varying vec2 vUv;

    void main() {
        float PI = 3.1415925;
        vec3 newposition = position;

        // newposition.z += 0.1*sin((newposition.x + 0.25)*2.*PI);

        float noise = cnoise(10.*vec3(position.x,position.y,position.z + time/10.));

        // Center
        // float dist = distance(uv,vec2(0.5));

        // To center
        // newposition.z += 0.1*sin(dist * 40.);

        // From center
        // newposition.z += 0.1*sin(dist * 20. + time);

        newposition += 0.08*normal*noise;

        vNoise = noise;
        vUv = uv;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( newposition, 1.0 );
    }
`;
const cameraPos = 600;
class Sketch {
  constructor(options) {
    this.container = options.dom;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(70, this.width / this.height, 100, 2e3);
    this.camera.position.z = cameraPos;
    this.camera.fov = 2 * Math.atan(this.height / 2 / cameraPos) * (180 / Math.PI);
    this.renderer = new WebGLRenderer({antialias: true, alpha: true});
    this.renderer.setSize(this.width, this.height);
    this.container.appendChild(this.renderer.domElement);
    this.images = [...document.querySelectorAll("a.post img")];
    this.currentScroll = 0;
    this.scroll = new Scroll();
    this.addImages();
    this.setPosition();
    this.resize();
    this.setupResize();
    this.render();
  }
  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }
  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }
  addImages() {
    this.imageStore = this.images.map((img) => {
      let bounds = img.getBoundingClientRect();
      let geometry = new PlaneGeometry(bounds.width, bounds.height, 1, 1);
      let texture = new Texture(img);
      texture.needsUpdate = true;
      let material = new MeshBasicMaterial({
        map: texture
      });
      let mesh = new Mesh(geometry, material);
      this.scene.add(mesh);
      return {
        img,
        mesh,
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height
      };
    });
  }
  setPosition() {
    this.imageStore.forEach((o) => {
      o.mesh.position.y = this.currentScroll - o.top + this.height / 2 - o.height / 2;
      o.mesh.position.x = o.left - this.width / 2 + o.width / 2;
    });
  }
  addObjects() {
    this.geometry = new PlaneGeometry(100, 100, 10, 10);
    this.material = new MeshNormalMaterial();
    this.material = new ShaderMaterial({
      uniforms: {
        time: {value: 0}
      },
      side: DoubleSide,
      fragmentShader: fragment,
      vertexShader: vertex,
      wireframe: true
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }
  render() {
    this.scroll.render();
    this.currentScroll = this.scroll.scrollToRender;
    this.setPosition();
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.render.bind(this));
  }
}
var $layout_svelte = ".svelte-1yd48fc{box-sizing:border-box}body{margin:0;padding:0}:root{font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,\n			'Open Sans', 'Helvetica Neue', sans-serif}h1{color:#ff3e00;text-transform:uppercase;font-size:4rem;font-weight:100;line-height:1.1}p{margin:2rem auto;line-height:1.35}.container.svelte-1yd48fc{position:fixed;width:100vw;height:100vh;left:0;top:0;z-index:-1}";
const css = {
  code: ".svelte-1yd48fc{box-sizing:border-box}body{margin:0;padding:0}:root{font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,\n			'Open Sans', 'Helvetica Neue', sans-serif}h1{color:#ff3e00;text-transform:uppercase;font-size:4rem;font-weight:100;line-height:1.1}p{margin:2rem auto;line-height:1.35}.container.svelte-1yd48fc{position:fixed;width:100vw;height:100vh;left:0;top:0;z-index:-1}",
  map: `{"version":3,"file":"$layout.svelte","sources":["$layout.svelte"],"sourcesContent":["<script>\\n    import Nav from '$lib/Nav.svelte';\\n    import Footer from '$lib/Footer.svelte';\\n\\timport Animation from '$lib/animations.js';\\n\\timport { onMount } from 'svelte';\\n\\n\\n\\tonMount(() => {\\n\\t\\tconst ThreeJs = new Animation({\\n\\t\\t\\tdom: document.querySelector('.container')\\n\\t\\t});\\n\\t})\\n\\n</script>\\n<main>\\n\\t<div data-scroll>\\n\\t\\t<Nav/>\\n\\t\\t\\t<slot></slot>\\n\\t\\t<Footer/>\\n\\t</div>\\n</main>\\n<div class=\\"container\\"></div>\\n<style>\\n\\n    * {\\n        box-sizing: border-box;\\n    }\\n    :global(body) {\\n        margin: 0;\\n        padding: 0;\\n\\n    }\\n\\n    :root {\\n\\t\\tfont-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,\\n\\t\\t\\t'Open Sans', 'Helvetica Neue', sans-serif;\\n\\t}\\n\\n\\n\\n\\t:global(h1) {\\n\\t\\tcolor: #ff3e00;\\n\\t\\ttext-transform: uppercase;\\n\\t\\tfont-size: 4rem;\\n\\t\\tfont-weight: 100;\\n\\t\\tline-height: 1.1;\\n\\t}\\n\\n\\t:global(p) {\\n\\t\\tmargin: 2rem auto;\\n\\t\\tline-height: 1.35;\\n\\t}\\n\\n\\t.container {\\n\\t\\tposition: fixed;\\n\\t\\twidth: 100vw;\\n\\t\\theight: 100vh;\\n\\t\\tleft: 0;\\n\\t\\ttop: 0;\\n\\t\\tz-index: -1;\\n\\n\\t}\\n\\n</style>"],"names":[],"mappings":"AAwBI,eAAE,CAAC,AACC,UAAU,CAAE,UAAU,AAC1B,CAAC,AACO,IAAI,AAAE,CAAC,AACX,MAAM,CAAE,CAAC,CACT,OAAO,CAAE,CAAC,AAEd,CAAC,AAED,KAAK,AAAC,CAAC,AACT,WAAW,CAAE,aAAa,CAAC,CAAC,kBAAkB,CAAC,CAAC,UAAU,CAAC,CAAC,MAAM,CAAC,CAAC,MAAM,CAAC,CAAC,MAAM,CAAC,CAAC,SAAS,CAAC;GAC7F,WAAW,CAAC,CAAC,gBAAgB,CAAC,CAAC,UAAU,AAC3C,CAAC,AAIO,EAAE,AAAE,CAAC,AACZ,KAAK,CAAE,OAAO,CACd,cAAc,CAAE,SAAS,CACzB,SAAS,CAAE,IAAI,CACf,WAAW,CAAE,GAAG,CAChB,WAAW,CAAE,GAAG,AACjB,CAAC,AAEO,CAAC,AAAE,CAAC,AACX,MAAM,CAAE,IAAI,CAAC,IAAI,CACjB,WAAW,CAAE,IAAI,AAClB,CAAC,AAED,UAAU,eAAC,CAAC,AACX,QAAQ,CAAE,KAAK,CACf,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,IAAI,CAAE,CAAC,CACP,GAAG,CAAE,CAAC,CACN,OAAO,CAAE,EAAE,AAEZ,CAAC"}`
};
const $layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  onMount(() => {
    new Sketch({
      dom: document.querySelector(".container")
    });
  });
  $$result.css.add(css);
  return `<main class="${"svelte-1yd48fc"}"><div data-scroll class="${"svelte-1yd48fc"}">${validate_component(Nav, "Nav").$$render($$result, {}, {}, {})}
			${slots.default ? slots.default({}) : ``}
		${validate_component(Footer, "Footer").$$render($$result, {}, {}, {})}</div></main>
<div class="${"container svelte-1yd48fc"}"></div>`;
});
var $layout$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: $layout
});
var posts = {
  "first-post": {
    title: "First post!",
    body: "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin tincidunt arcu elit, sit amet efficitur dolor bibendum quis. Ut et risus urna. Fusce eget luctus tellus. In hac habitasse platea dictumst. Sed vestibulum mauris a turpis lacinia, in elementum lectus cursus. Nulla eleifend ligula eros, id interdum ligula tincidunt ut. Curabitur ac rutrum dolor, vel commodo elit.</p>"
  },
  "second-post": {
    title: "Second post!",
    body: "<p>Vestibulum ipsum dolor, dignissim ut sapien a, sollicitudin consequat dui. Pellentesque libero quam, euismod ac nunc nec, commodo facilisis leo. Ut pretium, metus et commodo tincidunt, urna magna scelerisque est, rhoncus dapibus velit sem id quam. Ut sed felis felis. Phasellus justo ipsum, interdum vel erat sed, rhoncus eleifend nunc. Phasellus nulla libero, interdum ac ultricies vitae, maximus nec risus. Cras hendrerit sed lectus id ullamcorper.</p>"
  },
  "third-post": {
    title: "Third post!",
    body: "<p>Fusce vitae tincidunt libero. Pellentesque nec efficitur velit. Nunc sit amet efficitur tellus. Etiam velit dui, commodo volutpat condimentum non, venenatis consequat neque. Phasellus lacinia quis felis eu tristique. Sed et tellus mi. Aliquam congue ex vitae elit fermentum, sed elementum lectus euismod. Nam vel rhoncus dui. Nunc vulputate maximus est vitae sodales. Aenean rhoncus at nisl efficitur ultricies. Donec id lectus et leo dignissim mattis. Cras nisi quam, mattis sed felis in, tempor ullamcorper felis.</p>"
  }
};
function get$1() {
  return {
    body: Object.keys(posts).map((slug) => ({
      slug,
      ...posts[slug]
    }))
  };
}
var index_json = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  get: get$1
});
function get({params}) {
  if (params.slug in posts) {
    return {
      body: posts[params.slug]
    };
  }
  return {
    status: 404
  };
}
var _slug__json = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  get
});
export {init, render};
