#! /bin/bash
# shellcheck disable=SC2155

# The docker-compose file should be used normally
# This script should only be used for starting
# solely the neo4j container (or connecting an
# existing container with it)
# In this case, you should either pass
# --publish "7474:7474" --publish "7687:7687"
# to the script to make the ports available on the
# host machine, or pass
# --network "container:<CONTAINER ID>"
# to make it part of an existing container network

set -o errexit

ARGS=("$@")
CONTAINER_NAME="neo4j-database"
DIRECTORY_PATH="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> "/dev/null" && pwd)"
IMAGE_NAME="neo4j"
IMAGE_TAG="5.26.8-community-bullseye"

ensure_image_exists() {
    if test -z "$(
        docker image list --all --format "json" |
            jq --slurp |
            jq --arg name "$IMAGE_NAME" --arg tag "$IMAGE_TAG" --raw-output '.[] | select(.Repository == $name and .Tag == $tag)'
    )"; then
        docker image pull "$IMAGE_NAME:$IMAGE_TAG"
    fi
}

run_container() {
    local containerId
    local containerInformation="$(
        docker container list --all --format "json" |
            jq --slurp |
            jq --arg name "$CONTAINER_NAME" --raw-output '.[] | select(.Names == $name)'
    )"
    if test -z "$containerInformation"; then
        docker container run \
            --detach \
            --env "NEO4J_AUTH=neo4j/secretpassword" \
            --name "$CONTAINER_NAME" \
            --volume "$DIRECTORY_PATH/$IMAGE_NAME/data":/data \
            "${ARGS[@]}" \
            "$IMAGE_NAME:$IMAGE_TAG"
    else
        if test "$(echo "$containerInformation" | jq --raw-output '.State')" == "exited"; then
            containerId="$(echo "$containerInformation" | jq --raw-output '.ID')"
            docker container start "$containerId"
        fi
    fi
}

ensure_image_exists
run_container
