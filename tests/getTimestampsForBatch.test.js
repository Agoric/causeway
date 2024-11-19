// @ts-check
import test from 'ava';
import { getTimestampsForBatch } from '../helpers/utils.js';
import { getDaysDifference } from '../helpers/utils.js';

const BATCH_SIZE = 10;

test('90 days creates 9 batches of 10 days each', (t) => {
  const totalDaysCoverage = 90;
  let currentBatch = 0;

  for (
    let currentIndex = 0;
    currentIndex < totalDaysCoverage;
    currentIndex += BATCH_SIZE
  ) {
    const { startTime, endTime } = getTimestampsForBatch(
      currentIndex,
      totalDaysCoverage
    );
    let daysDifference = getDaysDifference(startTime, endTime);

    if (currentIndex === 0) {
      daysDifference = Math.floor(daysDifference);
    }

    t.is(
      daysDifference,
      10,
      `Each batch should be 10 days, but got ${daysDifference} days`
    );

    currentBatch += 1;
  }
});

test('19 days creates 2 batches, first 10 days and second 9 days', (t) => {
  const totalDaysCoverage = 19;
  const expectedDifferences = [10, 9]; // First batch 10 days, second batch 9 days
  let currentBatch = 0;

  for (let i = 0; i < expectedDifferences.length; i++) {
    const currentIndex = i * BATCH_SIZE;
    const { startTime, endTime } = getTimestampsForBatch(
      currentIndex,
      totalDaysCoverage
    );
    let daysDifference = getDaysDifference(startTime, endTime);

    if (currentIndex === 0) {
      daysDifference = Math.floor(daysDifference);
    }

    t.is(
      daysDifference,
      expectedDifferences[i],
      `Batch ${currentBatch + 1} should have ${
        expectedDifferences[currentBatch]
      } days, but got ${daysDifference} days`
    );
  }
});

test('21 days creates 3 batches, first 10 days, second 10 days and third 1 day', (t) => {
  const totalDaysCoverage = 21;
  const expectedDifferences = [10, 10, 1];
  let currentBatch = 0;

  for (
    let batchStartIndex = 0;
    batchStartIndex < totalDaysCoverage;
    batchStartIndex += BATCH_SIZE
  ) {
    const { startTime, endTime } = getTimestampsForBatch(
      batchStartIndex,
      totalDaysCoverage
    );
    let daysDifference = getDaysDifference(startTime, endTime);

    if (batchStartIndex === 0) {
      daysDifference = Math.floor(daysDifference);
    }

    t.is(
      daysDifference,
      expectedDifferences[currentBatch],
      `Batch ${currentBatch} should have ${expectedDifferences[currentBatch]} days, but got ${daysDifference} days`
    );

    currentBatch += 1;
  }
});

test('7 days create 1 batch of 7 days', (t) => {
  const totalDaysCoverage = 7;
  const expectedDifferences = [7];
  let currentBatch = 0;

  for (
    let batchStartIndex = 0;
    batchStartIndex < totalDaysCoverage;
    batchStartIndex += BATCH_SIZE
  ) {
    const { startTime, endTime } = getTimestampsForBatch(
      batchStartIndex,
      totalDaysCoverage
    );
    const daysDifference = getDaysDifference(startTime, endTime);
    t.is(
      Math.floor(daysDifference),
      expectedDifferences[currentBatch],
      `Batch ${currentBatch + 1} should have ${
        expectedDifferences[currentBatch]
      } days, but got ${daysDifference} days`
    );

    currentBatch += 1;
  }
});

test('10 days create 1 batch of 10 days', (t) => {
  const totalDaysCoverage = 10;
  const expectedDifferences = [10];
  let currentBatch = 0;

  for (
    let batchStartIndex = 0;
    batchStartIndex < totalDaysCoverage;
    batchStartIndex += BATCH_SIZE
  ) {
    const { startTime, endTime } = getTimestampsForBatch(
      batchStartIndex,
      totalDaysCoverage
    );
    const daysDifference = getDaysDifference(startTime, endTime);
    t.is(
      Math.floor(daysDifference),
      expectedDifferences[batchStartIndex],
      `Batch ${currentBatch + 1} should have ${
        expectedDifferences[batchStartIndex]
      } days, but got ${daysDifference} days`
    );

    currentBatch += 1;
  }
});
