export const buildWorkspaceTimestampedOutputFolderName = (date = new Date()): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')
