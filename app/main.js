const storage = require('electron-json-storage')
const fs = require('fs')
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const ffprobe = require('@ffprobe-installer/ffprobe');
const {
    app,
    BrowserWindow,
    dialog,
    electron,
    ipcMain,
    shell
} = require('electron');

let mainWindow

app.on('ready', function() {
    // Check for game installation path / first run
    // Need to set muteAudio default here so it can be correctly toggled by user in settings
    parseConfig('get', 'main', false, function(mainConfig) {
        mainWindow = new BrowserWindow({
            width: 480,
            height: 779,
            frame: false,
            resizable: false,
            show: false
        })
        if (mainConfig.attractScreenPath === undefined) {
            createWindow(mainWindow, `file://${__dirname}/config/index.html`)
        } else {
            createWindow(mainWindow, `file://${__dirname}/index.html`)
        }
        mainWindow.webContents.on('did-finish-load', () => {
            getDetails(0)
            getDefaultVideo()
        })
        mainWindow.once('ready-to-show', () => {
            mainWindow.show()
        })
        ipcMain.on('open-external', (e, url) => {
            shell.openExternal(url)
        });
        updateChecker()
    });
})

app.on('window-all-closed', function() {
    app.quit()
})

function createWindow(BrowserWindow, url) {

    BrowserWindow.loadURL(url)

    BrowserWindow.webContents.on('new-window', function(e, url) {
        e.preventDefault();
        shell.openExternal(url);
    });

    BrowserWindow.on('closed', function() {
        BrowserWindow = null
    })
}

exports.selectVideoFile = function(gridnum) {
    dialog.showOpenDialog(mainWindow, {
        filters: [{
            name: 'Video',
            extensions: ['*']
        }],
        properties: ['openFile', 'multiSelections']
    }, function(response) {
        if (response !== undefined) {
            parseConfig('get', 'main', false, function(mainConfig) {
                if (mainConfig.extraCabinets === true) {
                    totalVideos = 35
                } else {
                    totalVideos = 30
                }
                // If more than totalVideos returned spliced array
                if (response.length > totalVideos) {
                    response.splice(totalVideos, response.length - totalVideos)
                }

                // Loop around all returned files
                for (var i = 0; i < response.length; i++) {
                    mainWindow.webContents.executeJavaScript(`$('<div class="block-overlay"></div>').appendTo('body');`);
                    // Run function
                    lastFile = false
                    if (initialGrid === undefined) { // jshint ignore:line
                        var initialGrid = gridnum
                        initialnum = initialGrid
                    }
                    gridnum = initialnum++
                        if (i == response.length - 1 || response.length == 1) lastFile = true
                    if (lastFile) mainWindow.webContents.executeJavaScript(`$(".block-overlay").remove();`);
                    saveVideoFile(gridnum, response[i], response.length, initialGrid, lastFile); // jshint ignore:line
                }
            });
        }
    });
}

saveVideoFile = function(gridnum, filePath, totalItems, initialGrid, lastFile) {
    // Check file read access
    fs.access(filePath, fs.constants.R_OK, function(error) {
        if (error) {
            mainWindow.webContents.send('notificationMsg', [{
                type: 'error',
                msg: `Could not read file: ${filePath}`,
                open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                log: error
            }]);
            return
        }
        parseConfig('get', 'videoFiles', false, function(data) {
            if (Object.keys(data).length > 0) {
                videoFiles = data
            } else {
                videoFiles = {}
            }
            // Get video duration
            var args = `-v error -select_streams v:0 -of json -show_entries stream=duration`
            args = args.split(' ');
            args.push(filePath)
            const execInfo = require('child_process').execFile;
            execInfo(ffprobe.path, args, (error, stdout, stderr) => {
                if (error) {
                    mainWindow.webContents.send('notificationMsg', [{
                        type: 'error',
                        msg: `FFprobe error (getting video duration)`,
                        open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                        log: error
                    }]);
                    return
                }
                output = JSON.parse(stdout)
                fileDuration = output.streams[0].duration
                videoFiles[gridnum] = {}
                videoFiles[gridnum].duration = fileDuration
                videoFiles[gridnum].path = filePath


                // Check if updating video of default grid and update mainConfig
                parseConfig('get', 'main', false, function(configData) {
                    if (configData !== undefined) {
                        if (configData.defaultVideoGridNum == gridnum) {
                            configData.defaultVideo = filePath
                            configData.defaultVideoDuration = fileDuration
                            parseConfig('set', 'main', configData, function(data) {});
                        }
                    }
                });

                // Check thumbnail directory exists if not create
                thumbnailPath = `${app.getPath('userData')}\\thumbnails`
                fs.access(thumbnailPath, fs.F_OK, function(err) {
                    if (err) {
                        fs.mkdir(thumbnailPath, '0777', function(error) {
                            if (error) {
                                mainWindow.webContents.send('notificationMsg', [{
                                    type: 'error',
                                    msg: `Could not create thumbnails directory`,
                                    open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                                    log: error
                                }]);
                                return
                            }
                        });
                    }
                    // Generate thumbnail at half way point
                    const execThumbnail = require('child_process').execFile;
                    sstime = fileDuration / 2
                    var args = `-ss ${sstime} -y -i`
                    args = args.split(' ')
                    args.push(filePath)
                    args2 = `-vframes 1 -q:v 2`
                    args2 = args2.split(' ')
                    args2.push(`${thumbnailPath}\\${gridnum}.jpg`)
                    args = args.concat(args2);
                    execThumbnail(ffmpeg.path, args, (error, stdout, stderr) => {
                        if (error) {
                            mainWindow.webContents.send('notificationMsg', [{
                                type: 'error',
                                msg: `FFmpeg error (generating thumbnail)`,
                                open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                                log: error
                            }]);
                            return
                        }
                        // Update videoFiles config
                        parseConfig('set', 'videoFiles', videoFiles, function(cb) {
                            if (lastFile) {
                                getDetails(initialGrid)
                            }
                        });
                    });
                });
            });
        });
    });
}

exports.selectAttractScreenFile = function() {
    getGamePath(function(data) {
        options = {
            filters: [{
                name: 'AttractScreens.mp4',
                extensions: ['mp4'],
            }],
            properties: ['openFile'],
        }
        if (data !== false) {
            options.defaultPath = `${data}\\NewRetroArcade\\Content\\Movies`
        }
        dialog.showOpenDialog(mainWindow, options, function(response) {
            if (response !== undefined) {
                fs.access(response[0], fs.constants.R_OK, function(error) {
                    if (error) {
                        mainWindow.webContents.send('notificationMsg', [{
                            type: 'error',
                            msg: `Could not read file: ${response[0]}`,
                            open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                            log: error
                        }]);
                        return
                    }
                    parseConfig('get', 'main', false, function(configData) {
                        if (configData !== undefined) {
                            configData.attractScreenPath = response[0]
                            parseConfig('set', 'main', configData, function(data) {
                                mainWindow.webContents.send('attractScreenSet', true)
                                mainWindow.webContents.send('notificationMsg', [{
                                    type: 'success',
                                    msg: `Attract Screen Set!`
                                }]);
                            });
                        }
                    });
                });
            }
        });
    });
}

exports.deleteVideo = function(gridnum) {
    var choice = dialog.showMessageBox(
        mainWindow, {
            type: 'question',
            buttons: ['Yes', 'No'],
            title: 'Confirm',
            message: `Are you sure you want to delete?`
        });
    if (choice === 0) {
        parseConfig('get', 'videoFiles', false, function(data) {
            if (data !== undefined) {
                const videoFiles = data
                delete videoFiles[gridnum];
                parseConfig('set', 'videoFiles', videoFiles, function(data) {
                    parseConfig('get', 'main', false, function(mainConfig) {
                        if (mainConfig.defaultVideoGridNum == gridnum) {
                            delete mainConfig.defaultVideoDuration
                            delete mainConfig.defaultVideoGridNum
                            delete mainConfig.defaultVideo
                        }
                        parseConfig('set', 'main', mainConfig, function(error) {
                            getDefaultVideo()
                            filePath = `${app.getPath('userData')}\\thumbnails\\${gridnum}.jpg`
                            fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK, function(error) {
                                if (error) {
                                    mainWindow.webContents.send('notificationMsg', [{
                                        type: 'error',
                                        msg: `Could not read/write file: ${filePath}`,
                                        open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                                        log: error
                                    }]);
                                    return
                                }
                                fs.unlink(filePath);
                                mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
                                getDetails(gridnum)
                            });
                        });
                    });
                });
            }
        });
    }
}

exports.renderVideo = function() {
    parseConfig('get', 'main', false, function(configData) {
        if (configData !== undefined) {
            defaultVideo = configData.defaultVideo
            defaultVideoDuration = configData.defaultVideoDuration
            attractScreenPath = configData.attractScreenPath
            if (configData.renderScale !== undefined) {
                renderScale = configData.renderScale
            } else {
                renderScale = '256:192'
            }
            if (configData.extraCabinets === true) {
                totalVideos = 35
            } else {
                totalVideos = 30
            }
            muteAudio = configData.muteAudio
            generateReport = configData.generateReport
            if (configData.encoder !== undefined) {
                switch (configData.encoder) {
                    case 'h264_nvenc':
                        encoder = 'h264_nvenc -pixel_format yuv444p -preset lossless'
                        break;
                    case 'h264_qsv':
                        encoder = 'h264_qsv -pixel_format qsv -preset:v medium'
                        break;
                    default:
                        encoder = 'libx264'
                }
            } else {
                encoder = 'libx264'
            }
            if (configData.hwaccel === true) {
                hwaccel = '-hwaccel auto -i'
            } else {
                hwaccel = '-i'
            }
            parseConfig('get', 'videoFiles', false, function(videoFiles) {
                if (videoFiles[0] === undefined) {
                    mainWindow.webContents.send('render', ['end', true]);
                    mainWindow.webContents.send('notificationMsg', [{
                        type: "error",
                        msg: `Grid 1 must be set - click to clear this message`
                    }]);
                    return false
                }
                if (videoFiles !== undefined) {
                    if (Object.keys(videoFiles).length < totalVideos) {
                        // If no default video set use first videoFiles
                        if (defaultVideo === undefined) {
                            defaultVideo = videoFiles[0].path
                        }
                        if (defaultVideoDuration === undefined) {
                            defaultVideoDuration = videoFiles[0].duration
                        }
                    }
                    // Set totalTile to longest videoFiles
                    videoDurations = []
                    for (var prop in videoFiles) {
                        videoDurations.push(videoFiles[prop].duration)
                    }
                    var videoDurationsSorted = [];
                    for (var duration in videoDurations)
                        videoDurationsSorted.push([duration, videoDurations[duration]])
                    videoDurationsSorted.sort(
                            function(a, b) {
                                return a[1] - b[1]
                            }
                        )
                        // Cannot sort descending so select last item in object
                    totalTime = videoDurationsSorted[Object.keys(videoFiles).length - 1][1]

                    if ((configData.maxDuration !== undefined && configData.maxDuration !== false) && configData.maxDuration <= totalTime) {
                        totalTime = configData.maxDuration
                    } else {
                        totalTime = totalTime
                    }

                    for (var i = 0; i < totalVideos; i++) {
                        // Generate xlist.txt
                        var listFileLine = ''
                        if (videoFiles[i] !== undefined) {
                            divison = Math.ceil(totalTime / videoFiles[i].duration)
                            for (var ii = 0; ii < divison; ii++) {
                                listFileLine += `file '${videoFiles[i].path}'\r\n`
                            }
                            fs.writeFileSync(`${app.getPath('temp')}\\${i}list.txt`, listFileLine)
                        } else {
                            divison = Math.ceil(totalTime / defaultVideoDuration)
                            for (var ii = 0; ii < divison; ii++) { // jshint ignore:line
                                listFileLine += `file '${defaultVideo}'\r\n`
                            }
                            fs.writeFileSync(`${app.getPath('temp')}\\${i}list.txt`, listFileLine)
                        }
                    }
                    var filename = attractScreenPath.replace(/^.*[\\\/]/, '')

                    var executablePath = ffmpeg.path

                    mainWindow.webContents.send('render', ['start']);
                    listCommand = ''
                    scaleCommand = ''
                    hstackCommand = ''
                    rowCommand = ''
                    execCommand = ''
                    elaspedTimeSecs = ''
                    args = []
                    for (var i = 0; i < totalVideos; i++) { // jshint ignore:line
                        listCommand += ` -f concat -safe 0 ${hwaccel} ${app.getPath('temp')}\\${i}list.txt`
                        scaleCommand += ` [${i}:v]scale=${renderScale} [tmp${i}];`
                    }
                    args = listCommand.trim().split(' ')

                    args.push('-filter_complex')
                    execCommandTmp = `${scaleCommand.trim()}`
                    rowCount = 0
                    for (var i = 1; i < totalVideos + 1; i++) { // jshint ignore:line
                        hstackCommand += `[tmp${i-1}]`
                        if ((i % 5) === 0 && i !== 0) {
                            hstackCommand += `hstack=inputs=5[row${rowCount++}]; `
                        }
                    }
                    execCommandTmp += hstackCommand
                    for (var i = 0; i < rowCount; i++) { // jshint ignore:line
                        rowCommand += `[row${i}]`
                        if (i == rowCount - 1) {
                            rowCommand += ` vstack=inputs=${rowCount}`
                        }
                    }
                    execCommandTmp += ` ${rowCommand}`
                    args.push(execCommandTmp.trim())
                    if (generateReport === true) args.push('-report')
                    args.push('-t')
                    args.push(totalTime)
                    args.push('-an')
                    args.push('-y')
                    args.push('-c:v')
                    args = args.concat(encoder.split(' '))
                    args.push(attractScreenPath)

                    const spawn = require('child_process').spawn;
                    const ffmpegProcess = spawn(executablePath, args);
                    app.on('window-all-closed', function() {
                        ffmpegProcess.kill()
                    })

                    ffmpegProcess.stderr.on('data', (data) => {
                        var re = /time=(.*?) bitrate=/
                        var elaspedTime = re.exec(data)
                        if (elaspedTime !== null) {
                            [hh, mm, ss] = elaspedTime[1].split(':')
                            elaspedTimeSecs = Math.round(ss)
                            if (mm !== undefined) elaspedTimeSecs += mm * 60
                            if (hh !== undefined) elaspedTimeSecs += hh * 60 * 60
                            progress = elaspedTimeSecs / totalTime
                            mainWindow.webContents.send('renderProgress', [elaspedTimeSecs, progress]);
                        }
                    });
                    ffmpegProcess.on('error', (error) => {
                        mainWindow.webContents.send('render', ['end']);
                        mainWindow.webContents.send('notificationMsg', [{
                            type: 'error',
                            msg: 'Render failed - please enable reporting in settings then retry and create an issue with this report on <a href="https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues" target="_blank">Github</a>',
                            open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues'
                        }]);
                        return
                    });

                    ffmpegProcess.on('close', (code) => {
                        // Cleanup xlist.txt
                        for (var i = 0; i < totalVideos; i++) {
                            fs.unlinkSync(`${app.getPath('temp')}\\${i}list.txt`);
                        }
                        if (code === 0) {
                            if (elaspedTimeSecs !== null) {
                                var minutes = Math.floor(elaspedTimeSecs / 60)
                                var seconds = elaspedTimeSecs % 60
                                var finalTime = str_pad_left(minutes, '0', 2) + ':' + str_pad_left(seconds, '0', 2);
                            }
                            if (!muteAudio) {
                                mainWindow.webContents.executeJavaScript(`
                                    var audio = new Audio('media/success.ogg');
                                    audio.play();
                                `);
                            }
                            mainWindow.webContents.send('render', ['end']);
                            mainWindow.webContents.send('notificationMsg', [{
                                type: "success",
                                msg: `Render completed in ${finalTime}`, // jshint ignore:line
                                delay: 6000
                            }]);
                        } else {
                            mainWindow.webContents.send('render', ['end', true]);
                            mainWindow.webContents.send('notificationMsg', [{
                                type: 'error',
                                msg: 'Render failed - please enable reporting in settings then retry and create an issue with this report on <a href="https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues" target="_blank">Github</a>',
                                open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues'
                            }]);
                        }
                    });
                }
            });
        }
    });
}

exports.defaultVideo = function(gridnum) {
    parseConfig('get', 'videoFiles', false, function(data) {
        if (data[gridnum] !== undefined) {
            defaultVideo = data[gridnum].path
        }
        parseConfig('get', 'main', false, function(data) {
            if (data !== undefined) {
                mainConfig = data
                mainConfig.defaultVideo = defaultVideo
                mainConfig.defaultVideoGridNum = gridnum

                var executablePath = ffprobe.path
                var args = `-v error -select_streams v:0 -of json -show_entries stream=width,height,duration`
                args = args.split(' ')
                args.push(defaultVideo)
                const exec = require('child_process').execFile
                exec(executablePath, args, (error, stdout, stderr) => {
                    if (error) {
                        mainWindow.webContents.send('notificationMsg', [{
                            type: 'error',
                            msg: `FFprobe error (getting default video duration)`,
                            open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                            log: error
                        }]);
                        return
                    }
                    output = JSON.parse(stdout)
                    mainConfig.defaultVideoDuration = output.streams[0].duration
                    parseConfig('set', 'main', mainConfig, function(error) {
                        getDefaultVideo()
                    });
                });
            }
        });
    });
}

exports.unsetDefaultVideo = function(gridnum) {
    parseConfig('get', 'main', false, function(mainConfig) {
        if (mainConfig.defaultVideoGridNum == gridnum) {
            delete mainConfig.defaultVideoDuration
            delete mainConfig.defaultVideoGridNum
            delete mainConfig.defaultVideo
        }
        parseConfig('set', 'main', mainConfig, function(error) {
            getDefaultVideo()
        });
    });
}

exports.switchPage = function(page) {
    switch (page) {
        case 'about':
            mainWindow.loadURL(`file://${__dirname}/about/index.html`)
            break;
        case 'main':
            mainWindow.loadURL(`file://${__dirname}/index.html`)
            getDetails(0)
            getDefaultVideo()
            break;
        case 'settings':
            mainWindow.loadURL(`file://${__dirname}/config/index.html`)
            break;
        default:
            mainWindow.loadURL(`file://${__dirname}/index.html`)
            getDetails(0)
            getDefaultVideo()
            break;
    }
}

exports.updateSettings = function(settings) {
    parseConfig('get', 'main', false, function(mainConfig) {
        if (mainConfig !== undefined) {
            mainConfig[settings[0]] = settings[1]
            parseConfig('set', 'main', mainConfig, function(error) {
                if (settings[0] == 'attractScreenPath') {
                    mainWindow.webContents.send('attractScreenSet', true)
                    mainWindow.webContents.send('notificationMsg', [{
                        type: 'success',
                        msg: `Attract Screen Set!`
                    }]);
                } else {
                    mainWindow.webContents.send('notificationMsg', [{
                        type: 'success',
                        msg: `Settings updated!`
                    }]);
                }
            });
        }
    });
}

exports.quitApp = function() {
    app.quit()
}

exports.changeGrid = function(gridnum) {
    getDetails(gridnum)
    getDefaultVideo()
}

function getDefaultVideo() {
    parseConfig('get', 'main', false, function(data) {
        if (data !== undefined) {
            mainWindow.webContents.send('defaultVideo', data.defaultVideoGridNum);
        }
    });
}

function getDetails(gridnum) {
    thumbnailImagePath = '';
    parseConfig('get', 'videoFiles', false, function(data) {
        if (Object.keys(data).length > 0) {
            videoFiles = data
        } else {
            videoFiles = {}
        }
        if (Object.keys(videoFiles).length === 0) {
            mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
            mainWindow.webContents.send('gridDetails', [false, '']);
            mainWindow.webContents.send('screenStatus', 'Video not set');
            return
        } else if (videoFiles[gridnum] === undefined) {
            mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
            mainWindow.webContents.send('gridDetails', [false, '']);
            mainWindow.webContents.send('screenStatus', 'Video not set');
            return
        } else {
            thumbnailPath = `${app.getPath('userData')}\\thumbnails`
            fullPath = `${thumbnailPath}\\${gridnum}.jpg`
            thumbnailImagePath = fullPath
            mainWindow.webContents.send('thumbnailImage', [thumbnailImagePath]);
            mainWindow.webContents.send('screenStatus', false);
        }
        // If video file exists
        var filePath = videoFiles[gridnum].path
        fs.access(filePath, fs.constants.R_OK, (err) => {
            if (err) {
                mainWindow.webContents.send('gridDetails', [false, `Video '${filePath}' can not be found`]);
            } else {
                var filename = filePath.replace(/^.*[\\\/]/, '')

                const execFile = require('child_process').execFile;
                var args = `-v error -select_streams v:0 -of json -show_entries format=filename:stream=duration,width,height,divx_packed,has_b_frames`
                args = args.split(' ');
                // Path may contain spaces so push to end of array separately to avoid split
                args.push(filePath)
                const child = execFile(ffprobe.path, args, (error, stdout, stderr) => {
                    if (error) {
                        mainWindow.webContents.send('notificationMsg', [{
                            type: 'error',
                            msg: `FFprobe error (get details)`,
                            open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                            log: error
                        }]);
                        return
                    }
                    output = JSON.parse(stdout)
                    mainWindow.webContents.send('gridDetails', [filename, output.streams[0].duration, output.streams[0].width, output.streams[0].height, filePath]);
                });
            }
        });
    });
}

exports.playVideo = function(gridnum) {
    // Get width and height of video for BrowserWindow
    parseConfig('get', 'videoFiles', false, function(data) {
        const execFile = require('child_process').execFile;
        var args = `-v error -select_streams v:0 -of json -show_entries stream=width,height`
        args = args.split(' ');
        // Path may contain spaces so push to end of array separately to avoid split
        args.push(data[gridnum].path)
        if (data[gridnum].path.indexOf(".mp4") >= 0) {
            const child = execFile(ffprobe.path, args, (error, stdout, stderr) => {
                if (error) {
                    mainWindow.webContents.send('notificationMsg', [{
                        type: 'error',
                        msg: `FFprobe error (get video details for player)`,
                        open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                        log: error
                    }]);
                    return
                }
                output = JSON.parse(stdout)

                videoWindow = new BrowserWindow({
                    width: output.width,
                    height: output.height,
                    frame: false,
                    resizable: false,
                    show: false
                })
                createWindow(videoWindow, `file://${__dirname}/video/index.html`)
                videoWindow.once('ready-to-show', () => {
                    videoWindow.show()
                    videoWindow.webContents.send('playVideo', [data[gridnum].path]);
                })
            });
        } else {
            return // Unsupported file type, return
        }
    });
}

function str_pad_left(string, pad, length) {
    return (new Array(length + 1).join(pad) + string).slice(-length);
}

function parseConfig(action, configFile, configData, callback) {
    switch (action) {
        case 'get':
            storage.get(configFile, function(error, data) {
                if (error) {
                    mainWindow.webContents.send('notificationMsg', [{
                        type: 'error',
                        msg: `Could not read from config (${configFile})`,
                        open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                        log: error
                    }]);
                    throw error
                }
                if (callback && typeof(callback) === "function") {
                    callback(data)
                }
            });
            break;
        case 'set':
            storage.set(configFile, configData, function(error) {
                if (error) {
                    mainWindow.webContents.send('notificationMsg', [{
                        type: 'error',
                        msg: `Could not write to config (${configFile})`,
                        open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
                        log: error
                    }]);
                }
                callback(true)
            });
            break;
        default:
    }
}

exports.parseConfigRenderer = parseConfig;

exports.availableEncoders = function(callback) {

    requestedEncoders = {
        0: {
            'id': 'libx264',
            'name': 'x264 (CPU)'
        },
        1: {
            'id': 'h264_nvenc',
            'name': 'NVENC (Nvidia GPU)'
        },
        2: {
            'id': 'h264_qsv',
            'name': 'QuickSync (Intel GPU)'
        }
    }
    availableEncoders = {}
    for (var i in requestedEncoders) {
        var args = `-h encoder=${requestedEncoders[i].id}`
        args = args.split(' ')
        const execEncoders = require('child_process').execFileSync
        output = execEncoders(ffmpeg.path, args)
        output = output.toString().trim()
        if (output !== `Codec '${requestedEncoders[i].id}' is not recognized by FFmpeg.`) {
            availableEncoders[i] = {}
            availableEncoders[i].id = requestedEncoders[i].id
            availableEncoders[i].name = requestedEncoders[i].name
        }
    }
    callback(availableEncoders)
}

function getGamePath(callback) {
    var Registry = require('winreg')
    regKey = new Registry({
        hive: Registry.HKLM,
        key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 465780\\'
    })

    regKey.values(function(error, items) {
        if (error) {
            // registry key not found, game not installed
            callback(false)
        } else {
            // key found loop until InstallLocation and callback with value
            for (var i = 0; i < items.length; i++) {
                if (items[i].name == 'InstallLocation') callback(items[i].value)
            }
        }
    });
}

exports.editConfigINI = function(state) {
    var ConfigIniParser = require("config-ini-parser").ConfigIniParser;
    getGamePath(function(gamePath) {
        var delimiter = "\r\n";
        var sectionName = '/Script/ArcadeRift.ArcadeGameUserSettings'
        parser = new ConfigIniParser(delimiter);
        parser.parse(fs.readFileSync(`${gamePath}\\NewRetroArcade\\Saved\\Config\\WindowsNoEditor\\GameUserSettings.ini`, 'utf-8'));
        if (parser.isHaveSection(sectionName)) {
            // Set AttractMovie if missing
            if (parser.isHaveOption(sectionName, 'AttractMovie') === false) {
                parser.set(sectionName, 'AttractMovie', 'AttractScreens.mp4');
            }
            switch (state) {
                case true:
                    // Invalid ini file? Anyway select with strange option name and set 7 rows
                    if (parser.isHaveOption(sectionName, 'AttractMovieLayout=(X=5.000000,Y') === true) {
                        parser.removeOption(sectionName, 'AttractMovieLayout=(X=5.000000,Y')
                        parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=7.000000)')
                    } else {
                        parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=7.000000)')
                    }
                    break;
                case false:
                    // Revert to defaults
                    if (parser.isHaveOption(sectionName, 'AttractMovieLayout=(X=5.000000,Y') === true) {
                        parser.removeOption(sectionName, 'AttractMovieLayout=(X=5.000000,Y')
                        parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=6.000000)')
                    } else {
                        parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=6.000000)')
                    }
                    break
                default:
                    break
            }
            // Relace new line at start of file
            config = parser.stringify(delimiter).replace(/^\r\n|\n/, '');
            fs.writeFileSync(`${gamePath}\\NewRetroArcade\\Saved\\Config\\WindowsNoEditor\\GameUserSettings.ini`, config);
        }
    });
}

function updateChecker() {
    var GitHub = require('github-api');
    var semver = require('semver');
    require('pkginfo')(module, 'version');
    var gh = new GitHub();
    var repo = gh.getRepo('SavageCore', 'new-retro-arcade-neon-attract-screen-tool');
    repo.listReleases(function(error, releases) {
        if(error){
            mainWindow.webContents.send('notificationMsg', [{
                type: 'error',
                msg: `Update Check: ${error.response.data.message} - please see log`,
                log: error
            }]);
        }
        if (semver.gt(releases[0].tag_name, module.exports.version) === true) {
            // Newer release
            mainWindow.webContents.send('notificationMsg', [{
                type: 'success',
                msg: `Update available! Click to download`,
                open: releases[0].html_url
            }]);
        } else if (semver.diff(releases[0].tag_name, module.exports.version) === null) {
            // Current
            mainWindow.webContents.send('notificationMsg', [{
                type: 'info',
                msg: `You have the latest version`,
                delay: 3000
            }]);
        } else {
            // Unknown
            mainWindow.webContents.send('notificationMsg', [{
                type: 'error',
                msg: `Unknown! Click to download latest`,
                open: releases[0].html_url
            }]);
        }
    })
}
