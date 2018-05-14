#!/bin/bash

if [[ "$TRAVIS_OS_NAME" = "linux" ]]; then
	electron-packager "$TRAVIS_BUILD_DIR" "Attract Screen Tool" --platform=linux --arch=x64 --app-version=1.0.$TRAVIS_BUILD_NUMBER --electron-version=2.0.0 --out="$TRAVIS_BUILD_DIR/builds" --overwrite --app-copyright="Copyright (C) $(date +'%Y') SavageCore"
	7z a Attract-Screen-Tool-linux-x64-$TRAVIS_COMMIT.zip "$TRAVIS_BUILD_DIR/builds/Attract Screen Tool-linux-x64"
	sftp $SFTP_USER@savagecore.eu:artifacts/ <<< $'put Attract-Screen-Tool-linux-x64-'$TRAVIS_COMMIT'.zip'
fi
if [[ "$TRAVIS_OS_NAME" = "osx" ]]; then
	electron-packager "$TRAVIS_BUILD_DIR" "Attract Screen Tool" --platform=darwin --arch=x64 --app-version=1.0.$TRAVIS_BUILD_NUMBER --electron-version=2.0.0 --out="$TRAVIS_BUILD_DIR/builds" --overwrite --app-copyright="Copyright (C) $(date +'%Y') SavageCore"
	7z a Attract-Screen-Tool-darwin-x64-$TRAVIS_COMMIT.zip "$TRAVIS_BUILD_DIR/builds/Attract Screen Tool-darwin-x64"
	sftp $SFTP_USER@savagecore.eu:artifacts/ <<< $'put Attract-Screen-Tool-darwin-x64-'$TRAVIS_COMMIT'.zip'
fi
