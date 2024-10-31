import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const convertToSVG = (inputPath) => {
  return new Promise((resolve, reject) => {
    // Adjust the path to where you've stored your PlantUML jar
    const plantUMLJarPath = path.join(__dirname, 'plantuml.jar');
    const command = `java -jar "${plantUMLJarPath}" -tsvg "${inputPath}"`;

    exec(command, (error, _, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        console.error('Error output:', stderr);
      }
      resolve(svgOutputPath);
    });
  });
};
