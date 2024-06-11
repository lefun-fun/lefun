import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

export default {
  input: {
    index: "src/index.tsx",
    lefunExtractor: "src/lefunExtractor.ts",
  },
  output: [
    {
      dir: "dist/esm",
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [
    commonjs(),
    nodeResolve(),
    typescript({ useTsconfigDeclarationDir: true }),
  ],
  external: [/node_modules/],
};
