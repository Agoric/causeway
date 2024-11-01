import { fs } from 'zx';

export const checkFileExists = async ({ filePath, description = 'File' }) => {
  try {
    await fs.access(filePath);
    console.log(`${description} found at ${filePath}`);
    return true;
  } catch {
    throw Error(`Error: ${description} not found at path: ${filePath}`);
  }
};
