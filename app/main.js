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
const makeDir = require('make-dir');

let mainWindow;

app.on('ready', async () => {
	// Check for game installation path / first run
	// Need to set muteAudio default here so it can be correctly toggled by user in settings
	const mainConfig = await parseConfig('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
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
	mainWindow.webContents.openDevTools({mode: 'detach'});
});

app.on('window-all-closed', () => {
	app.quit();
});

function createWindow(BrowserWindow, url) {
	BrowserWindow.loadURL(url);

	BrowserWindow.webContents.on('new-window', (e, url) => {
		e.preventDefault();
		shell.openExternal(url);
	});

	BrowserWindow.on('closed', () => {
		BrowserWindow = null;
	});
}

exports.selectVideoFile = function (gridNum) {
	dialog.showOpenDialog(mainWindow, {
		filters: [{
			name: 'Video',
			extensions: ['*']
		}],
		properties: ['openFile', 'multiSelections']
	}, async response => {
		if (response !== undefined) {
			const mainConfig = await parseConfig('get', 'main', false)
				.catch(err => {
					console.error(err);
				});
			let totalVideos;
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
			const initialGrid = gridNum;
			let initialNum = gridNum;
			for (let i = 0; i < response.length; i++) {
				mainWindow.webContents.executeJavaScript(`$('<div class="block-overlay"></div>').appendTo('body');`);
				let lastFile = false;
				gridNum = initialNum++;
				if (i === response.length - 1 || response.length === 1) {
					lastFile = true;
				}
				if (lastFile) {
					mainWindow.webContents.executeJavaScript(`$(".block-overlay").remove();`);
				}
				// Run function
				saveVideoFile(gridNum, response[i], initialGrid, lastFile)
					.catch(err => {
						console.error(err);
					});
			}
		}
	});
};

function saveVideoFile(gridNum, filePath, initialGrid, lastFile) {
	const sanitize = require('pretty-filename');
	return new Promise((resolve, reject) => {
		// Sanitize filePath
		const dirPath = path.dirname(filePath);
		const baseName = sanitize(path.basename(filePath));
		// If different then rename the file
		if (path.relative(filePath, `${dirPath}\\${baseName}`).length > 0) {
			fs.renameSync(filePath, `${dirPath}\\${baseName}`);
			filePath = `${dirPath}\\${baseName}`;
		}

		// Check file read access
		fs.access(filePath, fs.constants.R_OK, async error => {
			if (error) {
				mainWindow.webContents.send('notificationMsg', [{
					type: 'error',
					msg: `Could not read file: ${filePath}`,
					open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
					log: error
				}]);
				reject(new Error(`Could not read file: ${filePath}`));
			}
			let videoFiles = await parseConfig('get', 'videoFiles', false)
				.catch(err => {
					reject(new Error(err));
				});
			if (!videoFiles) {
				videoFiles = {};
			}
			// Get video duration
			let args = `-v error -select_streams v:0 -of json -show_entries stream=duration`;
			args = args.split(' ');
			args.push(filePath);
			let execInfo = require('child_process');

			execInfo = execInfo.execFile;
			execInfo(ffprobe.path, args, async (error, stdout) => {
				if (error) {
					mainWindow.webContents.send('notificationMsg', [{
						type: 'error',
						msg: `FFprobe error (getting video duration)`,
						open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
						log: error
					}]);
					reject(new Error(`FFprobe error (getting video duration)`));
				}
				const output = JSON.parse(stdout);
				const fileDuration = output.streams[0].duration;
				videoFiles[gridNum] = {};
				videoFiles[gridNum].duration = fileDuration;
				videoFiles[gridNum].path = filePath;

				// Check if updating video of default grid and update mainConfig
				const configData = await parseConfig('get', 'main', false)
					.catch(err => {
						reject(new Error(err));
					});
				if (configData !== undefined) {
					if (configData.defaultVideoGridNum === gridNum) {
						configData.defaultVideo = filePath;
						configData.defaultVideoDuration = fileDuration;
						await parseConfig('set', 'main', configData)
							.catch(err => {
								reject(new Error(err));
							});
					}
				}

				// Check thumbnail directory exists if not create
				const thumbnailPath = await makeDir(`${app.getPath('userData')}\\thumbnails`);
				console.log(thumbnailPath);

				// Generate thumbnail at half way point
				let execThumbnail = require('child_process');

				execThumbnail = execThumbnail.execFile;
				const sstime = fileDuration / 2;
				let args = `-ss ${sstime} -y -i`;
				args = args.split(' ');
				args.push(filePath);
				if (configData.generateReport === true) {
					args.push('-report');
				}
				let args2 = `-vframes 1 -q:v 2`;
				args2 = args2.split(' ');
				args2.push(`${thumbnailPath}\\${path.parse(filePath).name}.jpg`);
				args = args.concat(args2);
				execThumbnail(ffmpeg.path, args, async error => {
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
					await parseConfig('set', 'videoFiles', videoFiles)
						.catch(err => {
							console.error(err);
						});
					if (lastFile) {
						getDetails(initialGrid);
					}
				});
			});
		});
	});
}

exports.selectAttractScreenFile = async function () {
	const gamePath = await getGamePath()
		.catch(err => {
			console.error(err);
			return false;
		});
	const options = {
		filters: [{
			name: 'AttractScreens.mp4',
			extensions: ['mp4']
		}],
		properties: ['openFile']
	};
	if (gamePath) {
		options.defaultPath = `${gamePath}\\NewRetroArcade\\Content\\Movies`;
	}
	dialog.showOpenDialog(mainWindow, options, response => {
		if (response !== undefined) {
			fs.access(response[0], fs.constants.R_OK, async error => {
				if (error) {
					mainWindow.webContents.send('notificationMsg', [{
						type: 'error',
						msg: `Could not read file: ${response[0]}`,
						open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
						log: error
					}]);
					return;
				}
				const configData = await parseConfig('get', 'main', false)
					.catch(err => {
						console.error(err);
					});
				if (configData !== undefined) {
					[configData.attractScreenPath] = response;
					await parseConfig('set', 'main', configData)
						.catch(err => {
							console.error(err);
						});
					mainWindow.webContents.send('attractScreenSet', true);
					mainWindow.webContents.send('notificationMsg', [{
						type: 'success',
						msg: `Attract Screen Set!`
					}]);
				}
			});
		}
	});
};

exports.deleteVideo = async function (gridNum) {
	const choice = dialog.showMessageBox(
		mainWindow, {
			type: 'question',
			buttons: ['Yes', 'No'],
			title: 'Confirm',
			message: `Are you sure you want to delete?`
		});
	if (choice === 0) {
		const videoFiles = await parseConfig('get', 'videoFiles', false)
			.catch(err => {
				console.error(err);
			});
		if (videoFiles) {
			const thumbnailFilePath = videoFiles[gridNum].path;
			delete videoFiles[gridNum];
			await parseConfig('set', 'videoFiles', videoFiles)
				.catch(err => {
					console.error(err);
				});
			const mainConfig = await parseConfig('get', 'main', false)
				.catch(err => {
					console.error(err);
				});
			if (mainConfig.defaultVideoGridNum === gridNum) {
				delete mainConfig.defaultVideoDuration;
				delete mainConfig.defaultVideoGridNum;
				delete mainConfig.defaultVideo;
			}
			await parseConfig('set', 'main', mainConfig)
				.catch(err => {
					console.error(err);
				});
			getDefaultVideo();
			const filePath = `${app.getPath('userData')}\\thumbnails\\${path.parse(thumbnailFilePath).name}.jpg`;
			fs.access(filePath, fs.constants.R_OK | fs.constants.W_OK, error => {
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
				getDetails(gridNum);
			});
		}
	}
};

exports.renderVideo = async function () { // eslint-disable-line complexity
	const configData = await parseConfig('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
	if (configData !== undefined) {
		let {defaultVideo} = configData;
		let {defaultVideoDuration} = configData;
		const {attractScreenPath} = configData;
		let renderScale;
		let totalVideos;
		if (configData.renderScale === undefined) {
			renderScale = '256:192';
		} else {
			({renderScale} = configData);
		}
		if (configData.extraCabinets === true) {
			totalVideos = 35;
		} else {
			totalVideos = 30;
		}
		const {muteAudio} = configData;
		const {generateReport} = configData;
		let encoder;
		if (configData.encoder === undefined) {
			encoder = 'libx264';
		} else {
			switch (configData.encoder) {
				case 'h264_nvenc':
					encoder = 'h264_nvenc -pixel_format yuv444p -preset lossless';
					break;
				case 'h264_qsv':
					encoder = 'h264_qsv -pixel_format qsv -b:v 6M -look_ahead 0';
					break;
				default:
					encoder = 'libx264';
			}
		}
		let hwaccel;
		if (configData.hwaccel === true) {
			hwaccel = '-hwaccel auto -i';
		} else {
			hwaccel = '-i';
		}
		const videoFiles = await parseConfig('get', 'videoFiles', false)
			.catch(err => {
				console.error(err);
			});
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
			const videoDurations = [];
			for (const prop in videoFiles) {
				if ({}.hasOwnProperty.call(videoFiles, prop)) {
					videoDurations.push(videoFiles[prop].duration);
				}
			}
			const videoDurationsSorted = [];
			for (const duration in videoDurations) {
				if ({}.hasOwnProperty.call(videoDurations, duration)) {
					videoDurationsSorted.push([duration, videoDurations[duration]]);
				}
			}
			videoDurationsSorted.sort((a, b) => {
				return a[1] - b[1];
			});
			// Cannot sort descending so select last item in object
			let totalTime = videoDurationsSorted[Object.keys(videoFiles).length - 1][1]; // eslint-disable-line prefer-destructuring

			if ((configData.maxDuration !== undefined && configData.maxDuration !== false) && configData.maxDuration <= totalTime) {
				totalTime = configData.maxDuration;
			}

			for (let i = 0; i < totalVideos; i++) {
				// Generate xlist.txt
				let listFileLine = '';
				let divison;
				if (videoFiles[i] === undefined) {
					divison = Math.ceil(totalTime / defaultVideoDuration);
					for (let ii = 0; ii < divison; ii++) {
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
			const gamePath = await getGamePath()
				.catch(err => {
					console.error(err);
					return false;
				});
			const audioFilePath = `${gamePath}\\NewRetroArcade\\Content\\Arcades`;
			for (let i = 0; i < totalVideos; i++) {
				if (videoFiles[i] !== undefined) {
					// Does video contain audio stream
					videoContainsAudio(videoFiles[i].path, i, data => { // eslint-disable-line no-loop-func
						if (data[0] === true) {
							let args = [];
							args.push('-i');
							args.push(data[1]);
							if (generateReport === true) {
								args.push('-report');
							}
							const argString = `-y -vn -q:a 0 -map a`.split(' ');
							args = args.concat(argString);
							args.push(`${audioFilePath}\\${path.parse(data[1]).name}.mp3`);
							// Extract Audio
							let execFile = require('child_process');

							({execFile} = execFile);
							execFile(ffmpeg.path, args, error => {
								if (error) {
									mainWindow.webContents.send('notificationMsg', [{
										type: 'error',
										msg: `Extract audio failed: ${data[1]}`,
										open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
										log: error
									}]);
								}
							});
						}
					});
				}
			}

			mainWindow.webContents.send('render', ['start']);
			let listCommand = '';
			let scaleCommand = '';
			let hstackCommand = '';
			let rowCommand = '';
			let execCommandTmp = '';
			let elaspedTimeSecs = '';
			let args = [];
			for (let i = 0; i < totalVideos; i++) {
				listCommand += ` -f concat -safe 0 ${hwaccel} ${app.getPath('temp')}\\${i}list.txt`;
				scaleCommand += ` [${i}:v]scale=${renderScale} [tmp${i}];`;
			}
			args = listCommand.trim().split(' ');

			args.push('-filter_complex');
			execCommandTmp = `${scaleCommand.trim()}`;
			let rowCount = 0;
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

			let spawn = require('child_process');

			({spawn} = spawn);
			const ffmpegProcess = spawn(ffmpeg.path, args);
			app.on('window-all-closed', () => {
				ffmpegProcess.kill();
			});

			ffmpegProcess.stderr.on('data', data => {
				const re = /time=(.*?) bitrate=/;
				const elaspedTime = re.exec(data);
				if (elaspedTime !== null) {
					const [hh, mm, ss] = elaspedTime[1].split(':');
					elaspedTimeSecs = Math.round(ss);
					if (mm !== undefined) {
						elaspedTimeSecs += mm * 60;
					}

					if (hh !== undefined) {
						elaspedTimeSecs += hh * 60 * 60;
					}
					const progress = elaspedTimeSecs / totalTime;
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
			});

			ffmpegProcess.on('close', code => {
				let finalTime;
				// Cleanup xlist.txt
				for (let i = 0; i < totalVideos; i++) {
					fs.unlinkSync(`${app.getPath('temp')}\\${i}list.txt`);
				}
				if (code === 0) {
					if (elaspedTimeSecs !== null) {
						const minutes = Math.floor(elaspedTimeSecs / 60);
						const seconds = elaspedTimeSecs % 60;
						finalTime = strPadLeft(minutes, '0', 2) + ':' + strPadLeft(seconds, '0', 2);
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
					fs.access(attractScreenPath, fs.constants.W_OK, err => {
						mainWindow.webContents.send('render', ['end']);
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: `Could not write to Attract Screen Path`,
							delay: 6000,
							log: err
						}]);
						return false;
					});
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
	}
};

exports.defaultVideo = async function (gridNum) {
	const videoFiles = await parseConfig('get', 'videoFiles', false)
		.catch(err => {
			console.error(err);
		});
	let defaultVideo;
	if (videoFiles[gridNum] !== undefined) {
		defaultVideo = videoFiles[gridNum].path;
	}
	const mainConfig = await parseConfig('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
	mainConfig.defaultVideo = defaultVideo;
	mainConfig.defaultVideoGridNum = gridNum;

	const executablePath = ffprobe.path;
	let args = `-v error -select_streams v:0 -of json -show_entries stream=width,height,duration`;
	args = args.split(' ');
	args.push(defaultVideo);
	let exec = require('child_process');

	exec = exec.execFile;
	exec(executablePath, args, async (error, stdout) => {
		if (error) {
			mainWindow.webContents.send('notificationMsg', [{
				type: 'error',
				msg: `FFprobe error (getting default video duration)`,
				open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
				log: error
			}]);
			return;
		}
		const output = JSON.parse(stdout);
		mainConfig.defaultVideoDuration = output.streams[0].duration;
		await parseConfig('set', 'main', mainConfig)
			.catch(err => {
				console.error(err);
			});
		getDefaultVideo();
	});
};

exports.unsetDefaultVideo = async function (gridNum) {
	const mainConfig = await parseConfig('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
	if (mainConfig.defaultVideoGridNum === gridNum) {
		delete mainConfig.defaultVideoDuration;
		delete mainConfig.defaultVideoGridNum;
		delete mainConfig.defaultVideo;
	}
	await parseConfig('set', 'main', mainConfig)
		.catch(err => {
			console.error(err);
		});
	getDefaultVideo();
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

exports.updateSettings = async function (settings) {
	const mainConfig = await parseConfig('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
	if (mainConfig !== undefined) {
		mainConfig[settings[0]] = settings[1]; // eslint-disable-line prefer-destructuring
		await parseConfig('set', 'main', mainConfig)
			.catch(err => {
				console.error(err);
			});
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
	}
};

exports.quitApp = function () {
	app.quit();
};

exports.changeGrid = function (gridNum) {
	getDetails(gridNum);
	getDefaultVideo();
};

async function getDefaultVideo() {
	const mainConfig = await parseConfig('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
	if (mainConfig !== undefined) {
		mainWindow.webContents.send('defaultVideo', mainConfig.defaultVideoGridNum);
	}
}

async function getDetails(gridNum) {
	let videoFiles = await parseConfig('get', 'videoFiles', false)
		.catch(err => {
			console.error(err);
		});
	if (!videoFiles) {
		videoFiles = {};
	}
	if (Object.keys(videoFiles).length === 0) {
		mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
		mainWindow.webContents.send('gridDetails', [false, '']);
		mainWindow.webContents.send('screenStatus', 'Video not set');
		return;
	}
	if (videoFiles[gridNum] === undefined) {
		mainWindow.webContents.send('thumbnailImage', ['media\\blank.png']);
		mainWindow.webContents.send('gridDetails', [false, '']);
		mainWindow.webContents.send('screenStatus', 'Video not set');
		return;
	}
	const thumbnailPath = `${app.getPath('userData')}\\thumbnails`;
	const fullPath = `${thumbnailPath}\\${path.parse(videoFiles[gridNum].path).name}.jpg`;
	const thumbnailImagePath = fullPath;

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
	const filePath = videoFiles[gridNum].path;
	fs.access(filePath, fs.constants.R_OK, err => {
		if (err) {
			mainWindow.webContents.send('gridDetails', [false, `Video '${filePath}' can not be found`]);
		} else {
			const filename = filePath.replace(/^.*[\\/]/, '');

			let execFile = require('child_process');

			({execFile} = execFile);
			let args = `-v error -select_streams v:0 -of json -show_entries format=filename:stream=duration,width,height,divx_packed,has_b_frames`;
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
				const output = JSON.parse(stdout);
				mainWindow.webContents.send('gridDetails', [filename, output.streams[0].duration, output.streams[0].width, output.streams[0].height, filePath, videoFiles[gridNum].attractVolume]);
			});
		}
	});
}

exports.playVideo = async function (gridNum) {
	// Get width and height of video for BrowserWindow
	const videoFiles = await parseConfig('get', 'videoFiles', false)
		.catch(err => {
			console.error(err);
		});
	let execFile = require('child_process');

	({execFile} = execFile);
	let args = `-v error -select_streams v:0 -of json -show_entries stream=width,height`;
	args = args.split(' ');
	// Path may contain spaces so push to end of array separately to avoid split
	args.push(videoFiles[gridNum].path);
	if (videoFiles[gridNum].path.indexOf('.mp4') >= 0) {
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
			const output = JSON.parse(stdout);

			const videoWindow = new BrowserWindow({
				width: output.width,
				height: output.height,
				frame: false,
				resizable: false,
				show: false
			});
			createWindow(videoWindow, `file://${__dirname}/video/index.html`);
			videoWindow.once('ready-to-show', () => {
				videoWindow.show();
				videoWindow.webContents.send('playVideo', [videoFiles[gridNum].path]);
			});
		});
	} else {
		console.error('Unsupported file type');
	}
};

function strPadLeft(string, pad, length) {
	return (new Array(length + 1).join(pad) + string).slice(-length);
}

function parseConfig(action, configFile, configData) {
	return new Promise((resolve, reject) => {
		switch (action) {
			case 'get':
				storage.get(configFile, (error, data) => {
					if (error) {
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: `Could not read from config (${configFile})`,
							open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
							log: error
						}]);
						reject(new Error(`Could not read from config (${configFile})`));
					}
					resolve(data);
				});
				break;
			case 'set':
				storage.set(configFile, configData, error => {
					if (error) {
						mainWindow.webContents.send('notificationMsg', [{
							type: 'error',
							msg: `Could not write to config (${configFile})`,
							open: 'https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues',
							log: error
						}]);
						reject(new Error(`Could not write to config (${configFile})`));
					}
					resolve(true);
				});
				break;
			default:
		}
	});
}

exports.parseConfigRenderer = parseConfig;

exports.availableEncoders = function (callback) {
	const requestedEncoders = {
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
	const availableEncoders = {};
	for (const i in requestedEncoders) {
		if ({}.hasOwnProperty.call(requestedEncoders, i)) {
			let args = `-h encoder=${requestedEncoders[i].id}`;
			args = args.split(' ');
			let execEncoders = require('child_process');

			execEncoders = execEncoders.execFileSync;
			let output = execEncoders(ffmpeg.path, args);
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

function getGamePath() {
	const Registry = require('winreg');

	const regKey = new Registry({
		hive: Registry.HKLM,
		key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 465780\\'
	});

	return new Promise((resolve, reject) => {
		regKey.values((error, items) => {
			if (error) {
				reject(new Error('Registry key not found, game not installed'));
			} else {
				// Key found loop until InstallLocation and resolve with value
				for (let i = 0; i < items.length; i++) {
					if (items[i].name === 'InstallLocation') {
						resolve(items[i].value);
					}
				}
				reject(new Error('Registry key found, could not find InstallLocation'));
			}
		});
	});
}

exports.editConfigINI = function (state) {
	let ConfigIniParser = require('config-ini-parser');

	({ConfigIniParser} = ConfigIniParser);
	getGamePath(gamePath => {
		const delimiter = '\r\n';
		const sectionName = '/Script/ArcadeRift.ArcadeGameUserSettings';
		const parser = new ConfigIniParser(delimiter);
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
				const config = parser.stringify(delimiter).replace(/^\r\n|\n/, '');
				fs.writeFileSync(`${gamePath}\\NewRetroArcade\\Saved\\Config\\WindowsNoEditor\\GameUserSettings.ini`, config);
			}
		});
	});
};

function updateChecker() {
	const semver = require('semver');
	const request = require('request');

	const options = {
		url: 'https://api.github.com/repos/SavageCore/new-retro-arcade-neon-attract-screen-tool/releases/latest',
		headers: {
			'User-Agent': 'new-retro-arcade-neon-attract-screen-tool'
		}
	};
	request(options, (err, response, body) => {
		if (err) {
			mainWindow.webContents.send('notificationMsg', [{
				type: 'error',
				msg: `Update Check: Error - please see log`,
				log: err.toString()
			}]);
			return false;
		}
		const release = JSON.parse(body);
		if (semver.gt(release.tag_name, app.getVersion()) === true) {
			// Newer release
			mainWindow.webContents.send('notificationMsg', [{
				type: 'success',
				msg: `Update available! Click to download`,
				open: release.html_url
			}]);
		} else if (semver.diff(release.tag_name, app.getVersion()) === null) {
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
				open: release.html_url
			}]);
		}
	});
}

function videoContainsAudio(videoPath, gridNum, callback) {
	let args = [];
	args.push('-i');
	args.push(videoPath);
	const argString = `-show_streams -select_streams a -loglevel error -of json`.split(' ');
	args = args.concat(argString);
	let execFile = require('child_process');

	({execFile} = execFile);
	let output = execFile(ffprobe.path, args, (error, stdout) => {
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
		// Var hasBarProperty = {}.hasOwnProperty.call(foo, "bar");
		if (typeof output.streams[0] !== 'undefined' && {}.hasOwnProperty.call(output.streams[0], 'index')) {
			callback([true, videoPath]);
		} else {
			callback([false, videoPath]);
		}
	});
}

exports.sortableList = function () {
	return new Promise(async (resolve, reject) => {
		const videoFiles = await parseConfig('get', 'videoFiles', false)
			.catch(err => {
				reject(new Error(err));
			});
		resolve(videoFiles);
	});
};

exports.menuItems = function () {
	return new Promise(resolve => {
		const menuArr = [{
			id: 'about',
			glyphicon: 'info-sign',
			name: 'About'
		},
		{
			id: 'main',
			glyphicon: 'home',
			name: 'Main'
		},
		{
			id: 'reorder',
			glyphicon: 'sort-by-order',
			name: 'Reorder'
		},
		{
			id: 'save',
			glyphicon: 'save',
			name: 'Save'
		},
		{
			id: 'settings',
			glyphicon: 'cog',
			name: 'Settings'
		},
		{
			id: 'quit',
			glyphicon: 'log-out',
			name: 'Quit'
		}];
		resolve(menuArr);
	});
};

function searchInObj(s, obj) {
	const matches = [];
	for (const key in obj) {
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
	const xw = new XMLWriter();
	xw.startDocument('1.0', 'utf-8');
	xw.startElement('ArcadeMachines');
	mainWindow.webContents.executeJavaScript('$(\'#grey_back\').click()');
	getGamePath(arcadeMachines => {
		fs.access(`${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`, fs.constants.R_OK | fs.constants.W_OK, async err => {
			if (err) {
				mainWindow.webContents.send('notificationMsg', [{
					type: 'warning',
					msg: `Unable to read/write ArcadeMachines.xml`,
					log: `Unable to read/write: ${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`
				}]);
				return;
			}
			const videoFiles = await parseConfig('get', 'videoFiles', false)
				.catch(err => {
					console.error(err);
				});
			const xmlPath = `${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`;
			fs.createReadStream(xmlPath)
				.pipe(xmlObjects({
					explicitRoot: false,
					explicitArray: false,
					mergeAttrs: true
				}))
				.on('data', async data => { // eslint-disable-line complexity
					for (const key in data) {
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
								const matches = searchInObj(`${path.parse(data[key].Game).name}.`, videoFiles);
								if (matches.length > 0) {
									xw.startElement('GameImage');
									xw.text(`GridFrame${Number(matches[0]) + 1}`);
									xw.endElement();
								} else if (typeof data[key].GameImage !== 'undefined') {
									xw.startElement('GameImage');
									xw.text(data[key].GameImage);
									xw.endElement();
								}
								if (matches.length > 0) {
									xw.startElement('GameMusic');
									xw.text(`${path.parse(videoFiles[matches[0]].path).name}.mp3`);
									xw.endElement();
								} else if (typeof data[key].GameMusic !== 'undefined') {
									xw.startElement('GameMusic');
									xw.text(data[key].GameMusic);
									xw.endElement();
								}
								if (matches.length > 0 && typeof videoFiles[matches[0]].attractVolume !== 'undefined') {
									let volume = videoFiles[matches[0]].attractVolume;
									if (videoFiles[matches[0]].attractVolume === 0) {
										volume = '0.0';
									}
									xw.startElement('GameMusicVolume');
									xw.text(volume);
									xw.endElement();
								} else if (typeof data[key].GameMusicVolume !== 'undefined') {
									xw.startElement('GameMusicVolume');
									xw.text(data[key].GameMusicVolume);
									xw.endElement();
								}
							} else if (typeof data[key].GameImage !== 'undefined') {
								xw.startElement('GameImage');
								xw.text(data[key].GameImage);
								xw.endElement();
							} else if (typeof data[key].GameMusicVolume !== 'undefined') {
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
							xw.endElement();
						}
					}
					xw.endDocument();
					fs.writeFile(`${arcadeMachines}\\NewRetroArcade\\Content\\ArcadeMachines.xml`, eol.crlf(xmlfmt(xw.toString())), {
						encoding: 'utf-8'
					}, error => {
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
					await fs.writeFile(`${arcadeMachines}\\NewRetroArcade\\Content\\Arcades\\${data}.arcade`, 'Hello Node.js');
				});
		});
	});
};

exports.attractVolume = async function (gridNum, value) {
	const videoFiles = await parseConfig('get', 'videoFiles', false)
		.catch(err => {
			console.error(err);
		});
	videoFiles[gridNum].attractVolume = Number(value);
	await parseConfig('set', 'videoFiles', videoFiles)
		.catch(err => {
			console.error(err);
		});
};
