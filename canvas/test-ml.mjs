const ml = await import('maplibre-gl');
console.log(Object.keys(ml).filter(k => k !== 'default'));
console.log(ml.default ? Object.keys(ml.default) : 'no default');
