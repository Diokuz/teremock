import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'

export default {
  input: 'src/index.ts',
  output: {
    file: 'index.js',
    format: 'cjs'
  },
  plugins: [typescript(), commonjs(), nodeResolve(), json()]
};
