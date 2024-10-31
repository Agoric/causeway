import path from 'path';
import { $ } from 'zx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const convertToSVG = async ({ inputPath }) => {
  try {
    const plantUMLJarPath = path.join(__dirname, 'plantuml.jar');
    console.log('Starting conversion...');
    const output = await $`java -jar "${plantUMLJarPath}" -tsvg "${inputPath}"`;
    console.log('Conversion complete:', output);
  } catch (error) {
    console.error('Error during SVG conversion:', error);
  }
};
