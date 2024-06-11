import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "rollup-plugin-typescript2";

export default {
  input: "src/index.tsx",
  output: [
    {
      file: "dist/esm/index.js",
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [
    commonjs(),
    nodeResolve(),
    typescript({ useTsconfigDeclarationDir: true }),
  ],
  external: [/node_modules/, "@lefun/ui"],
};
