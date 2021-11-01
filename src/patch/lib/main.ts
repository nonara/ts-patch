namespace tsp {
  Object.defineProperties(ts, {
    isTSC: { get: () => tsp.isTSC, enumerable: true },
    tspVersion: { get: () => tsp.tspVersion, enumerable: true },
    PluginCreator: { get: () => tsp.PluginCreator, enumerable: true },
    originalCreateProgram: { value: ts.createProgram, enumerable: true },
    createProgram: { value: tsp.createProgram },
    diagnosticMap: { get: () => tsp.diagnosticMap, enumerable: true }
  });
}
