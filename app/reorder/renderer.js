const path = require('path');
const electron = require('electron');

const remote = electron.remote;
const mainProcess = remote.require('./main');
window.$ = window.jQuery = require('jquery'); // eslint-disable-line no-multi-assign
const Sortable = require('sortablejs');
require('pkginfo')(module, 'version');

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(() => {
	mainProcess.menuItems(data => {
		for (let i = 0; i < data.length; i++) {
			$('#menu_smartphone ul').append(`<li id="menu_${data[i].id}"><span class="glyphicon glyphicon-${data[i].glyphicon}"></span>&nbsp;${data[i].name}</li>`);
		}
		require('../menu'); // eslint-disable-line  import/no-unassigned-import
	});
	mainProcess.sortableList(data => {
		mainProcess.parseConfigRenderer('get', 'main', false, mainConfig => {
			let length;
			if (mainConfig.extraCabinets === true) {
				length = Object.keys(data).length;
			} else {
				length = 30;
			}
			for (let i = 0; i < length; i++) {
				$('#videoFiles').append(`<li class="list-group-item"><span class="badge">${i + 1}</span>${path.basename(data[i].path)}</li>`);
			}
		});
	});

	$('.bottom-bar').addClass('bottom-bar-info');
	$('.bottom-bar').html(`Version: ${module.exports.version}`);
});

const el = document.getElementById('videoFiles');
Sortable.create(el, {
	onEnd(evt) {
		switchGridPosition(evt.oldIndex, evt.newIndex);
	}
});

function switchGridPosition(from, to) {
	mainProcess.parseConfigRenderer('get', 'videoFiles', false, videoFiles => {
		let videoFilesTmp = {};
		let videoFilesArr = [];
		// Convert to array
		videoFilesArr = Object.keys(videoFiles).map(key => videoFiles[key]);
		// Move item in array
		videoFilesArr = arrayMove(videoFilesArr, from, to);
		// Convert back to Object
		videoFilesTmp = videoFilesArr.reduce((o, v, i) => {
			o[i] = v;
			return o;
		}, {});
		// Save to config
		mainProcess.parseConfigRenderer('set', 'videoFiles', videoFilesTmp, () => {
			// Check if reordering default video and update mainConfig with new gridnum
			mainProcess.parseConfigRenderer('get', 'main', false, configData => {
				if (configData !== undefined) {
					if (configData.defaultVideoGridNum === from) {
						configData.defaultVideoGridNum = to;
						mainProcess.parseConfigRenderer('set', 'main', configData);
					}
				}
			});
			// Re number the list
			let i = 1;
			$('#videoFiles li').each(function () {
				$(this)[0].firstChild.innerText = i++;
			});
		});
	});
}

function arrayMove(array, oldIndex, newIndex) {
	while (oldIndex < 0) {
		oldIndex += array.length;
	}
	while (newIndex < 0) {
		newIndex += array.length;
	}
	if (newIndex >= array.length) {
		let k = newIndex - array.length;
		while ((k--) + 1) {
			array.push(undefined);
		}
	}
	array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
	return array;
}
