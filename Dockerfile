
FROM node:20

# TODO: Use a specific version of JDK and JRE
RUN apt-get update \
    && apt-get install default-jre -y \
    && apt-get install default-jdk -y

WORKDIR /app
COPY . .
RUN yarn install

EXPOSE 3000
