import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    postcss({ extract: true }),
  ],
  external: [
    /node_modules/,
    "@lefun/core",
    "@lefun/ui",
    "@lefun/game",
    "react",
    "react-dom",
    "@lefun/dev-server/index.css",
  ],
};
