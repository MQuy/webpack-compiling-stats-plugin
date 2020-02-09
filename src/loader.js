const path = require("path");
const { getOptions } = require("loader-utils");
const { loaderPathOptionName, loaderStats } = require("./constants");
const { performance } = require("perf_hooks");

function forwardLoader(...args) {
  const options = getOptions(this);
  const loaderPath = options[loaderPathOptionName];
  const loader = require(loaderPath);
  return measureLoader(this, loader, args, loaderPath);
}

function forwardPitch(remainingRequest, precedingRequest, data) {
  const options = getOptions(this);
  const loaderPath = options[loaderPathOptionName];
  const { pitch } = require(loaderPath);
  return measureLoader(this, pitch, [remainingRequest, precedingRequest, data], loaderPath);
}

function measureLoader(context, loader, loaderArgs, loaderPath) {
  if (typeof loader !== "function") {
    return;
  }

  const loaderName = getLoaderName(convertToUnixPath(loaderPath));
  let tracedTime;

  const callback = context.callback;
  context.callback = function(...args) {
    tracedTime = updateStatLoaderTime(loaderStats.get(loaderName), tracedTime, true);
    return callback.apply(this, args);
  };

  const asyncCallback = context.async;
  context.async = () => {
    const innerCallback = asyncCallback();
    const fakeCallback = function(...args) {
      tracedTime = updateStatLoaderTime(loaderStats.get(loaderName), tracedTime, true);
      return innerCallback.apply(this, args);
    };
    return fakeCallback;
  };

  tracedTime = performance.now();
  if (!loaderStats.get(loaderName)) {
    loaderStats.set(loaderName, {
      startedTime: tracedTime,
      endedTime: tracedTime,
      totalTime: 0,
      modules: 0,
    });
  }

  const result = loader.apply(context, loaderArgs);
  tracedTime = updateStatLoaderTime(loaderStats.get(loaderName), tracedTime, result != null);
  return result;
}

function updateStatLoaderTime(statLoader, tracedTime, lastStep) {
  const now = performance.now();

  statLoader.totalTime += now - tracedTime;

  if (lastStep) {
    statLoader.modules += 1;
  }

  if (statLoader.endedTime < now) {
    statLoader.endedTime = now;
  }

  return now;
}

function getLoaderName(loaderPath) {
  const nodeModuleIndex = loaderPath.lastIndexOf("node_modules");
  if (nodeModuleIndex !== -1) {
    for (var i = nodeModuleIndex + 13; i < loaderPath.length; ++i) {
      if (loaderPath[i] === "/") {
        return loaderPath.substring(nodeModuleIndex + 13, i);
      }
    }
  } else {
    return path.basename(loaderPath);
  }
}

function convertToUnixPath(path) {
  return path.replace(/\\+/g, "/");
}
module.exports = forwardLoader;
module.exports.pitch = forwardPitch;
