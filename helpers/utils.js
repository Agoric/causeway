// @ts-check
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

export const cleanupFiles = async (files, directory) => {
  try {
    for (const file of files) {
      if (fs.existsSync(file)) {
        await fs.promises.unlink(file);
        console.log(`Deleted file: ${file}`);
      }
    }

    if (directory && fs.existsSync(directory)) {
      await fs.promises.rm(directory, { recursive: true, force: true });
      console.log(`Deleted directory: ${directory}`);
    }
  } catch (error) {
    console.error('Failed to delete files or directory:', error);
  }
};

export const formatDateString = (dateString) => {
  const date = new Date(dateString);
  return date.toISOString();
};

export const getDaysDifference = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
};

export const getTimestampsForBatch = (currentIndex, maxDays) => {
  const BATCH_SIZE = 10; // 10 days
  let batchStart = currentIndex == 0 ? BATCH_SIZE : currentIndex + BATCH_SIZE;

  const difference = Math.abs(maxDays - currentIndex);
  let batchEnd = difference < BATCH_SIZE ? difference : 10;

  const startTime = new Date();
  startTime.setDate(startTime.getDate() - batchStart);

  const endTime = new Date(startTime);
  endTime.setDate(startTime.getDate() + batchEnd);

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
};
