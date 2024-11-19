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

export const getTimestampsForBatch = (batchStartIndex, totalDaysCoverage) => {
  const BATCH_SIZE = 10; // 10 days
  const difference = Math.abs(totalDaysCoverage - batchStartIndex);

  /**
   * batchStart: Determines the starting offset for the current batch in days.
   * - If the remaining days (`difference`) are less than `BATCH_SIZE`, the batch starts
   *   at `difference + batchStartIndex` to adjust for the smaller range.
   * - Otherwise, the batch starts at `batchStartIndex + BATCH_SIZE`, progressing by batch size.
   * Example:
   * If `batchStartIndex = 0` and `totalDaysCoverage = 25`:
   *   - `difference = 25`
   *   - `batchStart = 10` (since `difference >= BATCH_SIZE`)
   *   - `batchEnd = 10` (maximum batch size)
   *
   * If `batchStartIndex = 20` and `totalDaysCoverage = 25`:
   *   - `difference = 5`
   *   - `batchStart = 25` (`difference + batchStartIndex` since `difference < BATCH_SIZE`)
   *   - `batchEnd = 5` (remaining days less than batch size)
   */
  const batchStart =
    difference < BATCH_SIZE
      ? difference + batchStartIndex
      : batchStartIndex + BATCH_SIZE;

  const batchEnd = Math.min(difference, BATCH_SIZE);

  const startTime = new Date();
  startTime.setDate(startTime.getDate() - batchStart);

  const endTime = new Date(startTime);
  endTime.setDate(startTime.getDate() + batchEnd);

  /** 
  This is done to ensure that the intervals do not overlap. Without setting the time to
  the start of the day (00:00:00.000), the intervals may include the current time of day,
  causing inconsistencies in log-fetching ranges.
  
  Example of overlapping intervals without resetting the time:
    Interval 1: 2024-11-09T03:59:08.803Z to 2024-11-19T03:59:08.803Z
    Interval 2: 2024-10-30T03:59:08.865Z to 2024-11-09T03:59:08.865Z

  Notice that the end of Interval 2 (2024-11-09T03:59:08.865Z) is greater than the
  start of Interval 1 (2024-11-09T03:59:08.803Z). This results in overlapping logs
  and may lead to fetching duplicate or inconsistent data.
  */
  startTime.setHours(0, 0, 0, 0);
  if (batchStartIndex !== 0) {
    endTime.setHours(0, 0, 0, 0);
  }

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
