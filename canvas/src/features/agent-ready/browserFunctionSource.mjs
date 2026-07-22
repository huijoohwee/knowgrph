export const createBrowserSafeFunctionSource = (fn) => `((...args) => {
  const n = (value) => value
  const __name = (value) => value
  return (${Function.prototype.toString.call(fn)})(...args)
})`
