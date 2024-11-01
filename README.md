# Causeway

**Causeway** is a web application designed to transform chain logs into insightful visual representations. It supports both `.json` and `.slog` file formats, enabling users to visualize complex log data through a straightforward web interface.

## How It Works

### File Uploads

Users can upload `.json` or `.slog` files directly to the web app. The backend processes these files to generate an SVG that visually maps out the log data.

### Log Visualization by Date

Users can specify the start and end dates for the logs they wish to visualize:

- **Data Retrieval:** The backend fetches these logs from Google Cloud Platform (GCP) based on the specified dates.
- **SVG Generation:** The system converts the retrieved logs into an SVG file, which is displayed on the frontend for user interaction and analysis.

# Setting Up the Development Server

1. Ensure **Docker** and **Docker Compose** are installed and configured on your machine.
2. Clone the repository locally.
3. Run `yarn install` to install dependencies.
4. Start the server with `docker-compose up`.
5. Access the web app by navigating to `http://localhost:3000` in your web browser.
