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
  const difference = Math.abs(maxDays - currentIndex);

  let batchStart;

  if (difference < BATCH_SIZE) {
    batchStart = difference + currentIndex + 1;
  } else {
    if (currentIndex === 0) {
      batchStart = BATCH_SIZE;
    } else {
      batchStart = currentIndex + BATCH_SIZE;
    }
  }

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

export const findEntryWithTimestamp = (logs) => {
  for (const logEntries of logs) {
    for (const entry of logEntries) {
      if (entry.metadata && entry.metadata.timestamp) {
        return entry.metadata;
      }
    }
  }
  return null;
};
