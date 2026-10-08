export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.endsWith('.js') && (specifier.startsWith('./') || specifier.startsWith('../'))) {
      const tsSpecifier = specifier.slice(0, -3) + '.ts';
      return await nextResolve(tsSpecifier, context);
    }
    throw err;
  }
}
