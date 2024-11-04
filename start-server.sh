#!/bin/bash

PLANTUML_URL="https://github.com/plantuml/plantuml/releases/download/v1.2022.7/plantuml-1.2022.7.jar"
PLANTUML_FILE="plantuml.jar"

if [ ! -f "$PLANTUML_FILE" ]; then
  echo "$PLANTUML_FILE not found. Downloading..."
  curl -L -o "$PLANTUML_FILE" "$PLANTUML_URL"
  if [ $? -eq 0 ]; then
    echo "Downloaded $PLANTUML_FILE successfully."
  else
    echo "Error downloading $PLANTUML_FILE. Check the URL or network connection."
    exit 1
  fi
else
  echo "$PLANTUML_FILE already exists."
fi

if [ "$NODE_ENV" = "prod" ]; then
  echo "Running in production mode..."
  yarn start
else
  echo "Running in development mode..."
  yarn dev
fi
