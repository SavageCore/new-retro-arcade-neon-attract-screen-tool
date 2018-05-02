$year = (Get-Date).year
electron-packager "$env:APPVEYOR_BUILD_FOLDER" "Attract Screen Tool" --platform=win32 --arch=x64 --app-version=$env:APPVEYOR_BUILD_VERSION --electron-version=2.0.0 --out="$env:APPVEYOR_BUILD_FOLDER/builds" --overwrite --win32metadata.ProductName="Attract Screen Tool" --win32metadata.FileDescription="Attract Screen Tool" --app-copyright="Copyright (C) $year SavageCore" 2>&1 | %{ "$_" }
