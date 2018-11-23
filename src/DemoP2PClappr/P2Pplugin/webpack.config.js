const webpack = require('webpack')
const path = require('path')

/*
 * SplitChunksPlugin is enabled by default and replaced
 * deprecated CommonsChunkPlugin. It automatically identifies modules which
 * should be splitted of chunk by heuristics using module duplication count and
 * module category (i. e. node_modules). And splits the chunks…
 *
 * It is safe to remove "splitChunks" from the generated configuration
 * and was added as an educational example.
 *
 * https://webpack.js.org/plugins/split-chunks-plugin/
 *
 */

/*
 * We've enabled UglifyJSPlugin for you! This minifies your app
 * in order to load faster and run less javascript.
 *
 * https://github.com/webpack-contrib/uglifyjs-webpack-plugin
 *
 */

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  module: {
    rules: []
  },

  entry: './index.js',

  output: {
    filename: 'p2p_plugin.js',
    path: path.resolve(__dirname, '../dist'),
    library:"P2PPlugin",
    libraryTarget:"umd"
  },

  node:{
    fs:"empty", child_process: 'empty'
  },

  mode: 'production',
  plugins: [new UglifyJSPlugin(), new webpack.LoaderOptionsPlugin({debug:true})],

  optimization: {
    splitChunks: {
      cacheGroups: {
        vendors: {
          priority: -10,
          test: /[\\/]node_modules[\\/]/
        }
      },

      chunks: 'async',
      minChunks: 1,
      minSize: 30000,
      name: true
    }
  }
}