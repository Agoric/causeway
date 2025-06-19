FROM node:20.9-bullseye AS build

ARG SOURCE=/source

WORKDIR "$SOURCE"

COPY --chmod=755 --link . "$SOURCE"

SHELL ["/bin/bash", "-c"]

RUN <<-DOCKER_SCRIPT
    #! /bin/bash

    set -o errexit -o errtrace -o nounset

    corepack enable
    cd "$SOURCE"
    yarn install --immutable
    yarn build
DOCKER_SCRIPT


FROM node:20.9-slim AS serve

ENV PORT=3000
ENV SOURCE=/source

WORKDIR "$SOURCE"

COPY --from=build "$SOURCE/.next" "$SOURCE/.next"
COPY --from=build "$SOURCE/.yarn" "$SOURCE/.yarn"
COPY --from=build "$SOURCE/node_modules" "$SOURCE/node_modules"
COPY --from=build "$SOURCE/.yarnrc.yml" "$SOURCE/package.json" "$SOURCE/yarn.lock" "$SOURCE"

RUN <<-DOCKER_SCRIPT
    set -o errexit -o nounset

    corepack enable

    apt-get update
    apt-get install curl --yes
    rm --force --recursive /var/lib/apt/lists/*
DOCKER_SCRIPT

EXPOSE $PORT

ENTRYPOINT ["yarn", "--cwd", "$SOURCE", "start", "$PORT"]
