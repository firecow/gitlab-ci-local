FROM debian:bullseye-20230320-slim

RUN apt-get update && \
  apt-get install -y rsync && \
  rm -rf /var/lib/apt/lists/*
