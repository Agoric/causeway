#!/bin/bash

mkdir -p scripts

if [ -f "scripts/a3p.slog" ]; then
    rm "scripts/a3p.slog"
    echo "🗑️ Existing log file removed: scripts/a3p.slog"
fi

touch "scripts/a3p.slog"
echo "✅ New log file created: scripts/a3p.slog"
