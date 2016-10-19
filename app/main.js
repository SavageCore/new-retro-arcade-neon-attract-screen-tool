const fs = require('fs');
const path = require('path');
const {
app,
BrowserWindow,
dialog,
ipcMain,
shell
} = require('electron');
const storage = require('electron-json-storage');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const ffprobe = require('@ffprobe-installer/ffprobe');
const xmlObjects = require('xml-objects');
const XMLWriter = require('xml-writer');
const eol = require('eol');
const xmlfmt = require('xmlfmt');

let mainWindow;

 /* global videoFiles: true */

app.on('ready', function () {
	// Check for game installation path / first run
	// Need to set muteAudio default here so it can be correctly toggled by user in settings
	parseConfig('get', 'main', false, function (mainConfig) {
		mainWindow = new BrowserWindow({
			width: 480,
			height: 779,
			frame: false,
			resizable: false,
			show: false
		});
		if (mainConfig.attractScreenPath === undefined) {
			createWindow(mainWindow, `file://${__dirname}/config/index.html`);
		} else {
			createWindow(mainWindow, `file://${__dirname}/index.html`);
		}
		mainWindow.webContents.on('did-finish-load', () => {
			getDetails(0);
			getDefaultVideo();
		});
		mainWindow.once('ready-to-show', () => {
			mainWindow.show();
		});
		ipcMain.on('open-external', (e, url) => {
			shell.openExternal(url);
		});
		updateChecker();
	});
});

app.on('window-all-closed', function () {
	app.quit();
});

function createWindow(BrowserWindow, url) {
	BrowserWindow.loadURL(url);

	BrowserWindow.webContents.on('new-window', function (e, url) {
		e.preventDefault();
		shell.openExternal(url);
	});

	BrowserWindow.on('closed', function () {
		BrowserWindow = null;
	});
}

exports.selectVideoFile = function (gridnum) {
	dialog.showOpenDialog(mainWindow, {
		filters: [{
			name: 'Video',
			extensions: ['*']
		}],
		properties: ['openFile', 'multiSelections']
	}, function (response) {
		if (response !== undefined) {
			parseConfig('get', 'main', false, function (mainConfig) {
				var totalVideos;
				if (mainConfig.extraCabinets === true) {
					totalVideos = 35;
				} else {
					totalVideos = 30;
				}
				// If more than totalVideos returned spliced array
				if (response.length > totalVideos) {
					response.splice(totalVideos, response.length - totalVideos);
				}

				// Loop around all returned files
				var initialGrid = gridnum;
				var initialNum = gridnum;
				for (let i = 0; i < response.length; i++) {
					mainWindow.webContents.executeJavaScript(`$('<div class="block-overlay"></div>').appendTo('body');`);
					var lastFile = false;
					gridnum = initialNum++;
					if (i === response.length - 1 || response.length === 1) {
						lastFile = true;
					}
					if (lastFile) {
						mainWindow.webContents.executeJavaScript(`$(".block-overlay").remove();`);
					}
					// Run function
					saveVideoFile(gridnum, response[i], initialGrid, lastFile);
				}
			});
		}
	});
};

function saveVideoFile(gridnum, filePath, initialGrid, lastFile) {
	var sanitize = require('pretty-filename');

	// Sanitize filePath
	var dirPath = path.dirname(filePath);
	var baseName = sanitize(path.basename(filePath));
	// If different then rename the file
	if (path.relative(filePath, `${dirPath}\\${baseName}`).length > 0) {
		fs.renameSync(filePath, `${dirPath}\\${baseName}`);
		filePath = `${dirPath}\\${baseName}`;
	}

	// Check file read access
	fs.access(filePath, fs.constants.R_OK, function (error) {
		if (error) {
			mainWindow.webContents.send('notificationMsg', [{
				type: 'error',
				msg: `Could not read file: ${filePath}`,
				open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
				log: error
			}]);
			return;
		}
		parseConfig('get', 'videoFiles', false, function (data) {
			if (Object.keys(data).length > 0) {
				videoFiles = data;
			} else {
				videoFiles = {};
			}
			// Get video duration
			var args = `-v error -select_streams v:0 -of json -show_entries stream=duration`;
			args = args.split(' ');
			args.push(filePath);
			var execInfo = require('child_process');

			execInfo = execInfo.execFile;
			execInfo(ffprobe.path, args, (error, stdout) => {
				if (error) {
					mainWindow.webContents.send('notificationMsg', [{
						type: 'error',
						msg: `FFprobe error (getting video duration)`,
						open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
						log: error
					}]);
					return;
				}
				var output = JSON.parse(stdout);
				var fileDuration = output.streams[0].duration;
				videoFiles[gridnum] = {};
				videoFiles[gridnum].duration = fileDuration;
				videoFiles[gridnum].path = filePath;

				// Check if updating video of default grid and update mainConfig
				parseConfig('get', 'main', false, function (configData) {
					if (configData !== undefined) {
						if (configData.defaultVideoGridNum === gridnum) {
							configData.defaultVideo = filePath;
							configData.defaultVideoDuration = fileDuration;
							parseConfig('set', 'main', configData);
						}
					}
				});

				// Check thumbnail directory exists if not create
				var thumbnailPath = `${app.getPath('userData')}\\thumbnails`;
				fs.access(thumbnailPath, fs.F_OK, function (err) {
					if (err) {
						fs.mkdir(thumbnailPath, '0777', function (error) {
							if (error) {
								mainWindow.webContents.send('notificationMsg', [{
									type: 'error',
									msg: `Could not create thumbnails directory`,
									open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
									log: error
								}]);
								return;
							}
						});
					}
					// Generate thumbnail at half way point
					var execThumbnail = require('child_process');

					execThumbnail = execThumbnail.execFile;
					var sstime = fileDuration / 2;
					var args = `-ss ${sstime} -y -i`;
					args = args.split(' ');
					args.push(filePath);
					var args2 = `-vframes 1 -q:v 2`;
					args2 = args2.split(' ');
					args2.push(`${thumbnailPath}\\${path.parse(filePath).name}.jpg`);
					args = args.concat(args2);
					execThumbnail(ffmpeg.path, args, error => {
						if (error) {
							mainWindow.webContents.send('notificationMsg', [{
								type: 'error',
								msg: `FFmpeg error (generating thumbnail)`,
								open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
								log: error
							}]);
							return;
						}
						// Update videoFiles config
						parseConfig('set', 'videoFiles', videoFiles, function () {
							if (lastFile) {
								getDetails(initialGrid);
							}
						});
					});
				});
			});
		});
	});
}

exports.selectAttractScreenFile = function () {
	getGamePath(function (data) {
		var options = {
			filters: [{
				name: 'AttractScreens.mp4',
				extensions: ['mp4']
			}],
			properties: ['openFile']
		};
		if (data !== false) {
			options.defaultPath = `${data}\\NewRetroArcade\\Content\\Movies`;
		}
		dialog.showOpenDialog(mainWindow, options, function (response) {
			if (response !== undefined) {
				fs.access(response[0], fs.constants.R_OK, function (error) {
					if (error) {
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: `Could not read file: ${response[0]}`,
							open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
							log: error
						}]);
						return;
					}
					parseConfig('get', 'main', false, function (configData) {
						if (configData !== undefined) {
							configData.attractScreenPath = response[0];
							parseConfig('set', 'main', configData, function () {
								mainWindow.webContents.send('attractScreenSet', true);
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
};

exports.deleteVideo = function (gridnum) {
	var choice = dialog.showMessageBox(
mainWindow, {
	type: 'question',
	buttons: ['Yes', 'No'],
	title: 'Confirm',
	message: `Are you sure you want to delete?`
});
	if (choice === 0) {
		parseConfig('get', 'videoFiles', false, function (data) {
			if (data !== undefined) {
				const videoFiles = data;
				var thumbnailFilePath =	videoFiles[gridnum].path;
				delete videoFiles[gridnum];
				parseConfig('set', 'videoFiles', videoFiles, function () {
					parseConfig('get', 'main', false, function (mainConfig) {
						if (mainConfig.defaultVideoGridNum === gridnum) {
							delete mainConfig.defaultVideoDuration;
							delete mainConfig.defaultVideoGridNum;
							delete mainConfig.defaultVideo;
						}
						parseConfig('set', 'main', mainConfig, function () {
							getDefaultVideo();
							var filePath = `${app.getPath('userData')}\\thumbnails\\${path.parse(thumbnailFilePath).name}.jpg`;
							fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK, function (error) {
								if (error) {
									mainWindow.webContents.send('notificationMsg', [{
										type: 'error',
										msg: `Could not read/write file: ${filePath}`,
										open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
										log: error
									}]);
									return;
								}
								fs.unlink(filePath);
								mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
								getDetails(gridnum);
							});
						});
					});
				});
			}
		});
	}
};

exports.renderVideo = function () {
	parseConfig('get', 'main', false, function (configData) {
		if (configData !== undefined) {
			var defaultVideo = configData.defaultVideo;
			var defaultVideoDuration = configData.defaultVideoDuration;
			var attractScreenPath = configData.attractScreenPath;
			var renderScale;
			var totalVideos;
			if (configData.renderScale === undefined) {
				renderScale = '256:192';
			} else {
				renderScale = configData.renderScale;
			}
			if (configData.extraCabinets === true) {
				totalVideos = 35;
			} else {
				totalVideos = 30;
			}
			var muteAudio = configData.muteAudio;
			var generateReport = configData.generateReport;
			var encoder;
			if (configData.encoder === undefined) {
				encoder = 'libx264';
			} else {
				switch (configData.encoder) {
					case 'h264_nvenc':
						encoder = 'h264_nvenc -pixel_format yuv444p -preset lossless';
						break;
					case 'h264_qsv':
						encoder = 'h264_qsv -pixel_format qsv -preset:v medium';
						break;
					default:
						encoder = 'libx264';
				}
			}
			var hwaccel;
			if (configData.hwaccel === true) {
				hwaccel = '-hwaccel auto -i';
			} else {
				hwaccel = '-i';
			}
			parseConfig('get', 'videoFiles', false, function (videoFiles) { // eslint-disable-line complexity
				if (videoFiles[0] === undefined) {
					mainWindow.webContents.send('render', ['end', true]);
					mainWindow.webContents.send('notificationMsg', [{
						type: 'error',
						msg: `Grid 1 must be set - click to clear this message`
					}]);
					return false;
				}
				if (videoFiles !== undefined) {
					if (Object.keys(videoFiles).length < totalVideos) {
						// If no default video set use first videoFiles
						if (defaultVideo === undefined) {
							defaultVideo = videoFiles[0].path;
						}
						if (defaultVideoDuration === undefined) {
							defaultVideoDuration = videoFiles[0].duration;
						}
					}
					// Set totalTile to longest videoFiles
					var videoDurations = [];
					for (var prop in videoFiles) {
						if ({}.hasOwnProperty.call(videoFiles, prop)) {
							videoDurations.push(videoFiles[prop].duration);
						}
					}
					var videoDurationsSorted = [];
					for (var duration in videoDurations) {
						if ({}.hasOwnProperty.call(videoDurations, duration)) {
							videoDurationsSorted.push([duration, videoDurations[duration]]);
						}
					}
					videoDurationsSorted.sort(function (a, b) {
						return a[1] - b[1];
					}
);
					// Cannot sort descending so select last item in object
					var totalTime = videoDurationsSorted[Object.keys(videoFiles).length - 1][1];

					if ((configData.maxDuration !== undefined && configData.maxDuration !== false) && configData.maxDuration <= totalTime) {
						totalTime = configData.maxDuration;
					}

					for (var i = 0; i < totalVideos; i++) {
						// Generate xlist.txt
						var listFileLine = '';
						var divison;
						if (videoFiles[i] === undefined) {
							divison = Math.ceil(totalTime / defaultVideoDuration);
							for (var ii = 0; ii < divison; ii++) {
								listFileLine += `file '${defaultVideo}'\r\n`;
							}
							fs.writeFileSync(`${app.getPath('temp')}\\${i}list.txt`, listFileLine);
						} else {
							divison = Math.ceil(totalTime / videoFiles[i].duration);
							for (let ii = 0; ii < divison; ii++) {
								listFileLine += `file '${videoFiles[i].path}'\r\n`;
							}
							fs.writeFileSync(`${app.getPath('temp')}\\${i}list.txt`, listFileLine);
						}
					}

					// Extract Audio
					getGamePath(function (gamePath) {
						if (gamePath !== false) {
							var audioFilePath = `${gamePath}\\NewRetroArcade\\Content\\Roms`;
							for (let i = 0; i < totalVideos; i++) {
								if (videoFiles[i] !== undefined) {
								// Does video contain audio stream
									videoContainsAudio(videoFiles[i].path, i, function (data) { // eslint-disable-line no-loop-func
										if (data[0] === true) {
											var args = [];
											args.push('-i');
											args.push(data[1]);
											if (generateReport === true) {
												args.push('-report');
											}
											var argString = `-y -vn -q:a 0 -map a`.split(' ');
											args = args.concat(argString);
											args.push(`${audioFilePath}\\${path.parse(data[1]).name}.mp3`);
										// Extract Audio
											var execFile = require('child_process');

											execFile = execFile.execFile;
											execFile(ffmpeg.path, args, error => {
												if (error) {
													mainWindow.webContents.send('notificationMsg', [{
														type: 'error',
														msg: `Extract audio failed: ${data[1]}`,
														open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
														log: error
													}]);
													return;
												}
											});
										}
									});
								}
							}
						}
					});

					mainWindow.webContents.send('render', ['start']);
					var listCommand = '';
					var scaleCommand = '';
					var hstackCommand = '';
					var rowCommand = '';
					var execCommandTmp = '';
					var elaspedTimeSecs = '';
					var args = [];
					for (i = 0; i < totalVideos; i++) {
						listCommand += ` -f concat -safe 0 ${hwaccel} ${app.getPath('temp')}\\${i}list.txt`;
						scaleCommand += ` [${i}:v]scale=${renderScale} [tmp${i}];`;
					}
					args = listCommand.trim().split(' ');

					args.push('-filter_complex');
					execCommandTmp = `${scaleCommand.trim()}`;
					var rowCount = 0;
					for (let i = 1; i < totalVideos + 1; i++) {
						hstackCommand += `[tmp${i - 1}]`;
						if ((i % 5) === 0 && i !== 0) {
							hstackCommand += `hstack=inputs=5[row${rowCount++}]; `;
						}
					}
					execCommandTmp += hstackCommand;
					for (let i = 0; i < rowCount; i++) {
						rowCommand += `[row${i}]`;
						if (i === rowCount - 1) {
							rowCommand += ` vstack=inputs=${rowCount}`;
						}
					}
					execCommandTmp += ` ${rowCommand}`;
					args.push(execCommandTmp.trim());
					if (generateReport === true) {
						args.push('-report');
					}
					args.push('-t');
					args.push(totalTime);
					args.push('-an');
					args.push('-y');
					args.push('-c:v');
					args = args.concat(encoder.split(' '));
					args.push(attractScreenPath);

					var spawn = require('child_process');

					spawn = spawn.spawn;
					const ffmpegProcess = spawn(ffmpeg.path, args);
					app.on('window-all-closed', function () {
						ffmpegProcess.kill();
					});

					ffmpegProcess.stderr.on('data', data => {
						var re = /time=(.*?) bitrate=/;
						var elaspedTime = re.exec(data);
						if (elaspedTime !== null) {
							var hh;
							var mm;
							var ss;
							[hh, mm, ss] = elaspedTime[1].split(':');
							elaspedTimeSecs = Math.round(ss);
							if (mm !== undefined) {
								elaspedTimeSecs += mm * 60;
							}

							if (hh !== undefined) {
								elaspedTimeSecs += hh * 60 * 60;
							}
							var progress = elaspedTimeSecs / totalTime;
							mainWindow.webContents.send('renderProgress', [elaspedTimeSecs, progress]);
						}
					});
					ffmpegProcess.on('error', error => {
						mainWindow.webContents.send('render', ['end']);
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: 'Render failed - please enable reporting in settings then retry and create an issue with this report on <a href="https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues" target="_blank">Github</a>',
							open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
							log: error
						}]);
						return;
					});

					ffmpegProcess.on('close', code => {
						// Cleanup xlist.txt
						for (var i = 0; i < totalVideos; i++) {
							fs.unlinkSync(`${app.getPath('temp')}\\${i}list.txt`);
						}
						if (code === 0) {
							if (elaspedTimeSecs !== null) {
								var minutes = Math.floor(elaspedTimeSecs / 60);
								var seconds = elaspedTimeSecs % 60;
								var finalTime = strPadLeft(minutes, '0', 2) + ':' + strPadLeft(seconds, '0', 2);
							}
							if (!muteAudio) {
								mainWindow.webContents.executeJavaScript(`
									var audio = new Audio('media/success.ogg');
									audio.play();
								`);
							}
							mainWindow.webContents.send('render', ['end']);
							mainWindow.webContents.send('notificationMsg', [{
								type: 'success',
								msg: `Render completed in ${finalTime}`,
								delay: 6000
							}]);
						} else {
							mainWindow.webContents.send('render', ['end', true]);
							mainWindow.webContents.send('notificationMsg', [{
								type: 'error',
								msg: 'Render failed - please enable reporting in settings then retry and create an issue with this report on <a href="https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues" target="_blank">Github</a>',
								open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
								log: `Render error: exit code ${code}`
							}]);
						}
					});
				}
			});
		}
	});
};

exports.defaultVideo = function (gridnum) {
	parseConfig('get', 'videoFiles', false, function (data) {
		if (data[gridnum] !== undefined) {
			var defaultVideo = data[gridnum].path;
		}
		parseConfig('get', 'main', false, function (data) {
			if (data !== undefined) {
				var mainConfig = data;
				mainConfig.defaultVideo = defaultVideo;
				mainConfig.defaultVideoGridNum = gridnum;

				var executablePath = ffprobe.path;
				var args = `-v error -select_streams v:0 -of json -show_entries stream=width,height,duration`;
				args = args.split(' ');
				args.push(defaultVideo);
				var exec = require('child_process');

				exec = exec.execFile;
				exec(executablePath, args, (error, stdout) => {
					if (error) {
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: `FFprobe error (getting default video duration)`,
							open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
							log: error
						}]);
						return;
					}
					var output = JSON.parse(stdout);
					mainConfig.defaultVideoDuration = output.streams[0].duration;
					parseConfig('set', 'main', mainConfig, function () {
						getDefaultVideo();
					});
				});
			}
		});
	});
};

exports.unsetDefaultVideo = function (gridnum) {
	parseConfig('get', 'main', false, function (mainConfig) {
		if (mainConfig.defaultVideoGridNum === gridnum) {
			delete mainConfig.defaultVideoDuration;
			delete mainConfig.defaultVideoGridNum;
			delete mainConfig.defaultVideo;
		}
		parseConfig('set', 'main', mainConfig, function () {
			getDefaultVideo();
		});
	});
};

exports.switchPage = function (page) {
	switch (page) {
		case 'about':
			mainWindow.loadURL(`file://${__dirname}/about/index.html`);
			break;
		case 'main':
			mainWindow.loadURL(`file://${__dirname}/index.html`);
			getDetails(0);
			getDefaultVideo();
			break;
		case 'reorder':
			mainWindow.loadURL(`file://${__dirname}/reorder/index.html`);
			break;
		case 'settings':
			mainWindow.loadURL(`file://${__dirname}/config/index.html`);
			break;
		default:
			mainWindow.loadURL(`file://${__dirname}/index.html`);
			getDetails(0);
			getDefaultVideo();
			break;
	}
};

exports.updateSettings = function (settings) {
	parseConfig('get', 'main', false, function (mainConfig) {
		if (mainConfig !== undefined) {
			mainConfig[settings[0]] = settings[1];
			parseConfig('set', 'main', mainConfig, function () {
				if (settings[0] === 'attractScreenPath') {
					mainWindow.webContents.send('attractScreenSet', true);
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
};

exports.quitApp = function () {
	app.quit();
};

exports.changeGrid = function (gridnum) {
	getDetails(gridnum);
	getDefaultVideo();
};

function getDefaultVideo() {
	parseConfig('get', 'main', false, function (data) {
		if (data !== undefined) {
			mainWindow.webContents.send('defaultVideo', data.defaultVideoGridNum);
		}
	});
}

function getDetails(gridnum) {
	parseConfig('get', 'videoFiles', false, function (data) {
		var videoFiles;
		if (Object.keys(data).length > 0) {
			videoFiles = data;
		} else {
			videoFiles = {};
		}
		if (Object.keys(videoFiles).length === 0) {
			mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
			mainWindow.webContents.send('gridDetails', [false, '']);
			mainWindow.webContents.send('screenStatus', 'Video not set');
			return;
		} else if (videoFiles[gridnum] === undefined) {
			mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
			mainWindow.webContents.send('gridDetails', [false, '']);
			mainWindow.webContents.send('screenStatus', 'Video not set');
			return;
		}
		var thumbnailPath = `${app.getPath('userData')}\\thumbnails`;
		var fullPath = `${thumbnailPath}\\${path.parse(data[gridnum].path).name}.jpg`;
		var thumbnailImagePath = fullPath;

		fs.access(thumbnailImagePath, fs.constants.R_OK, err => {
			if (err) {
				mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
				mainWindow.webContents.send('screenStatus', 'Thumbnail missing');
			} else {
				mainWindow.webContents.send('thumbnailImage', [thumbnailImagePath]);
				mainWindow.webContents.send('screenStatus', false);
			}
		});

		// If video file exists
		var filePath = videoFiles[gridnum].path;
		fs.access(filePath, fs.constants.R_OK, err => {
			if (err) {
				mainWindow.webContents.send('gridDetails', [false, `Video '${filePath}' can not be found`]);
			} else {
				var filename = filePath.replace(/^.*[\\\/]/, '');

				var execFile = require('child_process');

				execFile = execFile.execFile;
				var args = `-v error -select_streams v:0 -of json -show_entries format=filename:stream=duration,width,height,divx_packed,has_b_frames`;
				args = args.split(' ');
				// Path may contain spaces so push to end of array separately to avoid split
				args.push(filePath);
				execFile(ffprobe.path, args, (error, stdout) => {
					if (error) {
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: `FFprobe error (get details)`,
							open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
							log: error
						}]);
						return;
					}
					var output = JSON.parse(stdout);
					mainWindow.webContents.send('gridDetails', [filename, output.streams[0].duration, output.streams[0].width, output.streams[0].height, filePath, videoFiles[gridnum].attractVolume]);
				});
			}
		});
	});
}

exports.playVideo = function (gridnum) {
	// Get width and height of video for BrowserWindow
	parseConfig('get', 'videoFiles', false, function (data) {
		var execFile = require('child_process');

		execFile = execFile.execFile;
		var args = `-v error -select_streams v:0 -of json -show_entries stream=width,height`;
		args = args.split(' ');
		// Path may contain spaces so push to end of array separately to avoid split
		args.push(data[gridnum].path);
		if (data[gridnum].path.indexOf('.mp4') >= 0) {
			execFile(ffprobe.path, args, (error, stdout) => {
				if (error) {
					mainWindow.webContents.send('notificationMsg', [{
						type: 'error',
						msg: `FFprobe error (get video details for player)`,
						open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
						log: error
					}]);
					return;
				}
				var output = JSON.parse(stdout);

				var videoWindow = new BrowserWindow({
					width: output.width,
					height: output.height,
					frame: false,
					resizable: false,
					show: false
				});
				createWindow(videoWindow, `file://${__dirname}/video/index.html`);
				videoWindow.once('ready-to-show', () => {
					videoWindow.show();
					videoWindow.webContents.send('playVideo', [data[gridnum].path]);
				});
			});
		} else {
			// Unsupported file type
			return;
		}
	});
};

function strPadLeft(string, pad, length) {
	return (new Array(length + 1).join(pad) + string).slice(-length);
}

function parseConfig(action, configFile, configData, callback) {
	switch (action) {
		case 'get':
			storage.get(configFile, function (error, data) {
				if (error) {
					mainWindow.webContents.send('notificationMsg', [{
						type: 'error',
						msg: `Could not read from config (${configFile})`,
						open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
						log: error
					}]);
				}
				callback(data);
			});
			break;
		case 'set':
			storage.set(configFile, configData, function (error) {
				if (error) {
					mainWindow.webContents.send('notificationMsg', [{
						type: 'error',
						msg: `Could not write to config (${configFile})`,
						open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
						log: error
					}]);
				}
				if (callback && typeof (callback) === 'function') {
					callback(true);
				}
			});
			break;
		default:
	}
}

exports.parseConfigRenderer = parseConfig;

exports.availableEncoders = function (callback) {
	var requestedEncoders = {
		0: {
			id: 'libx264',
			name: 'x264 (CPU)'
		},
		1: {
			id: 'h264_nvenc',
			name: 'NVENC (Nvidia GPU)'
		},
		2: {
			id: 'h264_qsv',
			name: 'QuickSync (Intel GPU)'
		}
	};
	var availableEncoders = {};
	for (var i in requestedEncoders) {
		if ({}.hasOwnProperty.call(requestedEncoders, i)) {
			var args = `-h encoder=${requestedEncoders[i].id}`;
			args = args.split(' ');
			var execEncoders = require('child_process');

			execEncoders = execEncoders.execFileSync;
			var output = execEncoders(ffmpeg.path, args);
			output = output.toString().trim();
			if (output !== `Codec '${requestedEncoders[i].id}' is not recognized by FFmpeg.`) {
				availableEncoders[i] = {};
				availableEncoders[i].id = requestedEncoders[i].id;
				availableEncoders[i].name = requestedEncoders[i].name;
			}
		}
	}
	callback(availableEncoders);
};

function getGamePath(callback) {
	var Registry = require('winreg');

	var regKey = new Registry({
		hive: Registry.HKLM,
		key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 465780\\'
	});

	regKey.values(function (error, items) {
		if (error) {
			// registry key not found, game not installed
			callback(false);
		} else {
			// key found loop until InstallLocation and callback with value
			for (var i = 0; i < items.length; i++) {
				if (items[i].name === 'InstallLocation') {
					callback(items[i].value);
				}
			}
		}
	});
}

exports.editConfigINI = function (state) {
	var ConfigIniParser = require('config-ini-parser');

	ConfigIniParser = ConfigIniParser.ConfigIniParser;
	getGamePath(function (gamePath) {
		var delimiter = '\r\n';
		var sectionName = '/Script/ArcadeRift.ArcadeGameUserSettings';
		var parser = new ConfigIniParser(delimiter);
		fs.access(`${gamePath}\\NewRetroArcade\\Saved\\Config\\WindowsNoEditor\\GameUserSettings.ini`, fs.constants.R_OK | fs.constants.W_OK, err => {
			if (err) {
				return;
			}
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
							parser.removeOption(sectionName, 'AttractMovieLayout=(X=5.000000,Y');
							parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=7.000000)');
						} else {
							parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=7.000000)');
						}
						break;
					case false:
					// Revert to defaults
						if (parser.isHaveOption(sectionName, 'AttractMovieLayout=(X=5.000000,Y') === true) {
							parser.removeOption(sectionName, 'AttractMovieLayout=(X=5.000000,Y');
							parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=6.000000)');
						} else {
							parser.set(sectionName, 'AttractMovieLayout', '(X=5.000000,Y=6.000000)');
						}
						break;
					default:
						break;
				}
			// Relace new line at start of file
				var config = parser.stringify(delimiter).replace(/^\r\n|\n/, '');
				fs.writeFileSync(`${gamePath}\\NewRetroArcade\\Saved\\Config\\WindowsNoEditor\\GameUserSettings.ini`, config);
			}
		});
	});
};

function updateChecker() {
	var GitHub = require('github-api');
	var semver = require('semver');
	require('pkginfo')(module, 'version'); // eslint-disable-line import/newline-after-import
	var gh = new GitHub();
	var repo = gh.getRepo('SavageCore', 'new-retro-arcade-neon-attract-screen-tool');
	repo.listReleases(function (error, releases) {
		if (error) {
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
	});
}

function videoContainsAudio(videoPath, gridnum, callback) {
	var args = [];
	args.push('-i');
	args.push(videoPath);
	var argString = `-show_streams -select_streams a -loglevel error -of json`.split(' ');
	args = args.concat(argString);
	var execFile = require('child_process');

	execFile = execFile.execFile;
	var output = execFile(ffprobe.path, args, (error, stdout) => {
		if (error) {
			mainWindow.webContents.send('notificationMsg', [{
				type: 'error',
				msg: `FFprobe - unable to determin audio stream: ${videoPath}`,
				open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
				log: error
			}]);
			callback([false, videoPath]);
		}
		output = JSON.parse(stdout);
		// var hasBarProperty = {}.hasOwnProperty.call(foo, "bar");
		if (typeof output.streams[0] !== 'undefined' && {}.hasOwnProperty.call(output.streams[0], 'index')) {
			callback([true, videoPath]);
		} else {
			callback([false, videoPath]);
		}
	});
}

exports.sortableList = function (callback) {
	parseConfig('get', 'videoFiles', false, function (videoFiles) {
		callback(videoFiles);
	});
};

exports.menuItems = function (callback) {
	var menuArr = [
		{id: 'about', glyphicon: 'info-sign', name: 'About'},
		{id: 'main', glyphicon: 'home', name: 'Main'},
		{id: 'reorder', glyphicon: 'sort-by-order', name: 'Reorder'},
		{id: 'save', glyphicon: 'save', name: 'Save'},
		{id: 'settings', glyphicon: 'cog', name: 'Settings'},
		{id: 'quit', glyphicon: 'log-out', name: 'Quit'}
	];
	callback(menuArr);
};

function searchInObj(s, obj) {
	var matches = [];
	for (var key in obj) {
		if ({}.hasOwnProperty.call(obj, key)) {
			if (obj[key].path.indexOf(s) > -1) {
				matches.push(key);
				return matches;
			}
		}
	}
	return matches;
}

exports.updateXML = function () {
	var xw = new XMLWriter();
	xw.startDocument('1.0', 'utf-8');
	xw.startElement('ArcadeMachines');
	mainWindow.webContents.executeJavaScript('$(\'#grey_back\').click()');
	getGamePath(function (arcadeMachines) {
		fs.access(`${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`, fs.constants.R_OK | fs.constants.W_OK, err => {
			if (err) {
				mainWindow.webContents.send('notificationMsg', [{
					type: 'warning',
					msg: `Unable to read/write ArcadeMachines.xml`,
					log: `Unable to read/write: ${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`
				}]);
				return;
			}
			parseConfig('get', 'videoFiles', false, function (videoFiles) {
				var xmlPath = `${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`;
				fs.createReadStream(xmlPath)
			.pipe(xmlObjects({explicitRoot: false, explicitArray: false, mergeAttrs: true}))
			.on('data', function (data) {
				for (var key in data) {
					if ({}.hasOwnProperty.call(data, key)) {
						xw.startElement(key);
						if (typeof data[key].Game !== 'undefined') {
							xw.startElement('Game');
							xw.text(data[key].Game);
							xw.endElement();
						}
						if (typeof data[key].Core !== 'undefined') {
							xw.startElement('Core');
							xw.text(data[key].Core);
							xw.endElement();
						}
						if (typeof data[key].GameVolume !== 'undefined') {
							xw.startElement('GameVolume');
							xw.text(data[key].GameVolume);
							xw.endElement();
						}
						if (typeof data[key].Game !== 'undefined') {
							var matches = searchInObj(`${path.parse(data[key].Game).name}.`, videoFiles);
							if (matches.length > 0) {
								xw.startElement('GameImage');
								xw.text(`GridFrame${Number(matches[0]) + 1}`);
								xw.endElement();
							} else	if (typeof data[key].GameImage !== 'undefined') {
								xw.startElement('GameImage');
								xw.text(data[key].GameImage);
								xw.endElement();
							}
							if (matches.length > 0) {
								xw.startElement('GameMusic');
								xw.text(`${path.parse(videoFiles[matches[0]].path).name}.mp3`);
								xw.endElement();
							} else	if (typeof data[key].GameMusic !== 'undefined') {
								xw.startElement('GameMusic');
								xw.text(data[key].GameMusic);
								xw.endElement();
							}
							if (matches.length > 0 && typeof videoFiles[matches[0]].attractVolume !== 'undefined') {
								var volume = videoFiles[matches[0]].attractVolume;
								if (videoFiles[matches[0]].attractVolume === 0) {
									volume = '0.0';
								}
								xw.startElement('GameMusicVolume');
								xw.text(volume);
								xw.endElement();
							}	else	if (typeof data[key].GameMusicVolume !== 'undefined') {
								xw.startElement('GameMusicVolume');
								xw.text(data[key].GameMusicVolume);
								xw.endElement();
							}
						} else	if (typeof data[key].GameImage !== 'undefined') {
							xw.startElement('GameImage');
							xw.text(data[key].GameImage);
							xw.endElement();
						} else	if (typeof data[key].GameMusicVolume !== 'undefined') {
							xw.startElement('GameMusicVolume');
							xw.text(data[key].GameMusicVolume);
							xw.endElement();
						}
						if (typeof data[key].ScreenType !== 'undefined') {
							xw.startElement('ScreenType');
							xw.text(data[key].ScreenType);
							xw.endElement();
						}
						if (typeof data[key].ButtonLayout !== 'undefined') {
							xw.startElement('ButtonLayout');
							xw.text(data[key].ButtonLayout);
							xw.endElement();
						}
						if (typeof data[key].ButtonColour !== 'undefined') {
							xw.startElement('ButtonColour');
							xw.writeAttribute('AB', data[key].ButtonColour.AB);
							xw.writeAttribute('XY', data[key].ButtonColour.XY);
							xw.writeAttribute('SS', data[key].ButtonColour.SS);
							xw.endElement();
						}
						if (typeof data[key].ArtFrontPanel !== 'undefined') {
							xw.startElement('ArtFrontPanel');
							if (typeof data[key].ArtFrontPanel.Colour !== 'undefined') {
								xw.writeAttribute('Colour', data[key].ArtFrontPanel.Colour);
							} else if (typeof data[key].ArtFrontPanel.Texture !== 'undefined') {
								xw.writeAttribute('Texture', data[key].ArtFrontPanel.Texture);
							}
							xw.endElement();
						}
						if (typeof data[key].ArtSidePanel !== 'undefined') {
							xw.startElement('ArtSidePanel');
							if (typeof data[key].ArtSidePanel.Colour !== 'undefined') {
								xw.writeAttribute('Colour', data[key].ArtSidePanel.Colour);
							} else if (typeof data[key].ArtSidePanel.Texture !== 'undefined') {
								xw.writeAttribute('Texture', data[key].ArtSidePanel.Texture);
							}
							xw.endElement();
						}
					}
					xw.endElement();
				}
				xw.endDocument();
				fs.writeFile(`${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`, eol.crlf(xmlfmt(xw.toString())), {encoding: 'utf-8'}, function (error) {
					if (error) {
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: `Could not write config`,
							open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
							log: error
						}]);
						return;
					}
					mainWindow.webContents.send('notificationMsg', [{
						type: 'success',
						msg: `Config saved!`
					}]);
				});
			});
			});
		});
	});
};

exports.attractVolume = function (gridnum, value) {
	parseConfig('get', 'videoFiles', false, function (videoFiles) {
		videoFiles[gridnum].attractVolume = Number(value);
		parseConfig('set', 'videoFiles', videoFiles);
	});
};
