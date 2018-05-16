const path = require('path');
const electron = require('electron');

const {remote} = electron;
const mainProcess = remote.require('./main');
window.$ = window.jQuery = require('jquery'); // eslint-disable-line no-multi-assign
const Sortable = require('sortablejs');
require('pkginfo')(module, 'version');

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(async () => {
	const menuItems = await mainProcess.menuItems()
		.catch(err => {
			console.error(err);
		});
	for (let i = 0; i < menuItems.length; i++) {
		$('#menu_smartphone ul').append(`<li id="menu_${menuItems[i].id}"><span class="glyphicon glyphicon-${menuItems[i].glyphicon}"></span>&nbsp;${menuItems[i].name}</li>`);
	}
	require('../menu'); // eslint-disable-line  import/no-unassigned-import
	const videoFiles = await mainProcess.sortableList()
		.catch(err => {
			console.error(err);
		});
	const mainConfig = await mainProcess.parseConfigRenderer('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
	let length;
	if (mainConfig.extraCabinets === true) {
		({length} = Object.keys(videoFiles));
	} else {
		length = 30;
	}
	for (let i = 0; i < length; i++) {
		if (videoFiles[i]) {
			$('#videoFiles').append(`<li class="list-group-item"><span class="badge">${i + 1}</span>${path.basename(videoFiles[i].path)}</li>`);
		}
	}

	$('.bottom-bar').addClass('bottom-bar-info');
	$('.bottom-bar').html(`Version: ${module.exports.version}`);
});

const el = document.getElementById('videoFiles');
Sortable.create(el, {
	onEnd(evt) {
		switchGridPosition(evt.oldIndex, evt.newIndex);
	}
});

async function switchGridPosition(from, to) {
	const videoFiles = await mainProcess.parseConfigRenderer('get', 'videoFiles', false)
		.catch(err => {
			console.error(err);
		});
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
	await mainProcess.parseConfigRenderer('set', 'videoFiles', videoFilesTmp)
		.catch(err => {
			console.error(err);
		});
	// Check if reordering default video and update mainConfig with new gridnum
	const configData = await mainProcess.parseConfigRenderer('get', 'main', false)
		.catch(err => {
			console.error(err);
		});
	if (configData !== undefined) {
		if (configData.defaultVideoGridNum === from) {
			configData.defaultVideoGridNum = to;
			await mainProcess.parseConfigRenderer('set', 'main', configData);
		}
	}
	// Re number the list
	let i = 1;
	$('#videoFiles li').each(function () {
		$(this)[0].firstChild.innerText = i++;
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
