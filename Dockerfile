FROM node:latest
WORKDIR /usr/aggregator
RUN echo "v0.0.8"
COPY ./*.json ./
RUN npm install
RUN npm i -g @nestjs/cli