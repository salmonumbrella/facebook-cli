.PHONY: build clean fmt lint test install setup run deps

BINARY_NAME=fbcli
BUILD_DIR=./bin

setup:
	@command -v lefthook >/dev/null || (echo "Install lefthook: brew install lefthook" && exit 1)
	lefthook install

build:
	go build -ldflags="-s -w" -trimpath -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/fbcli

clean:
	rm -rf $(BUILD_DIR)

fmt:
	go fmt ./...

lint:
	golangci-lint run

test:
	go test ./...

install:
	go build -ldflags="-s -w" -trimpath -o $(shell go env GOPATH)/bin/$(BINARY_NAME) ./cmd/fbcli

run:
	go run ./cmd/fbcli $(ARGS)

deps:
	go mod tidy
	go mod download
