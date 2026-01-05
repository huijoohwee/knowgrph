export const tryFormatJson = (text: string) => {
  const obj = JSON.parse(text);
  return JSON.stringify(obj, null, 2);
};

