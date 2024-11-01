import path from 'path';
import { $ } from 'zx';
import { fileURLToPath } from 'url';
import { checkFileExists } from '../helpers/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const convertToSVG = async ({ pumlFilePath, svgDir }) => {
  const plantUMLJarPath = path.join(__dirname, '..', 'plantuml.jar');

  await checkFileExists({
    filePath: plantUMLJarPath,
    description: 'plantuml.jar',
  });
  await checkFileExists({ filePath: pumlFilePath, description: 'puml file' });

  try {
    console.log('Starting conversion...');

    await $`java -jar "${plantUMLJarPath}" -tsvg "${pumlFilePath}" -o ${svgDir}`;
    const svgPath = path.join(__dirname, '..', `uploads/${svgDir}/slog.svg`);
    await checkFileExists({ filePath: svgPath, description: 'svg file' });

    console.log('Conversion successful');
  } catch (error) {
    console.error('Error during SVG conversion:', error.message);
  }
};
