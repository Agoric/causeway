#!/bin/bash

mkdir -p scripts

if [ ! -f "scripts/a3p.slog" ]; then
    touch "scripts/a3p.slog"
    echo "✅ Log file created: scripts/a3p.slog"
else
    echo "ℹ️ Log file already exists."
fi
