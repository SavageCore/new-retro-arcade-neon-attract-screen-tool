const path = require('path');
const electron = require('electron');

const remote = electron.remote;
const mainProcess = remote.require('./main');
window.$ = window.jQuery = require('jquery');
var Sortable = require('sortablejs');
require('../menu');
require('pkginfo')(module, 'version');

/* global $:true */
/* global window:true */
/* global document:true */

$(document).ready(function () {
	mainProcess.sortableList(function (data) {
		mainProcess.parseConfigRenderer('get', 'main', false, function (mainConfig) {
			var length;
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

var el = document.getElementById('videoFiles');
Sortable.create(el, {
	onEnd: function (evt) {
		switchGridPosition(evt.oldIndex, evt.newIndex);
	}
});

function switchGridPosition(from, to) {
	mainProcess.parseConfigRenderer('get', 'videoFiles', false, function (videoFiles) {
		var videoFilesTmp = {};
		var videoFilesArr = [];
		// Convert to array
		videoFilesArr = Object.keys(videoFiles).map(key => videoFiles[key]);
		// Move item in array
		videoFilesArr = arrayMove(videoFilesArr, from, to);
		// Convert back to Object
		videoFilesTmp = videoFilesArr.reduce(function (o, v, i) {
			o[i] = v;
			return o;
		}, {});
		// Save to config
		mainProcess.parseConfigRenderer('set', 'videoFiles', videoFilesTmp, function () {
			// Re number the list
			var i = 1;
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
		var k = newIndex - array.length;
		while ((k--) + 1) {
			array.push(undefined);
		}
	}
	array.splice(newIndex, 0, array.splice(oldIndex, 1)[0]);
	return array;
}
