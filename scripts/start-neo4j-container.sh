#! /bin/bash
# shellcheck disable=SC2155

# The docker-compose file should be used normally
# This script should only be used for starting
# solely the neo4j container (or connecting an
# existing container with it)

set -o errexit

CONTAINER_NAME="neo4j-database"
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
            --publish "7474:7474" \
            --publish "7687:7687" \
            --volume "$HOME/$IMAGE_NAME/data":/data \
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
