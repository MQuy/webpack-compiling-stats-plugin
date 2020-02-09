const path = require("path");
const { performance } = require("perf_hooks");
const prettyms = require("pretty-ms");
const chalk = require("chalk");
const { loaderPathOptionName, loaderStats, pluginStats, hookCache } = require("./constants");

function normalizeRule(rule) {
  if (typeof rule === "string") {
    return {
      loader: rule,
      options: {}
    };
  } else {
    return { ...rule, options: { ...rule.options } };
  }
}

function injectMetaRule(rule) {
  Object.defineProperty(rule.options, loaderPathOptionName, {
    enumerable: false,
    value: require.resolve(rule.loader)
  });
  rule.loader = path.resolve(__dirname, "./loader");
  return rule;
}

class WebpackBuildStats {
  static compilerCompilationNames = [
    "thisCompilation",
    "compilation",
    "make",
    "afterCompile",
    "shouldEmit",
    "emit",
    "afterEmit"
  ];
  static nativedWebpackPlugins = [
    "NodeEnvironmentPlugin",
    "JsonpTemplatePlugin",
    "FetchCompileWasmTemplatePlugin",
    "FunctionModulePlugin",
    "NodeSourcePlugin",
    "LoaderTargetPlugin",
    "JavascriptModulesPlugin",
    "JsonModulesPlugin",
    "WebAssemblyModulesPlugin",
    "EntryOptionPlugin",
    "CompatibilityPlugin",
    "HarmonyModulesPlugin",
    "AMDPlugin",
    "RequireJsStuffPlugin",
    "CommonJsPlugin",
    "LoaderPlugin",
    "NodeStuffPlugin",
    "CommonJsStuffPlugin",
    "APIPlugin",
    "ConstPlugin",
    "UseStrictPlugin",
    "RequireIncludePlugin",
    "RequireEnsurePlugin",
    "RequireContextPlugin",
    "ImportPlugin",
    "SystemPlugin",
    "EnsureChunkConditionsPlugin",
    "TemplatedPathPlugin",
    "SingleEntryPlugin",
    "MultiEntryPlugin",
    "FlagDependencyExportsPlugin",
    "FlagDependencyUsagePlugin"
  ];

  constructor(options = {}) {
    this.options = {
      ignoredPlugins: WebpackBuildStats.ignoredPluginNames,
      threadhold: 0,
      log: logStats,
      ...options
    };
  }

  apply(compiler) {
    compiler.options.module.rules.forEach((rule, index, rules) => {
      if ("use" in rule) {
        let skipRules = false;
        rule.use.forEach((ul, iul, uls) => {
          if (!skipRules) {
            uls[iul] = injectMetaRule(normalizeRule(ul));
          }
          if (ul && (ul === "thread-loader" || ul.loader === "thread-loader")) {
            skipRules = true;
          }
        });
      } else if ("loader" in rule) {
        rules[index] = injectMetaRule(normalizeRule(rule));
      }
    });

    for (let compilerHookName in compiler.hooks) {
      compiler.hooks[compilerHookName].intercept({
        register: tagInfo =>
          registerCompilerHook.call(
            null,
            tagInfo,
            compilerHookName,
            WebpackBuildStats.nativedWebpackPlugins,
            WebpackBuildStats.compilerCompilationNames.includes(compilerHookName)
          )
      });
    }

    compiler.hooks.done.tap("WebpackBuildStats", () => {
      logStats(loaderStats, pluginStats, this.options.threadhold);
    });
  }
}

function logStats(loaderStats, pluginStats, threadhold) {
  console.log("\n~~~~~~~~ Webpack Compiling Stats ~~~~~~~~");
  logLoaderStats(loaderStats, threadhold);
  logPluginStats(pluginStats, threadhold);
  console.log("\n");
}

function logLoaderStats(loaderStats, threadhold) {
  console.log(chalk.cyan("\n⏱️  Loaders"));
  for (let [loaderName, loaderStat] of loaderStats) {
    if (loaderStat.totalTime >= threadhold) {
      console.log(
        `${loaderName}, from ${formatDate(loaderStat.startedTime)} to ${formatDate(loaderStat.endedTime)}, ${formatTime(
          loaderStat.totalTime
        )} / ${loaderStat.modules} (total/modules)`
      );
    }
  }
}

function logPluginStats(pluginStats, threadhold) {
  console.log(chalk.cyan("\n⏱️  Plugins"));
  for (let [pluginName, pluginStat] of pluginStats) {
    let time = 0;
    for (let pluginHook in pluginStat) {
      time += pluginStat[pluginHook];
    }
    if (time >= threadhold) {
      console.log(pluginName, formatTime(time));
    }
  }
}

function formatDate(ms) {
  const date = new Date(ms + performance.timeOrigin);
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

function formatTime(ms) {
  const format = ms > 60_000 ? chalk.red : ms > 10_000 ? chalk.yellow : chalk.green;
  return format(prettyms(ms));
}

function regsiterCompilationHook(ignoredPluginNames, compilation) {
  if (!hookCache.has(compilation)) {
    hookCache.set(compilation, true);
    for (let property in compilation.hooks) {
      compilation.hooks[property].intercept({
        register: tapInfo => {
          if (!ignoredPluginNames.includes(tapInfo.name) && !hookCache.has(tapInfo)) {
            hookCache.set(tapInfo, true);
            traceHook(tapInfo, property);
          }
          return tapInfo;
        }
      });
    }
  }
}

function registerCompilerHook(compilerTapInfo, hookName, ignoredPluginNames, isCompilation) {
  if (!ignoredPluginNames.includes(compilerTapInfo.name) && !hookCache.has(compilerTapInfo)) {
    hookCache.set(compilerTapInfo, true);
    traceHook(compilerTapInfo, hookName, ignoredPluginNames, isCompilation ? regsiterCompilationHook : undefined);
  }
  return compilerTapInfo;
}

function traceHook(tapInfo, hookName, ignoredPluginNames, action) {
  if (!pluginStats.has(tapInfo.name)) {
    pluginStats.set(tapInfo.name, {});
  }
  const pluginStat = pluginStats.get(tapInfo.name);
  if (!pluginStat[hookName]) {
    pluginStat[hookName] = 0;
  }

  const originalTapInfoFn = tapInfo.fn;
  tapInfo.fn = function(...args) {
    action && action(ignoredPluginNames, ...args);
    if (tapInfo.type === "sync") {
      const tracedTime = performance.now();
      const result = originalTapInfoFn.apply(this, args);
      pluginStat[hookName] += performance.now() - tracedTime;
      return result;
    } else if (tapInfo.type === "async") {
      const originalCallback = args[args.length - 1];
      args[args.length - 1] = function() {
        pluginStat[hookName] += performance.now() - tracedTime;
        originalCallback.apply(this, arguments);
      };
      const tracedTime = performance.now();
      return originalTapInfoFn.apply(this, args);
    } else if (tapInfo.type === "promise") {
      const tracedTime = performance.now();
      return originalTapInfoFn.apply(this, args).then(() => {
        pluginStat[hookName] += performance.now() - tracedTime;
      });
    } else {
      throw new Error(`${tagInfo.name}'s ${tapInfo.type} is not supported`);
    }
  };
}

module.exports = WebpackBuildStats;
