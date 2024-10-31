PLANTUML_URL="https://github.com/plantuml/plantuml/releases/download/v1.2022.7/plantuml-1.2022.7.jar"
PLANTUML_FILE="plantuml.jar"

if [ ! -f "$PLANTUML_FILE" ]; then
  echo "$PLANTUML_FILE not found. Downloading..."
  curl -L -o "$PLANTUML_FILE" "$PLANTUML_URL"
  echo "Downloaded $PLANTUML_FILE."
else
  echo "$PLANTUML_FILE already exists."
fi

yarn start