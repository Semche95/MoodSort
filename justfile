help:
    @just --list

install:
    @npm install

dev: install
    @npm run dev

build: install
    @npm run build

lint:
    @npm run lint

test:
    @npm run test
