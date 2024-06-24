import { babel } from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import postcss from "rollup-plugin-postcss";
import typescript from "rollup-plugin-typescript2";

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
    typescript({
      exclude: ["lingui.config.ts", "src/main.tsx"],
    }),
    babel({
      babelHelpers: "bundled",
      extensions: [".tsx", ".ts"],
    }),
    // FIXME .po files are being bundled!
    // and `rollup-plugin-copy` is being very annoying.
    // A solution would be to have the po and js files separate...
    copy({
      targets: [{ src: ["src/locales/*"], dest: "dist/locales" }],
    }),
    postcss({ extract: true }),
  ],
  external: [
    //
    "@lingui/react",
    //
    "react",
    "react/jsx-runtime",
    "react-dom",
    //
    "@lefun/core",
    "@lefun/game",
    "@lefun/ui",
  ],
};
