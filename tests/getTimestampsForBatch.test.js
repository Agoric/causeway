// @ts-check
import test from 'ava';
import { getTimestampsForBatch } from '../helpers/utils.js';
import { getDaysDifference } from '../helpers/utils.js';

const BATCH_SIZE = 10;

test('90 days creates 9 batches of 10 days each', (t) => {
  const totalDaysCoverage = 90;

  for (
    let currentIndex = 0;
    currentIndex < totalDaysCoverage;
    currentIndex += BATCH_SIZE
  ) {
    const { startTime, endTime } = getTimestampsForBatch(
      currentIndex,
      totalDaysCoverage
    );
    const daysDifference = getDaysDifference(startTime, endTime);
    t.is(
      daysDifference,
      10,
      `Each batch should be 10 days, but got ${daysDifference} days`
    );
  }
});

test('19 days creates 2 batches, first 10 days and second 9 days', (t) => {
  const totalDaysCoverage = 19;
  const expectedDifferences = [10, 9]; // First batch 10 days, second batch 9 days

  for (let i = 0; i < expectedDifferences.length; i++) {
    const currentIndex = i * BATCH_SIZE;
    const { startTime, endTime } = getTimestampsForBatch(
      currentIndex,
      totalDaysCoverage
    );
    const daysDifference = getDaysDifference(startTime, endTime);
    t.is(
      daysDifference,
      expectedDifferences[i],
      `Batch ${i + 1} should have ${
        expectedDifferences[i]
      } days, but got ${daysDifference} days`
    );
  }
});

test('21 days creates 3 batches, first 10 days, second 10 days and third 1 day', (t) => {
  const totalDaysCoverage = 21;
  const expectedDifferences = [10, 10, 1];

  for (let i = 0; i < expectedDifferences.length; i++) {
    const currentIndex = i * BATCH_SIZE;
    const { startTime, endTime } = getTimestampsForBatch(
      currentIndex,
      totalDaysCoverage
    );
    const daysDifference = getDaysDifference(startTime, endTime);
    t.is(
      daysDifference,
      expectedDifferences[i],
      `Batch ${i + 1} should have ${
        expectedDifferences[i]
      } days, but got ${daysDifference} days`
    );
  }
});

test('7 days create 1 batch of 7 days', (t) => {
  const totalDaysCoverage = 7;
  const expectedDifferences = [7];

  for (let i = 0; i < expectedDifferences.length; i++) {
    const currentIndex = i * BATCH_SIZE;
    const { startTime, endTime } = getTimestampsForBatch(
      currentIndex,
      totalDaysCoverage
    );
    const daysDifference = getDaysDifference(startTime, endTime);
    t.is(
      daysDifference,
      expectedDifferences[i],
      `Batch ${i + 1} should have ${
        expectedDifferences[i]
      } days, but got ${daysDifference} days`
    );
  }
});
