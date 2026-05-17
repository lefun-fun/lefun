import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: [
    {
      dir: "dist",
      entryFileNames: "esm/[name].js",
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [typescript({ declarationDir: "./dist/types", outDir: "./dist" })],
};
