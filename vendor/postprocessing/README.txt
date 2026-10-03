postprocessing 6.39.5 (pmndrs, Zlib licence), tree-shaken ESM bundle.
Rebuild:
  npm pack postprocessing@6.39.5 && tar -xzf postprocessing-6.39.5.tgz && mkdir -p node_modules && mv package node_modules/postprocessing
  echo "export { EffectComposer, RenderPass, EffectPass, SMAAEffect, SMAAPreset, EdgeDetectionMode, FXAAEffect, BloomEffect, LUT3DEffect, LookupTexture, ToneMappingEffect, ToneMappingMode, BlendFunction, KernelSize } from 'postprocessing';" > entry.js
  npx esbuild@0.25.10 entry.js --bundle --format=esm --minify --external:three --legal-comments=inline --outfile=postprocessing.min.js
