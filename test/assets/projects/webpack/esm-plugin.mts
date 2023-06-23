export default function(program: any, pluginOptions: any) {
  return (ctx) => {
    throw new Error(`ts-patch worked (esmts)`);
  };
}
