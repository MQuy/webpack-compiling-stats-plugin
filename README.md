## Webpack Compiling Stats Plugin

Webpack plugin to output compiling stats

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]
[![licenses][licenses]][licenses-url]

### Installation

Via npm:

```bash
$ npm install webpack-compiling-stats-plugin --save-dev
```

Via yarn:

```bash
$ yarn add -D webpack-compiling-stats-plugin
```

### Usage

```js
const CompilingStatsPlugin = require('webpack-compiling-stats-plugin');

const webpackConfig = {
  ...
  plugins: [
    new CompilingStatsPlugin()
  ]
}
```

### Configuration

```js
new CompilingStatsPlugin(options);
```

#### ignoredPlugins (default: `[native webpack plugins]`)

List of webpack plugins are ignored when analyzing/logging

#### threadhold (default: `0`)

The minimum time is accepted when logging

#### log

The function logs stats

[npm]: https://img.shields.io/npm/v/webpack-compiling-stats-plugin.svg
[npm-url]: https://npmjs.com/package/webpack-compiling-stats-plugin
[node]: https://img.shields.io/node/v/webpack-compiling-stats-plugin.svg
[node-url]: https://nodejs.org
[deps]: https://img.shields.io/david/MQuy/webpack-compiling-stats-plugin.svg
[deps-url]: https://david-dm.org/MQuy/webpack-compiling-stats-plugin
[licenses]: https://img.shields.io/github/license/MQuy/webpack-compiling-stats-plugin.svg
[licenses-url]: https://github.com/MQuy/webpack-compiling-stats-plugin/blob/master/LICENSE
