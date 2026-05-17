import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: {
    index: "src/index.ts",
    lefunExtractor: "src/lefunExtractor.ts",
  },
  output: [
    {
      dir: "dist",
      entryFileNames: "esm/[name].js",
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [
    commonjs(),
    nodeResolve(),
    typescript({ declarationDir: "./dist/types", outDir: "./dist" }),
  ],
  external: [/node_modules/],
};
