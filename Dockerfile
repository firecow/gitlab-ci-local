FROM debian:bullseye-20210927-slim

RUN apt-get update && \
  apt-get install -y rsync && \
  rm -rf /var/lib/apt/lists/*
